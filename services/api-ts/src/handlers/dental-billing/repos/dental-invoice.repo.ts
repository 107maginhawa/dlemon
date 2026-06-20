/**
 * DentalInvoiceRepository — data access for dental invoices and line items
 *
 * Invoice lifecycle: draft -> issued -> partial -> paid | overdue | voided
 * Handles invoice number generation, payment tracking, and discount application.
 */

import { randomUUID } from 'node:crypto';
import { eq, and, ne, sql, lte, gt, inArray, desc } from 'drizzle-orm';
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
import { applyTaxRate } from '../utils/rounding';
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

    // Newest-first: the billing list paginates (default limit 25) with no client
    // sort, so without a deterministic order the most-recent invoice could fall off
    // page 1 and pagination would be unstable run-to-run. Matches the per-patient
    // facade's `desc(createdAt)` convention.
    return conditions.length > 0
      ? await this.db
          .select()
          .from(dentalInvoices)
          .where(and(...conditions))
          .orderBy(desc(dentalInvoices.createdAt))
      : await this.db.select().from(dentalInvoices).orderBy(desc(dentalInvoices.createdAt));
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
   * Void an invoice: set status=voided and voidedAt.
   *
   * The `status <> 'voided'` predicate makes the void idempotent under concurrency: two
   * simultaneous voids both pass the handler's pre-tx check, but the second UPDATE
   * re-evaluates against the first's committed row (already voided) → 0 rows → null, and
   * the caller rejects ALREADY_VOIDED instead of writing a second void + audit row.
   */
  async voidInvoice(invoiceId: string): Promise<DentalInvoice | null> {
    const [updated] = await this.db
      .update(dentalInvoices)
      .set({
        status: 'voided',
        voidedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(dentalInvoices.id, invoiceId), ne(dentalInvoices.status, 'voided')))
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
   *
   * The arithmetic is race-safe (paid/balance computed in the DB), but the
   * OVERPAYMENT guard (amount <= balance) lives in the handler against a value
   * read BEFORE the tx — so two concurrent payments each <= balance but summing >
   * balance both pass it and overpay (paid > total). With `guardBalance`, the
   * UPDATE only applies when `balance_cents >= amount` AT WRITE TIME: under READ
   * COMMITTED the losing concurrent write re-reads the committed row, sees the
   * reduced balance, matches 0 rows, and returns null — the caller then rejects it
   * (PAYMENT_EXCEEDS_BALANCE). Opt-in so the claim-remittance / credit-application
   * callers (which clamp their own amounts) keep the unconditional behavior.
   */
  async addPayment(
    invoiceId: string,
    amountCents: number,
    opts?: { guardBalance?: boolean; guardStatus?: boolean },
  ): Promise<DentalInvoice | null> {
    // guardStatus re-checks status at WRITE time (mirrors guardBalance): a payment that
    // read status='issued' before a concurrent void committed must not land on (and
    // un-void) the now-voided/paid row — the predicate makes it match 0 rows → null →
    // caller rejects (INVOICE_IMMUTABLE). Opt-in so the claim-remittance / credit callers
    // (which serialize/clamp themselves) keep the unconditional behavior.
    const conds = [eq(dentalInvoices.id, invoiceId)];
    if (opts?.guardBalance) conds.push(sql`${dentalInvoices.balanceCents} >= ${amountCents}`);
    if (opts?.guardStatus) conds.push(sql`${dentalInvoices.status} NOT IN ('voided', 'paid')`);
    const where = and(...conds);
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
      .where(where)
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
   *
   * totalCents/taxCents derive only from subtotalCents (which a concurrent payment
   * never touches) so they are safe to compute in JS. balanceCents and the paid-status
   * flip, however, depend on paidCents — which a concurrent recordDentalPayment can
   * change between this read and the UPDATE. Computing them in SQL from the LIVE
   * paid_cents column (mirrors addPayment/removePayment) makes the UPDATE re-read the
   * committed payment at write time, so a payment that lands mid-discount is never lost
   * from the balance (no phantom debt). A bare JS `totalCents - invoice.paidCents` would
   * write a stale constant and resurrect already-paid debt.
   */
  async applyDiscount(invoiceId: string, discountCents: number, taxRate: number, discountReason: string, discountedBy: string): Promise<DentalInvoice | null> {
    const invoice = await this.findOneById(invoiceId);
    if (!invoice) return null;

    const afterDiscount = invoice.subtotalCents - discountCents;
    const taxCents = applyTaxRate(afterDiscount, taxRate);
    const totalCents = afterDiscount + taxCents;

    const [updated] = await this.db
      .update(dentalInvoices)
      .set({
        discountCents,
        discountReason,
        discountedBy,
        taxCents,
        totalCents,
        balanceCents: sql`GREATEST(0, ${totalCents} - ${dentalInvoices.paidCents})`,
        status: sql`CASE
          WHEN ${totalCents} - ${dentalInvoices.paidCents} <= 0 AND ${dentalInvoices.paidCents} > 0 THEN 'paid'
          ELSE ${dentalInvoices.status}
        END`,
        paidAt: sql`CASE
          WHEN ${totalCents} - ${dentalInvoices.paidCents} <= 0 AND ${dentalInvoices.paidCents} > 0 THEN COALESCE(${dentalInvoices.paidAt}, NOW())
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
  /**
   * BR-049: flip issued/partial invoices past their due date (with a balance)
   * to `overdue`. Returns the affected rows so the caller can audit each
   * transition. Idempotent — already-overdue/paid/voided rows are excluded by
   * the status filter, so a re-run flips (and returns) nothing.
   */
  async markOverdueInvoices(asOf: Date = new Date()): Promise<Array<{ id: string; branchId: string }>> {
    return this.db
      .update(dentalInvoices)
      .set({ status: 'overdue', updatedAt: new Date() })
      .where(
        and(
          inArray(dentalInvoices.status, ['issued', 'partial']),
          lte(dentalInvoices.dueDate, asOf),
          gt(dentalInvoices.balanceCents, 0),
        )
      )
      .returning({ id: dentalInvoices.id, branchId: dentalInvoices.branchId });
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
