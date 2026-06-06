/**
 * MedicalHistoryRepository — data access for medical history entries
 */

import { eq, and } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { DatabaseRepository } from '@/core/database.repo';
import type { Logger } from '@/types/logger';
import {
  medicalHistoryEntries,
  type MedicalHistoryEntry,
  type NewMedicalHistoryEntry,
  type MedicalHistoryEntryType,
} from './medical-history.schema';

export interface MedicalHistoryFilters {
  patientId?: string;
  entryType?: MedicalHistoryEntryType;
  active?: boolean;
}

export class MedicalHistoryRepository extends DatabaseRepository<MedicalHistoryEntry, NewMedicalHistoryEntry, MedicalHistoryFilters> {
  constructor(db: DatabaseInstance, logger?: Logger) {
    super(db, medicalHistoryEntries, logger);
  }

  protected buildWhereConditions(filters?: MedicalHistoryFilters) {
    if (!filters) return undefined;
    const conditions = [];
    if (filters.patientId) conditions.push(eq(medicalHistoryEntries.patientId, filters.patientId));
    if (filters.entryType) conditions.push(eq(medicalHistoryEntries.entryType, filters.entryType));
    if (filters.active !== undefined) conditions.push(eq(medicalHistoryEntries.active, filters.active));
    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  override async findMany(filters?: MedicalHistoryFilters): Promise<MedicalHistoryEntry[]> {
    const where = this.buildWhereConditions(filters);
    return where
      ? await this.db.select().from(medicalHistoryEntries).where(where)
      : await this.db.select().from(medicalHistoryEntries);
  }

  override async findOneById(id: string): Promise<MedicalHistoryEntry | null> {
    const [row] = await this.db.select().from(medicalHistoryEntries).where(eq(medicalHistoryEntries.id, id));
    return row ?? null;
  }

  async update(
    id: string,
    patch: Partial<Pick<MedicalHistoryEntry, 'displayName' | 'notes' | 'resolvedDate' | 'active'>>,
  ): Promise<MedicalHistoryEntry | null> {
    const [updated] = await this.db
      .update(medicalHistoryEntries)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(medicalHistoryEntries.id, id))
      .returning();
    return updated ?? null;
  }
}
