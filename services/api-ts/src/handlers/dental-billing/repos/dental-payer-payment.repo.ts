/**
 * DentalPayerPaymentRepository — remittance postings (P1-26).
 */

import { eq, and, desc } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import type { Logger } from '@/types/logger';
import {
  dentalPayerPayments,
  type DentalPayerPayment,
  type NewDentalPayerPayment,
} from './dental-payer-payment.schema';

export class DentalPayerPaymentRepository {
  constructor(private db: DatabaseInstance, private logger?: Logger) {}

  async createOne(data: NewDentalPayerPayment): Promise<DentalPayerPayment> {
    const [row] = await this.db.insert(dentalPayerPayments).values(data).returning();
    return row!;
  }

  async findByClaimId(claimId: string): Promise<DentalPayerPayment[]> {
    return this.db
      .select()
      .from(dentalPayerPayments)
      .where(eq(dentalPayerPayments.claimId, claimId))
      .orderBy(desc(dentalPayerPayments.createdAt));
  }

  /** Idempotency lookup: a remittance reference is unique per claim. */
  async findByClaimAndReference(
    claimId: string,
    remittanceReference: string,
  ): Promise<DentalPayerPayment | null> {
    const [row] = await this.db
      .select()
      .from(dentalPayerPayments)
      .where(and(
        eq(dentalPayerPayments.claimId, claimId),
        eq(dentalPayerPayments.remittanceReference, remittanceReference),
      ))
      .limit(1);
    return row ?? null;
  }
}
