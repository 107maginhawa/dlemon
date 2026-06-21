/**
 * createCephReport.concurrency.test.ts — concurrent finalizes fork the revision lineage.
 *
 * createCephReport derives revisionOf from getLatestReport then inserts via
 * createSnapshotVersion. The version number is collision-safe (unique(image_id,version) +
 * retry), BUT the retry recomputes only `version`, not revisionOf. Under READ COMMITTED two
 * concurrent finalizes both read latest=vN → both set revisionOf=vN; one inserts vN+1, the
 * other hits 23505 and retries to vN+2 STILL pointing revisionOf at vN → a forked lineage
 * (both vN+1 and vN+2 claim vN as parent; the linear "revises its immediate predecessor"
 * invariant is broken, silently skipping vN+1).
 *
 * Fix: serialize finalize per image with pg_advisory_xact_lock(4001, hashtext(imageId)) and
 * derive revisionOf from getLatestReport UNDER the lock, so the loser re-reads the committed
 * vN+1 and points at it.
 *
 * RED-proof: without the lock, racing two finalizes after v1 leaves v3.revisionOf = v1.id
 * (== v2.revisionOf). GREEN: v3.revisionOf = v2.id (linear chain).
 */

import { describe, test, expect, beforeAll, afterEach } from 'bun:test';
import { sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { createDatabase } from '@/core/database';
import { buildTestApp } from '@/tests/helpers/test-app';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgresql://postgres:password@localhost:5432/monobase_test' });

// Suite tag: cephrace
const ORG_ID = 'c2c00000-0000-4000-8000-000000000001';
const BRANCH_ID = 'b2c00000-0000-4000-8000-000000000001';
const DENTIST = { id: 'a2c00000-0000-4000-8000-0000000000d1', email: 'dentist@cephrace.test' };
const PATIENT_ID = 'd2c00000-0000-4000-8000-0000000000f5';

const json = (body: unknown) => ({ headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

async function seedOrg() {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  await db.insert(dentalOrganizations).values({ id: ORG_ID, name: 'Ceph Race Clinic', tier: 'clinic', ownerPersonId: DENTIST.id, countryCode: 'PH', imagingTier: 'addon', createdBy: DENTIST.id, updatedBy: DENTIST.id }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: BRANCH_ID, organizationId: ORG_ID, name: 'Main', timezone: 'Asia/Manila', createdBy: DENTIST.id, updatedBy: DENTIST.id }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({ id: 'aacf0000-0000-4000-8000-0000000000c1', branchId: BRANCH_ID, personId: DENTIST.id, displayName: 'Owner Dentist', role: 'dentist_owner', status: 'active', pinFailedAttempts: 0, createdBy: DENTIST.id, updatedBy: DENTIST.id }).onConflictDoNothing();
}

async function seedImage(): Promise<string> {
  const { imagingStudies, imagingStudyImages } = await import('./repos/imaging.schema');
  const { storedFiles } = await import('@/handlers/storage/repos/file.schema');
  const studyId = uuidv4(); const imageId = uuidv4(); const fileId = uuidv4();
  await db.insert(storedFiles).values({ id: fileId, filename: 'ceph.png', mimeType: 'image/png', size: 204800, status: 'available', owner: DENTIST.id, createdBy: DENTIST.id, updatedBy: DENTIST.id });
  await db.insert(imagingStudies).values({ id: studyId, patientId: PATIENT_ID, visitId: null, branchId: BRANCH_ID, acquiredBy: DENTIST.id, modality: 'cephalometric', status: 'active', createdBy: DENTIST.id, updatedBy: DENTIST.id });
  await db.insert(imagingStudyImages).values({ id: imageId, studyId, fileId, modality: 'cephalometric', sequenceNumber: 0, pixelSpacingMm: 0.1, dicomMetadata: { fileName: 'ceph.png', mimeType: 'image/png' }, status: 'active', createdBy: DENTIST.id, updatedBy: DENTIST.id });
  return imageId;
}

async function seedGateLandmarks(imageId: string) {
  const { imagingCephLandmarks } = await import('./repos/imaging_ceph.schema');
  const coords: Record<string, { x: number; y: number }> = { A: { x: 300, y: 400 }, B: { x: 310, y: 520 }, Go: { x: 180, y: 560 }, Po: { x: 120, y: 360 } };
  await db.insert(imagingCephLandmarks).values((['A', 'B', 'Go', 'Po'] as const).map((code) => ({ imageId, landmarkCode: code, x: coords[code]!.x, y: coords[code]!.y, source: 'manual' as const, status: 'confirmed' as const, createdBy: DENTIST.id, updatedBy: DENTIST.id })));
}

beforeAll(async () => { await seedOrg(); });
afterEach(async () => { await db.execute(sql`TRUNCATE TABLE imaging_ceph_report, imaging_ceph_landmark, imaging_study_image, imaging_study, stored_file CASCADE`); });

async function reports(imageId: string): Promise<Array<{ version: number; id: string; revision_of: string | null }>> {
  const r = await db.execute(sql`SELECT version, id, revision_of FROM imaging_ceph_report WHERE image_id = ${imageId} ORDER BY version`);
  return ((r as any).rows ?? r) as Array<{ version: number; id: string; revision_of: string | null }>;
}

describe('createCephReport — concurrent finalizes keep a linear revision lineage', () => {
  test('racing two re-finalizes after v1 → v3 revises v2, not v1 (no fork)', async () => {
    const ROUNDS = 4;
    for (let i = 0; i < ROUNDS; i++) {
      const imageId = await seedImage();
      await seedGateLandmarks(imageId);
      const app = buildTestApp({ db, user: DENTIST });

      // v1 (revisionOf = null)
      const r1 = await app.request(`/dental/imaging/images/${imageId}/ceph/reports`, { method: 'POST', ...json({}) });
      expect(r1.status, `round ${i}: v1 create`).toBe(201);

      // Race two re-finalizes.
      const [a, b] = await Promise.all([
        app.request(`/dental/imaging/images/${imageId}/ceph/reports`, { method: 'POST', ...json({}) }),
        app.request(`/dental/imaging/images/${imageId}/ceph/reports`, { method: 'POST', ...json({}) }),
      ]);
      expect([a.status, b.status].every((s) => s === 201), `round ${i}: both finalizes 201 (${[a.status, b.status]})`).toBe(true);

      const rows = await reports(imageId);
      expect(rows.length, `round ${i}: three versions exist`).toBe(3);
      const v1 = rows.find((r) => r.version === 1)!;
      const v2 = rows.find((r) => r.version === 2)!;
      const v3 = rows.find((r) => r.version === 3)!;
      expect(v2.revision_of, `round ${i}: v2 revises v1`).toBe(v1.id);
      // The lineage must be linear: v3 revises its immediate predecessor v2, never skipping back to v1.
      expect(v3.revision_of, `round ${i}: v3 must revise v2 (id=${v2.id}), not v1 (id=${v1.id})`).toBe(v2.id);

      await db.execute(sql`TRUNCATE TABLE imaging_ceph_report, imaging_ceph_landmark, imaging_study_image, imaging_study, stored_file CASCADE`);
    }
  });
});
