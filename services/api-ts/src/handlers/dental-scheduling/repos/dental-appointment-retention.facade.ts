/**
 * dental-appointment-retention.facade.ts
 *
 * Facade exposing dental-scheduling appointment retention operations to the
 * `retention` module (V-DG-003). Keeps the cross-module joins
 * (appointment → branch → organization for tenant scoping, and
 * appointment → patient → person for the legal-hold subject) INSIDE
 * dental-scheduling, so the retention module imports only this facade — never
 * the underlying repos/schemas directly (Phase 10 boundary lint; .facade.ts
 * files are the migration destination, exempt from check:boundaries).
 *
 * DATA_GOVERNANCE §2 declares Appointment retention as "1 year from date"
 * (the appointment DATE), so eligibility filters on `scheduledAt <= cutoff` —
 * NOT createdAt. archive = soft-archive by stamping `deletedAt`.
 *
 * Used by the V-DG-003 retention engine's `appointment` target.
 */

import { and, eq, isNull, lte, inArray } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { dentalAppointments } from './dental-appointment.schema';
import { dentalBranches } from '@/handlers/dental-org/repos/branch.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';

export interface ArchivableAppointmentQuery {
  tenantId: string;
  branchId?: string | null;
  cutoff: Date;
}

export interface ArchivableAppointmentSubject {
  id: string;
  /** The owning patient's Person — used for the legal-hold check. */
  personId: string;
}

/**
 * Non-deleted appointments whose appointment date (`scheduledAt`) is on/before
 * `cutoff`, scoped to a branch (when `branchId` is given) or the whole
 * tenant/organization (branchId null, resolved through the appointment's branch
 * → organization). Each row carries the owning patient's Person id so the
 * retention engine can apply the legal-hold exclusion per subject.
 */
export async function findArchivableAppointmentSubjects(
  db: DatabaseInstance,
  { tenantId, branchId, cutoff }: ArchivableAppointmentQuery,
): Promise<ArchivableAppointmentSubject[]> {
  const rows = branchId
    ? await db
        .select({ id: dentalAppointments.id, personId: patients.person })
        .from(dentalAppointments)
        .innerJoin(patients, eq(dentalAppointments.patientId, patients.id))
        .where(
          and(
            isNull(dentalAppointments.deletedAt),
            lte(dentalAppointments.scheduledAt, cutoff),
            eq(dentalAppointments.branchId, branchId),
          ),
        )
    : await db
        .select({ id: dentalAppointments.id, personId: patients.person })
        .from(dentalAppointments)
        .innerJoin(dentalBranches, eq(dentalAppointments.branchId, dentalBranches.id))
        .innerJoin(patients, eq(dentalAppointments.patientId, patients.id))
        .where(
          and(
            isNull(dentalAppointments.deletedAt),
            lte(dentalAppointments.scheduledAt, cutoff),
            eq(dentalBranches.organizationId, tenantId),
          ),
        );

  return rows.map((r) => ({ id: r.id, personId: r.personId }));
}

/** Soft-archive appointments by stamping `deletedAt`. Returns the count archived. */
export async function archiveAppointments(db: DatabaseInstance, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const res = await db
    .update(dentalAppointments)
    .set({ deletedAt: new Date() })
    .where(and(inArray(dentalAppointments.id, ids), isNull(dentalAppointments.deletedAt)))
    .returning({ id: dentalAppointments.id });
  return res.length;
}
