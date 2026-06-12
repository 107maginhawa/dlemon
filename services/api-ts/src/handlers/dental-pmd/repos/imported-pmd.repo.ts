/**
 * ImportedPMDRepository — data access for externally imported PMD records
 *
 * Imported PMDs are read-only after import. Safety Floor merge is a separate flag.
 */

import { eq, and } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { DatabaseRepository } from '@/core/database.repo';
import {
  importedPmds,
  importedPmdSafetyFloorEvents,
  type ImportedPMD,
  type NewImportedPMD,
  type ImportedPMDSafetyFloorEvent,
} from './pmd-document.schema';
import type { Logger } from '@/types/logger';

export interface ImportedPMDFilters {
  patientId?: string;
  safetyFloorMerged?: boolean;
}

export class ImportedPMDRepository extends DatabaseRepository<ImportedPMD, NewImportedPMD, ImportedPMDFilters> {
  constructor(db: DatabaseInstance, logger?: Logger) {
    super(db, importedPmds, logger);
  }

  protected buildWhereConditions(filters?: ImportedPMDFilters) {
    if (!filters) return undefined;
    const conditions = [];
    if (filters.patientId) conditions.push(eq(importedPmds.patientId, filters.patientId));
    if (filters.safetyFloorMerged !== undefined) {
      conditions.push(eq(importedPmds.safetyFloorMerged, filters.safetyFloorMerged ? 'true' : 'false'));
    }
    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  override async findMany(filters?: ImportedPMDFilters): Promise<ImportedPMD[]> {
    const where = this.buildWhereConditions(filters);
    return where
      ? await this.db.select().from(importedPmds).where(where)
      : await this.db.select().from(importedPmds);
  }

  override async findOneById(id: string): Promise<ImportedPMD | null> {
    const [row] = await this.db.select().from(importedPmds).where(eq(importedPmds.id, id));
    return row ?? null;
  }

  async markSafetyFloorMerged(id: string): Promise<ImportedPMD | null> {
    const [updated] = await this.db
      .update(importedPmds)
      .set({ safetyFloorMerged: 'true', updatedAt: new Date() })
      .where(eq(importedPmds.id, id))
      .returning();
    return updated ?? null;
  }

  /**
   * EF-PMD-003 (decision #20): record the safety-floor merge as an APPEND-ONLY
   * event. The unique index on imported_pmd_id makes merge-once a DB invariant —
   * a concurrent or repeat merge raises 23505, which the handler maps to 409.
   * Never updates an existing event (immutability by construction).
   */
  async recordSafetyFloorMergeEvent(
    importedPmdId: string,
    mergedBy: string | null,
  ): Promise<ImportedPMDSafetyFloorEvent> {
    const [event] = await this.db
      .insert(importedPmdSafetyFloorEvents)
      .values({ importedPmdId, mergedBy })
      .returning();
    if (!event) throw new Error('Failed to record safety-floor merge event');
    return event;
  }
}
