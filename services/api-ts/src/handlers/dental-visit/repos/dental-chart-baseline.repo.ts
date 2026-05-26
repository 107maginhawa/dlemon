import { eq } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { dentalPatientChartBaselines, type DentalPatientChartBaseline } from './dental-chart-baseline.schema';
import type { ToothChartState } from './dental-chart.schema';

export class DentalChartBaselineRepository {
  constructor(private db: DatabaseInstance, private logger?: any) {}

  async findByPatient(patientId: string): Promise<DentalPatientChartBaseline | null> {
    const [row] = await this.db
      .select()
      .from(dentalPatientChartBaselines)
      .where(eq(dentalPatientChartBaselines.patientId, patientId))
      .limit(1);
    return row ?? null;
  }

  /**
   * Merge visitTeeth into the patient baseline (last-write-wins per tooth number).
   * Creates the baseline row if absent.
   */
  async mergeVisitChart(
    patientId: string,
    visitId: string,
    visitTeeth: ToothChartState[],
    actorId: string,
  ): Promise<DentalPatientChartBaseline> {
    const existing = await this.findByPatient(patientId);

    const merged = this.mergeTeeth(existing?.teeth ?? [], visitTeeth);
    const now = new Date();

    if (existing) {
      const [updated] = await this.db
        .update(dentalPatientChartBaselines)
        .set({ teeth: merged, lastVisitId: visitId, snapshotAt: now, updatedAt: now, updatedBy: actorId })
        .where(eq(dentalPatientChartBaselines.patientId, patientId))
        .returning();
      return updated!;
    }

    const [created] = await this.db
      .insert(dentalPatientChartBaselines)
      .values({
        patientId,
        teeth: merged,
        lastVisitId: visitId,
        snapshotAt: now,
        createdBy: actorId,
        updatedBy: actorId,
      })
      .returning();
    return created!;
  }

  private mergeTeeth(baseline: ToothChartState[], incoming: ToothChartState[]): ToothChartState[] {
    const map = new Map<number, ToothChartState>();
    for (const tooth of baseline) map.set(tooth.toothNumber, tooth);
    for (const tooth of incoming) {
      const cur = map.get(tooth.toothNumber);
      const curIsExisting = cur?.entryClassification === 'existing' || cur?.entryClassification === 'existing_other';
      const incomingIsExisting = tooth.entryClassification === 'existing' || tooth.entryClassification === 'existing_other';
      // CHART-BR-002: protect existing/existing_other baseline entries from
      // treatment_plan/condition overwrites. Only another existing-tier entry can replace them.
      if (!curIsExisting || incomingIsExisting) {
        map.set(tooth.toothNumber, tooth);
      }
    }
    return Array.from(map.values()).sort((a, b) => a.toothNumber - b.toothNumber);
  }
}
