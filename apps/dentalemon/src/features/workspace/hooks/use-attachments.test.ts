/**
 * Tests for use-attachments hooks
 *
 * Covers: ATCH-01 (upload), ATCH-02 (list/download), ATCH-03 (visit-scoped)
 */
import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  useAttachments,
  useUploadAttachment,
  useDeleteAttachment,
  IMAGE_TYPE_LABELS,
  IMAGE_TYPES,
} from './use-attachments';

function jsonResponse(data: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

const mockFetch = mock(() => jsonResponse({ data: [], pagination: {} }));

function makeWrapper(qc: QueryClient) {
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

const ATTACHMENT = {
  id: 'att-1',
  visitId: 'visit-1',
  patientId: 'pat-1',
  imageType: 'xray' as const,
  fileName: 'panoramic.jpg',
  filePath: 'file-uuid-123',
  fileSizeBytes: 204800,
  mimeType: 'image/jpeg',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  version: 1,
};

describe('IMAGE_TYPE_LABELS', () => {
  it('has label for every image type', () => {
    for (const t of IMAGE_TYPES) {
      expect(IMAGE_TYPE_LABELS[t]).toBeTruthy();
    }
  });
});

describe('useAttachments', () => {
  let qc: QueryClient;

  beforeEach(() => {
    qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    global.fetch = mockFetch as unknown as typeof fetch;
    mockFetch.mockReset();
  });

  afterEach(() => {
    qc.clear();
  });

  it('is disabled when visitId is null', () => {
    const wrapper = makeWrapper(qc);
    const { result } = renderHook(() => useAttachments(null), { wrapper });
    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
  });

  it('fetches attachments when visitId provided (ATCH-02, ATCH-03)', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [ATTACHMENT] }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );

    const wrapper = makeWrapper(qc);
    const { result } = renderHook(() => useAttachments('visit-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0].fileName).toBe('panoramic.jpg');
    expect(result.current.data![0].visitId).toBe('visit-1');
  });

  it('calls correct URL for visit-scoped endpoint (ATCH-03)', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );

    const wrapper = makeWrapper(qc);
    renderHook(() => useAttachments('visit-42'), { wrapper });
    await waitFor(() => expect(mockFetch).toHaveBeenCalled());

    const req = mockFetch.mock.calls[0]![0] as Request | string;
    const url = req instanceof Request ? req.url : String(req);
    expect(url).toContain('/dental/visits/visit-42/attachments');
  });

  it('handles response with data wrapper', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [ATTACHMENT] }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );

    const wrapper = makeWrapper(qc);
    const { result } = renderHook(() => useAttachments('visit-1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
  });

  it('sets isError on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({}), { status: 500, headers: { 'Content-Type': 'application/json' } }),
    );

    const wrapper = makeWrapper(qc);
    const { result } = renderHook(() => useAttachments('visit-1'), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useUploadAttachment', () => {
  let qc: QueryClient;

  beforeEach(() => {
    qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    global.fetch = mockFetch as unknown as typeof fetch;
    mockFetch.mockReset();
  });

  afterEach(() => {
    qc.clear();
  });

  it('runs the 4-step upload flow (ATCH-01)', async () => {
    // Step 1: presigned URL init
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ file: 'file-uuid', uploadUrl: 'https://s3.example/presigned', uploadMethod: 'PUT' }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    // Step 2: PUT to presigned URL
    mockFetch.mockResolvedValueOnce(
      new Response(null, { status: 200 }),
    );
    // Step 3: complete
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    // Step 4: create attachment record
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(ATTACHMENT), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );

    const wrapper = makeWrapper(qc);
    const { result } = renderHook(
      () => useUploadAttachment('visit-1', 'pat-1'),
      { wrapper },
    );

    const file = new File(['data'], 'xray.jpg', { type: 'image/jpeg' });
    result.current.mutate({ file, imageType: 'xray', toothNumbers: [11, 12] });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockFetch).toHaveBeenCalledTimes(4);

    // Step 4 payload check
    const step4Req = mockFetch.mock.calls[3]![0] as Request | string;
    let step4Body: any;
    if (step4Req instanceof Request) {
      step4Body = JSON.parse(await step4Req.clone().text());
    } else {
      step4Body = JSON.parse((mockFetch.mock.calls[3] as [string, RequestInit])[1].body as string);
    }
    expect(step4Body.visitId).toBe('visit-1');
    expect(step4Body.patientId).toBe('pat-1');
    expect(step4Body.imageType).toBe('xray');
    expect(step4Body.filePath).toBe('file-uuid');
    expect(step4Body.toothNumbers).toEqual([11, 12]);
  });

  it('throws if storage upload fails', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ file: 'fid', uploadUrl: 'https://s3.example/url', uploadMethod: 'PUT' }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    // PUT fails
    mockFetch.mockResolvedValueOnce(
      new Response(null, { status: 403 }),
    );

    const wrapper = makeWrapper(qc);
    const { result } = renderHook(
      () => useUploadAttachment('visit-1', 'pat-1'),
      { wrapper },
    );

    const file = new File(['data'], 'xray.jpg', { type: 'image/jpeg' });
    result.current.mutate({ file, imageType: 'photo' });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toContain('Failed to upload file');
  });
});

describe('useDeleteAttachment', () => {
  let qc: QueryClient;

  beforeEach(() => {
    qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    global.fetch = mockFetch as unknown as typeof fetch;
    mockFetch.mockReset();
  });

  afterEach(() => {
    qc.clear();
  });

  it('calls DELETE endpoint with correct URL', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(null, { status: 200 }),
    );

    const wrapper = makeWrapper(qc);
    const { result } = renderHook(() => useDeleteAttachment('visit-1'), { wrapper });

    result.current.mutate('att-99');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const req = mockFetch.mock.calls[0]![0] as Request | string;
    const url = req instanceof Request ? req.url : String(req);
    expect(url).toContain('/dental/visits/visit-1/attachments/att-99');
  });

  it('sets isError on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({}), { status: 404, headers: { 'Content-Type': 'application/json' } }),
    );

    const wrapper = makeWrapper(qc);
    const { result } = renderHook(() => useDeleteAttachment('visit-1'), { wrapper });

    result.current.mutate('att-missing');
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
