import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  DATABASE_URL: z.string().startsWith("postgresql://"),
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:3000")
    .transform((value) =>
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).default(30),
  SESSION_IDLE_DAYS: z.coerce.number().int().min(1).default(7),
  APP_URL: z.url().default("http://localhost:3000"),
});
const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    `Invalid environment variables:${z.prettifyError(parsed.error)}`,
  );
  process.exit(1);
}

export const config = parsed.data;
