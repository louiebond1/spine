import "server-only";
import type { Prisma } from "@prisma/client";
import { rootDb } from "../db";

export const DEFAULT_TOPICS = ["Security", "Office", "Excel", "Technical", "Productivity", "Procurement", "Finance", "Sales", "Operations", "Legal", "People"];

export function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "org"
  );
}

/** A new organisation with its settings and starter topics, in one transaction. */
export async function createOrganization(name: string, tx: Prisma.TransactionClient = rootDb) {
  const base = slugify(name);
  let slug = base;
  for (let i = 2; await tx.organization.findUnique({ where: { slug } }); i++) slug = `${base}-${i}`;
  const org = await tx.organization.create({ data: { name: name.trim().slice(0, 80), slug } });
  await tx.settings.create({ data: { orgId: org.id } });
  await tx.topic.createMany({ data: DEFAULT_TOPICS.map((t) => ({ orgId: org.id, name: t })) });
  return org;
}
