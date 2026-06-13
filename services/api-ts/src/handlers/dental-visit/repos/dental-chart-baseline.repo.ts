import { eq } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { dentalPatientChartBaselines, type DentalPatientChartBaseline } from './dental-chart-baseline.schema';
import type { ToothChartState } from './dental-chart.schema';
import type { Logger } from '@/types/logger';

export class DentalChartBaselineRepository {
  constructor(private db: DatabaseInstance, private logger?: Logger) {}

  async findByPatient(patientId: string): Promise<DentalPatientChartBaseline | null> {
    const [row] = await this.db
      .select()
      .from(dentalPatientChartBaselines)
      .where(eq(dentalPatientChartBaselines.patientId, patientId))
      .limit(1);
    return row ?? null;
  }

  /**
   * Merge visitTeeth into the patient baseline (clock-aware last-write-wins per
   * tooth number). Creates the baseline row if absent.
   *
   * SL-12 / F-G04: returns the teeth REJECTED as stale (lost the clock comparison)
   * alongside the persisted baseline, so the caller can record a durable sync
   * conflict instead of silently dropping the losing write.
   */
  async mergeVisitChart(
    patientId: string,
    visitId: string,
    visitTeeth: ToothChartState[],
    actorId: string,
  ): Promise<{ baseline: DentalPatientChartBaseline; conflicts: ToothChartState[] }> {
    const existing = await this.findByPatient(patientId);

    const { merged, conflicts } = this.mergeTeeth(existing?.teeth ?? [], visitTeeth);
    const now = new Date();

    if (existing) {
      const [updated] = await this.db
        .update(dentalPatientChartBaselines)
        .set({ teeth: merged, lastVisitId: visitId, snapshotAt: now, updatedAt: now, updatedBy: actorId })
        .where(eq(dentalPatientChartBaselines.patientId, patientId))
        .returning();
      return { baseline: updated!, conflicts };
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
    return { baseline: created!, conflicts };
  }

  private mergeTeeth(
    baseline: ToothChartState[],
    incoming: ToothChartState[],
  ): { merged: ToothChartState[]; conflicts: ToothChartState[] } {
    const map = new Map<number, ToothChartState>();
    const conflicts: ToothChartState[] = [];
    for (const tooth of baseline) map.set(tooth.toothNumber, tooth);
    for (const tooth of incoming) {
      const cur = map.get(tooth.toothNumber);
      const curIsExisting = cur?.entryClassification === 'existing' || cur?.entryClassification === 'existing_other';
      const incomingIsExisting = tooth.entryClassification === 'existing' || tooth.entryClassification === 'existing_other';
      // CHART-BR-002 (top guard): protect existing/existing_other baseline entries
      // from treatment_plan/condition overwrites. Only another existing-tier entry
      // can replace them — this wins even over a higher incoming clock. This is an
      // intentional clinical protection, NOT a sync conflict, so it is not recorded.
      if (curIsExisting && !incomingIsExisting) {
        continue;
      }
      // SL-02 / F-G03: clock-aware last-write-wins. When BOTH the current and the
      // incoming tooth carry a monotonic clock, a lower incoming clock is a stale
      // offline write — keep the current (newer) tooth. Absent clock on either side
      // falls through to incoming-wins (backward-compatible with online writes).
      if (cur && typeof cur.clock === 'number' && typeof tooth.clock === 'number' && tooth.clock < cur.clock) {
        // SL-12 / F-G04: the stale write loses but is NOT silently dropped — record
        // it so the caller can persist a durable conflict.
        conflicts.push(tooth);
        continue;
      }
      map.set(tooth.toothNumber, tooth);
    }
    return { merged: Array.from(map.values()).sort((a, b) => a.toothNumber - b.toothNumber), conflicts };
  }
}
