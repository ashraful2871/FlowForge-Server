import type { Request, Response } from "express";
import {
  CreateProjectBody,
  ListProjectQuery,
  UpdateProjectBody,
} from "./projects.schema";
import { ProjectServices } from "./projects.service";
import { getMembership } from "../../middleware/requireMembership";

const createProjectHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const input = CreateProjectBody.parse(req.body);
  const project = await ProjectServices.CreateProject(
    getMembership(req),
    input,
  );

  res.status(201).json(project);
};

const listProjectHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { status } = ListProjectQuery.parse(req.query);
  const data = await ProjectServices.listProjects(getMembership(req), status);
  res.json({ data });
};

const getProjectHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const project = await ProjectServices.getProject(
    getMembership(req),
    req.params.projectId,
  );

  res.json(project);
};

const updateProjectHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const input = UpdateProjectBody.parse(req.body);
  const project = await ProjectServices.updateProject(
    getMembership(req),
    req.params.projectId,
    input,
  );

  res.json(project);
};

const archivedProjectHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const project = await ProjectServices.setArchived(
    getMembership(req),
    req.params.projectId,
    true,
  );
  res.json(project);
};

const unArchivedProjectHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const project = await ProjectServices.setArchived(
    getMembership(req),
    req.params.projectId,
    false,
  );

  res.json(project);
};

const deleteProjectHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  await ProjectServices.deleteProject(getMembership(req), req.params.projectId);

  res.status(204).end();
};

export const ProjectController = {
  createProjectHandler,
  listProjectHandler,
  getProjectHandler,
  updateProjectHandler,
  archivedProjectHandler,
  unArchivedProjectHandler,
  deleteProjectHandler,
};
