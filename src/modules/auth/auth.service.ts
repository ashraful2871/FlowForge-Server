import { config } from "../../config";
import type { OrgRole, Prisma } from "../../generated/prisma/client";
import { writeAudit } from "../../lib/audit";
import { prisma } from "../../lib/db";
import { AppError, conflictError } from "../../lib/errors";
import { DUMMY_HASH, hashPassword, verifyPassword } from "../../lib/password";
import { isUniqueViolation } from "../../lib/prismaErrors";
import { generateToken, hashToken } from "../../lib/token";
import type { LoginInput, RegisterInput } from "./auth.schema";

const DAY_MS = 24 * 60 * 60 * 1000;
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

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

const invalidCredentialsError = (): AppError => {
  return new AppError(
    401,
    "INVALID_CREDENTIALS",
    "Email or password is incorrect",
  );
};

export const login = async (input: LoginInput, userAgent?: string) => {
  const user = await prisma.user.findUnique({
    where: {
      email: input.email,
    },
  });

  if (!user) {
    await verifyPassword(DUMMY_HASH, input.password);
    throw invalidCredentialsError();
  }

  const valid = await verifyPassword(user.passwordHash, input.password);

  if (!valid) {
    throw invalidCredentialsError();
  }

  return prisma.$transaction(async (tx) => {
    const token = await createSession(tx, user.id, userAgent);
    await writeAudit(tx, {
      organizationId: null,
      actorId: user.id,
      action: "LOGIN",
      targetedType: "User",
      targetedId: user.id,
    });
    return { user: toPublicUser(user), token };
  });
};

export const logout = async (sessionId: string): Promise<void> => {
  await prisma.session.updateMany({
    where: {
      id: sessionId,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
};

export const logoutAll = async (userId: string): Promise<void> => {
  await prisma.session.updateMany({
    where: {
      userId: userId,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
};

export type MyMembership = {
  organizationId: string;
  name: string;
  slug: string;
  role: OrgRole;
};

export const isMyMembership = async (
  userId: string,
): Promise<MyMembership[]> => {
  const memberships = await prisma.membership.findMany({
    where: {
      userId,
      status: "ACTIVE",
    },
    include: {
      organization: {
        select: {
          name: true,
          slug: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });
  return memberships.map((membership) => ({
    organizationId: membership.organizationId,
    name: membership.organization.name,
    slug: membership.organization.slug,
    role: membership.role,
  }));
};

const requestPasswordReset = async (email: string): Promise<string | null> => {
  const user = await prisma.user.findUnique({
    where: {
      email,
    },
  });
  if (!user) {
    return null;
  }

  const token = generateToken();

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    },
  });
  return token;
};

const invalidTokenError = (): AppError =>
  new AppError(
    400,
    "INVALID_TOKEN",
    "This reset link is invalid or has expired",
  );

const confirmPasswordReset = async (
  token: string,
  newPassword: string,
): Promise<void> => {
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });

  if (!record || record.usedAt !== null || record.expiresAt <= new Date()) {
    throw invalidTokenError();
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.$transaction(async (tx) => {
    const claimed = await tx.passwordResetToken.updateMany({
      where: {
        id: record.id,
        usedAt: null,
      },
      data: {
        usedAt: new Date(),
      },
    });
    if (claimed.count === 0) {
      throw invalidTokenError();
    }
    await tx.user.update({
      where: {
        id: record.userId,
      },
      data: {
        passwordHash,
      },
    });
    await tx.session.updateMany({
      where: {
        userId: record.userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  });
};

export const AuthServices = {
  register,
  login,
  logout,
  logoutAll,
  isMyMembership,
  requestPasswordReset,
  confirmPasswordReset,
};
