/**
 * attachment-retention.facade.ts
 *
 * Facade exposing dental-clinical attachment retention operations to the
 * `retention` module. Keeps the cross-module join (attachment → visit → branch)
 * INSIDE dental-clinical, so the retention module imports only this facade —
 * never the underlying repos/schemas directly (Phase 10 boundary lint; the
 * facade pattern is the migration destination, exempt from check:boundaries).
 *
 * Used by the V-DG-001 retention engine's `attachment` target.
 */

import { and, eq, isNull, lte, inArray } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { dentalAttachments } from './attachment.schema';
import { dentalVisits } from '../../dental-visit/repos/visit.schema';
import { dentalBranches } from '../../dental-org/repos/branch.schema';
import { patients } from '../../patient/repos/patient.schema';

export interface ArchivableAttachmentQuery {
  tenantId: string;
  branchId?: string | null;
  cutoff: Date;
}

export interface ArchivableAttachmentSubject {
  id: string;
  /** The owning patient's Person — used for the legal-hold check. */
  personId: string;
}

/**
 * IDs of non-deleted attachments created on/before `cutoff`, scoped to a branch
 * (when `branchId` is given) or the whole tenant/organization (branchId null),
 * resolved through the owning visit's branch.
 */
export async function findArchivableAttachmentIds(
  db: DatabaseInstance,
  { tenantId, branchId, cutoff }: ArchivableAttachmentQuery,
): Promise<string[]> {
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

  return rows.map((r) => r.id);
}

/**
 * Like findArchivableAttachmentIds but also returns each attachment's owning
 * Person id (via patient), so the retention engine can apply the legal-hold
 * exclusion per subject.
 */
export async function findArchivableAttachmentSubjects(
  db: DatabaseInstance,
  { tenantId, branchId, cutoff }: ArchivableAttachmentQuery,
): Promise<ArchivableAttachmentSubject[]> {
  const rows = branchId
    ? await db
        .select({ id: dentalAttachments.id, personId: patients.person })
        .from(dentalAttachments)
        .innerJoin(dentalVisits, eq(dentalAttachments.visitId, dentalVisits.id))
        .innerJoin(patients, eq(dentalAttachments.patientId, patients.id))
        .where(
          and(
            isNull(dentalAttachments.deletedAt),
            lte(dentalAttachments.createdAt, cutoff),
            eq(dentalVisits.branchId, branchId),
          ),
        )
    : await db
        .select({ id: dentalAttachments.id, personId: patients.person })
        .from(dentalAttachments)
        .innerJoin(dentalVisits, eq(dentalAttachments.visitId, dentalVisits.id))
        .innerJoin(dentalBranches, eq(dentalVisits.branchId, dentalBranches.id))
        .innerJoin(patients, eq(dentalAttachments.patientId, patients.id))
        .where(
          and(
            isNull(dentalAttachments.deletedAt),
            lte(dentalAttachments.createdAt, cutoff),
            eq(dentalBranches.organizationId, tenantId),
          ),
        );

  return rows.map((r) => ({ id: r.id, personId: r.personId }));
}

/** Soft-archive attachments by stamping `deletedAt`. Returns the count archived. */
export async function archiveAttachments(db: DatabaseInstance, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const res = await db
    .update(dentalAttachments)
    .set({ deletedAt: new Date() })
    .where(and(inArray(dentalAttachments.id, ids), isNull(dentalAttachments.deletedAt)))
    .returning({ id: dentalAttachments.id });
  return res.length;
}
