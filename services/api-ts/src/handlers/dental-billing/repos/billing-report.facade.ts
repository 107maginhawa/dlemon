/**
 * billing-report.facade.ts
 *
 * Facade for dental-billing reports that need the patient's display name
 * alongside invoice rows (AR-aging, statement batch). The dentalInvoices →
 * patients → persons join is rooted in dental-billing's own invoice table but
 * reaches patient + person columns; centralizing it in this facade keeps that
 * cross-module join in one exempt bridge file (Phase 10 boundary lint) instead
 * of inline in the report handlers. SQL is byte-identical to the former inline
 * queries.
 */

import { and, eq, ne, gt, inArray, type SQL } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { dentalInvoices } from './dental-invoice.schema';
import { patients } from '../../patient/repos/patient.schema';
import { persons } from '../../person/repos/person.schema';

/** Outstanding (non-voided, balance>0) invoices + patient name, for AR-aging. */
export async function getOutstandingInvoicesForAging(
  db: DatabaseInstance,
  branchId?: string,
) {
  const conditions: SQL<unknown>[] = [
    ne(dentalInvoices.status, 'voided'),
    gt(dentalInvoices.balanceCents, 0),
  ];
  if (branchId) conditions.push(eq(dentalInvoices.branchId, branchId));

  return db
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
}

/** Invoice rows + patient name for a statement batch (optional branch / patient filters). */
export async function getStatementInvoices(
  db: DatabaseInstance,
  filters: { branchId?: string; patientIds?: string[] },
) {
  const conditions: SQL<unknown>[] = [];
  if (filters.branchId) conditions.push(eq(dentalInvoices.branchId, filters.branchId));
  if (filters.patientIds && filters.patientIds.length > 0) {
    conditions.push(inArray(dentalInvoices.patientId, filters.patientIds));
  }

  return db
    .select({
      patientId: dentalInvoices.patientId,
      firstName: persons.firstName,
      lastName: persons.lastName,
      status: dentalInvoices.status,
      totalCents: dentalInvoices.totalCents,
      paidCents: dentalInvoices.paidCents,
      discountCents: dentalInvoices.discountCents,
      balanceCents: dentalInvoices.balanceCents,
      dueDate: dentalInvoices.dueDate,
      issuedAt: dentalInvoices.issuedAt,
      createdAt: dentalInvoices.createdAt,
    })
    .from(dentalInvoices)
    .innerJoin(patients, eq(dentalInvoices.patientId, patients.id))
    .innerJoin(persons, eq(patients.person, persons.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined);
}
