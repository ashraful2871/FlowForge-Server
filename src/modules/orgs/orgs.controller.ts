import type { Request, Response } from "express";
import { getAuth } from "../../middleware/requireSession";
import { CreateOrgBody } from "./orgs.schema";
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

export const OrgController = {
  createOrgHandler,
  listOrgsHandler,
  getOrgController,
};
