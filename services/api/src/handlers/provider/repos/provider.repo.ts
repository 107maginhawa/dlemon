/**
 * ProviderRepository - Data access layer for providers
 * Encapsulates all database operations for the providers table
 */

import { eq, and, or, ilike, inArray, sql, count, gte, lte, asc, type SQL } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { DatabaseRepository, type PaginationOptions } from '@/core/database.repo';
import { 
  providers, 
  type Provider, 
  type NewProvider,
  type ProviderWithPerson
} from './provider.schema';
import { persons } from '../../person/repos/person.schema';

export interface ProviderFilters {
  person?: string;
  q?: string; // General search query
  minorAilmentsSpecialty?: string;
  minorAilmentsPracticeLocation?: string;
  languageSpoken?: string; // ISO 639-1 language code
}

export class ProviderRepository extends DatabaseRepository<Provider, NewProvider, ProviderFilters> {
  constructor(
    db: DatabaseInstance,
    logger?: any
  ) {
    super(db, providers, logger);
  }

  /**
   * Build where conditions for provider-specific filtering
   */
  protected buildWhereConditions(filters?: ProviderFilters): SQL<unknown> | undefined {
    if (!filters) return undefined;

    const conditions = [];

    if (filters.person) {
      conditions.push(eq(providers.person, filters.person));
    }

    // Minor ailments filtering using JSONB containment
    if (filters.minorAilmentsSpecialty) {
      conditions.push(
        sql`${providers.minorAilmentsSpecialties}::jsonb @> ${JSON.stringify([filters.minorAilmentsSpecialty])}::jsonb`
      );
    }

    if (filters.minorAilmentsPracticeLocation) {
      conditions.push(
        sql`${providers.minorAilmentsPracticeLocations}::jsonb @> ${JSON.stringify([filters.minorAilmentsPracticeLocation])}::jsonb`
      );
    }

    // General search would require joining with persons table
    // For now, we'll handle it separately in findManyWithPerson

    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  /**
   * Find provider by person ID
   */
  async findByPersonId(personId: string): Promise<Provider | null> {
    this.logger?.debug({ personId }, 'Finding provider by person ID');
    
    const provider = await this.findOne({ person: personId });
    
    this.logger?.debug({ personId, found: !!provider }, 'Provider person ID lookup completed');
    
    return provider;
  }

  /**
   * Find provider with person data joined
   */
  async findOneByIdWithPerson(providerId: string): Promise<ProviderWithPerson | null> {
    this.logger?.debug({ providerId }, 'Finding provider with person data');
    
    const result = await this.db
      .select({
        provider: providers,
        person: persons
      })
      .from(providers)
      .innerJoin(persons, eq(providers.person, persons.id))
      .where(eq(providers.id, providerId))
      .limit(1);
    
    if (result.length === 0) {
      return null;
    }
    
    const { provider, person } = result[0];
    
    this.logger?.debug({ providerId, found: true }, 'Provider with person data retrieved');
    
    return {
      ...provider,
      person
    };
  }

  /**
   * Find providers with person data joined
   */
  async findManyWithPerson(
    filters?: ProviderFilters & { q?: string },
    options?: { pagination?: PaginationOptions }
  ): Promise<ProviderWithPerson[]> {
    this.logger?.debug({ filters, options }, 'Finding providers with person data');

    const baseQuery = this.db
      .select({
        provider: providers,
        person: persons
      })
      .from(providers)
      .innerJoin(persons, eq(providers.person, persons.id));

    // Apply filters
    const conditions: SQL[] = [];

    if (filters?.person) {
      conditions.push(eq(providers.person, filters.person));
    }

    // General search across person and provider fields
    if (filters?.q) {
      conditions.push(
        or(
          ilike(persons.firstName, `%${filters.q}%`),
          ilike(persons.lastName, `%${filters.q}%`)
        )
      );
    }

    // Language filtering using JSONB containment
    if (filters?.languageSpoken) {
      conditions.push(
        sql`${persons.languagesSpoken}::jsonb @> ${JSON.stringify([filters.languageSpoken])}::jsonb`
      );
    }

    // Minor ailments filtering using JSONB containment
    if (filters?.minorAilmentsSpecialty) {
      conditions.push(
        sql`${providers.minorAilmentsSpecialties}::jsonb @> ${JSON.stringify([filters.minorAilmentsSpecialty])}::jsonb`
      );
    }

    if (filters?.minorAilmentsPracticeLocation) {
      conditions.push(
        sql`${providers.minorAilmentsPracticeLocations}::jsonb @> ${JSON.stringify([filters.minorAilmentsPracticeLocation])}::jsonb`
      );
    }

    // Build final query
    let finalQuery = baseQuery;

    // Apply conditions
    if (conditions.length > 0) {
      finalQuery = finalQuery.where(and(...conditions));
    }

    // Apply pagination
    if (options?.pagination) {
      const { limit = 25, offset = 0 } = options.pagination;
      finalQuery = finalQuery.limit(limit).offset(offset);
    }

    const results = await finalQuery;

    this.logger?.debug({
      filters,
      resultCount: results.length
    }, 'Providers with person data retrieved');

    return results.map(({ provider, person }) => ({
      ...provider,
      person
    }));
  }

  /**
   * Count providers with filters
   */
  async countWithPerson(filters?: ProviderFilters): Promise<number> {
    let query = this.db
      .select({ count: count() })
      .from(providers)
      .innerJoin(persons, eq(providers.person, persons.id))
      .$dynamic();

    // Apply filters similar to findManyWithPerson
    const conditions: SQL[] = [];

    if (filters?.q) {
      conditions.push(
        or(
          ilike(persons.firstName, `%${filters.q}%`),
          ilike(persons.lastName, `%${filters.q}%`)
        )
      );
    }

    if (filters?.languageSpoken) {
      conditions.push(
        sql`${persons.languagesSpoken}::jsonb @> ${JSON.stringify([filters.languageSpoken])}::jsonb`
      );
    }

    if (filters?.minorAilmentsSpecialty) {
      conditions.push(
        sql`${providers.minorAilmentsSpecialties}::jsonb @> ${JSON.stringify([filters.minorAilmentsSpecialty])}::jsonb`
      );
    }

    if (filters?.minorAilmentsPracticeLocation) {
      conditions.push(
        sql`${providers.minorAilmentsPracticeLocations}::jsonb @> ${JSON.stringify([filters.minorAilmentsPracticeLocation])}::jsonb`
      );
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const result = await query;
    return Number(result[0]?.count || 0);
  }

  /**
   * Find booking providers with availability calculated via SQL aggregation
   * Returns providers with nextAvailable timestamp for sorting/filtering
   */
  async findBookingProvidersWithAvailability(
    filters?: ProviderFilters & { q?: string },
    options?: {
      pagination?: PaginationOptions;
      dateRange: { start: string; end: string };
      locationType?: string;
      requireAvailability?: boolean; // Only return providers with available slots
    }
  ): Promise<(ProviderWithPerson & { nextAvailable?: Date })[]> {
    this.logger?.debug({ filters, options }, 'Finding providers with availability');

    // Import timeSlots dynamically to avoid circular dependency
    const { timeSlots } = await import('../../booking/repos/booking.schema');

    // Build subquery for nextAvailable using Drizzle
    const nextAvailableConditions = [
      eq(timeSlots.status, 'available'),
      sql`${timeSlots.startTime} >= NOW()`,
      sql`${timeSlots.startTime} >= ${options?.dateRange.start || new Date().toISOString()}::timestamp`,
      sql`${timeSlots.startTime} <= ${options?.dateRange.end || new Date().toISOString()}::timestamp`
    ];

    if (options?.locationType) {
      nextAvailableConditions.push(
        sql`${timeSlots.locationTypes}::jsonb @> ${JSON.stringify([options.locationType])}::jsonb`
      );
    }

    const nextAvailableSubquery = this.db
      .select({
        providerId: timeSlots.owner,
        nextAvailable: sql<Date>`MIN(${timeSlots.startTime})`.as('next_available')
      })
      .from(timeSlots)
      .where(and(...nextAvailableConditions))
      .groupBy(timeSlots.owner)
      .as('next_available_slots');

    // Build main query with person join and nextAvailable
    let query = this.db
      .select({
        provider: providers,
        person: persons,
        nextAvailable: nextAvailableSubquery.nextAvailable
      })
      .from(providers)
      .innerJoin(persons, eq(providers.person, persons.id))
      .leftJoin(nextAvailableSubquery, eq(providers.id, nextAvailableSubquery.providerId))
      .$dynamic();

    // Apply filters
    const conditions: SQL[] = [];

    if (filters?.person) {
      conditions.push(eq(providers.person, filters.person));
    }

    if (filters?.q) {
      conditions.push(
        or(
          ilike(persons.firstName, `%${filters.q}%`),
          ilike(persons.lastName, `%${filters.q}%`)
        )
      );
    }

    if (filters?.languageSpoken) {
      conditions.push(
        sql`${persons.languagesSpoken}::jsonb @> ${JSON.stringify([filters.languageSpoken])}::jsonb`
      );
    }

    if (filters?.minorAilmentsSpecialty) {
      conditions.push(
        sql`${providers.minorAilmentsSpecialties}::jsonb @> ${JSON.stringify([filters.minorAilmentsSpecialty])}::jsonb`
      );
    }

    if (filters?.minorAilmentsPracticeLocation) {
      conditions.push(
        sql`${providers.minorAilmentsPracticeLocations}::jsonb @> ${JSON.stringify([filters.minorAilmentsPracticeLocation])}::jsonb`
      );
    }

    // Filter by availability if required
    if (options?.requireAvailability) {
      conditions.push(sql`${nextAvailableSubquery.nextAvailable} IS NOT NULL`);
    }

    // Apply conditions
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    // Sort by nextAvailable (available providers first, ordered by soonest availability)
    query = query.orderBy(sql`${nextAvailableSubquery.nextAvailable} ASC NULLS LAST`);

    // Apply pagination
    if (options?.pagination) {
      const { limit = 25, offset = 0 } = options.pagination;
      query = query.limit(limit).offset(offset);
    }

    const results = await query;

    this.logger?.debug({
      filters,
      resultCount: results.length
    }, 'Providers with availability retrieved');

    return results.map(({ provider, person, nextAvailable }) => ({
      ...provider,
      person,
      nextAvailable: nextAvailable || undefined
    }));
  }

  /**
   * Find booking providers with active events
   * Returns providers with person and event data joined
   */
  async findBookingProvidersWithActiveEvents(
    filters?: ProviderFilters & { q?: string },
    options?: { pagination?: PaginationOptions }
  ): Promise<(ProviderWithPerson & { event?: any })[]> {
    this.logger?.debug({ filters, options }, 'Finding providers with active events');

    // Import bookingEvents dynamically to avoid circular dependency
    const { bookingEvents } = await import('../../booking/repos/booking.schema');

    // Build main query with person join and event join
    let query = this.db
      .select({
        provider: providers,
        person: persons,
        event: bookingEvents
      })
      .from(providers)
      .innerJoin(persons, eq(providers.person, persons.id))
      .innerJoin(bookingEvents, and(
        eq(bookingEvents.owner, providers.person),
        eq(bookingEvents.status, 'active')
      ))
      .$dynamic();

    // Apply filters
    const conditions: SQL[] = [];

    if (filters?.person) {
      conditions.push(eq(providers.person, filters.person));
    }

    if (filters?.q) {
      conditions.push(
        or(
          ilike(persons.firstName, `%${filters.q}%`),
          ilike(persons.lastName, `%${filters.q}%`)
        )
      );
    }

    if (filters?.languageSpoken) {
      conditions.push(
        sql`${persons.languagesSpoken}::jsonb @> ${JSON.stringify([filters.languageSpoken])}::jsonb`
      );
    }

    if (filters?.minorAilmentsSpecialty) {
      conditions.push(
        sql`${providers.minorAilmentsSpecialties}::jsonb @> ${JSON.stringify([filters.minorAilmentsSpecialty])}::jsonb`
      );
    }

    if (filters?.minorAilmentsPracticeLocation) {
      conditions.push(
        sql`${providers.minorAilmentsPracticeLocations}::jsonb @> ${JSON.stringify([filters.minorAilmentsPracticeLocation])}::jsonb`
      );
    }

    // Apply conditions
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    // Apply pagination
    if (options?.pagination) {
      const { limit = 25, offset = 0 } = options.pagination;
      query = query.limit(limit).offset(offset);
    }

    const results = await query;

    this.logger?.debug({
      filters,
      resultCount: results.length
    }, 'Providers with active events retrieved');

    return results.map(({ provider, person, event }) => ({
      ...provider,
      person,
      event
    }));
  }

  /**
   * Find provider by ID with person and active event joined
   */
  async findOneByIdWithPersonAndEvent(providerId: string): Promise<(ProviderWithPerson & { event?: any }) | null> {
    this.logger?.debug({ providerId }, 'Finding provider with person and event data');

    // Import bookingEvents dynamically to avoid circular dependency
    const { bookingEvents } = await import('../../booking/repos/booking.schema');

    const result = await this.db
      .select({
        provider: providers,
        person: persons,
        event: bookingEvents
      })
      .from(providers)
      .innerJoin(persons, eq(providers.person, persons.id))
      .leftJoin(bookingEvents, and(
        eq(bookingEvents.owner, providers.person),
        eq(bookingEvents.status, 'active')
      ))
      .where(eq(providers.id, providerId))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const { provider, person, event } = result[0];

    this.logger?.debug({ providerId, hasEvent: !!event }, 'Provider with person and event data retrieved');

    return {
      ...provider,
      person,
      event: event || undefined
    };
  }

}

/**
 * Default provider repository instance
 */
export const providerRepo = ProviderRepository;
