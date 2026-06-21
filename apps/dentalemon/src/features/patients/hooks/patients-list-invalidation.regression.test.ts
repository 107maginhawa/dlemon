/**
 * Regression: ISSUE-001/002/003 — list queries not refreshed after a write.
 * Found by /qa on 2026-06-19.
 * Report: .gstack/qa-reports/qa-report-localhost-2026-06-19.md
 *
 * Several mutation handlers invalidated their list with a literal string key
 * (e.g. ['dental-patients'], ['appointments'], ['invoices']). But those lists
 * are fetched via the generated hey-api SDK, whose key is
 * [{ _id: 'listX', … }] — so the literal key never matched and the
 * invalidation was a silent no-op:
 *   - ISSUE-001 patients.tsx       → ['dental-patients']  vs listDentalPatients
 *   - ISSUE-002 calendar.tsx       → ['appointments']     vs listAppointments
 *   - ISSUE-003 billing(.tsx/list) → ['invoices']         vs listDentalInvoices
 * Symptom: a created/updated row never appeared until an unrelated refetch.
 *
 * These tests pin the contract every fix relies on, per list: the OLD literal
 * key does NOT invalidate the real query, and the `_id` predicate DOES. The
 * pre-existing archive/restore tests only asserted invalidateQueries was
 * *called* (which the buggy code also did, with the wrong key) — that weak
 * assertion is exactly why this class of bug slipped through.
 */
import { describe, test, expect } from 'bun:test';
import { QueryClient } from '@tanstack/react-query';
import {
  listDentalPatientsQueryKey,
  listAppointmentsQueryKey,
  listDentalInvoicesQueryKey,
} from '@monobase/sdk-ts/generated/react-query';

const CASES = [
  { name: 'patients', id: 'listDentalPatients', oldKey: ['dental-patients'], key: listDentalPatientsQueryKey({ query: { branchId: 'b1' } }) },
  { name: 'appointments', id: 'listAppointments', oldKey: ['appointments'], key: listAppointmentsQueryKey({ query: { branchId: 'b1' } }) },
  { name: 'invoices', id: 'listDentalInvoices', oldKey: ['invoices'], key: listDentalInvoicesQueryKey({ query: { branchId: 'b1' } }) },
] as const;

describe('generated-SDK list cache invalidation contract', () => {
  for (const c of CASES) {
    test(`${c.name}: old literal key does NOT invalidate (the bug)`, () => {
      const qc = new QueryClient();
      qc.setQueryData(c.key, { items: [] });
      qc.invalidateQueries({ queryKey: c.oldKey, refetchType: 'none' });
      expect(qc.getQueryState(c.key)?.isInvalidated).toBe(false);
    });

    test(`${c.name}: _id predicate DOES invalidate (the fix)`, () => {
      const qc = new QueryClient();
      qc.setQueryData(c.key, { items: [] });
      qc.invalidateQueries({
        predicate: (q) => (q.queryKey[0] as { _id?: string })?._id === c.id,
        refetchType: 'none',
      });
      expect(qc.getQueryState(c.key)?.isInvalidated).toBe(true);
    });
  }
});
