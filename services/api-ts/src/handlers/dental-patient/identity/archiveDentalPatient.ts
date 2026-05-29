/**
 * archiveDentalPatient — POST /dental/patients/:id/archive
 *
 * FR2.7: Archive patient with EC1 guard (block if active payment plan).
 * EM-PAT-002: dentist_owner role required (not just any branch member).
 * EM-PAT-003: Optional reason body is parsed and stored as archiveNote.
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, BusinessLogicError, ForbiddenError, ConflictError } from '@/core/errors';
import { PatientRepository } from '../../patient/repos/patient.repo';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { logAuditEvent } from '@/core/audit-logger';
import type { ArchiveDentalPatientParams } from '@/generated/openapi/validators';

export async function archiveDentalPatient(
  ctx: ValidatedContext<never, never, ArchiveDentalPatientParams>
) {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const params = ctx.req.valid('param');
  const patientId = params.id;
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const repo = new PatientRepository(db, logger);

  // Branch-level authorization — dentist_owner only (EM-PAT-002).
  // V-PAT-002: a missing branch must DENY, never bypass the guard.
  const patient = await repo.findOneById(patientId);
  if (!patient) throw new NotFoundError('Patient not found');
  if (!patient.preferredBranchId) {
    throw new ForbiddenError('Patient has no assigned branch');
  }
  await assertBranchRole(db, user.id, patient.preferredBranchId as string, ['dentist_owner']);

  // EM-PAT-003: parse optional reason from body
  let reason: string | undefined;
  try {
    const rawBody = await ctx.req.json();
    if (rawBody && typeof rawBody['reason'] === 'string' && rawBody['reason'].trim()) {
      reason = rawBody['reason'].trim();
    }
  } catch {
    // no body or invalid JSON — reason remains undefined
  }

  const result = await repo.archivePatient(patientId, reason);

  if (!result.success) {
    if (result.reason === 'Patient not found') {
      throw new NotFoundError(result.reason);
    }
    // V-PAT-009: already-archived is a state conflict (409), not a business
    // rule rejection (422). The repo reports it via this reason string.
    if (result.reason === 'Patient is already archived') {
      throw new ConflictError('Patient is already archived', 'PATIENT_ALREADY_ARCHIVED');
    }
    throw new BusinessLogicError(result.reason ?? 'Cannot archive patient', 'ARCHIVE_BLOCKED');
  }

  logger?.info({ action: 'archiveDentalPatient', patientId, actorId: user.id, reason }, 'Patient archived');

  // AL: archive audit trail (never throws — see audit-logger)
  const branchId = patient.preferredBranchId as string | undefined;
  await logAuditEvent(db, logger, {
    personId: user.id,
    tenantId: branchId ?? patientId,
    branchId,
    action: 'patient.archive',
    resourceType: 'dental_patient',
    resourceId: patientId,
    reason,
    metadata: { reason: reason ?? null },
  });

  const updated = await repo.findOneById(patientId);
  return ctx.json(updated, 200);
}
