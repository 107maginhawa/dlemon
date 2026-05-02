/**
 * ImportedPMDRepository — data access for externally imported PMD records
 *
 * Imported PMDs are read-only after import. Safety Floor merge is a separate flag.
 */

import { eq, and } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { DatabaseRepository } from '@/core/database.repo';
import { importedPmds, type ImportedPMD, type NewImportedPMD } from './pmd-document.schema';

export interface ImportedPMDFilters {
  patientId?: string;
  safetyFloorMerged?: boolean;
}

export class ImportedPMDRepository extends DatabaseRepository<ImportedPMD, NewImportedPMD, ImportedPMDFilters> {
  constructor(db: DatabaseInstance, logger?: any) {
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
}
