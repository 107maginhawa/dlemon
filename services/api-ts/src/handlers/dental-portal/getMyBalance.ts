/**
 * getMyBalance — GET /me/balance  (E4 portal, self-scoped read)
 *
 * Returns the AUTHENTICATED patient's OWN outstanding-balance summary. IDOR-free
 * by construction: patientId is derived server-side from the session. Staff-only
 * account → 403; unauthenticated → 401.
 *
 * Mirrors the staff getPatientBalance aggregation but excludes both voided AND
 * uncollectible invoices: a patient must not be shown a balance for debt the
 * clinic has already internally written off (uncollectible) or cancelled
 * (voided). Exposes only the patient-appropriate roll-up figures.
 */

import type { BaseContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import { resolveSelfPatientIdOrThrow } from '@/handlers/shared/assert-self-patient';
import { getInvoicesByPatientId } from '@/handlers/dental-billing/repos/billing-dental-patient.facade';

export async function getMyBalance(ctx: BaseContext): Promise<Response> {
  const user = ctx.get('user');
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const patientId = await resolveSelfPatientIdOrThrow(db, user.id);

  const invoices = await getInvoicesByPatientId(db, patientId);
  const active = invoices.filter(
    (inv) => inv.status !== 'voided' && inv.status !== 'uncollectible',
  );

  const totalBilledCents = active.reduce((sum, inv) => sum + inv.totalCents, 0);
  const totalPaidCents = active.reduce((sum, inv) => sum + inv.paidCents, 0);
  const outstandingBalanceCents = active.reduce((sum, inv) => sum + inv.balanceCents, 0);
  const overdueAmountCents = active
    .filter((inv) => inv.status === 'overdue')
    .reduce((sum, inv) => sum + inv.balanceCents, 0);

  logger?.info(
    { action: 'getMyBalance', patientId, outstandingBalanceCents },
    'Patient self-service balance retrieved',
  );

  return ctx.json(
    {
      totalBilledCents,
      totalPaidCents,
      outstandingBalanceCents,
      overdueAmountCents,
      invoiceCount: active.length,
    },
    200,
  );
}
