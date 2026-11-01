import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { newAgent } from "../../../tests/helpers/agent";
import { resetDb } from "../../../tests/helpers/db";
import { addMember, createOrg, signUp } from "../../../tests/helpers/seed";
import { prisma } from "../../lib/db";
import { randomUUID } from "node:crypto";

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("POST /orgs and GET /orgs", () => {
  it("creates the org and makes the creator OWNER", async () => {
    const { agent, user } = await signUp();
    const res = await agent
      .post("/api/v1/orgs")
      .send({ name: "PixelCraft", slug: "pixelcraft" });

    expect(res.status).toBe(201);
    expect(res.body.role).toBe("OWNER");

    // শুধু response নয়, DB-তেও সত্যিই OWNER membership আছে কিনা
    const membership = await prisma.membership.findFirstOrThrow({
      where: { userId: user.id },
    });
    expect(membership.role).toBe("OWNER");
  });

  it("returns 409 SLUG_TAKEN for a used slug", async () => {
    const { agent } = await signUp();
    await agent.post("/api/v1/orgs").send({ name: "One", slug: "same-slug" });

    const res = await agent
      .post("/api/v1/orgs")
      .send({ name: "Two", slug: "same-slug" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("SLUG_TAKEN");
  });

  it.each(["My Org", "-abc", "a--b"])(
    "returns 422 for slug %j",
    async (slug) => {
      const { agent } = await signUp();
      const res = await agent.post("/api/v1/orgs").send({ name: "Org", slug });

      expect(res.status).toBe(422);
    },
  );

  it("returns 401 when logged out", async () => {
    const res = await newAgent()
      .post("/api/v1/orgs")
      .send({ name: "Org", slug: "org-one" });

    expect(res.status).toBe(401);
  });

  it("lists only my own orgs", async () => {
    const me = await signUp();
    const other = await signUp();
    const mine = await createOrg(me.agent);
    await createOrg(other.agent);

    const res = await me.agent.get("/api/v1/orgs");
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(mine.id);
  });

  it("shows the new org in /me", async () => {
    const { agent } = await signUp();
    const org = await createOrg(agent);

    const res = await agent.get("/api/v1/me");
    expect(res.body.memberships[0].organizationId).toBe(org.id);
  });
});

describe("requireMembership (via GET /orgs/:orgId)", () => {
  it("returns the org and my role to a member", async () => {
    const { agent } = await signUp();
    const org = await createOrg(agent);

    const res = await agent.get(`/api/v1/orgs/${org.id}`);
    expect(res.status).toBe(200);
    expect(res.body.role).toBe("OWNER");
  });

  it("returns 404 for someone else's org", async () => {
    const owner = await signUp();
    const stranger = await signUp();
    const org = await createOrg(owner.agent);

    const res = await stranger.agent.get(`/api/v1/orgs/${org.id}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("returns 404 for an id that is not a UUID", async () => {
    const { agent } = await signUp();
    const res = await agent.get("/api/v1/orgs/abc");

    expect(res.status).toBe(404);
  });

  it("returns 404 for a UUID that does not exist", async () => {
    const { agent } = await signUp();
    const res = await agent.get(`/api/v1/orgs/${randomUUID()}`);

    expect(res.status).toBe(404);
  });

  it("returns 404 for a removed member", async () => {
    const owner = await signUp();
    const org = await createOrg(owner.agent);
    const member = await addMember(org.id, "MEMBER");
    await prisma.membership.updateMany({
      where: { userId: member.user.id },
      data: { status: "REMOVED" },
    });

    const res = await member.agent.get(`/api/v1/orgs/${org.id}`);
    expect(res.status).toBe(404);
  });

  it("returns 401 when logged out", async () => {
    const res = await newAgent().get(`/api/v1/orgs/${randomUUID()}`);

    expect(res.status).toBe(401);
  });
});

describe("org update, delete and members", () => {
  it("ADMIN can rename the org", async () => {
    const owner = await signUp();
    const org = await createOrg(owner.agent);
    const admin = await addMember(org.id, "ADMIN");

    const res = await admin.agent
      .patch(`/api/v1/orgs/${org.id}`)
      .send({ name: "Renamed" });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Renamed");
  });

  it("MEMBER cannot rename the org", async () => {
    const owner = await signUp();
    const org = await createOrg(owner.agent);
    const member = await addMember(org.id, "MEMBER");

    const res = await member.agent
      .patch(`/api/v1/orgs/${org.id}`)
      .send({ name: "Renamed" });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("ADMIN cannot delete the org", async () => {
    const owner = await signUp();
    const org = await createOrg(owner.agent);
    const admin = await addMember(org.id, "ADMIN");

    const res = await admin.agent.delete(`/api/v1/orgs/${org.id}`);
    expect(res.status).toBe(403);
  });

  it("OWNER deletes the org and everything in it", async () => {
    const owner = await signUp();
    const org = await createOrg(owner.agent);

    const res = await owner.agent.delete(`/api/v1/orgs/${org.id}`);
    expect(res.status).toBe(204);

    const after = await owner.agent.get(`/api/v1/orgs/${org.id}`);
    expect(after.status).toBe(404);
    expect(
      await prisma.membership.count({ where: { organizationId: org.id } }),
    ).toBe(0);
  });

  it("lists members without password hashes", async () => {
    const owner = await signUp();
    const org = await createOrg(owner.agent);
    await addMember(org.id, "MEMBER");

    const res = await owner.agent.get(`/api/v1/orgs/${org.id}/members`);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].passwordHash).toBeUndefined();
  });

  it("ADMIN changes a MEMBER to VIEWER and it is audited", async () => {
    const owner = await signUp();
    const org = await createOrg(owner.agent);
    const admin = await addMember(org.id, "ADMIN");
    const member = await addMember(org.id, "MEMBER");

    const res = await admin.agent
      .patch(`/api/v1/orgs/${org.id}/members/${member.user.id}`)
      .send({ role: "VIEWER" });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe("VIEWER");

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { action: "ROLE_CHANGE" },
    });
    expect(audit.metaData).toEqual({ from: "MEMBER", to: "VIEWER" });
  });

  it("ADMIN cannot change the OWNER's role", async () => {
    const owner = await signUp();
    const org = await createOrg(owner.agent);
    const admin = await addMember(org.id, "ADMIN");

    const res = await admin.agent
      .patch(`/api/v1/orgs/${org.id}/members/${owner.user.id}`)
      .send({ role: "VIEWER" });
    expect(res.status).toBe(403);
  });

  it("the only OWNER cannot change their own role", async () => {
    const owner = await signUp();
    const org = await createOrg(owner.agent);

    const res = await owner.agent
      .patch(`/api/v1/orgs/${org.id}/members/${owner.user.id}`)
      .send({ role: "ADMIN" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("LAST_OWNER");
  });

  it("returns 422 for role OWNER in the body", async () => {
    const owner = await signUp();
    const org = await createOrg(owner.agent);
    const member = await addMember(org.id, "MEMBER");

    const res = await owner.agent
      .patch(`/api/v1/orgs/${org.id}/members/${member.user.id}`)
      .send({ role: "OWNER" });
    expect(res.status).toBe(422);
  });

  it("a MEMBER can leave", async () => {
    const owner = await signUp();
    const org = await createOrg(owner.agent);
    const member = await addMember(org.id, "MEMBER");

    const res = await member.agent.delete(
      `/api/v1/orgs/${org.id}/members/${member.user.id}`,
    );
    expect(res.status).toBe(204);

    const after = await member.agent.get(`/api/v1/orgs/${org.id}`);
    expect(after.status).toBe(404);
  });

  it("the only OWNER cannot leave", async () => {
    const owner = await signUp();
    const org = await createOrg(owner.agent);

    const res = await owner.agent.delete(
      `/api/v1/orgs/${org.id}/members/${owner.user.id}`,
    );
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("LAST_OWNER");
  });

  it("OWNER transfers ownership and becomes ADMIN", async () => {
    const owner = await signUp();
    const org = await createOrg(owner.agent);
    const member = await addMember(org.id, "MEMBER");

    const res = await owner.agent
      .post(`/api/v1/orgs/${org.id}/transfer-ownership`)
      .send({ userId: member.user.id });
    expect(res.status).toBe(200);

    const roles = await prisma.membership.findMany({
      where: { organizationId: org.id },
      select: { userId: true, role: true },
    });
    expect(roles).toContainEqual({ userId: member.user.id, role: "OWNER" });
    expect(roles).toContainEqual({ userId: owner.user.id, role: "ADMIN" });
    expect(
      await prisma.auditLog.count({
        where: { action: "OWNERSHIP_TRANSFERRED" },
      }),
    ).toBe(1);
  });

  it("returns 404 when transferring to a non-member", async () => {
    const owner = await signUp();
    const stranger = await signUp();
    const org = await createOrg(owner.agent);

    const res = await owner.agent
      .post(`/api/v1/orgs/${org.id}/transfer-ownership`)
      .send({ userId: stranger.user.id });
    expect(res.status).toBe(404);
  });
});
