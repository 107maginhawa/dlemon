/**
 * DentalInvoiceRepository — data access for dental invoices and line items
 *
 * Invoice lifecycle: draft -> issued -> partial -> paid | overdue | voided
 * Handles invoice number generation, payment tracking, and discount application.
 */

import { eq, and, sql, lte, inArray } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import {
  dentalInvoices,
  dentalInvoiceLineItems,
  type DentalInvoice,
  type NewDentalInvoice,
  type DentalInvoiceLineItem,
  type NewDentalInvoiceLineItem,
} from './dental-invoice.schema';
import { applyDiscountRate, applyTaxRate } from '../utils/rounding';

export interface InvoiceFilters {
  patientId?: string;
  branchId?: string;
  status?: DentalInvoice['status'];
}

export class DentalInvoiceRepository {
  constructor(private db: DatabaseInstance, private logger?: any) {}

  /**
   * Generate a sequential invoice number: INV-{year}-{padded 4-digit sequence}
   * Uses MAX to find the highest existing sequence (not COUNT, which is vulnerable
   * to gaps from deleted invoices producing duplicates under concurrency).
   */
  async generateInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `INV-${year}-`;

    // Find the highest existing sequence number for this year
    const result = await this.db
      .select({ maxNum: sql<string>`MAX(${dentalInvoices.invoiceNumber})` })
      .from(dentalInvoices)
      .where(sql`${dentalInvoices.invoiceNumber} LIKE ${prefix + '%'}`);

    let nextSeq = 1;
    const maxNum = result?.[0]?.maxNum;
    if (maxNum) {
      const seqStr = maxNum.replace(prefix, '');
      const parsed = parseInt(seqStr, 10);
      if (!isNaN(parsed)) nextSeq = parsed + 1;
    }

