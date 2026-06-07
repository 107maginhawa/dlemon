/**
 * provider-person.facade.ts
 *
 * Centralizes the providers ⋈ persons join (with-person reads, name search,
 * booking-availability/event joins) in one exempt bridge file so
 * ProviderRepository no longer imports the person schema directly (Phase 10
 * boundary lint). The join is inseparable from these queries (WHERE/ilike +
 * JSONB filters on person columns), so it is RELOCATED unchanged — SQL is
 * byte-identical. The repo methods delegate here, keeping their signatures.
 */

import { eq, and, or, ilike, sql, count, type SQL } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import type { PaginationOptions } from '@/core/database.repo';
import { providers, type ProviderWithPerson } from './provider.schema';
import { persons } from '../../person/repos/person.schema';
import type { ProviderFilters } from './provider.repo';
import type { BookingEvent } from '../../booking/repos/booking.schema';

/** ProviderWithPerson optionally joined with an active booking event. */
export type ProviderWithEvent = ProviderWithPerson & { event?: BookingEvent };

/** providers ⋈ persons by provider id. */
export async function findProviderWithPersonById(
  db: DatabaseInstance,
  providerId: string,
): Promise<ProviderWithPerson | null> {
  const result = await db
    .select({ provider: providers, person: persons })
    .from(providers)
    .innerJoin(persons, eq(providers.person, persons.id))
    .where(eq(providers.id, providerId))
    .limit(1);

  const row = result[0];
  if (!row) return null;
  return { ...row.provider, person: row.person } as ProviderWithPerson;
}

/** Shared filter conditions for provider ⋈ persons list/count queries. */
function providerConditions(filters?: ProviderFilters & { q?: string }): SQL[] {
  const conditions: SQL[] = [];
  if (filters?.person) conditions.push(eq(providers.person, filters.person));
  if (filters?.q) {
    conditions.push(
      or(ilike(persons.firstName, `%${filters.q}%`), ilike(persons.lastName, `%${filters.q}%`))!,
    );
  }
  if (filters?.languageSpoken) {
    conditions.push(
      sql`${persons.languagesSpoken}::jsonb @> ${JSON.stringify([filters.languageSpoken])}::jsonb`,
    );
  }
  if (filters?.minorAilmentsSpecialty) {
    conditions.push(
      sql`${providers.minorAilmentsSpecialties}::jsonb @> ${JSON.stringify([filters.minorAilmentsSpecialty])}::jsonb`,
    );
  }
  if (filters?.minorAilmentsPracticeLocation) {
    conditions.push(
      sql`${providers.minorAilmentsPracticeLocations}::jsonb @> ${JSON.stringify([filters.minorAilmentsPracticeLocation])}::jsonb`,
    );
  }
  return conditions;
}

/** providers ⋈ persons, filtered + paginated. */
export async function findManyProvidersWithPerson(
  db: DatabaseInstance,
  filters?: ProviderFilters & { q?: string },
  options?: { pagination?: PaginationOptions },
): Promise<ProviderWithPerson[]> {
  const baseQuery = db
    .select({ provider: providers, person: persons })
    .from(providers)
    .innerJoin(persons, eq(providers.person, persons.id))
    .$dynamic();

  const conditions = providerConditions(filters);
  if (conditions.length > 0) {
    const whereCondition = and(...conditions);
    if (whereCondition) baseQuery.where(whereCondition);
  }

  if (options?.pagination) {
    const { limit = 25, offset = 0 } = options.pagination;
    baseQuery.limit(limit).offset(offset);
  }

  const results = await baseQuery;
  return results.map(({ provider, person }) => ({ ...provider, person })) as ProviderWithPerson[];
}

/** Count providers matching list filters (same join + conditions). */
export async function countProvidersWithPerson(
  db: DatabaseInstance,
  filters?: ProviderFilters,
): Promise<number> {
  let query = db
    .select({ count: count() })
    .from(providers)
    .innerJoin(persons, eq(providers.person, persons.id))
    .$dynamic();

  const conditions = providerConditions(filters);
  if (conditions.length > 0) {
    const whereExpr = and(...conditions);
    if (whereExpr) query = query.where(whereExpr);
  }

  const result = await query;
  return Number(result[0]?.count || 0);
}

