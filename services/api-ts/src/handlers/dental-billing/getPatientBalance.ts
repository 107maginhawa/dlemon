/**
 * getPatientBalance — GET /dental/billing/patients/:patientId/balance
 *
 * FR4.4: Per-patient outstanding balance — sum all non-voided invoice balanceCents.
 */

import type { BaseContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import { DentalInvoiceRepository } from './repos/dental-invoice.repo';
import { DentalPaymentPlanRepository } from './repos/dental-payment-plan.repo';
import { getPatientBranchForBilling } from '../patient/repos/patient-billing.facade';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { getActiveBranchIdsForPerson } from '@/handlers/dental-org/repos/org-billing.facade';
import { withTenantTx } from '@/core/tenant-tx';

export async function getPatientBalance(ctx: BaseContext) {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const patientId = ctx.req.param('patientId')!;
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  // Branch-level authorization via patient's preferred branch
  const patient = await getPatientBranchForBilling(db, patientId);
  if (patient?.preferredBranchId) {
    await assertBranchAccess(db, user.id, patient.preferredBranchId);
  }

  // RLS P1b activation: the balance aggregates the patient's invoices with no
  // app-level branch filter (findMany by patientId). Route the reads through
  // withTenantTx scoped to the caller's active branches so the app_rls policy on
  // dental_invoice enforces tenancy as a second wall — a caller never sums
  // invoices from branches they are not a member of. Authz above stays on db.
  const scopeBranchIds = await getActiveBranchIdsForPerson(db, user.id);

  const { invoices, plans } = await withTenantTx(db, { branchIds: scopeBranchIds }, async (tx) => {
    const invoiceRepo = new DentalInvoiceRepository(tx);
    const planRepo = new DentalPaymentPlanRepository(tx);
    return {
      invoices: await invoiceRepo.findMany({ patientId }),
      plans: await planRepo.findByPatient(patientId),
    };
  });
  const activeInvoices = invoices.filter(inv => inv.status !== 'voided');

  const totalBilledCents = activeInvoices.reduce((sum, inv) => sum + inv.totalCents, 0);
  const totalPaidCents = activeInvoices.reduce((sum, inv) => sum + inv.paidCents, 0);
  const outstandingBalanceCents = activeInvoices.reduce((sum, inv) => sum + inv.balanceCents, 0);

  const overdueInvoices = activeInvoices.filter(inv => inv.status === 'overdue');
  const overdueAmountCents = overdueInvoices.reduce((sum, inv) => sum + inv.balanceCents, 0);

  // Active payment plans
  const activePlans = plans.filter(p => p.status === 'on_track' || p.status === 'behind');

  logger?.info({ action: 'getPatientBalance', patientId, outstandingBalanceCents }, 'Patient balance retrieved');

  return ctx.json({
    patientId,
    totalBilledCents,
    totalPaidCents,
    outstandingBalanceCents,
    overdueAmountCents,
    invoiceCount: activeInvoices.length,
    overdueInvoiceCount: overdueInvoices.length,
    activePaymentPlanCount: activePlans.length,
  }, 200);
}
