/**
 * VisitRepository — data access for dental visits
 *
 * Handles visit lifecycle: draft → active → completed → locked
 * EC7: only one active visit per patient enforced at DB level (unique index)
 *      and at application level via findActiveByPatient.
 */

import { eq, and, or } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { DatabaseRepository } from '@/core/database.repo';
import {
  dentalVisits,
  type DentalVisit,
  type NewDentalVisit,
  type DentalVisitStatus,
} from './visit.schema';

export interface VisitFilters {
  patientId?: string;
  branchId?: string;
  status?: DentalVisitStatus;
}

export class VisitRepository extends DatabaseRepository<DentalVisit, NewDentalVisit, VisitFilters> {
  constructor(db: DatabaseInstance, logger?: any) {
    super(db, dentalVisits, logger);
  }

  protected buildWhereConditions(filters?: VisitFilters) {
    if (!filters) return undefined;
    const conditions = [];
    if (filters.patientId) conditions.push(eq(dentalVisits.patientId, filters.patientId));
    if (filters.branchId) conditions.push(eq(dentalVisits.branchId, filters.branchId));
    if (filters.status) conditions.push(eq(dentalVisits.status, filters.status));
    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  override async findMany(filters?: VisitFilters): Promise<DentalVisit[]> {
    const where = this.buildWhereConditions(filters);
    const rows = where
      ? await this.db.select().from(dentalVisits).where(where)
      : await this.db.select().from(dentalVisits);
    return rows;
  }

  override async findOneById(id: string): Promise<DentalVisit | null> {
    const [row] = await this.db.select().from(dentalVisits).where(eq(dentalVisits.id, id));
    return row ?? null;
  }

  async findActiveByPatient(patientId: string): Promise<DentalVisit | null> {
    const [row] = await this.db
      .select()
      .from(dentalVisits)
      .where(and(eq(dentalVisits.patientId, patientId), eq(dentalVisits.status, 'active')));
    return row ?? null;
  }

  /**
   * EC7: Find any in-progress visit (draft or active) for a patient.
   * Used by checkInAppointment to enforce max-1-active-visit rule.
   */
  async findInProgressByPatient(patientId: string): Promise<DentalVisit | null> {
    const [row] = await this.db
      .select()
      .from(dentalVisits)
      .where(
        and(
          eq(dentalVisits.patientId, patientId),
          or(eq(dentalVisits.status, 'draft'), eq(dentalVisits.status, 'active'))!,
        ),
      );
    return row ?? null;
  }

  async activate(id: string): Promise<DentalVisit | null> {
    const [updated] = await this.db
      .update(dentalVisits)
      .set({ status: 'active', activatedAt: new Date(), updatedAt: new Date() })
      .where(eq(dentalVisits.id, id))
      .returning();
    return updated ?? null;
  }

  async complete(id: string): Promise<DentalVisit | null> {
    const [updated] = await this.db
      .update(dentalVisits)
      .set({ status: 'completed', completedAt: new Date(), updatedAt: new Date() })
      .where(eq(dentalVisits.id, id))
      .returning();
    return updated ?? null;
  }

  async lock(id: string): Promise<DentalVisit | null> {
    const [updated] = await this.db
      .update(dentalVisits)
      .set({ status: 'locked', lockedAt: new Date(), updatedAt: new Date() })
      .where(eq(dentalVisits.id, id))
      .returning();
    return updated ?? null;
  }

  async updateStatus(id: string, patch: Partial<Pick<DentalVisit, 'status' | 'chiefComplaint'>>): Promise<DentalVisit | null> {
    const [updated] = await this.db
      .update(dentalVisits)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(dentalVisits.id, id))
      .returning();
    return updated ?? null;
  }
}
