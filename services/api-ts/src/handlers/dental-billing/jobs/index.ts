/**
 * Dental Billing background jobs (AHA FIX-001/002 + BR-049).
 *
 * Registers the daily status sweep that makes already-implemented, already-
 * tested repo transitions fire in production:
 *   - BR-049 / FR4.1b: issued/partial invoices past their due date with a
 *     balance → `overdue`, AUDITED (`invoice.overdue`, actor = system).
 *   - FR4.3: active payment plans with a 7+-day-overdue installment → `behind`.
 *
 * Uses the existing platform scheduler (`core/jobs.ts`) — no new infrastructure.
 */

import type { JobScheduler, JobContext } from '@/core/jobs';
import { logAuditEvent } from '@/core/audit-logger';

/**
 * Fixed v4 UUID recorded as the audit actor for system-initiated billing
 * transitions (the overdue sweep has no human actor). Mirrors
 * RETENTION_SYSTEM_ACTOR; distinct so billing actions are attributable.
 */
export const BILLING_SYSTEM_ACTOR = '00000000-0000-4000-8000-0000000000b1';

export function registerDentalBillingJobs(scheduler: JobScheduler): void {
  // Daily at 02:00 UTC, offset from audit (~03:00) and retention (03:30).
  scheduler.registerCron('dental-billing.status-sweep', '0 2 * * *', async (context: JobContext) => {
    const { db, logger, jobId } = context;
    try {
      const { DentalInvoiceRepository } = await import('../repos/dental-invoice.repo');
      const { DentalPaymentPlanRepository } = await import('../repos/dental-payment-plan.repo');
      const { getBranchOrgId } = await import('@/handlers/dental-org/repos/org-billing.facade');

      const invoiceRepo = new DentalInvoiceRepository(db);
      const planRepo = new DentalPaymentPlanRepository(db, logger);

      const overdue = await invoiceRepo.markOverdueInvoices();

      // BR-049: audit each transition (actor = system). Resolve org per branch
      // once (cache) so a sweep across many invoices stays at one lookup/branch.
      const orgByBranch = new Map<string, string>();
      for (const inv of overdue) {
        let tenantId = orgByBranch.get(inv.branchId);
        if (tenantId === undefined) {
          tenantId = (await getBranchOrgId(db, inv.branchId))?.organizationId ?? inv.branchId;
          orgByBranch.set(inv.branchId, tenantId);
        }
        await logAuditEvent(db, logger, {
          personId: BILLING_SYSTEM_ACTOR,
          tenantId,
          branchId: inv.branchId,
          action: 'invoice.overdue',
          resourceType: 'dental_invoice',
          resourceId: inv.id,
        });
      }

      const plansChanged = await planRepo.reevaluateActivePlanStatuses();

      // BR-050: after the overdue flip, fire dunning reminders for overdue invoices.
      const { runDunningSweep } = await import('./dunning');
      const { remindersSent } = await runDunningSweep(db, logger);

      logger.info(
        { jobId, overdueCount: overdue.length, plansChanged, remindersSent },
        'dental-billing status sweep completed',
      );
    } catch (error) {
      logger.error({ error, jobId }, 'dental-billing status sweep failed');
      throw error;
    }
  });
}
