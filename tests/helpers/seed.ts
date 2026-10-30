import { randomUUID } from "node:crypto";
import { newAgent } from "./agent";
import { prisma } from "../../src/lib/db";
import type { OrgRole } from "../../src/generated/prisma/enums";

export const TEST_PASSWORD = "correct-horse-battery";
export type TestOrg = { id: string; name: string; slug: string };

type Agent = ReturnType<typeof newAgent>;
export type TestUser = { id: string; name: string; email: string };

export function uniqueEmail(): string {
  return `user-${randomUUID().slice(0, 8)}@test.dev`;
}

// API দিয়ে register করে; ফেরত agent-এ আসল session cookie থাকে
export async function signUp(
  name = "Test User",
): Promise<{ agent: Agent; user: TestUser }> {
  const agent = newAgent();
  const res = await agent
    .post("/api/v1/auth/register")
    .send({ name, email: uniqueEmail(), password: TEST_PASSWORD });

  if (res.status !== 201) {
    throw new Error(`signUp failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return { agent, user: res.body.user as TestUser };
}

// API দিয়ে org বানায়; slug প্রতিবার আলাদা, তাই test-গুলো একে অন্যের সাথে ধাক্কা খায় না
export const createOrg = async (agent: Agent): Promise<TestOrg> => {
  const slug = `org-${randomUUID().slice(0, 8)}`;
  const res = await agent.post("/api/v1/orgs").send({ name: "Test Org", slug });

  if (res.status !== 201) {
    throw new Error(
      `createOrg failed: ${res.status} ${JSON.stringify(res.body)}`,
    );
  }
  return res.body as TestOrg;
};

// নতুন user বানিয়ে সরাসরি DB-তে membership বসায় (invite ছাড়া)
export const addMember = async (
  orgId: string,
  role: OrgRole,
): Promise<{ agent: Agent; user: TestUser }> => {
  const member = await signUp("Member");
  await prisma.membership.create({
    data: { organizationId: orgId, userId: member.user.id, role },
  });
  return member;
};
