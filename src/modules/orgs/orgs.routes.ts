import { Router } from "express";
import { requireSession } from "../../middleware/requireSession";
import { orgController } from "./orgs.controller";

export const createOrgRouter = (): Router => {
  const router = Router();

  router.use(requireSession);

  router.post("/", orgController.createOrgHandler);
  router.get("/", orgController.listOrgsHandler);
  return router;
};
