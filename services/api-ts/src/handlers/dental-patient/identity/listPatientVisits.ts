/**
 * listPatientVisits handler
 *
 * GET /dental/patients/{patientId}/visits
 *
 * Returns PatientVisitRecord[] — each visit includes its chart teeth with
 * entryClassification mapped to status:
 *   existing        → existing
 *   existing_other  → existing_other
 *   treatment_plan  → planned
 *   condition       → condition
 *   (undefined)     → omitted
 */

import type { HandlerContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { assertPatientBranchAccess } from '@/handlers/shared/assert-branch-access';
import { getDentalPatientRecord } from '../../patient/repos/patient-dental-patient.facade';
import { findVisits } from '@/handlers/dental-visit/utils/visit.service';
import { getChartForPatientVisit } from '@/handlers/dental-visit/repos/visit-dental-patient.facade';
import type { ToothChartState } from '@/handlers/dental-visit/repos/visit-dental-patient.facade';
import { parsePagination, buildPaginationMeta } from '@/utils/query';
import type { User } from '@/types/auth';

function mapEntryClassification(ec?: string | null): string | undefined {
  if (!ec) return undefined;
  if (ec === 'treatment_plan') return 'planned';
  return ec; // 'existing', 'existing_other', 'condition'
}

export async function listPatientVisits(ctx: HandlerContext) {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const patientId = ctx.req.param('patientId');
  const branchId = ctx.req.query('branchId');

  const db = ctx.get('database') as DatabaseInstance;

  // V-PAT-002: derive the branch from the patient record and ALWAYS assert
  // membership. `branchId` is an optional filter, never the auth boundary —
  // gating on it left an omit-branchId cross-tenant PHI bypass.
  const patient = await getDentalPatientRecord(db, patientId!);
  if (!patient) throw new NotFoundError('Patient not found');
  await assertPatientBranchAccess(db, user.id, patient.preferredBranchId);

  const filters: { patientId: string; branchId?: string } = { patientId: patientId! };
  if (branchId) filters.branchId = branchId;
  const visits = await findVisits(db, filters);

  const patientVisitRecords = await Promise.all(
    visits.map(async (visit) => {
      const chart = await getChartForPatientVisit(db, visit.id);
      const teeth = (chart?.teeth ?? []).map((t: ToothChartState) => ({
        toothNumber: t.toothNumber,
        state: t.state,
        status: mapEntryClassification(t.entryClassification),
        surfaces: t.surfaces,
        conditionCode: t.conditionCode,
        entryClassification: t.entryClassification,
      }));
      return {
        id: visit.id,
        createdAt: visit.createdAt,
        updatedAt: visit.updatedAt,
        patientId: visit.patientId,
        branchId: visit.branchId,
        status: visit.status,
        chiefComplaint: visit.chiefComplaint,
        teeth,
      };
    }),
  );

  const { limit, offset } = parsePagination(ctx.req.query(), { limit: 20 });
  const totalCount = patientVisitRecords.length;
  const page = patientVisitRecords.slice(offset, offset + limit);

  return ctx.json({ data: page, pagination: buildPaginationMeta(page, totalCount, limit, offset) });
}
