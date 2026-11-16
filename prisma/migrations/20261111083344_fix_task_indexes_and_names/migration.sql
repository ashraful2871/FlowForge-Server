/*
  Warnings:

  - You are about to drop the column `taskCount` on the `Project` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Task_organizationId_assigneeId_key";

-- DropIndex
DROP INDEX "Task_organizationId_projectId_status_key";

-- AlterTable
ALTER TABLE "Comment" ALTER COLUMN "createdAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Project" DROP COLUMN "taskCount",
ADD COLUMN     "taskCounter" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Task_organizationId_projectId_status_idx" ON "Task"("organizationId", "projectId", "status");

-- CreateIndex
CREATE INDEX "Task_organizationId_assigneeId_idx" ON "Task"("organizationId", "assigneeId");
