/**
 * FindingsSidebar — component tests
 *
 * Uses global.fetch mocking (same pattern as other component tests).
 * Avoids mock.module() which contaminates useImagingFindings hook tests
 * when Bun runs both files in the same worker.
 */

import { describe, test, expect, afterEach, beforeEach, mock } from 'bun:test';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { freshClientWithMutations, makeWrapper as makeWrapperBase, jsonResponse } from '@/test-utils';
import type { ImagingFinding, ImagingFindingType, ImagingFindingStatus } from '../hooks/use-imaging-findings';
import { FindingsSidebar } from '../components/FindingsSidebar';

const originalFetch = global.fetch;

function makeWrapper() {
  return makeWrapperBase(freshClientWithMutations());
}

function makeFinding(overrides: Partial<ImagingFinding> = {}): ImagingFinding {
  return {
    id: 'f1',
    imageId: 'img-1',
    annotationId: null,
    treatmentId: null,
    visitId: 'v1',
    patientId: 'p1',
    branchId: 'b1',
    type: 'caries' as ImagingFindingType,
    status: 'draft' as ImagingFindingStatus,
    toothNumber: 14,
    surfaces: ['M'],
    note: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

const DEFAULT_PROPS = {
  imageId: 'img-1',
  isOpen: true,
  onClose: () => {},
};

beforeEach(() => {
  // Default: GET returns empty findings list (SDK response shape: { items: [] })
  global.fetch = mock(() => jsonResponse({ items: [] }));
});

afterEach(() => {
  global.fetch = originalFetch;
  cleanup();
});

describe('FindingsSidebar', () => {
  test('renders null when isOpen=false', () => {
    const { container } = render(
      React.createElement(FindingsSidebar, { ...DEFAULT_PROPS, isOpen: false }),
      { wrapper: makeWrapper() },
    );
    expect(container.innerHTML).toBe('');
  });

  test('renders Skeleton elements when loading', () => {
    // Fetch hangs so isLoading stays true
    global.fetch = mock(() => new Promise(() => {}));
    render(React.createElement(FindingsSidebar, DEFAULT_PROPS), { wrapper: makeWrapper() });
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThanOrEqual(3);
  });

  test('renders "No findings yet" text when findings is empty', async () => {
    render(React.createElement(FindingsSidebar, DEFAULT_PROPS), { wrapper: makeWrapper() });
    await waitFor(() => expect(screen.getByText(/No findings yet/)).not.toBeNull());
  });

  test('renders type labels for findings', async () => {
    global.fetch = mock(() => jsonResponse({ items: [
      makeFinding({ id: 'f1', type: 'secondary_caries' }),
      makeFinding({ id: 'f2', type: 'furcation_involvement' }),
    ] }));
    render(React.createElement(FindingsSidebar, DEFAULT_PROPS), { wrapper: makeWrapper() });
    await waitFor(() => expect(screen.getAllByText('Secondary Caries').length).toBeGreaterThanOrEqual(1));
    expect(screen.getAllByText('Furcation Involvement').length).toBeGreaterThanOrEqual(1);
  });

  test('clicking cycle status button calls PATCH with next status', async () => {
    let patchUrl = '';
    let patchBody: Record<string, unknown> = {};

    global.fetch = mock(async (req: Request | string | URL, init?: RequestInit) => {
      const url = req instanceof Request ? req.url : String(req);
      const method = req instanceof Request ? req.method : (init?.method ?? 'GET');
      if (method === 'PATCH') {
        patchUrl = url;
        // SDK passes body via Request object; raw fetch passes via init.body
        if (req instanceof Request) {
          try { patchBody = await req.json(); } catch { patchBody = {}; }
        } else {
          patchBody = JSON.parse(init?.body as string ?? '{}');
        }
        return jsonResponse(makeFinding({ id: 'f1', status: 'confirmed' }));
      }
      return jsonResponse({ items: [makeFinding({ id: 'f1', status: 'draft' })] });
    });

    const user = userEvent.setup();
    render(React.createElement(FindingsSidebar, DEFAULT_PROPS), { wrapper: makeWrapper() });
    await waitFor(() => expect(screen.getByLabelText('Cycle status')).not.toBeNull());
    await user.click(screen.getByLabelText('Cycle status'));

    await waitFor(() => expect(patchUrl).toContain('/dental/imaging/findings/f1'));
    expect(patchBody.status).toBe('confirmed');
  });

  test('clicking a quick chip selects a finding type', async () => {
    const user = userEvent.setup();
    render(React.createElement(FindingsSidebar, DEFAULT_PROPS), { wrapper: makeWrapper() });
    await waitFor(() => {
      const chips = screen.getAllByRole('button').filter(
        (btn) => btn.textContent === 'Bone Loss' && btn.getAttribute('type') === 'button',
      );
      return chips.length > 0;
    });
    const chips = screen.getAllByRole('button').filter(
      (btn) => btn.textContent === 'Bone Loss' && btn.getAttribute('type') === 'button',
    );
    await user.click(chips[0]!);
    expect(chips[0]!.className).toContain('lemon');
  });

  test('Add Finding button is disabled when no type selected', async () => {
    render(React.createElement(FindingsSidebar, DEFAULT_PROPS), { wrapper: makeWrapper() });
    await waitFor(() => expect(screen.getByRole('button', { name: /Add Finding/i })).not.toBeNull());
    const submitBtn = screen.getByRole('button', { name: /Add Finding/i });
    expect((submitBtn as HTMLButtonElement).disabled).toBe(true);
  });

  test('renders status badge text for findings', async () => {
    global.fetch = mock(() => jsonResponse({ items: [makeFinding({ id: 'f1', status: 'confirmed' })] }));
    render(React.createElement(FindingsSidebar, DEFAULT_PROPS), { wrapper: makeWrapper() });
    await waitFor(() => expect(screen.getByText('confirmed')).not.toBeNull());
  });

  // Regression: ISSUE-026 — findings create/update/delete failures were swallowed.
  // The hook exposes `mutationError` "for visible error UI" but FindingsSidebar only
  // logged to console → a 402/403 tier-block, 422, 5xx or network blip left the user
  // with no feedback (form stays filled, inviting a re-click). The banner must show.
  // Found by /qa on 2026-06-20
  // Report: .gstack/qa-reports/qa-report-localhost-2026-06-20.md
  test('ISSUE-026: surfaces an error banner when Add Finding fails', async () => {
    global.fetch = mock(async (req: Request | string | URL, init?: RequestInit) => {
      const method = req instanceof Request ? req.method : (init?.method ?? 'GET');
      if (method === 'POST') {
        return jsonResponse({ message: 'Imaging add-on required', code: 'FORBIDDEN' }, 403);
      }
      return jsonResponse({ items: [] });
    });

    const user = userEvent.setup();
    render(React.createElement(FindingsSidebar, DEFAULT_PROPS), { wrapper: makeWrapper() });

    // Select a type so "Add Finding" enables, then submit.
    await waitFor(() => expect(screen.getByRole('button', { name: /Add Finding/i })).not.toBeNull());
    const chips = screen.getAllByRole('button').filter(
      (b) => b.textContent === 'Caries' && b.getAttribute('type') === 'button',
    );
    await user.click(chips[0]!);
    await user.click(screen.getByRole('button', { name: /Add Finding/i }));

    // Before the fix this was silent; now an alert banner renders the failure.
    await waitFor(() => expect(screen.getByRole('alert')).not.toBeNull());
  });

  test('delete button calls DELETE on correct finding id', async () => {
    let deleteUrl = '';

    global.fetch = mock((req: Request | string | URL, init?: RequestInit) => {
      const url = req instanceof Request ? req.url : String(req);
      const method = req instanceof Request ? req.method : (init?.method ?? 'GET');
      if (method === 'DELETE') {
        deleteUrl = url;
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      return jsonResponse({ items: [makeFinding({ id: 'f-del' })] });
    });

    const user = userEvent.setup();
    render(React.createElement(FindingsSidebar, DEFAULT_PROPS), { wrapper: makeWrapper() });
    await waitFor(() => expect(screen.getByLabelText('Delete finding')).not.toBeNull());
    await user.click(screen.getByLabelText('Delete finding'));

    await waitFor(() => expect(deleteUrl).toContain('/dental/imaging/findings/f-del'));
  });
});
