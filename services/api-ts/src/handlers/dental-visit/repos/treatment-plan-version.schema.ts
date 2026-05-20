/**
 * treatment_plan_version — append-only snapshot of the live treatment plan
 * at the moment a patient accepts it.
 *
 * Immutable by application convention (no UPDATE/DELETE handlers).
 * For medico-legal tamper-evidence, add REVOKE UPDATE/DELETE on this table
 * in a future hardening pass.
 */

import { pgTable, uuid, unique, index } from 'drizzle-orm/pg-core';
import { versionedSnapshotFields } from '@/core/database.schema';
import { patients } from '../../patient/repos/patient.schema';

export const treatmentPlanVersions = pgTable(
  'treatment_plan_version',
  {
    ...versionedSnapshotFields(),
    patientId: uuid('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
  },
  (table) => ({
    uniquePatientVersion: unique('treatment_plan_version_patient_version_uniq').on(
      table.patientId,
      table.version,
    ),
    patientIdx: index('treatment_plan_version_patient_idx').on(table.patientId),
  }),
);

export type TreatmentPlanVersion = typeof treatmentPlanVersions.$inferSelect;
export type NewTreatmentPlanVersion = typeof treatmentPlanVersions.$inferInsert;
