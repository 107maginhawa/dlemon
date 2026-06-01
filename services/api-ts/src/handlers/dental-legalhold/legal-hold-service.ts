/**
 * Legal-hold workflow service (V-DG-002 support): place / release holds.
 * Every transition is audited. RBAC is enforced at the handler layer.
 */

import type { DatabaseInstance } from '@/core/database';
import { NotFoundError, ValidationError } from '@/core/errors';
import { logAuditEvent } from '@/core/audit-logger';
import { LegalHoldRepository } from './repos/legal-hold.repo';
import type { DentalLegalHold } from './repos/legal-hold.schema';

export interface PlaceLegalHoldInput {
  tenantId: string;
  branchId?: string | null;
  subjectPersonId: string;
  name: string;
  reason: string;
  initiatedBy: string;
  note?: string | null;
}

export interface LegalHoldServiceOpts {
  audit?: typeof logAuditEvent;
}

export async function placeLegalHold(
  db: DatabaseInstance,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  logger: any,
  input: PlaceLegalHoldInput,
  opts: LegalHoldServiceOpts = {},
): Promise<DentalLegalHold> {
  const repo = new LegalHoldRepository(db, logger);
  const hold = await repo.createOne({
    tenantId: input.tenantId,
    branchId: input.branchId ?? null,
    subjectPersonId: input.subjectPersonId,
    name: input.name,
    reason: input.reason,
    status: 'active',
    initiatedBy: input.initiatedBy,
    note: input.note ?? null,
    createdBy: input.initiatedBy,
    updatedBy: input.initiatedBy,
  });

  await (opts.audit ?? logAuditEvent)(db, logger, {
    personId: input.initiatedBy,
    tenantId: input.tenantId,
    branchId: input.branchId ?? undefined,
    action: 'legal_hold.placed',
    resourceType: 'legal_hold',
    resourceId: hold.id,
    eventType: 'compliance',
    metadata: { subjectPersonId: input.subjectPersonId, reason: input.reason },
  });

  return hold;
}

export async function releaseLegalHold(
  db: DatabaseInstance,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  logger: any,
  holdId: string,
  input: { releasedBy: string },
  opts: LegalHoldServiceOpts = {},
): Promise<DentalLegalHold> {
  const repo = new LegalHoldRepository(db, logger);
  const hold = await repo.findOneById(holdId);
  if (!hold) throw new NotFoundError('Legal hold not found');
  if (hold.status !== 'active') throw new ValidationError(`Legal hold is already ${hold.status}`);

  const released = await repo.updateOneById(holdId, {
    status: 'released',
    releasedBy: input.releasedBy,
    releasedAt: new Date(),
    updatedBy: input.releasedBy,
  } as Partial<DentalLegalHold>);

  await (opts.audit ?? logAuditEvent)(db, logger, {
    personId: input.releasedBy,
    tenantId: hold.tenantId,
    branchId: hold.branchId ?? undefined,
    action: 'legal_hold.released',
    resourceType: 'legal_hold',
    resourceId: hold.id,
    eventType: 'compliance',
    metadata: { subjectPersonId: hold.subjectPersonId },
  });

  return released;
}
