/**
 * useImagingUpload — unit tests
 *
 * Covers the multi-step upload flow (initiate + presigned PUT), error paths
 * (initiate failure, storage failure with cleanup), and abort support.
 * Network fetch is mocked via global.fetch override — no MSW.
 *
 * @BR-027
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { renderHook, waitFor, cleanup, act } from '@testing-library/react';
import { useImagingUpload, type UploadOptions } from './use-imaging-upload';
import { freshClient, makeWrapper, jsonResponse } from '@/test-utils';

const defaultOptions: UploadOptions = {
  patientId: 'p1',
  branchId: 'b1',
  visitId: 'v1',
  modality: 'xray',
  toothNumbers: [14],
};

function makeFile(name = 'tooth.dcm', size = 1024) {
  return new File(['x'.repeat(size)], name, { type: 'application/dicom' });
}

// ─── Happy path ─────────────────────────────────────────────────────────────

describe('useImagingUpload — happy path', () => {
  // @BR-027
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    cleanup();
  });

  test('upload completes, returns studyId, progress goes 0→10→100, isUploading transitions true→false', async () => {
    // @BR-027
    const progressSnapshots: number[] = [];
    let callIndex = 0;
    let resolveStorage!: (r: Response) => void;
    const storagePromise = new Promise<Response>((res) => {
      resolveStorage = res;
    });

    global.fetch = mock(() => {
      callIndex++;
      if (callIndex === 1) {
        // Initiate response
        return jsonResponse({
          study: { id: 'study-1' },
          uploadUrl: 'https://s3.example.com/presigned',
          uploadMethod: 'PUT',
          fileId: 'file-1',
        });
      }
      // Storage PUT — delay so we can observe progress=10
      return storagePromise;
    });

    const qc = freshClient();
    const { result } = renderHook(() => useImagingUpload(), {
      wrapper: makeWrapper(qc),
    });

    // Snapshot 1: initial state
    progressSnapshots.push(result.current.progress);
    expect(result.current.isUploading).toBe(false);
    expect(result.current.progress).toBe(0);

    // Start upload (don't await — storage is blocked)
    let uploadPromise: Promise<{ studyId: string }>;
    await act(async () => {
      uploadPromise = result.current.upload(makeFile(), defaultOptions);
    });

    // Snapshot 2: after initiate completes, before storage resolves → progress=10
    progressSnapshots.push(result.current.progress);
    expect(result.current.progress).toBe(10);
    expect(result.current.isUploading).toBe(true);

    // Now resolve storage PUT
    let uploadResult: { studyId: string } | undefined;
    await act(async () => {
      resolveStorage(new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      uploadResult = await uploadPromise!;
    });

    // Snapshot 3: after storage completes → progress=100
    progressSnapshots.push(result.current.progress);

    // Assert all three snapshots
    expect(progressSnapshots).toEqual([0, 10, 100]);
    expect(uploadResult!.studyId).toBe('study-1');
    expect(result.current.isUploading).toBe(false);
    expect(result.current.progress).toBe(100);
  });

  test('passes correct body to initiate endpoint', async () => {
    // @BR-027
    let capturedBody: unknown;

    global.fetch = mock((req: Request | string | URL, init?: RequestInit) => {
      const url = req instanceof Request ? req.url : String(req);
      if (url.includes('/dental/imaging/studies')) {
        capturedBody = JSON.parse(init?.body as string ?? (req instanceof Request ? '' : ''));
        return jsonResponse({
          study: { id: 'study-1' },
          uploadUrl: 'https://s3.example.com/presigned',
          uploadMethod: 'PUT',
          fileId: 'file-1',
        });
      }
      return jsonResponse({}, 200);
    });

    const qc = freshClient();
    const { result } = renderHook(() => useImagingUpload(), {
      wrapper: makeWrapper(qc),
    });

    await act(async () => {
      await result.current.upload(makeFile('tooth.dcm', 2048), defaultOptions);
    });

    expect(capturedBody).toMatchObject({
      patientId: 'p1',
      branchId: 'b1',
      visitId: 'v1',
      modality: 'xray',
      filename: 'tooth.dcm',
      mimeType: 'application/dicom',
      size: 2048,
      toothNumbers: [14],
    });
  });
});

// ─── Initiate failure ───────────────────────────────────────────────────────

describe('useImagingUpload — initiate failure', () => {
  // @BR-027
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    cleanup();
  });

  test('first fetch returns 500, hook errors, isUploading resets, progress resets', async () => {
    // @BR-027
    global.fetch = mock(() => jsonResponse({ message: 'Internal Server Error' }, 500));

    const qc = freshClient();
    const { result } = renderHook(() => useImagingUpload(), {
      wrapper: makeWrapper(qc),
    });

    let error: Error | undefined;

    await act(async () => {
      try {
        await result.current.upload(makeFile(), defaultOptions);
      } catch (e) {
        error = e as Error;
      }
    });

    expect(error).not.toBeNull();
    expect(result.current.isUploading).toBe(false);
    expect(result.current.progress).toBe(0);
  });
});

// ─── Storage upload failure ─────────────────────────────────────────────────

describe('useImagingUpload — storage upload failure', () => {
  // @BR-027
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    cleanup();
  });

  test('second fetch returns 500, hook errors, cleanup DELETE to abort endpoint is called', async () => {
    // @BR-027
    let callIndex = 0;
    let abortCalled = false;
    let abortUrl = '';

    global.fetch = mock((req: Request | string | URL, init?: RequestInit) => {
      callIndex++;
      const url = req instanceof Request ? req.url : String(req);

      if (callIndex === 1) {
        // Initiate succeeds
        return jsonResponse({
          study: { id: 'study-1' },
          uploadUrl: 'https://s3.example.com/presigned',
          uploadMethod: 'PUT',
          fileId: 'file-42',
        });
      }

      if (init?.method === 'DELETE' || (req instanceof Request && req.method === 'DELETE')) {
        abortCalled = true;
        abortUrl = url;
        return jsonResponse({}, 200);
      }

      // Storage PUT fails
      return jsonResponse({ message: 'Storage error' }, 500);
    });

    const qc = freshClient();
    const { result } = renderHook(() => useImagingUpload(), {
      wrapper: makeWrapper(qc),
    });

    let error: Error | undefined;

    await act(async () => {
      try {
        await result.current.upload(makeFile(), defaultOptions);
      } catch (e) {
        error = e as Error;
      }
    });

    expect(error).not.toBeNull();
    expect(error!.message).toBe('Storage upload failed');
    expect(result.current.isUploading).toBe(false);

    // Wait for the best-effort cleanup DELETE
    await waitFor(() => expect(abortCalled).toBe(true));
    expect(abortUrl).toContain('/storage/multipart/file-42/abort');
  });
});

// ─── Abort mid-upload ───────────────────────────────────────────────────────

describe('useImagingUpload — abort mid-upload', () => {
  // @BR-027
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    cleanup();
  });

  test('call abort(), AbortController signal fires, isUploading/progress reset', async () => {
    // @BR-027
    let resolveStorage!: (r: Response) => void;
    const storagePromise = new Promise<Response>((res) => {
      resolveStorage = res;
    });
    let callIndex = 0;

    global.fetch = mock((_req: Request | string | URL, init?: RequestInit) => {
      callIndex++;
      if (callIndex === 1) {
        // Initiate succeeds
        return jsonResponse({
          study: { id: 'study-1' },
          uploadUrl: 'https://s3.example.com/presigned',
          uploadMethod: 'PUT',
          fileId: 'file-1',
        });
      }
      // Check if signal is present
      const signal = init?.signal;
      if (signal) {
        return new Promise<Response>((resolve, reject) => {
          signal.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          });
          // Also resolve if storagePromise resolves first
          storagePromise.then(resolve);
        });
      }
      return storagePromise;
    });

    const qc = freshClient();
    const { result } = renderHook(() => useImagingUpload(), {
      wrapper: makeWrapper(qc),
    });

    let error: Error | undefined;

    // Start upload (don't await — we'll abort mid-flight)
    let uploadPromise: Promise<{ studyId: string }>;
    await act(async () => {
      uploadPromise = result.current.upload(makeFile(), defaultOptions);
    });

    // Now abort
    act(() => {
      result.current.abort();
    });

    // The upload promise should reject with AbortError
    await act(async () => {
      try {
        await uploadPromise!;
      } catch (e) {
        error = e as Error;
      }
    });

    expect(error).not.toBeNull();
    expect(result.current.isUploading).toBe(false);
    expect(result.current.progress).toBe(0);
  });
});
