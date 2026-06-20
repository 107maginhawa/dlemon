/**
 * Erasure workflow service (V-DG-002 / WFG-006).
 *
 * Orchestrates the two-step right-to-erasure workflow over
 * dental_erasure_request: request → approve (runs the anonymize engine) /
 * reject. Approval is the explicit opt-in that performs the (non-destructive)
 * anonymization; a legal hold blocks it. Every transition is audited; the
 * subject's PII is anonymized, never hard-deleted, and the audit trail is
 * never touched.
 *
 * RBAC (who may approve/reject) is enforced at the handler/route layer — these
 * service functions take the resolved actor ids.
 */

import type { DatabaseInstance } from '@/core/database';
import { ValidationError, NotFoundError } from '@/core/errors';
import { logAuditEvent } from '@/core/audit-logger';
import { ErasureRequestRepository } from './repos/erasure-request.repo';
import type { DentalErasureRequest } from './repos/erasure-request.schema';
import { anonymizeSubject } from './erasure-engine';
import { isPersonUnderLegalHold } from '@/handlers/dental-legalhold/legal-hold.facade';
import { getErasureSubjectPatient } from '@/handlers/patient/repos/patient-erasure.facade';
import { getBranchOrganizationId } from '@/handlers/dental-org/repos/org-erasure.facade';

export interface RequestErasureInput {
  subjectPersonId: string;
  subjectPatientId?: string | null;
  tenantId: string;
  branchId?: string | null;
  reason: string;
  requestedBy: string;
}

export interface ServiceOpts {
  audit?: typeof logAuditEvent;
  /** Test/preview hook — approval defaults to a real (dryRun:false) run. */
  dryRun?: boolean;
}

/**
 * Approve result: the updated request row plus the storage `file` ids whose S3
 * objects (and storage rows) the CALLER must physically delete after this
 * commits — the service/engine layer has no storage client. Empty when blocked,
 * dry-run, or the subject has no imaging. Recomputed each run → retry-safe.
 */
export interface ApproveErasureResult {
  request: DentalErasureRequest;
  fileIdsPendingS3Delete: string[];
}

/** Create a `requested` erasure request. Mutates no subject data. */
export async function requestErasure(
  db: DatabaseInstance,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  logger: any,
  input: RequestErasureInput,
  opts: ServiceOpts = {},
): Promise<DentalErasureRequest> {
  // FIX-001 (GAP-2): derive tenancy from the SUBJECT, do not trust the caller.
  // Resolve branch→organization from the subject's patient row and reject a
  // forged/mismatched tenantId/branchId. EM-BIL-002 class — server owns tenancy.
  let tenantId = input.tenantId;
  let branchId = input.branchId ?? null;
  const subjectPatient = await getErasureSubjectPatient(db, {
    personId: input.subjectPersonId,
    patientId: input.subjectPatientId,
  });
  // A supplied subjectPatientId that resolves to no patient is a forged/garbage
  // claim — reject it rather than silently degrading to the body-tenant fallback
  // (which would let a fake patientId bypass subject→tenant resolution).
  if (input.subjectPatientId && !subjectPatient) {
    throw new ValidationError('subjectPatientId does not reference an existing patient');
  }
  // C-4 (patients-only V1): a subject with no patient anchor has no authoritative
  // tenant source, so it would keep the caller-supplied tenantId — the exact
  // cross-tenant leak (a forged tenant attribution on a bare person the server
  // cannot validate). V1 erasure is patients-only: reject person-only subjects.
  if (!subjectPatient) {
    throw new ValidationError(
      'Erasure subject must reference a patient; person-only subjects are out of V1 erasure scope',
    );
  }
  // A forged subject claim (patient not owned by the named person) is always
  // invalid, regardless of branch resolvability.
  if (input.subjectPatientId && subjectPatient.personId !== input.subjectPersonId) {
    throw new ValidationError('subjectPatientId does not belong to subjectPersonId');
  }
  const resolvedBranchId = subjectPatient.preferredBranchId;
  const resolvedTenantId = resolvedBranchId ? await getBranchOrganizationId(db, resolvedBranchId) : null;
  if (resolvedBranchId && resolvedTenantId) {
    // Fully resolvable → the server owns tenancy; a forged/mismatched
    // caller-supplied tenantId or branchId is rejected.
    if (input.tenantId && input.tenantId !== resolvedTenantId) {
      throw new ValidationError("tenantId does not match the subject's organization");
    }
    if (input.branchId && input.branchId !== resolvedBranchId) {
      throw new ValidationError("branchId does not match the subject's branch");
    }
    tenantId = resolvedTenantId;
    branchId = resolvedBranchId;
  }
  // Unresolvable (patient has no branch, or an orphan branch) → keep the
  // supplied values; there is no authoritative source to validate against.

  const repo = new ErasureRequestRepository(db, logger);
  const req = await repo.createOne({
    subjectPersonId: input.subjectPersonId,
    subjectPatientId: input.subjectPatientId ?? null,
    tenantId,
    branchId,
    reason: input.reason,
    requestedBy: input.requestedBy,
    status: 'requested',
    createdBy: input.requestedBy,
    updatedBy: input.requestedBy,
  });

  await (opts.audit ?? logAuditEvent)(db, logger, {
    personId: input.requestedBy,
    tenantId,
    branchId: branchId ?? undefined,
    action: 'erasure.requested',
    resourceType: 'erasure_request',
    resourceId: req.id,
    eventType: 'compliance',
    metadata: { subjectPersonId: input.subjectPersonId, reason: input.reason },
  });

  return req;
}

