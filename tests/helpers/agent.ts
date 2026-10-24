import { createApp } from "../../src/app";
import { config } from "../../src/config";
import request, { type Response } from "supertest";

export const TEST_ORIGIN = config.CORS_ORIGINS[0] ?? "http://localhost:3000";

export const newAgent = () => {
  return request.agent(createApp()).set("Origin", TEST_ORIGIN);
};

export const getCookie = (res: Response, name: string): string | undefined => {
  const raw: unknown = res.headers["set-cookie"];
  const list = Array.isArray(raw) ? (raw as string[]) : [];
  const found = list.find((cookie) => cookie.startsWith(`${name}=`));
  return found?.split(";")[0]?.slice(name.length + 1);
};
