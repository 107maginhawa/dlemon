/**
 * createDentalTreatment handler
 *
 * POST /dental/visits/{visitId}/treatments
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, BusinessLogicError, NotFoundError } from '@/core/errors';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { TreatmentRepository } from '../repos/treatment.repo';
import { VisitRepository } from '../repos/visit.repo';
import { DentalChartRepository } from '../repos/dental-chart.repo';
import { getBranchOrgId } from '@/handlers/dental-org/repos/org-billing.facade';
import { logAuditEvent } from '@/core/audit-logger';
import type { User } from '@/types/auth';
import type { CreateDentalTreatmentBody, CreateDentalTreatmentParams } from '@/generated/openapi/validators';

export async function createDentalTreatment(
  ctx: ValidatedContext<CreateDentalTreatmentBody, never, CreateDentalTreatmentParams>
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { visitId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new TreatmentRepository(db);
  const visitRepo = new VisitRepository(db);

  // Branch authorization — look up visit to get branchId
  const visit = await visitRepo.findOneById(visitId);
  if (!visit) throw new NotFoundError('Dental visit');
  await assertBranchRole(db, user.id, visit.branchId, ['dentist_owner', 'dentist_associate']);

  // FR1.16: Immutability — cannot add treatments to completed/locked visits
  if (visit.status === 'completed' || visit.status === 'locked') {
    throw new BusinessLogicError(
      `Cannot add treatments to a ${visit.status} visit`,
      'VISIT_IMMUTABLE'
    );
  }

  // EC2: Block treatment on extracted tooth
  if (body.toothNumber !== undefined) {
    const chartRepo = new DentalChartRepository(db);
    const chart = await chartRepo.findByVisit(visit.id);
    if (chart) {
      const toothState = chart.teeth.find((t: any) => t.toothNumber === body.toothNumber);
      if (toothState?.state === 'extracted') {
        throw new BusinessLogicError(
          `Tooth ${body.toothNumber} is extracted — cannot add pending treatments`,
          'TOOTH_EXTRACTED'
        );
      }
    }
  }

  const treatment = await repo.createOne({
    visitId,
    patientId: body.patientId,
    cdtCode: body.cdtCode,
    description: body.description,
    toothNumber: body.toothNumber,
    surfaces: body.surfaces,
    conditionCode: body.conditionCode,
    priceCents: body.priceCents,
    carriedOver: false,
    clinicalNotes: body.clinicalNotes,
    // GAP-001: persist optional client-generated id for offline-first idempotent sync.
    localId: body.localId,
  });

  // V-VIS-001 / DE-004 TreatmentDiagnosed: per ADR-006 this is an audit-log-only
  // marker (no event bus) — satisfy it by writing the dental_audit_log row.
  const branchForAudit = await getBranchOrgId(db, visit.branchId);
  await logAuditEvent(db, ctx.get('logger'), {
    personId: user.id,
    tenantId: branchForAudit?.organizationId ?? visit.branchId,
    branchId: visit.branchId,
    action: 'treatment.diagnosed',
    resourceType: 'dental_treatment',
    resourceId: treatment.id,
    metadata: { visitId, cdtCode: treatment.cdtCode },
  });

  return ctx.json(treatment, 201);
}
