import { argon2id, hash, verify } from "argon2";
import z from "zod";
import { COMMON_PASSWORDS } from "./commonPasswords";

export const hashPassword = async (plain: string): Promise<string> => {
  return hash(plain, { type: argon2id });
};

export const verifyPassword = async (
  passwordHash: string,
  plain: string,
): Promise<boolean> => {
  try {
    return await verify(passwordHash, plain);
  } catch {
    return false;
  }
};

export const DUMMY_HASH = await hashPassword("timing-equalizer-not-a-password");

export const passwordSchema = z
  .string()
  .min(10, "Password must be at least 10 characters")
  .max(120, "Password must be at most 128 characters")
  .refine((value) => !COMMON_PASSWORDS.has(value.toLocaleLowerCase()), {
    message: "This password is too common",
  });
