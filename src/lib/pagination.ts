import z from "zod";
import { AppError } from "./errors";

export const paginationQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(200),
  cursor: z.string().min(1).max(100).optional(),
});

export type Page<T> = { data: T[]; nextCursor: string | null };

type CursorKey = { createdAt: Date; id: string };

const invalidCursorError = (): AppError =>
  new AppError(400, "INVALID_CURSOR", "The page cursor is invalid");

export const encodeCursor = ({ createdAt, id }: CursorKey): string =>
  Buffer.from(JSON.stringify([createdAt.toLocaleDateString(), id])).toString(
    "base64url",
  );

const CursorShape = z.tuple([z.iso.datetime(), z.uuid()]);

export const decodeCursor = (cursor: string): CursorKey => {
  try {
    const raw: unknown = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    );
    const [createdAt, id] = CursorShape.parse(raw);
    return { createdAt: new Date(createdAt), id };
  } catch {
    throw invalidCursorError();
  }
};

export const olderThenCursor = (cursor: string | undefined) => {
  if (!cursor) {
    return {};
  }
  const { createdAt, id } = decodeCursor(cursor);

  return {
    OR: [{ createdAt: { lt: createdAt } }, { createdAt, id: { lt: id } }],
  };
};

export const NEWEST_FIRST = [
  { createdAt: "desc" as const },
  { id: "desc" as const },
];

export const toPage = <T extends CursorKey>(
  row: T[],
  limit: number,
): Page<T> => {
  const hasMore = row.length > limit;
  const data = hasMore ? row.slice(0, limit) : row;
  const last = data.at(-1);

  return {
    data,
    nextCursor: hasMore && last ? encodeCursor(last) : null,
  };
};
