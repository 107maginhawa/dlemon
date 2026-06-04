/**
 * billing-person.facade.ts
 *
 * Centralizes the merchantAccounts ⋈ persons join (merchant-with-person read)
 * in one exempt bridge file so billing.repo no longer imports the person schema
 * directly (Phase 10 boundary lint). The left join is relocated unchanged — SQL
 * byte-identical.
 */

import { eq } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { merchantAccounts, type MerchantAccountWithPerson } from './billing.schema';
import { persons } from '../../person/repos/person.schema';

/** A merchant account joined to its owning Person (id), by id. */
export async function findMerchantAccountWithPerson(
  db: DatabaseInstance,
  id: string,
): Promise<MerchantAccountWithPerson | null> {
  const result = await db
    .select({
      merchantAccount: merchantAccounts,
      person: {
        id: persons.id,
      },
    })
    .from(merchantAccounts)
    .leftJoin(persons, eq(merchantAccounts.person, persons.id))
    .where(eq(merchantAccounts.id, id))
    .limit(1);

  const row = result[0];
  if (!row) return null;
  return { ...row.merchantAccount, person: row.person } as MerchantAccountWithPerson;
}
