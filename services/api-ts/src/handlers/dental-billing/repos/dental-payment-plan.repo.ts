/**
 * DentalPaymentPlanRepository — data access for payment plans and installments
 *
 * Plans split invoice balances into periodic installments.
 * Status lifecycle: on_track -> behind | completed | defaulted
 * Terminal states (completed, defaulted) reject all further transitions.
 * Auto-generates installment records based on frequency/count/startDate.
 */

import { eq, and, inArray } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import type { Logger } from '@/types/logger';
import { BusinessLogicError } from '@/core/errors';
import { setPatientActivePaymentPlanFlag } from '@/handlers/patient/repos/patient-dental-patient.facade';
import {
  dentalPaymentPlans,
  dentalPaymentPlanInstallments,
  type DentalPaymentPlan,
  type NewDentalPaymentPlan,
  type DentalPaymentPlanInstallment,
  type NewDentalPaymentPlanInstallment,
} from './dental-payment-plan.schema';

/** Plan statuses that count as "active" for the patient archive guard (FIX-006). */
const ACTIVE_PLAN_STATUSES: ReadonlyArray<DentalPaymentPlan['status']> = ['on_track', 'behind'];

/**
 * FSM: allowed transitions for each payment plan status.
 * Terminal states (completed, defaulted) have no outgoing edges.
 */
export const PAYMENT_PLAN_TRANSITIONS: Record<DentalPaymentPlan['status'], DentalPaymentPlan['status'][]> = {
  on_track:  ['behind', 'completed', 'defaulted'],
  behind:    ['on_track', 'completed', 'defaulted'],
  completed: [],
  defaulted: [],
};

/**
 * Compute the next due date from a start date given a frequency.
 */
function addFrequency(date: Date, frequency: string, count: number): Date {
  const result = new Date(date);
  switch (frequency) {
    case 'weekly':
      result.setDate(result.getDate() + 7 * count);
      break;
    case 'biweekly':
      result.setDate(result.getDate() + 14 * count);
      break;
    case 'monthly':
      result.setMonth(result.getMonth() + count);
      break;
  }
  return result;
}

export class DentalPaymentPlanRepository {
  constructor(private db: DatabaseInstance, private logger?: Logger) {}

  /**
   * Create a plan and auto-generate installment records.
   * Distributes totalCents across installments; remainder goes to the last installment.
   */
  async createWithInstallments(data: NewDentalPaymentPlan): Promise<{
    plan: DentalPaymentPlan;
    installments: DentalPaymentPlanInstallment[];
  }> {
    // V-BIL-002: defense in depth — never divide by an out-of-range installment
    // count (0 → Infinity). The handler is the primary guard (422); this guards
    // any other caller.
    const n = data.numberOfInstallments;
    if (!Number.isInteger(n) || n < 2 || n > 24) {
      throw new Error(`Invalid numberOfInstallments: ${n} (must be an integer 2–24)`);
    }

    // Create the plan
    const [plan] = await this.db
      .insert(dentalPaymentPlans)
      .values(data)
      .returning();

    const baseAmount = Math.floor(data.totalCents / n);
    const remainder = data.totalCents - baseAmount * n;

    // Generate installment records
    const installmentValues: NewDentalPaymentPlanInstallment[] = [];
    for (let i = 0; i < n; i++) {
      const isLast = i === n - 1;
      installmentValues.push({
        planId: plan!.id,
        installmentNumber: i + 1,
        dueDate: addFrequency(new Date(data.startDate), data.frequency, i),
        amountCents: isLast ? baseAmount + remainder : baseAmount,
        paidCents: 0,
        status: 'pending',
      });
    }

    const installments = await this.db
      .insert(dentalPaymentPlanInstallments)
      .values(installmentValues)
      .returning();

    // FIX-006: a newly created plan is active → maintain the patient archive flag.
    await this.syncPatientActivePaymentPlanFlag(plan!.patientId);

    return { plan: plan!, installments };
  }

  async findOneById(id: string): Promise<DentalPaymentPlan | null> {
    const [row] = await this.db
      .select()
      .from(dentalPaymentPlans)
      .where(eq(dentalPaymentPlans.id, id));
    return row ?? null;
  }

  async findByInvoice(invoiceId: string): Promise<DentalPaymentPlan | null> {
    const [row] = await this.db
      .select()
      .from(dentalPaymentPlans)
      .where(eq(dentalPaymentPlans.invoiceId, invoiceId));
    return row ?? null;
  }

  async findByPatient(patientId: string): Promise<DentalPaymentPlan[]> {
    return this.db
      .select()
      .from(dentalPaymentPlans)
      .where(eq(dentalPaymentPlans.patientId, patientId));
  }

