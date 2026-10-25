import { describe, expect, it } from "vitest";
import { generateToken, hashToken } from "./token";

describe("generateToken", () => {
  it("returns 43 URL-safe characters", () => {
    expect(generateToken()).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("never repeats", () => {
    const tokens = new Set(Array.from({ length: 1000 }, () => generateToken()));

    expect(tokens.size).toBe(1000);
  });
});

describe("hashToken", () => {
  it("returns 64 hex characters", () => {
    expect(hashToken("abc")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("gives the same hash for the same input", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"));
  });

  it("gives different hashes for different input", () => {
    expect(hashToken("abc")).not.toBe(hashToken("abd"));
  });
});
