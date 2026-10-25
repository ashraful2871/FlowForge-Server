import { config } from "../../config";
import type { Prisma } from "../../generated/prisma/client";
import { prisma } from "../../lib/db";
import { conflictError } from "../../lib/errors";
import { hashPassword } from "../../lib/password";
import { isUniqueViolation } from "../../lib/prismaErrors";
import { generateToken, hashToken } from "../../lib/token";
import type { RegisterInput } from "./auth.schema";

const DAY_MS = 24 * 60 * 60 * 1000;

export type PublicUser = {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
};

export const toPublicUser = (user: PublicUser): PublicUser => {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
  };
};

export const createSession = async (
  tx: Prisma.TransactionClient,
  userId: string,
  userAgent?: string,
): Promise<string> => {
  const token = generateToken();
  await tx.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + config.SESSION_TTL_DAYS * DAY_MS),
      userAgent,
    },
  });
  return token;
};

export const register = async (input: RegisterInput, userAgent?: string) => {
  const passwordHash = await hashPassword(input.password);
  try {
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { name: input.name, email: input.email, passwordHash },
      });

      const token = await createSession(tx, user.id, userAgent);
      return { user: toPublicUser(user), token };
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw conflictError(
        "EMAIL_TAKEN",
        "An account with this email already exists",
      );
    }
    throw err;
  }
};
