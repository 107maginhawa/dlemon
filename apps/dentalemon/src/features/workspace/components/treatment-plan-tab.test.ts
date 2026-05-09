/**
 * TreatmentPlanTab unit tests — TXPL-01, TXPL-02, TXPL-03
 *
 * Tests rendering for: loading, empty, grouped (diagnosed/planned), and cost summary.
 * Mocks the useTreatmentPlan hook to avoid real fetch calls.
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/react';
import React from 'react';

import type { TreatmentPlanData, TreatmentPlanItem } from '../hooks/use-treatment-plan';

// ── Mock the hook before importing the component ──────────────────────────
type MockReturn = {
  data: TreatmentPlanData | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<{ data: undefined; error: null }>;
};

let mockReturn: MockReturn = {
  data: null,
  isLoading: true,
  error: null,
  refetch: async () => ({ data: undefined, error: null }),
};

mock.module('../hooks/use-treatment-plan', () => ({
  useTreatmentPlan: () => mockReturn,
}));

// Import after mock is set
const { TreatmentPlanTab } = await import('./treatment-plan-tab');

// ── Fixtures ──────────────────────────────────────────────────────────────

const DIAGNOSED_ITEM: TreatmentPlanItem = {
  id: 'item-1',
  toothNumber: 14,
  cdtCode: 'D2160',
  description: 'Amalgam restoration, three or more surfaces',
  surfaces: ['M', 'O', 'D'],
  priceCents: 350000,
  status: 'diagnosed',
  conditionCode: null,
  visitId: 'visit-1',
  carriedOver: false,
};

const PLANNED_ITEM: TreatmentPlanItem = {
  id: 'item-2',
  toothNumber: 18,
  cdtCode: 'D7210',
  description: 'Extraction, erupted tooth requiring elevation',
  surfaces: null,
  priceCents: 120000,
  status: 'planned',
  conditionCode: null,
  visitId: 'visit-2',
  carriedOver: false,
};

function makeData(overrides: Partial<TreatmentPlanData> = {}): TreatmentPlanData {
  const treatments = overrides.treatments ?? [DIAGNOSED_ITEM, PLANNED_ITEM];
  return {
    patientId: 'patient-1',
    totalEstimateCents: treatments.reduce((s, t) => s + t.priceCents, 0),
    treatmentCount: treatments.length,
    toothCount: new Set(treatments.map((t) => t.toothNumber).filter(Boolean)).size,
    byTooth: {},
    treatments,
    ...overrides,
  };
}

afterEach(cleanup);

// ── Tests ─────────────────────────────────────────────────────────────────

describe('TreatmentPlanTab', () => {
  const props = { patientId: 'patient-1', branchId: 'branch-1' };

  test('renders loading skeleton while isLoading', () => {
    mockReturn = { data: null, isLoading: true, error: null, refetch: async () => ({ data: undefined, error: null }) };
    render(React.createElement(TreatmentPlanTab, props));
    expect(screen.getByTestId('treatment-plan-loading')).toBeTruthy();
  });

  test('renders empty state when no treatments', () => {
    mockReturn = { data: makeData({ treatments: [], treatmentCount: 0, toothCount: 0, totalEstimateCents: 0 }), isLoading: false, error: null, refetch: async () => ({ data: undefined, error: null }) };
    render(React.createElement(TreatmentPlanTab, props));
    expect(screen.getByTestId('treatment-plan-empty')).toBeTruthy();
    expect(screen.getByText(/No pending treatments/i)).toBeTruthy();
  });

  test('renders diagnosed group (TXPL-02)', () => {
    mockReturn = { data: makeData(), isLoading: false, error: null, refetch: async () => ({ data: undefined, error: null }) };
    render(React.createElement(TreatmentPlanTab, props));
    expect(screen.getByTestId('group-diagnosed')).toBeTruthy();
    expect(screen.getByText(/Diagnosed/i)).toBeTruthy();
  });

  test('renders planned group (TXPL-02)', () => {
    mockReturn = { data: makeData(), isLoading: false, error: null, refetch: async () => ({ data: undefined, error: null }) };
    render(React.createElement(TreatmentPlanTab, props));
    expect(screen.getByTestId('group-planned')).toBeTruthy();
    expect(screen.getByText(/Planned/i)).toBeTruthy();
  });

  test('renders correct treatment rows with CDT code and description', () => {
    mockReturn = { data: makeData(), isLoading: false, error: null, refetch: async () => ({ data: undefined, error: null }) };
    render(React.createElement(TreatmentPlanTab, props));
    const rows = screen.getAllByTestId('treatment-row');
    expect(rows.length).toBe(2);
    expect(screen.getByText('D2160')).toBeTruthy();
    expect(screen.getByText('D7210')).toBeTruthy();
  });

  test('renders cost summary with total estimate (TXPL-03)', () => {
    mockReturn = { data: makeData(), isLoading: false, error: null, refetch: async () => ({ data: undefined, error: null }) };
    render(React.createElement(TreatmentPlanTab, props));
    expect(screen.getByTestId('cost-summary')).toBeTruthy();
    // 350000 + 120000 = 470000 cents = 4700.00
    expect(screen.getByText(/4,700\.00/)).toBeTruthy();
  });

  test('does not render diagnosed group when no diagnosed treatments', () => {
    mockReturn = {
      data: makeData({ treatments: [PLANNED_ITEM], treatmentCount: 1, toothCount: 1, totalEstimateCents: PLANNED_ITEM.priceCents }),
      isLoading: false, error: null, refetch: async () => ({ data: undefined, error: null }),
    };
    render(React.createElement(TreatmentPlanTab, props));
    expect(screen.queryByTestId('group-diagnosed')).toBeNull();
    expect(screen.getByTestId('group-planned')).toBeTruthy();
  });

  test('does not render planned group when no planned treatments', () => {
    mockReturn = {
      data: makeData({ treatments: [DIAGNOSED_ITEM], treatmentCount: 1, toothCount: 1, totalEstimateCents: DIAGNOSED_ITEM.priceCents }),
      isLoading: false, error: null, refetch: async () => ({ data: undefined, error: null }),
    };
    render(React.createElement(TreatmentPlanTab, props));
    expect(screen.queryByTestId('group-planned')).toBeNull();
    expect(screen.getByTestId('group-diagnosed')).toBeTruthy();
  });

  test('renders error state on fetch failure', () => {
    mockReturn = { data: null, isLoading: false, error: new Error('Network error'), refetch: async () => ({ data: undefined, error: null }) };
    render(React.createElement(TreatmentPlanTab, props));
    expect(screen.getByTestId('treatment-plan-error')).toBeTruthy();
  });
});
