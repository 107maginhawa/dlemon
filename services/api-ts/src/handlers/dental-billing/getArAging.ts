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
import { dentalInvoices } from './repos/dental-invoice.schema';
import { patients } from '../patient/repos/patient.schema';
import { persons } from '../person/repos/person.schema';
import { and, eq, ne, gt, type SQL } from 'drizzle-orm';
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

  if (q['branchId']) {
    await assertBranchAccess(db, user.id, q['branchId']);
  }

  const asOf = q['asOf'] ? new Date(q['asOf']) : new Date();

  // Pull all outstanding (non-voided, balance > 0) invoices joined to the
  // patient's display name. Branch filter applied when supplied.
  const conditions: SQL<unknown>[] = [
    ne(dentalInvoices.status, 'voided'),
    gt(dentalInvoices.balanceCents, 0),
  ];
  if (q['branchId']) conditions.push(eq(dentalInvoices.branchId, q['branchId']));

  const rows = await db
    .select({
      patientId: dentalInvoices.patientId,
      firstName: persons.firstName,
      lastName: persons.lastName,
      balanceCents: dentalInvoices.balanceCents,
      status: dentalInvoices.status,
      dueDate: dentalInvoices.dueDate,
      issuedAt: dentalInvoices.issuedAt,
      createdAt: dentalInvoices.createdAt,
    })
    .from(dentalInvoices)
    .innerJoin(patients, eq(dentalInvoices.patientId, patients.id))
    .innerJoin(persons, eq(patients.person, persons.id))
    .where(and(...conditions));

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
