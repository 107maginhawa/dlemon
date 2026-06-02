/**
 * ImagingCephRepository — data access for cephalometric analysis (v1.4)
 *
 * Mirrors imaging_finding.repo.ts patterns.
 * batchUpsert skips locked rows via setWhere (D-E).
 * createReportVersion is append-only (D-I).
 */

import { eq, and, sql, desc } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { createSnapshotVersion } from '@/core/database.schema';
import {
  imagingCephLandmarks,
  imagingCephAnalyses,
  imagingCephReports,
  imagingCephSuperimpositions,
  type ImagingCephLandmark,
  type NewImagingCephLandmark,
  type ImagingCephAnalysis,
  type ImagingCephReport,
  type ImagingCephSuperimposition,
} from './imaging_ceph.schema';

export type UpdateLandmarkPayload = Partial<
  Pick<ImagingCephLandmark, 'x' | 'y' | 'status' | 'source'>
>;

export type UpsertLandmarkInput = {
  imageId: string;
  landmarkCode: string;
  x: number;
  y: number;
  source?: 'manual' | 'ai' | 'ai_corrected';
  confidence?: number | null;
  status?: 'placed' | 'confirmed' | 'locked';
};

export type UpsertAnalysisInput = {
  measurements: Record<string, number | null>;
  calibrationValue?: number | null;
  calibrationMethod?: 'dicom_tag' | 'manual_ruler' | 'assumed_default' | 'not_calibrated';
  calibratedAt?: Date | null;
  calibratedBy?: string | null;
};

export class ImagingCephRepository {
  constructor(private readonly db: DatabaseInstance) {}

  // -------------------------------------------------------------------------
  // Landmarks
  // -------------------------------------------------------------------------

  async listByImage(imageId: string): Promise<ImagingCephLandmark[]> {
    return this.db
      .select()
      .from(imagingCephLandmarks)
      .where(eq(imagingCephLandmarks.imageId, imageId));
  }

