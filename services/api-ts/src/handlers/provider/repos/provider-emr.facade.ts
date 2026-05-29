/**
 * provider-emr.facade.ts — narrow provider access for the EMR module
 *
 * Exposes only the provider-data operations the EMR (consultation-notes)
 * module needs, so EMR handlers and repos do not cross-import the concrete
 * ProviderRepository class or the provider schema (MODULE_BOUNDARIES.md EX-006).
 */

import type { DatabaseInstance } from '@/core/database';
import { ProviderRepository } from './provider.repo';
import type { Provider, ProviderWithPerson } from './provider.schema';

/**
 * Resolve a provider by its owning person ID (EMR authorization checks).
 */
export async function getProviderByPersonIdForEMR(
  db: DatabaseInstance,
  personId: string,
  logger?: any
): Promise<Provider | null> {
  const repo = new ProviderRepository(db, logger);
  return repo.findByPersonId(personId);
}

/**
 * Fetch a single provider by ID (no person expansion) for EMR consumption.
 */
export async function getProviderForEMR(
  db: DatabaseInstance,
  providerId: string,
  logger?: any
): Promise<Provider | null> {
  const repo = new ProviderRepository(db, logger);
  return repo.findOneById(providerId);
}

/**
 * Fetch a provider with joined person data for EMR field expansion.
 */
export async function getProviderWithPersonForEMR(
  db: DatabaseInstance,
  providerId: string,
  logger?: any
): Promise<ProviderWithPerson | null> {
  const repo = new ProviderRepository(db, logger);
  return repo.findOneByIdWithPerson(providerId);
}
