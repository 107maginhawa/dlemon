/**
 * Tests for AttachmentsSheet
 *
 * Covers: ATCH-01 (upload zone), ATCH-02 (file list + download), ATCH-03 (visit tab)
 */
import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { AttachmentsSheet } from './attachments-sheet';
import { makeWrapper } from '@/test-utils';

const originalFetch = global.fetch;
const emptyListResponse = () =>
  Promise.resolve(new Response(JSON.stringify({ data: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
const mockFetch = mock(emptyListResponse);

function renderSheet(props: Partial<React.ComponentProps<typeof AttachmentsSheet>> = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const defaultProps = {
    visitId: 'visit-1',
    patientId: 'pat-1',
    open: true,
    onClose: () => {},
  };
  return {
    qc,
    ...render(
      React.createElement(
        QueryClientProvider,
        { client: qc },
        React.createElement(AttachmentsSheet, { ...defaultProps, ...props }),
      ),
    ),
  };
}

describe('AttachmentsSheet', () => {
  beforeEach(() => {
    global.fetch = mockFetch as unknown as typeof fetch;
    mockFetch.mockReset();
    mockFetch.mockImplementation(emptyListResponse);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    cleanup();
    mockFetch.mockReset();
  });

  it('does not render when open=false', () => {
    renderSheet({ open: false });
    expect(screen.queryByTestId('attachments-sheet')).toBeNull();
  });

  it('renders sheet with header when open=true', async () => {
    renderSheet();
    expect(screen.getByRole('dialog', { name: /attachments/i })).not.toBeNull();
    expect(screen.getByText('Attachments')).not.toBeNull();
  });

  it('shows tab bar with This Visit and All tabs (ATCH-03)', async () => {
    renderSheet();
    expect(screen.getByTestId('tab-visit')).not.toBeNull();
    expect(screen.getByTestId('tab-all')).not.toBeNull();
  });

  it('shows upload zone in This Visit tab (ATCH-01)', async () => {
    renderSheet();
    expect(screen.getByTestId('upload-zone')).not.toBeNull();
  });

  it('shows image type chips (ATCH-01)', async () => {
    renderSheet();
    expect(screen.getByTestId('chip-xray')).not.toBeNull();
    expect(screen.getByTestId('chip-photo')).not.toBeNull();
    expect(screen.getByTestId('chip-document')).not.toBeNull();
  });

  it('hides upload zone when All tab selected', async () => {
    const user = userEvent.setup();
    renderSheet();
    await user.click(screen.getByTestId('tab-all'));
    expect(screen.queryByTestId('upload-zone')).toBeNull();
  });

  it('shows empty state when no attachments', async () => {
    renderSheet();
    await waitFor(() => expect(screen.getByTestId('empty-state')).not.toBeNull());
  });

  it('calls onClose when backdrop clicked', async () => {
    const user = userEvent.setup();
    const onClose = mock(() => {});
    renderSheet({ onClose });
    const backdrop = document.querySelector('[aria-hidden="true"]') as HTMLElement;
    await user.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when X button clicked', async () => {
    const user = userEvent.setup();
    const onClose = mock(() => {});
    renderSheet({ onClose });
    await user.click(screen.getByLabelText('Close attachments'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders attachment rows when data returned (ATCH-02)', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({
        data: [{
          id: 'att-1',
          visitId: 'visit-1',
          patientId: 'pat-1',
          imageType: 'xray',
          fileName: 'panoramic.jpg',
          filePath: 'file-abc',
          fileSizeBytes: 204800,
          mimeType: 'image/jpeg',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
          version: 1,
        }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );

    renderSheet();
    await waitFor(() => expect(screen.getByTestId('attachment-row-att-1')).not.toBeNull());
    expect(screen.getByText('panoramic.jpg')).not.toBeNull();
  });

  it('shows correct visit count in tab (ATCH-03)', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({
        data: [
          { id: 'att-1', visitId: 'visit-1', patientId: 'pat-1', imageType: 'xray', fileName: 'a.jpg', filePath: 'f1', fileSizeBytes: 1024, mimeType: 'image/jpeg', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', version: 1 },
          { id: 'att-2', visitId: 'visit-OTHER', patientId: 'pat-1', imageType: 'photo', fileName: 'b.jpg', filePath: 'f2', fileSizeBytes: 512, mimeType: 'image/jpeg', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', version: 1 },
        ],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );

    renderSheet({ visitId: 'visit-1' });
    await waitFor(() => {
      const visitTab = screen.getByTestId('tab-visit');
      // Visit 1 tab shows count=1, All tab shows count=2
      expect(visitTab.textContent).toContain('1');
    });
    const allTab = screen.getByTestId('tab-all');
    expect(allTab.textContent).toContain('2');
  });

  it('upload zone is disabled when visitId is null', async () => {
    renderSheet({ visitId: null });
    const zone = screen.getByTestId('upload-zone') as HTMLButtonElement;
    expect(zone.disabled).toBe(true);
  });
});
