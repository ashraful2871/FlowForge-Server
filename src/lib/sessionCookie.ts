import type { CookieOptions, Response } from "express";
import { config } from "../config";

export const SESSION_COOKIE = "ff_session";

const DAY_MS = 24 * 60 * 60 * 1000;

const baseOptions: CookieOptions = {
  httpOnly: true,
  secure: config.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
};

export const setSessionCookie = (res: Response, token: string): void => {
  res.cookie(SESSION_COOKIE, token, {
    ...baseOptions,
    maxAge: config.SESSION_TTL_DAYS * DAY_MS,
  });
};

export const clearSessionCookie = (res: Response): void => {
  res.clearCookie(SESSION_COOKIE, baseOptions);
};
