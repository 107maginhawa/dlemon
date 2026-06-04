/**
 * person-billing.facade.ts
 *
 * Facade exposing party (merchant / customer) Person lookup to the `billing`
 * module. Invoice handlers validate that the merchant and customer Person
 * records exist before creating/mutating invoices; they import only this
 * facade, never the person repo/schema directly (Phase 10 boundary lint — the
 * facade pattern is the approved cross-module bridge).
 */

import type { DatabaseInstance } from '@/core/database';
import { PersonRepository } from './person.repo';
import type { Person } from './person.schema';

/**
 * Resolve an invoice party's Person record by id, or null when no Person row
 * exists. Mirrors PersonRepository.findOneById so billing validation behaviour
 * is unchanged.
 */
export async function findBillingParty(
  db: DatabaseInstance,
  personId: string,
  logger?: unknown,
): Promise<Person | null> {
  return new PersonRepository(db, logger as never).findOneById(personId);
}
