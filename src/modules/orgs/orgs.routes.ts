import { Router } from "express";
import { requireSession } from "../../middleware/requireSession";
import { OrgController } from "./orgs.controller";
import { requireMembership } from "../../middleware/requireMembership";

export const createOrgRouter = (): Router => {
  const router = Router();

  router.use(requireSession);

  router.post("/", OrgController.createOrgHandler);
  router.get("/", OrgController.listOrgsHandler);

  const orgRoute = Router({ mergeParams: true });
  orgRoute.use(requireMembership);

  orgRoute.get("/", OrgController.getOrgController);
  router.use("/:orgId", orgRoute);

  return router;
};
