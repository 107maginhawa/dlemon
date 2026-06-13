/**
 * ImagingRepository — data access for dental imaging module
 */

import { eq, and, inArray, desc } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { createSnapshotVersion } from '@/core/database.schema';
import {
  imagingStudies,
  imagingStudyImages,
  imagingStudyTeeth,
  imagingAnnotations,
  imagingCalibrations,
  imagingLinks,
  type ImagingStudy,
  type NewImagingStudy,
  type ImagingStudyImage,
  type NewImagingStudyImage,
  type ImagingAnnotation,
  type NewImagingAnnotation,
  type ImagingCalibration,
  type ImagingLink,
  type ImagingLinkType,
  type ImagingModality,
} from './imaging.schema';
import { getMemberRoleForImaging } from '@/handlers/dental-org/repos/org-imaging.facade';
import { getFileSizesByIds } from '@/handlers/storage/repos/storage-imaging.facade';

export class ImagingRepository {
  constructor(private readonly db: DatabaseInstance) {}

  // -------------------------------------------------------------------------
  // Studies
  // -------------------------------------------------------------------------

  async createStudy(data: Omit<NewImagingStudy, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'createdBy' | 'updatedBy'>): Promise<ImagingStudy> {
    const [study] = await this.db
      .insert(imagingStudies)
      .values(data as NewImagingStudy)
      .returning();
    if (!study) throw new Error('Failed to create imaging study');
    return study;
  }

  async findStudyById(id: string): Promise<ImagingStudy | undefined> {
    const [study] = await this.db
      .select()
      .from(imagingStudies)
      .where(eq(imagingStudies.id, id))
      .limit(1);
    return study ?? undefined;
  }

  // -------------------------------------------------------------------------
  // Images
  // -------------------------------------------------------------------------

  async createImage(data: Omit<NewImagingStudyImage, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'createdBy' | 'updatedBy'>): Promise<ImagingStudyImage> {
    const [image] = await this.db
      .insert(imagingStudyImages)
      .values(data as NewImagingStudyImage)
      .returning();
    if (!image) throw new Error('Failed to create imaging study image');
    return image;
  }

  async findImageById(id: string): Promise<ImagingStudyImage | undefined> {
    const [image] = await this.db
      .select()
      .from(imagingStudyImages)
      .where(eq(imagingStudyImages.id, id))
      .limit(1);
    return image ?? undefined;
  }

  async listImagesByStudy(studyId: string): Promise<ImagingStudyImage[]> {
    return await this.db
      .select()
      .from(imagingStudyImages)
      .where(
        and(
          eq(imagingStudyImages.studyId, studyId),
          eq(imagingStudyImages.status, 'active'),
        ),
      );
  }

  async listImagingImagesForPatient(patientId: string, branchId: string): Promise<(ImagingStudyImage & { studyBranchId: string; fileSizeBytes: number })[]> {
    const rows = await this.db
      .select({
        id: imagingStudyImages.id,
        studyId: imagingStudyImages.studyId,
        fileId: imagingStudyImages.fileId,
        pixelSpacingMm: imagingStudyImages.pixelSpacingMm,
        sequenceNumber: imagingStudyImages.sequenceNumber,
        dicomMetadata: imagingStudyImages.dicomMetadata,
        modality: imagingStudyImages.modality,
        status: imagingStudyImages.status,
        // P2-7 CBCT volume descriptor columns
        isVolume: imagingStudyImages.isVolume,
        sliceThicknessMm: imagingStudyImages.sliceThicknessMm,
        frameCount: imagingStudyImages.frameCount,
        seriesInstanceUid: imagingStudyImages.seriesInstanceUid,
        studyInstanceUid: imagingStudyImages.studyInstanceUid,
        // G5 library metadata
        isDiagnostic: imagingStudyImages.isDiagnostic,
        qualityStatus: imagingStudyImages.qualityStatus,
        retakeReason: imagingStudyImages.retakeReason,
        tags: imagingStudyImages.tags,
        createdAt: imagingStudyImages.createdAt,
        updatedAt: imagingStudyImages.updatedAt,
        version: imagingStudyImages.version,
        createdBy: imagingStudyImages.createdBy,
        updatedBy: imagingStudyImages.updatedBy,
        studyBranchId: imagingStudies.branchId,
      })
      .from(imagingStudyImages)
      .innerJoin(imagingStudies, eq(imagingStudyImages.studyId, imagingStudies.id))
      .where(
        and(
          eq(imagingStudies.patientId, patientId),
          eq(imagingStudies.branchId, branchId),
          eq(imagingStudyImages.status, 'active'),
        ),
      );

    // Enrich with file sizes via storage facade (avoids cross-module repo import)
    const fileIds = rows.map((r) => r.fileId).filter((id): id is string => id != null);
    const fileSizeMap = await getFileSizesByIds(this.db, fileIds);

    return rows.map((r) => ({
      ...r,
      fileSizeBytes: (r.fileId != null ? fileSizeMap.get(r.fileId) : undefined) ?? 0,
    })) as (ImagingStudyImage & { studyBranchId: string; fileSizeBytes: number })[];
  }

