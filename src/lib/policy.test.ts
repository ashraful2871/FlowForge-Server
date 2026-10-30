import { describe, expect, it } from "vitest";
import type { OrgRole } from "../generated/prisma/client";
import { type Action, can, canManageMember } from "./policy";

// PRD থেকে হাতে লেখা। PERMISSIONS থেকে বানাবে না: তাহলে code-এর ভুল test-এও চলে আসত।
// ক্রম: OWNER, ADMIN, MEMBER, VIEWER
const MATRIX: Record<Action, [boolean, boolean, boolean, boolean]> = {
  "org:update": [true, true, false, false],
  "org:delete": [true, false, false, false],
  "org:transferOwnership": [true, false, false, false],
  "member:invite": [true, true, false, false],
  "member:changeRole": [true, true, false, false],
  "member:remove": [true, true, false, false],
  "project:manage": [true, true, false, false],
  "task:write": [true, true, true, false],
  "comment:create": [true, true, true, false],
  "project:read": [true, true, true, true],
  "simulation:run": [true, true, true, true],
  "ai:explain": [true, true, true, false],
  "ai:apply": [true, true, true, false],
  "billing:manage": [true, false, false, false],
};

const ROLES: OrgRole[] = ["OWNER", "ADMIN", "MEMBER", "VIEWER"];

// প্রতিটা ঘর একটা আলাদা test: [action, role, expected]
const CASES = Object.entries(MATRIX).flatMap(([action, row]) =>
  ROLES.map((role, i) => [action as Action, role, row[i]] as const),
);

describe("can()", () => {
  it("covers all 56 cells", () => {
    expect(CASES).toHaveLength(56);
  });

  it.each(CASES)("%s as %s → %s", (action, role, expected) => {
    expect(can(role, action)).toBe(expected);
  });
});

describe("canManageMember()", () => {
  it("OWNER can manage an ADMIN", () => {
    expect(canManageMember("OWNER", "ADMIN")).toBe(true);
  });

  it("ADMIN can manage a MEMBER", () => {
    expect(canManageMember("ADMIN", "MEMBER")).toBe(true);
  });

  it("ADMIN cannot touch an OWNER", () => {
    expect(canManageMember("ADMIN", "OWNER")).toBe(false);
  });
});
