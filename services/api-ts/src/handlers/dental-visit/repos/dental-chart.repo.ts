/**
 * DentalChartRepository — data access for dental charts
 *
 * Each visit has at most one chart. Upsert replaces the full teeth array.
 * Per-tooth updates merge into the existing teeth array.
 */

import { eq } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import {
  dentalCharts,
  type DentalChart,
  type NewDentalChart,
  type ToothChartState,
  type ChartEntryClassification,
} from './dental-chart.schema';

export interface UpsertChartInput {
  visitId: string;
  patientId: string;
  teeth: ToothChartState[];
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
  constructor(private db: DatabaseInstance, private logger?: any) {}

  async upsert(input: UpsertChartInput): Promise<DentalChart> {
    const existing = await this.findByVisit(input.visitId);

    if (existing) {
      const [updated] = await this.db
        .update(dentalCharts)
        .set({ teeth: input.teeth, updatedAt: new Date() })
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

  private async findById(id: string): Promise<DentalChart | null> {
    const [row] = await this.db.select().from(dentalCharts).where(eq(dentalCharts.id, id));
    return row ?? null;
  }
}