  async archiveImage(id: string): Promise<void> {
    await this.db
      .update(imagingStudyImages)
      .set({ status: 'archived', updatedAt: new Date() })
      .where(eq(imagingStudyImages.id, id));
  }

  /**
   * P2-7: persist CBCT volume metadata parsed from DICOM tags + flip is_volume.
   * Single update so finalize is atomic (no half-written volume state).
   */
  async updateVolumeMetadata(
    id: string,
    data: {
      isVolume: boolean;
      pixelSpacingMm: number | null;
      sliceThicknessMm: number | null;
      frameCount: number | null;
      seriesInstanceUid: string | null;
      studyInstanceUid: string | null;
      modality?: string;
      dicomMetadata: NewImagingStudyImage['dicomMetadata'];
    },
  ): Promise<ImagingStudyImage> {
    const [updated] = await this.db
      .update(imagingStudyImages)
      .set({
        isVolume: data.isVolume,
        pixelSpacingMm: data.pixelSpacingMm,
        sliceThicknessMm: data.sliceThicknessMm,
        frameCount: data.frameCount,
        seriesInstanceUid: data.seriesInstanceUid,
        studyInstanceUid: data.studyInstanceUid,
        ...(data.modality ? { modality: data.modality as ImagingModality } : {}),
        dicomMetadata: data.dicomMetadata,
        updatedAt: new Date(),
      })
      .where(eq(imagingStudyImages.id, id))
      .returning();
    if (!updated) throw new Error(`Image ${id} not found`);
    return updated;
  }

  async updateModality(id: string, modality: string): Promise<ImagingStudyImage> {
    const [updated] = await this.db
      .update(imagingStudyImages)
      .set({ modality: modality as ImagingModality, updatedAt: new Date() })
      .where(eq(imagingStudyImages.id, id))
      .returning();
    if (!updated) throw new Error(`Image ${id} not found`);
    return updated;
  }

  /**
   * G5: partial update of library metadata. Only keys present in `patch` are
   * written (a caller-validated subset of isDiagnostic/qualityStatus/retakeReason/tags).
   */
  async updateImageMetadata(
    id: string,
    patch: {
      isDiagnostic?: boolean;
      qualityStatus?: 'ok' | 'retake';
      retakeReason?: string | null;
      tags?: string[];
    },
  ): Promise<ImagingStudyImage> {
    const set: Partial<NewImagingStudyImage> = { updatedAt: new Date() };
    if (patch.isDiagnostic !== undefined) set.isDiagnostic = patch.isDiagnostic;
    if (patch.qualityStatus !== undefined) set.qualityStatus = patch.qualityStatus;
    if (patch.retakeReason !== undefined) set.retakeReason = patch.retakeReason;
    if (patch.tags !== undefined) set.tags = patch.tags;
    const [updated] = await this.db
      .update(imagingStudyImages)
      .set(set)
      .where(eq(imagingStudyImages.id, id))
      .returning();
    if (!updated) throw new Error(`Image ${id} not found`);
    return updated;
  }

  // -------------------------------------------------------------------------
  // G5b: context links (treatment plan / ortho case / report)
  // -------------------------------------------------------------------------

  /** Idempotent: linking the same (image, type, target) twice returns the same row. */
  async createImageLink(
    imageId: string,
    data: { linkType: ImagingLinkType; targetId: string; createdBy?: string | null },
  ): Promise<ImagingLink> {
    const [row] = await this.db
      .insert(imagingLinks)
      .values({ imageId, linkType: data.linkType, targetId: data.targetId, createdBy: data.createdBy ?? null })
      .onConflictDoUpdate({
        target: [imagingLinks.imageId, imagingLinks.linkType, imagingLinks.targetId],
        set: { targetId: data.targetId },
      })
      .returning();
    if (!row) throw new Error('Failed to create image link');
    return row;
  }

  async listLinksByImage(imageId: string): Promise<ImagingLink[]> {
    return await this.db
      .select()
      .from(imagingLinks)
      .where(eq(imagingLinks.imageId, imageId));
  }

  async getLinkById(linkId: string): Promise<ImagingLink | null> {
    const [row] = await this.db
      .select()
      .from(imagingLinks)
      .where(eq(imagingLinks.id, linkId))
      .limit(1);
    return row ?? null;
  }

  async deleteLink(linkId: string): Promise<void> {
    await this.db.delete(imagingLinks).where(eq(imagingLinks.id, linkId));
  }

