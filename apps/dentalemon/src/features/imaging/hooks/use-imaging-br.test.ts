/**
 * Imaging Business Rule assertion tests
 *
 * Each describe block is tagged to one BR from the TRACEABILITY_MATRIX.
 * Tests verify observable frontend behavior that enforces the rule.
 *
 * @BR-023 @BR-025 @BR-028 @BR-029 @BR-032 @BR-035
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { renderHook, waitFor, cleanup, act } from '@testing-library/react';
import { useImagingFindings } from './use-imaging-findings';
import { useImagingStudies } from './use-imaging-studies';
import { useImagingUpload } from './use-imaging-upload';
import { freshClient, makeWrapper, jsonResponse } from '@/test-utils';

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
  cleanup();
});

// ─── BR-023: Annotations non-destructive — never burned into image ───────────

describe('BR-023: Annotations non-destructive', () => {
  test('createFinding POSTs to /findings endpoint — never modifies image resource', async () => {
    let capturedUrl: string | undefined;
    global.fetch = mock((url: string) => {
      capturedUrl = url;
      return jsonResponse({ id: 'f1', imageId: 'img-1', type: 'caries', status: 'draft',
        visitId: 'v1', patientId: 'p1', branchId: 'b1', annotationId: null, treatmentId: null,
        toothNumber: null, surfaces: null, note: null, createdAt: '', updatedAt: '' });
    });

    const qc = freshClient();
    const { result } = renderHook(
      () => useImagingFindings('img-1'),
      { wrapper: makeWrapper(qc) },
    );

    await act(async () => {
      await result.current.createFinding.mutateAsync({ type: 'caries' });
    });

    // Must POST to /findings endpoint, NOT to /images endpoint
    expect(capturedUrl).toContain('/findings');
    expect(capturedUrl).not.toMatch(/\/images\/img-1$/);
  });

  test('findings are returned as overlay data separate from image URL', async () => {
    const findings = [{
      id: 'f1', imageId: 'img-1', type: 'caries', status: 'draft',
      visitId: 'v1', patientId: 'p1', branchId: 'b1', annotationId: null, treatmentId: null,
      toothNumber: null, surfaces: null, note: null, createdAt: '', updatedAt: '',
    }];
    global.fetch = mock(() => jsonResponse({ data: findings }));

    const qc = freshClient();
    const { result } = renderHook(
      () => useImagingFindings('img-1'),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Findings are separate data — no image URL in findings payload
    expect(result.current.findings[0]).not.toHaveProperty('imageUrl');
    expect(result.current.findings[0]).not.toHaveProperty('thumbnailUrl');
    expect(result.current.findings[0]!.imageId).toBe('img-1'); // reference, not the image itself
  });
});

// ─── BR-025: Image linked to patient; visit + tooth optional ────────────────

describe('BR-025: Image linked to patient; visit + tooth optional', () => {
  test('useImagingStudies requires patientId in URL', async () => {
    let capturedUrl: string | undefined;
    global.fetch = mock((url: string) => {
      capturedUrl = url;
      return jsonResponse({ items: [], total: 0 });
    });

    const qc = freshClient();
    const { result } = renderHook(
      () => useImagingStudies('patient-abc', 'branch-1'),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(capturedUrl).toContain('patient-abc');
  });

  test('hook is disabled when patientId is empty', async () => {
    let fetchCalled = false;
    global.fetch = mock(() => {
      fetchCalled = true;
      return jsonResponse({ items: [], total: 0 });
    });

    const qc = freshClient();
    renderHook(() => useImagingStudies(''), { wrapper: makeWrapper(qc) });

    // Wait a tick — no fetch should happen without patientId
    await new Promise((r) => setTimeout(r, 50));
    expect(fetchCalled).toBe(false);
  });

  test('upload accepts image without visitId or toothNumbers (both optional)', async () => {
    const calls: Array<{ url: string; body: any }> = [];
    global.fetch = mock((url: string, init?: RequestInit) => {
      const rawBody = init?.body;
      calls.push({ url, body: typeof rawBody === 'string' ? JSON.parse(rawBody) : null });
      if (url.includes('/studies')) {
        return jsonResponse({ study: { id: 'study-1' }, uploadUrl: 'http://s3/put', uploadMethod: 'PUT', fileId: 'file-1' });
      }
      return jsonResponse({});
    });

    const qc = freshClient();
    const { result } = renderHook(() => useImagingUpload(), { wrapper: makeWrapper(qc) });

    const file = new File(['data'], 'xray.jpg', { type: 'image/jpeg' });

    await act(async () => {
      await result.current.upload(file, { patientId: 'p1', branchId: 'b1' });
    });

    const studyCall = calls.find((c) => c.url.includes('/studies'));
    expect(studyCall).not.toBeNull();
    // visitId absent — should not be in body (or undefined)
    expect(studyCall!.body.visitId).toBeUndefined();
    // toothNumbers defaults to empty array (present but optional)
    expect(studyCall!.body.toothNumbers).toEqual([]);
  });
});

// ─── BR-028: Soft delete only — files retained ──────────────────────────────

describe('BR-028: Soft delete only — backend concern enforced at API layer', () => {
  test('deleteFinding uses DELETE method — no local cache purge (backend handles soft delete)', async () => {
    const calls: Array<{ url: string; method: string }> = [];
    global.fetch = mock((url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method ?? 'GET' });
      if (init?.method === 'DELETE') return new Response(null, { status: 204 });
      return jsonResponse({ data: [] }); // GET findings
    });

    const qc = freshClient();
    const { result } = renderHook(
      () => useImagingFindings('img-1'),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.deleteFinding.mutateAsync('finding-1');
    });

    const deleteCall = calls.find((c) => c.method === 'DELETE');
    expect(deleteCall).not.toBeNull();
    expect(deleteCall!.url).toContain('finding-1');
  });
});

// ─── BR-029: Branch isolation enforced ──────────────────────────────────────

describe('BR-029: Branch isolation', () => {
  test('upload always sends branchId in the request body', async () => {
    const calls: Array<{ url: string; body: any }> = [];
    global.fetch = mock((url: string, init?: RequestInit) => {
      const rawBody = init?.body;
      calls.push({ url, body: typeof rawBody === 'string' ? JSON.parse(rawBody) : null });
      if (url.includes('/studies')) {
        return jsonResponse({ study: { id: 'study-1' }, uploadUrl: 'http://s3/put', uploadMethod: 'PUT', fileId: 'file-1' });
      }
      return jsonResponse({});
    });

    const qc = freshClient();
    const { result } = renderHook(() => useImagingUpload(), { wrapper: makeWrapper(qc) });

    const file = new File(['data'], 'xray.png', { type: 'image/png' });
    await act(async () => {
      await result.current.upload(file, { patientId: 'p1', branchId: 'branch-xyz' });
    });

    const studyCall = calls.find((c) => c.url.includes('/studies'));
    expect(studyCall!.body.branchId).toBe('branch-xyz');
  });
});

// ─── BR-032: Modality non-nullable with default 'other' ─────────────────────

describe('BR-032: Modality non-nullable; defaults to "other"', () => {
  test('upload sends modality="other" when no modality is specified', async () => {
    const calls: Array<{ url: string; body: any }> = [];
    global.fetch = mock((url: string, init?: RequestInit) => {
      const rawBody = init?.body;
      calls.push({ url, body: typeof rawBody === 'string' ? JSON.parse(rawBody) : null });
      if (url.includes('/studies')) {
        return jsonResponse({ study: { id: 'study-1' }, uploadUrl: 'http://s3/put', uploadMethod: 'PUT', fileId: 'file-1' });
      }
      return jsonResponse({});
    });

    const qc = freshClient();
    const { result } = renderHook(() => useImagingUpload(), { wrapper: makeWrapper(qc) });

    const file = new File(['data'], 'xray.png', { type: 'image/png' });
    await act(async () => {
      // No modality specified
      await result.current.upload(file, { patientId: 'p1', branchId: 'b1' });
    });

    const studyCall = calls.find((c) => c.url.includes('/studies'));
    expect(studyCall!.body.modality).toBe('other');
  });

  test('upload preserves explicitly provided modality (e.g. "periapical")', async () => {
    const calls: Array<{ url: string; body: any }> = [];
    global.fetch = mock((url: string, init?: RequestInit) => {
      const rawBody = init?.body;
      calls.push({ url, body: typeof rawBody === 'string' ? JSON.parse(rawBody) : null });
      if (url.includes('/studies')) {
        return jsonResponse({ study: { id: 'study-1' }, uploadUrl: 'http://s3/put', uploadMethod: 'PUT', fileId: 'file-1' });
      }
      return jsonResponse({});
    });

    const qc = freshClient();
    const { result } = renderHook(() => useImagingUpload(), { wrapper: makeWrapper(qc) });

    const file = new File(['data'], 'xray.png', { type: 'image/png' });
    await act(async () => {
      await result.current.upload(file, { patientId: 'p1', branchId: 'b1', modality: 'periapical' });
    });

    const studyCall = calls.find((c) => c.url.includes('/studies'));
    expect(studyCall!.body.modality).toBe('periapical');
  });
});

// ─── BR-035: Concurrent annotation edits — last-write-wins (LWW) ────────────

describe('BR-035: Concurrent annotation edits — LWW', () => {
  // LWW is enforced at the database/API layer via updated_at timestamp comparison.
  // The frontend hook always sends the latest PATCH — it is the API's responsibility
  // to apply LWW semantics. This test confirms the hook sends the full update payload.
  test('updateFinding sends PATCH with the latest data (backend enforces LWW via timestamp)', async () => {
    const calls: Array<{ method: string; body: any }> = [];
    global.fetch = mock((_url: string, init?: RequestInit) => {
      const rawBody = init?.body;
      calls.push({ method: init?.method ?? 'GET', body: typeof rawBody === 'string' ? JSON.parse(rawBody) : null });
      return jsonResponse({ id: 'f1', type: 'caries', status: 'confirmed',
        imageId: 'img-1', visitId: 'v1', patientId: 'p1', branchId: 'b1',
        annotationId: null, treatmentId: null, toothNumber: null, surfaces: null,
        note: null, createdAt: '', updatedAt: '' });
    });

    const qc = freshClient();
    const { result } = renderHook(
      () => useImagingFindings('img-1'),
      { wrapper: makeWrapper(qc) },
    );

    await act(async () => {
      await result.current.updateFinding.mutateAsync({
        findingId: 'f1',
        data: { status: 'confirmed', note: 'Confirmed caries on mesial' },
      });
    });

    const patchCall = calls.find((c) => c.method === 'PATCH');
    expect(patchCall).not.toBeNull();
    expect(patchCall!.body.status).toBe('confirmed');
    expect(patchCall!.body.note).toBe('Confirmed caries on mesial');
  });
});
