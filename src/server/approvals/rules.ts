import "server-only";
import { Prisma, type ApprovalRule, type Project } from "@prisma/client";
import { getSettings } from "../settings";

// Approval routing. Admins write rules in Admin > Approvals; the first active rule (by position)
// whose conditions match decides who approves, how many must sign off, when it auto-approves,
// or whether it skips review entirely. With no matching rule the brief's default applies: any
// admin, one approval, auto-approve after Settings.approvalTimeoutDays.

type Tx = Prisma.TransactionClient;
type Routable = Pick<Project, "id" | "topicId" | "buildPath" | "difficulty" | "teamSize" | "hoursPerWeek" | "lengthWeeks">;

export type Route = {
  ruleId: string | null;
  ruleName: string | null;
  approverIds: string[];
  approvalsNeeded: number;
  autoApproveDays: number | null;
  fastTrack: boolean;
};

const DAY = 86_400_000;

export const totalHours = (p: Pick<Project, "teamSize" | "hoursPerWeek" | "lengthWeeks">) => p.teamSize * p.hoursPerWeek * p.lengthWeeks;

export function ruleMatches(rule: ApprovalRule, p: Routable, raisedConcerns: boolean) {
  if (!rule.active) return false;
  if (rule.topicIds.length && !rule.topicIds.includes(p.topicId)) return false;
  if (rule.buildPaths.length && !rule.buildPaths.includes(p.buildPath)) return false;
  if (rule.difficulties.length && !rule.difficulties.includes(p.difficulty)) return false;
  const hours = totalHours(p);
  if (rule.minTotalHours != null && hours < rule.minTotalHours) return false;
  if (rule.maxTotalHours != null && hours > rule.maxTotalHours) return false;
  if (rule.onlyWithConcerns && !raisedConcerns) return false;
  return true;
}

export async function routeFor(tx: Tx, p: Routable): Promise<Route> {
  const [rules, review, settings] = await Promise.all([
    tx.approvalRule.findMany({ where: { active: true }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] }),
    tx.aiReview.findUnique({ where: { projectId: p.id }, select: { raisedConcerns: true } }),
    getSettings(),
  ]);
  const rule = rules.find((r) => ruleMatches(r, p, review?.raisedConcerns ?? false));
  if (!rule) return { ruleId: null, ruleName: null, approverIds: [], approvalsNeeded: 1, autoApproveDays: settings.approvalTimeoutDays, fastTrack: false };
  const approverIds = rule.approverIds;
  return {
    ruleId: rule.id,
    ruleName: rule.name,
    approverIds,
    approvalsNeeded: rule.requireAll && approverIds.length > 0 ? approverIds.length : 1,
    autoApproveDays: rule.autoApproveDays,
    fastTrack: rule.fastTrack,
  };
}

/** Fields to write when a project enters Approval, plus whether it should be approved at once. */
export async function enterApproval(tx: Tx, p: Routable, at: Date) {
  const route = await routeFor(tx, p);
  // The owner never approves their own idea, so drop them from the approver list.
  const owner = await tx.project.findUniqueOrThrow({ where: { id: p.id }, select: { ownerId: true } });
  const approverIds = route.approverIds.filter((id) => id !== owner.ownerId);
  await tx.projectApproval.deleteMany({ where: { projectId: p.id } });
  return {
    route,
    data: {
      approvalRuleId: route.ruleId,
      approverIds,
      approvalsNeeded: Math.max(1, Math.min(route.approvalsNeeded, approverIds.length || 1)),
      autoApproveAt: route.autoApproveDays == null ? null : new Date(at.getTime() + route.autoApproveDays * DAY),
      approvalBrief: Prisma.DbNull,
    },
  };
}

const LABEL: Record<string, string> = { APP: "App", COWORK_NATIVE: "Cowork-native", EASY: "Easy", MODERATE: "Moderate", HARD: "Hard" };
const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} or ${xs[xs.length - 1]}`);
const listAnd = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

/** The rule as one plain sentence, for the Admin list and the approval page. */
export function describeRule(rule: Omit<ApprovalRule, "id" | "createdAt" | "updatedAt" | "position" | "active" | "name">, names: { topics: Map<string, string>; users: Map<string, string> }) {
  const when: string[] = [];
  if (rule.topicIds.length) when.push(`the topic is ${list(rule.topicIds.map((t) => names.topics.get(t) ?? "a removed topic"))}`);
  if (rule.buildPaths.length) when.push(`it's ${list(rule.buildPaths.map((b) => (b === "APP" ? "an App" : "Cowork-native")))}`);
  if (rule.difficulties.length) when.push(`difficulty is ${list(rule.difficulties.map((d) => LABEL[d] ?? d))}`);
  if (rule.minTotalHours != null) when.push(`it needs at least ${rule.minTotalHours} hours in total`);
  if (rule.maxTotalHours != null) when.push(`it needs no more than ${rule.maxTotalHours} hours in total`);
  if (rule.onlyWithConcerns) when.push("the AI review raised concerns");
  const condition = when.length ? `When ${listAnd(when)}` : "For every idea";
  if (rule.fastTrack) return `${condition}, it's approved straight away.`;
  const who = rule.approverIds.length ? rule.approverIds.map((u) => names.users.get(u) ?? "someone who left") : [];
  const approvers = who.length === 0 ? "any admin approves" : who.length === 1 ? `${who[0]} approves` : rule.requireAll ? `${listAnd(who)} must all approve` : `any of ${list(who)} can approve`;
  const timeout = rule.autoApproveDays == null ? "it never auto-approves" : `it auto-approves after ${rule.autoApproveDays} ${rule.autoApproveDays === 1 ? "day" : "days"}`;
  return `${condition}, ${approvers} and ${timeout}.`;
}
