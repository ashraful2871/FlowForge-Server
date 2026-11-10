import type { Invitation, Membership } from "../../generated/prisma/client";
import type { OrgRole } from "../../generated/prisma/enums";
import { prisma } from "../../lib/db";
import { AppError, conflictError, notFoundError } from "../../lib/errors";
import { assertCan } from "../../lib/policy";
import { generateToken, hashToken } from "../../lib/token";
import { parseIdParam } from "../../lib/validation";
import type { CreateInvitationInput } from "./invitations.schema";

const INVITE_TIL_MS = 7 * 24 * 60 * 60;

export type InvitationSummary = {
  id: string;
  email: string;
  role: OrgRole;
  expiresAt: Date;
};

const invitationSummary = (invitation: Invitation): InvitationSummary => ({
  id: invitation.id,
  email: invitation.email,
  role: invitation.role,
  expiresAt: invitation.expiresAt,
});

const toInvitationSummary = (invitation: Invitation): InvitationSummary => ({
  id: invitation.id,
  email: invitation.email,
  role: invitation.role,
  expiresAt: invitation.expiresAt,
});

const inviteGoneError = (): AppError => {
  return new AppError(
    410,
    "INVITE_EXPIRED_OR_USED",
    "This invitation is no longer valid",
  );
};

//createInvitation
const createInvitation = async (
  actor: Membership,
  input: CreateInvitationInput,
): Promise<{ invitation: InvitationSummary; token: string }> => {
  assertCan(actor.role, "member:invite");

  const organizationId = actor.organizationId;

  const existingMember = await prisma.membership.findFirst({
    where: {
      organizationId,
      status: "ACTIVE",
      user: {
        email: input.email,
      },
    },
  });

  if (existingMember) {
    throw conflictError("ALREADY_MEMBER", "This person is already a member");
  }

  const pending = await prisma.invitation.findFirst({
    where: {
      organizationId,
      email: input.email,
      acceptedAt: null,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
  });

  if (pending) {
    throw conflictError(
      "INVITE_PENDING",
      "An invitation is already pending for this email",
    );
  }

  const token = generateToken();

  const invitation = await prisma.invitation.create({
    data: {
      organizationId,
      email: input.email,
      role: input.role,
      tokenHash: hashToken(token),
      invitedById: actor.userId,
      expiresAt: new Date(Date.now() + INVITE_TIL_MS),
    },
  });

  return { invitation: invitationSummary(invitation), token };
};

const listInvitations = async (
  actor: Membership,
): Promise<InvitationSummary[]> => {
  assertCan(actor.role, "member:invite");

  const invitations = await prisma.invitation.findMany({
    where: {
      organizationId: actor.organizationId,
      acceptedAt: null,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  return invitations.map(toInvitationSummary);
};

const revokeInvitation = async (
  actor: Membership,
  rawId: unknown,
): Promise<void> => {
  assertCan(actor.role, "member:invite");
  const id = parseIdParam(rawId);

  const result = await prisma.invitation.updateMany({
    where: {
      id,
      organizationId: actor.organizationId,
      acceptedAt: null,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });

  if (result.count === 0) {
    throw notFoundError("Invitation not found");
  }
};

const acceptInvitation = async (
  user: { id: string; email: string },
  token: string,
): Promise<{ organizationId: string; role: OrgRole }> => {
  const invitation = await prisma.invitation.findUnique({
    where: {
      tokenHash: hashToken(token),
    },
  });

  if (
    !invitation ||
    invitation.acceptedAt !== null ||
    invitation.revokedAt !== null ||
    invitation.expiresAt <= new Date()
  ) {
    throw inviteGoneError();
  }

  if (invitation.email !== user.email) {
    throw new AppError(
      403,
      "EMAIL_MISMATCH",
      "This invitation was sent to a different email address",
    );
  }

  return prisma.$transaction(async (tx) => {
    const claimed = await tx.invitation.updateMany({
      where: {
        id: invitation.id,
        acceptedAt: null,
        revokedAt: null,
      },
      data: {
        acceptedAt: new Date(),
      },
    });
    if (claimed.count === 0) {
      throw inviteGoneError();
    }
    const key = { organizationId: invitation.organizationId, userId: user.id };

    const existing = await tx.membership.findUnique({
      where: {
        organizationId_userId: key,
      },
    });
    if (existing?.status === "ACTIVE") {
      throw conflictError("ALREADY_MEMBER", "You are already a member");
    }
    await tx.membership.upsert({
      where: {
        organizationId_userId: key,
      },
      create: {
        ...key,
        role: invitation.role,
      },
      update: {
        status: "ACTIVE",
        role: invitation.role,
      },
    });
    return { organizationId: invitation.organizationId, role: invitation.role };
  });
};

export const InvitationServices = {
  createInvitation,
  listInvitations,
  revokeInvitation,
  acceptInvitation,
};
