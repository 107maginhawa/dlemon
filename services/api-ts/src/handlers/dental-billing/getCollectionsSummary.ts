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

import type { Context } from 'hono';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ValidationError } from '@/core/errors';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { dentalInvoices } from './repos/dental-invoice.schema';
import { dentalPayments } from './repos/dental-payment.schema';
import { and, eq, gte, lte, sql } from 'drizzle-orm';

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}
function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

export async function getCollectionsSummary(ctx: Context) {
  const user = ctx.get('user') as any;
  if (!user) throw new UnauthorizedError('Authentication required');

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const q = ctx.req.query();

  // Branch-level authorization
  if (!q.branchId) {
    throw new ValidationError('branchId query parameter is required');
  }
  await assertBranchAccess(db, user.id, q.branchId);

  const now = new Date();
  let from: Date;
  let to: Date;

  if (q.period === 'month') {
    from = new Date(now.getFullYear(), now.getMonth(), 1);
    to = endOfDay(now);
  } else if (q.period === 'year') {
    from = new Date(now.getFullYear(), 0, 1);
    to = endOfDay(now);
  } else {
    // default: today
    from = q.from ? new Date(q.from) : startOfDay(now);
    to = q.to ? new Date(q.to) : endOfDay(now);
  }

  const invoiceConditions: any[] = [
    gte(dentalInvoices.issuedAt, from),
    lte(dentalInvoices.issuedAt, to),
  ];
  if (q.branchId) invoiceConditions.push(eq(dentalInvoices.branchId, q.branchId));

  const issuedInvoices = await db
    .select()
    .from(dentalInvoices)
    .where(and(...invoiceConditions));

  const paymentConditions: any[] = [
    gte(dentalPayments.createdAt, from),
    lte(dentalPayments.createdAt, to),
    eq(dentalPayments.isVoid, false),
  ];
  if (q.branchId) paymentConditions.push(eq(dentalPayments.branchId, q.branchId));

  const payments = await db
    .select()
    .from(dentalPayments)
    .where(and(...paymentConditions));

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
  }, 200);
}
