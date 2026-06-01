/**
 * imaging-erasure.facade tests (V-DG-002).
 *
 * Anonymizes a subject's imaging PII (DICOM headers, finding notes, annotation
 * label text), archives studies/images as the erasure marker, RETAINS clinical
 * metadata (modality, ceph measurements), and surfaces the storage fileIds whose
 * S3 objects the storage service must physically delete. Idempotent.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { eq, inArray } from 'drizzle-orm';
import { openTestTx } from '@/core/test-tx';
import { persons } from '../../person/repos/person.schema';
import { patients } from '../../patient/repos/patient.schema';
import {
  imagingStudies,
  imagingStudyImages,
  imagingAnnotations,
} from './imaging.schema';
import { imagingFindings } from './imaging_finding.schema';
import { imagingCephAnalyses } from './imaging_ceph.schema';
import {
  anonymizeImagingByPerson,
  anonymizeImagingByPersonDetailed,
} from './imaging-erasure.facade';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

const PID = 'e2000000-0000-4000-8000-000000000001';
const NO_IMAGING_PID = 'e2000000-0000-4000-8000-000000000002';
const BRANCH = 'e2000000-0000-4000-8000-0000000000b1';
const ACQUIRED_BY = 'e2000000-0000-4000-8000-0000000000a1';
const FILE_ID = 'e2000000-0000-4000-8000-0000000000f1';

describe('imaging-erasure facade', () => {
  let db: NodePgDatabase;
  let teardown: () => Promise<void>;
  let studyId: string;
  let imageId: string;

  beforeEach(async () => {
    const t = await openTestTx();
    db = t.db;
    teardown = t.rollback;

    await db.insert(persons).values({ id: PID, firstName: 'Jane' });
    const [pt] = await db
      .insert(patients)
      .values({ person: PID })
      .returning({ id: patients.id });

    const [study] = await db
      .insert(imagingStudies)
      .values({
        patientId: pt!.id,
        branchId: BRANCH,
        acquiredBy: ACQUIRED_BY,
        modality: 'cephalometric',
        status: 'active',
      })
      .returning({ id: imagingStudies.id });
    studyId = study!.id;

    const [img] = await db
      .insert(imagingStudyImages)
      .values({
        studyId,
        fileId: FILE_ID,
        modality: 'cephalometric',
        pixelSpacingMm: 0.1,
        dicomMetadata: { PatientName: 'Jane Doe', PatientID: 'MRN-12345' },
        status: 'active',
      })
      .returning({ id: imagingStudyImages.id });
    imageId = img!.id;

    await db.insert(imagingFindings).values({
      imageId,
      patientId: pt!.id,
      branchId: BRANCH,
      type: 'caries',
      status: 'draft',
      note: 'Patient Jane mentioned pain — caries tooth 14',
    });

    await db.insert(imagingAnnotations).values({
      imageId,
      type: 'label',
      geometry: { x: 10, y: 20, label: 'Jane Doe MRN-12345' },
    });

    await db.insert(imagingCephAnalyses).values({
      imageId,
      analysisType: 'steiner_hybrid_sn',
      measurements: { SNA: 82, SNB: 80 },
      calibrationMethod: 'dicom_tag',
    });
  });

  afterEach(() => teardown());

  test('anonymizes PII, archives rows, retains clinical metadata, returns fileIds', async () => {
    const res = await anonymizeImagingByPersonDetailed(db, PID);
    expect(res.rowsAnonymized).toBeGreaterThanOrEqual(4); // image + finding + annotation + study
    expect(res.fileIdsPendingS3Delete).toEqual([FILE_ID]);

    const [img] = await db
      .select()
      .from(imagingStudyImages)
      .where(eq(imagingStudyImages.id, imageId));
    expect(img!.dicomMetadata).toBeNull(); // PII headers cleared
    expect(img!.status).toBe('archived'); // erasure marker
    expect(img!.modality).toBe('cephalometric'); // clinical metadata retained
    expect(img!.pixelSpacingMm).toBe(0.1); // retained
    expect(img!.fileId).toBe(FILE_ID); // retained as S3 delete handle

    const [study] = await db
      .select()
      .from(imagingStudies)
      .where(eq(imagingStudies.id, studyId));
    expect(study!.status).toBe('archived');
    expect(study!.modality).toBe('cephalometric'); // retained

    const [finding] = await db
      .select()
      .from(imagingFindings)
      .where(eq(imagingFindings.imageId, imageId));
    expect(finding!.note).toBeNull(); // free-text identifier stripped
    expect(finding!.type).toBe('caries'); // clinical type retained

    const [ann] = await db
      .select()
      .from(imagingAnnotations)
      .where(eq(imagingAnnotations.imageId, imageId));
    const geom = ann!.geometry as Record<string, unknown>;
    expect(geom['label']).toBeUndefined(); // free-text label stripped
    expect(geom['x']).toBe(10); // coordinates retained
    expect(geom['y']).toBe(20);

    const [analysis] = await db
      .select()
      .from(imagingCephAnalyses)
      .where(eq(imagingCephAnalyses.imageId, imageId));
    expect(analysis!.measurements).toEqual({ SNA: 82, SNB: 80 }); // derived metrics retained
  });

  test('is idempotent', async () => {
    const first = await anonymizeImagingByPerson(db, PID);
    expect(first).toBeGreaterThanOrEqual(4);
    const second = await anonymizeImagingByPerson(db, PID);
    expect(second).toBeGreaterThanOrEqual(4); // re-runs cleanly, no throw

    const [img] = await db
      .select()
      .from(imagingStudyImages)
      .where(eq(imagingStudyImages.id, imageId));
    expect(img!.dicomMetadata).toBeNull();
  });

  test('returns 0 / empty for a person with no imaging', async () => {
    await db.insert(persons).values({ id: NO_IMAGING_PID, firstName: 'Sam' });
    await db.insert(patients).values({ person: NO_IMAGING_PID });

    const res = await anonymizeImagingByPersonDetailed(db, NO_IMAGING_PID);
    expect(res.rowsAnonymized).toBe(0);
    expect(res.fileIdsPendingS3Delete).toEqual([]);

    // unknown person (no patient) → 0
    const none = await anonymizeImagingByPerson(db, 'e2000000-0000-4000-8000-0000000000ff');
    expect(none).toBe(0);
  });
});
