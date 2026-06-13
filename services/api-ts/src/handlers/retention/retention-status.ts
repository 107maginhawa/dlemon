/**
 * retention-status.ts — retention enforcement observability (G2).
 *
 * The retention engine runs dry-run-by-default and env-gated (G2): a clinic
 * cannot otherwise tell whether records are being archived per policy, or even
 * that the cron is acting. This derives an operator-visible status from the
 * `retention.*` compliance audit events the engine already writes — last run,
 * dry-run-vs-live mode, and the last run's counts — so enforcement is verifiable
 * without DB/env access. (Surfacing it in an admin UI is G1, deferred.)
 */
import type { DatabaseInstance } from '@/core/database';
import { findAuditEventsByActions } from '@/handlers/dental-audit/audit-query.facade';

/** The run-outcome audit actions the engine writes per evaluated policy. */
export const RETENTION_RUN_ACTIONS = ['retention.dry_run', 'retention.enforced'] as const;

export interface RetentionEnforcementStatus {
  /** Whether the cron runs LIVE (RETENTION_ENFORCEMENT_ENABLED=true) or dry-run. */
  enforcementEnabled: boolean;
  /** ISO timestamp of the most recent retention run event, or null if never run. */
  lastRunAt: string | null;
  /** Mode of the most recent run event, or null if never run. */
  lastRunMode: 'enforced' | 'dry-run' | null;
  /** Count of run-outcome events observed (dry_run + enforced). */
  runsObserved: number;
  /** `actionedCount` recorded on the most recent run event. */
  lastActionedCount: number;
  /** `eligibleCount` recorded on the most recent run event. */
  lastEligibleCount: number;
}

/** Real archival is an explicit, env-gated opt-in. Anything but "true" → dry-run. */
export function isRetentionEnforcementEnabled(): boolean {
  return process.env['RETENTION_ENFORCEMENT_ENABLED'] === 'true';
}

/**
 * Summarise retention enforcement from the audit trail. Optionally tenant-scoped.
 * A clinic that has never run retention gets `lastRunAt: null` / `lastRunMode: null`
 * with `enforcementEnabled` reflecting the live env posture.
 */
export async function summarizeRetentionEnforcement(
  db: DatabaseInstance,
  tenantId?: string,
): Promise<RetentionEnforcementStatus> {
  const enforcementEnabled = isRetentionEnforcementEnabled();
  const rows = await findAuditEventsByActions(db, [...RETENTION_RUN_ACTIONS], tenantId);

  if (rows.length === 0) {
    return {
      enforcementEnabled,
      lastRunAt: null,
      lastRunMode: null,
      runsObserved: 0,
      lastActionedCount: 0,
      lastEligibleCount: 0,
    };
  }

  const latest = rows[0]!;
  const meta = (latest.metadata ?? {}) as { actionedCount?: number; eligibleCount?: number };
  return {
    enforcementEnabled,
    lastRunAt: latest.timestamp instanceof Date ? latest.timestamp.toISOString() : String(latest.timestamp),
    lastRunMode: latest.action === 'retention.enforced' ? 'enforced' : 'dry-run',
    runsObserved: rows.length,
    lastActionedCount: meta.actionedCount ?? 0,
    lastEligibleCount: meta.eligibleCount ?? 0,
  };
}
