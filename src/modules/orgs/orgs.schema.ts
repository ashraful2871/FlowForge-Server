import z from "zod";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const CreateOrgBody = z.object({
  name: z.string().trim().min(2).max(60),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(40)
    .regex(SLUG_PATTERN, "Use lowercase letters, numbers and single dashes"),
});

export const UpdateOrgBody = z.object({
  name: z.string().trim().min(2).max(60).optional(),
});

export const ChangeRoleBody = z.object({
  role: z.enum(["ADMIN", "MEMBER", "VIEWER"]),
});

export const TransferOwnershipBody = z.object({
  userId: z.string(),
});

export type CreateOrgInput = z.infer<typeof CreateOrgBody>;
export type UpdateOrgInput = z.infer<typeof UpdateOrgBody>;
