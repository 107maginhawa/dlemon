/**
 * createDentalVisit handler
 *
 * POST /dental/visits
 * Creates a new dental visit in draft status.
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ConflictError } from '@/core/errors';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { assertOrgLive } from '@/handlers/shared/assert-org-live';
import { VisitRepository } from '../repos/visit.repo';
import { VisitNotesRepository } from '../repos/treatment.repo';
import { logAuditEvent } from '@/core/audit-logger';
import type { User } from '@/types/auth';
import type { CreateDentalVisitBody } from '@/generated/openapi/validators';

export async function createDentalVisit(
  ctx: ValidatedContext<CreateDentalVisitBody, never, never>
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const body = ctx.req.valid('json');

  const db = ctx.get('database') as DatabaseInstance;
  // E3: visitType scopes who may create the visit.
  //   'general' (default, dentist-led) → owner/associate only (V-VIS-002, unchanged).
  //   'hygiene' (hygienist-led recall/prophy/perio) → owner/associate OR hygienist.
  // The allowed set is computed CONDITIONALLY on visitType — hygienist is never
  // granted general-visit authority.
  const visitType = body.visitType ?? 'general';
  const allowedRoles =
    visitType === 'hygiene'
      ? (['dentist_owner', 'dentist_associate', 'hygienist'] as const)
      : (['dentist_owner', 'dentist_associate'] as const);
  await assertBranchRole(db, user.id, body.branchId, [...allowedRoles]);
  // C-1: provisional clinics cannot accumulate PHI until activated (production-only).
  await assertOrgLive(db, body.branchId);

  const repo = new VisitRepository(db);

  // SL-01 / F-G02: offline-replay idempotency. A retried create carrying a
  // previously-seen localId returns the EXISTING visit instead of inserting a
  // duplicate (and before the active-visit guard, so a replay of the same create
  // never trips ACTIVE_VISIT_EXISTS on its own first row).
  if (body.localId) {
    const existing = await repo.findByLocalId(body.branchId, body.localId);
    if (existing) return ctx.json(existing, 201);
  }

  // V-VIS-003 / BR-001: app-level guard — return 409 (not a raw 500 from the
  // partial unique index) when an active visit already exists for this patient.
  const existingActive = await repo.findActiveByPatient(body.patientId);
  if (existingActive) {
    throw new ConflictError(
      'Active visit already exists for this patient. Complete or discard it first.',
      'ACTIVE_VISIT_EXISTS',
    );
  }

  const visit = await repo.createOne({
    patientId: body.patientId,
    branchId: body.branchId,
    dentistMemberId: body.dentistMemberId,
    visitType,
    chiefComplaint: body.chiefComplaint,
    // GAP-001: persist optional client-generated id for offline-first idempotent sync.
    // syncStatus stays at its 'synced' default — a server-acknowledged write is synced.
    localId: body.localId,
    // Audit attribution: record who created the visit (otherwise created_by is
    // NULL and downstream audit/attribution has no actor).
    createdBy: user.id,
    updatedBy: user.id,
  });

  const logger = ctx.get('logger');
  logger?.info(
    { requestId: ctx.get('requestId'), action: 'dental_visit_create', visitId: visit.id, patientId: visit.patientId, branchId: visit.branchId, by: user.id },
    'Dental visit created',
  );

  await logAuditEvent(db, logger, {
    personId: user.id,
    tenantId: body.branchId,
    action: 'visit.create',
    resourceType: 'dental_visit',
    resourceId: visit.id,
    metadata: { patientId: visit.patientId, branchId: visit.branchId, visitType: visit.visitType },
  });

  // Auto-create empty notes row so GET /notes on any new visit returns 200
  const notesRepo = new VisitNotesRepository(db);
  await notesRepo.upsert({
    visitId: visit.id,
    authorMemberId: visit.dentistMemberId,
    createdBy: user.id,
    updatedBy: user.id,
  });

  return ctx.json(visit, 201);
}
