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
import { dentalMemberships } from '@/handlers/dental-org/repos/membership.schema';

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

  async listImagingImagesForPatient(patientId: string, branchId: string): Promise<(ImagingStudyImage & { studyBranchId: string })[]> {
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
    return rows as (ImagingStudyImage & { studyBranchId: string })[];
  }

  async archiveImage(id: string): Promise<void> {
    await this.db
      .update(imagingStudyImages)
      .set({ status: 'archived', updatedAt: new Date() })
      .where(eq(imagingStudyImages.id, id));
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
    const [member] = await this.db
      .select({ role: dentalMemberships.role })
      .from(dentalMemberships)
      .where(and(eq(dentalMemberships.personId, userId), eq(dentalMemberships.branchId, branchId)))
      .limit(1);
    return member?.role ?? null;
  }
}
