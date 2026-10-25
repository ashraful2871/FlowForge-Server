import type { Request, Response } from "express";
import { LoginBody, RegisterBody } from "./auth.schema";

import { clearSessionCookie, setSessionCookie } from "../../lib/sessionCookie";
import { getAuth } from "../../middleware/requireSession";
import { AuthServices } from "./auth.service";

export const registerHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const input = RegisterBody.parse(req.body);
  const { user, token } = await AuthServices.register(
    input,
    req.get("user-agent"),
  );

  setSessionCookie(res, token);
  res.status(201).json({ user });
};

export const loginHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const input = LoginBody.parse(req.body);
  const { user, token } = await AuthServices.login(
    input,
    req.get("user-agent"),
  );
  setSessionCookie(res, token);
  res.json({ user });
};

export const logoutHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { sessionId } = getAuth(req);
  await AuthServices.logout(sessionId);
  clearSessionCookie(res);
  res.status(204).end();
};

export const logoutAllHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { user } = getAuth(req);
  await AuthServices.logoutAll(user.id);
  clearSessionCookie(res);
  res.status(204).end();
};
export const meHandler = async (req: Request, res: Response): Promise<void> => {
  const { user } = getAuth(req);
  const memberships = await AuthServices.isMyMembership(user.id);

  res.json({ user, memberships });
};
export const AuthController = {
  registerHandler,
  loginHandler,
  meHandler,
  logoutHandler,
  logoutAllHandler,
};
