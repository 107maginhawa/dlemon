/**
 * PerioReadingRepository — data access for periodontal tooth readings.
 *
 * Upsert on (chartId, toothNumber).
 */

import { eq, and, sql } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { DatabaseRepository } from '@/core/database.repo';
import type { Logger } from '@/types/logger';
import { dentalPerioToothReadings, type DentalPerioToothReading, type NewDentalPerioToothReading } from './perio-reading.schema';

export interface PerioReadingFilters {
  chartId?: string;
}

/**
 * Columns a PATCH may set. The conflict-update touches ONLY the subset of these
 * present in the request, so a single-site write never replaces the whole row.
 * Excludes the conflict target (chartId/toothNumber) and audit fields handled
 * separately (createdBy never updates; updatedBy/updatedAt always bump).
 */
const PATCHABLE_READING_COLUMNS = [
  'depthBM', 'depthBC', 'depthBD', 'depthLM', 'depthLC', 'depthLD',
  'bopBM', 'bopBC', 'bopBD', 'bopLM', 'bopLC', 'bopLD',
  'recession',
  'gmBM', 'gmBC', 'gmBD', 'gmLM', 'gmLC', 'gmLD',
  'mobility', 'furcation', 'plaque', 'suppuration', 'notes',
] as const satisfies readonly (keyof NewDentalPerioToothReading)[];

export class PerioReadingRepository extends DatabaseRepository<DentalPerioToothReading, NewDentalPerioToothReading, PerioReadingFilters> {
  constructor(db: DatabaseInstance, logger?: Logger) {
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

  /**
   * Upsert reading for (chartId, toothNumber). Returns the final row.
   *
   * The conflict-update set is built from ONLY the patchable columns actually
   * present in `values`, so a single-site PATCH (one depth per chairside
   * keystroke) leaves every other site on the tooth untouched. This is a single
   * atomic statement — no read-then-write — so concurrent same-tooth patches
   * cannot race each other's sites back to null. Omitted columns keep their
   * stored value; `createdBy`/`createdAt` are never in the set, so the original
   * creator/timestamp survive updates.
   *
   * Note: there is no clear-to-null path through this method — an omitted column
   * is preserved, not erased (the chart UI never sends null; it skips empty
   * input). A value, once set, is changed to another value, not un-set.
   */
  async upsert(values: NewDentalPerioToothReading): Promise<DentalPerioToothReading> {
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (values.updatedBy !== undefined) set['updatedBy'] = values.updatedBy;
    for (const col of PATCHABLE_READING_COLUMNS) {
      if (values[col] !== undefined) set[col] = values[col];
    }
    const [row] = await this.db
      .insert(dentalPerioToothReadings)
      .values(values)
      .onConflictDoUpdate({
        target: [dentalPerioToothReadings.chartId, dentalPerioToothReadings.toothNumber],
        set: set as Partial<NewDentalPerioToothReading>,
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
