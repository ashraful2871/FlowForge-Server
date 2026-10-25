import type { Prisma } from "../generated/prisma/client";
import type { AuditAction } from "../generated/prisma/enums";

type AuditEntry = {
  organizationId: string | null;
  actorId: string | null;
  action: AuditAction;
  targetedType: string;
  targetedId: string;
  metaData?: Prisma.InputJsonValue;
};

export const writeAudit = async (
  tx: Prisma.TransactionClient,
  entry: AuditEntry,
): Promise<void> => {
  await tx.auditLog.create({
    data: {
      ...entry,
      targetedType: entry.targetedType,
      targetedId: entry.targetedId,
      metaData: entry.metaData ?? {},
    },
  });
};