/**
 * Approve a `requested` erasure: runs the anonymize engine. If the subject is
 * under a legal hold the request is REJECTED (blocked) and nothing is
 * anonymized; otherwise the subject's PII is anonymized and the request is
 * marked `anonymized`.
 */
export async function approveErasure(
  db: DatabaseInstance,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  logger: any,
  requestId: string,
  input: { reviewedBy: string; legalHold?: boolean },
  opts: ServiceOpts = {},
): Promise<ApproveErasureResult> {
  const repo = new ErasureRequestRepository(db, logger);
  const req = await repo.findOneById(requestId);
  if (!req) throw new NotFoundError('Erasure request not found');
  if (req.status !== 'requested') {
    throw new ValidationError(`Cannot approve an erasure request in status '${req.status}'`);
  }

  // Consult the real legal-hold store; a reviewer may also assert a hold
  // out-of-band. Either blocks erasure.
  const storeHold = await isPersonUnderLegalHold(db, req.subjectPersonId);
  const legalHold = storeHold || (input.legalHold ?? false);

  // WFG-006 concurrency: CLAIM the transition out of 'requested' BEFORE the irreversible
  // anonymize. transitionFromRequested's status='requested' conditional-WHERE means a
  // concurrent reject (or second approve) matches 0 rows and aborts — so anonymize runs at
  // most once and the record can never end up 'rejected' while the subject is in fact
  // anonymized (the approve+reject clobber). The claimed status mirrors the legalHold
  // decision (both derive from the same read), so it matches the anonymize outcome.
  const claimed = await repo.transitionFromRequested(
    requestId,
    (legalHold
      ? {
          status: 'rejected',
          legalHoldBlocked: true,
          rejectionReason: 'Subject under an active legal hold — erasure refused',
          reviewedBy: input.reviewedBy,
          reviewedAt: new Date(),
          updatedBy: input.reviewedBy,
        }
      : {
          status: 'anonymized',
          reviewedBy: input.reviewedBy,
          reviewedAt: new Date(),
          processedAt: new Date(),
          updatedBy: input.reviewedBy,
        }) as Partial<DentalErasureRequest>,
  );
  if (!claimed) {
    const cur = await repo.findOneById(requestId);
    throw new ValidationError(`Cannot approve an erasure request in status '${cur?.status ?? 'missing'}'`);
  }

  const result = await anonymizeSubject(
    db,
    logger,
    {
      subjectPersonId: req.subjectPersonId,
      subjectPatientId: req.subjectPatientId,
      tenantId: req.tenantId,
      branchId: req.branchId,
    },
    {
      dryRun: opts.dryRun ?? false, // approval IS the explicit opt-in
      legalHold,
      audit: opts.audit,
      actorId: input.reviewedBy,
    },
  );

  // Anonymization is COMMITTED + audited above (no-op when blocked). The physical S3 delete
  // of these file ids is a fail-open follow-up by the caller (handler scope, where the
  // storage client lives) — see approveErasureHandler.
  return {
    request: claimed,
    fileIdsPendingS3Delete: result.blockedByLegalHold ? [] : result.fileIdsPendingS3Delete,
  };
}

/** Reject a `requested` erasure with a reason. Mutates no subject data. */
export async function rejectErasure(
  db: DatabaseInstance,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  logger: any,
  requestId: string,
  input: { reviewedBy: string; rejectionReason: string },
  opts: ServiceOpts = {},
): Promise<DentalErasureRequest> {
  const repo = new ErasureRequestRepository(db, logger);
  const req = await repo.findOneById(requestId);
  if (!req) throw new NotFoundError('Erasure request not found');
  if (req.status !== 'requested') {
    throw new ValidationError(`Cannot reject an erasure request in status '${req.status}'`);
  }

  // WFG-006 concurrency: guarded transition (status='requested' WHERE) — a reject racing an
  // approve that already committed 'anonymized' matches 0 rows and aborts, so it can never
  // clobber an anonymized subject's record back to 'rejected'.
  const updated = await repo.transitionFromRequested(requestId, {
    status: 'rejected',
    rejectionReason: input.rejectionReason,
    reviewedBy: input.reviewedBy,
    reviewedAt: new Date(),
    updatedBy: input.reviewedBy,
  } as Partial<DentalErasureRequest>);
  if (!updated) {
    const cur = await repo.findOneById(requestId);
    throw new ValidationError(`Cannot reject an erasure request in status '${cur?.status ?? 'missing'}'`);
  }

  await (opts.audit ?? logAuditEvent)(db, logger, {
    personId: input.reviewedBy,
    tenantId: req.tenantId,
    branchId: req.branchId ?? undefined,
    action: 'erasure.rejected',
    resourceType: 'erasure_request',
    resourceId: req.id,
    eventType: 'compliance',
    metadata: { subjectPersonId: req.subjectPersonId, rejectionReason: input.rejectionReason },
  });

  return updated;
}
