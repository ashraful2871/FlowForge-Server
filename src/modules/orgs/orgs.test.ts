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
