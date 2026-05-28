/**
 * listPatientConditions handler
 *
 * GET /dental/patients/{patientId}/treatments
 *
 * Returns PatientConditionEntry[] — aggregates chart tooth entries (with
 * entryClassification → status) and treatment rows for the patient.
 */

import type { HandlerContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { findVisits } from '@/handlers/dental-visit/visit.service';
import { getChartForPatientVisit, getTreatmentsForPatientConditions } from '@/handlers/dental-visit/repos/visit-dental-patient.facade';
import { parsePagination, buildPaginationMeta } from '@/utils/query';
import type { User } from '@/types/auth';

function mapEntryClassification(ec?: string | null): string {
  if (!ec) return 'condition';
  if (ec === 'treatment_plan') return 'planned';
  return ec; // 'existing', 'existing_other', 'condition'
}

export async function listPatientConditions(ctx: HandlerContext) {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const patientId = ctx.req.param('patientId');
  const branchId = ctx.req.query('branchId');

  const db = ctx.get('database') as DatabaseInstance;
  if (branchId) await assertBranchAccess(db, user.id, branchId);

  const filters: { patientId: string; branchId?: string } = { patientId: patientId! };
  if (branchId) filters.branchId = branchId;
  const visits = await findVisits(db, filters);

  const allEntries: object[] = [];

  for (const visit of visits) {
    // Chart tooth entries
    const chart = await getChartForPatientVisit(db, visit.id);
    for (const tooth of chart?.teeth ?? []) {
      const t = tooth as any;
      allEntries.push({
        id: `tooth-${visit.id}-${t.toothNumber}`,
        visitId: visit.id,
        toothNumber: t.toothNumber,
        status: mapEntryClassification(t.entryClassification),
        surfaces: t.surfaces,
        conditionCode: t.conditionCode,
        state: t.state,
      });
    }

    // Treatment rows
    const treatments = await getTreatmentsForPatientConditions(db, visit.id);
    for (const tx of treatments) {
      allEntries.push({
        id: tx.id,
        visitId: tx.visitId,
        toothNumber: tx.toothNumber,
        status: tx.status,
        surfaces: tx.surfaces,
        conditionCode: tx.conditionCode,
        cdtCode: tx.cdtCode,
        description: tx.description,
        priceCents: tx.priceCents,
      });
    }
  }

  const { limit, offset } = parsePagination(ctx.req.query(), { limit: 100 });
  const totalCount = allEntries.length;
  const page = allEntries.slice(offset, offset + limit);

  return ctx.json({ data: page, pagination: buildPaginationMeta(page, totalCount, limit, offset) });
}
