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
import type { Logger } from '@/types/logger';
import { UnauthorizedError, ForbiddenError, BusinessLogicError } from '@/core/errors';
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

/** Minimal visit shape the PMD snapshot needs (visit row satisfies it). */
export interface VisitForPmd {
  id: string;
  patientId: string;
  branchId: string;
  activatedAt: Date | null;
  createdAt: Date;
}

/**
 * Reusable PMD generation core (AHA FIX-001). Builds the checksum-sealed
 * snapshot and creates — or supersedes the existing — PMD for a completed/locked
 * visit, then writes the pmd.generate + pmd.generated audit rows.
 *
 * Callable in-process (no HTTP self-call) by BOTH the generatePMD HTTP handler
 * and the visit-completion auto-generation trigger (WF-021/FR12.1). It is
 * idempotent by construction: a second call for the same visit supersedes the
 * existing document (BR-021) rather than duplicating it.
 *
 * Callers are responsible for authorization + visit-status gating; this core
 * assumes the visit is generation-eligible.
 */
export async function generatePmdForVisit(
  db: DatabaseInstance,
  opts: { visit: VisitForPmd; actorUserId: string; logger?: Logger },
) {
  const { visit, actorUserId, logger } = opts;
  const visitId = visit.id;

  // Resolve membership ID from personId + branchId
  const membership = await getActiveMembershipId(db, actorUserId, visit.branchId);
  if (!membership) throw new ForbiddenError('No active membership at this branch');

  const patientId = visit.patientId;

  // Collect visit data snapshot
  const treatments = await getTreatmentsForPMD(db, visitId);
  const prescriptions = await getPrescriptionsForPMD(db, visitId);

  // EF-PMD-004: authorMemberId must be included in the snapshot before hashing
  // so that the checksum binds the author identity to the content (non-repudiation).
  const contentSnapshot = JSON.stringify({
    visitId,
    patientId,
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

  // Check if existing PMD for this visit — if so, supersede it (idempotent).
  const existing = await pmdRepo.findByVisit(visitId);

  let pmd;
  if (existing) {
    pmd = await pmdRepo.supersede(existing.id, {
      visitId,
      patientId,
      authorMemberId: membership.id,
      branchId: visit.branchId,
      content: contentSnapshot,
      checksum,
    });
  } else {
    pmd = await pmdRepo.createOne({
      visitId,
      patientId,
      authorMemberId: membership.id,
      branchId: visit.branchId,
      content: contentSnapshot,
      checksum,
    });
  }

  const branchForAudit = await getBranchOrgId(db, visit.branchId);
  const tenantId = branchForAudit?.organizationId ?? visit.branchId;
  await logAuditEvent(db, logger, {
    personId: actorUserId,
    tenantId,
    branchId: visit.branchId,
    action: 'pmd.generate',
    resourceType: 'pmd',
    resourceId: pmd.id,
  });

  // V-PMD-004 / DE-017 PMDGenerated: per ADR-006 (domain-events-descope) there is NO
  // event bus — the domain event is satisfied by writing the corresponding audit-log
  // row synchronously. Reactive consumers (notifs download-link, dental-audit) are
  // deferred to a future phase. No publisher/emit scaffolding is required.
  await logAuditEvent(db, logger, {
    personId: actorUserId,
    tenantId,
    branchId: visit.branchId,
    action: 'pmd.generated',
    resourceType: 'pmd',
    resourceId: pmd.id,
    metadata: { event: 'DE-017', visitId },
  });

  return pmd;
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

  // V-PMD-003 (AC-PMD-001): generating from a non-completed/non-locked visit is a
  // business-rule violation (BR-021), not a malformed request → 422 VISIT_NOT_COMPLETED.
  if (visit.status !== 'completed' && visit.status !== 'locked') {
    throw new BusinessLogicError(
      'PMD can only be generated from a completed or locked visit',
      'VISIT_NOT_COMPLETED',
    );
  }

  // N-PMD-02 (immutable-record integrity): the PMD's patient identity is derived from
  // the visit, the single source of truth (same rule as branch_id; see API_CONTRACTS.md).
  // The request body must not be able to bind an arbitrary patient into a checksum-sealed,
  // non-repudiation PMD record. A body.patientId that disagrees with the visit is rejected;
  // the immutable record below (in the shared core) uses `visit.patientId` exclusively so
  // the body cannot influence the sealed content.
  if (body.patientId !== visit.patientId) {
    throw new BusinessLogicError(
      'patientId does not match the visit patient',
      'PATIENT_VISIT_MISMATCH',
    );
  }

  const pmd = await generatePmdForVisit(db, {
    visit,
    actorUserId: user.id,
    logger: ctx.get('logger'),
  });

  return ctx.json(pmd, 201);
}
