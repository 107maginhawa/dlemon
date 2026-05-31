/**
 * Default data-retention policies (V-DG-001).
 *
 * These are CONSERVATIVE DEFAULTS, not legal advice. Periods/actions are
 * editable data once seeded — review them against your jurisdiction. The
 * disclaimer is stamped on every seeded row so it is visible in the policy UI.
 *
 * Defaults:
 *   - clinical / visit / attachment : ~10 years (archive)
 *   - prescription                  : ~5 years (archive)
 *   - audit                         : retain (append-only, never purged)
 */

import { and, eq, isNull } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import {
  dentalRetentionPolicies,
  type RetentionAction,
} from './repos/retention-policy.schema';

export const DEFAULT_RETENTION_DISCLAIMER =
  'DEFAULT — review against your jurisdiction (HIPAA min 6y; state dental laws vary).';

const YEAR_DAYS = 365;

export interface RetentionPolicyDefault {
  entityType: string;
  retentionPeriodDays: number;
  action: RetentionAction;
}

export const DEFAULT_RETENTION_POLICIES: RetentionPolicyDefault[] = [
  { entityType: 'clinical', retentionPeriodDays: 10 * YEAR_DAYS, action: 'archive' },
  { entityType: 'visit', retentionPeriodDays: 10 * YEAR_DAYS, action: 'archive' },
  { entityType: 'attachment', retentionPeriodDays: 10 * YEAR_DAYS, action: 'archive' },
  { entityType: 'prescription', retentionPeriodDays: 5 * YEAR_DAYS, action: 'archive' },
  // The audit trail is append-only and must never be purged — declared
  // explicitly so operators see it in the registry. The engine also hard-refuses
  // the protected `audit` target regardless of this row.
  { entityType: 'audit', retentionPeriodDays: 7 * YEAR_DAYS, action: 'retain' },
];

/**
 * Idempotently seed the default policy set for a tenant. A policy is skipped if
 * a tenant-wide (branchId NULL) row already exists for that entityType, so
 * re-running never duplicates and never clobbers operator edits.
 *
 * Returns the number of rows inserted.
 */
export async function seedDefaultRetentionPolicies(
  db: DatabaseInstance,
  tenantId: string,
  opts: { createdBy?: string | null } = {},
): Promise<number> {
  let inserted = 0;
  for (const def of DEFAULT_RETENTION_POLICIES) {
    const existing = await db
      .select({ id: dentalRetentionPolicies.id })
      .from(dentalRetentionPolicies)
      .where(
        and(
          eq(dentalRetentionPolicies.tenantId, tenantId),
          isNull(dentalRetentionPolicies.branchId),
          eq(dentalRetentionPolicies.entityType, def.entityType),
        ),
      );
    if (existing.length > 0) continue;

    await db.insert(dentalRetentionPolicies).values({
      tenantId,
      branchId: null,
      entityType: def.entityType,
      retentionPeriodDays: def.retentionPeriodDays,
      action: def.action,
      enabled: true,
      legalHoldExempt: false,
      notes: DEFAULT_RETENTION_DISCLAIMER,
      createdBy: opts.createdBy ?? null,
      updatedBy: opts.createdBy ?? null,
    });
    inserted++;
  }
  return inserted;
}
