/**
 * Regression: ISSUE-019 — Find-Duplicates panel showed a 5-min-stale result.
 * Found by /qa on 2026-06-20.
 * Report: .gstack/qa-reports/qa-report-localhost-2026-06-20.md
 *
 * The duplicate detector (detectDuplicatePatients) scans ACTIVE patients only,
 * so a create/archive/restore/bulk-archive/demographics-edit changes the
 * candidate set. But those mutations invalidated ONLY listDentalPatients, and
 * the global staleTime is 5 min — so re-opening the panel within 5 min after
 * registering a duplicate served the cached "no duplicates" result while the
 * endpoint returned the (real) group. Same family as ISSUE-001/002/003.
 *
 * Reproduced live: registered two identical patients, the /duplicates endpoint
 * returned groupCount:1, the panel still said "No duplicate patients found"
 * and fired no refetch.
 *
 * These tests pin the contract the fix relies on: the OLD list-only predicate
 * does NOT invalidate the duplicates query, and isPatientCollectionQuery DOES
 * invalidate BOTH the list and the duplicates query.
 */
import { describe, test, expect } from 'bun:test';
import { QueryClient } from '@tanstack/react-query';
import {
  listDentalPatientsQueryKey,
  detectDuplicatePatientsQueryKey,
} from '@monobase/sdk-ts/generated/react-query';
import { isPatientCollectionQuery } from './use-patient-actions';

const listKey = listDentalPatientsQueryKey({ query: { branchId: 'b1' } });
const dupKey = detectDuplicatePatientsQueryKey({ query: { branchId: 'b1' } });

describe('patient duplicates cache invalidation contract', () => {
  test('OLD list-only predicate does NOT invalidate the duplicates query (the bug)', () => {
    const qc = new QueryClient();
    qc.setQueryData(dupKey, { groups: [], groupCount: 0 });
    qc.invalidateQueries({
      predicate: (q) => (q.queryKey[0] as { _id?: string })?._id === 'listDentalPatients',
      refetchType: 'none',
    });
    expect(qc.getQueryState(dupKey)?.isInvalidated).toBe(false);
  });

  test('isPatientCollectionQuery invalidates the duplicates query (the fix)', () => {
    const qc = new QueryClient();
    qc.setQueryData(dupKey, { groups: [], groupCount: 0 });
    qc.invalidateQueries({
      predicate: (q) => isPatientCollectionQuery(q.queryKey),
      refetchType: 'none',
    });
    expect(qc.getQueryState(dupKey)?.isInvalidated).toBe(true);
  });

  test('isPatientCollectionQuery still invalidates the list query', () => {
    const qc = new QueryClient();
    qc.setQueryData(listKey, { items: [] });
    qc.invalidateQueries({
      predicate: (q) => isPatientCollectionQuery(q.queryKey),
      refetchType: 'none',
    });
    expect(qc.getQueryState(listKey)?.isInvalidated).toBe(true);
  });

  test('isPatientCollectionQuery ignores unrelated queries', () => {
    const qc = new QueryClient();
    const otherKey = [{ _id: 'listAppointments', query: { branchId: 'b1' } }] as const;
    qc.setQueryData(otherKey, { items: [] });
    qc.invalidateQueries({
      predicate: (q) => isPatientCollectionQuery(q.queryKey),
      refetchType: 'none',
    });
    expect(qc.getQueryState(otherKey)?.isInvalidated).toBe(false);
  });
});
