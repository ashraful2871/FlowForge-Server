import z from "zod";
import { notFoundError } from "./errors";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Invalid email address"));

export const parseIdParam = (value: unknown): string => {
  const result = z.uuid().safeParse(value);
  if (!result.success) {
    throw notFoundError();
  }
  return result.data;
};
