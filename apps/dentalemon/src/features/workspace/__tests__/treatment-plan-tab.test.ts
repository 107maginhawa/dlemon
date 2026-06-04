/**
 * TreatmentPlanTab unit tests — TXPL-01, TXPL-02, TXPL-03
 *
 * Uses global.fetch mocking — no mock.module() to prevent process contamination.
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { freshClient, makeWrapper, jsonResponse } from '@/test-utils';
import { TreatmentPlanTab } from '../components/treatment-plan-tab';
import type { TreatmentPlanItem } from '../hooks/use-treatment-plan';

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

const PLAN_RESPONSE = {
  patientId: 'patient-1',
  totalEstimateCents: 470000,
  treatmentCount: 2,
  toothCount: 2,
  byTooth: {},
  treatments: [DIAGNOSED_ITEM, PLANNED_ITEM],
};

const PROPS = { patientId: 'patient-1', branchId: 'branch-1' };

// ── Tests ─────────────────────────────────────────────────────────────────

describe('TreatmentPlanTab', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    cleanup();
  });

  function renderTab(fetchImpl: () => unknown) {
    global.fetch = mock(fetchImpl as Parameters<typeof mock>[0]);
    const qc = freshClient();
    render(React.createElement(TreatmentPlanTab, PROPS), { wrapper: makeWrapper(qc) });
  }

  test('renders loading skeleton while isLoading', () => {
    renderTab(() => new Promise(() => {}));
    expect(screen.getByTestId('treatment-plan-loading')).not.toBeNull();
  });

  test('renders empty state when no treatments', async () => {
    renderTab(() => jsonResponse({ ...PLAN_RESPONSE, treatments: [], treatmentCount: 0, toothCount: 0, totalEstimateCents: 0 }));
    await waitFor(() => expect(screen.getByTestId('treatment-plan-empty')).not.toBeNull());
    expect(screen.getByText(/No pending treatments/i)).not.toBeNull();
  });

  test('renders diagnosed group (TXPL-02)', async () => {
    renderTab(() => jsonResponse(PLAN_RESPONSE));
    await waitFor(() => expect(screen.getByTestId('group-diagnosed')).not.toBeNull());
    expect(screen.getByText(/Diagnosed/i)).not.toBeNull();
  });

  test('renders planned group (TXPL-02)', async () => {
    renderTab(() => jsonResponse(PLAN_RESPONSE));
    await waitFor(() => expect(screen.getByTestId('group-planned')).not.toBeNull());
    expect(screen.getByText(/Planned/i)).not.toBeNull();
  });

  test('renders correct treatment rows with CDT code and description', async () => {
    renderTab(() => jsonResponse(PLAN_RESPONSE));
    await waitFor(() => expect(screen.getAllByTestId('treatment-row').length).toBe(2));
    expect(screen.getByText('D2160')).not.toBeNull();
    expect(screen.getByText('D7210')).not.toBeNull();
  });

  test('renders cost summary with total estimate (TXPL-03)', async () => {
    renderTab(() => jsonResponse(PLAN_RESPONSE));
    await waitFor(() => expect(screen.getByTestId('cost-summary')).not.toBeNull());
    expect(screen.getByText(/4,700\.00/)).not.toBeNull();
  });

  test('does not render diagnosed group when no diagnosed treatments', async () => {
    renderTab(() => jsonResponse({ ...PLAN_RESPONSE, treatments: [PLANNED_ITEM], treatmentCount: 1, toothCount: 1, totalEstimateCents: PLANNED_ITEM.priceCents }));
    await waitFor(() => expect(screen.getByTestId('group-planned')).not.toBeNull());
    expect(screen.queryByTestId('group-diagnosed')).toBeNull();
  });

  test('does not render planned group when no planned treatments', async () => {
    renderTab(() => jsonResponse({ ...PLAN_RESPONSE, treatments: [DIAGNOSED_ITEM], treatmentCount: 1, toothCount: 1, totalEstimateCents: DIAGNOSED_ITEM.priceCents }));
    await waitFor(() => expect(screen.getByTestId('group-diagnosed')).not.toBeNull());
    expect(screen.queryByTestId('group-planned')).toBeNull();
  });

  test('renders error state on fetch failure', async () => {
    renderTab(() => Promise.resolve(new Response('error', { status: 500 })));
    await waitFor(() => expect(screen.getByTestId('treatment-plan-error')).not.toBeNull());
  });

  // ── P1-18: clinical phase grouping ────────────────────────────────────────

  const URGENT_ITEM: TreatmentPlanItem = {
    ...DIAGNOSED_ITEM, id: 'urgent-1', cdtCode: 'D9110', description: 'Palliative pain relief',
    phase: 'systemic', priority: 0,
  };
  const CONTROL_ITEM: TreatmentPlanItem = {
    ...DIAGNOSED_ITEM, id: 'control-1', cdtCode: 'D2391', description: 'Caries control filling',
    phase: 'disease_control', priority: 1,
  };
  const DEFINITIVE_ITEM: TreatmentPlanItem = {
    ...PLANNED_ITEM, id: 'def-1', cdtCode: 'D2740', description: 'Crown',
    phase: 'definitive', priority: 0,
  };

  test('P1-18: groups by clinical phase when items carry a phase', async () => {
    renderTab(() => jsonResponse({
      ...PLAN_RESPONSE,
      treatments: [URGENT_ITEM, CONTROL_ITEM, DEFINITIVE_ITEM],
      treatmentCount: 3,
    }));
    await waitFor(() => expect(screen.getByTestId('group-phase-systemic')).not.toBeNull());
    expect(screen.getByTestId('group-phase-disease_control')).not.toBeNull();
    expect(screen.getByTestId('group-phase-definitive')).not.toBeNull();
    // status-grouped sections must NOT render in phase mode
    expect(screen.queryByTestId('group-diagnosed')).toBeNull();
    expect(screen.queryByTestId('group-planned')).toBeNull();
    expect(screen.getByText(/Phase 1 · Systemic/i)).not.toBeNull();
  });

  test('P1-18: falls back to status grouping when no phases set', async () => {
    renderTab(() => jsonResponse(PLAN_RESPONSE));
    await waitFor(() => expect(screen.getByTestId('group-diagnosed')).not.toBeNull());
    expect(screen.queryByTestId('group-phase-systemic')).toBeNull();
  });

  // ── J06 / Gap #14: clinical-phase ASSIGNMENT control ──────────────────────
  test('J06: each treatment row exposes a phase selector', async () => {
    renderTab(() => jsonResponse(PLAN_RESPONSE));
    await waitFor(() => expect(screen.getAllByTestId('phase-select').length).toBe(2));
  });

  test('J06: changing the phase selector PATCHes the treatment phase', async () => {
    const calls: Array<{ url: string; method?: string; body: Record<string, unknown> | undefined }> = [];
    global.fetch = mock((async (url: string, init?: RequestInit) => {
      calls.push({
        url,
        method: init?.method,
        body: init?.body ? JSON.parse(init.body as string) : undefined,
      });
      if (init?.method === 'PATCH') return jsonResponse({ ...DIAGNOSED_ITEM, phase: 'definitive' });
      return jsonResponse(PLAN_RESPONSE);
    }) as Parameters<typeof mock>[0]);
    const qc = freshClient();
    render(React.createElement(TreatmentPlanTab, PROPS), { wrapper: makeWrapper(qc) });

    await waitFor(() => expect(screen.getAllByTestId('phase-select').length).toBe(2));
    fireEvent.change(screen.getAllByTestId('phase-select')[0]!, {
      target: { value: 'definitive' },
    });

    await waitFor(() => {
      const patch = calls.find((c) => c.method === 'PATCH');
      expect(patch).toBeDefined();
      expect(patch!.url).toContain(`/treatments/${DIAGNOSED_ITEM.id}`);
      expect(patch!.body?.phase).toBe('definitive');
    });
  });
});
