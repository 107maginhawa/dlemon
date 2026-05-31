/**
 * Built-in retention targets (V-DG-001).
 *
 * A target binds a policy `entityType` to concrete, tenant/branch-scoped table
 * operations. Domains register a target here (or inject their own registry)
 * rather than editing the engine. Targets only ever SOFT-archive — the engine
 * has no hard-delete path.
 *
 * Legal-hold: no legal-hold store exists in the codebase yet, so the hold
 * predicate currently reports `false` for every candidate. When a legal-hold
 * table lands, wire it into each target's `findEligible` — the engine already
 * excludes anything flagged held (see retention-engine.test.ts).
 */

import { and, eq, isNull, lte, inArray } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import type { RetentionTarget, RetentionTargetRegistry } from './retention-engine';
import { dentalAttachments } from '@/handlers/dental-clinical/repos/attachment.schema';
import { dentalVisits } from '@/handlers/dental-visit/repos/visit.schema';
import { dentalBranches } from '@/handlers/dental-org/repos/branch.schema';

/**
 * Imaging attachments (x-ray/photo/scan). Scoped through the owning visit's
 * branch; a tenant-wide policy (branchId = null) resolves the branch's
 * organization. Soft-archives by stamping `deletedAt`.
 */
const attachmentTarget: RetentionTarget = {
  entityType: 'attachment',
  async findEligible(db: DatabaseInstance, { tenantId, branchId, cutoff }) {
    const rows = branchId
      ? await db
          .select({ id: dentalAttachments.id })
          .from(dentalAttachments)
          .innerJoin(dentalVisits, eq(dentalAttachments.visitId, dentalVisits.id))
          .where(
            and(
              isNull(dentalAttachments.deletedAt),
              lte(dentalAttachments.createdAt, cutoff),
              eq(dentalVisits.branchId, branchId),
            ),
          )
      : await db
          .select({ id: dentalAttachments.id })
          .from(dentalAttachments)
          .innerJoin(dentalVisits, eq(dentalAttachments.visitId, dentalVisits.id))
          .innerJoin(dentalBranches, eq(dentalVisits.branchId, dentalBranches.id))
          .where(
            and(
              isNull(dentalAttachments.deletedAt),
              lte(dentalAttachments.createdAt, cutoff),
              eq(dentalBranches.organizationId, tenantId),
            ),
          );

    // No legal-hold store yet → nothing is held. Wire the predicate here later.
    return rows.map((r) => ({ id: r.id, legalHold: false }));
  },
  async archive(db: DatabaseInstance, ids: string[]) {
    if (ids.length === 0) return 0;
    const res = await db
      .update(dentalAttachments)
      .set({ deletedAt: new Date() })
      .where(and(inArray(dentalAttachments.id, ids), isNull(dentalAttachments.deletedAt)))
      .returning({ id: dentalAttachments.id });
    return res.length;
  },
};

/**
 * The audit trail is append-only and must NEVER be purged. Marked `protected`,
 * so the engine refuses it before any read or write. Present in the registry so
 * an `audit` policy row resolves to an explicit, audited refusal rather than a
 * silent no-target skip.
 */
const auditTarget: RetentionTarget = {
  entityType: 'audit',
  protected: true,
  async findEligible() {
    return [];
  },
  async archive() {
    return 0;
  },
};

export const RETENTION_TARGETS: RetentionTargetRegistry = {
  attachment: attachmentTarget,
  audit: auditTarget,
};
