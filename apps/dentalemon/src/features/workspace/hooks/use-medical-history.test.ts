/**
 * useMedicalHistory + useMedicalHistoryMutations — unit tests
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { renderHook, waitFor, cleanup, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useMedicalHistory, useMedicalHistoryMutations, medicalHistoryKey } from './use-medical-history';

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

function jsonResponse(data: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
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
      jsonResponse({ items: mockEntries }),
    );
    const qc = freshClient();
    const { result } = renderHook(() => useMedicalHistory(PATIENT_ID), { wrapper: makeWrapper(qc) });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.entries).toHaveLength(2);
    expect(result.current.entries[0]?.displayName).toBe('Diabetes Mellitus Type 2');
    expect(result.current.error).toBeNull();
  });

  test('returns entries on success (empty data array)', async () => {
    global.fetch = mock(() =>
      jsonResponse({ data: [] }),
    );
    const qc = freshClient();
    const { result } = renderHook(() => useMedicalHistory(PATIENT_ID), { wrapper: makeWrapper(qc) });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.entries).toHaveLength(0);
  });

  test('includes patientId in request URL', async () => {
    let capturedUrl = '';
    global.fetch = mock((req: Request | string | URL) => {
      capturedUrl = req instanceof Request ? req.url : String(req);
      return jsonResponse([]);
    });
    const qc = freshClient();
    const { result } = renderHook(() => useMedicalHistory(PATIENT_ID), { wrapper: makeWrapper(qc) });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(capturedUrl).toContain(`patientId=${PATIENT_ID}`);
  });

  test('exposes error on non-ok response', async () => {
    global.fetch = mock(() =>
      jsonResponse({ error: 'not found' }, 404),
    );
    const qc = freshClient();
    const { result } = renderHook(() => useMedicalHistory(PATIENT_ID), { wrapper: makeWrapper(qc) });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    // SDK throws the parsed JSON body on non-ok; TanStack Query captures it as error
    expect(result.current.error).not.toBeNull();
  });

  test('does not fetch when patientId is empty', () => {
    const fetchSpy = mock(() => jsonResponse([]));
    global.fetch = fetchSpy;
    const qc = freshClient();
    renderHook(() => useMedicalHistory(''), { wrapper: makeWrapper(qc) });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('useMedicalHistoryMutations — addEntry', () => {
  test('calls POST with correct body', async () => {
    let capturedBody: any;
    global.fetch = mock((req: Request | string | URL, opts: any) => {
      if (req instanceof Request) {
        req.clone().text().then(t => { capturedBody = JSON.parse(t); });
      } else {
        capturedBody = JSON.parse(opts.body);
      }
      return jsonResponse({ ...mockEntries[0], id: 'new-e' });
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
      jsonResponse({ ...mockEntries[0], id: 'new-e' }),
    );
    const qc = freshClient();
    const qk = medicalHistoryKey(PATIENT_ID);
    qc.setQueryData(qk, mockEntries);
    const { result } = renderHook(() => useMedicalHistoryMutations(PATIENT_ID), { wrapper: makeWrapper(qc) });
    await act(async () => {
      await result.current.addEntry({ patientId: PATIENT_ID, entryType: 'condition', displayName: 'Test' });
    });
    expect(qc.getQueryState(qk)?.isInvalidated).toBe(true);
  });

  test('throws on POST failure', async () => {
    global.fetch = mock(() =>
      jsonResponse({ error: 'bad request' }, 400),
    );
    const qc = freshClient();
    const { result } = renderHook(() => useMedicalHistoryMutations(PATIENT_ID), { wrapper: makeWrapper(qc) });
    let threw = false;
    await act(async () => {
      try {
        await result.current.addEntry({ patientId: PATIENT_ID, entryType: 'condition', displayName: 'Test' });
      } catch {
        threw = true;
      }
    });
    expect(threw).toBe(true);
  });
});

describe('useMedicalHistoryMutations — toggleEntry', () => {
  test('calls PATCH with active flag', async () => {
    let capturedUrl = '';
    let capturedBody: any;
    global.fetch = mock((req: Request | string | URL, opts: any) => {
      capturedUrl = req instanceof Request ? req.url : String(req);
      if (req instanceof Request) {
        req.clone().text().then(t => { capturedBody = JSON.parse(t); });
      } else {
        capturedBody = JSON.parse(opts.body);
      }
      return jsonResponse({ ...mockEntries[0], active: false });
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
      jsonResponse({ ...mockEntries[0], active: false }),
    );
    const qc = freshClient();
    const qk = medicalHistoryKey(PATIENT_ID);
    qc.setQueryData(qk, mockEntries);
    const { result } = renderHook(() => useMedicalHistoryMutations(PATIENT_ID), { wrapper: makeWrapper(qc) });
    await act(async () => {
      await result.current.toggleEntry({ entryId: 'e1', active: false });
    });
    expect(qc.getQueryState(qk)?.isInvalidated).toBe(true);
  });
});
