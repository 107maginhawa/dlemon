/**
 * imaging-links.test.ts — G5b (context links) real-DB owner
 *
 * Gap 5 (context breadth): an image can be linked to a treatment plan / ortho case /
 * report (loose-coupled targetId). These assertions exercise the REAL create/list/
 * delete handlers + the listPatientImages link enrichment & filter against a cloned DB.
 *
 * Covers:
 *   - create link → 201; idempotent re-link → still one
 *   - list / delete (204) round-trip
 *   - validation: bad linkType / non-uuid targetId → 400; delete missing → 404
 *   - listPatientImages surfaces links + filters by linkTargetId / linkType
 */

// Migrated off the bespoke raw-handler mount to the shared validator-mounting harness.
import { describe, test, expect, beforeAll, beforeEach } from 'bun:test';
import { v4 as uuidv4 } from 'uuid';
import { createDatabase } from '@/core/database';
import { buildTestApp } from '@/tests/helpers/test-app';
import { type PatientImageItem } from './listPatientImages';

const db = createDatabase({
  url: process.env['DATABASE_URL'] ?? 'postgresql://postgres:password@localhost:5432/monobase_test',
});

// Stable IDs (suite tag: imglink)
const ORG_ID = 'c5e00000-0000-4000-8000-000000000001';
const BRANCH_ID = 'b5e00000-0000-4000-8000-000000000001';
const DENTIST = { id: 'a5e00000-0000-4000-8000-0000000000d1', email: 'dentist@imglink.test' };
const PERSON_ID = 'd5e00000-0000-4000-8000-0000000000e1';
const PATIENT_ID = 'd5e00000-0000-4000-8000-0000000000f5';
const PLAN_ID = 'e5e00000-0000-4000-8000-0000000000a1';
const REPORT_ID = 'e5e00000-0000-4000-8000-0000000000a2';
// A second patient (different person) + their own plan — for the cross-patient guard.
const OTHER_PERSON_ID = 'd5e00000-0000-4000-8000-0000000000e2';
const OTHER_PATIENT_ID = 'd5e00000-0000-4000-8000-0000000000f6';
const OTHER_PLAN_ID = 'e5e00000-0000-4000-8000-0000000000a3';
// A stable study+image owned by PATIENT_ID, backing the seeded ceph report.
const REPORT_STUDY_ID = 'e5e00000-0000-4000-8000-0000000000b1';
const REPORT_IMAGE_ID = 'e5e00000-0000-4000-8000-0000000000b2';
const REPORT_FILE_ID = 'e5e00000-0000-4000-8000-0000000000b3';
// A ceph report owned by the OTHER patient — for the cross-patient report guard.
const OTHER_REPORT_STUDY_ID = 'e5e00000-0000-4000-8000-0000000000c1';
const OTHER_REPORT_IMAGE_ID = 'e5e00000-0000-4000-8000-0000000000c2';
const OTHER_REPORT_FILE_ID = 'e5e00000-0000-4000-8000-0000000000c3';
const OTHER_REPORT_ID = 'e5e00000-0000-4000-8000-0000000000c4';

function buildApp(user?: { id: string; email: string }) {
  return buildTestApp({ db, user });
}

type TestApp = ReturnType<typeof buildApp>;

