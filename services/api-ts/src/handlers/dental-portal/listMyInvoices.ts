/**
 * listMyInvoices — GET /me/invoices  (E4 portal, self-scoped read)
 *
 * Returns the AUTHENTICATED patient's OWN invoices. IDOR-free by construction:
 * the patientId is derived server-side from the session — no client-supplied
 * patientId. Staff-only account → 403; unauthenticated → 401.
 *
 * Patient-appropriate projection: invoice number, status, amounts, and dates
 * only. Internal staff fields (dentistMemberId, discountedBy, discountReason,
 * uncollectibleAt, line items) are NOT exposed. Voided AND uncollectible
 * invoices are hidden — a patient should not be billed-facing a cancelled
 * invoice, nor one the clinic has already internally written off (uncollectible).
 */

import type { BaseContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import { resolveSelfPatientIdOrThrow } from '@/handlers/shared/assert-self-patient';
import { getInvoicesByPatientId } from '@/handlers/dental-billing/repos/billing-dental-patient.facade';

export async function listMyInvoices(ctx: BaseContext): Promise<Response> {
  const user = ctx.get('user');
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const patientId = await resolveSelfPatientIdOrThrow(db, user.id);

  // Facade returns the patient's invoices newest-first already.
  const rows = await getInvoicesByPatientId(db, patientId);

  const invoices = rows
    .filter((inv) => inv.status !== 'voided' && inv.status !== 'uncollectible')
    .map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      status: inv.status,
      totalCents: inv.totalCents,
      paidCents: inv.paidCents,
      balanceCents: inv.balanceCents,
      dueDate: inv.dueDate ? inv.dueDate.toISOString() : null,
      issuedAt: inv.issuedAt ? inv.issuedAt.toISOString() : null,
    }));

  logger?.info(
    { action: 'listMyInvoices', patientId, count: invoices.length },
    'Patient self-service invoices retrieved',
  );

  return ctx.json(invoices, 200);
}
