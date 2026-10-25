/* eslint-disable @typescript-eslint/no-unsafe-call */
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getCookie, newAgent } from "../../../tests/helpers/agent";
import { resetDb } from "../../../tests/helpers/db";
import {
  signUp,
  TEST_PASSWORD,
  uniqueEmail,
} from "../../../tests/helpers/seed";
import { createApp } from "../../app";
import { prisma } from "../../lib/db";
import { hashToken } from "../../lib/token";

const app = createApp();
const DAY_MS = 24 * 60 * 60 * 1000;

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("POST /auth/register", () => {
  it("creates the user and sets a safe session cookie", async () => {
    const agent = newAgent();
    const res = await agent.post("/api/v1/auth/register").send({
      name: "Ashraful",
      email: uniqueEmail(),
      password: TEST_PASSWORD,
    });

    expect(res.status).toBe(201);
    expect(res.body.user.passwordHash).toBeUndefined();

    const setCookie = String(res.headers["set-cookie"]);
    expect(setCookie).toContain("ff_session=");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
  });

  it("stores the email trimmed and lowercase", async () => {
    const agent = newAgent();
    await agent.post("/api/v1/auth/register").send({
      name: "Ashraful",
      email: "  Ash@Example.COM ",
      password: TEST_PASSWORD,
    });

    const user = await prisma.user.findUnique({
      where: { email: "ash@example.com" },
    });
    expect(user).not.toBeNull();
  });

  it("returns 409 EMAIL_TAKEN for the same email in another case", async () => {
    const body = { name: "Ashraful", password: TEST_PASSWORD };
    await newAgent()
      .post("/api/v1/auth/register")
      .send({ ...body, email: "dup@test.dev" });

    const res = await newAgent()
      .post("/api/v1/auth/register")
      .send({ ...body, email: "DUP@test.dev" });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("EMAIL_TAKEN");
  });

  it("returns 422 for a common password", async () => {
    const res = await newAgent().post("/api/v1/auth/register").send({
      name: "Ashraful",
      email: uniqueEmail(),
      password: "password123",
    });

    expect(res.status).toBe(422);
    expect(res.body.error.fields.password).toBeDefined();
  });

  it("returns 422 when name is missing", async () => {
    const res = await newAgent()
      .post("/api/v1/auth/register")
      .send({ email: uniqueEmail(), password: TEST_PASSWORD });

    expect(res.status).toBe(422);
  });

  it("stores only the hash of the cookie, never the raw value", async () => {
    const agent = newAgent();
    const res = await agent.post("/api/v1/auth/register").send({
      name: "Ashraful",
      email: uniqueEmail(),
      password: TEST_PASSWORD,
    });
    const cookie = getCookie(res, "ff_session");
    expect(cookie).toBeDefined();

    const byRaw = await prisma.session.findUnique({
      where: { tokenHash: cookie! },
    });
    const byHash = await prisma.session.findUnique({
      where: { tokenHash: hashToken(cookie!) },
    });
    expect(byRaw).toBeNull();
    expect(byHash).not.toBeNull();
  });
});

describe("requireSession (via GET /me)", () => {
  it("returns 401 without a cookie", async () => {
    const res = await request(app).get("/api/v1/me");

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("returns 401 for a made-up cookie", async () => {
    const res = await request(app)
      .get("/api/v1/me")
      .set("Cookie", "ff_session=abc");

    expect(res.status).toBe(401);
  });

  it("returns the user for a valid session", async () => {
    const { agent, user } = await signUp();
    const res = await agent.get("/api/v1/me");

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(user.email);
  });

  it("returns 401 for a revoked session", async () => {
    const { agent, user } = await signUp();
    await prisma.session.updateMany({
      where: { userId: user.id },
      data: { revokedAt: new Date() },
    });

    const res = await agent.get("/api/v1/me");
    expect(res.status).toBe(401);
  });

  it("returns 401 after the absolute expiry", async () => {
    const { agent, user } = await signUp();
    await prisma.session.updateMany({
      where: { userId: user.id },
      data: { expiresAt: new Date(Date.now() - DAY_MS) },
    });

    const res = await agent.get("/api/v1/me");
    expect(res.status).toBe(401);
  });

  it("returns 401 after 7 idle days", async () => {
    const { agent, user } = await signUp();
    await prisma.session.updateMany({
      where: { userId: user.id },
      data: { lastSeenAt: new Date(Date.now() - 8 * DAY_MS) },
    });

    const res = await agent.get("/api/v1/me");
    expect(res.status).toBe(401);
  });

  it("updates lastSeenAt only when it is older than 5 minutes", async () => {
    const { agent, user } = await signUp();
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    await prisma.session.updateMany({
      where: { userId: user.id },
      data: { lastSeenAt: oneMinuteAgo },
    });

    await agent.get("/api/v1/me");
    let session = await prisma.session.findFirstOrThrow({
      where: { userId: user.id },
    });
    expect(session.lastSeenAt.getTime()).toBe(oneMinuteAgo.getTime());

    const sixMinutesAgo = new Date(Date.now() - 6 * 60 * 1000);
    await prisma.session.updateMany({
      where: { userId: user.id },
      data: { lastSeenAt: sixMinutesAgo },
    });

    await agent.get("/api/v1/me");
    session = await prisma.session.findFirstOrThrow({
      where: { userId: user.id },
    });
    expect(session.lastSeenAt.getTime()).toBeGreaterThan(
      sixMinutesAgo.getTime(),
    );
  });
});
