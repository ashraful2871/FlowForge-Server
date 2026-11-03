import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "../../../tests/helpers/db";
import {
  addMember,
  createInvite,
  createOrg,
  signUp,
  uniqueEmail,
} from "../../../tests/helpers/seed";
import { prisma } from "../../lib/db";

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

const ownerWithOrg = async () => {
  const owner = await signUp("Owner");
  const org = await createOrg(owner.agent);
  return { owner, org };
};

describe("create, list, revoke", () => {
  it("ADMIN invites and the response has no token", async () => {
    const { org } = await ownerWithOrg();
    const admin = await addMember(org.id, "ADMIN");

    const res = await admin.agent
      .post(`/api/v1/orgs/${org.id}/invitations`)
      .send({ email: uniqueEmail(), role: "MEMBER" });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeUndefined();
    expect(res.body.expiresAt).toBeDefined();
  });

  it("MEMBER cannot invite", async () => {
    const { org } = await ownerWithOrg();
    const member = await addMember(org.id, "MEMBER");

    const res = await member.agent
      .post(`/api/v1/orgs/${org.id}/invitations`)
      .send({ email: uniqueEmail(), role: "MEMBER" });
    expect(res.status).toBe(403);
  });

  it("returns 422 for role OWNER", async () => {
    const { owner, org } = await ownerWithOrg();

    const res = await owner.agent
      .post(`/api/v1/orgs/${org.id}/invitations`)
      .send({ email: uniqueEmail(), role: "OWNER" });
    expect(res.status).toBe(422);
  });

  it("returns 409 ALREADY_MEMBER for an existing member", async () => {
    const { owner, org } = await ownerWithOrg();
    const member = await addMember(org.id, "MEMBER");

    const res = await owner.agent
      .post(`/api/v1/orgs/${org.id}/invitations`)
      .send({ email: member.user.email, role: "ADMIN" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("ALREADY_MEMBER");
  });

  it("returns 409 INVITE_PENDING for a second invite", async () => {
    const { owner, org } = await ownerWithOrg();
    const email = uniqueEmail();
    const url = `/api/v1/orgs/${org.id}/invitations`;

    await owner.agent.post(url).send({ email, role: "MEMBER" });
    const res = await owner.agent.post(url).send({ email, role: "MEMBER" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("INVITE_PENDING");
  });

  it("lists only open invitations", async () => {
    const { owner, org } = await ownerWithOrg();
    const open = await createInvite({
      orgId: org.id,
      email: uniqueEmail(),
      role: "MEMBER",
      invitedById: owner.user.id,
    });
    const revoked = await createInvite({
      orgId: org.id,
      email: uniqueEmail(),
      role: "MEMBER",
      invitedById: owner.user.id,
    });
    await owner.agent.delete(
      `/api/v1/orgs/${org.id}/invitations/${revoked.id}`,
    );

    const res = await owner.agent.get(`/api/v1/orgs/${org.id}/invitations`);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(open.id);
  });
});

describe("POST /invitations/accept", () => {
  it("the invited user joins with the invited role", async () => {
    const { owner, org } = await ownerWithOrg();
    const invitee = await signUp("Invitee");
    const { token } = await createInvite({
      orgId: org.id,
      email: invitee.user.email,
      role: "ADMIN",
      invitedById: owner.user.id,
    });

    const res = await invitee.agent
      .post("/api/v1/invitations/accept")
      .send({ token });
    expect(res.status).toBe(200);

    const orgRes = await invitee.agent.get(`/api/v1/orgs/${org.id}`);
    expect(orgRes.status).toBe(200);
    expect(orgRes.body.role).toBe("ADMIN");
  });

  it("the same token twice returns 410 and no duplicate", async () => {
    const { owner, org } = await ownerWithOrg();
    const invitee = await signUp("Invitee");
    const { token } = await createInvite({
      orgId: org.id,
      email: invitee.user.email,
      role: "MEMBER",
      invitedById: owner.user.id,
    });

    await invitee.agent.post("/api/v1/invitations/accept").send({ token });
    const res = await invitee.agent
      .post("/api/v1/invitations/accept")
      .send({ token });
    expect(res.status).toBe(410);
    expect(res.body.error.code).toBe("INVITE_EXPIRED_OR_USED");
    expect(
      await prisma.membership.count({ where: { userId: invitee.user.id } }),
    ).toBe(1);
  });

  it("returns 403 EMAIL_MISMATCH for another user", async () => {
    const { owner, org } = await ownerWithOrg();
    const someoneElse = await signUp("Someone");
    const { token } = await createInvite({
      orgId: org.id,
      email: uniqueEmail(),
      role: "MEMBER",
      invitedById: owner.user.id,
    });

    const res = await someoneElse.agent
      .post("/api/v1/invitations/accept")
      .send({ token });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("EMAIL_MISMATCH");
  });

  it("returns 410 for an expired invitation", async () => {
    const { owner, org } = await ownerWithOrg();
    const invitee = await signUp("Invitee");
    const { token } = await createInvite({
      orgId: org.id,
      email: invitee.user.email,
      role: "MEMBER",
      invitedById: owner.user.id,
      expiresAt: new Date(Date.now() - 60 * 1000),
    });

    const res = await invitee.agent
      .post("/api/v1/invitations/accept")
      .send({ token });
    expect(res.status).toBe(410);
  });

  it("returns 410 for a revoked invitation", async () => {
    const { owner, org } = await ownerWithOrg();
    const invitee = await signUp("Invitee");
    const invite = await createInvite({
      orgId: org.id,
      email: invitee.user.email,
      role: "MEMBER",
      invitedById: owner.user.id,
    });
    await owner.agent.delete(`/api/v1/orgs/${org.id}/invitations/${invite.id}`);

    const res = await invitee.agent
      .post("/api/v1/invitations/accept")
      .send({ token: invite.token });
    expect(res.status).toBe(410);
  });

  it("a removed member who is invited again becomes ACTIVE, one row", async () => {
    const { owner, org } = await ownerWithOrg();
    const member = await addMember(org.id, "MEMBER");
    await member.agent.delete(
      `/api/v1/orgs/${org.id}/members/${member.user.id}`,
    );

    const { token } = await createInvite({
      orgId: org.id,
      email: member.user.email,
      role: "VIEWER",
      invitedById: owner.user.id,
    });
    const res = await member.agent
      .post("/api/v1/invitations/accept")
      .send({ token });
    expect(res.status).toBe(200);

    const rows = await prisma.membership.findMany({
      where: { organizationId: org.id, userId: member.user.id },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe("ACTIVE");
    expect(rows[0]?.role).toBe("VIEWER");
  });
});
