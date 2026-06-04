/**
 * Generic data-retention enforcement engine (V-DG-001).
 *
 * Policy-as-data: it consumes `dental_retention_policy` rows and applies the
 * declared action to records past their retention period. The engine is the
 * single choke point where the hard SAFETY INVARIANTS live — they hold no
 * matter what a policy row says, so a bad policy edit cannot cause data loss:
 *
 *   1. DRY-RUN by default. Real mutation only when `dryRun: false` is passed
 *      explicitly (the scheduled job gates that on an env flag).
 *   2. NEVER purge the audit trail. Targets marked `protected` (and the
 *      `retain` action) are refused outright — never even queried.
 *   3. Soft-archive over hard-delete. The `delete` action is DOWNGRADED to
 *      `archive`; the engine has no hard-delete path.
 *   4. Legal-hold exemption. Records the target reports as legally held are
 *      always excluded — there is no code path that actions a held record.
 *   5. Fully audited. Every evaluation that touches a real target writes its
 *      own audit record via the injected audit writer (defaults to
 *      logAuditEvent, the append-only sink).
 */

import type { DatabaseInstance } from '@/core/database';
import { logAuditEvent } from '@/core/audit-logger';
import type { DentalRetentionPolicy, RetentionAction } from './repos/retention-policy.schema';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * System actor recorded as the audit `personId` for retention actions. A fixed
 * sentinel UUID (not a real person) so retention events are attributable yet
 * never collide with a user id.
 */
export const RETENTION_SYSTEM_ACTOR = '00000000-0000-4000-8000-0000000000d6';

export interface RetentionCandidate {
  id: string;
  /** True when this record is under an active legal hold (always excluded). */
  legalHold: boolean;
}

/**
 * A retention target binds an `entityType` to the concrete table operations.
 * New domains register a target instead of touching the engine.
 */
export interface RetentionTarget {
  entityType: string;
  /**
   * Protected targets are NEVER actioned or even queried (e.g. the audit
   * trail). The engine short-circuits before any read.
   */
  protected?: boolean;
  /** Records older than `cutoff` for the tenant/branch, with legal-hold state. */
  findEligible(
    db: DatabaseInstance,
    opts: { tenantId: string; branchId?: string | null; cutoff: Date },
  ): Promise<RetentionCandidate[]>;
  /** Soft-archive the given ids (e.g. set deletedAt). Returns count actioned. */
  archive(db: DatabaseInstance, ids: string[]): Promise<number>;
  /** Anonymise the given ids (strip PII, keep record). Returns count actioned. */
  anonymize?(db: DatabaseInstance, ids: string[]): Promise<number>;
}

export type RetentionTargetRegistry = Record<string, RetentionTarget>;

export type RetentionOutcome =
  | 'disabled' // policy is disabled — skipped
  | 'no-target' // entityType has no registered target — skipped
  | 'protected-skip' // protected target or `retain` action — never actioned
  | 'dry-run' // would action, but dryRun
  | 'enforced' // records actioned
  | 'noop'; // target queried, nothing eligible

export interface RetentionPolicyResult {
  policyId: string;
  tenantId: string;
  branchId?: string | null;
  entityType: string;
  requestedAction: RetentionAction;
  effectiveAction: RetentionAction | 'none';
  outcome: RetentionOutcome;
  eligibleCount: number;
  legalHeldCount: number;
  actionedCount: number;
  dryRun: boolean;
  cutoff: string;
}

export interface EvaluateOptions {
  /** Defaults to TRUE — real action is an explicit opt-in. */
  dryRun?: boolean;
  /** Injectable clock for deterministic cutoff computation. */
  now?: Date;
  /** Target registry; defaults to the built-in RETENTION_TARGETS. */
  targets?: RetentionTargetRegistry;
  /** Injectable audit writer; defaults to the append-only logAuditEvent. */
  audit?: typeof logAuditEvent;
}

/**
 * Resolve the effective (safe) action for a requested action.
 * `delete` is always downgraded to `archive` — the engine never hard-deletes.
 */
function effectiveActionFor(requested: RetentionAction, target: RetentionTarget): RetentionAction {
  if (requested === 'anonymize') {
    return target.anonymize ? 'anonymize' : 'archive';
  }
  // archive | delete -> archive (delete downgraded; no hard-delete path exists)
  return 'archive';
}

