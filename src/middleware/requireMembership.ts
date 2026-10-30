import type { NextFunction, Request, Response } from "express";
import { getAuth } from "./requireSession";
import { parseIdParam } from "../lib/validation";
import { prisma } from "../lib/db";
import { notFoundError } from "../lib/errors";
import type { Membership } from "../generated/prisma/client";

export const requireMembership = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  const { user } = getAuth(req);
  const organizationId = parseIdParam(req.params.orgId);
  const membership = await prisma.membership.findUnique({
    where: {
      organizationId_userId: {
        organizationId,
        userId: user.id,
      },
    },
  });
  if (!membership || membership.status !== "ACTIVE") {
    throw notFoundError("Organization not found");
  }

  req.membership = membership;
  next();
};

export const getMembership = (req: Request): Membership => {
  if (!req.membership) {
    throw notFoundError("Organization not found");
  }
  return req.membership;
};
