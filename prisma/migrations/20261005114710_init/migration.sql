-- CreateEnum
CREATE TYPE "QuestionStatus" AS ENUM ('UNCLAIMED', 'IN_PROGRESS', 'RESOLVED');

-- CreateEnum
CREATE TYPE "QuestionEventType" AS ENUM ('POSTED', 'CLAIMED', 'REPLIED', 'REPLIED_WITH_FILE', 'RESOLVED', 'REOPENED');

-- CreateEnum
CREATE TYPE "BuildPath" AS ENUM ('APP', 'COWORK_NATIVE');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('EASY', 'MODERATE', 'HARD');

-- CreateEnum
CREATE TYPE "ProjectStage" AS ENUM ('IDEA', 'APPROVAL', 'RECRUITING', 'BUILDING', 'PUBLISHING', 'LIVE');

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('NONE', 'GENERATING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "ProjectEventType" AS ENUM ('CREATED', 'AI_REVIEWED', 'SUBMITTED', 'RETURNED', 'APPROVED', 'AUTO_APPROVED', 'JOINED', 'RECRUITED', 'PLAN_GENERATED', 'STEP_ADDED', 'STEP_EDITED', 'STEP_COMPLETED', 'STEP_REOPENED', 'BUILD_COMPLETED', 'PUBLISHER_ASSIGNED', 'WENT_LIVE', 'HOURS_LOGGED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "initials" TEXT NOT NULL,
    "isChampion" BOOLEAN NOT NULL DEFAULT false,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "isPublishingSpecialist" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Topic" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Topic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "askerId" TEXT NOT NULL,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "topicId" TEXT NOT NULL,
    "status" "QuestionStatus" NOT NULL DEFAULT 'UNCLAIMED',
    "claimerId" TEXT,
    "postedAt" TIMESTAMP(3) NOT NULL,
    "claimedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionMessage" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionEvent" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "type" "QuestionEventType" NOT NULL,
    "actorId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "problem" TEXT NOT NULL,
    "whoBenefits" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "buildPath" "BuildPath" NOT NULL,
    "teamSize" INTEGER NOT NULL,
    "hoursPerWeek" INTEGER NOT NULL,
    "lengthWeeks" INTEGER NOT NULL,
    "difficulty" "Difficulty" NOT NULL,
    "targetDate" TIMESTAMP(3) NOT NULL,
    "ownerId" TEXT NOT NULL,
    "stage" "ProjectStage" NOT NULL DEFAULT 'IDEA',
    "submittedAt" TIMESTAMP(3),
    "autoApproveAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "returnNote" TEXT,
    "publisherId" TEXT,
    "publishingAssignedAt" TIMESTAMP(3),
    "buildCompletedAt" TIMESTAMP(3),
    "liveAt" TIMESTAMP(3),
    "lastActivityAt" TIMESTAMP(3) NOT NULL,
    "planStatus" "PlanStatus" NOT NULL DEFAULT 'NONE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiReview" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "feasibility" INTEGER NOT NULL,
    "feasibilityReason" TEXT NOT NULL,
    "businessValue" INTEGER NOT NULL,
    "businessValueReason" TEXT NOT NULL,
    "resourcingConfidence" INTEGER NOT NULL,
    "resourcingConfidenceReason" TEXT NOT NULL,
    "originality" INTEGER NOT NULL,
    "originalityReason" TEXT NOT NULL,
    "relatedProjectId" TEXT,
    "raisedConcerns" BOOLEAN NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanStep" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "activePhrase" TEXT NOT NULL,
    "assigneeId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "doneAt" TIMESTAMP(3),
    "order" INTEGER NOT NULL,
    "generatedFromBrief" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMessage" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "authorId" TEXT,
    "body" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectEvent" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" "ProjectEventType" NOT NULL,
    "actorId" TEXT,
    "detail" TEXT,
    "at" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImpactLog" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "month" TIMESTAMP(3) NOT NULL,
    "hoursSaved" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImpactLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "approvalTimeoutDays" INTEGER NOT NULL DEFAULT 7,
    "stalledBuildDays" INTEGER NOT NULL DEFAULT 10,
    "unclaimedQuestionHours" INTEGER NOT NULL DEFAULT 2,
    "digestChannel" TEXT NOT NULL DEFAULT 'Slack',
    "digestTime" TEXT NOT NULL DEFAULT '09:00',
    "digestWeekdaysOnly" BOOLEAN NOT NULL DEFAULT true,
    "hourlyCost" DECIMAL(10,2),
    "programmeCost" DECIMAL(12,2),
    "lastDigestSentOn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Topic_name_key" ON "Topic"("name");

-- CreateIndex
CREATE INDEX "Question_status_postedAt_idx" ON "Question"("status", "postedAt");

-- CreateIndex
CREATE INDEX "Question_claimerId_resolvedAt_idx" ON "Question"("claimerId", "resolvedAt");

-- CreateIndex
CREATE INDEX "QuestionMessage_questionId_sentAt_idx" ON "QuestionMessage"("questionId", "sentAt");

-- CreateIndex
CREATE INDEX "QuestionEvent_questionId_at_idx" ON "QuestionEvent"("questionId", "at");

-- CreateIndex
CREATE INDEX "Project_stage_autoApproveAt_idx" ON "Project"("stage", "autoApproveAt");

-- CreateIndex
CREATE INDEX "Project_stage_lastActivityAt_idx" ON "Project"("stage", "lastActivityAt");

-- CreateIndex
CREATE UNIQUE INDEX "AiReview_projectId_key" ON "AiReview"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMember_projectId_userId_key" ON "TeamMember"("projectId", "userId");

-- CreateIndex
CREATE INDEX "PlanStep_projectId_order_idx" ON "PlanStep"("projectId", "order");

-- CreateIndex
CREATE INDEX "ProjectMessage_projectId_sentAt_idx" ON "ProjectMessage"("projectId", "sentAt");

-- CreateIndex
CREATE INDEX "ProjectEvent_projectId_at_idx" ON "ProjectEvent"("projectId", "at");

-- CreateIndex
CREATE UNIQUE INDEX "ImpactLog_projectId_month_key" ON "ImpactLog"("projectId", "month");

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_askerId_fkey" FOREIGN KEY ("askerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_claimerId_fkey" FOREIGN KEY ("claimerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionMessage" ADD CONSTRAINT "QuestionMessage_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionMessage" ADD CONSTRAINT "QuestionMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "QuestionMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionEvent" ADD CONSTRAINT "QuestionEvent_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionEvent" ADD CONSTRAINT "QuestionEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_publisherId_fkey" FOREIGN KEY ("publisherId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiReview" ADD CONSTRAINT "AiReview_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiReview" ADD CONSTRAINT "AiReview_relatedProjectId_fkey" FOREIGN KEY ("relatedProjectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanStep" ADD CONSTRAINT "PlanStep_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanStep" ADD CONSTRAINT "PlanStep_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMessage" ADD CONSTRAINT "ProjectMessage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMessage" ADD CONSTRAINT "ProjectMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectEvent" ADD CONSTRAINT "ProjectEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectEvent" ADD CONSTRAINT "ProjectEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImpactLog" ADD CONSTRAINT "ImpactLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
