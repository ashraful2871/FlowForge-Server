import { Router } from "express";
import { createAuthRouter } from "../modules/auth/auth.routes";

export const createApiRouter = (): Router => {
  const router = Router();

  router.use("/auth", createAuthRouter());

  return router;
};
