/**
 * PMDDocumentRepository — data access for PMD documents (immutable)
 *
 * PMDs are append-only: no update after creation. Superseding marks old as superseded.
 *
 * Phase-2 (FR12.4): `sign()` would add signature + signedAt, but facility digital
 * signing is honestly deferred — it has NO production callers in V1, so no PMD ever
 * reaches the `signed` state. The method + columns are retained as a forward-compatible
 * stub (exercised by repo unit tests only). Content integrity in V1 is the SHA-256
 * checksum (tamper-evidence), not a digital signature / non-repudiation.
 */

import { eq, and } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { DatabaseRepository } from '@/core/database.repo';
import type { Logger } from '@/types/logger';
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
  constructor(db: DatabaseInstance, logger?: Logger) {
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

  /** Phase-2 (FR12.4) stub — no production callers in V1; digital signing is deferred. */
  async sign(id: string, signature: string): Promise<PMDDocument | null> {
    const [updated] = await this.db
      .update(pmdDocuments)
      .set({ status: 'signed', signature, signedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(pmdDocuments.id, id), eq(pmdDocuments.status, 'generated')))
      .returning();
    return updated ?? null;
  }

  async supersede(oldId: string, newPMD: NewPMDDocument): Promise<PMDDocument> {
    // Supersession (schema-fix #4): mark the old row superseded FIRST, then insert
    // the replacement. Order matters under the pmd_document_visit_generated_unique
    // partial index — the old row must leave 'generated' before the new 'generated'
    // row is inserted. Under a concurrent completion the loser's insert trips the
    // index; generatePmdForVisit catches that and resolves idempotently.
    // (Kept as two statements rather than a db.transaction so repo tests using the
    // openTestTx BEGIN/ROLLBACK harness — where a nested db.transaction would COMMIT
    // the outer test tx — stay isolated.)
    await this.db
      .update(pmdDocuments)
      .set({ status: 'superseded', updatedAt: new Date() })
      .where(eq(pmdDocuments.id, oldId));
    const [created] = await this.db
      .insert(pmdDocuments)
      .values({ ...newPMD, supersedesId: oldId })
      .returning();
    return created!;
  }
}
