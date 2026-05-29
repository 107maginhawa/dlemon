/**
 * importPMD handler
 *
 * POST /dental/pmd/import
 * Imports an external PMD record (read-only, links to patient).
 *
 * EF-PMD-001: When body.checksum is present, compute sha256 of body.content
 * and verify the digests match before persisting. Mismatch → 422 CHECKSUM_MISMATCH.
 *
 * EF-PMD-005: body.sourceDescription is required — identifies the originating
 * software system (e.g. "Open Dental v21.1") for audit trail data provenance.
 */

import { createHash } from 'node:crypto';
import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, ForbiddenError, BusinessLogicError } from '@/core/errors';
import { ImportedPMDRepository } from './repos/imported-pmd.repo';
import { getPatientForPMD } from '@/handlers/patient/repos/patient-pmd.facade';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { getBranchOrgId } from '@/handlers/dental-org/repos/org-billing.facade';
import { logAuditEvent } from '@/core/audit-logger';
import type { User } from '@/types/auth';
import type { ImportPMDBody } from '@/generated/openapi/validators';

/** Compute sha256-<hex> of content — matches the format used by generatePMD. */
function computeChecksum(content: string): string {
  return `sha256-${createHash('sha256').update(content).digest('hex')}`;
}

export async function importPMD(
  ctx: ValidatedContext<ImportPMDBody>
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const body = ctx.req.valid('json');

  // V-PMD-010: source_description is capped at 200 chars (API_CONTRACTS §import). The
  // generated validator does not yet enforce this (central regen pending), so guard here.
  if (body.sourceDescription !== undefined && body.sourceDescription.length > 200) {
    throw new BusinessLogicError(
      'sourceDescription must be 200 characters or fewer',
      'VALIDATION_ERROR',
    );
  }

  // EF-PMD-001: Verify checksum when caller supplies one.
  if (body.checksum !== undefined) {
    const actual = computeChecksum(body.content);
    if (actual !== body.checksum) {
      throw new BusinessLogicError(
        'Checksum mismatch: provided checksum does not match SHA-256 of content',
        'CHECKSUM_MISMATCH',
      );
    }
  }

  const db = ctx.get('database') as DatabaseInstance;

  // Branch-level authorization via patient's preferred branch
  const patient = await getPatientForPMD(db, body.patientId);
  if (!patient) throw new NotFoundError('Patient');
  if (!patient.preferredBranchId) throw new ForbiddenError('Patient has no assigned branch');
  await assertBranchRole(db, user.id, patient.preferredBranchId, ['dentist_owner', 'dentist_associate', 'staff_full']);

  const repo = new ImportedPMDRepository(db);

  // EF-PMD-005: persist sourceDescription for audit trail data provenance
  const imported = await repo.createOne({
    patientId: body.patientId,
    sourceFacility: body.sourceFacility,
    sourceReference: body.sourceReference,
    sourceDescription: body.sourceDescription,
    content: body.content,
  });

  // V-PMD-007: importing an external PMD is a PHI ingestion event and MUST be audited
  // for data-provenance / HIPAA accountability. Never let the audit write break the import.
  const logger = ctx.get('logger');
  const branchForAudit = await getBranchOrgId(db, patient.preferredBranchId);
  await logAuditEvent(db, logger, {
    personId: user.id,
    tenantId: branchForAudit?.organizationId ?? patient.preferredBranchId,
    branchId: patient.preferredBranchId,
    action: 'pmd.import',
    resourceType: 'imported-pmd',
    resourceId: imported.id,
    metadata: { sourceFacility: body.sourceFacility, sourceDescription: body.sourceDescription },
  });

  return ctx.json({ ...imported, safetyFloorMerged: imported.safetyFloorMerged === 'true' }, 201);
}
