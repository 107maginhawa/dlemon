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
  const repo = new ErasureRequestRepository(db, logger);
  const req = await repo.createOne({
    subjectPersonId: input.subjectPersonId,
    subjectPatientId: input.subjectPatientId ?? null,
    tenantId: input.tenantId,
    branchId: input.branchId ?? null,
    reason: input.reason,
    requestedBy: input.requestedBy,
    status: 'requested',
    createdBy: input.requestedBy,
    updatedBy: input.requestedBy,
  });

  await (opts.audit ?? logAuditEvent)(db, logger, {
    personId: input.requestedBy,
    tenantId: input.tenantId,
    branchId: input.branchId ?? undefined,
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

  if (result.blockedByLegalHold) {
    const request = await repo.updateOneById(requestId, {
      status: 'rejected',
      legalHoldBlocked: true,
      rejectionReason: 'Subject under an active legal hold — erasure refused',
      reviewedBy: input.reviewedBy,
      reviewedAt: new Date(),
      updatedBy: input.reviewedBy,
    } as Partial<DentalErasureRequest>);
    return { request, fileIdsPendingS3Delete: [] };
  }

  const request = await repo.updateOneById(requestId, {
    status: 'anonymized',
    reviewedBy: input.reviewedBy,
    reviewedAt: new Date(),
    processedAt: new Date(),
    updatedBy: input.reviewedBy,
  } as Partial<DentalErasureRequest>);

  // Anonymization is COMMITTED + audited above. The physical S3 delete of these
  // file ids is a fail-open follow-up performed by the caller (handler scope,
  // where the storage client lives) — see approveErasureHandler.
  return { request, fileIdsPendingS3Delete: result.fileIdsPendingS3Delete };
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

  const updated = await repo.updateOneById(requestId, {
    status: 'rejected',
    rejectionReason: input.rejectionReason,
    reviewedBy: input.reviewedBy,
    reviewedAt: new Date(),
    updatedBy: input.reviewedBy,
  } as Partial<DentalErasureRequest>);

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
