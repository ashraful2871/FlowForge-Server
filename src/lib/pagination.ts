import z from "zod";

export const paginationQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(200),
  cursor: z.string().min(1).max(100).optional(),
});
