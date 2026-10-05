"use server";

import { getCurrentUser } from "../session";
import { findSimilarResolved } from "./queries";

export async function suggestSimilar(title: string) {
  const user = await getCurrentUser();
  return findSimilarResolved(title.slice(0, 200), user);
}
