import type { Request, Response } from "express";
import {
  AcceptInvitationBody,
  CreateInvitationBody,
} from "./invitations.schema";
import { InvitationServices } from "./invitations.service";
import { getMembership } from "../../middleware/requireMembership";
import { config } from "../../config";
import { getAuth } from "../../middleware/requireSession";

const createInvitationHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const input = CreateInvitationBody.parse(req.body);

  const { invitation, token } = await InvitationServices.createInvitation(
    getMembership(req),
    input,
  );
  if (config.NODE_ENV === "development") {
    const inviteUrl = `${config.APP_URL}/invite?token=${token}`;
    req.log.info({ inviteUrl }, "Invitation link (development only)");
  }

  res.status(201).json(invitation);
};

const listInvitationsHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const data = await InvitationServices.listInvitations(getMembership(req));
  res.json({ data });
};

const revokeInvitationHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  await InvitationServices.revokeInvitation(getMembership(req), req.params.id);

  res.status(204).end();
};

const acceptInvitationHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { user } = getAuth(req);
  const { token } = AcceptInvitationBody.parse(req.body);
  const result = await InvitationServices.acceptInvitation(user, token);

  res.json(result);
};

export const InvitationController = {
  createInvitationHandler,
  listInvitationsHandler,
  revokeInvitationHandler,
  acceptInvitationHandler,
};
