/**
 * Built-in retention targets (V-DG-001).
 *
 * A target binds a policy `entityType` to concrete, tenant/branch-scoped table
 * operations. Domains register a target here (or inject their own registry)
 * rather than editing the engine. Targets only ever SOFT-archive — the engine
 * has no hard-delete path.
 *
 * Cross-module data access goes through each owning module's `*.facade.ts`
 * (Phase 10 boundary lint) — never the other module's repos/schemas directly.
 *
 * Legal-hold: no legal-hold store exists in the codebase yet, so the hold
 * predicate currently reports `false` for every candidate. When a legal-hold
 * table lands, surface it from the owning facade — the engine already excludes
 * anything flagged held (see retention-engine.test.ts).
 */

import type { DatabaseInstance } from '@/core/database';
import type { RetentionTarget, RetentionTargetRegistry } from './retention-engine';
import {
  findArchivableAttachmentIds,
  archiveAttachments,
} from '@/handlers/dental-clinical/repos/attachment-retention.facade';

/**
 * Imaging attachments (x-ray/photo/scan), scoped through the owning visit's
 * branch. Reads/writes via the dental-clinical facade; soft-archives only.
 */
const attachmentTarget: RetentionTarget = {
  entityType: 'attachment',
  async findEligible(db: DatabaseInstance, { tenantId, branchId, cutoff }) {
    const ids = await findArchivableAttachmentIds(db, { tenantId, branchId, cutoff });
    // No legal-hold store yet → nothing is held. Surface it from the facade later.
    return ids.map((id) => ({ id, legalHold: false }));
  },
  async archive(db: DatabaseInstance, ids: string[]) {
    return archiveAttachments(db, ids);
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

/** Entity types that currently have a real enforcement target wired. */
export const SUPPORTED_RETENTION_ENTITY_TYPES = Object.keys(RETENTION_TARGETS);
