import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "../../../tests/helpers/db";
import {
  addMember,
  createOrg,
  createProject,
  signUp,
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
  return { owner, org, base: `/api/v1/orgs/${org.id}/projects` };
};

describe("create and read projects", () => {
  it("ADMIN creates a project with an uppercase key", async () => {
    const { org, base } = await ownerWithOrg();
    const admin = await addMember(org.id, "ADMIN");

    const res = await admin.agent
      .post(base)
      .send({ name: "Website", key: "web" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ key: "WEB", status: "ACTIVE" });
    expect(res.body.taskCounter).toBeUndefined();

    const row = await prisma.project.findUniqueOrThrow({
      where: { id: res.body.id },
    });
    expect(row.createdById).toBe(admin.user.id);
  });

  it("MEMBER cannot create a project", async () => {
    const { org, base } = await ownerWithOrg();
    const member = await addMember(org.id, "MEMBER");

    const res = await member.agent
      .post(base)
      .send({ name: "Website", key: "WEB" });
    expect(res.status).toBe(403);
  });

  it("returns 409 PROJECT_KEY_TAKEN for a key used in the same org", async () => {
    const { owner, base } = await ownerWithOrg();
    await owner.agent.post(base).send({ name: "One", key: "WEB" });

    const res = await owner.agent.post(base).send({ name: "Two", key: "web" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("PROJECT_KEY_TAKEN");
  });

  it.each(["1WEB", "W", "WEB-APP", "TOOLONGKEY1"])(
    "returns 422 for key %j",
    async (key) => {
      const { owner, base } = await ownerWithOrg();
      const res = await owner.agent.post(base).send({ name: "P", key });

      expect(res.status).toBe(422);
    },
  );

  it("VIEWER can list and read projects", async () => {
    const { owner, org, base } = await ownerWithOrg();
    const project = await createProject(owner.agent, org.id);
    const viewer = await addMember(org.id, "VIEWER");

    const list = await viewer.agent.get(base);
    const one = await viewer.agent.get(`${base}/${project.id}`);
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
    expect(one.status).toBe(200);
    expect(one.body.id).toBe(project.id);
  });

  it("returns 404 for a project id that does not exist", async () => {
    const { owner, base } = await ownerWithOrg();
    const res = await owner.agent.get(
      `${base}/00000000-0000-4000-8000-000000000000`,
    );

    expect(res.status).toBe(404);
  });
});

describe("update, archive and delete projects", () => {
  it("clears the description with null", async () => {
    const { owner, base } = await ownerWithOrg();
    const created = await owner.agent
      .post(base)
      .send({ name: "Website", key: "WEB", description: "Old text" });

    const res = await owner.agent
      .patch(`${base}/${created.body.id}`)
      .send({ description: null });
    expect(res.status).toBe(200);
    expect(res.body.description).toBeNull();
    expect(res.body.name).toBe("Website");
  });

  it("archives, hides from the default list and writes an audit row", async () => {
    const { owner, org, base } = await ownerWithOrg();
    const project = await createProject(owner.agent, org.id);

    const res = await owner.agent.post(`${base}/${project.id}/archive`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ARCHIVED");

    const active = await owner.agent.get(base);
    const archived = await owner.agent.get(`${base}?status=ARCHIVED`);
    expect(active.body.data).toHaveLength(0);
    expect(archived.body.data).toHaveLength(1);

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { action: "PROJECT_ARCHIVE" },
    });
    expect(audit.metaData).toEqual({ archived: true });
  });

  it("returns 409 PROJECT_ARCHIVED when editing an archived project", async () => {
    const { owner, org, base } = await ownerWithOrg();
    const project = await createProject(owner.agent, org.id);
    await owner.agent.post(`${base}/${project.id}/archive`);

    const res = await owner.agent
      .patch(`${base}/${project.id}`)
      .send({ name: "New name" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("PROJECT_ARCHIVED");
  });

  it("deletes only after archiving", async () => {
    const { owner, org, base } = await ownerWithOrg();
    const project = await createProject(owner.agent, org.id);

    const early = await owner.agent.delete(`${base}/${project.id}`);
    expect(early.status).toBe(409);
    expect(early.body.error.code).toBe("PROJECT_NOT_ARCHIVED");

    await owner.agent.post(`${base}/${project.id}/archive`);
    const res = await owner.agent.delete(`${base}/${project.id}`);
    expect(res.status).toBe(204);
    expect(await prisma.project.count()).toBe(0);
  });
});
