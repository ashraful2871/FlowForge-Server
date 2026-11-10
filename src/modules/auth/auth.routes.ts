import { Router } from "express";
import { AuthController } from "./auth.controller";
import {
  emailLimiter,
  HOUR,
  ipLimiter,
  MINUTE,
} from "../../middleware/rateLimit";
import { requireSession } from "../../middleware/requireSession";

export const createAuthRouter = (): Router => {
  const router = Router();
  const perIp = ipLimiter();

  router.post(
    "/register",
    perIp,
    emailLimiter("register", HOUR, 5),
    AuthController.registerHandler,
  );

  router.post(
    "/login",
    perIp,
    emailLimiter("login", 15 * MINUTE, 10, true),
    AuthController.loginHandler,
  );

  router.post("/logout", requireSession, AuthController.logoutHandler);
  router.post("/logout-all", requireSession, AuthController.logoutAllHandler);
  router.post(
    "/password-reset/request",
    perIp,
    emailLimiter("reset", HOUR, 3),
    AuthController.passwordResetRequestHandler,
  );

  router.post(
    "/password-reset/confirm",
    perIp,
    AuthController.passwordResetConfirmHandler,
  );

  return router;
};
