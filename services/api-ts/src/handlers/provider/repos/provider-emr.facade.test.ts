/**
 * provider-emr.facade integration tests
 *
 * Locks the narrow provider-access surface the EMR (consultation-notes)
 * module consumes, so EMR handlers no longer cross-import the concrete
 * ProviderRepository class (MODULE_BOUNDARIES.md EX-006).
 *
 * Tests against real Postgres via openTestTx with automatic rollback.
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import {
  getProviderForEMR,
  getProviderByPersonIdForEMR,
  getProviderWithPersonForEMR,
} from './provider-emr.facade';
import { persons } from '@/handlers/person/repos/person.schema';
import { providers } from '@/handlers/provider/repos/provider.schema';
import { openTestTx } from '@/core/test-tx';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

const PROVIDER_PERSON_ID = 'fa000000-0000-4000-8000-000000000001';
const PROVIDER_ID        = 'fa000000-0000-4000-8000-000000000002';
const MISSING_ID         = 'fa000000-0000-4000-8000-0000000000ff';

let db: NodePgDatabase;
let teardown: () => Promise<void>;
const noopLogger = { info() {}, error() {}, debug() {}, warn() {} } as any;

beforeEach(async () => {
  const tx = await openTestTx();
  db = tx.db;
  teardown = tx.rollback;

  await db.insert(persons).values([
    { id: PROVIDER_PERSON_ID, firstName: 'Provider', lastName: 'Facade' },
  ]).onConflictDoNothing();

  await db.insert(providers).values([
    { id: PROVIDER_ID, person: PROVIDER_PERSON_ID, providerType: 'dentist' },
  ]).onConflictDoNothing();
});
afterEach(() => teardown());

describe('provider-emr.facade', () => {
  describe('getProviderByPersonIdForEMR', () => {
    test('resolves the provider owning a person id', async () => {
      const provider = await getProviderByPersonIdForEMR(db, PROVIDER_PERSON_ID, noopLogger);
      expect(provider).not.toBeNull();
      expect(provider!.id).toBe(PROVIDER_ID);
    });

    test('returns null when no provider owns the person id', async () => {
      const provider = await getProviderByPersonIdForEMR(db, MISSING_ID, noopLogger);
      expect(provider).toBeNull();
    });
  });

  describe('getProviderForEMR', () => {
    test('returns the provider by id (no person expansion)', async () => {
      const provider = await getProviderForEMR(db, PROVIDER_ID, noopLogger);
      expect(provider).not.toBeNull();
      expect(provider!.id).toBe(PROVIDER_ID);
      // No nested person object on the plain variant
      expect((provider as any).person === undefined || typeof (provider as any).person === 'string').toBe(true);
    });

    test('returns null for a missing provider id', async () => {
      expect(await getProviderForEMR(db, MISSING_ID, noopLogger)).toBeNull();
    });
  });

  describe('getProviderWithPersonForEMR', () => {
    test('returns the provider with a nested person object', async () => {
      const provider = await getProviderWithPersonForEMR(db, PROVIDER_ID, noopLogger);
      expect(provider).not.toBeNull();
      expect(provider!.id).toBe(PROVIDER_ID);
      expect(provider!.person).toBeDefined();
      expect((provider!.person as any).id).toBe(PROVIDER_PERSON_ID);
      expect((provider!.person as any).firstName).toBe('Provider');
    });

    test('returns null for a missing provider id', async () => {
      expect(await getProviderWithPersonForEMR(db, MISSING_ID, noopLogger)).toBeNull();
    });
  });
});
