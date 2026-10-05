import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import type { User } from "@prisma/client";
import { db } from "./db";

// Demo mode: the acting user is whoever the switcher picked, stored in a cookie.
// Real auth replaces this file only; everything else calls getCurrentUser().

export const SESSION_COOKIE = "spine_user";

export const getCurrentUser = cache(async (): Promise<User> => {
  const id = (await cookies()).get(SESSION_COOKIE)?.value;
  const user =
    (id ? await db.user.findUnique({ where: { id } }) : null) ??
    (await db.user.findFirst({ orderBy: { createdAt: "asc" } }));
  if (!user) throw new Error("No users found. Run `npm run seed` first.");
  return user;
});
