/**
 * Right-to-erasure anonymization engine (V-DG-002 / WFG-006).
 *
 * The on-demand counterpart to the V-DG-001 retention engine. It walks a
 * registry of anonymizable targets for a subject Person and REDACTS their PII
 * in place. The hard SAFETY INVARIANTS live here, so they hold no matter how a
 * caller invokes it:
 *
 *   1. DRY-RUN by default. Real anonymization only when `dryRun: false`.
 *   2. ANONYMIZE, never hard-delete. Targets redact PII and keep the row.
 *   3. NEVER touch the audit trail. Audit is not a target; the engine only
 *      ever APPENDS its own audit record — it has no purge/modify path.
 *   4. LEGAL-HOLD blocks erasure. A held subject is refused outright (audited),
 *      with no target touched.
 *   5. Fully audited. Every run writes an audit event via the injected writer
 *      (defaults to logAuditEvent, the append-only sink). Erasure is logged as
 *      a `security` event so an audit-write failure fails the operation closed.
 */

import type { DatabaseInstance } from '@/core/database';
import { logAuditEvent } from '@/core/audit-logger';

/** System actor recorded as the audit personId for erasure actions. */
export const ERASURE_SYSTEM_ACTOR = '00000000-0000-4000-8000-0000000000e2';

/**
 * What a target reports after anonymizing. A bare `number` is the count of rows
 * acted on (the common case). A target whose anonymization leaves backing S3
 * objects requiring a physical follow-up delete returns the richer object form,
 * surfacing those storage `file` ids up to handler scope (where the storage
 * client lives) — the repo-layer engine never touches S3 itself.
 */
export interface ErasureTargetReport {
  count: number;
  /** Storage `file` ids whose S3 objects + rows must be physically deleted. */
  fileIdsPendingS3Delete?: string[];
}

export interface ErasureTarget {
  entityType: string;
  /** Anonymize this entity's PII for the subject person. Returns count acted on. */
  anonymize(
    db: DatabaseInstance,
    subjectPersonId: string,
  ): Promise<number | ErasureTargetReport>;
}

export type ErasureTargetRegistry = Record<string, ErasureTarget>;

export interface ErasureSubject {
  subjectPersonId: string;
  subjectPatientId?: string | null;
  tenantId: string;
  branchId?: string | null;
}

export type ErasureOutcome = 'dry-run' | 'anonymized' | 'legal-hold-blocked' | 'noop';

export interface ErasureTargetResult {
  entityType: string;
  anonymizedCount: number;
}

export interface ErasureResult {
  subjectPersonId: string;
  tenantId: string;
  dryRun: boolean;
  blockedByLegalHold: boolean;
  outcome: ErasureOutcome;
  targets: ErasureTargetResult[];
  totalAnonymized: number;
  /**
   * Storage `file` ids whose S3 objects (and storage `file` rows) the caller
   * MUST physically delete AFTER the anonymization commits — the engine runs at
   * the repo layer and has no storage client. Aggregated across all targets;
   * recomputed each run so a retry re-deletes (idempotent). Empty on dry-run /
   * legal-hold-block / when no target surfaces storage handles.
   */
  fileIdsPendingS3Delete: string[];
}

export interface AnonymizeOptions {
  /** Defaults to TRUE — real anonymization is an explicit opt-in. */
  dryRun?: boolean;
  /** When true the subject is under an active legal hold → refuse. */
  legalHold?: boolean;
  /** Target registry; defaults to the built-in ERASURE_TARGETS. */
  targets?: ErasureTargetRegistry;
  /** Injectable audit writer; defaults to the append-only logAuditEvent. */
  audit?: typeof logAuditEvent;
  /** Actor who triggered the erasure (recorded in the audit metadata). */
  actorId?: string;
}

export async function anonymizeSubject(
  db: DatabaseInstance,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  logger: any,
  subject: ErasureSubject,
  options: AnonymizeOptions = {},
): Promise<ErasureResult> {
  const dryRun = options.dryRun ?? true; // SAFETY: dry-run unless explicitly disabled
  const targets = options.targets ?? ERASURE_TARGETS;
  const audit = options.audit ?? logAuditEvent;
  const legalHold = options.legalHold ?? false;

  const base = {
    subjectPersonId: subject.subjectPersonId,
    tenantId: subject.tenantId,
    dryRun,
    blockedByLegalHold: false,
    targets: [] as ErasureTargetResult[],
    totalAnonymized: 0,
    fileIdsPendingS3Delete: [] as string[],
  };

  // (4) LEGAL-HOLD: a held subject is never anonymized.
  if (legalHold) {
    const result: ErasureResult = { ...base, blockedByLegalHold: true, outcome: 'legal-hold-blocked' };
    await writeAudit(audit, db, logger, subject, result, 'erasure.blocked_legal_hold', options.actorId);
    return result;
  }

  // (1) DRY-RUN: report intent, touch nothing.
  if (dryRun) {
    const result: ErasureResult = { ...base, outcome: 'dry-run' };
    await writeAudit(audit, db, logger, subject, result, 'erasure.dry_run', options.actorId);
    return result;
  }

  // Live anonymization: walk every target, aggregating any storage `file` ids
  // that still need a physical S3 delete (the engine never touches S3 itself).
  const targetResults: ErasureTargetResult[] = [];
  const fileIdsPendingS3Delete: string[] = [];
  let total = 0;
  for (const target of Object.values(targets)) {
    const report = await target.anonymize(db, subject.subjectPersonId);
    const anonymizedCount = typeof report === 'number' ? report : report.count;
    if (typeof report !== 'number' && report.fileIdsPendingS3Delete?.length) {
      fileIdsPendingS3Delete.push(...report.fileIdsPendingS3Delete);
    }
    targetResults.push({ entityType: target.entityType, anonymizedCount });
    total += anonymizedCount;
  }

  const result: ErasureResult = {
    ...base,
    targets: targetResults,
    totalAnonymized: total,
    fileIdsPendingS3Delete,
    outcome: total > 0 ? 'anonymized' : 'noop',
  };

  // (5) Fully audited — the audit trail is APPENDED to, never modified.
  await writeAudit(audit, db, logger, subject, result, 'erasure.anonymized', options.actorId);
  return result;
}

async function writeAudit(
  audit: typeof logAuditEvent,
  db: DatabaseInstance,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  logger: any,
  subject: ErasureSubject,
  result: ErasureResult,
  action: string,
  actorId?: string,
): Promise<void> {
  await audit(db, logger, {
    personId: actorId ?? ERASURE_SYSTEM_ACTOR,
    tenantId: subject.tenantId,
    branchId: subject.branchId ?? undefined,
    action,
    resourceType: 'erasure_request',
    resourceId: subject.subjectPersonId,
    eventType: 'security', // identity erasure is security-sensitive → fail-closed audit
    metadata: {
      subjectPersonId: subject.subjectPersonId,
      subjectPatientId: subject.subjectPatientId ?? null,
      dryRun: result.dryRun,
      blockedByLegalHold: result.blockedByLegalHold,
      outcome: result.outcome,
      totalAnonymized: result.totalAnonymized,
      targets: result.targets,
      filesPendingS3Delete: result.fileIdsPendingS3Delete.length,
    },
  });
}

// Built-in target registry lives in ./erasure-targets to keep the engine free
// of concrete facade imports.
import { ERASURE_TARGETS } from './erasure-targets';
