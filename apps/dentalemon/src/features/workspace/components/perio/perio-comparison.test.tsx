/**
 * Render tests for PerioComparisonView (pure, props-driven — no network).
 */
import { describe, test, expect, afterEach } from 'bun:test';
import { render, screen, cleanup, within } from '@testing-library/react';
import React from 'react';
import { PerioComparisonView } from './perio-comparison';
import type { PerioChart } from '@monobase/sdk-ts/generated';

function reading(toothNumber: number, depths: Record<string, number>): any {
  return { id: `r-${toothNumber}`, chartId: 'c', toothNumber, ...depths };
}
function chart(over: Partial<PerioChart> & { id: string }): PerioChart {
  return {
    visitId: 'v', patientId: 'p', branchId: 'b', examinerMemberId: 'm', status: 'completed',
    readings: [], createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', ...over,
  } as PerioChart;
}

afterEach(cleanup);

const NEW = chart({
  id: 'new', completedAt: '2026-05-20T10:00:00Z',
  summaryBopPercent: 18, summaryMeanDepth: 2.8, summaryDeepPocketCount: 1,
  readings: [reading(16, { depthBM: 3, depthBD: 4 })],
});
const OLD = chart({
  id: 'old', completedAt: '2026-01-10T10:00:00Z',
  summaryBopPercent: 40, summaryMeanDepth: 3.5, summaryDeepPocketCount: 5,
  readings: [reading(16, { depthBM: 5, depthBD: 6 })],
});

describe('PerioComparisonView', () => {
  test('shows an insufficient-data state with fewer than two exams', () => {
    render(React.createElement(PerioComparisonView, { charts: [NEW] }));
    expect(screen.getByTestId('perio-comparison-insufficient')).not.toBeNull();
    expect(screen.queryByTestId('perio-comparison')).toBeNull();
  });

  test('renders the trend table + per-tooth grid for two exams', () => {
    render(React.createElement(PerioComparisonView, { charts: [NEW, OLD] }));
    expect(screen.getByTestId('perio-comparison')).not.toBeNull();
    // three headline metric rows
    expect(screen.getByTestId('summary-row-bop')).not.toBeNull();
    expect(screen.getByTestId('summary-row-meanDepth')).not.toBeNull();
    expect(screen.getByTestId('summary-row-deepPockets')).not.toBeNull();
    // newest BOP value shown
    const bop = screen.getByTestId('summary-row-bop');
    expect(within(bop).getByText('18%')).not.toBeNull();
    // per-tooth row for #16, newest max PD 4mm
    const t16 = screen.getByTestId('tooth-row-16');
    expect(within(t16).getByText('4mm')).not.toBeNull();
  });

  test('does NOT flag improving sites as worse (16 went 6mm → 4mm)', () => {
    render(React.createElement(PerioComparisonView, { charts: [NEW, OLD] }));
    const t16 = screen.getByTestId('tooth-row-16');
    // no cell in this row should carry the worsening marker
    expect(t16.querySelectorAll('[data-worse="true"]').length).toBe(0);
  });

  test('flags a worsening site in red', () => {
    const worseNew = chart({ id: 'wn', completedAt: '2026-06-01T00:00:00Z', readings: [reading(11, { depthBM: 6 })] });
    const worseOld = chart({ id: 'wo', completedAt: '2026-01-01T00:00:00Z', readings: [reading(11, { depthBM: 3 })] });
    render(React.createElement(PerioComparisonView, { charts: [worseNew, worseOld] }));
    const t11 = screen.getByTestId('tooth-row-11');
    expect(t11.querySelectorAll('[data-worse="true"]').length).toBe(1);
  });
});
