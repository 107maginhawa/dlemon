/**
 * PrescriptionRepository — data access for RxNorm-coded prescriptions
 */

import { eq, and } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { DatabaseRepository } from '@/core/database.repo';
import { prescriptions, type Prescription, type NewPrescription } from './prescription.schema';

export interface PrescriptionFilters {
  visitId?: string;
  patientId?: string;
}

export class PrescriptionRepository extends DatabaseRepository<Prescription, NewPrescription, PrescriptionFilters> {
  constructor(db: DatabaseInstance, logger?: any) {
    super(db, prescriptions, logger);
  }

  protected buildWhereConditions(filters?: PrescriptionFilters) {
    if (!filters) return undefined;
    const conditions = [];
    if (filters.visitId) conditions.push(eq(prescriptions.visitId, filters.visitId));
    if (filters.patientId) conditions.push(eq(prescriptions.patientId, filters.patientId));
    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  override async findMany(filters?: PrescriptionFilters): Promise<Prescription[]> {
    const where = this.buildWhereConditions(filters);
    return where
      ? await this.db.select().from(prescriptions).where(where)
      : await this.db.select().from(prescriptions);
  }

  override async findOneById(id: string): Promise<Prescription | null> {
    const [row] = await this.db.select().from(prescriptions).where(eq(prescriptions.id, id));
    return row ?? null;
  }

  async update(id: string, patch: Partial<Pick<Prescription, 'rxNormCode' | 'drugName' | 'dosage' | 'frequency' | 'duration' | 'quantity' | 'instructions'>>): Promise<Prescription | null> {
    const [updated] = await this.db
      .update(prescriptions)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(prescriptions.id, id))
      .returning();
    return updated ?? null;
  }
}
