/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import type { NextFunction, Request, Response } from "express";
import { clearSessionCookie, SESSION_COOKIE } from "../lib/sessionCookie";
import { unauthenticatedError } from "../lib/errors";
import { prisma } from "../lib/db";
import { hashToken } from "../lib/token";
import { config } from "../config";

const DAY_MS = 24 * 60 * 60 * 1000;
const LAST_SEEN_UPDATE_MS = 5 * 60 * 1000;

export const requireSession = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const token: unknown = req.cookies[SESSION_COOKIE];
  if (typeof token !== "string" || token.length === 0) {
    throw unauthenticatedError();
  }
  const session = await prisma.session.findUnique({
    where: {
      tokenHash: hashToken(token),
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  const now = Date.now();
  const idleLimit = config.SESSION_IDLE_DAYS * DAY_MS;

  if (
    !session ||
    session.revokedAt != null ||
    session.expiresAt.getTime() <= now ||
    session.expiresAt.getTime() + idleLimit <= now
  ) {
    clearSessionCookie(res);
    throw unauthenticatedError();
  }
  if (now - session.lastSeenAt.getTime() > LAST_SEEN_UPDATE_MS) {
    await prisma.session.update({
      where: {
        id: session.id,
      },
      data: { lastSeen: new Date(now) },
    });
  }

  req.user = session.user;
  req.sessionId = session.id;
  next();
};

export const getAuth = (
  req: Request,
): {
  user: NonNullable<Request["user"]>;
  sessionId: string;
} => {
  if (!req.user || !req.sessionId) {
    throw unauthenticatedError();
  }

  return { user: req.user, sessionId: req.sessionId };
};
