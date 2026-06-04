/**
 * imaging-erasure.facade.ts
 *
 * Facade exposing ImagingStudy PII anonymization to the `erasure` module
 * (V-DG-002 / WFG-006). The erasure engine imports ONLY this facade, never the
 * dental-imaging repos/schemas directly (MODULE_BOUNDARIES / Phase 10 lint).
 *
 * Per DATA_GOVERNANCE.md §3 (ImagingStudy row): "Partial — S3 delete: Delete S3
 * object (radiograph); retain metadata with anonymized patient ref; CephAnalysis
 * anonymized." Erasure-via-anonymization (the engine never hard-deletes):
 *
 *   ANONYMIZE (this facade, in-DB, idempotent):
 *     - imaging_study_image.dicom_metadata  → null   (DICOM headers carry
 *           PatientName / PatientID / PatientBirthDate etc. — direct PII leak)
 *     - imaging_finding.note                → null   (free-text radiographic
 *           notes may embed identifiers)
 *     - imaging_annotation.geometry         → label/free-text content stripped
 *           for `type='label'` annotations (operator-drawn captions on the image)
 *     - imaging_study.status                → 'archived'  (erasure marker)
 *     - imaging_study_image.status          → 'archived'  (erasure marker; flags
 *           the row whose backing S3 object must be physically deleted — see below)
 *
 *   RETAIN (clinical metadata, NOT PII):
 *     - modality, pixel_spacing_mm, sequence_number, tooth mappings
 *     - imaging_ceph_analysis.measurements / calibration provenance
 *       (the analysis carries no subject-PII columns; the only identifying link
 *        is the patient ref on the parent study, anonymized by archiving the
 *        study + nulling DICOM PatientName above — satisfies "CephAnalysis
 *        anonymized" without discarding the derived measurements).
 *
 *   S3 RADIOGRAPH DELETION — NOT performed here. The physical S3 object delete
 *   (DATA_GOVERNANCE.md §3 "Delete S3 object (radiograph)") requires the storage
 *   service / S3 client, which is request-scoped and not available to a repo-layer
 *   DB facade. This facade therefore RETURNS the storage `fileId`s of the affected
 *   images and ARCHIVES those image rows as the deletion marker. The caller
 *   (storage service / erasure orchestrator) MUST physically delete those S3
 *   objects (and their storage `file` rows) as a follow-up step. `fileId` itself
 *   is NOT NULL in the schema and is retained as the deletion handle — it is not
 *   subject PII (an opaque storage UUID), so retaining it until physical delete is
 *   safe and necessary.
 */

import { eq, inArray, sql } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { getPatientByPersonIdForEMR } from '@/handlers/patient/repos/patient-emr.facade';
import {
  imagingStudies,
  imagingStudyImages,
  imagingAnnotations,
} from './imaging.schema';
import { imagingFindings } from './imaging_finding.schema';

/** Storage file IDs whose S3 objects the storage service must physically delete. */
export interface ImagingErasureResult {
  /** Count of imaging rows touched (studies + images + findings + annotations). */
  rowsAnonymized: number;
  /**
   * Storage `file` IDs backing the anonymized radiographs. The caller MUST hand
   * these to the storage service for physical S3 object deletion (this DB facade
   * cannot reach S3). Empty when the person has no imaging.
   */
  fileIdsPendingS3Delete: string[];
}

/**
 * Anonymize all imaging PII for the patient linked to `subjectPersonId` and
 * return the storage file IDs whose S3 objects still require physical deletion.
 * Idempotent: nulling already-null columns and re-archiving archived rows is a
 * no-op; the fileId list is recomputed from current rows each run.
 */
export async function anonymizeImagingByPersonDetailed(
  db: DatabaseInstance,
  subjectPersonId: string,
): Promise<ImagingErasureResult> {
  const patient = await getPatientByPersonIdForEMR(db, subjectPersonId);
  if (!patient) {
    return { rowsAnonymized: 0, fileIdsPendingS3Delete: [] };
  }

  const studies = await db
    .select({ id: imagingStudies.id })
    .from(imagingStudies)
    .where(eq(imagingStudies.patientId, patient.id));
  const studyIds = studies.map((s) => s.id);
  if (studyIds.length === 0) {
    return { rowsAnonymized: 0, fileIdsPendingS3Delete: [] };
  }

  const images = await db
    .select({ id: imagingStudyImages.id, fileId: imagingStudyImages.fileId })
    .from(imagingStudyImages)
    .where(inArray(imagingStudyImages.studyId, studyIds));
  const imageIds = images.map((i) => i.id);
  const fileIdsPendingS3Delete = images.map((i) => i.fileId);

  let rowsAnonymized = 0;
  const now = new Date();

  // Null DICOM headers (PatientName/PatientID/PatientBirthDate …) + archive images.
  if (imageIds.length > 0) {
    const imgRes = await db
      .update(imagingStudyImages)
      .set({ dicomMetadata: null, status: 'archived', updatedAt: now })
      .where(inArray(imagingStudyImages.id, imageIds))
      .returning({ id: imagingStudyImages.id });
    rowsAnonymized += imgRes.length;

    // Strip free-text radiographic notes on findings for these images.
    const findRes = await db
      .update(imagingFindings)
      .set({ note: null, updatedAt: now })
      .where(inArray(imagingFindings.imageId, imageIds))
      .returning({ id: imagingFindings.id });
    rowsAnonymized += findRes.length;

    // Strip operator-drawn label/caption text from annotation geometry (only the
    // `label` field is free-text; coordinates are clinical and retained).
    const annRes = await db
      .update(imagingAnnotations)
      .set({
        geometry: sql`${imagingAnnotations.geometry} - 'label'`,
        updatedAt: now,
      })
      .where(inArray(imagingAnnotations.imageId, imageIds))
      .returning({ id: imagingAnnotations.id });
    rowsAnonymized += annRes.length;
  }

  // Archive the studies (erasure marker; retains modality + patient ref).
  const studyRes = await db
    .update(imagingStudies)
    .set({ status: 'archived', updatedAt: now })
    .where(inArray(imagingStudies.id, studyIds))
    .returning({ id: imagingStudies.id });
  rowsAnonymized += studyRes.length;

  return { rowsAnonymized, fileIdsPendingS3Delete };
}

/**
 * ErasureTarget-compatible entry point. Returns the count of imaging rows
 * anonymized. The storage file IDs requiring physical S3 deletion are available
 * via {@link anonymizeImagingByPersonDetailed} for callers that wire the storage
 * service follow-up.
 */
export async function anonymizeImagingByPerson(
  db: DatabaseInstance,
  subjectPersonId: string,
): Promise<number> {
  const { rowsAnonymized } = await anonymizeImagingByPersonDetailed(db, subjectPersonId);
  return rowsAnonymized;
}
