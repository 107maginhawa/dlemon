/**
 * bookingEvent-person.facade.ts
 *
 * Centralizes the bookingEvents ⋈ persons (owner) join used by the
 * with-owner reads so bookingEvent.repo no longer imports the person schema
 * directly (Phase 10 boundary lint). The owner join is inseparable from these
 * queries, so it is RELOCATED unchanged — SQL byte-identical. Filter-building
 * stays in the repo (buildWhereConditions over bookingEvents); the prebuilt
 * WHERE is passed in.
 */

import { eq, type SQL } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import type { PaginationOptions } from '@/core/database.repo';
import { bookingEvents, type BookingEvent } from './booking.schema';
import { persons, type Person } from '../../person/repos/person.schema';

export type BookingEventWithOwner = Omit<BookingEvent, 'owner'> & { owner: Person };

/** A booking event with its owner Person joined, by id. */
export async function getBookingEventWithOwnerById(
  db: DatabaseInstance,
  eventId: string,
): Promise<BookingEventWithOwner | null> {
  const result = await db
    .select({ event: bookingEvents, owner: persons })
    .from(bookingEvents)
    .innerJoin(persons, eq(bookingEvents.owner, persons.id))
    .where(eq(bookingEvents.id, eventId))
    .limit(1);

  if (result.length === 0 || !result[0]) return null;
  const { event, owner } = result[0];
  return { ...event, owner };
}

/** Booking events with owner Person joined, filtered (prebuilt WHERE) + paginated. */
export async function findBookingEventsWithOwner(
  db: DatabaseInstance,
  whereConditions: SQL<unknown> | undefined,
  options?: PaginationOptions,
): Promise<BookingEventWithOwner[]> {
  const query = db
    .select({ event: bookingEvents, owner: persons })
    .from(bookingEvents)
    .innerJoin(persons, eq(bookingEvents.owner, persons.id))
    .where(whereConditions);

  if (options?.limit) query.limit(options.limit);
  if (options?.offset) query.offset(options.offset);

  const results = await query;
  return results.map(({ event, owner }) => ({ ...event, owner }));
}
