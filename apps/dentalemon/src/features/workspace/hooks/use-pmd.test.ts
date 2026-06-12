/**
 * usePMD — unit tests
 *
 * Fetches the PMD document for a given visit.
 * API: GET /dental/visits/:visitId/pmd (via SDK)
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { usePMD } from './use-pmd';
import { freshClient, makeWrapper, jsonResponse } from '@/test-utils';

afterEach(cleanup);

const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });

const MOCK_PMD = {
  id: 'pmd-1',
  visitId: 'visit-1',
  patientId: 'p1',
  status: 'generated',
  content: 'base64encodedpdf',
  signature: null,
  signedAt: null,
  supersedesId: null,
  checksum: 'abc123',
  createdAt: '2026-05-01T10:00:00Z',
};

// ─── Disabled state ───────────────────────────────────────────────────────────

describe('usePMD — disabled', () => {
  test('does not fetch when visitId is null', () => {
    global.fetch = mock(() => jsonResponse(MOCK_PMD)) as unknown as typeof fetch;

    const qc = freshClient();
    const { result } = renderHook(
      () => usePMD(null),
      { wrapper: makeWrapper(qc) },
    );

    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
  });
});

// ─── Loading state ────────────────────────────────────────────────────────────

describe('usePMD — loading', () => {
  test('starts in loading state while fetch is pending', () => {
    global.fetch = mock(() => new Promise(() => {})) as unknown as typeof fetch;

    const qc = freshClient();
    const { result } = renderHook(
      () => usePMD('visit-1'),
      { wrapper: makeWrapper(qc) },
    );

    expect(result.current.isLoading).toBe(true);
  });
});

// ─── Success state ────────────────────────────────────────────────────────────

describe('usePMD — success', () => {
  test('returns PMD document with correct visitId and checksum', async () => {
    global.fetch = mock(() => jsonResponse(MOCK_PMD)) as unknown as typeof fetch;

    const qc = freshClient();
    const { result } = renderHook(
      () => usePMD('visit-1'),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.data).not.toBeNull());
    expect(result.current.data!.visitId).toBe('visit-1');
    expect(result.current.data!.checksum).toBe('abc123');
    expect(result.current.data!.status).toBe('generated');
  });

  test('URL targets the pmd endpoint for the visitId', async () => {
    let capturedUrl = '';
    global.fetch = mock((req: Request | string | URL) => {
      capturedUrl = req instanceof Request ? req.url : String(req);
      return jsonResponse(MOCK_PMD);
    }) as unknown as typeof fetch;

    const qc = freshClient();
    const { result } = renderHook(
      () => usePMD('visit-99'),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.data).not.toBeNull());
    expect(capturedUrl).toContain('/dental/visits/visit-99/pmd');
  });
});

// ─── Error state ──────────────────────────────────────────────────────────────

describe('usePMD — error', () => {
  test('does not retry on error (retry: false)', async () => {
    let callCount = 0;
    global.fetch = mock(() => {
      callCount++;
      return jsonResponse({}, 500);
    }) as unknown as typeof fetch;

    const qc = freshClient();
    const { result } = renderHook(
      () => usePMD('visit-1'),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    // retry: false on both qc defaults and hook — should call exactly once
    expect(callCount).toBe(1);
  });

  // NOTE: this asserts the SERVER-ERROR path (500), not 404. usePMD deliberately
  // maps a 404 to `null` ("no PMD yet", not an error — see use-pmd.ts queryFn),
  // so a 404 must NOT set isError. The previous version mocked a 404 and asserted
  // isError; it only passed on macOS because the mocked 404 surfaced as a
  // non-SdkError there, while on Linux CI the SDK produced SdkError(404), the
  // hook swallowed it to null, isError never fired, and the test hung to timeout.
  test('data is undefined on a server error (5xx)', async () => {
    global.fetch = mock(() => jsonResponse({}, 500)) as unknown as typeof fetch;

    const qc = freshClient();
    const { result } = renderHook(
      () => usePMD('visit-1'),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });
});
