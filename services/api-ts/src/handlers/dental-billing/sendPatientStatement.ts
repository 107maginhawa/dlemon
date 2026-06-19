/**
 * sendPatientStatement — POST /dental/billing/patients/:patientId/statement/send
 *
 * BR-050 manual dunning nudge: enqueue the patient's current statement (their
 * outstanding balance) as a `billing` notification on email + push, on demand
 * from the collections "send statement" action. Distinct from the automated
 * reminder cadence (jobs/dunning.ts) — this is a one-off, patient-level send and
 * is NOT logged in dental_billing_reminder_log (that ledger is per invoice+offset).
 *
 * Branch-scoped (EM-BIL-002): an explicit branchId asserts membership; omitted,
 * the balance is scoped to the caller's own active branches via withTenantTx.
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { getActiveBranchIdsForPerson } from '@/handlers/dental-org/repos/org-billing.facade';
import { getPatientBranchForBilling } from '../patient/repos/patient-billing.facade';
import { withTenantTx } from '@/core/tenant-tx';
import { DentalInvoiceRepository } from './repos/dental-invoice.repo';
import { NotificationRepository } from '@/handlers/notifs/repos/notification.repo';
import type { SendPatientStatementBody, SendPatientStatementParams } from '@/generated/openapi/validators';

const STATEMENT_CHANNELS = ['email', 'push'] as const;

export async function sendPatientStatement(
  ctx: ValidatedContext<SendPatientStatementBody, never, SendPatientStatementParams>,
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError();

  const { patientId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const body = ctx.req.valid('json');

  const patient = await getPatientBranchForBilling(db, patientId);
  if (!patient) throw new NotFoundError('Patient');

  // EM-BIL-002: explicit branchId asserts membership; else authorize via the
  // patient's preferred branch (mirrors getPatientBalance).
  if (body.branchId) {
    await assertBranchAccess(db, user.id, body.branchId);
  } else if (patient.preferredBranchId) {
    await assertBranchAccess(db, user.id, patient.preferredBranchId);
  }

  const scopeBranchIds = await getActiveBranchIdsForPerson(db, user.id);
  const invoices = await withTenantTx(db, { branchIds: scopeBranchIds }, (tx) =>
    new DentalInvoiceRepository(tx).findMany({ patientId }),
  );
  const outstandingBalanceCents = invoices
    .filter((inv) => inv.status !== 'voided')
    .reduce((sum, inv) => sum + inv.balanceCents, 0);

  // Nothing to dun, or no person to notify → report not sent (not an error).
  if (outstandingBalanceCents <= 0 || !patient.person) {
    return ctx.json({ patientId, sent: false, outstandingBalanceCents, channels: [] }, 200);
  }

  const notifRepo = new NotificationRepository(db, logger);
  const channels: string[] = [];
  for (const channel of STATEMENT_CHANNELS) {
    try {
      await notifRepo.createNotificationForModule({
        recipient: patient.person,
        type: 'billing',
        channel,
        title: 'Account statement',
        message: `Your account has an outstanding balance of ${(outstandingBalanceCents / 100).toFixed(2)}. Please settle at your earliest convenience.`,
        relatedEntityType: 'patient',
        relatedEntity: patientId,
      });
      channels.push(channel);
    } catch (error) {
      logger?.warn({ error, patientId, channel }, 'statement send channel enqueue failed');
    }
  }

  logger?.info({ action: 'sendPatientStatement', patientId, outstandingBalanceCents, channels }, 'Statement sent');
  return ctx.json({ patientId, sent: channels.length > 0, outstandingBalanceCents, channels }, 200);
}
