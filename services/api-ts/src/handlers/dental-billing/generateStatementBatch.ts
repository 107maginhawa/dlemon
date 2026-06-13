/**
 * generateStatementBatch — POST /dental/billing/statements/batch
 *
 * P2-14: Batch patient billing statements. For every patient with an
 * outstanding balance (or an explicit `patientIds` subset, optionally
 * `includeZeroBalance`), produce a statement summarizing total charges,
 * payments, discounts, and remaining balance as of `asOf` (defaults to now).
 *
 * This is a read-side aggregation (no statement rows are persisted yet); it
 * returns the computed statements plus a `batchId` for client-side correlation
 * / print runs.
 */

import { randomUUID } from 'node:crypto';
import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { getActiveBranchIdsForPerson } from '@/handlers/dental-org/repos/org-billing.facade';
import { getStatementInvoices } from './repos/billing-report.facade';
import { computePatientStatement, type AgingInvoice, type PatientStatement } from './utils/aging';
import type { GenerateStatementBatchBody } from '@/generated/openapi/validators';

export async function generateStatementBatch(
  ctx: ValidatedContext<GenerateStatementBatchBody, never, never>,
) {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const body = ctx.req.valid('json');

  // EM-BIL-002: branchId is OPTIONAL. When supplied, assert membership. When
  // omitted, scope to the caller's own active branches — never the whole
  // (multi-tenant) DB, which would leak other orgs' statements + patient PHI.
  let allowedBranchIds: string[] | undefined;
  if (body.branchId) {
    await assertBranchAccess(db, user.id, body.branchId);
  } else {
    allowedBranchIds = await getActiveBranchIdsForPerson(db, user.id);
  }

  const asOf = body.asOf ? new Date(body.asOf) : new Date();
  const includeZeroBalance = body.includeZeroBalance ?? false;

  const rows = await getStatementInvoices(db, {
    branchId: body.branchId,
    patientIds: body.patientIds,
    allowedBranchIds,
  });

  const byPatient = new Map<string, { name: string; invoices: AgingInvoice[] }>();
  for (const r of rows) {
    const name = [r.firstName, r.lastName].filter(Boolean).join(' ').trim() || 'Unknown';
    let entry = byPatient.get(r.patientId);
    if (!entry) {
      entry = { name, invoices: [] };
      byPatient.set(r.patientId, entry);
    }
    entry.invoices.push({
      balanceCents: r.balanceCents,
      status: r.status,
      totalCents: r.totalCents,
      paidCents: r.paidCents,
      discountCents: r.discountCents,
      dueDate: r.dueDate,
      issuedAt: r.issuedAt,
      createdAt: r.createdAt,
    });
  }

  const batchId = randomUUID();
  const year = asOf.getFullYear();
  const statements: PatientStatement[] = [];
  let seq = 0;
  let totalBalanceCents = 0;

  // Stable ordering by patient name then id for deterministic statement numbers.
  const ordered = [...byPatient.entries()].sort((a, b) =>
    a[1].name.localeCompare(b[1].name) || a[0].localeCompare(b[0]),
  );

  for (const [patientId, entry] of ordered) {
    seq += 1;
    const statementNumber = `STMT-${year}-${batchId.slice(0, 8).toUpperCase()}-${String(seq).padStart(4, '0')}`;
    const stmt = computePatientStatement(patientId, entry.name, statementNumber, entry.invoices, asOf);
    if (stmt.balanceCents <= 0 && !includeZeroBalance) {
      seq -= 1; // do not consume a sequence number for skipped statements
      continue;
    }
    statements.push(stmt);
    totalBalanceCents += stmt.balanceCents;
  }

  logger?.info(
    { action: 'generateStatementBatch', batchId, branchId: body.branchId, statementCount: statements.length, totalBalanceCents },
    'Statement batch generated',
  );

  return ctx.json({
    batchId,
    asOf: asOf.toISOString(),
    statementCount: statements.length,
    totalBalanceCents,
    statements,
  }, 200);
}
