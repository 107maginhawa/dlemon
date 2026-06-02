/**
 * DentalWaitlistEntryRepository — data access for scheduling waitlist entries.
 */

import { eq, and, desc } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { DatabaseRepository } from '@/core/database.repo';
import {
  dentalWaitlistEntries,
  type DentalWaitlistEntry,
  type NewDentalWaitlistEntry,
  type WaitlistEntryStatus,
} from './waitlist-entry.schema';

export interface WaitlistEntryFilters {
  branchId?: string;
  status?: WaitlistEntryStatus;
  patientId?: string;
}

export class DentalWaitlistEntryRepository extends DatabaseRepository<
  DentalWaitlistEntry,
  NewDentalWaitlistEntry,
  WaitlistEntryFilters
> {
  constructor(db: DatabaseInstance, logger?: any) {
    super(db, dentalWaitlistEntries, logger);
  }

  protected buildWhereConditions(filters?: WaitlistEntryFilters) {
    if (!filters) return undefined;
    const conditions = [];
    if (filters.branchId) conditions.push(eq(dentalWaitlistEntries.branchId, filters.branchId));
    if (filters.status) conditions.push(eq(dentalWaitlistEntries.status, filters.status));
    if (filters.patientId) conditions.push(eq(dentalWaitlistEntries.patientId, filters.patientId));
    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  override async findOneById(id: string): Promise<DentalWaitlistEntry | null> {
    const [row] = await this.db.select().from(dentalWaitlistEntries).where(eq(dentalWaitlistEntries.id, id));
    return row ?? null;
  }

  /**
   * List entries for a branch, newest-urgent first. When `status` is omitted,
   * only active (fillable) entries are returned — the common ASAP-fill view.
   */
  async listForBranch(branchId: string, status?: WaitlistEntryStatus): Promise<DentalWaitlistEntry[]> {
    const conditions = [eq(dentalWaitlistEntries.branchId, branchId)];
    conditions.push(eq(dentalWaitlistEntries.status, status ?? 'active'));
    return this.db
      .select()
      .from(dentalWaitlistEntries)
      .where(and(...conditions))
      .orderBy(desc(dentalWaitlistEntries.createdAt));
  }

  /**
   * Promote an active entry: mark it scheduled and link the booked appointment.
   * Guard: only an `active` entry can be promoted.
   */
  async promote(id: string, appointmentId: string, updatedBy?: string): Promise<DentalWaitlistEntry | null> {
    const [updated] = await this.db
      .update(dentalWaitlistEntries)
      .set({
        status: 'scheduled',
        promotedAppointmentId: appointmentId,
        scheduledAt: new Date(),
        updatedAt: new Date(),
        ...(updatedBy ? { updatedBy } : {}),
      })
      .where(and(eq(dentalWaitlistEntries.id, id), eq(dentalWaitlistEntries.status, 'active')))
      .returning();
    return updated ?? null;
  }
}
