import type { Request, Response } from "express";
import { getAuth } from "../../middleware/requireSession";
import {
  ChangeRoleBody,
  CreateOrgBody,
  TransferOwnershipBody,
  UpdateOrgBody,
} from "./orgs.schema";
import { OrgServices } from "./orgs.service";
import { getMembership } from "../../middleware/requireMembership";

const createOrgHandler = async (req: Request, res: Response): Promise<void> => {
  const { user } = getAuth(req);
  const input = CreateOrgBody.parse(req.body);
  const org = await OrgServices.createOrg(user.id, input);
  res.status(201).json(org);
};

const listOrgsHandler = async (req: Request, res: Response): Promise<void> => {
  const { user } = getAuth(req);
  const data = await OrgServices.listMyOrg(user.id);
  res.json({ data });
};

const getOrgController = async (req: Request, res: Response): Promise<void> => {
  const org = await OrgServices.getOrg(getMembership(req));
  res.json(org);
};

const updateOrgHandler = async (req: Request, res: Response): Promise<void> => {
  const input = UpdateOrgBody.parse(req.body);
  const org = await OrgServices.updateOrg(getMembership(req), input);
  res.json(org);
};

const deleteOrgHandler = async (req: Request, res: Response): Promise<void> => {
  await OrgServices.deleteOrg(getMembership(req));
  res.status(204).json({ message: "Organization deleted successfully" });
};

const listMembersHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const data = await OrgServices.listMembers(getMembership(req));
  res.json({ data });
};

const changeRoleHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { role } = ChangeRoleBody.parse(req.body);

  const member = await OrgServices.changeRole(
    getMembership(req),
    req.params.userId,
    role,
  );
  res.json(member);
};

const removeMemberHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  await OrgServices.removeMember(getMembership(req), req.params.userId);
  res.status(204).json({ message: "Member remove successfully" }).end();
};

const transferOwnershipHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { userId } = TransferOwnershipBody.parse(req.body);
  const result = await OrgServices.transferOwnership(
    getMembership(req),
    userId,
  );

  res.json({ message: "organization owner transfer successfully", result });
};

export const OrgController = {
  createOrgHandler,
  listOrgsHandler,
  getOrgController,
  updateOrgHandler,
  deleteOrgHandler,
  listMembersHandler,
  changeRoleHandler,
  removeMemberHandler,
  transferOwnershipHandler,
};
