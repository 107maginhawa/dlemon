/**
 * Regression: ISSUE-001 — patient list not refreshed after registration.
 * Found by /qa on 2026-06-19.
 * Report: .gstack/qa-reports/qa-report-localhost-2026-06-19.md
 *
 * The New Patient registration handler (routes/_dashboard/patients.tsx) used to
 * invalidate the list with a literal key `['dental-patients']`. The list query
 * comes from the generated SDK, whose key is `[{ _id: 'listDentalPatients', … }]`,
 * so the keys never matched and the invalidation was a silent no-op: a newly
 * registered patient was created server-side but never appeared in the list.
 *
 * These tests pin the contract the fix relies on:
 *   1. the OLD string key does NOT invalidate the real list query (the bug), and
 *   2. the `_id` predicate (shared with the archive/restore/update hooks) DOES.
 */
import { describe, test, expect } from 'bun:test';
import { QueryClient } from '@tanstack/react-query';
import { listDentalPatientsQueryKey } from '@monobase/sdk-ts/generated/react-query';

function seedListQuery(qc: QueryClient) {
  const key = listDentalPatientsQueryKey({ query: { branchId: 'branch-1' } });
  // Inactive cache entry (no observer) so invalidate marks it without refetching.
  qc.setQueryData(key, { patients: [] });
  return key;
}

describe('patient-list cache invalidation contract (ISSUE-001)', () => {
  test('the old literal ["dental-patients"] key does NOT invalidate the list query', () => {
    const qc = new QueryClient();
    const key = seedListQuery(qc);

    qc.invalidateQueries({ queryKey: ['dental-patients'], refetchType: 'none' });

    // Bug reproduction: the generated key never matched, so the list stayed fresh.
    expect(qc.getQueryState(key)?.isInvalidated).toBe(false);
  });

  test('the _id predicate invalidates the generated list query (the fix)', () => {
    const qc = new QueryClient();
    const key = seedListQuery(qc);

    qc.invalidateQueries({
      predicate: (q) => (q.queryKey[0] as { _id?: string })?._id === 'listDentalPatients',
      refetchType: 'none',
    });

    expect(qc.getQueryState(key)?.isInvalidated).toBe(true);
  });
});
