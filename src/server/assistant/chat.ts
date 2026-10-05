import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { Prisma, User } from "@prisma/client";
import { longDate, pageDate, rolesLine } from "@/lib/format";
import { fixturesEnabled } from "../ai/client";
import { now } from "../clock";
import { db } from "../db";
import { getNeedsYou } from "../home/needsYou";
import { TOOLS, runTool, type ProposedAction } from "./tools";

// Ask Spine: a streaming tool-use loop. History is stored append-only (full content blocks,
// including thinking and tool calls) and replayed unchanged on the next turn.

export type ChatEvent =
  | { type: "thread"; threadId: string }
  | { type: "text"; delta: string }
  | { type: "tool"; label: string }
  | { type: "action"; action: ProposedAction }
  | { type: "done" }
  | { type: "error"; message: string };

const TOOL_LABELS: Record<string, string> = {
  get_my_overview: "Checking what needs you",
  search_projects: "Searching projects",
  get_project: "Reading the project",
  search_knowledge: "Searching answered questions",
  get_pulse: "Checking Pulse",
  propose_add_step: "Preparing a plan step",
  propose_post_update: "Drafting an update",
  propose_ask_question: "Drafting a Help Desk question",
};

const MAX_TURNS = 8;

let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic());

async function systemPrompt(viewer: User, projectId: string | null) {
  const project = projectId ? await db.project.findUnique({ where: { id: projectId }, select: { id: true, title: true, stage: true, ownerId: true } }) : null;
  const visible = project && (project.stage !== "IDEA" || project.ownerId === viewer.id) ? project : null;
  return [
    `You are Spine, the AI project manager inside the company's AI adoption platform. Spine makes sure good AI ideas and questions never quietly die.`,
    `You are talking to ${viewer.name} (${rolesLine(viewer)}). Today is ${pageDate(now())} (${longDate(now())}).`,
    visible ? `They opened you from the project "${visible.title}" (id ${visible.id}). Assume questions are about this project unless they say otherwise; call get_project before answering about it.` : `They opened you from the app, not a specific project.`,
    ``,
    `How Spine works: Help Desk (anyone asks AI questions; Champions claim and answer them privately). Ideas & Projects (an idea gets an advisory AI review, leadership approval, a team, a build plan, then publishing and Live; App ideas are approved before recruiting, Cowork-native ideas after building). Pulse (flags approvals near timeout, unanswered questions and quiet builds). Leaderboard (Champions ranked by questions resolved).`,
    ``,
    `Rules:`,
    `- Use the tools for any fact about projects, people, plans or questions. Never invent names, dates, steps or numbers.`,
    `- For "how do I" questions about using AI at work, call search_knowledge first and build on what Champions already answered, linking the question (as a markdown link with its link path). If nothing relevant exists, answer from general knowledge and offer to post it to the Help Desk.`,
    `- You can't change anything yourself. To add a step, post an update or ask the Help Desk, call the matching propose_ tool; the user confirms with a button. Say so in one short sentence.`,
    `- Act like a calm, sharp project manager: lead with what to do next, flag risks (overdue steps, quiet builds, approvals about to auto-approve), keep it short.`,
    `- When asked to nudge or unstick a team: read the project, name the overdue or next steps and who owns them, and propose_post_update a short, warm message that asks one clear question. Never guilt-trip.`,
    `- Plain English, short paragraphs or a few bullets. Markdown links to app paths like /ideas/<id> are fine. No headings, no tables, no em dashes, no emoji.`,
    `- Never reveal who asked an anonymous question, and never mention AI scores except the user's own ideas' scores when they ask.`,
  ].join("\n");
}

/** Local development without an API key: a small deterministic reply from real data. */
async function fixtureReply(viewer: User, projectId: string | null, message: string, emit: (e: ChatEvent) => void, propose: (a: ProposedAction) => void) {
  let text: string;
  if (projectId) {
    emit({ type: "tool", label: TOOL_LABELS.get_project! });
    const data = JSON.parse(await runTool("get_project", { projectId }, viewer, propose)) as { title: string; stage: string; next: string | null; plan: { title: string; done: boolean; overdue: boolean }[] };
    const open = data.plan.filter((s) => !s.done);
    const overdue = open.filter((s) => s.overdue);
    if (/add (a )?step/i.test(message)) {
      const title = message.replace(/.*add (a )?step( to)?/i, "").trim() || "Review progress with the team";
      await runTool("propose_add_step", { projectId, title: title.charAt(0).toUpperCase() + title.slice(1) }, viewer, propose);
      text = `I've drafted that step. Confirm it below and I'll add it to the plan.`;
    } else {
      text = `${data.title} is in ${data.stage}. ${data.next ?? ""}\n\n${open.length ? `${open.length} steps are still open${overdue.length ? `, and ${overdue.length} ${overdue.length === 1 ? "is" : "are"} overdue: ${overdue.map((s) => s.title).join(", ")}` : ""}.` : "Every step is done."}`;
    }
  } else {
    emit({ type: "tool", label: TOOL_LABELS.get_my_overview! });
    const needs = await getNeedsYou(viewer);
    text = needs.length
      ? `Start with ${needs[0]!.title}: ${[needs[0]!.reason.before, needs[0]!.reason.emphasis, needs[0]!.reason.after].join("")}.${needs.length > 1 ? ` Then ${needs.slice(1).map((n) => n.title).join(" and ")}.` : ""}`
      : `Nothing needs you right now. A good use of the time: check Pulse for anything going quiet.`;
  }
  text += `\n\n(Spine is running without an API key, so this is a simple local answer.)`;
  for (const word of text.split(/(?<= )/)) emit({ type: "text", delta: word });
  return text;
}

