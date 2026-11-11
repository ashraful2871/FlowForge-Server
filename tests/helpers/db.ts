import { prisma } from "../../src/lib/db";

export async function resetDb(): Promise<void> {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE "Comment", "Task", "Project", "AuditLog", "PasswordResetToken", "Invitation", "Membership", "Session", "Organization", "User" RESTART IDENTITY CASCADE`,
  );
}