    const sequence = nextSeq.toString().padStart(4, '0');
    return `${prefix}${sequence}`;
  }

  async createOne(data: NewDentalInvoice): Promise<DentalInvoice> {
    const [row] = await this.db
      .insert(dentalInvoices)
      .values(data)
      .returning();
    return row!;
  }

  async createLineItem(data: NewDentalInvoiceLineItem): Promise<DentalInvoiceLineItem> {
    const [row] = await this.db
      .insert(dentalInvoiceLineItems)
      .values(data)
      .returning();
    return row!;
  }

  async createLineItems(items: NewDentalInvoiceLineItem[]): Promise<DentalInvoiceLineItem[]> {
    if (items.length === 0) return [];
    return await this.db
      .insert(dentalInvoiceLineItems)
      .values(items)
      .returning();
  }

  async findOneById(id: string): Promise<DentalInvoice | null> {
    const [row] = await this.db
      .select()
      .from(dentalInvoices)
      .where(eq(dentalInvoices.id, id));
    return row ?? null;
  }

  async findWithLineItems(invoiceId: string): Promise<{ invoice: DentalInvoice; lineItems: DentalInvoiceLineItem[] } | null> {
    const invoice = await this.findOneById(invoiceId);
    if (!invoice) return null;

    const lineItems = await this.db
      .select()
      .from(dentalInvoiceLineItems)
      .where(eq(dentalInvoiceLineItems.invoiceId, invoiceId));

    return { invoice, lineItems };
  }

  async findMany(filters?: InvoiceFilters): Promise<DentalInvoice[]> {
    const conditions = [];
    if (filters?.patientId) conditions.push(eq(dentalInvoices.patientId, filters.patientId));
    if (filters?.branchId) conditions.push(eq(dentalInvoices.branchId, filters.branchId));
    if (filters?.status) conditions.push(eq(dentalInvoices.status, filters.status));

    return conditions.length > 0
      ? await this.db.select().from(dentalInvoices).where(and(...conditions))
      : await this.db.select().from(dentalInvoices);
  }

  /**
   * Issue an invoice: draft -> issued, set issuedAt
   */
  async issue(invoiceId: string): Promise<DentalInvoice | null> {
    const [updated] = await this.db
      .update(dentalInvoices)
      .set({
        status: 'issued',
        issuedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(dentalInvoices.id, invoiceId), eq(dentalInvoices.status, 'draft')))
      .returning();
    return updated ?? null;
  }

  /**
   * Void an invoice: set status=voided and voidedAt
   */
  async voidInvoice(invoiceId: string): Promise<DentalInvoice | null> {
    const [updated] = await this.db
      .update(dentalInvoices)
      .set({
        status: 'voided',
        voidedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(dentalInvoices.id, invoiceId))
      .returning();
    return updated ?? null;
  }

  /**
   * Add a payment amount to the invoice using atomic SQL arithmetic.
   * Prevents concurrent payment race conditions by computing new totals in the DB.
   */
  async addPayment(invoiceId: string, amountCents: number): Promise<DentalInvoice | null> {
    const [updated] = await this.db
      .update(dentalInvoices)
      .set({
        paidCents: sql`${dentalInvoices.paidCents} + ${amountCents}`,
        balanceCents: sql`GREATEST(0, ${dentalInvoices.totalCents} - (${dentalInvoices.paidCents} + ${amountCents}))`,
        status: sql`CASE
          WHEN ${dentalInvoices.totalCents} - (${dentalInvoices.paidCents} + ${amountCents}) <= 0 THEN 'paid'
          WHEN ${dentalInvoices.paidCents} + ${amountCents} > 0 THEN 'partial'
          ELSE ${dentalInvoices.status}
        END`,
        paidAt: sql`CASE
          WHEN ${dentalInvoices.totalCents} - (${dentalInvoices.paidCents} + ${amountCents}) <= 0 THEN NOW()
          ELSE ${dentalInvoices.paidAt}
        END`,
        updatedAt: new Date(),
      } as any)
      .where(eq(dentalInvoices.id, invoiceId))
      .returning();
    return updated ?? null;
  }

  /**
   * Remove a payment amount from the invoice (used when voiding a payment).
   * Uses atomic SQL arithmetic to prevent concurrent void race conditions.
   */
  async removePayment(invoiceId: string, amountCents: number): Promise<DentalInvoice | null> {
    const [updated] = await this.db
      .update(dentalInvoices)
      .set({
        paidCents: sql`GREATEST(0, ${dentalInvoices.paidCents} - ${amountCents})`,
        balanceCents: sql`${dentalInvoices.totalCents} - GREATEST(0, ${dentalInvoices.paidCents} - ${amountCents})`,
        status: sql`CASE
          WHEN GREATEST(0, ${dentalInvoices.paidCents} - ${amountCents}) = 0
            THEN CASE WHEN ${dentalInvoices.issuedAt} IS NOT NULL THEN 'issued' ELSE 'draft' END
          WHEN ${dentalInvoices.totalCents} - GREATEST(0, ${dentalInvoices.paidCents} - ${amountCents}) > 0
            THEN 'partial'
          ELSE ${dentalInvoices.status}
        END`,
        paidAt: sql`NULL`,
        updatedAt: new Date(),
      } as any)
      .where(eq(dentalInvoices.id, invoiceId))
      .returning();
    return updated ?? null;
  }

  /**
   * Apply a discount to an invoice. Recalculates totalCents and balanceCents.
   */
  async applyDiscount(invoiceId: string, discountCents: number, taxRate: number): Promise<DentalInvoice | null> {
    const invoice = await this.findOneById(invoiceId);
    if (!invoice) return null;

    const afterDiscount = invoice.subtotalCents - discountCents;
    const taxCents = applyTaxRate(afterDiscount, taxRate);
    const totalCents = afterDiscount + taxCents;
    const balanceCents = totalCents - invoice.paidCents;

    const [updated] = await this.db
      .update(dentalInvoices)
      .set({
        discountCents,
        taxCents,
        totalCents,
        balanceCents: Math.max(0, balanceCents),
        updatedAt: new Date(),
      })
      .where(eq(dentalInvoices.id, invoiceId))
      .returning();
    return updated ?? null;
  }

  /**
   * Recalculate totals from subtotal, discount, and tax rate.
   */
  async recalculate(invoiceId: string): Promise<DentalInvoice | null> {
    const invoice = await this.findOneById(invoiceId);
    if (!invoice) return null;

    const afterDiscount = invoice.subtotalCents - invoice.discountCents;
    const taxRate = Number(invoice.taxRate);
    const taxCents = applyTaxRate(afterDiscount, taxRate);
    const totalCents = afterDiscount + taxCents;
    const balanceCents = totalCents - invoice.paidCents;

    const [updated] = await this.db
      .update(dentalInvoices)
      .set({
        taxCents,
        totalCents,
        balanceCents: Math.max(0, balanceCents),
        updatedAt: new Date(),
      })
      .where(eq(dentalInvoices.id, invoiceId))
      .returning();
    return updated ?? null;
  }

  /**
   * FR4.1b: Mark issued/partial invoices past their due date as overdue.
   * Returns the count of invoices transitioned to overdue.
   */
  async markOverdueInvoices(asOf: Date = new Date()): Promise<number> {
    const result = await this.db
      .update(dentalInvoices)
      .set({ status: 'overdue', updatedAt: new Date() })
      .where(
        and(
          inArray(dentalInvoices.status, ['issued', 'partial']),
          lte(dentalInvoices.dueDate, asOf),
        )
      )
      .returning({ id: dentalInvoices.id });
    return result.length;
  }

  /**
   * Update subtotal from line items sum
   */
  async updateSubtotal(invoiceId: string, subtotalCents: number): Promise<DentalInvoice | null> {
    const [updated] = await this.db
      .update(dentalInvoices)
      .set({
        subtotalCents,
        updatedAt: new Date(),
      })
      .where(eq(dentalInvoices.id, invoiceId))
      .returning();
    return updated ?? null;
  }
}
