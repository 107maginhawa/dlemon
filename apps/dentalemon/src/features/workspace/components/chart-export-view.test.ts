/**
 * ChartExportView — P0-B structured chart export (print view).
 * Written RED before implementation.
 *
 * Coherence guard: the summary counts a reader sees must equal the number of
 * odontogram rows rendered on each layer (summary ≠ body bug class).
 */
import { describe, test, expect, afterEach } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/react';
import React from 'react';
import { ChartExportView } from './chart-export-view';
import type { ChartExport } from '@monobase/sdk-ts/generated';

const FIXTURE: ChartExport = {
  patientId: 'pat-1',
  patientName: 'Maria Santos',
  patientDateOfBirth: '1990-02-01',
  visitId: 'visit-1',
  visitDate: new Date('2026-06-10T09:00:00Z'),
  visitStatus: 'active',
  providerMemberId: 'mem-1',
  providerName: 'Dr. Cruz',
  branchId: 'branch-1',
  branchName: 'Main Branch',
  notation: 'FDI',
  generatedAt: new Date('2026-06-10T10:00:00Z'),
  teeth: [
    { toothNumber: 11, state: 'crown', layer: 'baseline', entryClassification: 'existing' },
    { toothNumber: 16, state: 'filled', layer: 'completed' },
    { toothNumber: 26, state: 'caries', layer: 'proposed', surfaces: ['mesial', 'occlusal'] },
    { toothNumber: 46, state: 'caries', layer: 'declined' },
  ],
  treatments: [
    { toothNumber: 16, cdtCode: 'D2740', description: 'Crown', status: 'performed', priceCents: 50000 },
    { toothNumber: 26, cdtCode: 'D2391', description: 'Composite', status: 'planned', priceCents: 15000 },
    { toothNumber: 46, cdtCode: 'D2750', description: 'Crown', status: 'declined', priceCents: 60000 },
  ],
  summary: { proposedCount: 1, completedCount: 1, declinedCount: 1, totalProposedCents: 15000 },
  legend: [
    { key: 'baseline', label: 'Existing / baseline' },
    { key: 'proposed', label: 'Proposed' },
    { key: 'completed', label: 'Completed' },
    { key: 'declined', label: 'Declined' },
  ],
};

afterEach(cleanup);

describe('ChartExportView', () => {
  test('renders the patient/provider/date header + FDI notation', () => {
    render(React.createElement(ChartExportView, { exportDoc: FIXTURE }));
    expect(screen.getByTestId('chart-export')).toBeTruthy();
    expect(screen.getByTestId('export-patient').textContent).toContain('Maria Santos');
    expect(screen.getByTestId('export-provider').textContent).toContain('Dr. Cruz');
    expect(screen.getByTestId('chart-export').textContent).toContain('FDI');
    // a generated timestamp is shown
    expect(screen.getByTestId('export-generated').textContent?.length).toBeGreaterThan(0);
  });

  test('renders one odontogram row per tooth and one row per treatment', () => {
    render(React.createElement(ChartExportView, { exportDoc: FIXTURE }));
    expect(screen.getAllByTestId('export-tooth-row').length).toBe(FIXTURE.teeth.length);
    expect(screen.getAllByTestId('export-treatment-row').length).toBe(FIXTURE.treatments.length);
    // surfaces render in the tooth/surface table
    const tooth26 = screen.getAllByTestId('export-tooth-row').find(r => r.textContent?.includes('26'));
    expect(tooth26?.textContent?.toLowerCase()).toContain('mesial');
  });

  test('renders the legend', () => {
    render(React.createElement(ChartExportView, { exportDoc: FIXTURE }));
    const legend = screen.getByTestId('export-legend');
    expect(legend.textContent).toContain('Proposed');
    expect(legend.textContent).toContain('Completed');
    expect(legend.textContent).toContain('Declined');
  });

  test('summary counts match the odontogram rows on each layer (coherence)', () => {
    render(React.createElement(ChartExportView, { exportDoc: FIXTURE }));
    const rows = screen.getAllByTestId('export-tooth-row');
    const onLayer = (layer: string) => rows.filter(r => r.getAttribute('data-layer') === layer).length;

    expect(Number(screen.getByTestId('export-completed-count').textContent)).toBe(onLayer('completed'));
    expect(Number(screen.getByTestId('export-proposed-count').textContent)).toBe(onLayer('proposed'));
    expect(Number(screen.getByTestId('export-declined-count').textContent)).toBe(onLayer('declined'));
  });
});
