/**
 * PatientImageList component tests
 *
 * Covers: loading, error, empty, image items with modality, multi-select cap, compare button.
 *
 * Uses global.fetch mocking (no mock.module) to avoid contaminating use-imaging-studies hook tests.
 */
import { describe, test, expect, afterEach, beforeEach, mock } from 'bun:test';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { freshClient, makeWrapper as makeWrapperBase, jsonResponse } from '@/test-utils';
import { PatientImageList } from '../components/patient-image-list';

const originalFetch = global.fetch;

function makeWrapper() {
  return makeWrapperBase(freshClient());
}

const DEFAULT_PROPS = { patientId: 'pat-1', branchId: 'br-1' };

function makeItem(id: string, modality = 'periapical', source = 'imaging') {
  return {
    id,
    source,
    modality,
    fileName: `${id}.jpg`,
    mimeType: 'image/jpeg',
    fileSizeBytes: 2048,
    studyId: `s-${id}`,
    visitId: 'v-1',
    toothNumbers: [14],
    createdAt: '2025-01-01T00:00:00Z',
  };
}

beforeEach(() => {
  // Default: empty list
  global.fetch = mock(() => jsonResponse({ items: [], total: 0 }));
});

afterEach(() => {
  global.fetch = originalFetch;
  cleanup();
});

describe('PatientImageList', () => {
  test('shows loading text when loading', () => {
    // Never-resolving fetch keeps component in loading state
    global.fetch = mock(() => new Promise(() => {}));
    render(React.createElement(PatientImageList, DEFAULT_PROPS), { wrapper: makeWrapper() });
    expect(screen.getByText(/loading images/i)).not.toBeNull();
  });

  test('shows error message on error', async () => {
    global.fetch = mock(() =>
      Promise.resolve(new Response('Server Error', { status: 500 })),
    );
    render(React.createElement(PatientImageList, DEFAULT_PROPS), { wrapper: makeWrapper() });
    await waitFor(() => expect(screen.getByText(/failed to load/i)).not.toBeNull());
  });

  test('shows empty state when no items', async () => {
    render(React.createElement(PatientImageList, DEFAULT_PROPS), { wrapper: makeWrapper() });
    await waitFor(() => expect(screen.getByText(/no images yet/i)).not.toBeNull());
  });

  test('renders image items with modality badge', async () => {
    global.fetch = mock(() => jsonResponse({
      items: [makeItem('img-1', 'bitewing'), makeItem('img-2', 'panoramic')],
      total: 2,
    }));
    render(React.createElement(PatientImageList, DEFAULT_PROPS), { wrapper: makeWrapper() });
    await waitFor(() => expect(screen.getByText('img-1.jpg')).not.toBeNull());
    expect(screen.getByText('img-2.jpg')).not.toBeNull();
    expect(screen.getByText(/bitewing/i)).not.toBeNull();
    expect(screen.getByText(/panoramic/i)).not.toBeNull();
  });

  test('P2-5 FMX toggle switches the list to the anatomical mount', async () => {
    global.fetch = mock(() => jsonResponse({
      items: [makeItem('img-1', 'periapical')],
      total: 1,
    }));
    const user = userEvent.setup();
    render(React.createElement(PatientImageList, DEFAULT_PROPS), { wrapper: makeWrapper() });
    await waitFor(() => expect(screen.getByText('img-1.jpg')).not.toBeNull());

    // List view: no mount present yet
    expect(screen.queryByTestId('fmx-mount')).toBeNull();

    await user.click(screen.getByTestId('fmx-toggle'));
    await waitFor(() => expect(screen.getByTestId('fmx-mount')).not.toBeNull());
    // The flat list <ul> rows are gone in mount view
    expect(screen.queryByTestId('select-image-img-1')).toBeNull();
  });

  test('P2-7 renders a CBCT volume as a volume card (no flat row, no <img>)', async () => {
    global.fetch = mock(() => jsonResponse({
      items: [
        { ...makeItem('cbct-1', 'cbct'), isVolume: true, frameCount: 128, viewerKind: 'volume', studyId: 'study-1' },
      ],
      total: 1,
    }));
    const { container } = render(React.createElement(PatientImageList, DEFAULT_PROPS), { wrapper: makeWrapper() });
    await waitFor(() => expect(screen.getByTestId('cbct-study-card')).not.toBeNull());
    // Volume cards are NOT 2-D selectable and never an <img>.
    expect(screen.queryByTestId('select-image-cbct-1')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText(/128 slices/i)).not.toBeNull();
  });

  test('multi-select: 2 items shows Compare, 3rd is capped', async () => {
    global.fetch = mock(() => jsonResponse({
      items: [makeItem('a'), makeItem('b'), makeItem('c')],
      total: 3,
    }));
    const user = userEvent.setup();
    render(React.createElement(PatientImageList, DEFAULT_PROPS), { wrapper: makeWrapper() });
    await waitFor(() => expect(screen.getByTestId('select-image-a')).not.toBeNull());

    await user.click(screen.getByTestId('select-image-a'));
    await user.click(screen.getByTestId('select-image-b'));

    expect(screen.getByTestId('compare-btn')).not.toBeNull();

    await user.click(screen.getByTestId('select-image-c'));
    const cbox = screen.getByTestId('select-image-c') as HTMLInputElement;
    expect(cbox.checked).toBe(false);
  });

  test('compare button click calls onCompare with two selected items', async () => {
    global.fetch = mock(() => jsonResponse({
      items: [makeItem('x'), makeItem('y')],
      total: 2,
    }));
    const user = userEvent.setup();
    const onCompare = mock(() => {});
    render(
      React.createElement(PatientImageList, { ...DEFAULT_PROPS, onCompare }),
      { wrapper: makeWrapper() },
    );
    await waitFor(() => expect(screen.getByTestId('select-image-x')).not.toBeNull());

    await user.click(screen.getByTestId('select-image-x'));
    await user.click(screen.getByTestId('select-image-y'));
    await user.click(screen.getByTestId('compare-btn'));

    expect(onCompare).toHaveBeenCalledTimes(1);
    const args = onCompare.mock.calls[0] as unknown[];
    const pair = args[0] as Array<Record<string, unknown>>;
    expect(pair).toHaveLength(2);
    expect(pair[0]!.id).toBe('x');
    expect(pair[1]!.id).toBe('y');
  });
});
