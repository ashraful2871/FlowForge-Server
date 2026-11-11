import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/db";
import { resetDb } from "./helpers/db";
import { createOrg, signUp } from "./helpers/seed";

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("database guarantees", () => {
  it("rejects a task whose organization differs from its project's", async () => {
    const a = await signUp("Owner A");
    const b = await signUp("Owner B");
    const orgA = await createOrg(a.agent);
    const orgB = await createOrg(b.agent);
    const projectA = await prisma.project.create({
      data: { organizationId: orgA.id, name: "Website", key: "WEB" },
    });

    // org B-র id দিয়ে org A-র project-এ task: compound FK আটকাবে
    await expect(
      prisma.task.create({
        data: {
          organizationId: orgB.id,
          projectId: projectA.id,
          number: 1,
          title: "Sneaky task",
        },
      }),
    ).rejects.toThrow();

    expect(await prisma.task.count()).toBe(0);
  });

  it("keeps project keys unique per organization only", async () => {
    const a = await signUp("Owner A");
    const b = await signUp("Owner B");
    const orgA = await createOrg(a.agent);
    const orgB = await createOrg(b.agent);

    await prisma.project.create({
      data: { organizationId: orgA.id, name: "Website", key: "WEB" },
    });

    // অন্য org-এ একই key চলে
    await expect(
      prisma.project.create({
        data: { organizationId: orgB.id, name: "Web app", key: "WEB" },
      }),
    ).resolves.toBeDefined();

    // একই org-এ একই key চলে না
    await expect(
      prisma.project.create({
        data: { organizationId: orgA.id, name: "Other", key: "WEB" },
      }),
    ).rejects.toThrow();
  });
});
