import type { Request } from "express";
import { AppError } from "../lib/errors";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";

export const MINUTE = 60 * 1000;
export const HOUR = 60 * MINUTE;

const rateLimitError = (): AppError => {
  return new AppError(
    429,
    "RATE_LIMITED",
    "Too many attempts. Try again later.",
  );
};

const emailForBody = (req: Request): string | undefined => {
  const body: unknown = req.body;
  if (
    typeof body === "object" &&
    body !== null &&
    "email" in body &&
    typeof body.email === "string"
  ) {
    return body.email.trim().toLocaleLowerCase();
  }

  return undefined;
};

export const ipLimiter = () => {
  return rateLimit({
    windowMs: 15 * MINUTE,
    limit: 30,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, _res, next) => next(rateLimitError()),
  });
};

export const emailLimiter = (
  prefix: string,
  windowMs: number,
  limit: number,
  onlyFailures = false,
) => {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skipSuccessfulRequests: onlyFailures,
    keyGenerator: (req) => {
      const email = emailForBody(req);
      return email ? `${prefix}:${email}` : ipKeyGenerator(req.ip ?? "");
    },
    handler: (_req, _res, next) => next(rateLimitError()),
  });
};
