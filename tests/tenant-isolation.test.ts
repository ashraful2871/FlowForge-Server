import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/db";
import { resetDb } from "./helpers/db";
import { seedTwoOrgs } from "./helpers/seed";

type Seed = Awaited<ReturnType<typeof seedTwoOrgs>>;

type Case = {
  name: string;
  method: "get" | "post" | "patch" | "delete";
  path: (s: Seed) => string;
  body?: (s: Seed) => object;
};

// A-র agent দিয়ে প্রতিটা request; প্রতিটার উত্তর 404 হতে হবে
// R2 থেকে প্রতিটা নতুন endpoint এই list-এ একটা row পাবে
const CASES: Case[] = [
  // ── ধরন ১: সরাসরি org B-র path ──
  {
    name: "read org B",
    method: "get",
    path: (s) => `/api/v1/orgs/${s.orgB.id}`,
  },
  {
    name: "rename org B",
    method: "patch",
    path: (s) => `/api/v1/orgs/${s.orgB.id}`,
    body: () => ({ name: "hacked" }),
  },
  {
    name: "delete org B",
    method: "delete",
    path: (s) => `/api/v1/orgs/${s.orgB.id}`,
  },
  {
    name: "list org B members",
    method: "get",
    path: (s) => `/api/v1/orgs/${s.orgB.id}/members`,
  },
  {
    name: "change a role in org B",
    method: "patch",
    path: (s) => `/api/v1/orgs/${s.orgB.id}/members/${s.bMemberId}`,
    body: () => ({ role: "VIEWER" }),
  },
  {
    name: "remove a member of org B",
    method: "delete",
    path: (s) => `/api/v1/orgs/${s.orgB.id}/members/${s.bMemberId}`,
  },
  {
    name: "transfer org B",
    method: "post",
    path: (s) => `/api/v1/orgs/${s.orgB.id}/transfer-ownership`,
    body: (s) => ({ userId: s.bMemberId }),
  },
  {
    name: "invite into org B",
    method: "post",
    path: (s) => `/api/v1/orgs/${s.orgB.id}/invitations`,
    body: () => ({ email: "x@test.dev", role: "MEMBER" }),
  },
  {
    name: "list org B invitations",
    method: "get",
    path: (s) => `/api/v1/orgs/${s.orgB.id}/invitations`,
  },
  {
    name: "revoke org B invitation",
    method: "delete",
    path: (s) => `/api/v1/orgs/${s.orgB.id}/invitations/${s.bInviteId}`,
  },

  // ── ধরন ২: নিজের org A-র path, ভেতরে org B-র id ──
  // requireMembership পার হয়; আটকায় শুধু যদি service প্রতিটা query-তে organizationId দেয়
  {
    name: "revoke org B invitation through org A's path",
    method: "delete",
    path: (s) => `/api/v1/orgs/${s.orgA.id}/invitations/${s.bInviteId}`,
  },
  {
    name: "change B member's role through org A's path",
    method: "patch",
    path: (s) => `/api/v1/orgs/${s.orgA.id}/members/${s.bMemberId}`,
    body: () => ({ role: "VIEWER" }),
  },
  {
    name: "remove B member through org A's path",
    method: "delete",
    path: (s) => `/api/v1/orgs/${s.orgA.id}/members/${s.bMemberId}`,
  },
  {
    name: "transfer org A to a B member",
    method: "post",
    path: (s) => `/api/v1/orgs/${s.orgA.id}/transfer-ownership`,
    body: (s) => ({ userId: s.bMemberId }),
  },
];

let seed: Seed;

beforeEach(async () => {
  await resetDb();
  seed = await seedTwoOrgs();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("an Org A owner gets 404 for everything in Org B", () => {
  it.each(CASES)("$name", async ({ method, path, body }) => {
    const res = await seed.agentA[method](path(seed)).send(body?.(seed));

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("changes nothing in Org B", async () => {
    for (const { method, path, body } of CASES) {
      await seed.agentA[method](path(seed)).send(body?.(seed));
    }

    const orgB = await prisma.organization.findUnique({
      where: { id: seed.orgB.id },
    });
    const member = await prisma.membership.findFirstOrThrow({
      where: { organizationId: seed.orgB.id, userId: seed.bMemberId },
    });
    const owner = await prisma.membership.findFirstOrThrow({
      where: { organizationId: seed.orgB.id, userId: seed.ownerBId },
    });
    const invite = await prisma.invitation.findUniqueOrThrow({
      where: { id: seed.bInviteId },
    });

    expect(orgB?.name).toBe(seed.orgB.name);
    expect(member).toMatchObject({ role: "MEMBER", status: "ACTIVE" });
    expect(owner.role).toBe("OWNER");
    expect(invite.revokedAt).toBeNull();
  });

  it("does not show Org B in A's lists", async () => {
    const orgs = await seed.agentA.get("/api/v1/orgs");
    const me = await seed.agentA.get("/api/v1/me");

    const orgIds = (orgs.body.data as { id: string }[]).map((o) => o.id);
    const memberOrgIds = (
      me.body.memberships as { organizationId: string }[]
    ).map((m) => m.organizationId);

    expect(orgIds).not.toContain(seed.orgB.id);
    expect(memberOrgIds).not.toContain(seed.orgB.id);
  });
});
