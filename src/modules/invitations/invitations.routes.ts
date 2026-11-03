import { Router } from "express";
import { InvitationController } from "./invitations.controller";
import { requireSession } from "../../middleware/requireSession";

export const createOrgInvitationsRouter = (): Router => {
  const router = Router();

  router.post("/", InvitationController.createInvitationHandler);
  router.get("/", InvitationController.listInvitationsHandler);
  router.delete("/:id", InvitationController.revokeInvitationHandler);

  return router;
};

export const createInvitationsRouter = (): Router => {
  const router = Router();
  router.post(
    "/accept",
    requireSession,
    InvitationController.acceptInvitationHandler,
  );
  return router;
};
