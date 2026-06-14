/**
 * createWaitlistEntry — POST /dental/branches/:branchId/waitlist
 *
 * Adds a patient to a branch's scheduling waitlist (ASAP fill). The entry
 * starts in `active` status and can later be promoted into an appointment when
 * a short-notice slot opens.
 */

import type { HandlerContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { withTenantTx } from '@/core/tenant-tx';
import { DentalWaitlistEntryRepository } from './repos/waitlist-entry.repo';
import type { User } from '@/types/auth';
import type { CreateWaitlistEntryBody, CreateWaitlistEntryParams } from '@/generated/openapi/validators';

export async function createWaitlistEntry(ctx: HandlerContext) {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { branchId } = ctx.req.valid('param') as CreateWaitlistEntryParams;
  const body = ctx.req.valid('json') as CreateWaitlistEntryBody;

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  // Authorization: scheduling-capable role in the target branch (EM-SCH-001 parity).
  await assertBranchRole(db, user.id, branchId, [
    'dentist_owner', 'dentist_associate', 'staff_full', 'staff_scheduling',
  ]);

  // RLS P1b activation: the waitlist-entry write goes through withTenantTx so the
  // app_rls policy on dental_waitlist_entry enforces the branch scope. Authz above
  // stays on db.
  const entry = await withTenantTx(db, { branchIds: [branchId] }, (tx) =>
    new DentalWaitlistEntryRepository(tx, logger).createOne({
      patientId: body.patientId,
      branchId,
      preferredProviderId: body.preferredProviderId ?? null,
      visitType: body.visitType ?? null,
      urgency: body.urgency ?? 'routine',
      status: 'active',
      notes: body.notes ?? null,
      createdBy: user.id,
      updatedBy: user.id,
    }),
  );

  logger?.info?.({ action: 'createWaitlistEntry', branchId, entryId: entry.id }, 'Waitlist entry created');

  return ctx.json(entry, 201);
}
