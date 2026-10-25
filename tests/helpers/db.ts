import { prisma } from "../../src/lib/db";

// প্রতিটা test-এর আগে সব table খালি করে, যাতে এক test আরেকটার data না দেখে
export async function resetDb(): Promise<void> {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE "AuditLog", "PasswordResetToken", "Invitation", "Membership", "Session", "Organization", "User" RESTART IDENTITY CASCADE`,
  );
}
