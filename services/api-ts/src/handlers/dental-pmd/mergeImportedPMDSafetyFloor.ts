/**
 * mergeImportedPMDSafetyFloor handler
 *
 * POST /dental/pmd/imported/{id}/merge-safety-floor
 *
 * FIX-003 (decision #20): surface an imported PMD's safety-critical items
 * (conditions / medications / allergies) into the patient's living medical
 * history as APPEND-ONLY entries so the data actually reaches the clinical
 * Safety Floor (the import flow's clinical reason to exist). The imported PMD
 * row itself is never mutated (BR-022) — its data is copied forward as new
 * med-history entries. The merge is recorded as an append-only event whose
 * unique index (one event per imported PMD) makes it idempotent: a second merge
 * → 409 SAFETY_FLOOR_ALREADY_MERGED.
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, ForbiddenError, ConflictError } from '@/core/errors';
import { ImportedPMDRepository } from './repos/imported-pmd.repo';
import {
  insertImportedSafetyFloorEntries,
  type ImportedSafetyFloorItem,
} from '@/handlers/dental-clinical/repos/clinical-pmd.facade';
import { getPatientForPMD } from '@/handlers/patient/repos/patient-pmd.facade';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { getBranchOrgId } from '@/handlers/dental-org/repos/org-billing.facade';
import { logAuditEvent } from '@/core/audit-logger';
import type { User } from '@/types/auth';
import type { MergeImportedPMDSafetyFloorParams } from '@/generated/openapi/validators';

/** Postgres unique-violation (SQLSTATE 23505) detector — same shape as generatePMD. */
function isUniqueViolation(err: unknown): boolean {
  const code = (err as { cause?: { code?: string }; code?: string })?.cause?.code
    ?? (err as { code?: string })?.code;
  return code === '23505';
}

/**
 * Extract safety-floor items from imported PMD content. Mirrors the FE import
 * preview (`pmd-import.tsx` extractPreview) EXACTLY — top-level `conditions` /
 * `medications` / `allergies` string arrays — so the items merged equal the items
 * the clinician previewed before confirming. Non-JSON or non-array fields → none.
 */
function extractSafetyFloorItems(content: string): ImportedSafetyFloorItem[] {
  let data: unknown;
  try { data = JSON.parse(content); } catch { return []; }
  if (!data || typeof data !== 'object') return [];
  const d = data as Record<string, unknown>;
  const pick = (v: unknown): string[] =>
    Array.isArray(v)
      ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map(x => x.trim())
      : [];
  const items: ImportedSafetyFloorItem[] = [];
  for (const name of pick(d['conditions'])) items.push({ entryType: 'condition', displayName: name });
  for (const name of pick(d['medications'])) items.push({ entryType: 'medication', displayName: name });
  for (const name of pick(d['allergies'])) items.push({ entryType: 'allergy', displayName: name });
  return items;
}

export async function mergeImportedPMDSafetyFloor(
  ctx: ValidatedContext<never, never, MergeImportedPMDSafetyFloorParams>
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { id } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const repo = new ImportedPMDRepository(db);
  const imported = await repo.findOneById(id);
  if (!imported) throw new NotFoundError('Imported PMD');

  // Branch-level authorization via the imported PMD's patient (mirrors importPMD).
  const patient = await getPatientForPMD(db, imported.patientId);
  if (!patient) throw new NotFoundError('Patient');
  if (!patient.preferredBranchId) throw new ForbiddenError('Patient has no assigned branch');
  await assertBranchRole(db, user.id, patient.preferredBranchId, ['dentist_owner', 'dentist_associate', 'staff_full']);

  // Fast idempotency path: already merged → 409 (the append-only event below is
  // the durable race backstop for the rare concurrent-double-merge case).
  if (imported.safetyFloorMerged === 'true') {
    throw new ConflictError('Safety floor already merged for this imported PMD', 'SAFETY_FLOOR_ALREADY_MERGED');
  }

  // Surface the imported safety data FIRST so the entries always land even if a
  // later step fails — losing a penicillin allergy is worse than a rare duplicate
  // row under a concurrent merge. Append-only: existing entries are never touched.
  const items = extractSafetyFloorItems(imported.content);
  const mergedEntryCount = await insertImportedSafetyFloorEntries(db, imported.patientId, items, user.id);

  // Record the merge as an append-only event; the unique index is the hard guard
  // against a concurrent double-merge (23505 → 409).
  let mergedAt: Date;
  try {
    const event = await repo.recordSafetyFloorMergeEvent(id, user.id);
    mergedAt = event.mergedAt;
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    throw new ConflictError('Safety floor already merged for this imported PMD', 'SAFETY_FLOOR_ALREADY_MERGED');
  }

  await repo.markSafetyFloorMerged(id);

  // PHI write — merging imported safety data into the clinical record is auditable.
  const branchForAudit = await getBranchOrgId(db, patient.preferredBranchId);
  await logAuditEvent(db, logger, {
    personId: user.id,
    tenantId: branchForAudit?.organizationId ?? patient.preferredBranchId,
    branchId: patient.preferredBranchId,
    action: 'pmd.safety_floor.merged',
    resourceType: 'imported-pmd',
    resourceId: id,
    metadata: { patientId: imported.patientId, mergedEntryCount },
  });

  return ctx.json({
    importedPmdId: id,
    safetyFloorMerged: true,
    mergedEntryCount,
    mergedAt,
  }, 200);
}
