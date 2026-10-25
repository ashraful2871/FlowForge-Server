import { Prisma } from "../generated/prisma/client";

export const isUniqueViolation = (err: unknown): boolean => {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002"
  );
};
