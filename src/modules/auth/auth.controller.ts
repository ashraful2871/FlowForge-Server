import type { Request, Response } from "express";
import { RegisterBody } from "./auth.schema";
import * as authService from "./auth.service";
import { setSessionCookie } from "../../lib/sessionCookie";
import { getAuth } from "../../middleware/requireSession";

export const registerHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const input = RegisterBody.parse(req.body);
  const { user, token } = await authService.register(
    input,
    req.get("user-agent"),
  );

  setSessionCookie(res, token);
  res.status(201).json({ user });
};

export const meHandler = (req: Request, res: Response): void => {
  const { user } = getAuth(req);
  res.json({ user });
};
