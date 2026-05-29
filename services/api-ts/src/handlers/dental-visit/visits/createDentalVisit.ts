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
  // V-VIS-002: ROLE_PERMISSION_MATRIX restricts visit creation to owner + associate.
  await assertBranchRole(db, user.id, body.branchId, ['dentist_owner', 'dentist_associate']);

  const repo = new VisitRepository(db);

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
    chiefComplaint: body.chiefComplaint,
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
    metadata: { patientId: visit.patientId, branchId: visit.branchId },
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
