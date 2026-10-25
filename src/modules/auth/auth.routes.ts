import { Router } from "express";
import { loginHandler, registerHandler } from "./auth.controller";
import {
  emailLimiter,
  HOUR,
  ipLimiter,
  MINUTE,
} from "../../middleware/rateLimit";

export const createAuthRouter = (): Router => {
  const router = Router();
  const perIp = ipLimiter();

  router.post(
    "/register",
    perIp,
    emailLimiter("register", HOUR, 5),
    registerHandler,
  );

  router.post(
    "/login",
    perIp,
    emailLimiter("login", 15 * MINUTE, 10, true),
    loginHandler,
  );

  return router;
};
