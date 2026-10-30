import type { OrgRole } from "../generated/prisma/enums";
import { forbiddenError } from "./errors";

export const ACTIONS = [
  "org:update",
  "org:delete",
  "org:transferOwnership",
  "member:invite",
  "member:changeRole",
  "member:remove",
  "project:manage",
  "task:write",
  "comment:create",
  "project:read",
  "simulation:run",
  "ai:explain",
  "ai:apply",
  "billing:manage",
] as const;

export type Action = (typeof ACTIONS)[number];

const OWNER_ONLY: readonly OrgRole[] = ["OWNER"];
const ADMINS: readonly OrgRole[] = ["OWNER", "ADMIN"];
const WRITERS: readonly OrgRole[] = ["OWNER", "ADMIN", "MEMBER"];
const EVERYONE: readonly OrgRole[] = ["OWNER", "ADMIN", "MEMBER", "VIEWER"];

const PERMISSIONS: Record<Action, readonly OrgRole[]> = {
  "org:update": ADMINS,
  "org:delete": OWNER_ONLY,
  "org:transferOwnership": OWNER_ONLY,
  "member:invite": ADMINS,
  "member:changeRole": ADMINS,
  "member:remove": ADMINS,
  "project:manage": ADMINS,
  "task:write": WRITERS,
  "comment:create": WRITERS,
  "project:read": EVERYONE,
  "simulation:run": EVERYONE,
  "ai:explain": WRITERS,
  "ai:apply": WRITERS,
  "billing:manage": OWNER_ONLY,
};

export const can = (role: OrgRole, action: Action): boolean => {
  return PERMISSIONS[action].includes(role);
};

export const assertCan = (role: OrgRole, action: Action): void => {
  if (!can(role, action)) {
    throw forbiddenError("You do no have permission to do tis");
  }
};

export const canManageMember = (
  actorRole: OrgRole,
  targetRole: OrgRole,
): boolean => {
  if (actorRole === "OWNER") return true;
  if (actorRole === "ADMIN") return targetRole !== "OWNER";

  return false;
};
