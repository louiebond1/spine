-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "hoursSavedEstimate" INTEGER,
ADD COLUMN     "laterScope" TEXT,
ADD COLUMN     "mvpScope" TEXT,
ADD COLUMN     "successMetric" TEXT,
ADD COLUMN     "useCases" JSONB;

-- CreateTable
CREATE TABLE "ProjectInvite" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "status" "InviteStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectInvite_userId_status_idx" ON "ProjectInvite"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectInvite_projectId_userId_key" ON "ProjectInvite"("projectId", "userId");

-- AddForeignKey
ALTER TABLE "ProjectInvite" ADD CONSTRAINT "ProjectInvite_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
