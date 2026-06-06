/**
 * CbctStudyCard tests (P2-7 CBCT volume affordance).
 *
 * Verifies: volume metadata + truthful labeling, NO flat <img>, lemon "Open in
 * viewer" handoff fetches the presigned link and opens it in a new tab.
 */
import { describe, test, expect, afterEach, beforeEach, mock } from 'bun:test';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { freshClientWithMutations, makeWrapper as makeWrapperBase, jsonResponse } from '@/test-utils';
import { CbctStudyCard } from '../components/CbctStudyCard';

const originalFetch = global.fetch;
const originalOpen = global.window?.open;

function makeWrapper() {
  return makeWrapperBase(freshClientWithMutations());
}

function makeVolumeItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'img-cbct-1',
    source: 'imaging',
    modality: 'cbct',
    fileName: 'cone-beam.dcm',
    mimeType: 'application/dicom',
    fileSizeBytes: 52428800,
    studyId: 'study-cbct-1',
    visitId: null,
    toothNumbers: [],
    createdAt: '2026-01-01T00:00:00Z',
    downloadUrl: null,
    isVolume: true,
    frameCount: 128,
    viewerKind: 'volume',
    ...overrides,
  } as any;
}

beforeEach(() => {
  global.fetch = mock(() =>
    jsonResponse({
      viewerKind: 'download',
      downloadUrl: 'https://storage.example.com/presigned-get/file-1',
      expiresAt: '2026-01-01T00:15:00Z',
      isVolume: true,
      frameCount: 128,
    }),
  );
});

afterEach(() => {
  global.fetch = originalFetch;
  if (originalOpen) global.window.open = originalOpen;
  cleanup();
});

describe('CbctStudyCard', () => {
  test('renders a volume card with truthful labeling and NO flat <img>', () => {
    const { container } = render(
      React.createElement(CbctStudyCard, { item: makeVolumeItem() }),
      { wrapper: makeWrapper() },
    );
    expect(screen.getByTestId('cbct-study-card')).not.toBeNull();
    expect(screen.getByTestId('cbct-volume-badge').textContent).toMatch(/3D Volume/i);
    // Truthful slice count (never a single slice masquerading as the CBCT).
    expect(screen.getByTestId('cbct-frame-count').textContent).toMatch(/128 slices/i);
    // Clinical-safety: it must NOT render a flat raster image.
    expect(container.querySelector('img')).toBeNull();
  });

  test('"Open in viewer" fetches the presigned link and opens it in a new tab', async () => {
    const openSpy = mock(() => null);
    global.window.open = openSpy as any;
    const user = userEvent.setup();

    render(React.createElement(CbctStudyCard, { item: makeVolumeItem() }), {
      wrapper: makeWrapper(),
    });

    await user.click(screen.getByTestId('cbct-open-viewer'));

    await waitFor(() => expect(openSpy).toHaveBeenCalledTimes(1));
    const calledUrl = (openSpy.mock.calls[0] as unknown[])[0];
    expect(calledUrl).toBe('https://storage.example.com/presigned-get/file-1');

    // The viewer-link endpoint (not a flat image) was hit.
    const fetchMock = global.fetch as unknown as { mock: { calls: unknown[][] } };
    const firstArg = fetchMock.mock.calls[0]?.[0];
    const url = firstArg instanceof Request ? firstArg.url : String(firstArg);
    expect(url).toMatch(/\/dental\/imaging\/studies\/study-cbct-1\/cbct\/viewer-link$/);
  });

  test('viewer button is disabled when the item has no studyId', () => {
    render(
      React.createElement(CbctStudyCard, { item: makeVolumeItem({ studyId: null }) }),
      { wrapper: makeWrapper() },
    );
    const btn = screen.getByTestId('cbct-open-viewer') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });
});
