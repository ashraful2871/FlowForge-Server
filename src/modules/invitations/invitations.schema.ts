import z from "zod";
import { emailSchema } from "../../lib/validation";

export const CreateInvitationBody = z.object({
  email: emailSchema,
  role: z.enum(["ADMIN", "MEMBER", "VIEWER"]),
});

export type CreateInvitationInput = z.infer<typeof CreateInvitationBody>;

export const AcceptInvitationBody = z.object({
  token: z.string().min(1).max(200),
});
