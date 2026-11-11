import { Router } from "express";
import { requireSession } from "../../middleware/requireSession";
import { OrgController } from "./orgs.controller";
import { requireMembership } from "../../middleware/requireMembership";
import { createOrgInvitationsRouter } from "../invitations/invitations.routes";
import { createProjectRouter } from "../projects/projects.routes";

export const createOrgRouter = (): Router => {
  const router = Router();

  router.use(requireSession);

  router.post("/", OrgController.createOrgHandler);
  router.get("/", OrgController.listOrgsHandler);

  const orgRoute = Router({ mergeParams: true });
  orgRoute.use(requireMembership);

  orgRoute.get("/", OrgController.getOrgController);
  orgRoute.patch("/", OrgController.updateOrgHandler);
  orgRoute.delete("/", OrgController.deleteOrgHandler);
  orgRoute.get("/members", OrgController.listMembersHandler);
  orgRoute.patch("/members/:userId", OrgController.changeRoleHandler);
  orgRoute.delete("/members/:userId", OrgController.removeMemberHandler);
  orgRoute.post("/transfer-ownership", OrgController.transferOwnershipHandler);
  orgRoute.use("/invitations", createOrgInvitationsRouter());
  orgRoute.use("/projects", createProjectRouter());
  router.use("/:orgId", orgRoute);

  return router;
};
