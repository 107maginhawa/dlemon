/**
 * ProviderRepository - Data access layer for providers
 * Encapsulates all database operations for the providers table
 */

import { eq, and, sql, type SQL } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { DatabaseRepository, type PaginationOptions } from '@/core/database.repo';
import {
  providers,
  type Provider,
  type NewProvider,
  type ProviderWithPerson
} from './provider.schema';
import {
  findProviderWithPersonById,
  findManyProvidersWithPerson,
  countProvidersWithPerson,
  findBookingProvidersWithAvailability as facadeFindBookingProvidersWithAvailability,
  findBookingProvidersWithActiveEvents as facadeFindBookingProvidersWithActiveEvents,
  findProviderWithPersonAndEventById,
} from './provider-person.facade';

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
    return findProviderWithPersonById(this.db, providerId);
  }

  /**
   * Find providers with person data joined
   */
  async findManyWithPerson(
    filters?: ProviderFilters & { q?: string },
    options?: { pagination?: PaginationOptions }
  ): Promise<ProviderWithPerson[]> {
    return findManyProvidersWithPerson(this.db, filters, options);
  }

  /**
   * Count providers with filters
   */
  async countWithPerson(filters?: ProviderFilters): Promise<number> {
    return countProvidersWithPerson(this.db, filters);
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
    return facadeFindBookingProvidersWithAvailability(this.db, filters, options);
  }

  /**
   * Find booking providers with active events
   * Returns providers with person and event data joined
   */
  async findBookingProvidersWithActiveEvents(
    filters?: ProviderFilters & { q?: string },
    options?: { pagination?: PaginationOptions }
  ): Promise<(ProviderWithPerson & { event?: any })[]> {
    return facadeFindBookingProvidersWithActiveEvents(this.db, filters, options);
  }

  /**
   * Find provider by ID with person and active event joined
   */
  async findOneByIdWithPersonAndEvent(providerId: string): Promise<(ProviderWithPerson & { event?: any }) | null> {
    return findProviderWithPersonAndEventById(this.db, providerId);
  }

}

/**
 * Default provider repository instance
 */
export const providerRepo = ProviderRepository;
