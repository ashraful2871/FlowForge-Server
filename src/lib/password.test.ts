import { describe, expect, it } from "vitest";
import { hashPassword, passwordSchema, verifyPassword } from "./password";

describe("hashPassword / verifyPassword", () => {
  it("produces an argon2id hash, not the plain text", async () => {
    const hashed = await hashPassword("correct-horse-battery");

    expect(hashed.startsWith("$argon2id$")).toBe(true);
    expect(hashed).not.toContain("correct-horse-battery");
  });

  it("uses a new salt every time", async () => {
    const first = await hashPassword("correct-horse-battery");
    const second = await hashPassword("correct-horse-battery");

    expect(first).not.toBe(second);
  });

  it("accepts the right password", async () => {
    const hashed = await hashPassword("correct-horse-battery");

    expect(await verifyPassword(hashed, "correct-horse-battery")).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hashed = await hashPassword("correct-horse-battery");

    expect(await verifyPassword(hashed, "wrong-horse-battery")).toBe(false);
  });

  it("returns false for a broken hash instead of throwing", async () => {
    expect(await verifyPassword("not-a-hash", "anything")).toBe(false);
  });
});

describe("passwordSchema", () => {
  it("rejects fewer than 10 characters", () => {
    expect(passwordSchema.safeParse("abc123xyz").success).toBe(false);
  });

  it("rejects a common password, whatever the case", () => {
    expect(passwordSchema.safeParse("Password123").success).toBe(false);
  });

  it("rejects more than 128 characters", () => {
    expect(passwordSchema.safeParse("a".repeat(129)).success).toBe(false);
  });

  it("accepts a long, uncommon password", () => {
    expect(passwordSchema.safeParse("correct-horse-battery").success).toBe(
      true,
    );
  });
});
