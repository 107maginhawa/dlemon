/**
 * Dental Billing background jobs (AHA FIX-001/002).
 *
 * Registers the daily status sweep that makes two already-implemented,
 * already-tested repo transitions actually fire in production:
 *   - FR4.1b: issued/partial invoices past their due date → `overdue`
 *     (so the billing-list "overdue" filter + FR4.8 badges populate).
 *   - FR4.3: active payment plans with a 7+-day-overdue installment → `behind`.
 *
 * Both were dead before this registration (0 production callers). Uses the
 * existing platform scheduler (`core/jobs.ts`) — no new infrastructure.
 */

import type { JobScheduler, JobContext } from '@/core/jobs';

export function registerDentalBillingJobs(scheduler: JobScheduler): void {
  // Daily at 02:00 UTC, offset from audit (~03:00) and retention (03:30).
  scheduler.registerCron('dental-billing.status-sweep', '0 2 * * *', async (context: JobContext) => {
    const { db, logger, jobId } = context;
    try {
      const { DentalInvoiceRepository } = await import('../repos/dental-invoice.repo');
      const { DentalPaymentPlanRepository } = await import('../repos/dental-payment-plan.repo');

      const invoiceRepo = new DentalInvoiceRepository(db);
      const planRepo = new DentalPaymentPlanRepository(db, logger);

      const overdueCount = await invoiceRepo.markOverdueInvoices();
      const plansChanged = await planRepo.reevaluateActivePlanStatuses();

      logger.info(
        { jobId, overdueCount, plansChanged },
        'dental-billing status sweep completed',
      );
    } catch (error) {
      logger.error({ error, jobId }, 'dental-billing status sweep failed');
      throw error;
    }
  });
}
