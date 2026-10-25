import { Router } from "express";
import { registerHandler } from "./auth.controller";

export const createAuthRouter = (): Router => {
  const router = Router();

  router.post("/register", registerHandler);

  return router;
};
