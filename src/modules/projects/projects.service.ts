import type {
  Membership,
  Project,
  ProjectStatus,
} from "../../generated/prisma/client";
import { prisma } from "../../lib/db";
import { conflictError, notFoundError } from "../../lib/errors";
import { assertCan } from "../../lib/policy";
import { isUniqueViolation } from "../../lib/prismaErrors";
import { parseIdParam } from "../../lib/validation";
import type { CreateProjectInput, UpdateProjectInput } from "./projects.schema";

export type ProjectSummary = {
  id: string;
  name: string;
  key: string;
  description: string | null;
  status: ProjectStatus;
  createdAt: Date;
  updatedAt: Date;
};

const toProjectSummary = (project: Project): ProjectSummary => ({
  id: project.id,
  name: project.name,
  key: project.key,
  description: project.description,
  status: project.status,
  createdAt: project.createdAt,
  updatedAt: project.updatedAt,
});

const findProject = async (
  organizationId: string,
  rawId: unknown,
): Promise<Project> => {
  const id = parseIdParam(rawId);
  const project = await prisma.project.findUnique({
    where: {
      id_organizationId: { id, organizationId },
    },
  });
  if (!project) {
    throw notFoundError("Project not found");
  }
  return project;
};

const CreateProject = async (
  actor: Membership,
  input: CreateProjectInput,
): Promise<ProjectSummary> => {
  assertCan(actor.role, "project:manage");
  try {
    const project = await prisma.project.create({
      data: {
        organizationId: actor.organizationId,
        name: input.name,
        key: input.key,
        description: input.description,
        createdById: actor.userId,
      },
    });
    return toProjectSummary(project);
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw conflictError(
        "PROJECT_KEY_TAKEN",
        "Another project in this organization uses this key",
      );
    }
    throw err;
  }
};

const listProjects = async (
  actor: Membership,
  status: ProjectStatus,
): Promise<ProjectSummary[]> => {
  assertCan(actor.role, "project:read");
  const projects = await prisma.project.findMany({
    where: {
      organizationId: actor.organizationId,
      status,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
  return projects.map(toProjectSummary);
};

const getProject = async (
  actor: Membership,
  rawId: unknown,
): Promise<ProjectSummary> => {
  assertCan(actor.role, "project:read");
  return toProjectSummary(await findProject(actor.organizationId, rawId));
};

const projectArchivedError = () =>
  conflictError("PROJECT_ARCHIVED", "Unarchive the project to change it");

const updateProject = async (
  actor: Membership,
  rawId: unknown,
  input: UpdateProjectInput,
): Promise<ProjectSummary> => {
  assertCan(actor.role, "project:manage");
  const project = await findProject(actor.organizationId, rawId);

  if (project.status === "ARCHIVED") {
    throw projectArchivedError();
  }

  const updated = await prisma.project.update({
    where: { id: project.id },
    data: {
      name: input.name,
      description: input.description,
    },
  });
  return toProjectSummary(updated);
};

export const ProjectServices = {
  CreateProject,
  listProjects,
  getProject,
  updateProject,
};
