/**
 * PMDDocumentRepository — data access for PMD documents (immutable)
 *
 * PMDs are append-only: no update after creation.
 * Signing adds signature + signedAt. Superseding marks old as superseded.
 */

import { eq, and } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { DatabaseRepository } from '@/core/database.repo';
import {
  pmdDocuments,
  type PMDDocument,
  type NewPMDDocument,
} from './pmd-document.schema';

export interface PMDFilters {
  patientId?: string;
  visitId?: string;
  status?: string;
}

export class PMDDocumentRepository extends DatabaseRepository<PMDDocument, NewPMDDocument, PMDFilters> {
  constructor(db: DatabaseInstance, logger?: any) {
    super(db, pmdDocuments, logger);
  }

  protected buildWhereConditions(filters?: PMDFilters) {
    if (!filters) return undefined;
    const conditions = [];
    if (filters.patientId) conditions.push(eq(pmdDocuments.patientId, filters.patientId));
    if (filters.visitId) conditions.push(eq(pmdDocuments.visitId, filters.visitId));
    if (filters.status) conditions.push(eq(pmdDocuments.status, filters.status as typeof pmdDocuments.status._.data));
    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  override async findMany(filters?: PMDFilters): Promise<PMDDocument[]> {
    const where = this.buildWhereConditions(filters);
    return where
      ? await this.db.select().from(pmdDocuments).where(where)
      : await this.db.select().from(pmdDocuments);
  }

  override async findOneById(id: string): Promise<PMDDocument | null> {
    const [row] = await this.db.select().from(pmdDocuments).where(eq(pmdDocuments.id, id));
    return row ?? null;
  }

  async findByVisit(visitId: string): Promise<PMDDocument | null> {
    const [row] = await this.db
      .select()
      .from(pmdDocuments)
      .where(and(eq(pmdDocuments.visitId, visitId), eq(pmdDocuments.status, 'generated')));
    // Return the most recent non-superseded document
    return row ?? null;
  }

  async sign(id: string, signature: string): Promise<PMDDocument | null> {
    const [updated] = await this.db
      .update(pmdDocuments)
      .set({ status: 'signed', signature, signedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(pmdDocuments.id, id), eq(pmdDocuments.status, 'generated')))
      .returning();
    return updated ?? null;
  }

  async supersede(oldId: string, newPMD: NewPMDDocument): Promise<PMDDocument> {
    // Mark old as superseded
    await this.db
      .update(pmdDocuments)
      .set({ status: 'superseded', updatedAt: new Date() })
      .where(eq(pmdDocuments.id, oldId));
    // Insert new with supersedesId
    const [created] = await this.db
      .insert(pmdDocuments)
      .values({ ...newPMD, supersedesId: oldId })
      .returning();
    return created!;
  }
}
