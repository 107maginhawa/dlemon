/**
 * generatePMD handler
 *
 * POST /dental/visits/{visitId}/pmd
 * Generates an immutable PMD document from a completed visit.
 * Only completed or locked visits can generate a PMD.
 */

import { createHash } from 'node:crypto';
import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { ValidationError, UnauthorizedError, ForbiddenError } from '@/core/errors';
import { getVisitOrThrow } from '@/handlers/dental-visit/utils/visit.service';
import { PMDDocumentRepository } from './repos/pmd-document.repo';
import { getTreatmentsForPMD } from '@/handlers/dental-visit/repos/visit-pmd.facade';
import { getPrescriptionsForPMD } from '@/handlers/dental-clinical/repos/clinical-pmd.facade';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { getActiveMembershipId, getBranchOrgId } from '@/handlers/dental-org/repos/org-billing.facade';
import { logAuditEvent } from '@/core/audit-logger';
import type { User } from '@/types/auth';
import type { GeneratePMDBody, GeneratePMDParams } from '@/generated/openapi/validators';

/**
 * EM-PMD-005: Real SHA-256 via node:crypto.
 * NOTE: Prior implementation used a charcode sum producing a 16-char hex.
 * Existing PMD documents in the DB retain those legacy checksums; they are
 * not cryptographically valid but are acceptable for V1. New documents use
 * the standard 64-char SHA-256 hex digest.
 */
function sha256Hex(content: string): string {
  return `sha256-${createHash('sha256').update(content).digest('hex')}`;
}

export async function generatePMD(
  ctx: ValidatedContext<GeneratePMDBody, never, GeneratePMDParams>
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { visitId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');

  const db = ctx.get('database') as DatabaseInstance;
  const visit = await getVisitOrThrow(db, visitId);
  await assertBranchRole(db, user.id, visit.branchId, ['dentist_owner', 'dentist_associate']);

  // Resolve membership ID from personId + branchId
  const membership = await getActiveMembershipId(db, user.id, visit.branchId);
  if (!membership) throw new ForbiddenError('No active membership at this branch');

  if (visit.status !== 'completed' && visit.status !== 'locked') {
    throw new ValidationError('PMD can only be generated from a completed or locked visit');
  }

  // Collect visit data snapshot
  const treatments = await getTreatmentsForPMD(db, visitId);
  const prescriptions = await getPrescriptionsForPMD(db, visitId);

  // EF-PMD-004: authorMemberId must be included in the snapshot before hashing
  // so that the checksum binds the author identity to the content (non-repudiation).
  const contentSnapshot = JSON.stringify({
    visitId,
    patientId: body.patientId,
    authorMemberId: membership.id,
    visitDate: visit.activatedAt ?? visit.createdAt,
    treatments: treatments.map(t => ({
      id: t.id,
      cdtCode: t.cdtCode,
      description: t.description,
      toothNumber: t.toothNumber,
      surfaces: t.surfaces,
      conditionCode: t.conditionCode,
      status: t.status,
      priceCents: t.priceCents,
    })),
    prescriptions: prescriptions.map(rx => ({
      id: rx.id,
      rxNormCode: rx.rxNormCode,
      drugName: rx.drugName,
      dosage: rx.dosage,
      frequency: rx.frequency,
    })),
  });

  const checksum = sha256Hex(contentSnapshot);

  const pmdRepo = new PMDDocumentRepository(db);

  // Check if existing PMD for this visit — if so, supersede it
  const existing = await pmdRepo.findByVisit(visitId);

  let pmd;
  if (existing) {
    pmd = await pmdRepo.supersede(existing.id, {
      visitId,
      patientId: body.patientId,
      authorMemberId: membership.id,
      branchId: visit.branchId,
      content: contentSnapshot,
      checksum,
    });
  } else {
    pmd = await pmdRepo.createOne({
      visitId,
      patientId: body.patientId,
      authorMemberId: membership.id,
      branchId: visit.branchId,
      content: contentSnapshot,
      checksum,
    });
  }

  const logger = ctx.get('logger');
  const branchForAudit = await getBranchOrgId(db, visit.branchId);
  await logAuditEvent(db, logger, {
    personId: user.id,
    tenantId: branchForAudit?.organizationId ?? visit.branchId,
    branchId: visit.branchId,
    action: 'pmd.generate',
    resourceType: 'pmd',
    resourceId: pmd.id,
  });

  return ctx.json(pmd, 201);
}