  /**
   * FIX-006: recompute patients.hasActivePaymentPlan from the patient's plans and
   * persist it via the patient facade. The flag is true iff the patient holds ≥1
   * plan in an active state (on_track | behind); a patient may hold plans across
   * multiple invoices, so the clear is GUARDED by the remaining-active check (never
   * clear while another plan is still active). Called after EVERY plan mutation
   * (create + status change) from a single choke point so the EC1 archive guard
   * (patient.repo.ts) reflects reality. The cross-module write goes through the
   * facade (a billing repo must not touch the patients table directly).
   */
  private async syncPatientActivePaymentPlanFlag(patientId: string): Promise<void> {
    const plans = await this.findByPatient(patientId);
    const hasActive = plans.some((p) => ACTIVE_PLAN_STATUSES.includes(p.status));
    await setPatientActivePaymentPlanFlag(this.db, patientId, hasActive);
  }

  async findInstallmentsByPlan(planId: string): Promise<DentalPaymentPlanInstallment[]> {
    return this.db
      .select()
      .from(dentalPaymentPlanInstallments)
      .where(eq(dentalPaymentPlanInstallments.planId, planId));
  }

  /**
   * Record payment on a specific installment.
   */
  async recordInstallmentPayment(
    installmentId: string,
    paymentId: string,
    amountCents: number,
    paidDate: Date,
  ): Promise<DentalPaymentPlanInstallment | null> {
    const [updated] = await this.db
      .update(dentalPaymentPlanInstallments)
      .set({
        paidCents: amountCents,
        paidDate,
        paymentId,
        status: 'paid',
        updatedAt: new Date(),
      })
      .where(eq(dentalPaymentPlanInstallments.id, installmentId))
      .returning();
    return updated ?? null;
  }

  /**
   * Directly set plan status, enforcing FSM transition rules.
   * Throws BusinessLogicError (422) for invalid transitions.
   */
  async setStatus(
    planId: string,
    newStatus: DentalPaymentPlan['status'],
  ): Promise<DentalPaymentPlan> {
    const plan = await this.findOneById(planId);
    if (!plan) throw new Error(`Payment plan ${planId} not found`);

    const allowed = PAYMENT_PLAN_TRANSITIONS[plan.status];
    if (!allowed.includes(newStatus)) {
      throw new BusinessLogicError(
        `Cannot transition payment plan from '${plan.status}' to '${newStatus}'`,
        'INVALID_TRANSITION',
      );
    }

    const [updated] = await this.db
      .update(dentalPaymentPlans)
      .set({ status: newStatus, updatedAt: new Date() })
      .where(eq(dentalPaymentPlans.id, planId))
      .returning();
    // FIX-006: a terminal transition (completed|defaulted) may release the patient's
    // last active plan → recompute the archive flag (guarded by other active plans).
    await this.syncPatientActivePaymentPlanFlag(updated!.patientId);
    return updated!;
  }

  /**
   * Re-evaluate plan status based on installments.
   * - all paid -> completed
   * - any overdue > 90 days -> defaulted
   * - any overdue > 7 days -> behind
   */
  async updatePlanStatus(planId: string): Promise<DentalPaymentPlan | null> {
    const installments = await this.findInstallmentsByPlan(planId);
    if (installments.length === 0) return null;

    const now = new Date();
    const allPaid = installments.every(i => i.status === 'paid');
    const overdue7 = installments.some(
      i => i.status !== 'paid' && (now.getTime() - new Date(i.dueDate).getTime()) > 7 * 24 * 60 * 60 * 1000,
    );
    const overdue90 = installments.some(
      i => i.status !== 'paid' && (now.getTime() - new Date(i.dueDate).getTime()) > 90 * 24 * 60 * 60 * 1000,
    );

    let newStatus: DentalPaymentPlan['status'] = 'on_track';
    if (allPaid) {
      newStatus = 'completed';
    } else if (overdue90) {
      newStatus = 'defaulted';
    } else if (overdue7) {
      newStatus = 'behind';
    }

    const [updated] = await this.db
      .update(dentalPaymentPlans)
      .set({
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(dentalPaymentPlans.id, planId))
      .returning();
    // FIX-006: the FR4.3 sweep / re-eval can drive a plan to terminal (completed|
    // defaulted) → recompute the patient's archive flag from a single choke point.
    if (updated) await this.syncPatientActivePaymentPlanFlag(updated.patientId);
    return updated ?? null;
  }

  /**
   * FR4.3 daily sweep: re-evaluate every non-terminal plan (on_track | behind)
   * against its installments via {@link updatePlanStatus}. Terminal plans
   * (completed | defaulted) are skipped. Returns the number of plans whose
   * status actually changed. This is the missing caller that makes the
   * "Behind" automation real; the per-plan logic is already covered.
   */
  async reevaluateActivePlanStatuses(): Promise<number> {
    const active = await this.db
      .select({ id: dentalPaymentPlans.id, status: dentalPaymentPlans.status })
      .from(dentalPaymentPlans)
      .where(inArray(dentalPaymentPlans.status, ['on_track', 'behind']));

    let changed = 0;
    for (const plan of active) {
      const updated = await this.updatePlanStatus(plan.id);
      if (updated && updated.status !== plan.status) changed++;
    }
    return changed;
  }
}
