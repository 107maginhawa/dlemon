/**
 * useMedicalHistory + useMedicalHistoryMutations — unit tests
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { renderHook, waitFor, cleanup, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useMedicalHistory, useMedicalHistoryMutations } from './use-medical-history';

afterEach(cleanup);

const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });

const PATIENT_ID = 'patient-mh-test';

function freshClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
}

function makeWrapper(qc: QueryClient) {
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

const mockEntries = [
  { id: 'e1', patientId: PATIENT_ID, entryType: 'condition', displayName: 'Diabetes Mellitus Type 2', code: 'E11', codeSystem: 'ICD-10', notes: null, active: true, onsetDate: null, resolvedDate: null, createdAt: '2026-05-01T00:00:00Z', updatedAt: '2026-05-01T00:00:00Z' },
  { id: 'e2', patientId: PATIENT_ID, entryType: 'allergy', displayName: 'Penicillin', code: '372687004', codeSystem: 'SNOMED', notes: 'Severe', active: true, onsetDate: null, resolvedDate: null, createdAt: '2026-05-01T00:00:00Z', updatedAt: '2026-05-01T00:00:00Z' },
];

describe('useMedicalHistory — GET', () => {
  test('starts in loading state when patientId is provided', () => {
    global.fetch = mock(() => new Promise(() => {}));
    const qc = freshClient();
    const { result } = renderHook(() => useMedicalHistory(PATIENT_ID), { wrapper: makeWrapper(qc) });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.entries).toHaveLength(0);
  });

  test('returns entries on success (wrapped response)', async () => {
    global.fetch = mock(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ items: mockEntries }) } as Response),
    );
    const qc = freshClient();
    const { result } = renderHook(() => useMedicalHistory(PATIENT_ID), { wrapper: makeWrapper(qc) });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.entries).toHaveLength(2);
    expect(result.current.entries[0]?.displayName).toBe('Diabetes Mellitus Type 2');
    expect(result.current.error).toBeNull();
  });

  test('returns entries on success (bare array)', async () => {
    global.fetch = mock(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(mockEntries) } as Response),
    );
    const qc = freshClient();
    const { result } = renderHook(() => useMedicalHistory(PATIENT_ID), { wrapper: makeWrapper(qc) });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.entries).toHaveLength(2);
  });

  test('includes patientId in request URL', async () => {
    let capturedUrl = '';
    global.fetch = mock((url: string) => {
      capturedUrl = url;
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) } as Response);
    });
    const qc = freshClient();
    const { result } = renderHook(() => useMedicalHistory(PATIENT_ID), { wrapper: makeWrapper(qc) });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(capturedUrl).toContain(`patientId=${PATIENT_ID}`);
  });

  test('exposes error on non-ok response', async () => {
    global.fetch = mock(() =>
      Promise.resolve({ ok: false, status: 404 } as Response),
    );
    const qc = freshClient();
    const { result } = renderHook(() => useMedicalHistory(PATIENT_ID), { wrapper: makeWrapper(qc) });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.message).toContain('404');
  });

  test('does not fetch when patientId is empty', () => {
    const fetchSpy = mock(() => Promise.resolve({ ok: true, json: () => Promise.resolve([]) } as Response));
    global.fetch = fetchSpy;
    const qc = freshClient();
    renderHook(() => useMedicalHistory(''), { wrapper: makeWrapper(qc) });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('useMedicalHistoryMutations — addEntry', () => {
  test('calls POST with correct body', async () => {
    let capturedBody: any;
    global.fetch = mock((_url: string, opts: any) => {
      capturedBody = JSON.parse(opts.body);
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ ...mockEntries[0], id: 'new-e' }) } as Response);
    });
    const qc = freshClient();
    const { result } = renderHook(() => useMedicalHistoryMutations(PATIENT_ID), { wrapper: makeWrapper(qc) });
    await act(async () => {
      await result.current.addEntry({
        patientId: PATIENT_ID,
        entryType: 'condition',
        displayName: 'Hypertension',
        code: 'I10',
        codeSystem: 'ICD-10',
      });
    });
    expect(capturedBody.displayName).toBe('Hypertension');
    expect(capturedBody.entryType).toBe('condition');
  });

  test('invalidates medical-history query on success', async () => {
    global.fetch = mock(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ ...mockEntries[0], id: 'new-e' }) } as Response),
    );
    const qc = freshClient();
    qc.setQueryData(['medical-history', PATIENT_ID], mockEntries);
    const { result } = renderHook(() => useMedicalHistoryMutations(PATIENT_ID), { wrapper: makeWrapper(qc) });
    await act(async () => {
      await result.current.addEntry({ patientId: PATIENT_ID, entryType: 'condition', displayName: 'Test' });
    });
    expect(qc.getQueryState(['medical-history', PATIENT_ID])?.isInvalidated).toBe(true);
  });

  test('throws on POST failure', async () => {
    global.fetch = mock(() =>
      Promise.resolve({ ok: false, status: 400 } as Response),
    );
    const qc = freshClient();
    const { result } = renderHook(() => useMedicalHistoryMutations(PATIENT_ID), { wrapper: makeWrapper(qc) });
    let caught: Error | null = null;
    await act(async () => {
      try { await result.current.addEntry({ patientId: PATIENT_ID, entryType: 'condition', displayName: 'Test' }); }
      catch (e) { caught = e as Error; }
    });
    expect(caught?.message).toContain('400');
  });
});

describe('useMedicalHistoryMutations — toggleEntry', () => {
  test('calls PATCH with active flag', async () => {
    let capturedUrl = '';
    let capturedBody: any;
    global.fetch = mock((url: string, opts: any) => {
      capturedUrl = url;
      capturedBody = JSON.parse(opts.body);
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ ...mockEntries[0], active: false }) } as Response);
    });
    const qc = freshClient();
    const { result } = renderHook(() => useMedicalHistoryMutations(PATIENT_ID), { wrapper: makeWrapper(qc) });
    await act(async () => {
      await result.current.toggleEntry({ entryId: 'e1', active: false });
    });
    expect(capturedUrl).toContain('/dental/clinical/medical-history/e1');
    expect(capturedBody.active).toBe(false);
  });

  test('invalidates medical-history query on toggle', async () => {
    global.fetch = mock(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ ...mockEntries[0], active: false }) } as Response),
    );
    const qc = freshClient();
    qc.setQueryData(['medical-history', PATIENT_ID], mockEntries);
    const { result } = renderHook(() => useMedicalHistoryMutations(PATIENT_ID), { wrapper: makeWrapper(qc) });
    await act(async () => {
      await result.current.toggleEntry({ entryId: 'e1', active: false });
    });
    expect(qc.getQueryState(['medical-history', PATIENT_ID])?.isInvalidated).toBe(true);
  });
});
