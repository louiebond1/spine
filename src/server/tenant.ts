import "server-only";
import { rootDb } from "./db";

/**
 * Models that belong to one organisation. Every query on them made through forOrg() is
 * filtered by orgId, and every create is stamped with it, so a missing filter in a feature
 * can't leak or write across organisations. Child records (messages, steps, events) are only
 * reached through a parent that was itself loaded through this client.
 */
const TENANT_MODELS = new Set([
  "User",
  "Topic",
  "Question",
  "Project",
  "ApprovalRule",
  "Opportunity",
  "LeadershipReport",
  "Settings",
  "Invitation",
  "AuditLog",
  "AiCall",
  "Priority",
  "Tool",
  "Guide",
  "Discovery",
]);

type Args = { where?: Record<string, unknown>; data?: unknown; create?: Record<string, unknown> };

export function forOrg(orgId: string) {
  if (!orgId) throw new Error("forOrg needs an organisation id");
  return rootDb.$extends({
    name: "tenant",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!TENANT_MODELS.has(model)) return query(args);
          const a = { ...((args ?? {}) as Args) };
          switch (operation) {
            case "create":
              a.data = { ...(a.data as object), orgId };
              break;
            case "createMany":
            case "createManyAndReturn":
              a.data = Array.isArray(a.data) ? a.data.map((d: object) => ({ ...d, orgId })) : { ...(a.data as object), orgId };
              break;
            case "upsert":
              a.where = { ...a.where, orgId };
              a.create = { ...a.create, orgId };
              break;
            default:
              // find*, count, aggregate, groupBy, update*, delete*
              a.where = { ...(a.where ?? {}), orgId };
          }
          return query(a as typeof args);
        },
      },
    },
  });
}

export type OrgDb = ReturnType<typeof forOrg>;
/** The client inside an interactive transaction on an OrgDb (still scoped). */
export type Tx = Parameters<Parameters<OrgDb["$transaction"]>[0]>[0];
