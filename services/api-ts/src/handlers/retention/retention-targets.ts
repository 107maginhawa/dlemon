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
 * Legal-hold: each target queries the real `dental_legal_hold` store via
 * `personsUnderLegalHold` and flags any candidate whose owning Person has an
 * ACTIVE hold; the engine then excludes every flagged candidate from action
 * (see retention-legalhold.test.ts). The hold predicate is never bypassable by
 * a policy row's `legalHoldExempt` flag.
 */

import type { DatabaseInstance } from '@/core/database';
import type { RetentionTarget, RetentionTargetRegistry } from './retention-engine';
import {
  findArchivableAttachmentSubjects,
  archiveAttachments,
} from '@/handlers/dental-clinical/repos/attachment-retention.facade';
import {
  findArchivableAppointmentSubjects,
  archiveAppointments,
} from '@/handlers/dental-scheduling/repos/dental-appointment-retention.facade';
import { personsUnderLegalHold } from '@/handlers/dental-legalhold/legal-hold.facade';

/**
 * Imaging attachments (x-ray/photo/scan), scoped through the owning visit's
 * branch. Reads/writes via the dental-clinical facade; soft-archives only.
 */
const attachmentTarget: RetentionTarget = {
  entityType: 'attachment',
  async findEligible(db: DatabaseInstance, { tenantId, branchId, cutoff }) {
    const subjects = await findArchivableAttachmentSubjects(db, { tenantId, branchId, cutoff });
    // Legal-hold exclusion: attachments whose owning Person is under an active
    // hold are flagged held, and the engine excludes them.
    const held = await personsUnderLegalHold(db, subjects.map((s) => s.personId));
    return subjects.map((s) => ({ id: s.id, legalHold: held.has(s.personId) }));
  },
  async archive(db: DatabaseInstance, ids: string[]) {
    return archiveAttachments(db, ids);
  },
};

/**
 * Appointments (V-DG-003). DATA_GOVERNANCE §2 declares "1 year from date" —
 * the appointment DATE — so eligibility filters on `scheduledAt`, not createdAt.
 * Reads/writes via the dental-scheduling facade; soft-archives only (set
 * `deletedAt`). Legal-hold: an appointment whose owning patient's Person is
 * under an active hold is flagged held, and the engine excludes it.
 */
const appointmentTarget: RetentionTarget = {
  entityType: 'appointment',
  async findEligible(db: DatabaseInstance, { tenantId, branchId, cutoff }) {
    const subjects = await findArchivableAppointmentSubjects(db, { tenantId, branchId, cutoff });
    const held = await personsUnderLegalHold(db, subjects.map((s) => s.personId));
    return subjects.map((s) => ({ id: s.id, legalHold: held.has(s.personId) }));
  },
  async archive(db: DatabaseInstance, ids: string[]) {
    return archiveAppointments(db, ids);
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
  appointment: appointmentTarget,
  audit: auditTarget,
};

/** Entity types that currently have a real enforcement target wired. */
export const SUPPORTED_RETENTION_ENTITY_TYPES = Object.keys(RETENTION_TARGETS);
