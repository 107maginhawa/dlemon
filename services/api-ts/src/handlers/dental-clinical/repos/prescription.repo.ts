/**
 * PrescriptionRepository — data access for RxNorm-coded prescriptions
 *
 * Status FSM (EM-CLI-012): pending → dispensed | cancelled (both terminal)
 */

import { eq, and } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { DatabaseRepository } from '@/core/database.repo';
import {
  prescriptions,
  type Prescription,
  type NewPrescription,
  type PrescriptionStatus,
  PRESCRIPTION_TRANSITIONS,
} from './prescription.schema';

export interface PrescriptionFilters {
  visitId?: string;
  patientId?: string;
  status?: PrescriptionStatus;
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
    if (filters.status) conditions.push(eq(prescriptions.status, filters.status));
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

  /**
   * Transition prescription status with FSM guard.
   * Returns `{ prescription: null, error }` on invalid transition.
   */
  async updateStatus(
    id: string,
    newStatus: PrescriptionStatus,
  ): Promise<{ prescription: Prescription | null; error?: string }> {
    const existing = await this.findOneById(id);
    if (!existing) return { prescription: null };

    const allowed = PRESCRIPTION_TRANSITIONS[existing.status];
    if (!allowed.includes(newStatus)) {
      return {
        prescription: null,
        error: `Cannot transition prescription from '${existing.status}' to '${newStatus}'`,
      };
    }

    const [updated] = await this.db
      .update(prescriptions)
      .set({ status: newStatus, updatedAt: new Date() })
      .where(eq(prescriptions.id, id))
      .returning();
    return { prescription: updated ?? null };
  }

  async update(id: string, patch: Partial<Pick<Prescription, 'rxNormCode' | 'drugName' | 'dosage' | 'frequency' | 'duration' | 'quantity' | 'instructions' | 'controlledSubstanceSchedule' | 'prescriberDea' | 'prescriberNpi'>>): Promise<Prescription | null> {
    const [updated] = await this.db
      .update(prescriptions)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(prescriptions.id, id))
      .returning();
    return updated ?? null;
  }
}
