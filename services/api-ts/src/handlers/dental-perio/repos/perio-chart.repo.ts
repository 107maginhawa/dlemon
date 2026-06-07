/**
 * PerioChartRepository — data access for periodontal charts.
 */

import { eq, and, ne, inArray, desc } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { DatabaseRepository } from '@/core/database.repo';
import { dentalPerioCharts, type DentalPerioChart, type NewDentalPerioChart } from './perio-chart.schema';
import type { Logger } from '@/types/logger';

export interface PerioChartFilters {
  visitId?: string;
  patientId?: string;
  branchId?: string;
}

export class PerioChartRepository extends DatabaseRepository<DentalPerioChart, NewDentalPerioChart, PerioChartFilters> {
  constructor(db: DatabaseInstance, logger?: Logger) {
    super(db, dentalPerioCharts, logger);
  }

  protected buildWhereConditions(filters?: PerioChartFilters) {
    if (!filters) return undefined;
    const conds = [];
    if (filters.visitId) conds.push(eq(dentalPerioCharts.visitId, filters.visitId));
    if (filters.patientId) conds.push(eq(dentalPerioCharts.patientId, filters.patientId));
    if (filters.branchId) conds.push(eq(dentalPerioCharts.branchId, filters.branchId));
    return conds.length > 0 ? and(...conds) : undefined;
  }

  override async findOneById(id: string): Promise<DentalPerioChart | null> {
    const [row] = await this.db.select().from(dentalPerioCharts).where(eq(dentalPerioCharts.id, id));
    return row ?? null;
  }

  async findByVisitId(visitId: string): Promise<DentalPerioChart | null> {
    const [row] = await this.db.select().from(dentalPerioCharts).where(eq(dentalPerioCharts.visitId, visitId));
    return row ?? null;
  }

  /**
   * Multi-exam comparison: a patient's finalized perio charts (completed or
   * locked), most recent first by completion time. Drafts are excluded — only
   * finalized exams are comparable. Bounded by `limit` (default 12).
   */
  async findFinalizedByPatient(patientId: string, limit = 12): Promise<DentalPerioChart[]> {
    return this.db
      .select()
      .from(dentalPerioCharts)
      .where(and(
        eq(dentalPerioCharts.patientId, patientId),
        inArray(dentalPerioCharts.status, ['completed', 'locked']),
      ))
      .orderBy(desc(dentalPerioCharts.completedAt))
      .limit(limit);
  }

  async complete(
    id: string,
    summary: { bopPercent: number; meanDepth: number; deepPocketCount: number },
  ): Promise<DentalPerioChart | null> {
    const [updated] = await this.db
      .update(dentalPerioCharts)
      .set({
        status: 'completed',
        completedAt: new Date(),
        summaryBopPercent: summary.bopPercent.toFixed(2),
        summaryMeanDepth: summary.meanDepth.toFixed(2),
        summaryDeepPocketCount: summary.deepPocketCount,
        updatedAt: new Date(),
      })
      .where(eq(dentalPerioCharts.id, id))
      .returning();
    return updated ?? null;
  }

  /**
   * V-PER-007: visit-lock → chart-lock cascade. Transition a not-yet-locked
   * chart for `visitId` into the terminal `locked` state. Idempotent — returns
   * null when there is no chart or it is already locked (so callers know whether
   * a state change actually happened and an audit marker should be written).
   */
  async lockByVisitId(visitId: string): Promise<DentalPerioChart | null> {
    const [updated] = await this.db
      .update(dentalPerioCharts)
      .set({ status: 'locked', updatedAt: new Date() })
      .where(and(eq(dentalPerioCharts.visitId, visitId), ne(dentalPerioCharts.status, 'locked')))
      .returning();
    return updated ?? null;
  }
}
