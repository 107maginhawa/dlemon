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
import { getBranchOrgId, getBranchFeeOverrides } from '@/handlers/dental-org/repos/org-billing.facade';
import { resolveFeeCents } from '@/handlers/dental-org/fee-resolution';
import { getActiveProcedureCode } from '../repos/visit-org.facade';
import { logAuditEvent } from '@/core/audit-logger';
import type { User } from '@/types/auth';
import type { CreateDentalTreatmentBody, CreateDentalTreatmentParams } from '@/generated/openapi/validators';
import type { ToothChartState } from '../repos/dental-chart.schema';

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

  // Cross-patient integrity: body.patientId is caller-supplied and stored verbatim on
  // the treatment row. It must match the visit's patient (mirrors createPerioChart's
  // PATIENT_VISIT_MISMATCH) — otherwise a treatment is written under one patient's
  // visit but attributed to another patient (wrong-patient clinical/billing record).
  if (body.patientId !== visit.patientId) {
    throw new BusinessLogicError('patientId does not match the visit patient', 'PATIENT_VISIT_MISMATCH');
  }

  // SL-01: offline-replay idempotency. A retried create carrying a previously-seen
  // localId returns the EXISTING treatment instead of inserting a duplicate. Placed
  // before the immutability guard so a replay of a successful create still resolves
  // idempotently even after the visit was later completed/locked (mirrors the visit
  // installment, which replays before its active-visit guard).
  if (body.localId) {
    const existing = await repo.findByLocalId(visitId, body.localId);
    if (existing) return ctx.json(existing, 201);
  }

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
      const toothState = (chart.teeth as ToothChartState[]).find(t => t.toothNumber === body.toothNumber);
      if (toothState?.state === 'extracted') {
        throw new BusinessLogicError(
          `Tooth ${body.toothNumber} is extracted — cannot add pending treatments`,
          'TOOTH_EXTRACTED'
        );
      }
    }
  }

  // dental-org G2 (decision §5 = DRIVE pricing): when priceCents is omitted,
  // default it from the branch fee schedule — per-branch override wins, else the
  // global catalog default, else 0 (closes AC-ORG-002). An explicit value wins.
  let priceCents = body.priceCents;
  if (priceCents === undefined) {
    const overrides = await getBranchFeeOverrides(db, visit.branchId);
    const procedure = await getActiveProcedureCode(db, body.cdtCode);
    priceCents = resolveFeeCents(overrides, body.cdtCode, procedure?.defaultFeePhp);
  }

  const treatment = await repo.createOne({
    visitId,
    patientId: body.patientId,
    cdtCode: body.cdtCode,
    description: body.description,
    toothNumber: body.toothNumber,
    surfaces: body.surfaces,
    conditionCode: body.conditionCode,
    priceCents,
    carriedOver: false,
    clinicalNotes: body.clinicalNotes,
    // P1-18: clinical sequencing phase + intra-phase ordering.
    phase: body.phase,
    priority: body.priority ?? 0,
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
