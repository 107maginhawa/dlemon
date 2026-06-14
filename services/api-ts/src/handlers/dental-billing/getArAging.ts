/**
 * getArAging — GET /dental/billing/collections/aging
 *
 * P2-14: Accounts-receivable aging. Buckets each non-voided invoice's
 * outstanding balance into current / 30 / 60 / 90+ by the age of its due date
 * (falling back to issue/created date) relative to `asOf` (defaults to now),
 * grouped per patient, plus a practice-wide collections summary.
 *
 * Query params:
 *   branchId — optional branch filter (authorization enforced when provided)
 *   asOf     — optional ISO date the aging is computed against (defaults now)
 */

import type { BaseContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { getActiveBranchIdsForPerson } from '@/handlers/dental-org/repos/org-billing.facade';
import { withTenantTx } from '@/core/tenant-tx';
import { getOutstandingInvoicesForAging } from './repos/billing-report.facade';
import {
  computePatientAging,
  computeAgingSummary,
  type AgingInvoice,
  type ArAgingPatientRow,
} from './utils/aging';

export async function getArAging(ctx: BaseContext) {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const q = ctx.req.query();

  // EM-BIL-002: branchId is OPTIONAL. When supplied, assert membership. When
  // omitted, scope to the caller's own active branches — never the whole
  // (multi-tenant) DB, which would leak other orgs' balances + patient PHI.
  let allowedBranchIds: string[] | undefined;
  if (q['branchId']) {
    await assertBranchAccess(db, user.id, q['branchId']);
  } else {
    allowedBranchIds = await getActiveBranchIdsForPerson(db, user.id);
  }

  const asOf = q['asOf'] ? new Date(q['asOf']) : new Date();

  // Pull all outstanding (non-voided, balance > 0) invoices joined to the
  // patient's display name. Branch filter applied when supplied.
  //
  // RLS P1b activation: route the read through withTenantTx so the app_rls
  // policy on dental_invoice enforces the branch scope as a second wall behind
  // the app-level filter. Scope = the asserted branch when supplied, else the
  // caller's active-branch set (EM-BIL-002).
  const scopeBranchIds = q['branchId'] ? [q['branchId']] : (allowedBranchIds ?? []);
  const rows = await withTenantTx(db, { branchIds: scopeBranchIds }, (tx) =>
    getOutstandingInvoicesForAging(tx, q['branchId'], allowedBranchIds),
  );

  // Group invoices by patient.
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
      dueDate: r.dueDate,
      issuedAt: r.issuedAt,
      createdAt: r.createdAt,
    });
  }

  const patientRows: ArAgingPatientRow[] = [];
  for (const [patientId, entry] of byPatient) {
    const row = computePatientAging(patientId, entry.name, entry.invoices, asOf);
    if (row.totalOutstandingCents > 0) patientRows.push(row);
  }

  // Most-aged first so the collections worklist surfaces 90+ at the top.
  patientRows.sort((a, b) => b.oldestInvoiceDays - a.oldestInvoiceDays);

  const summary = computeAgingSummary(patientRows);

  logger?.info(
    { action: 'getArAging', branchId: q['branchId'], patientCount: summary.patientCount, totalOutstandingCents: summary.totalOutstandingCents },
    'AR aging computed',
  );

  return ctx.json({
    asOf: asOf.toISOString(),
    summary,
    patients: patientRows,
  }, 200);
}