/** Booking providers with a computed nextAvailable slot (availability search). */
export async function findBookingProvidersWithAvailability(
  db: DatabaseInstance,
  filters?: ProviderFilters & { q?: string },
  options?: {
    pagination?: PaginationOptions;
    dateRange: { start: string; end: string };
    locationType?: string;
    requireAvailability?: boolean;
  },
): Promise<(ProviderWithPerson & { nextAvailable?: Date })[]> {
  const { timeSlots } = await import('../../booking/repos/booking.schema');

  const nextAvailableConditions = [
    eq(timeSlots.status, 'available'),
    sql`${timeSlots.startTime} >= NOW()`,
    sql`${timeSlots.startTime} >= ${options?.dateRange.start || new Date().toISOString()}::timestamp`,
    sql`${timeSlots.startTime} <= ${options?.dateRange.end || new Date().toISOString()}::timestamp`,
  ];

  if (options?.locationType) {
    nextAvailableConditions.push(
      sql`${timeSlots.locationTypes}::jsonb @> ${JSON.stringify([options.locationType])}::jsonb`,
    );
  }

  const nextAvailableSubquery = db
    .select({
      providerId: timeSlots.owner,
      nextAvailable: sql<Date>`MIN(${timeSlots.startTime})`.as('next_available'),
    })
    .from(timeSlots)
    .where(and(...nextAvailableConditions))
    .groupBy(timeSlots.owner)
    .as('next_available_slots');

  let query = db
    .select({
      provider: providers,
      person: persons,
      nextAvailable: nextAvailableSubquery.nextAvailable,
    })
    .from(providers)
    .innerJoin(persons, eq(providers.person, persons.id))
    .leftJoin(nextAvailableSubquery, eq(providers.id, nextAvailableSubquery.providerId))
    .$dynamic();

  const conditions = providerConditions(filters);
  if (options?.requireAvailability) {
    conditions.push(sql`${nextAvailableSubquery.nextAvailable} IS NOT NULL`);
  }
  if (conditions.length > 0) {
    const whereExpr = and(...conditions);
    if (whereExpr) query = query.where(whereExpr);
  }

  query = query.orderBy(sql`${nextAvailableSubquery.nextAvailable} ASC NULLS LAST`);

  if (options?.pagination) {
    const { limit = 25, offset = 0 } = options.pagination;
    query = query.limit(limit).offset(offset);
  }

  const results = await query;
  return results.map(({ provider, person, nextAvailable }) => ({
    ...provider,
    person,
    nextAvailable: nextAvailable || undefined,
  }));
}

/** Booking providers that own an active event (provider ⋈ person ⋈ bookingEvent). */
export async function findBookingProvidersWithActiveEvents(
  db: DatabaseInstance,
  filters?: ProviderFilters & { q?: string },
  options?: { pagination?: PaginationOptions },
): Promise<ProviderWithEvent[]> {
  const { bookingEvents } = await import('../../booking/repos/booking.schema');

  let query = db
    .select({ provider: providers, person: persons, event: bookingEvents })
    .from(providers)
    .innerJoin(persons, eq(providers.person, persons.id))
    .innerJoin(
      bookingEvents,
      and(eq(bookingEvents.owner, providers.person), eq(bookingEvents.status, 'active')),
    )
    .$dynamic();

  const conditions = providerConditions(filters);
  if (conditions.length > 0) {
    const whereExpr = and(...conditions);
    if (whereExpr) query = query.where(whereExpr);
  }

  if (options?.pagination) {
    const { limit = 25, offset = 0 } = options.pagination;
    query = query.limit(limit).offset(offset);
  }

  const results = await query;
  return results.map(({ provider, person, event }) => ({ ...provider, person, event }));
}

/** A provider with person + (optional) active event by id. */
export async function findProviderWithPersonAndEventById(
  db: DatabaseInstance,
  providerId: string,
): Promise<ProviderWithEvent | null> {
  const { bookingEvents } = await import('../../booking/repos/booking.schema');

  const result = await db
    .select({ provider: providers, person: persons, event: bookingEvents })
    .from(providers)
    .innerJoin(persons, eq(providers.person, persons.id))
    .leftJoin(
      bookingEvents,
      and(eq(bookingEvents.owner, providers.person), eq(bookingEvents.status, 'active')),
    )
    .where(eq(providers.id, providerId))
    .limit(1);

  const row = result[0];
  if (!row) return null;
  return { ...row.provider, person: row.person, event: row.event || undefined };
}
