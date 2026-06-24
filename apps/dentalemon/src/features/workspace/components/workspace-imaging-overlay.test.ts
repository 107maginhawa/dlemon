/**
 * WorkspaceImagingOverlay — image/file coherence
 *
 * Guards the bug class: a record listed and selectable, but with no stored file,
 * must NOT open the viewer with the bare fileName as a URL (silent blank canvas).
 * It must show an explicit "unavailable" state instead.
 *
 * Uses global.fetch mocking (NOT mock.module) so the real PatientImageList renders
 * and we don't contaminate sibling suites. ImagingWorkspace is stubbed globally in
 * test-setup.ts as <div data-testid="imaging-workspace-stub" data-src={imageUrl}>,
 * so we can assert exactly which URL (if any) the viewer received.
 */
import { describe, test, expect, afterEach, beforeEach, mock } from 'bun:test';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { freshClient, makeWrapper as makeWrapperBase, jsonResponse } from '@/test-utils';
import { WorkspaceImagingOverlay } from './workspace-imaging-overlay';

const originalFetch = global.fetch;

function makeWrapper() {
  return makeWrapperBase(freshClient());
}

function makeItem(id: string, fileName: string, downloadUrl: string | null) {
  return {
    id,
    source: 'imaging',
    modality: 'periapical',
    fileName,
    mimeType: 'image/jpeg',
    fileSizeBytes: 2048,
    studyId: `s-${id}`,
    visitId: 'v-1',
    toothNumbers: [14],
    createdAt: '2025-01-01T00:00:00Z',
    downloadUrl,
  };
}

beforeEach(() => {
  global.fetch = mock(() =>
    jsonResponse({
      items: [
        makeItem('broken', 'broken.jpg', null),
        makeItem('ok', 'pano.jpg', 'https://s3.example/pano.jpg'),
      ],
      total: 2,
    }),
  );
});

afterEach(() => {
  global.fetch = originalFetch;
  cleanup();
});

function renderOverlay() {
  return render(
    React.createElement(WorkspaceImagingOverlay, {
      patientId: 'pat-1',
      branchId: 'br-1',
      currentVisitId: null,
      open: true,
      onClose: () => {},
    }),
    { wrapper: makeWrapper() },
  );
}

describe('WorkspaceImagingOverlay — image/file coherence', () => {
  test('selecting an image with no stored file shows unavailable, not a blank viewer', async () => {
    const user = userEvent.setup();
    renderOverlay();
    await user.click(await screen.findByText('broken.jpg'));
    expect(screen.getByTestId('image-unavailable')).not.toBeNull();
    // must NOT mount the viewer with the bare filename as a URL
    expect(screen.queryByTestId('imaging-workspace-stub')).toBeNull();
  });

  test('selecting an image with a stored file opens the viewer with its downloadUrl', async () => {
    const user = userEvent.setup();
    renderOverlay();
    await user.click(await screen.findByText('pano.jpg'));
    await waitFor(() => expect(screen.getByTestId('imaging-workspace-stub')).not.toBeNull());
    expect(screen.getByTestId('imaging-workspace-stub').getAttribute('data-src')).toBe(
      'https://s3.example/pano.jpg',
    );
    expect(screen.queryByTestId('image-unavailable')).toBeNull();
  });

  // L3: a drilled-in viewer must be leavable without closing the whole overlay.
  test('shows a "Back to images" control once an image is selected', async () => {
    const user = userEvent.setup();
    renderOverlay();
    expect(screen.queryByTestId('imaging-back-btn')).toBeNull();
    await user.click(await screen.findByText('pano.jpg'));
    const back = await screen.findByTestId('imaging-back-btn');
    await user.click(back);
    await waitFor(() => expect(screen.getByText('Select an image to view')).not.toBeNull());
    // overlay itself stays mounted
    expect(screen.getByTestId('imaging-overlay')).not.toBeNull();
  });
});

describe('WorkspaceImagingOverlay — empty canvas (L1/L2)', () => {
  test('with zero images the canvas hosts an upload state, not the no-op "Select an image" prompt', async () => {
    global.fetch = mock(() => jsonResponse({ items: [], total: 0 })) as unknown as typeof fetch;
    render(
      React.createElement(WorkspaceImagingOverlay, {
        patientId: 'pat-1',
        branchId: 'br-1',
        currentVisitId: null,
        open: true,
        onClose: () => {},
      }),
      { wrapper: makeWrapper() },
    );
    await waitFor(() => expect(screen.getByTestId('imaging-empty-canvas')).not.toBeNull());
    expect(screen.queryByText('Select an image to view')).toBeNull();
  });
});
