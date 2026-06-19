/**
 * patient-billing.facade.ts
 *
 * Facade exposing patient + person data to dental-billing handlers.
 * Cross-module schema import (persons) is intentional and permitted
 * within facade files, which are exempt from the boundary checker.
 */

import { eq, inArray } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { patients } from './patient.schema';
import { persons } from '@/handlers/person/repos/person.schema';

export async function getPatientWithPersonForInvoice(
  db: DatabaseInstance,
  patientId: string,
) {
  const [row] = await db
    .select({
      patientId: patients.id,
      personId: patients.person,
      firstName: persons.firstName,
      lastName: persons.lastName,
      dateOfBirth: persons.dateOfBirth,
    })
    .from(patients)
    .innerJoin(persons, eq(patients.person, persons.id))
    .where(eq(patients.id, patientId))
    .limit(1);
  return row ?? null;
}

/**
 * Patient id + preferred branch, for billing branch-level authorization.
 * Returns null when the patient does not exist.
 */
/**
 * Phase 2.4: the subset of `patientIds` that hold an active payment plan, read
 * off the maintained `patients.hasActivePaymentPlan` flag. Powers the collections
 * worklist's "on a plan" column without a payment-plan-table scan.
 */
export async function getActivePaymentPlanPatientIds(
  db: DatabaseInstance,
  patientIds: string[],
): Promise<Set<string>> {
  if (patientIds.length === 0) return new Set();
  const rows = await db
    .select({ id: patients.id, hasActivePaymentPlan: patients.hasActivePaymentPlan })
    .from(patients)
    .where(inArray(patients.id, patientIds));
  return new Set(rows.filter((r) => r.hasActivePaymentPlan).map((r) => r.id));
}

export async function getPatientBranchForBilling(
  db: DatabaseInstance,
  patientId: string,
): Promise<{ id: string; preferredBranchId: string | null; person: string | null } | null> {
  const [row] = await db
    .select({ id: patients.id, preferredBranchId: patients.preferredBranchId, person: patients.person })
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1);
  return row ?? null;
}