const json = (body: unknown) => ({ headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

async function seedOrg() {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { dentalMemberships } = await import('@/handlers/dental-org/repos/membership.schema');
  await db.insert(dentalOrganizations).values({
    id: ORG_ID, name: 'Img Link Clinic', tier: 'clinic', ownerPersonId: DENTIST.id,
    countryCode: 'PH', imagingTier: 'addon', createdBy: DENTIST.id, updatedBy: DENTIST.id,
  }).onConflictDoNothing();
  await db.insert(dentalBranches).values({
    id: BRANCH_ID, organizationId: ORG_ID, name: 'Main', timezone: 'Asia/Manila',
    createdBy: DENTIST.id, updatedBy: DENTIST.id,
  }).onConflictDoNothing();
  await db.insert(dentalMemberships).values({
    id: 'aac50000-0000-4000-8000-0000000000d1', branchId: BRANCH_ID, personId: DENTIST.id,
    displayName: 'Owner Dentist', role: 'dentist_owner', status: 'active',
    pinFailedAttempts: 0, createdBy: DENTIST.id, updatedBy: DENTIST.id,
  }).onConflictDoNothing();

  // Real link targets so createImageLink's existence + same-patient guard (G6.2) passes.
  const { persons } = await import('@/handlers/person/repos/person.schema');
  const { patients } = await import('@/handlers/patient/repos/patient.schema');
  const { dentalTreatmentPlans } = await import('@/handlers/dental-patient/repos/treatment-plan.schema');
  const { imagingStudies, imagingStudyImages } = await import('./repos/imaging.schema');
  const { imagingCephReports } = await import('./repos/imaging_ceph.schema');
  const { storedFiles } = await import('@/handlers/storage/repos/file.schema');

  await db.insert(persons).values([
    { id: PERSON_ID, firstName: 'Link', lastName: 'Patient' },
    { id: OTHER_PERSON_ID, firstName: 'Other', lastName: 'Patient' },
  ]).onConflictDoNothing();
  await db.insert(patients).values([
    { id: PATIENT_ID, person: PERSON_ID },
    { id: OTHER_PATIENT_ID, person: OTHER_PERSON_ID },
  ]).onConflictDoNothing();
  await db.insert(dentalTreatmentPlans).values([
    { id: PLAN_ID, patientId: PATIENT_ID, providerId: DENTIST.id, createdBy: DENTIST.id, updatedBy: DENTIST.id },
    { id: OTHER_PLAN_ID, patientId: OTHER_PATIENT_ID, providerId: DENTIST.id, createdBy: DENTIST.id, updatedBy: DENTIST.id },
  ]).onConflictDoNothing();

  // A stable study+image owned by PATIENT_ID, backing the seeded ceph report.
  await db.insert(storedFiles).values({
    id: REPORT_FILE_ID, filename: 'ceph.png', mimeType: 'image/png', size: 1024,
    status: 'available', owner: DENTIST.id, createdBy: DENTIST.id, updatedBy: DENTIST.id,
  }).onConflictDoNothing();
  await db.insert(imagingStudies).values({
    id: REPORT_STUDY_ID, patientId: PATIENT_ID, visitId: null, branchId: BRANCH_ID, acquiredBy: DENTIST.id,
    modality: 'cephalometric', status: 'active', createdBy: DENTIST.id, updatedBy: DENTIST.id,
  }).onConflictDoNothing();
  await db.insert(imagingStudyImages).values({
    id: REPORT_IMAGE_ID, studyId: REPORT_STUDY_ID, fileId: REPORT_FILE_ID, modality: 'cephalometric',
    sequenceNumber: 0, status: 'active', createdBy: DENTIST.id, updatedBy: DENTIST.id,
  }).onConflictDoNothing();
  await db.insert(imagingCephReports).values({
    id: REPORT_ID, imageId: REPORT_IMAGE_ID, version: 1, snapshot: {}, createdBy: DENTIST.id,
  }).onConflictDoNothing();

  // A ceph report owned by OTHER_PATIENT_ID (study→image→report) for the cross-patient guard.
  await db.insert(storedFiles).values({
    id: OTHER_REPORT_FILE_ID, filename: 'other-ceph.png', mimeType: 'image/png', size: 1024,
    status: 'available', owner: DENTIST.id, createdBy: DENTIST.id, updatedBy: DENTIST.id,
  }).onConflictDoNothing();
  await db.insert(imagingStudies).values({
    id: OTHER_REPORT_STUDY_ID, patientId: OTHER_PATIENT_ID, visitId: null, branchId: BRANCH_ID, acquiredBy: DENTIST.id,
    modality: 'cephalometric', status: 'active', createdBy: DENTIST.id, updatedBy: DENTIST.id,
  }).onConflictDoNothing();
  await db.insert(imagingStudyImages).values({
    id: OTHER_REPORT_IMAGE_ID, studyId: OTHER_REPORT_STUDY_ID, fileId: OTHER_REPORT_FILE_ID, modality: 'cephalometric',
    sequenceNumber: 0, status: 'active', createdBy: DENTIST.id, updatedBy: DENTIST.id,
  }).onConflictDoNothing();
  await db.insert(imagingCephReports).values({
    id: OTHER_REPORT_ID, imageId: OTHER_REPORT_IMAGE_ID, version: 1, snapshot: {}, createdBy: DENTIST.id,
  }).onConflictDoNothing();
}

async function seedImage(): Promise<string> {
  const { imagingStudies, imagingStudyImages } = await import('./repos/imaging.schema');
  const { storedFiles } = await import('@/handlers/storage/repos/file.schema');
  const studyId = uuidv4();
  const imageId = uuidv4();
  const fileId = uuidv4();
  await db.insert(storedFiles).values({
    id: fileId, filename: 'pa.png', mimeType: 'image/png', size: 102400,
    status: 'available', owner: DENTIST.id, createdBy: DENTIST.id, updatedBy: DENTIST.id,
  });
  await db.insert(imagingStudies).values({
    id: studyId, patientId: PATIENT_ID, visitId: null, branchId: BRANCH_ID, acquiredBy: DENTIST.id,
    modality: 'periapical', status: 'active', createdBy: DENTIST.id, updatedBy: DENTIST.id,
  });
  await db.insert(imagingStudyImages).values({
    id: imageId, studyId, fileId, modality: 'periapical', sequenceNumber: 0,
    dicomMetadata: { fileName: 'pa.png', mimeType: 'image/png' },
    status: 'active', createdBy: DENTIST.id, updatedBy: DENTIST.id,
  });
  return imageId;
}

const createLink = (app: TestApp, imageId: string, body: unknown) =>
  app.request(`/dental/imaging/images/${imageId}/links`, { method: 'POST', ...json(body) });
const listLinks = (app: TestApp, imageId: string) =>
  app.request(`/dental/imaging/images/${imageId}/links`, { method: 'GET' });
const delLink = (app: TestApp, linkId: string) =>
  app.request(`/dental/imaging/links/${linkId}`, { method: 'DELETE' });
const listImages = (app: TestApp, query = '') =>
  app.request(`/dental/patients/${PATIENT_ID}/images?branchId=${BRANCH_ID}${query}`, { method: 'GET' });

beforeAll(async () => { await seedOrg(); });

describe('G5b context links', () => {
  let imageId: string;
  beforeEach(async () => { imageId = await seedImage(); });

  test('create link → 201 with the linked target', async () => {
    const app = buildApp(DENTIST);
    const res = await createLink(app, imageId, { linkType: 'treatment_plan', targetId: PLAN_ID });
    expect(res.status).toBe(201);
    const link = (await res.json()) as any;
    expect(link.imageId).toBe(imageId);
    expect(link.linkType).toBe('treatment_plan');
    expect(link.targetId).toBe(PLAN_ID);
  });

  test('re-linking the same target is idempotent (one row)', async () => {
    const app = buildApp(DENTIST);
    await createLink(app, imageId, { linkType: 'treatment_plan', targetId: PLAN_ID });
    await createLink(app, imageId, { linkType: 'treatment_plan', targetId: PLAN_ID });
    const list = (await (await listLinks(app, imageId)).json()) as { items: any[] };
    expect(list.items).toHaveLength(1);
  });

  test('list + delete round-trip', async () => {
    const app = buildApp(DENTIST);
    const created = (await (await createLink(app, imageId, { linkType: 'report', targetId: REPORT_ID })).json()) as any;
    let list = (await (await listLinks(app, imageId)).json()) as { items: any[] };
    expect(list.items).toHaveLength(1);

    const del = await delLink(app, created.id);
    expect(del.status).toBe(204);
    list = (await (await listLinks(app, imageId)).json()) as { items: any[] };
    expect(list.items).toHaveLength(0);
  });

  test('invalid linkType → 400', async () => {
    const app = buildApp(DENTIST);
    const res = await createLink(app, imageId, { linkType: 'invoice', targetId: PLAN_ID });
    expect(res.status).toBe(400);
  });

  test('non-uuid targetId → 400', async () => {
    const app = buildApp(DENTIST);
    const res = await createLink(app, imageId, { linkType: 'report', targetId: 'not-a-uuid' });
    expect(res.status).toBe(400);
  });

  test('deleting a missing link → 404', async () => {
    const app = buildApp(DENTIST);
    const res = await delLink(app, uuidv4());
    expect(res.status).toBe(404);
  });

  test('G6.2: orphan treatment_plan targetId (no such plan) → 404', async () => {
    const app = buildApp(DENTIST);
    const res = await createLink(app, imageId, { linkType: 'treatment_plan', targetId: uuidv4() });
    expect(res.status).toBe(404);
  });

  test('G6.2: treatment_plan owned by a DIFFERENT patient → 404 (no cross-patient/tenant link)', async () => {
    const app = buildApp(DENTIST);
    const res = await createLink(app, imageId, { linkType: 'treatment_plan', targetId: OTHER_PLAN_ID });
    expect(res.status).toBe(404);
  });

  test('G6.2: orphan report targetId (no such ceph report) → 404', async () => {
    const app = buildApp(DENTIST);
    const res = await createLink(app, imageId, { linkType: 'report', targetId: uuidv4() });
    expect(res.status).toBe(404);
  });

  test('G6.2: report owned by a DIFFERENT patient → 404 (proves the same-patient clause)', async () => {
    const app = buildApp(DENTIST);
    const res = await createLink(app, imageId, { linkType: 'report', targetId: OTHER_REPORT_ID });
    expect(res.status).toBe(404);
  });

  test('G6.2: ortho_case is left unvalidated (no ortho module to validate against) → 201 [characterization]', async () => {
    // KNOWN GAP: ortho_case has no backing table, so target validation is skipped
    // (unchanged behavior). It only ever links to a not-yet-built feature, never real
    // patient data. The clean fix is to remove the dead ortho_case affordance (FE +
    // TypeSpec + enum) or build the ortho module — tracked as a follow-up. This test
    // locks the current behavior so a future change to it is intentional.
    const app = buildApp(DENTIST);
    const res = await createLink(app, imageId, { linkType: 'ortho_case', targetId: uuidv4() });
    expect(res.status).toBe(201);
  });

  test('listPatientImages surfaces links and filters by linkTargetId / linkType', async () => {
    const app = buildApp(DENTIST);
    const linkedImage = await seedImage();
    await createLink(app, linkedImage, { linkType: 'treatment_plan', targetId: PLAN_ID });
    // imageId (from beforeEach) stays unlinked.

    const all = (await (await listImages(app)).json()) as { items: PatientImageItem[] };
    const linkedItem = all.items.find((i) => i.id === linkedImage)!;
    expect(linkedItem.links.some((l) => l.targetId === PLAN_ID)).toBe(true);

    const byTarget = (await (await listImages(app, `&linkTargetId=${PLAN_ID}`)).json()) as { items: PatientImageItem[] };
    const ids = new Set(byTarget.items.map((i) => i.id));
    expect(ids.has(linkedImage)).toBe(true);
    expect(ids.has(imageId)).toBe(false);

    const byType = (await (await listImages(app, '&linkType=ortho_case')).json()) as { items: PatientImageItem[] };
    expect(byType.items.some((i) => i.id === linkedImage)).toBe(false); // only treatment_plan linked
  });
});
