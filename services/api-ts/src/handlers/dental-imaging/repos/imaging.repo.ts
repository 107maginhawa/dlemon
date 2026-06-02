/**
 * ImagingRepository — data access for dental imaging module
 */

import { eq, and, inArray } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import {
  imagingStudies,
  imagingStudyImages,
  imagingStudyTeeth,
  imagingAnnotations,
  type ImagingStudy,
  type NewImagingStudy,
  type ImagingStudyImage,
  type NewImagingStudyImage,
  type ImagingAnnotation,
  type NewImagingAnnotation,
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
        ...(data.modality ? { modality: data.modality as any } : {}),
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
      .set({ modality: modality as any, updatedAt: new Date() })
      .where(eq(imagingStudyImages.id, id))
      .returning();
    if (!updated) throw new Error(`Image ${id} not found`);
    return updated;
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
