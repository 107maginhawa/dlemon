/**
 * person-notifs.facade.ts
 *
 * Facade exposing recipient Person lookup to the `notifs` module. The
 * notification repo needs the recipient Person to validate existence and to
 * resolve the delivery email (contactInfo.email); it imports only this facade,
 * never the person repo/schema directly (Phase 10 boundary lint — the facade
 * pattern is the approved cross-module bridge).
 */

import type { DatabaseInstance } from '@/core/database';
import { PersonRepository } from './person.repo';
import type { Person } from './person.schema';

/**
 * Resolve a notification recipient's Person record by id, or null when no
 * Person row exists for the recipient user id. Mirrors PersonRepository
 * .findOneById so notification delivery behaviour is unchanged.
 */
export async function findNotificationRecipient(
  db: DatabaseInstance,
  personId: string,
  logger?: unknown,
): Promise<Person | null> {
  return new PersonRepository(db, logger as never).findOneById(personId);
}
