-- CreateEnum
CREATE TYPE "OpportunityStatus" AS ENUM ('OPEN', 'PROPOSED', 'DISMISSED');

-- CreateTable
CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "problem" TEXT NOT NULL,
    "whoBenefits" TEXT NOT NULL,
    "topicId" TEXT,
    "evidenceIds" TEXT[],
    "clusterKey" TEXT NOT NULL,
    "status" "OpportunityStatus" NOT NULL DEFAULT 'OPEN',
    "projectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Opportunity_clusterKey_key" ON "Opportunity"("clusterKey");
