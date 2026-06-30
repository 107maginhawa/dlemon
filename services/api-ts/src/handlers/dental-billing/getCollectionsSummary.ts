/**
 * getCollectionsSummary — GET /dental/billing/collections/summary
 *
 * FR4.5: Collections summary — totals per time window (today, this month, custom range).
 *
 * Query params:
 *   branchId   — filter by branch
 *   from       — ISO date string (defaults to start of today)
 *   to         — ISO date string (defaults to end of today)
 *   period     — shorthand: 'today' | 'month' | 'year' (overrides from/to)
 */

import type { BaseContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { getActiveBranchIdsForPerson } from '@/handlers/dental-org/repos/org-billing.facade';
import { withTenantTx } from '@/core/tenant-tx';
import { dentalInvoices } from './repos/dental-invoice.schema';
import { dentalPayments } from './repos/dental-payment.schema';
import { and, eq, ne, gte, lte, inArray, sql, type SQL } from 'drizzle-orm';

function startOfDay(d: Date): Date {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  return s;
}
function endOfDay(d: Date): Date {
  const e = new Date(d);
  e.setHours(23, 59, 59, 999);
  return e;
}

export async function getCollectionsSummary(ctx: BaseContext) {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const q = ctx.req.query();

  // EM-BIL-002: branchId is OPTIONAL. When provided, verify access. When
  // omitted, scope to the caller's own active branches — never the whole
  // (multi-tenant) DB, which would leak other orgs' collections totals.
  let allowedBranchIds: string[] | undefined;
  if (q['branchId']) {
    await assertBranchAccess(db, user.id, q['branchId']);
  } else {
    allowedBranchIds = await getActiveBranchIdsForPerson(db, user.id);
  }

  const now = new Date();
  let from: Date;
  let to: Date;

  if (q['period'] === 'month') {
    // Start of current month in local time
    from = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
    to = endOfDay(now);
  } else if (q['period'] === 'year') {
    from = startOfDay(new Date(now.getFullYear(), 0, 1));
    to = endOfDay(now);
  } else if (q['period'] === 'today') {
    // Rolling window: past 24h through next 24h to tolerate DB/app timezone skew
    from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    to = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  } else {
    from = q['from'] ? new Date(q['from']) : startOfDay(now);
    to = q['to'] ? new Date(q['to']) : endOfDay(now);
  }

  const invoiceConditions: SQL<unknown>[] = [
    gte(dentalInvoices.issuedAt, from),
    lte(dentalInvoices.issuedAt, to),
    // §g DQ3 / F-02: exclude deposit invoices from billed/outstanding/overdue so
    // the collections summary matches the KPI dashboard. Collected cash is summed
    // from dental_payment rows below, so deposit CASH still counts there once.
    ne(dentalInvoices.kind, 'deposit'),
  ];
  if (q['branchId']) {
    invoiceConditions.push(eq(dentalInvoices.branchId, q['branchId']));
  } else if (allowedBranchIds) {
    invoiceConditions.push(
      allowedBranchIds.length > 0 ? inArray(dentalInvoices.branchId, allowedBranchIds) : sql`false`,
    );
  }

  // RLS P1b activation: route the payload reads through withTenantTx so the
  // app_rls policies on dental_invoice / dental_payment enforce the branch scope
  // as a second wall behind the app-level filters above. Scope = the asserted
  // branch when supplied, else the caller's active-branch set (EM-BIL-002).
  const scopeBranchIds = q['branchId'] ? [q['branchId']] : (allowedBranchIds ?? []);

  const issuedInvoices = await withTenantTx(db, { branchIds: scopeBranchIds }, (tx) =>
    tx
      .select()
      .from(dentalInvoices)
      .where(and(...invoiceConditions)),
  );

  const paymentConditions: SQL<unknown>[] = [
    gte(dentalPayments.createdAt, from),
    lte(dentalPayments.createdAt, to),
    eq(dentalPayments.isVoid, false),
  ];
  if (q['branchId']) {
    paymentConditions.push(eq(dentalPayments.branchId, q['branchId']));
  } else if (allowedBranchIds) {
    paymentConditions.push(
      allowedBranchIds.length > 0 ? inArray(dentalPayments.branchId, allowedBranchIds) : sql`false`,
    );
  }

  const payments = await withTenantTx(db, { branchIds: scopeBranchIds }, (tx) =>
    tx
      .select()
      .from(dentalPayments)
      .where(and(...paymentConditions)),
  );

  const totalCollectedCents = payments.reduce((sum, p) => sum + p.amountCents, 0);
  const totalBilledCents = issuedInvoices
    .filter(inv => inv.status !== 'voided')
    .reduce((sum, inv) => sum + inv.totalCents, 0);
  const totalOutstandingCents = issuedInvoices
    .filter(inv => inv.status !== 'voided')
    .reduce((sum, inv) => sum + inv.balanceCents, 0);
  const overdueCount = issuedInvoices.filter(inv => inv.status === 'overdue').length;

  // Payment method breakdown
  const byMethod: Record<string, number> = {};
  for (const p of payments) {
    byMethod[p.method] = (byMethod[p.method] ?? 0) + p.amountCents;
  }

  // G-13: per-day collected breakdown (keyed by payment date, UTC YYYY-MM-DD) so a
  // revenue report's daily "Collected" column derives from the same payment-date
  // source as totalCollectedCents and the dashboard MoneyPanel — no drift. The
  // entries sum to totalCollectedCents by construction.
  const byDay = new Map<string, number>();
  for (const p of payments) {
    const day = p.createdAt.toISOString().slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + p.amountCents);
  }
  const dailyCollections = Array.from(byDay.entries())
    .map(([date, collectedCents]) => ({ date, collectedCents }))
    .sort((a, b) => a.date.localeCompare(b.date));

  logger?.info({ action: 'getCollectionsSummary', from, to, totalCollectedCents }, 'Collections summary retrieved');

  return ctx.json({
    period: { from: from.toISOString(), to: to.toISOString() },
    totalBilledCents,
    totalCollectedCents,
    totalOutstandingCents,
    invoiceCount: issuedInvoices.filter(i => i.status !== 'voided').length,
    overdueCount,
    paymentCount: payments.length,
    collectionsByMethod: byMethod,
    dailyCollections,
  }, 200);
}
