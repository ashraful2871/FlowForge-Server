import z from "zod";

const PROJECT_KEY = /^[A-Z][A-Z0-9]{1,9}$/;

export const CreateProjectBody = z.object({
  name: z.string().trim().min(1).max(80),
  key: z
    .string()
    .trim()
    .toUpperCase()
    .regex(PROJECT_KEY, "2–10 letters or digits, starting with a letter"),
  description: z.string().trim().max(2000).optional(),
});

export const UpdateProjectBody = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
});

export type UpdateProjectInput = z.infer<typeof UpdateProjectBody>;

export const ListProjectQuery = z.object({
  status: z.enum(["ACTIVE", "ARCHIVED"]).default("ACTIVE"),
});

export type CreateProjectInput = z.infer<typeof CreateProjectBody>;
