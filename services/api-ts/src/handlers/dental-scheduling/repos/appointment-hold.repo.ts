/**
 * AppointmentHoldRepository — data access for P1-25 slot holds.
 *
 * Holds are short-TTL soft reservations. The repo exposes:
 *  - createOne: place a hold
 *  - findActiveOverlapping: holds that still occupy a provider window (used by
 *    availability subtraction and the commit-time race guard)
 *  - findByToken: resolve a hold from its opaque session token
 *  - deleteExpired: cleanup-job sweep
 */

import { and, eq, gt, lt, sql } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import {
  dentalAppointmentHolds,
  type DentalAppointmentHold,
  type NewDentalAppointmentHold,
} from './appointment-hold.schema';

export class AppointmentHoldRepository {
  constructor(private readonly db: DatabaseInstance) {}

  async createOne(data: NewDentalAppointmentHold): Promise<DentalAppointmentHold> {
    const [row] = await this.db.insert(dentalAppointmentHolds).values(data).returning();
    return row!;
  }

  /**
   * Active (non-expired) holds whose [startAt, startAt+duration) window overlaps
   * the proposed [startTime, startTime+durationMinutes) for the same provider.
   * `now` is injectable so tests can assert TTL expiry deterministically.
   * `excludeToken` lets the commit path ignore the caller's own hold.
   */
  async findActiveOverlapping(
    providerId: string,
    branchId: string,
    startTime: Date,
    durationMinutes: number,
    now: Date = new Date(),
    excludeToken?: string,
  ): Promise<DentalAppointmentHold[]> {
    const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);
    const conditions = [
      eq(dentalAppointmentHolds.providerId, providerId),
      eq(dentalAppointmentHolds.branchId, branchId),
      gt(dentalAppointmentHolds.expiresAt, now),
      // existing.start < proposed.end
      lt(dentalAppointmentHolds.startAt, endTime),
      // existing.end > proposed.start
      sql`${dentalAppointmentHolds.startAt} + (${dentalAppointmentHolds.durationMinutes} * interval '1 minute') > ${startTime.toISOString()}::timestamptz`,
    ];
    if (excludeToken) {
      conditions.push(sql`${dentalAppointmentHolds.sessionToken} <> ${excludeToken}`);
    }
    return await this.db.select().from(dentalAppointmentHolds).where(and(...conditions));
  }

  async findByToken(sessionToken: string): Promise<DentalAppointmentHold | null> {
    const [row] = await this.db
      .select()
      .from(dentalAppointmentHolds)
      .where(eq(dentalAppointmentHolds.sessionToken, sessionToken));
    return row ?? null;
  }

  async deleteByToken(sessionToken: string): Promise<void> {
    await this.db.delete(dentalAppointmentHolds).where(eq(dentalAppointmentHolds.sessionToken, sessionToken));
  }

  /** Cleanup-job sweep: delete all holds that expired before `now`. Returns count. */
  async deleteExpired(now: Date = new Date()): Promise<number> {
    const rows = await this.db
      .delete(dentalAppointmentHolds)
      .where(lt(dentalAppointmentHolds.expiresAt, now))
      .returning({ id: dentalAppointmentHolds.id });
    return rows.length;
  }
}
