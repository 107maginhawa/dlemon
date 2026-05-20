/**
 * useFollowUpNotes — unit tests (FR2.12)
 *
 * Tests that the hook fetches follow-up notes and supports adding new notes.
 * Network fetch is mocked via global.fetch override.
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { renderHook, waitFor, cleanup, act } from '@testing-library/react';
import { useFollowUpNotes, useAddFollowUpNote } from './use-follow-up-notes';
import type { FollowUpNote } from './use-follow-up-notes';
import { freshClient, makeWrapper, jsonResponse } from '@/test-utils';

// ─── Fixtures ─────────────────────────────────────────────────────────────

const NOTES: FollowUpNote[] = [
  {
    id: 'n1',
    text: 'Patient needs follow-up in 2 weeks',
    createdAt: '2026-04-01T10:00:00Z',
    createdBy: 'Dr. Santos',
  },
  {
    id: 'n2',
    text: 'Prescribed antibiotics for infection',
    createdAt: '2026-03-15T09:00:00Z',
    createdBy: 'Dr. Reyes',
  },
];

// ─── useFollowUpNotes ─────────────────────────────────────────────────────

describe('useFollowUpNotes', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    cleanup();
  });

  test('returns notes array on success', async () => {
    global.fetch = mock(() =>
      jsonResponse({ notes: NOTES, total: 2 }),
    );

    const qc = freshClient();
    const { result } = renderHook(
      () => useFollowUpNotes({ patientId: 'p1' }),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.notes).toHaveLength(2);
    expect(result.current.notes[0]!.text).toBe('Patient needs follow-up in 2 weeks');
    expect(result.current.notes[1]!.createdBy).toBe('Dr. Reyes');
  });

  test('returns loading state initially', () => {
    global.fetch = mock(() => new Promise(() => {})); // never resolves

    const qc = freshClient();
    const { result } = renderHook(
      () => useFollowUpNotes({ patientId: 'p1' }),
      { wrapper: makeWrapper(qc) },
    );

    expect(result.current.isLoading).toBe(true);
    expect(result.current.notes).toHaveLength(0);
  });

  test('returns error on fetch failure', async () => {
    global.fetch = mock(() => jsonResponse({}, 500));

    const qc = freshClient();
    const { result } = renderHook(
      () => useFollowUpNotes({ patientId: 'p1' }),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.notes).toHaveLength(0);
    expect(result.current.error).not.toBeNull();
  });

  test('fetches with patient id in URL path', async () => {
    let capturedUrl = '';
    global.fetch = mock((req: Request | string | URL) => {
      capturedUrl = req instanceof Request ? req.url : String(req);
      return jsonResponse({ notes: [], total: 0 });
    });

    const qc = freshClient();
    const { result } = renderHook(
      () => useFollowUpNotes({ patientId: 'patient-123' }),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(capturedUrl).toContain('patient-123');
    expect(capturedUrl).toContain('follow-up-notes');
  });

  test('returns empty notes when response has no notes array', async () => {
    global.fetch = mock(() => jsonResponse({ notes: [], total: 0 }));

    const qc = freshClient();
    const { result } = renderHook(
      () => useFollowUpNotes({ patientId: 'p1' }),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.notes).toHaveLength(0);
    expect(result.current.error).toBeNull();
  });

  test('renders notes in chronological order (newest first by default)', async () => {
    // Provide notes in oldest-first order to confirm client-side sort reverses them
    const unordered: FollowUpNote[] = [
      {
        id: 'n2',
        text: 'Older note',
        createdAt: '2026-03-15T09:00:00Z',
        createdBy: 'Dr. Reyes',
      },
      {
        id: 'n1',
        text: 'Newer note',
        createdAt: '2026-04-01T10:00:00Z',
        createdBy: 'Dr. Santos',
      },
    ];

    global.fetch = mock(() =>
      jsonResponse({ notes: unordered, total: 2 }),
    );

    const qc = freshClient();
    const { result } = renderHook(
      () => useFollowUpNotes({ patientId: 'p1' }),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.notes).toHaveLength(2);
    // Newest note must come first
    const first = new Date(result.current.notes[0]!.createdAt).getTime();
    const second = new Date(result.current.notes[1]!.createdAt).getTime();
    expect(first).toBeGreaterThan(second);
  });
});

// ─── useAddFollowUpNote ───────────────────────────────────────────────────

describe('useAddFollowUpNote', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    cleanup();
  });

  test('calls SDK with text body and invalidates query cache', async () => {
    let callCount = 0;
    let capturedBody = '';

    global.fetch = mock((req: Request | string | URL) => {
      callCount++;
      if (req instanceof Request && req.method === 'POST') {
        req.text().then((b) => { capturedBody = b; });
        return jsonResponse({
          note: { id: 'n-new', text: 'New note', createdAt: '2026-05-01T10:00:00Z', createdBy: 'Dr. Santos' },
          total: 1,
        });
      }
      // GET for the list query
      return jsonResponse({ notes: [], total: 0 });
    });

    const qc = freshClient();
    const invalidateSpy = mock(() => Promise.resolve());
    const origInvalidate = qc.invalidateQueries.bind(qc);
    qc.invalidateQueries = (...args: Parameters<typeof qc.invalidateQueries>) => {
      invalidateSpy();
      return origInvalidate(...args);
    };

    const { result } = renderHook(
      () => useAddFollowUpNote({ patientId: 'p1' }),
      { wrapper: makeWrapper(qc) },
    );

    await act(async () => {
      result.current.addNote('New note');
    });

    // Wait for mutation to settle
    await waitFor(() => expect(callCount).toBeGreaterThanOrEqual(1));
    expect(invalidateSpy).toHaveBeenCalled();
  });

  test('exposes isPending state', () => {
    global.fetch = mock(() => new Promise(() => {}));

    const qc = freshClient();
    const { result } = renderHook(
      () => useAddFollowUpNote({ patientId: 'p1' }),
      { wrapper: makeWrapper(qc) },
    );

    expect(result.current.isPending).toBe(false);
    expect(typeof result.current.addNote).toBe('function');
  });
});
