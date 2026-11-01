import type { Membership, Prisma } from "../../generated/prisma/client";
import { OrgRole } from "../../generated/prisma/enums";
import { writeAudit } from "../../lib/audit";
import { prisma } from "../../lib/db";
import {
  AppError,
  conflictError,
  forbiddenError,
  notFoundError,
} from "../../lib/errors";
import { assertCan, canManageMember } from "../../lib/policy";
import { isUniqueViolation } from "../../lib/prismaErrors";
import { parseIdParam } from "../../lib/validation";
import type { CreateOrgInput, UpdateOrgInput } from "./orgs.schema";

export type OrgSummary = {
  id: string;
  name: string;
  slug: string;
  role: OrgRole;
};

export type MemberSummary = {
  userId: string;
  name: string;
  email: string;
  role: OrgRole;
  joinedAt: Date;
};

export const createOrg = async (
  userId: string,
  input: CreateOrgInput,
): Promise<OrgSummary> => {
  try {
    return await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: { name: input.name, slug: input.slug },
      });

      await tx.membership.create({
        data: { organizationId: org.id, userId, role: "OWNER" },
      });

      return { id: org.id, name: org.name, slug: org.slug, role: "OWNER" };
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw conflictError("SLUG_TAKEN", "This slug is already taken");
    }

    throw err;
  }
};

const listMyOrg = async (userid: string): Promise<OrgSummary[]> => {
  const memberships = await prisma.membership.findMany({
    where: {
      userId: userid,
      status: "ACTIVE",
    },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return memberships.map((memberShip) => ({
    id: memberShip.organization.id,
    name: memberShip.organization.name,
    slug: memberShip.organization.slug,
    role: memberShip.role,
  }));
};

const getOrg = async (actor: Membership): Promise<OrgSummary> => {
  const org = await prisma.organization.findUniqueOrThrow({
    where: {
      id: actor.organizationId,
    },
  });

  return { id: org.id, name: org.name, slug: org.slug, role: actor.role };
};

const updateOrg = async (
  actor: Membership,
  input: UpdateOrgInput,
): Promise<OrgSummary> => {
  assertCan(actor.role, "org:update");
  const org = await prisma.organization.update({
    where: {
      id: actor.organizationId,
    },
    data: {
      name: input.name,
    },
  });
  return { id: org.id, name: org.name, slug: org.slug, role: actor.role };
};

const deleteOrg = async (actor: Membership) => {
  assertCan(actor.role, "org:delete");

  await prisma.organization.delete({
    where: {
      id: actor.organizationId,
    },
  });
};

const listMembers = async (actor: Membership): Promise<MemberSummary[]> => {
  const memberships = await prisma.membership.findMany({
    where: {
      organizationId: actor.organizationId,
      status: "ACTIVE",
    },
    include: {
      user: {
        select: {
          name: true,
          email: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  return memberships.map((membership) => ({
    userId: membership.userId,
    name: membership.user.name,
    email: membership.user.email,
    role: membership.role,
    joinedAt: membership.createdAt,
  }));
};

// helper
const findActiveMember = async (
  organizationId: string,
  rawUserId: unknown,
): Promise<Membership> => {
  const userId = parseIdParam(rawUserId);
  const memberShip = await prisma.membership.findUnique({
    where: {
      organizationId_userId: {
        organizationId,
        userId,
      },
    },
  });
  if (!memberShip || memberShip.status !== "ACTIVE") {
    throw notFoundError("Member not found");
  }
  return memberShip;
};

const assertNotLastOwner = async (
  tx: Prisma.TransactionClient,
  organizationId: string,
): Promise<void> => {
  const owner = await tx.membership.count({
    where: {
      organizationId,
      role: "OWNER",
      status: "ACTIVE",
    },
  });

  if (owner <= 1) {
    throw conflictError(
      "LAST_OWNER",
      "An organization must always have an owner. Transfer ownership first.",
    );
  }
};

const changeRole = async (
  actor: Membership,
  rawUserId: unknown,
  newRole: OrgRole,
): Promise<{ userId: string; role: OrgRole }> => {
  assertCan(actor.role, "member:changeRole");

  const target = await findActiveMember(actor.organizationId, rawUserId);

  if (!canManageMember(actor.role, target.role)) {
    throw forbiddenError("Admins cannot change an owner's role");
  }

  return prisma.$transaction(async (tx) => {
    if (target.role === "OWNER") {
      await assertNotLastOwner(tx, actor.organizationId);
    }

    const update = await tx.membership.update({
      where: {
        id: target.id,
      },
      data: {
        role: newRole,
      },
    });

    await writeAudit(tx, {
      organizationId: actor.organizationId,
      actorId: actor.userId,
      action: "ROLE_CHANGE",
      targetedType: "user",
      targetedId: target.id,
      metaData: {
        from: target.role,
        to: newRole,
      },
    });

    return { userId: update.userId, role: update.role };
  });
};

const removeMember = async (
  actor: Membership,
  rawUserId: unknown,
): Promise<void> => {
  const isSelf = rawUserId === actor.userId;

  let target = actor;
  if (!isSelf) {
    assertCan(actor.role, "member:remove");
    target = await findActiveMember(actor.organizationId, rawUserId);

    if (!canManageMember(actor.role, target.role)) {
      throw forbiddenError("Admins cannot remove an owner");
    }
  }

  await prisma.$transaction(async (tx) => {
    if (target.role === "OWNER") {
      await assertNotLastOwner(tx, actor.organizationId);
    }
    await tx.membership.update({
      where: {
        id: target.id,
      },
      data: {
        status: "REMOVED",
      },
    });

    await writeAudit(tx, {
      organizationId: actor.organizationId,
      actorId: actor.userId,
      action: "MEMBER_REMOVE",
      targetedType: "User",
      targetedId: target.userId,
      metaData: { left: isSelf },
    });
  });
};

const transferOwnership = async (
  actor: Membership,
  rawUserId: unknown,
): Promise<{ userId: string; role: OrgRole }> => {
  assertCan(actor.role, "org:transferOwnership");
  if (rawUserId === actor.userId) {
    throw new AppError(422, "VALIDATION_ERROR", "You already own it", {
      userId: "Choose another number",
    });
  }

  const target = await findActiveMember(actor.organizationId, rawUserId);

  return prisma.$transaction(async (tx) => {
    await tx.membership.update({
      where: {
        id: target.id,
      },
      data: {
        role: "OWNER",
      },
    });

    await tx.membership.update({
      where: {
        id: actor.id,
      },
      data: {
        role: "ADMIN",
      },
    });

    await writeAudit(tx, {
      organizationId: actor.organizationId,
      actorId: actor.userId,
      action: "OWNERSHIP_TRANSFERRED",
      targetedId: target.userId,
      targetedType: "User",
      metaData: {
        from: actor.userId,
        to: target.userId,
      },
    });
    return { userId: target.userId, role: "OWNER" };
  });
};

export const OrgServices = {
  createOrg,
  listMyOrg,
  getOrg,
  updateOrg,
  listMembers,
  deleteOrg,
  changeRole,
  removeMember,
  transferOwnership,
};