  /** Batch-fetch links for many images → map keyed by imageId (list enrichment). */
  async getLinksByImageIds(imageIds: string[]): Promise<Map<string, ImagingLink[]>> {
    const map = new Map<string, ImagingLink[]>();
    if (imageIds.length === 0) return map;
    const rows = await this.db
      .select()
      .from(imagingLinks)
      .where(inArray(imagingLinks.imageId, imageIds));
    for (const row of rows) {
      const list = map.get(row.imageId) ?? [];
      list.push(row);
      map.set(row.imageId, list);
    }
    return map;
  }

  // -------------------------------------------------------------------------
  // Teeth (join table)
  // -------------------------------------------------------------------------

  async addToothLink(
    imageId: string,
    toothNumber: number,
    numberingSystem = 'universal',
  ): Promise<void> {
    await this.db.insert(imagingStudyTeeth).values({
      imageId,
      toothNumber,
      numberingSystem,
    });
  }

  async listTeethByImage(imageId: string): Promise<number[]> {
    const rows = await this.db
      .select({ toothNumber: imagingStudyTeeth.toothNumber })
      .from(imagingStudyTeeth)
      .where(eq(imagingStudyTeeth.imageId, imageId));
    return rows.map((r) => r.toothNumber);
  }

  // -------------------------------------------------------------------------
  // Calibration
  // -------------------------------------------------------------------------

  async updateImageCalibration(id: string, pixelSpacingMm: number): Promise<ImagingStudyImage> {
    const [updated] = await this.db
      .update(imagingStudyImages)
      .set({ pixelSpacingMm, updatedAt: new Date() })
      .where(eq(imagingStudyImages.id, id))
      .returning();
    if (!updated) throw new Error(`Image ${id} not found`);
    return updated;
  }

  /**
   * G6: persist a first-class VERSIONED calibration record (append-only, monotonic
   * `version` per image). `pixelSpacingMm` is derived authoritatively by the caller
   * (knownDistanceMm / pixelDistance) — never trusted from the client.
   */
  async createCalibrationVersion(
    imageId: string,
    data: {
      pointA: { x: number; y: number };
      pointB: { x: number; y: number };
      knownDistanceMm: number;
      pixelDistance: number;
      pixelSpacingMm: number;
      method?: string;
      createdBy?: string | null;
    },
  ): Promise<ImagingCalibration> {
    return createSnapshotVersion(
      this.db,
      imagingCalibrations,
      imagingCalibrations.imageId,
      imagingCalibrations.version,
      imageId,
      {
        imageId,
        pointA: data.pointA,
        pointB: data.pointB,
        knownDistanceMm: data.knownDistanceMm,
        pixelDistance: data.pixelDistance,
        pixelSpacingMm: data.pixelSpacingMm,
        method: data.method ?? 'manual_ruler',
        createdBy: data.createdBy ?? null,
      },
    ).then((row) => row as ImagingCalibration);
  }

  /** G6: latest calibration version for an image (null if never ruler-calibrated). */
  async getLatestCalibration(imageId: string): Promise<ImagingCalibration | null> {
    const [row] = await this.db
      .select()
      .from(imagingCalibrations)
      .where(eq(imagingCalibrations.imageId, imageId))
      .orderBy(desc(imagingCalibrations.version))
      .limit(1);
    return row ?? null;
  }

  // -------------------------------------------------------------------------
  // Annotations / Measurements
  // -------------------------------------------------------------------------

  async createAnnotation(
    data: Omit<NewImagingAnnotation, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'createdBy' | 'updatedBy'>,
  ): Promise<ImagingAnnotation> {
    const [annotation] = await this.db
      .insert(imagingAnnotations)
      .values(data as NewImagingAnnotation)
      .returning();
    if (!annotation) throw new Error('Failed to create annotation');
    return annotation;
  }

  async listMeasurementAnnotations(imageId: string): Promise<ImagingAnnotation[]> {
    return await this.db
      .select()
      .from(imagingAnnotations)
      .where(
        and(
          eq(imagingAnnotations.imageId, imageId),
          inArray(imagingAnnotations.type, ['line', 'angle', 'area']),
          eq(imagingAnnotations.visible, true),
        ),
      );
  }

  async findAnnotationById(id: string): Promise<ImagingAnnotation | undefined> {
    const [annotation] = await this.db
      .select()
      .from(imagingAnnotations)
      .where(eq(imagingAnnotations.id, id))
      .limit(1);
    return annotation ?? undefined;
  }

  async deleteAnnotation(id: string): Promise<void> {
    await this.db.delete(imagingAnnotations).where(eq(imagingAnnotations.id, id));
  }

  async getMemberRole(userId: string, branchId: string): Promise<string | null> {
    return getMemberRoleForImaging(this.db, userId, branchId);
  }
}
