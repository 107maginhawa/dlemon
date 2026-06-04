/**
 * person-provisioning.facade.ts
 *
 * Facade exposing Person find-or-provision to consumer modules that compose a
 * domain entity on top of a Person (patient, provider). Those handlers
 * ensure/lookup the backing Person before creating their own row; they import
 * only this facade, never the person repo/schema directly (Phase 10 boundary
 * lint — the facade pattern is the approved cross-module bridge).
 */

import type { DatabaseInstance } from '@/core/database';
import type { User } from '@/types/auth';
import { PersonRepository } from './person.repo';
import type { Person, PersonCreateRequest } from './person.schema';

/** Resolve a Person by id, or null when no row exists. */
export async function findPersonById(
  db: DatabaseInstance,
  personId: string,
  logger?: unknown,
): Promise<Person | null> {
  return new PersonRepository(db, logger as never).findOneById(personId);
}

/**
 * Find-or-create the Person backing a user (optionally seeding/updating PII
 * from personInput). Mirrors PersonRepository.ensurePersonForUser so onboarding
 * behaviour is unchanged.
 */
export async function ensurePersonForUser(
  db: DatabaseInstance,
  user: User,
  personInput?: PersonCreateRequest,
  logger?: unknown,
): Promise<Person> {
  return new PersonRepository(db, logger as never).ensurePersonForUser(user, personInput);
}
