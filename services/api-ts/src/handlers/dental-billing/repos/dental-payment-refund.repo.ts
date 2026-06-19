/**
 * DentalPaymentRefundRepository — payment refunds (BR-053). Append-only.
 */

import { eq, sql } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import {
  dentalPaymentRefunds,
  type DentalPaymentRefund,
  type NewDentalPaymentRefund,
} from './dental-payment-refund.schema';

export class DentalPaymentRefundRepository {
  constructor(private readonly db: DatabaseInstance) {}

  async create(input: NewDentalPaymentRefund): Promise<DentalPaymentRefund> {
    const [row] = await this.db.insert(dentalPaymentRefunds).values(input).returning();
    return row!;
  }

  async listByPayment(paymentId: string): Promise<DentalPaymentRefund[]> {
    return this.db
      .select()
      .from(dentalPaymentRefunds)
      .where(eq(dentalPaymentRefunds.paymentId, paymentId));
  }

  /** Total already refunded against a payment (caps a follow-up partial refund). */
  async totalRefundedForPayment(paymentId: string): Promise<number> {
    const [row] = await this.db
      .select({ total: sql<number>`COALESCE(SUM(${dentalPaymentRefunds.amountCents}), 0)` })
      .from(dentalPaymentRefunds)
      .where(eq(dentalPaymentRefunds.paymentId, paymentId));
    return Number(row?.total ?? 0);
  }
}
