/**
 * DentalPaymentRepository — data access for dental payments
 *
 * Tracks cash/card/bank payments against invoices.
 * Void is a soft-delete: isVoid=true with reason and timestamp preserved.
 */

import { eq, and } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import {
  dentalPayments,
  type DentalPayment,
  type NewDentalPayment,
} from './dental-payment.schema';

export class DentalPaymentRepository {
  constructor(private db: DatabaseInstance, private logger?: any) {}

  async createOne(data: NewDentalPayment): Promise<DentalPayment> {
    const [row] = await this.db
      .insert(dentalPayments)
      .values(data)
      .returning();
    return row!;
  }

  async findByReceiptNumber(receiptNumber: string): Promise<DentalPayment | null> {
    const [row] = await this.db
      .select()
      .from(dentalPayments)
      .where(eq(dentalPayments.receiptNumber, receiptNumber));
    return row ?? null;
  }

  /**
   * Find a payment by receipt number scoped to a single invoice.
   *
   * N-BIL-01: idempotency replay MUST be scoped to the current invoice.
   * `receiptNumber` carries a GLOBAL unique index, so a bare
   * `findByReceiptNumber` lookup can surface a payment belonging to a
   * different invoice/patient — never use it as the idempotency key.
   */
  async findByInvoiceAndReceiptNumber(
    invoiceId: string,
    receiptNumber: string,
  ): Promise<DentalPayment | null> {
    const [row] = await this.db
      .select()
      .from(dentalPayments)
      .where(and(
        eq(dentalPayments.invoiceId, invoiceId),
        eq(dentalPayments.receiptNumber, receiptNumber),
      ));
    return row ?? null;
  }

  async findOneById(id: string): Promise<DentalPayment | null> {
    const [row] = await this.db
      .select()
      .from(dentalPayments)
      .where(eq(dentalPayments.id, id));
    return row ?? null;
  }

  /**
   * Find non-voided payments for an invoice
   */
  async findByInvoice(invoiceId: string): Promise<DentalPayment[]> {
    return this.db
      .select()
      .from(dentalPayments)
      .where(and(
        eq(dentalPayments.invoiceId, invoiceId),
        eq(dentalPayments.isVoid, false),
      ));
  }

  /**
   * Find all payments for an invoice including voided ones
   */
  async findAllByInvoice(invoiceId: string): Promise<DentalPayment[]> {
    return this.db
      .select()
      .from(dentalPayments)
      .where(eq(dentalPayments.invoiceId, invoiceId));
  }

  /**
   * Void a payment: soft-delete with reason and timestamp
   */
  async voidPayment(paymentId: string, voidReason: string, voidedByMemberId: string): Promise<DentalPayment | null> {
    const [updated] = await this.db
      .update(dentalPayments)
      .set({
        isVoid: true,
        voidedAt: new Date(),
        voidReason,
        voidedByMemberId,
        updatedAt: new Date(),
      })
      .where(eq(dentalPayments.id, paymentId))
      .returning();
    return updated ?? null;
  }
}
