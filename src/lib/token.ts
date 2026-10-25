import { createHash, randomBytes } from "node:crypto";

export const generateToken = (): string => {
  return randomBytes(32).toString("base64url");
};

export const hashToken = (token: string): string => {
  return createHash("sha256").update(token).digest("hex");
};
