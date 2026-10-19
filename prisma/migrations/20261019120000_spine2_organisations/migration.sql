-- Spine 2.0: organisations, identity, privacy, momentum and the AI playbook.
--
-- Safe to run on the existing single-company database:
--   * every existing row is assigned to one organisation, "org_default" (rename it in Admin);
--   * nothing is dropped: removed features keep their tables until a deliberate later drop;
--   * it runs in one transaction, so any failure leaves the database exactly as it was;
--   * duplicate sign-in emails stop the migration with a clear message instead of guessing.
-- Rollback: restore the pre-migration backup (docs/DEPLOYMENT.md). There is no down migration.

BEGIN;

-- Normalise emails, then refuse to continue if two people share one.
UPDATE "User" SET "email" = lower(trim("email")) WHERE "email" IS NOT NULL;
UPDATE "User" SET "email" = NULL WHERE "email" = '';
DO $$
BEGIN
  IF EXISTS (SELECT "email" FROM "User" WHERE "email" IS NOT NULL GROUP BY "email" HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Spine 2.0 migration stopped: two or more people share an email address. Fix them, then deploy again.';
  END IF;
END $$;

-- AlterEnum (new values are only used by the app, never inside this migration)
ALTER TYPE "ProjectEventType" ADD VALUE 'CHECKED_IN';
ALTER TYPE "ProjectEventType" ADD VALUE 'BLOCKED';
ALTER TYPE "ProjectEventType" ADD VALUE 'UNBLOCKED';
ALTER TYPE "ProjectEventType" ADD VALUE 'OUTCOME_VERIFIED';
ALTER TYPE "ProjectEventType" ADD VALUE 'CHANNEL_LINKED';

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INVITED', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "CheckInStatus" AS ENUM ('ON_TRACK', 'AT_RISK', 'BLOCKED');

-- CreateEnum
CREATE TYPE "ToolStatus" AS ENUM ('APPROVED', 'LIMITED', 'NOT_APPROVED');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);


INSERT INTO "Organization" ("id", "name", "slug", "updatedAt")
VALUES ('org_default', 'My organisation', 'default', CURRENT_TIMESTAMP);

-- DropIndex
DROP INDEX "LeadershipReport_month_key";

-- DropIndex
DROP INDEX "Opportunity_clusterKey_key";

-- DropIndex
DROP INDEX "Project_stage_autoApproveAt_idx";

-- DropIndex
DROP INDEX "Project_stage_lastActivityAt_idx";

-- DropIndex
DROP INDEX "Question_status_postedAt_idx";

-- DropIndex
DROP INDEX "Topic_name_key";

-- AlterTable
ALTER TABLE "ApprovalRule" ADD COLUMN     "orgId" TEXT NOT NULL DEFAULT 'org_default';

-- AlterTable
ALTER TABLE "ImpactLog" ADD COLUMN     "evidence" TEXT,
ADD COLUMN     "reportedById" TEXT,
ADD COLUMN     "verifiedAt" TIMESTAMP(3),
ADD COLUMN     "verifiedById" TEXT;

-- AlterTable
ALTER TABLE "LeadershipReport" ADD COLUMN     "orgId" TEXT NOT NULL DEFAULT 'org_default';

