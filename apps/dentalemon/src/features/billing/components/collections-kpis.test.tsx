/**
 * CollectionsKpis (Phase 3.1) — AR KPI dashboard render.
 */
import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/react';
import React from 'react';
import { freshClient, makeWrapper, jsonResponse } from '@/test-utils';
import { CollectionsKpis } from './collections-kpis';

const BRANCH = 'b0000000-0000-1000-8000-0000000003a1';
const originalFetch = global.fetch;

const kpis = {
  asOf: '2026-06-19T00:00:00.000Z',
  outstandingArCents: 1250000,
  writeOffCents: 30000,
  billedTotalCents: 5000000,
  collectedTotalCents: 3750000,
  collectionRate: 0.75,
  dsoDays: 42,
  agingSeries: [
    { bucket: 'current', amountCents: 500000 },
    { bucket: 'days30', amountCents: 400000 },
    { bucket: 'days60', amountCents: 200000 },
    { bucket: 'days90Plus', amountCents: 150000 },
  ],
};

beforeEach(() => {
  global.fetch = (async () => jsonResponse(kpis)) as typeof fetch;
});
afterEach(() => { global.fetch = originalFetch; cleanup(); });

function renderKpis() {
  render(React.createElement(CollectionsKpis, { branchId: BRANCH }), { wrapper: makeWrapper(freshClient()) });
}

describe('CollectionsKpis', () => {
  test('renders the KPI cards with derived values', async () => {
    renderKpis();
    expect(await screen.findByTestId('kpi-ar')).toBeDefined();
    // collection rate 0.75 → 75%
    expect(screen.getByTestId('kpi-rate').textContent).toContain('75%');
    expect(screen.getByTestId('kpi-dso').textContent).toContain('42d');
  });

  test('renders an aging bar per bucket', async () => {
    renderKpis();
    await screen.findByTestId('kpi-aging-chart');
    expect(screen.getByTestId('kpi-bar-current')).toBeDefined();
    expect(screen.getByTestId('kpi-bar-days90Plus')).toBeDefined();
  });
});
