/**
 * useArAging / useStatementBatch — contract regression (QA_ESCAPES §6 roll-out).
 *
 * These hooks previously re-declared local ArAgingData/StatementBatchResult types
 * and `as unknown as`-cast the SDK response, disabling type-checking at the FE↔BE
 * boundary. They now consume the generated SDK ArAgingResponse /
 * GenerateStatementBatchResponse directly. This test mocks the REAL live shape
 * (GET /dental/billing/collections/aging, 2026-06-04) so the field contract the
 * collections view depends on stays asserted, not just the load status.
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { useArAging, useStatementBatch, useSendStatement, useCollectionsWorklist, useLogCollectionNote } from './use-collections';
import { freshClient, freshClientWithMutations, makeWrapper, jsonResponse } from '@/test-utils';

afterEach(cleanup);
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });

const BRANCH = 'e17678dd-bb19-4c4a-9b72-ad4cd8e7d37c';

// Mirrors the live AR-aging response field-for-field.
const realAging = {
  asOf: '2026-06-04T11:13:47.937Z',
  summary: {
    currentCents: 18655000,
    days30Cents: 1800000,
    days60Cents: 0,
    days90PlusCents: 0,
    totalOutstandingCents: 20455000,
    patientCount: 10,
  },
  patients: [
    {
      patientId: 'b1d6663a-e2c1-4c91-82fc-65a74574ac50',
      patientName: 'Sofia Cruz',
      currentCents: 1200000,
      days30Cents: 1800000,
      days60Cents: 0,
      days90PlusCents: 0,
      totalOutstandingCents: 3000000,
      oldestInvoiceDays: 31,
    },
  ],
};

describe('useArAging — real API shape (contract regression)', () => {
  test('does not fetch without a branchId', () => {
    global.fetch = mock(() => new Promise(() => {}));
    const qc = freshClient();
    const { result } = renderHook(() => useArAging({ branchId: null }), { wrapper: makeWrapper(qc) });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.aging).toBeNull();
  });

  test('surfaces the SDK-modeled summary buckets + patient rows', async () => {
    global.fetch = mock(() => jsonResponse(realAging));
    const qc = freshClient();
    const { result } = renderHook(() => useArAging({ branchId: BRANCH }), { wrapper: makeWrapper(qc) });
    await waitFor(() => expect(result.current.aging).not.toBeNull());
    const a = result.current.aging!;
    expect(a.summary.totalOutstandingCents).toBe(20455000);
    expect(a.summary.patientCount).toBe(10);
    expect(a.patients).toHaveLength(1);
    expect(a.patients[0]!.patientName).toBe('Sofia Cruz');
    expect(a.patients[0]!.oldestInvoiceDays).toBe(31);
  });
});

describe('useStatementBatch — real API shape (contract regression)', () => {
  const realBatch = {
    batchId: '4c2b0a10-0000-4000-8000-000000000001',
    asOf: '2026-06-04T11:13:47.937Z',
    statementCount: 2,
    totalBalanceCents: 3920000,
    statements: [
      {
        patientId: 'b1d6663a-e2c1-4c91-82fc-65a74574ac50',
        patientName: 'Sofia Cruz',
        statementNumber: 'STMT-2026-0001',
        asOf: '2026-06-04T11:13:47.937Z',
        totalChargedCents: 3000000,
        totalPaidCents: 0,
        totalDiscountCents: 0,
        balanceCents: 3000000,
        invoiceCount: 2,
        oldestUnpaidInvoiceDays: 31,
      },
    ],
  };

  test('returns the batch summary fields the toast/banner reads', async () => {
    global.fetch = mock(() => jsonResponse(realBatch));
    const qc = freshClient();
    const { result } = renderHook(() => useStatementBatch({ branchId: BRANCH }), { wrapper: makeWrapper(qc) });
    await result.current.generate({});
    await waitFor(() => expect(result.current.result).not.toBeNull());
    expect(result.current.result!.statementCount).toBe(2);
    expect(result.current.result!.totalBalanceCents).toBe(3920000);
    expect(result.current.result!.statements[0]!.statementNumber).toBe('STMT-2026-0001');
  });
});

describe('useSendStatement — manual statement send (BR-050)', () => {
  const PATIENT = 'b1d6663a-e2c1-4c91-82fc-65a74574ac50';

  test('POSTs to /patients/:id/statement/send and returns the patientId + outcome', async () => {
    const calls: Array<{ url: string; method: string }> = [];
    global.fetch = mock((input: Request | string | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
      calls.push({ url, method });
      return jsonResponse({ patientId: PATIENT, sent: true, outstandingBalanceCents: 3000, channels: ['email', 'push'] });
    }) as typeof fetch;

    const qc = freshClientWithMutations();
    const { result } = renderHook(() => useSendStatement({ branchId: BRANCH }), { wrapper: makeWrapper(qc) });
    const out = await result.current.send(PATIENT);

    expect(out.patientId).toBe(PATIENT);
    expect(out.sent).toBe(true);
    expect(out.channels).toEqual(['email', 'push']);
    const sendCall = calls.find((c) => c.method === 'POST' && c.url.includes(`/patients/${PATIENT}/statement/send`));
    expect(sendCall).toBeDefined();
  });
});

describe('useCollectionsWorklist / useLogCollectionNote (BR-051)', () => {
  const PATIENT = 'b1d6663a-e2c1-4c91-82fc-65a74574ac50';

  test('worklist surfaces overdue rows; logNote POSTs to /collections/notes', async () => {
    const realWorklist = {
      asOf: '2026-06-19T00:00:00.000Z',
      rows: [{
        patientId: PATIENT, patientName: 'Sofia Cruz', totalOverdueCents: 300000,
        oldestDaysOverdue: 47, openInvoiceCount: 2, hasActivePlan: false, noteCount: 0,
      }],
    };
    const calls: Array<{ url: string; method: string }> = [];
    global.fetch = mock((input: Request | string | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
      calls.push({ url, method });
      if (method === 'POST') return jsonResponse({ id: 'n1', patientId: PATIENT, branchId: BRANCH, note: 'x', contactChannel: 'phone', contactedAt: '2026-06-19T00:00:00.000Z', createdAt: '2026-06-19T00:00:00.000Z' }, 201);
      return jsonResponse(realWorklist);
    }) as typeof fetch;

    const qc = freshClientWithMutations();
    const wl = renderHook(() => useCollectionsWorklist({ branchId: BRANCH }), { wrapper: makeWrapper(qc) });
    await waitFor(() => expect(wl.result.current.worklist).not.toBeNull());
    expect(wl.result.current.worklist!.rows[0]!.totalOverdueCents).toBe(300000);
    expect(wl.result.current.worklist!.rows[0]!.oldestDaysOverdue).toBe(47);

    const log = renderHook(() => useLogCollectionNote({ branchId: BRANCH }), { wrapper: makeWrapper(qc) });
    await log.result.current.logNote({ patientId: PATIENT, note: 'Called', contactChannel: 'phone' });
    const post = calls.find((c) => c.method === 'POST' && c.url.includes('/collections/notes'));
    expect(post).toBeDefined();
  });
});
