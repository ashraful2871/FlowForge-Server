import type { Invitation, Membership } from "../../generated/prisma/client";
import type { OrgRole } from "../../generated/prisma/enums";
import { prisma } from "../../lib/db";
import { AppError, conflictError } from "../../lib/errors";
import { assertCan } from "../../lib/policy";
import type { CreateInvitationInput } from "./invitations.schema";

const INVIT_TIL_MS = 7 * 24 * 60 * 60;

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
};
