/**
 * PatientImageList — list-row UX (1.2 / N3 / N6)
 *
 * Renders the SHIPPED PatientImageList against a mocked fetch (same pattern as
 * workspace-imaging-overlay.test.ts — global.fetch, real hook) and asserts the
 * cold-start affordances:
 *   - 1.2: each row shows a dated thumbnail (img when downloadUrl, placeholder when null)
 *   - N3: the Compare button is always present, disabled until exactly 2 are selected
 *   - N6: the FMX toggle carries an explanatory tooltip
 */
import { describe, test, expect, afterEach, beforeEach, mock } from 'bun:test';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { freshClient, makeWrapper as makeWrapperBase, jsonResponse } from '@/test-utils';
import { PatientImageList } from './patient-image-list';

const originalFetch = global.fetch;

function makeWrapper() {
  return makeWrapperBase(freshClient());
}

function makeItem(id: string, fileName: string, downloadUrl: string | null, createdAt: string) {
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
    createdAt,
    downloadUrl,
    isDiagnostic: true,
    qualityStatus: 'ok',
    retakeReason: null,
    tags: [],
    links: [],
  };
}

beforeEach(() => {
  global.fetch = mock(() =>
    jsonResponse({
      items: [
        makeItem('ok', 'pano.jpg', 'https://s3.example/pano.jpg', '2025-03-04T00:00:00Z'),
        makeItem('broken', 'broken.jpg', null, '2025-03-05T00:00:00Z'),
      ],
      total: 2,
    }),
  ) as unknown as typeof fetch;
});

afterEach(() => {
  global.fetch = originalFetch;
  cleanup();
});

describe('PatientImageList — row affordances', () => {
  test('renders a thumbnail image for a row with a downloadUrl', async () => {
    render(<PatientImageList patientId="p-1" branchId="b-1" />, { wrapper: makeWrapper() });
    const thumb = await screen.findByTestId('thumb-ok');
    expect(thumb.tagName.toLowerCase()).toBe('img');
    expect(thumb.getAttribute('src')).toBe('https://s3.example/pano.jpg');
  });

  test('renders a placeholder (never an <img>) when downloadUrl is null', async () => {
    render(<PatientImageList patientId="p-1" branchId="b-1" />, { wrapper: makeWrapper() });
    const placeholder = await screen.findByTestId('thumb-placeholder-broken');
    expect(placeholder.tagName.toLowerCase()).not.toBe('img');
    // the broken row must NOT have rendered the filename as an <img src>
    expect(screen.queryByTestId('thumb-broken')).toBeNull();
  });

  test('shows the formatted capture date in each row', async () => {
    render(<PatientImageList patientId="p-1" branchId="b-1" />, { wrapper: makeWrapper() });
    await screen.findByTestId('thumb-ok');
    expect(screen.getByText(new Date('2025-03-04T00:00:00Z').toLocaleDateString())).not.toBeNull();
  });

  test('Compare button is always present and disabled until exactly 2 are selected', async () => {
    const user = userEvent.setup();
    const onCompare = mock(() => {});
    render(<PatientImageList patientId="p-1" branchId="b-1" onCompare={onCompare} />, {
      wrapper: makeWrapper(),
    });
    const compare = (await screen.findByTestId('compare-btn')) as HTMLButtonElement;
    expect(compare.disabled).toBe(true);
    expect(compare.textContent).toContain('select 2');

    await user.click(screen.getByTestId('select-image-ok'));
    await user.click(screen.getByTestId('select-image-broken'));

    await waitFor(() => expect((screen.getByTestId('compare-btn') as HTMLButtonElement).disabled).toBe(false));
    await user.click(screen.getByTestId('compare-btn'));
    expect(onCompare).toHaveBeenCalledTimes(1);
  });

  test('FMX toggle carries an explanatory tooltip', async () => {
    render(<PatientImageList patientId="p-1" branchId="b-1" />, { wrapper: makeWrapper() });
    const toggle = await screen.findByTestId('fmx-toggle');
    expect(toggle.getAttribute('title')).toBe('Full-mouth X-ray layout');
  });

  test('shows a count badge with the number of images next to the "Images" title', async () => {
    render(<PatientImageList patientId="p-1" branchId="b-1" />, { wrapper: makeWrapper() });
    const badge = await screen.findByTestId('image-count-badge');
    expect(badge.textContent).toBe('2');
  });
});

describe('PatientImageList — count badge hidden when empty', () => {
  test('does not render the count badge when there are no images', async () => {
    global.fetch = mock(() => jsonResponse({ items: [], total: 0 })) as unknown as typeof fetch;
    render(<PatientImageList patientId="p-1" branchId="b-1" />, { wrapper: makeWrapper() });
    await screen.findByText('No images yet');
    expect(screen.queryByTestId('image-count-badge')).toBeNull();
  });
});
