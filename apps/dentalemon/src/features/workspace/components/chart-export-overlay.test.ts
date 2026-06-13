/**
 * ChartExportOverlay — P0-B: fetches a visit's structured chart export and shows
 * it in a print-ready overlay. Written RED before implementation.
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/react';
import React from 'react';
import { freshClient, makeWrapper as makeWrapperBase } from '@/test-utils';
import { ChartExportOverlay } from './chart-export-overlay';

function makeWrapper() {
  return makeWrapperBase(freshClient());
}

const EXPORT = {
  patientId: 'pat-1', patientName: 'Maria Santos', visitId: 'visit-1',
  visitDate: '2026-06-10T09:00:00Z', visitStatus: 'active', branchId: 'b1',
  notation: 'FDI', generatedAt: '2026-06-10T10:00:00Z',
  teeth: [{ toothNumber: 16, state: 'filled', layer: 'completed' }],
  treatments: [], summary: { proposedCount: 0, completedCount: 1, declinedCount: 0, totalProposedCents: 0 },
  legend: [{ key: 'completed', label: 'Completed' }],
};

function installFetch() {
  const original = global.fetch;
  global.fetch = mock(async () =>
    new Response(JSON.stringify(EXPORT), { status: 200, headers: { 'Content-Type': 'application/json' } }),
  ) as unknown as typeof fetch;
  return () => { global.fetch = original; };
}

afterEach(cleanup);

describe('ChartExportOverlay', () => {
  test('renders nothing when closed', () => {
    render(React.createElement(ChartExportOverlay, { visitId: 'visit-1', open: false, onClose: () => {} }), { wrapper: makeWrapper() });
    expect(screen.queryByTestId('chart-export-overlay')).toBeNull();
  });

  test('when open, fetches and renders the structured export', async () => {
    const restore = installFetch();
    try {
      render(React.createElement(ChartExportOverlay, { visitId: 'visit-1', open: true, onClose: () => {} }), { wrapper: makeWrapper() });
      expect(await screen.findByTestId('chart-export-overlay')).toBeTruthy();
      expect(await screen.findByTestId('chart-export')).toBeTruthy();
      expect(screen.getByTestId('export-patient').textContent).toContain('Maria Santos');
      expect(screen.getByTestId('chart-export-print')).toBeTruthy();
    } finally { restore(); }
  });
});