  async findByCode(imageId: string, landmarkCode: string): Promise<ImagingCephLandmark | null> {
    const [row] = await this.db
      .select()
      .from(imagingCephLandmarks)
      .where(
        and(
          eq(imagingCephLandmarks.imageId, imageId),
          eq(imagingCephLandmarks.landmarkCode, landmarkCode),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  /** Upsert landmarks; silently skips rows whose existing status is 'locked' (D-E). */
  async batchUpsert(items: UpsertLandmarkInput[]): Promise<void> {
    if (items.length === 0) return;
    const values: NewImagingCephLandmark[] = items.map((item) => ({
      imageId: item.imageId,
      landmarkCode: item.landmarkCode,
      x: item.x,
      y: item.y,
      source: item.source ?? 'manual',
      confidence: item.confidence ?? null,
      status: item.status ?? 'placed',
    }));

    await this.db
      .insert(imagingCephLandmarks)
      .values(values)
      .onConflictDoUpdate({
        target: [imagingCephLandmarks.imageId, imagingCephLandmarks.landmarkCode],
        set: {
          x: sql`excluded.x`,
          y: sql`excluded.y`,
          source: sql`excluded.source`,
          confidence: sql`excluded.confidence`,
          updatedAt: sql`now()`,
        },
        // Condition on the existing row: only update if NOT locked
        setWhere: sql`${imagingCephLandmarks.status} != 'locked'`,
      });
  }

  async update(id: string, data: UpdateLandmarkPayload): Promise<ImagingCephLandmark | null> {
    const [row] = await this.db
      .update(imagingCephLandmarks)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(imagingCephLandmarks.id, id))
      .returning();
    return row ?? null;
  }

  async deleteByCode(imageId: string, landmarkCode: string): Promise<void> {
    await this.db
      .delete(imagingCephLandmarks)
      .where(
        and(
          eq(imagingCephLandmarks.imageId, imageId),
          eq(imagingCephLandmarks.landmarkCode, landmarkCode),
        ),
      );
  }

  // -------------------------------------------------------------------------
  // Analysis
  // -------------------------------------------------------------------------

  async findAnalysis(
    imageId: string,
    analysisType = 'steiner_hybrid_sn',
  ): Promise<ImagingCephAnalysis | null> {
    const [row] = await this.db
      .select()
      .from(imagingCephAnalyses)
      .where(
        and(
          eq(imagingCephAnalyses.imageId, imageId),
          eq(imagingCephAnalyses.analysisType, analysisType as 'steiner_hybrid_sn' | 'ricketts'),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async upsertAnalysis(
    imageId: string,
    data: UpsertAnalysisInput,
    analysisType = 'steiner_hybrid_sn',
  ): Promise<ImagingCephAnalysis> {
    const [row] = await this.db
      .insert(imagingCephAnalyses)
      .values({
        imageId,
        analysisType: analysisType as 'steiner_hybrid_sn' | 'ricketts',
        measurements: data.measurements,
        calibrationValue: data.calibrationValue ?? null,
        calibrationMethod: data.calibrationMethod ?? 'not_calibrated',
        calibratedAt: data.calibratedAt ?? null,
        calibratedBy: data.calibratedBy ?? null,
      })
      .onConflictDoUpdate({
        target: [imagingCephAnalyses.imageId, imagingCephAnalyses.analysisType],
        set: {
          measurements: data.measurements,
          updatedAt: sql`now()`,
        },
      })
      .returning();
    if (!row) throw new Error('Failed to upsert ceph analysis');
    return row;
  }

  // -------------------------------------------------------------------------
  // Reports (immutable, append-only — D-I)
  // -------------------------------------------------------------------------

  /** Inserts a new report version with monotonically increasing version number. */
  async createReportVersion(
    imageId: string,
    snapshot: Record<string, unknown>,
    userId: string | null,
  ): Promise<ImagingCephReport> {
    return createSnapshotVersion(
      this.db,
      imagingCephReports,
      imagingCephReports.imageId,
      imagingCephReports.version,
      imageId,
      { imageId, snapshot, createdBy: userId ?? null },
    ).then(row => row as ImagingCephReport);
  }

  async getLatestReport(imageId: string): Promise<ImagingCephReport | null> {
    const [row] = await this.db
      .select()
      .from(imagingCephReports)
      .where(eq(imagingCephReports.imageId, imageId))
      .orderBy(desc(imagingCephReports.version))
      .limit(1);
    return row ?? null;
  }

  async getReportByVersion(imageId: string, version: number): Promise<ImagingCephReport | null> {
    const [row] = await this.db
      .select()
      .from(imagingCephReports)
      .where(
        and(
          eq(imagingCephReports.imageId, imageId),
          eq(imagingCephReports.version, version),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async getReportById(reportId: string): Promise<ImagingCephReport | null> {
    const [row] = await this.db
      .select()
      .from(imagingCephReports)
      .where(eq(imagingCephReports.id, reportId))
      .limit(1);
    return row ?? null;
  }

  // -------------------------------------------------------------------------
  // Superimposition (P1-11; effectively immutable per (pair, reference) —
  // recompute mints a new row, never mutates, mirroring D-I).
  // -------------------------------------------------------------------------

  async createSuperimposition(input: {
    patientId: string;
    reportFromId: string;
    reportToId: string;
    referenceType: 'cranial_base' | 'maxillary' | 'mandibular';
    transform: Record<string, unknown>;
    deltas: Record<string, unknown>;
    calibrationBasis: Record<string, unknown>;
    userId: string | null;
  }): Promise<ImagingCephSuperimposition> {
    const [row] = await this.db
      .insert(imagingCephSuperimpositions)
      .values({
        patientId: input.patientId,
        reportFromId: input.reportFromId,
        reportToId: input.reportToId,
        referenceType: input.referenceType,
        transform: input.transform,
        deltas: input.deltas,
        calibrationBasis: input.calibrationBasis,
        createdBy: input.userId,
      })
      .returning();
    if (!row) throw new Error('Failed to create ceph superimposition');
    return row;
  }

  async getSuperimpositionById(id: string): Promise<ImagingCephSuperimposition | null> {
    const [row] = await this.db
      .select()
      .from(imagingCephSuperimpositions)
      .where(eq(imagingCephSuperimpositions.id, id))
      .limit(1);
    return row ?? null;
  }

  async listSuperimpositionsByPatient(
    patientId: string,
  ): Promise<ImagingCephSuperimposition[]> {
    return this.db
      .select()
      .from(imagingCephSuperimpositions)
      .where(eq(imagingCephSuperimpositions.patientId, patientId))
      .orderBy(desc(imagingCephSuperimpositions.createdAt));
  }
}
