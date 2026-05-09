/**
 * DentalPaymentPlanRepository — data access for payment plans and installments
 *
 * Plans split invoice balances into periodic installments.
 * Status lifecycle: onTrack -> behind | completed | defaulted
 * Auto-generates installment records based on frequency/count/startDate.
 */

import { eq, and } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import {
  dentalPaymentPlans,
  dentalPaymentPlanInstallments,
  type DentalPaymentPlan,
  type NewDentalPaymentPlan,
  type DentalPaymentPlanInstallment,
  type NewDentalPaymentPlanInstallment,
} from './dental-payment-plan.schema';

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
  constructor(private db: DatabaseInstance, private logger?: any) {}

  /**
   * Create a plan and auto-generate installment records.
   * Distributes totalCents across installments; remainder goes to the last installment.
   */
  async createWithInstallments(data: NewDentalPaymentPlan): Promise<{
    plan: DentalPaymentPlan;
    installments: DentalPaymentPlanInstallment[];
  }> {
    // Create the plan
    const [plan] = await this.db
      .insert(dentalPaymentPlans)
      .values(data)
      .returning();

    const n = data.numberOfInstallments;
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

    let newStatus: DentalPaymentPlan['status'] = 'onTrack';
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
    return updated ?? null;
  }
}