export async function runChat(opts: { viewer: User; threadId?: string | null; projectId?: string | null; message: string; emit: (e: ChatEvent) => void }) {
  const { viewer, emit } = opts;
  const message = opts.message.trim().slice(0, 4000);
  const projectId = opts.projectId || null;

  // One running thread per user and context; the user can start a fresh one.
  let thread = opts.threadId ? await db.assistantThread.findFirst({ where: { id: opts.threadId, userId: viewer.id } }) : null;
  thread ??= await db.assistantThread.create({ data: { userId: viewer.id, projectId } });
  emit({ type: "thread", threadId: thread.id });

  const history = await db.assistantMessage.findMany({ where: { threadId: thread.id }, orderBy: { createdAt: "asc" }, take: 40 });
  const messages: Anthropic.Beta.BetaMessageParam[] = history.flatMap((h) => h.content as unknown as Anthropic.Beta.BetaMessageParam[]);
  const userTurn: Anthropic.Beta.BetaMessageParam = { role: "user", content: message };
  messages.push(userTurn);
  await db.assistantMessage.create({ data: { threadId: thread.id, role: "user", text: message, content: [userTurn] as unknown as Prisma.InputJsonValue } });

  const actions: ProposedAction[] = [];
  const propose = (a: ProposedAction) => {
    actions.push(a);
    emit({ type: "action", action: a });
  };
  const newTurns: Anthropic.Beta.BetaMessageParam[] = [];
  let finalText = "";

  try {
    if (fixturesEnabled() || !process.env.ANTHROPIC_API_KEY) {
      finalText = await fixtureReply(viewer, thread.projectId, message, emit, propose);
      newTurns.push({ role: "assistant", content: finalText });
    } else {
      const system = await systemPrompt(viewer, thread.projectId);
      for (let turn = 0; turn < MAX_TURNS; turn++) {
        const stream = anthropic().beta.messages.stream({
          model: process.env.ANTHROPIC_MODEL!,
          max_tokens: 16000,
          system,
          tools: TOOLS,
          messages: [...messages, ...newTurns],
          output_config: { effort: "medium" },
          // Server-side fallback: if the model declines for safety reasons, the API retries
          // on a fallback model chosen by refusal category.
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
        });
        stream.on("text", (delta) => {
          finalText += delta;
          emit({ type: "text", delta });
        });
        const response = await stream.finalMessage();
        newTurns.push({ role: "assistant", content: response.content as Anthropic.Beta.BetaContentBlockParam[] });

        if (response.stop_reason === "refusal") {
          const note = "\n\nI can't help with that one.";
          finalText += note;
          emit({ type: "text", delta: note });
          break;
        }
        if (response.stop_reason === "pause_turn") continue;
        const toolUses = response.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
        if (response.stop_reason !== "tool_use" || toolUses.length === 0) break;

        const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
        for (const use of toolUses) {
          emit({ type: "tool", label: TOOL_LABELS[use.name] ?? "Working" });
          try {
            results.push({ type: "tool_result", tool_use_id: use.id, content: await runTool(use.name, use.input, viewer, propose) });
          } catch {
            results.push({ type: "tool_result", tool_use_id: use.id, content: "That lookup failed.", is_error: true });
          }
        }
        newTurns.push({ role: "user", content: results });
        if (finalText && !finalText.endsWith("\n")) {
          finalText += "\n\n";
          emit({ type: "text", delta: "\n\n" });
        }
      }
    }
  } catch (error) {
    const msg = error instanceof Anthropic.AuthenticationError ? "Spine's API key isn't working. An admin needs to check ANTHROPIC_API_KEY." : "Spine couldn't answer just now. Try again.";
    emit({ type: "error", message: msg });
    finalText ||= msg;
    // Never store a tool call without its result, or the next turn would be rejected.
    const last = newTurns[newTurns.length - 1];
    if (last?.role === "assistant" && Array.isArray(last.content) && last.content.some((b) => b.type === "tool_use")) newTurns.pop();
  }

  await db.assistantMessage.create({
    data: {
      threadId: thread.id,
      role: "assistant",
      text: finalText.trim(),
      content: newTurns as unknown as Prisma.InputJsonValue,
      actions: actions as unknown as Prisma.InputJsonValue,
    },
  });
  await db.assistantThread.update({ where: { id: thread.id }, data: { updatedAt: now() } });
  emit({ type: "done" });
}
