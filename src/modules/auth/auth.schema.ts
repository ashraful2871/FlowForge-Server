import z from "zod";
import { emailSchema } from "../../lib/validation";
import { passwordSchema } from "../../lib/password";

export const RegisterBody = z.object({
  name: z.string().trim().min(2).max(60),
  email: emailSchema,
  password: passwordSchema,
});

export const LoginBody = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});

export type RegisterInput = z.infer<typeof RegisterBody>;
export type LoginInput = z.infer<typeof LoginBody>;
