import z, { boolean } from "zod";

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
        .filter(boolean),
    ),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).default(30),
});
const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    `Invalid environment variables:${z.prettifyError(parsed.error)}`,
  );
  process.exit(1);
}

export const config = parsed.data;
