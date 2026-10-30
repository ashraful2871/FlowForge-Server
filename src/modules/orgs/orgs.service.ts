import { OrgRole } from "../../generated/prisma/enums";
import { prisma } from "../../lib/db";
import { conflictError } from "../../lib/errors";
import { isUniqueViolation } from "../../lib/prismaErrors";
import type { CreateOrgInput } from "./orgs.schema";

export type OrgSummary = {
  id: string;
  name: string;
  slug: string;
  role: OrgRole;
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

export const OrgServices = {
  createOrg,
  listMyOrg,
};
