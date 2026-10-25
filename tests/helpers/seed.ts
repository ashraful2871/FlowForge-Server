import { randomUUID } from "node:crypto";
import { newAgent } from "./agent";

export const TEST_PASSWORD = "correct-horse-battery";

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
