/**
 * acceptTreatmentPlan — POST /dental/patients/:patientId/treatment-plan/accept
 *
 * Snapshots the current live treatment plan for the patient and writes it
 * as a new append-only TreatmentPlanVersion row. Subsequent accepts create
 * new versions; prior versions are never mutated.
 *
 * If consentFormId is supplied, links the version to that consent form via
 * accepted_plan_version_id. The consent form must belong to the same patient.
 * Plan acceptance is visit-anchored when a consentFormId is provided, which
 * is the expected flow: patient signs during a visit.
 */

import type { BaseContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ValidationError, NotFoundError, BusinessLogicError } from '@/core/errors';
import { assertPatientBranchAccess } from '@/handlers/shared/assert-branch-access';
import { getPatientForDentalPatient } from '@/handlers/patient/repos/patient-dental-patient.facade';
import { createSnapshotVersion } from '@/core/database.schema';
import { treatmentPlanVersions } from '../repos/treatment-plan-version.schema';
import { dentalTreatments } from '../repos/treatment.schema';
import { dentalVisits } from '../repos/visit.schema';
import { eq, and, inArray } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

async function buildLivePlan(db: NodePgDatabase, patientId: string) {
  const visits = await db
    .select({ id: dentalVisits.id })
    .from(dentalVisits)
    .where(eq(dentalVisits.patientId, patientId));

  const visitIds = visits.map(v => v.id);

  if (visitIds.length === 0) {
    return { patientId, treatments: [], totalEstimateCents: 0, treatmentCount: 0, toothCount: 0, byTooth: {} };
  }

  const pendingTreatments = await db
    .select()
    .from(dentalTreatments)
    .where(
      and(
        inArray(dentalTreatments.visitId, visitIds),
        inArray(dentalTreatments.status, ['diagnosed', 'planned']),
      ),
    );

  const totalEstimateCents = pendingTreatments.reduce((sum, t) => sum + t.priceCents, 0);
  const byTooth: Record<string | number, unknown[]> = {};
  for (const t of pendingTreatments) {
    const key = t.toothNumber ?? 'general';
    if (!byTooth[key]) byTooth[key] = [];
    byTooth[key].push({
      id: t.id, cdtCode: t.cdtCode, description: t.description,
      surfaces: t.surfaces, priceCents: t.priceCents, status: t.status,
      conditionCode: t.conditionCode, visitId: t.visitId,
    });
  }

  return {
    patientId,
    totalEstimateCents,
    treatmentCount: pendingTreatments.length,
    toothCount: Object.keys(byTooth).filter(k => k !== 'general').length,
    byTooth,
    treatments: pendingTreatments.map(t => ({
      id: t.id, toothNumber: t.toothNumber, cdtCode: t.cdtCode,
      description: t.description, surfaces: t.surfaces, priceCents: t.priceCents,
      status: t.status, conditionCode: t.conditionCode, visitId: t.visitId,
      carriedOver: t.carriedOver,
    })),
  };
}

export async function acceptTreatmentPlan(ctx: BaseContext) {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const patientId = ctx.req.param('patientId');
  if (!patientId) throw new ValidationError('patientId is required');
  const branchId = ctx.req.query('branchId');
  if (!branchId) throw new ValidationError('branchId query parameter is required');

  const db = ctx.get('database') as DatabaseInstance;
  // V-VIS-011: authorize against the PATIENT's branch, not the caller-supplied
  // branchId. Gating on the query param let a foreign-branch caller snapshot another
  // branch's patient plan (cross-tenant write leak) — audit 2026-06-08.
  const patient = await getPatientForDentalPatient(db, patientId);
  if (!patient) throw new NotFoundError('Patient not found');
  await assertPatientBranchAccess(db, user.id, patient.preferredBranchId);

  // EF-PAT-001: block writes on archived patients
  if (patient.status === 'archived') {
    throw new BusinessLogicError('Cannot modify an archived patient', 'PATIENT_ARCHIVED');
  }

  const body = await ctx.req.json().catch(() => ({})) as { consentFormId?: string };

  const snapshot = await buildLivePlan(db as unknown as NodePgDatabase, patientId);

  const row = await createSnapshotVersion(
    db as unknown as NodePgDatabase,
    treatmentPlanVersions,
    treatmentPlanVersions.patientId,
    treatmentPlanVersions.version,
    patientId,
    { patientId, createdBy: user.id, snapshot },
  ) as typeof treatmentPlanVersions.$inferSelect;

  // Link consent form if provided
  if (body.consentFormId) {
    const { consentForms } = await import('../../dental-clinical/repos/consent-form.schema');
    const [form] = await db
      .select({ id: consentForms.id })
      .from(consentForms)
      .where(and(eq(consentForms.id, body.consentFormId), eq(consentForms.patientId, patientId)));
    if (!form) throw new NotFoundError('Consent form not found for this patient');
    await db
      .update(consentForms)
      .set({ acceptedPlanVersionId: row.id, updatedBy: user.id })
      .where(eq(consentForms.id, body.consentFormId));
  }

  const logger = ctx.get('logger');
  logger?.info({ action: 'acceptTreatmentPlan', patientId, versionId: row.id, version: row.version }, 'Treatment plan accepted');

  return ctx.json(
    { id: row.id, createdAt: row.createdAt, createdBy: row.createdBy, version: row.version, patientId: row.patientId, snapshot: row.snapshot },
    201,
  );
}
