/**
 * PerioReadingRepository — data access for periodontal tooth readings.
 *
 * Upsert on (chartId, toothNumber).
 */

import { eq, and, sql } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { DatabaseRepository } from '@/core/database.repo';
import { dentalPerioToothReadings, type DentalPerioToothReading, type NewDentalPerioToothReading } from './perio-reading.schema';

export interface PerioReadingFilters {
  chartId?: string;
}

export class PerioReadingRepository extends DatabaseRepository<DentalPerioToothReading, NewDentalPerioToothReading, PerioReadingFilters> {
  constructor(db: DatabaseInstance, logger?: any) {
    super(db, dentalPerioToothReadings, logger);
  }

  protected buildWhereConditions(filters?: PerioReadingFilters) {
    if (!filters) return undefined;
    const conds = [];
    if (filters.chartId) conds.push(eq(dentalPerioToothReadings.chartId, filters.chartId));
    return conds.length > 0 ? and(...conds) : undefined;
  }

  override async findMany(filters?: PerioReadingFilters): Promise<DentalPerioToothReading[]> {
    const where = this.buildWhereConditions(filters);
    return where
      ? await this.db.select().from(dentalPerioToothReadings).where(where).orderBy(dentalPerioToothReadings.toothNumber)
      : await this.db.select().from(dentalPerioToothReadings).orderBy(dentalPerioToothReadings.toothNumber);
  }

  async findByChartAndTooth(chartId: string, toothNumber: number): Promise<DentalPerioToothReading | null> {
    const [row] = await this.db
      .select()
      .from(dentalPerioToothReadings)
      .where(and(
        eq(dentalPerioToothReadings.chartId, chartId),
        eq(dentalPerioToothReadings.toothNumber, toothNumber),
      ));
    return row ?? null;
  }

  /** Upsert reading for (chartId, toothNumber). Returns final row. */
  async upsert(values: NewDentalPerioToothReading): Promise<DentalPerioToothReading> {
    const [row] = await this.db
      .insert(dentalPerioToothReadings)
      .values(values)
      .onConflictDoUpdate({
        target: [dentalPerioToothReadings.chartId, dentalPerioToothReadings.toothNumber],
        set: {
          depthBM: values.depthBM ?? null,
          depthBC: values.depthBC ?? null,
          depthBD: values.depthBD ?? null,
          depthLM: values.depthLM ?? null,
          depthLC: values.depthLC ?? null,
          depthLD: values.depthLD ?? null,
          bopBM: values.bopBM ?? null,
          bopBC: values.bopBC ?? null,
          bopBD: values.bopBD ?? null,
          bopLM: values.bopLM ?? null,
          bopLC: values.bopLC ?? null,
          bopLD: values.bopLD ?? null,
          recession: values.recession ?? null,
          mobility: values.mobility ?? 0,
          furcation: values.furcation ?? 0,
          plaque: values.plaque ?? false,
          suppuration: values.suppuration ?? false,
          notes: values.notes ?? null,
          updatedAt: new Date(),
        },
      })
      .returning();
    if (!row) throw new Error('Upsert returned no row');
    return row;
  }

  async countByChart(chartId: string): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(dentalPerioToothReadings)
      .where(eq(dentalPerioToothReadings.chartId, chartId));
    return Number(result[0]?.count ?? 0);
  }
}
