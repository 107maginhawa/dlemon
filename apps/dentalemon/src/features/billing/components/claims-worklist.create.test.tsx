/**
 * ClaimsWorklist — "New claim" affordance (Phase 1b sub-slice A wiring).
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ClaimsWorklist } from './claims-worklist';
import { freshClient, makeWrapper, jsonResponse } from '@/test-utils';

describe('ClaimsWorklist New claim affordance', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    cleanup();
  });

  function emptyFetch() {
    return mock((req: Request | string | URL) => {
      const url = req instanceof Request ? req.url : String(req);
      if (url.includes('/claims')) return jsonResponse({ items: [], total: 0 });
      return jsonResponse({ payers: [], summary: { totalOutstandingCents: 0, payerCount: 0 } });
    });
  }

  test('writer sees a New claim button that opens the create form', async () => {
    global.fetch = emptyFetch();
    const qc = freshClient();
    render(<ClaimsWorklist branchId="br-1" canWrite />, { wrapper: makeWrapper(qc) });

    const btn = screen.getByTestId('new-claim-btn');
    expect(btn).toBeDefined();
    fireEvent.click(btn);
    expect(screen.getByTestId('claim-create')).toBeDefined();
  });

  test('non-writer does not see the New claim button', () => {
    global.fetch = emptyFetch();
    const qc = freshClient();
    render(<ClaimsWorklist branchId="br-1" canWrite={false} />, { wrapper: makeWrapper(qc) });
    expect(screen.queryByTestId('new-claim-btn')).toBeNull();
  });
});
