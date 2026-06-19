/**
 * usePatientActions — unit tests (FR2.7, FR2.8, FR2.13)
 *
 * Tests archive, restore, bulk archive, and export mutations.
 * Network fetch is mocked via global.fetch override.
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { renderHook, waitFor, cleanup, act } from '@testing-library/react';
import {
  useArchivePatient,
  useRestorePatient,
  useBulkArchive,
  useExportPatients,
} from './use-patient-actions';
import { freshClient, makeWrapper, jsonResponse } from '@/test-utils';

// ─── useArchivePatient ───────────────────────────────────────────────────

describe('useArchivePatient', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    cleanup();
  });

  test('calls SDK archive endpoint and invalidates patient list cache', async () => {
    let capturedUrl = '';
    let capturedMethod = '';

    global.fetch = mock((req: Request | string | URL) => {
      if (req instanceof Request) {
        capturedUrl = req.url;
        capturedMethod = req.method;
      }
      return jsonResponse({ id: 'p1', status: 'archived' });
    });

    const qc = freshClient();
    const invalidateSpy = mock(() => Promise.resolve());
    const origInvalidate = qc.invalidateQueries.bind(qc);
    qc.invalidateQueries = (...args: Parameters<typeof qc.invalidateQueries>) => {
      invalidateSpy();
      return origInvalidate(...args);
    };

    const { result } = renderHook(() => useArchivePatient(), {
      wrapper: makeWrapper(qc),
    });

    await act(async () => {
      result.current.archive('p1');
    });

    await waitFor(() => expect(capturedUrl).toContain('/dental/patients/p1/archive'));
    expect(capturedMethod).toBe('POST');
    expect(invalidateSpy).toHaveBeenCalled();
  });

  test('exposes isPending and error state', () => {
    global.fetch = mock(() => new Promise(() => {}));

    const qc = freshClient();
    const { result } = renderHook(() => useArchivePatient(), {
      wrapper: makeWrapper(qc),
    });

    expect(result.current.isPending).toBe(false);
    expect(result.current.error).toBeNull();
    expect(typeof result.current.archive).toBe('function');
  });
});

// ─── useRestorePatient ──────────────────────────────────────────────────

describe('useRestorePatient', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    cleanup();
  });

  test('calls SDK restore endpoint and invalidates patient list cache', async () => {
    let capturedUrl = '';
    let capturedMethod = '';

    global.fetch = mock((req: Request | string | URL) => {
      if (req instanceof Request) {
        capturedUrl = req.url;
        capturedMethod = req.method;
      }
      return jsonResponse({ id: 'p2', status: 'active' });
    });

    const qc = freshClient();
    const invalidateSpy = mock(() => Promise.resolve());
    const origInvalidate = qc.invalidateQueries.bind(qc);
    qc.invalidateQueries = (...args: Parameters<typeof qc.invalidateQueries>) => {
      invalidateSpy();
      return origInvalidate(...args);
    };

    const { result } = renderHook(() => useRestorePatient(), {
      wrapper: makeWrapper(qc),
    });

    await act(async () => {
      result.current.restore('p2');
    });

    await waitFor(() => expect(capturedUrl).toContain('/dental/patients/p2/restore'));
    expect(capturedMethod).toBe('POST');
    expect(invalidateSpy).toHaveBeenCalled();
  });

  test('exposes isPending and error state', () => {
    global.fetch = mock(() => new Promise(() => {}));

    const qc = freshClient();
    const { result } = renderHook(() => useRestorePatient(), {
      wrapper: makeWrapper(qc),
    });

    expect(result.current.isPending).toBe(false);
    expect(result.current.error).toBeNull();
    expect(typeof result.current.restore).toBe('function');
  });
});

// ─── useBulkArchive ─────────────────────────────────────────────────────

describe('useBulkArchive', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    cleanup();
  });

  test('calls SDK bulk-archive endpoint with patient IDs array', async () => {
    let capturedUrl = '';
    let capturedBody = '';

    global.fetch = mock(async (req: Request | string | URL) => {
      if (req instanceof Request) {
        capturedUrl = req.url;
        capturedBody = await req.text();
      }
      return jsonResponse({ results: [{ id: 'p1', archived: true }, { id: 'p2', archived: true }] });
    });

    const qc = freshClient();
    const invalidateSpy = mock(() => Promise.resolve());
    const origInvalidate = qc.invalidateQueries.bind(qc);
    qc.invalidateQueries = (...args: Parameters<typeof qc.invalidateQueries>) => {
      invalidateSpy();
      return origInvalidate(...args);
    };

    const { result } = renderHook(() => useBulkArchive(), {
      wrapper: makeWrapper(qc),
    });

    await act(async () => {
      result.current.bulkArchive(['p1', 'p2']);
    });

    await waitFor(() => expect(capturedUrl).toContain('/dental/patients/bulk-archive'));
    const body = JSON.parse(capturedBody);
    // Corrected contract: the endpoint expects { ids, reason } (the prior
    // `patientIds` payload was stale and would have been rejected at runtime).
    expect(body.ids).toEqual(['p1', 'p2']);
    expect(typeof body.reason).toBe('string');
    expect(invalidateSpy).toHaveBeenCalled();
  });

  test('exposes isPending state', () => {
    global.fetch = mock(() => new Promise(() => {}));

    const qc = freshClient();
    const { result } = renderHook(() => useBulkArchive(), {
      wrapper: makeWrapper(qc),
    });

    expect(result.current.isPending).toBe(false);
    expect(typeof result.current.bulkArchive).toBe('function');
  });
});

// ─── useExportPatients ──────────────────────────────────────────────────

describe('useExportPatients', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    cleanup();
  });

  test('calls SDK export endpoint, downloads CSV file, and returns data', async () => {
    let capturedUrl = '';

    global.fetch = mock((req: Request | string | URL) => {
      if (req instanceof Request) {
        capturedUrl = req.url;
      }
      return jsonResponse({
        patients: [
          { id: 'p1', displayName: 'Maria Santos', status: 'active', createdAt: '2026-01-01T00:00:00Z' },
          { id: 'p2', displayName: 'Ramon Cruz', status: 'active', createdAt: '2026-02-01T00:00:00Z' },
        ],
        exportedAt: '2026-05-09T10:00:00Z',
        total: 2,
      });
    });

    // Track Blob creation to verify CSV mime type and content
    let capturedBlobType = '';
    let capturedBlobContent = '';
    const OriginalBlob = global.Blob;
    global.Blob = class extends OriginalBlob {
      constructor(parts: BlobPart[], options?: BlobPropertyBag) {
        super(parts, options);
        capturedBlobType = options?.type ?? '';
        capturedBlobContent = parts.join('');
      }
    } as typeof Blob;

    // Track anchor download attribute to verify .csv extension
    let capturedDownload = '';
    const origCreateElement = document.createElement.bind(document);
    const createElementSpy = mock((tag: string) => {
      const el = origCreateElement(tag);
      if (tag === 'a') {
        Object.defineProperty(el, 'download', {
          set(val: string) { capturedDownload = val; },
          get() { return capturedDownload; },
          configurable: true,
        });
        el.click = mock(() => {});
      }
      return el;
    });
    document.createElement = createElementSpy as typeof document.createElement;

    const qc = freshClient();
    const { result } = renderHook(() => useExportPatients('branch-xyz'), {
      wrapper: makeWrapper(qc),
    });

    let exportData: unknown;
    await act(async () => {
      exportData = await result.current.exportPatients();
    });

    await waitFor(() => expect(capturedUrl).toContain('/dental/patients/export'));
    // The export request MUST include branchId — the handler 400s without it,
    // so the UI export button was non-functional for every role when it was
    // omitted. (EM-PAT-001 cross-branch scope; export is dentist_owner-only.)
    expect(capturedUrl).toContain('branchId=branch-xyz');
    expect(exportData).not.toBeNull();

    // Verify CSV format (FR2.13)
    expect(capturedBlobType).toBe('text/csv');
    expect(capturedDownload).toMatch(/\.csv$/);
    expect(capturedBlobContent).toContain('"id"');
    expect(capturedBlobContent).toContain('"name"');
    expect(capturedBlobContent).toContain('"status"');
    expect(capturedBlobContent).toContain('"createdAt"');
    expect(capturedBlobContent).toContain('Maria Santos');
    expect(capturedBlobContent).toContain('Ramon Cruz');

    // Restore
    global.Blob = OriginalBlob;
    document.createElement = origCreateElement as typeof document.createElement;
  });

  test('exposes isExporting state', () => {
    global.fetch = mock(() => new Promise(() => {}));

    const qc = freshClient();
    const { result } = renderHook(() => useExportPatients(), {
      wrapper: makeWrapper(qc),
    });

    expect(result.current.isExporting).toBe(false);
    expect(typeof result.current.exportPatients).toBe('function');
  });

  // Regression: ISSUE-016 — export is dentist_owner-only server-side, so a staff
  // role 403s. The hook had try/finally with no catch and the button's onClick was
  // the raw async fn, so the throw became an unhandled rejection: the user clicked
  // Export and saw nothing. Now the failure is caught + surfaced (toastError) and
  // resolves to undefined. Found by /qa on 2026-06-20.
  // Report: .gstack/qa-reports/qa-report-localhost-2026-06-20.md
  test('a failed export (403 for non-owner) is surfaced, not a silent throw', async () => {
    global.fetch = mock(() => jsonResponse({ error: 'Forbidden' }, 403));

    const qc = freshClient();
    const { result } = renderHook(() => useExportPatients('branch-xyz'), {
      wrapper: makeWrapper(qc),
    });

    let outcome: unknown = 'unset';
    let threw = false;
    await act(async () => {
      try {
        outcome = await result.current.exportPatients();
      } catch {
        threw = true;
      }
    });

    expect(threw).toBe(false); // before the fix the 403 propagated as an unhandled throw
    expect(outcome).toBeUndefined();
    expect(result.current.isExporting).toBe(false);
  });
});
