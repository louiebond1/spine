import "server-only";
import { PrismaClient } from "@prisma/client";

// The unscoped client. Only identity (sessions, sign-in, invitations), tenancy setup and the
// scheduled job may use it; everything else goes through forOrg() in ./tenant so that a query
// can never reach another organisation's data. scripts/guard.mjs enforces this.

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const rootDb = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = rootDb;
