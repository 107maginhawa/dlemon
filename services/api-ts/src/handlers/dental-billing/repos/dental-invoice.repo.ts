/**
 * DentalInvoiceRepository — data access for dental invoices and line items
 *
 * Invoice lifecycle: draft -> issued -> partial -> paid | overdue | voided
 * Handles invoice number generation, payment tracking, and discount application.
 */

import { randomUUID } from 'node:crypto';
import { eq, and, sql, lte, inArray } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import type { Logger } from '@/types/logger';
import {
  dentalInvoices,
  dentalInvoiceLineItems,
  type DentalInvoice,
  type NewDentalInvoice,
  type DentalInvoiceLineItem,
  type NewDentalInvoiceLineItem,
} from './dental-invoice.schema';
import { applyDiscountRate, applyTaxRate } from '../utils/rounding';
import { dueDateFromTerms } from '../utils/payment-terms';

export interface InvoiceFilters {
  patientId?: string;
  branchId?: string;
  status?: DentalInvoice['status'];
}

export class DentalInvoiceRepository {
  constructor(private db: DatabaseInstance, private logger?: Logger) {}

  /**
   * Generate an invoice number: INV-{year}-{8-char UUID slice}.
   * EM-BILL-006: Previous implementation used a MAX(invoice_number) read-then-write
   * pattern that races under concurrent invoice creation — two parallel callers
   * could compute the same next sequence. UUID-based generation is collision-safe
   * without DB-level locking. Format changed from INV-YYYY-0001 to INV-YYYY-ABCD1234.
   */
  async generateInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const id = randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
    return `INV-${year}-${id}`;
  }

  async createOne(data: NewDentalInvoice): Promise<DentalInvoice> {
    const [row] = await this.db
      .insert(dentalInvoices)
      .values(data)
      .returning();
    return row!;
  }

  /**
   * SL-01 / E-NEW-05: offline-replay idempotency. Find a prior create by its
   * client-generated localId, scoped to the branch. The handler returns the
   * existing invoice on replay (before the already-billed guard would otherwise
   * reject it); a partial unique index on (branch_id, local_id) backstops a
   * concurrent-retry race.
   */
  async findByLocalId(branchId: string, localId: string): Promise<DentalInvoice | null> {
    const [row] = await this.db
      .select()
      .from(dentalInvoices)
      .where(and(eq(dentalInvoices.branchId, branchId), eq(dentalInvoices.localId, localId)));
    return row ?? null;
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

  /** BR-048: the distinct, non-null CDT codes on an invoice's line items —
   *  used to look up per-procedure payment terms at issue. */
  async getLineItemCdtCodes(invoiceId: string): Promise<string[]> {
    const rows = await this.db
      .select({ cdtCode: dentalInvoiceLineItems.cdtCode })
      .from(dentalInvoiceLineItems)
      .where(eq(dentalInvoiceLineItems.invoiceId, invoiceId));
    return [...new Set(rows.map((r) => r.cdtCode).filter((c): c is string => c != null))];
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
   * Issue an invoice: draft -> issued, set issuedAt.
   *
   * BR-048: when `termsDays` is supplied (the handler resolved it because the
   * invoice carried no caller-supplied dueDate), dueDate = issuedAt + termsDays.
   * A null/omitted termsDays leaves dueDate untouched (caller-supplied wins).
   */
  async issue(invoiceId: string, opts?: { termsDays?: number | null }): Promise<DentalInvoice | null> {
    const issuedAt = new Date();
    const [updated] = await this.db
      .update(dentalInvoices)
      .set({
        status: 'issued',
        issuedAt,
        updatedAt: issuedAt,
        ...(opts?.termsDays != null && { dueDate: dueDateFromTerms(issuedAt, opts.termsDays) }),
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
   * BR-013: write off an invoice — set status=uncollectible and uncollectibleAt.
   * Terminal state; the handler guards the allowed source statuses.
   */
  async markUncollectible(invoiceId: string): Promise<DentalInvoice | null> {
    const [updated] = await this.db
      .update(dentalInvoices)
      .set({
        status: 'uncollectible',
        uncollectibleAt: new Date(),
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Drizzle cannot type sql<> literals mixed with column values in set()
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
            THEN CASE WHEN ${dentalInvoices.issuedAt} IS NOT NULL THEN 'issued'::dental_invoice_status ELSE 'draft'::dental_invoice_status END
          WHEN ${dentalInvoices.totalCents} - GREATEST(0, ${dentalInvoices.paidCents} - ${amountCents}) > 0
            THEN 'partial'::dental_invoice_status
          ELSE ${dentalInvoices.status}
        END`,
        paidAt: null,
        updatedAt: new Date(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Drizzle cannot type sql<> literals mixed with column values in set()
      } as any)
      .where(eq(dentalInvoices.id, invoiceId))
      .returning();
    return updated ?? null;
  }

  /**
   * Apply a discount to an invoice. Recalculates totalCents and balanceCents.
   */
  async applyDiscount(invoiceId: string, discountCents: number, taxRate: number, discountReason: string, discountedBy: string): Promise<DentalInvoice | null> {
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
        discountReason,
        discountedBy,
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
