import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/db";

const app = createApp();

afterAll(async () => {
  await prisma.$disconnect();
});

describe("GET /health", () => {
  it("returns ok", async () => {
    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});

describe("GET /ready", () => {
  it("returns ready when the database is up", async () => {
    const res = await request(app).get("/ready");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ready" });
  });
});

describe("unknown route", () => {
  it("returns 404 with the error shape", async () => {
    const res = await request(app).get("/nope");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
    expect(typeof res.body.error.requestid).toBe("string");
  });
});

describe("request id", () => {
  it("creates one when none is sent", async () => {
    const res = await request(app).get("/health");

    expect(res.headers["x-request-id"]).toBeDefined();
  });

  it("echoes a valid incoming id", async () => {
    const res = await request(app)
      .get("/health")
      .set("X-Request-Id", "abc-123");

    expect(res.headers["x-request-id"]).toBe("abc-123");
  });

  it("replaces an invalid incoming id", async () => {
    const res = await request(app)
      .get("/health")
      .set("X-Request-Id", "<script>");

    expect(res.headers["x-request-id"]).not.toBe("<script>");
  });
});

describe("malformed JSON", () => {
  it("returns 400 BAD_REQUEST", async () => {
    const res = await request(app)
      .post("/health")
      .set("Content-Type", "application/json")
      .send("{");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("BAD_REQUEST");
  });
});
