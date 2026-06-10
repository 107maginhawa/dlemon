/**
 * DentalChartRepository — data access for dental charts
 *
 * Each visit has at most one chart. Upsert replaces the full teeth array.
 * Per-tooth updates merge into the existing teeth array.
 */

import { eq } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import type { Logger } from '@/types/logger';
import { createSnapshotVersion } from '@/core/database.schema';
import {
  dentalCharts,
  dentalChartVersions,
  type DentalChart,
  type DentalChartVersion,
  type NewDentalChart,
  type ToothChartState,
  type ChartEntryClassification,
} from './dental-chart.schema';

export interface UpsertChartInput {
  visitId: string;
  patientId: string;
  teeth: ToothChartState[];
  /** GAP-001: optional client-generated id, persisted only on first insert */
  localId?: string;
}

export interface UpdateToothInput {
  toothNumber: number;
  state?: string;
  surfaces?: string[];
  conditionCode?: string;
  note?: string;
  surfaceConditionMap?: Record<string, unknown>;
  entryClassification?: ChartEntryClassification;
}

export class DentalChartRepository {
  constructor(private db: DatabaseInstance, private logger?: Logger) {}

  async upsert(input: UpsertChartInput): Promise<DentalChart> {
    const existing = await this.findByVisit(input.visitId);

    if (existing) {
      // CHART-BR-002: teeth with 'existing'/'existing_other' classification are
      // immutable — non-baseline incoming entries cannot overwrite them.
      const BASELINE = new Set<string>(['existing', 'existing_other']);
      const existingTeeth = existing.teeth as ToothChartState[];

      const baselineMap = new Map<number, ToothChartState>();
      for (const tooth of existingTeeth) {
        if (tooth.entryClassification && BASELINE.has(tooth.entryClassification)) {
          baselineMap.set(tooth.toothNumber, tooth);
        }
      }

      const nonBaselineMap = new Map<number, ToothChartState>();
      for (const incoming of input.teeth) {
        if (incoming.entryClassification && BASELINE.has(incoming.entryClassification)) {
          baselineMap.set(incoming.toothNumber, incoming);
        } else if (!baselineMap.has(incoming.toothNumber)) {
          nonBaselineMap.set(incoming.toothNumber, incoming);
        }
        // else: non-baseline attempting to overwrite baseline tooth → skip
      }

      const mergedTeeth = [...baselineMap.values(), ...nonBaselineMap.values()];
      const [updated] = await this.db
        .update(dentalCharts)
        .set({ teeth: mergedTeeth, updatedAt: new Date() })
        .where(eq(dentalCharts.id, existing.id))
        .returning();
      return updated!;
    }

    const [created] = await this.db
      .insert(dentalCharts)
      .values({
        visitId: input.visitId,
        patientId: input.patientId,
        teeth: input.teeth,
        // GAP-001: persist optional client-generated id on first insert.
        localId: input.localId,
      })
      .returning();
    return created!;
  }

  async findByVisit(visitId: string): Promise<DentalChart | null> {
    const [row] = await this.db
      .select()
      .from(dentalCharts)
      .where(eq(dentalCharts.visitId, visitId));
    return row ?? null;
  }

  /**
   * SL-12 / F-G04: record a durable sync conflict on the chart. When the baseline
   * merge rejects stale teeth (lost the clock comparison) the losing write is not
   * dropped — the chart is flagged syncStatus='conflict' and the rejected teeth are
   * persisted to conflictPayload for a future conflict-resolution UI to surface.
   */
  async flagSyncConflict(chartId: string, rejectedTeeth: ToothChartState[]): Promise<DentalChart | null> {
    const [updated] = await this.db
      .update(dentalCharts)
      .set({
        syncStatus: 'conflict',
        conflictPayload: { reason: 'stale_clock_rejected', rejectedTeeth },
        updatedAt: new Date(),
      })
      .where(eq(dentalCharts.id, chartId))
      .returning();
    return updated ?? null;
  }

  async updateTooth(chartId: string, update: UpdateToothInput): Promise<DentalChart | null> {
    const chart = await this.findById(chartId);
    if (!chart) return null;

    const existingTeeth = chart.teeth as ToothChartState[];
    const idx = existingTeeth.findIndex(t => t.toothNumber === update.toothNumber);
    const existingTooth = idx >= 0 ? existingTeeth[idx] : undefined;

    const updatedTooth: ToothChartState = {
      toothNumber: update.toothNumber,
      state: update.state ?? existingTooth?.state ?? 'normal',
      surfaces: update.surfaces ?? existingTooth?.surfaces,
      conditionCode: update.conditionCode ?? existingTooth?.conditionCode,
      note: update.note ?? existingTooth?.note,
      surfaceConditionMap: update.surfaceConditionMap ?? existingTooth?.surfaceConditionMap,
      entryClassification: update.entryClassification ?? existingTooth?.entryClassification,
    };

    let newTeeth: ToothChartState[];
    if (idx >= 0) {
      newTeeth = [...existingTeeth];
      newTeeth[idx] = updatedTooth;
    } else {
      newTeeth = [...existingTeeth, updatedTooth];
    }

    const [updated] = await this.db
      .update(dentalCharts)
      .set({ teeth: newTeeth, updatedAt: new Date() })
      .where(eq(dentalCharts.id, chartId))
      .returning();
    return updated ?? null;
  }

  async saveVersion(chartId: string, teeth: ToothChartState[], savedBy?: string): Promise<DentalChartVersion> {
    return createSnapshotVersion(
      this.db,
      dentalChartVersions,
      dentalChartVersions.chartId,
      dentalChartVersions.version,
      chartId,
      { chartId, snapshot: { teeth } as Record<string, unknown>, createdBy: savedBy ?? null },
    ) as Promise<DentalChartVersion>;
  }

  private async findById(id: string): Promise<DentalChart | null> {
    const [row] = await this.db.select().from(dentalCharts).where(eq(dentalCharts.id, id));
    return row ?? null;
  }
}
