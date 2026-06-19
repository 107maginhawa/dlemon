/**
 * useClaimLineMutations — add / update claim lines (roadmap Phase 1b sub-slice C).
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { renderHook, cleanup } from '@testing-library/react';
import { useClaimLineMutations } from './use-insurance-claims';
import { freshClient, makeWrapper, jsonResponse } from '@/test-utils';

describe('useClaimLineMutations', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    cleanup();
  });

  test('addLine POSTs to the claim lines collection', async () => {
    let url = '';
    let method = '';
    let body: unknown = null;
    global.fetch = mock(async (req: Request | string | URL, init?: RequestInit) => {
      url = req instanceof Request ? req.url : String(req);
      method = req instanceof Request ? req.method : (init?.method ?? 'GET');
      const raw = req instanceof Request ? await req.text() : (init?.body as string);
      body = raw ? JSON.parse(raw) : null;
      return jsonResponse({ id: 'l9', claimId: 'claim-1', cdtCode: 'D0220', description: 'PA X-ray', billedAmountCents: 3000, paidAmountCents: 0, status: 'pending' }, 201);
    });

    const qc = freshClient();
    const { result } = renderHook(() => useClaimLineMutations('claim-1', 'br-1'), { wrapper: makeWrapper(qc) });
    await result.current.addLine({ cdtCode: 'D0220', description: 'PA X-ray', billedAmountCents: 3000 });

    expect(method).toBe('POST');
    expect(url).toContain('/dental/billing/claims/claim-1/lines');
    expect(body).toMatchObject({ cdtCode: 'D0220', description: 'PA X-ray', billedAmountCents: 3000 });
  });

  test('updateLine PATCHes a specific line', async () => {
    let url = '';
    let method = '';
    let body: unknown = null;
    global.fetch = mock(async (req: Request | string | URL, init?: RequestInit) => {
      url = req instanceof Request ? req.url : String(req);
      method = req instanceof Request ? req.method : (init?.method ?? 'GET');
      const raw = req instanceof Request ? await req.text() : (init?.body as string);
      body = raw ? JSON.parse(raw) : null;
      return jsonResponse({ id: 'l1', claimId: 'claim-1', cdtCode: 'D1110', description: 'Prophylaxis', billedAmountCents: 4500, paidAmountCents: 0, status: 'pending' });
    });

    const qc = freshClient();
    const { result } = renderHook(() => useClaimLineMutations('claim-1', 'br-1'), { wrapper: makeWrapper(qc) });
    await result.current.updateLine({ lineId: 'l1', billedAmountCents: 4500 });

    expect(method).toBe('PATCH');
    expect(url).toContain('/dental/billing/claims/claim-1/lines/l1');
    expect(body).toMatchObject({ billedAmountCents: 4500 });
  });
});