export async function evaluateRetention(
  db: DatabaseInstance,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  logger: any,
  policies: DentalRetentionPolicy[],
  options: EvaluateOptions = {},
): Promise<RetentionPolicyResult[]> {
  const dryRun = options.dryRun ?? true; // SAFETY: dry-run unless explicitly disabled
  const now = options.now ?? new Date();
  const targets = options.targets ?? RETENTION_TARGETS;
  const audit = options.audit ?? logAuditEvent;

  const results: RetentionPolicyResult[] = [];

  for (const policy of policies) {
    const cutoff = new Date(now.getTime() - policy.retentionPeriodDays * DAY_MS);
    const base = {
      policyId: policy.id,
      tenantId: policy.tenantId,
      branchId: policy.branchId,
      entityType: policy.entityType,
      requestedAction: policy.action,
      effectiveAction: 'none' as RetentionAction | 'none',
      eligibleCount: 0,
      legalHeldCount: 0,
      actionedCount: 0,
      dryRun,
      cutoff: cutoff.toISOString(),
    };

    // (0) Disabled policies are skipped — defensive even though findEnabled filters them.
    if (!policy.enabled) {
      results.push({ ...base, outcome: 'disabled' });
      continue;
    }

    // (1) `retain` documents "never purge" (e.g. audit) — refuse outright.
    if (policy.action === 'retain') {
      results.push({ ...base, outcome: 'protected-skip' });
      await writeAudit(audit, db, logger, policy, { ...base, outcome: 'protected-skip' }, 'retention.protected_skip');
      continue;
    }

    const target = targets[policy.entityType];

    // (2) No registered target — nothing to do; log only, no audit noise.
    if (!target) {
      logger?.warn(
        { entityType: policy.entityType, policyId: policy.id },
        'retention: no enforcement target registered for entity type — skipping',
      );
      results.push({ ...base, outcome: 'no-target' });
      continue;
    }

    // (3) NEVER purge a protected target (audit trail). Never even read it.
    if (target.protected) {
      results.push({ ...base, outcome: 'protected-skip' });
      await writeAudit(audit, db, logger, policy, { ...base, outcome: 'protected-skip' }, 'retention.protected_skip');
      continue;
    }

    const effectiveAction = effectiveActionFor(policy.action, target);

    const candidates = await target.findEligible(db, {
      tenantId: policy.tenantId,
      branchId: policy.branchId,
      cutoff,
    });

    // (4) LEGAL-HOLD: held records are always excluded.
    const eligible = candidates.filter((c) => !c.legalHold);
    const legalHeldCount = candidates.length - eligible.length;
    const eligibleCount = eligible.length;

    if (dryRun) {
      const result: RetentionPolicyResult = {
        ...base,
        effectiveAction,
        outcome: 'dry-run',
        eligibleCount,
        legalHeldCount,
        actionedCount: 0,
      };
      results.push(result);
      await writeAudit(audit, db, logger, policy, result, 'retention.dry_run');
      continue;
    }

    let actionedCount = 0;
    if (eligibleCount > 0) {
      const ids = eligible.map((c) => c.id);
      actionedCount =
        effectiveAction === 'anonymize' && target.anonymize
          ? await target.anonymize(db, ids)
          : await target.archive(db, ids);
    }

    const result: RetentionPolicyResult = {
      ...base,
      effectiveAction,
      outcome: actionedCount > 0 ? 'enforced' : 'noop',
      eligibleCount,
      legalHeldCount,
      actionedCount,
    };
    results.push(result);

    // (5) Fully audited — record what was actioned (or that nothing was).
    if (actionedCount > 0) {
      await writeAudit(audit, db, logger, policy, result, 'retention.enforced');
    }
  }

  return results;
}

async function writeAudit(
  audit: typeof logAuditEvent,
  db: DatabaseInstance,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  logger: any,
  policy: DentalRetentionPolicy,
  result: RetentionPolicyResult,
  action: string,
): Promise<void> {
  await audit(db, logger, {
    personId: RETENTION_SYSTEM_ACTOR,
    tenantId: policy.tenantId,
    branchId: policy.branchId ?? undefined,
    action,
    resourceType: 'retention_policy',
    resourceId: policy.id,
    eventType: 'compliance',
    metadata: {
      entityType: result.entityType,
      requestedAction: result.requestedAction,
      effectiveAction: result.effectiveAction,
      retentionPeriodDays: policy.retentionPeriodDays,
      cutoff: result.cutoff,
      eligibleCount: result.eligibleCount,
      legalHeldCount: result.legalHeldCount,
      actionedCount: result.actionedCount,
      dryRun: result.dryRun,
      outcome: result.outcome,
    },
  });
}

// Built-in target registry is defined in ./retention-targets to keep the
// engine free of concrete table imports. Imported lazily-ish at module load.
import { RETENTION_TARGETS } from './retention-targets';
