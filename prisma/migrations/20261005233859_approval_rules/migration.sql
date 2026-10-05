-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ProjectEventType" ADD VALUE 'PARTIALLY_APPROVED';
ALTER TYPE "ProjectEventType" ADD VALUE 'FAST_TRACKED';

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "approvalBrief" JSONB,
ADD COLUMN     "approvalRuleId" TEXT,
ADD COLUMN     "approvalsNeeded" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "approverIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "ApprovalRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "topicIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "buildPaths" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "difficulties" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "minTotalHours" INTEGER,
    "maxTotalHours" INTEGER,
    "onlyWithConcerns" BOOLEAN NOT NULL DEFAULT false,
    "approverIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "requireAll" BOOLEAN NOT NULL DEFAULT false,
    "autoApproveDays" INTEGER,
    "fastTrack" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectApproval" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectApproval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectApproval_projectId_userId_key" ON "ProjectApproval"("projectId", "userId");

-- AddForeignKey
ALTER TABLE "ProjectApproval" ADD CONSTRAINT "ProjectApproval_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