-- AlterTable
ALTER TABLE "Opportunity" ADD COLUMN     "orgId" TEXT NOT NULL DEFAULT 'org_default';

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "blockedAt" TIMESTAMP(3),
ADD COLUMN     "blockerNote" TEXT,
ADD COLUMN     "channelUrl" TEXT,
ADD COLUMN     "checkInEveryDays" INTEGER DEFAULT 7,
ADD COLUMN     "nextCheckInAt" TIMESTAMP(3),
ADD COLUMN     "orgId" TEXT NOT NULL DEFAULT 'org_default',
ALTER COLUMN "buildPath" SET DEFAULT 'APP';

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "answerSummary" TEXT,
ADD COLUMN     "orgId" TEXT NOT NULL DEFAULT 'org_default',
ADD COLUMN     "sharedAt" TIMESTAMP(3),
ADD COLUMN     "sharedById" TEXT;

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "aiMonthlyLimit" INTEGER NOT NULL DEFAULT 1000,
ADD COLUMN     "allowedEmailDomain" TEXT,
ADD COLUMN     "orgId" TEXT NOT NULL DEFAULT 'org_default',
ADD COLUMN     "slackWebhookEnc" TEXT,
ADD COLUMN     "teamsWebhookEnc" TEXT,
ADD COLUMN     "slackLastAt" TIMESTAMP(3),
ADD COLUMN     "slackLastStatus" TEXT,
ADD COLUMN     "teamsLastAt" TIMESTAMP(3),
ADD COLUMN     "teamsLastStatus" TEXT,
ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Topic" ADD COLUMN     "orgId" TEXT NOT NULL DEFAULT 'org_default';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "orgId" TEXT NOT NULL DEFAULT 'org_default',
ADD COLUMN     "passwordHash" TEXT,
ADD COLUMN     "slackUserId" TEXT,
ADD COLUMN     "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isChampion" BOOLEAN NOT NULL DEFAULT false,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "isPublishingSpecialist" BOOLEAN NOT NULL DEFAULT false,
    "tokenHash" TEXT NOT NULL,
    "invitedById" TEXT,
    "userId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "detail" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiCall" (
    "id" TEXT NOT NULL,
    "orgId" TEXT,
    "feature" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "errorKind" TEXT,
    "durationMs" INTEGER NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckIn" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "status" "CheckInStatus" NOT NULL,
    "note" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Priority" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Priority_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tool" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "status" "ToolStatus" NOT NULL DEFAULT 'APPROVED',
    "dataGuidance" TEXT NOT NULL,
    "url" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Guide" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Guide_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Discovery" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "toolName" TEXT,
    "topicId" TEXT,
    "projectId" TEXT,
    "at" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Discovery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON "Invitation"("tokenHash");

-- CreateIndex
CREATE INDEX "Invitation_orgId_email_idx" ON "Invitation"("orgId", "email");

-- CreateIndex
CREATE INDEX "AuditLog_orgId_at_idx" ON "AuditLog"("orgId", "at");

-- CreateIndex
CREATE INDEX "AiCall_orgId_at_idx" ON "AiCall"("orgId", "at");

-- CreateIndex
CREATE INDEX "AiCall_at_idx" ON "AiCall"("at");

-- CreateIndex
CREATE INDEX "CheckIn_projectId_at_idx" ON "CheckIn"("projectId", "at");

-- CreateIndex
CREATE INDEX "Priority_orgId_position_idx" ON "Priority"("orgId", "position");

-- CreateIndex
CREATE INDEX "Tool_orgId_position_idx" ON "Tool"("orgId", "position");

-- CreateIndex
CREATE INDEX "Guide_orgId_position_idx" ON "Guide"("orgId", "position");

-- CreateIndex
CREATE INDEX "Discovery_orgId_at_idx" ON "Discovery"("orgId", "at");

-- CreateIndex
CREATE INDEX "ApprovalRule_orgId_position_idx" ON "ApprovalRule"("orgId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "LeadershipReport_orgId_month_key" ON "LeadershipReport"("orgId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "Opportunity_orgId_clusterKey_key" ON "Opportunity"("orgId", "clusterKey");

-- CreateIndex
CREATE INDEX "Project_orgId_stage_autoApproveAt_idx" ON "Project"("orgId", "stage", "autoApproveAt");

-- CreateIndex
CREATE INDEX "Project_orgId_stage_lastActivityAt_idx" ON "Project"("orgId", "stage", "lastActivityAt");

-- CreateIndex
CREATE INDEX "Question_orgId_status_postedAt_idx" ON "Question"("orgId", "status", "postedAt");

-- CreateIndex
CREATE INDEX "Question_orgId_sharedAt_idx" ON "Question"("orgId", "sharedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Settings_orgId_key" ON "Settings"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Topic_orgId_name_key" ON "Topic"("orgId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_orgId_idx" ON "User"("orgId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Discovery" ADD CONSTRAINT "Discovery_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Discovery" ADD CONSTRAINT "Discovery_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Discovery" ADD CONSTRAINT "Discovery_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Backfill done: tenant columns no longer default to the first organisation.
ALTER TABLE "ApprovalRule" ALTER COLUMN "orgId" DROP DEFAULT;
ALTER TABLE "LeadershipReport" ALTER COLUMN "orgId" DROP DEFAULT;
ALTER TABLE "Opportunity" ALTER COLUMN "orgId" DROP DEFAULT;
ALTER TABLE "Project" ALTER COLUMN "orgId" DROP DEFAULT;
ALTER TABLE "Question" ALTER COLUMN "orgId" DROP DEFAULT;
ALTER TABLE "Settings" ALTER COLUMN "orgId" DROP DEFAULT;
ALTER TABLE "Topic" ALTER COLUMN "orgId" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "orgId" DROP DEFAULT;

-- Existing projects get a first check-in date a week from now when they are building.
UPDATE "Project" SET "nextCheckInAt" = CURRENT_TIMESTAMP + interval '7 days' WHERE "stage" = 'BUILDING';

COMMIT;
