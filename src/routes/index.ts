import { Router } from "express";
import { createAuthRouter } from "../modules/auth/auth.routes";
import { requireSession } from "../middleware/requireSession";
import { meHandler } from "../modules/auth/auth.controller";
import { createOrgRouter } from "../modules/orgs/orgs.routes";

export const createApiRouter = (): Router => {
  const router = Router();

  router.use("/auth", createAuthRouter());
  router.get("/me", requireSession, meHandler);
  router.use("/orgs", createOrgRouter());

  return router;
};
