import "server-only";
import type { Question } from "@prisma/client";

/**
 * CLAUDE.md section 7, Help Desk rule 6: a question is waiting on the claimer when the last
 * message is from the asker. The question body counts as the asker's first message, so a
 * freshly claimed question with no replies is waiting on the claimer too.
 */
export function lastSpeakerIsAsker(q: Pick<Question, "askerId"> & { messages: { authorId: string }[] }): boolean {
  const last = q.messages[0];
  return !last || last.authorId === q.askerId;
}
