/**
 * DentalAppointmentRepository — data access for dental appointments
 *
 * Handles appointment lifecycle: scheduled -> checkedIn -> completed | cancelled | noShow
 * No-show is reversible (can revert to completed per PRD FR3.x).
 */

import { eq, and, gte, lt, ne, or, sql } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { DatabaseRepository } from '@/core/database.repo';
import {
  dentalAppointments,
  type DentalAppointment,
  type NewDentalAppointment,
  type AppointmentStatus,
} from './dental-appointment.schema';

export type AppointmentWithPatientName = Omit<DentalAppointment, never> & { patientName: string | undefined };

export interface AppointmentFilters {
  branchId?: string;
  dentistMemberId?: string;
  date?: string; // ISO date string, e.g. '2025-06-01'
  status?: AppointmentStatus;
  patientId?: string;
}

export class DentalAppointmentRepository extends DatabaseRepository<DentalAppointment, NewDentalAppointment, AppointmentFilters> {
  constructor(db: DatabaseInstance, logger?: any) {
    super(db, dentalAppointments, logger);
  }

  protected buildWhereConditions(filters?: AppointmentFilters) {
    if (!filters) return undefined;
    const conditions = [];
    if (filters.branchId) conditions.push(eq(dentalAppointments.branchId, filters.branchId));
    if (filters.dentistMemberId) conditions.push(eq(dentalAppointments.dentistMemberId, filters.dentistMemberId));
    if (filters.status) conditions.push(eq(dentalAppointments.status, filters.status));
    if (filters.patientId) conditions.push(eq(dentalAppointments.patientId, filters.patientId));
    if (filters.date) {
      const dayStart = new Date(filters.date + 'T00:00:00.000Z');
      const dayEnd = new Date(filters.date + 'T23:59:59.999Z');
      conditions.push(gte(dentalAppointments.scheduledAt, dayStart));
      conditions.push(lt(dentalAppointments.scheduledAt, new Date(dayEnd.getTime() + 1)));
    }
    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  override async findMany(filters?: AppointmentFilters): Promise<DentalAppointment[]> {
    const where = this.buildWhereConditions(filters);
    return where
      ? await this.db.select().from(dentalAppointments).where(where)
      : await this.db.select().from(dentalAppointments);
  }

  override async findOneById(id: string): Promise<DentalAppointment | null> {
    const [row] = await this.db.select().from(dentalAppointments).where(eq(dentalAppointments.id, id));
    return row ?? null;
  }

  /**
   * P1-25: resolve an online booking by its unguessable confirmation code (the
   * bearer for the public lookup endpoint). Returns null when no row matches.
   */
  async findByConfirmationCode(confirmationCode: string): Promise<DentalAppointment | null> {
    const [row] = await this.db
      .select()
      .from(dentalAppointments)
      .where(eq(dentalAppointments.confirmationCode, confirmationCode));
    return row ?? null;
  }

  /**
   * Confirm an appointment: records the patient acknowledged they will attend.
   * Guard: only a `scheduled` appointment can be confirmed.
   */
  async confirm(id: string, updatedBy?: string): Promise<DentalAppointment | null> {
    const [updated] = await this.db
      .update(dentalAppointments)
      .set({
        status: 'confirmed',
        confirmedAt: new Date(),
        updatedAt: new Date(),
        ...(updatedBy ? { updatedBy } : {}),
      })
      .where(and(eq(dentalAppointments.id, id), eq(dentalAppointments.status, 'scheduled')))
      .returning();
    return updated ?? null;
  }

  /**
   * Check in an appointment: sets status to checkedIn and records checkInTime.
   * Guard: a scheduled OR confirmed appointment can be checked in.
   */
  async checkIn(id: string, updatedBy?: string): Promise<DentalAppointment | null> {
    const [updated] = await this.db
      .update(dentalAppointments)
      .set({
        status: 'checked_in',
        checkInTime: new Date(),
        updatedAt: new Date(),
        ...(updatedBy ? { updatedBy } : {}),
      })
      .where(and(
        eq(dentalAppointments.id, id),
        or(eq(dentalAppointments.status, 'scheduled'), eq(dentalAppointments.status, 'confirmed')),
      ))
      .returning();
    return updated ?? null;
  }

  /**
   * Cancel an appointment: sets status to cancelled and records cancelledAt + optional reason.
   * Guard: only scheduled, confirmed or checkedIn appointments can be cancelled.
   */
  async cancel(id: string, reason?: string, updatedBy?: string): Promise<DentalAppointment | null> {
    const [updated] = await this.db
      .update(dentalAppointments)
      .set({
        status: 'cancelled',
        cancelledAt: new Date(),
        cancellationReason: reason ?? null,
        updatedAt: new Date(),
        ...(updatedBy ? { updatedBy } : {}),
      })
      .where(and(
        eq(dentalAppointments.id, id),
        or(
          eq(dentalAppointments.status, 'scheduled'),
          eq(dentalAppointments.status, 'confirmed'),
          eq(dentalAppointments.status, 'checked_in'),
        ),
      ))
      .returning();
    return updated ?? null;
  }

  /**
   * Mark an appointment as no-show.
   * Guard: only scheduled, confirmed or checkedIn appointments can be marked as no-show.
   */
  async markNoShow(id: string, updatedBy?: string): Promise<DentalAppointment | null> {
    const [updated] = await this.db
      .update(dentalAppointments)
      .set({
        status: 'no_show',
        noShowAt: new Date(),
        updatedAt: new Date(),
        ...(updatedBy ? { updatedBy } : {}),
      })
      .where(and(
        eq(dentalAppointments.id, id),
        or(
          eq(dentalAppointments.status, 'scheduled'),
          eq(dentalAppointments.status, 'confirmed'),
          eq(dentalAppointments.status, 'checked_in'),
        ),
      ))
      .returning();
    return updated ?? null;
  }

  /**
   * Revert a no-show appointment back to completed status (reversible per PRD).
   */
  async revertNoShow(id: string, updatedBy?: string): Promise<DentalAppointment | null> {
    const [updated] = await this.db
      .update(dentalAppointments)
      .set({
        status: 'completed',
        noShowAt: null,
        updatedAt: new Date(),
        ...(updatedBy ? { updatedBy } : {}),
      })
      .where(and(eq(dentalAppointments.id, id), eq(dentalAppointments.status, 'no_show')))
      .returning();
    return updated ?? null;
  }

  /**
   * FR3.7: Find overlapping appointments for the same dentist in the same branch.
   * Overlap = the proposed time window intersects with an existing scheduled/checkedIn appointment.
   * Non-blocking — caller decides whether to warn or block.
   *
   * Uses proper interval math: existing.start < proposed.end AND existing.end > proposed.start
   * where existing.end = existing.scheduledAt + existing.durationMinutes (computed via SQL interval).
   */
  async findOverlapping(
    dentistMemberId: string,
    branchId: string,
    startTime: Date,
    durationMinutes: number,
    excludeId?: string,
  ): Promise<DentalAppointment[]> {
    const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);
    const conditions = [
      eq(dentalAppointments.dentistMemberId, dentistMemberId),
      eq(dentalAppointments.branchId, branchId),
      // Overlap condition: existing.start < proposed.end
      lt(dentalAppointments.scheduledAt, endTime),
      // AND existing.end > proposed.start  (computed: start + duration interval)
      sql`${dentalAppointments.scheduledAt} + (${dentalAppointments.durationMinutes} * interval '1 minute') > ${startTime.toISOString()}::timestamptz`,
      or(
        eq(dentalAppointments.status, 'scheduled'),
        eq(dentalAppointments.status, 'confirmed'),
        eq(dentalAppointments.status, 'checked_in'),
      )!,
    ];
    if (excludeId) {
      conditions.push(ne(dentalAppointments.id, excludeId));
    }
    return await this.db.select().from(dentalAppointments).where(and(...conditions));
  }

  /**
   * Link a visit to an appointment after check-in creates a draft visit.
   */
  async linkVisit(id: string, visitId: string): Promise<DentalAppointment | null> {
    const [updated] = await this.db
      .update(dentalAppointments)
      .set({
        visitId,
        updatedAt: new Date(),
      })
      .where(eq(dentalAppointments.id, id))
      .returning();
    return updated ?? null;
  }
}
