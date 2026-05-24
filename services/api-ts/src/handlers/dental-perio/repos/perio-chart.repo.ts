/**
 * PerioChartRepository — data access for periodontal charts.
 */

import { eq, and } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { DatabaseRepository } from '@/core/database.repo';
import { dentalPerioCharts, type DentalPerioChart, type NewDentalPerioChart } from './perio-chart.schema';

export interface PerioChartFilters {
  visitId?: string;
  patientId?: string;
  branchId?: string;
}

export class PerioChartRepository extends DatabaseRepository<DentalPerioChart, NewDentalPerioChart, PerioChartFilters> {
  constructor(db: DatabaseInstance, logger?: any) {
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
}
