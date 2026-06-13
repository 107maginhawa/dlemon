/**
 * AcceptedPlanViewer tests — case-presentation FIX-002 (GAP-1 signed-acceptance read-back;
 * also closes dental-visit GAP-3).
 *
 * Pins the read-back of the previously-write-only legal artifact: who signed, when,
 * the decision, and the immutable itemized plan that was accepted. Presentational +
 * props-driven (no network) — mirrors case-presentation-view.test.tsx conventions.
 */
import { describe, test, expect, afterEach } from 'bun:test';
import { render, screen, cleanup, within } from '@testing-library/react';
import React from 'react';
import { parseMoney, assertTotalExplainedByRows } from '@/test-utils';
import { AcceptedPlanViewer } from './accepted-plan-viewer';
import type { CasePresentationAggregate } from './use-case-presentation';

function makeAggregate(overrides: Partial<CasePresentationAggregate> = {}): CasePresentationAggregate {
  return {
    presentation: {
      id: 'p1', patientId: 'pat1', treatmentPlanId: 'plan1', status: 'accepted',
      decision: 'accepted', signerName: 'Maria Santos',
      decisionAt: '2026-06-11T08:30:00.000Z', rejectionReason: null,
    },
    plan: { id: 'plan1', status: 'approved', totalEstimateCents: 2500000 },
    patientFirstName: 'Maria',
    phases: [
      {
        phase: 'disease_control', subtotalCents: 500000,
        items: [{ id: 't1', toothNumber: 14, surfaces: null, description: 'Filling', cdtCode: 'D2391', status: 'planned', priceCents: 500000, optionGroupId: null, recommended: false }],
      },
      {
        phase: 'definitive', subtotalCents: 2000000,
        items: [{ id: 't2', toothNumber: 30, surfaces: null, description: 'Crown', cdtCode: 'D2740', status: 'planned', priceCents: 2000000, optionGroupId: null, recommended: false }],
      },
    ],
    optionGroups: [],
    images: [],
    grandTotalCents: 2500000,
    ...overrides,
  };
}

afterEach(() => cleanup());

describe('AcceptedPlanViewer', () => {
  test('renders the signed-acceptance record: signer, timestamp, accepted decision', () => {
    render(React.createElement(AcceptedPlanViewer, { aggregate: makeAggregate() }));
    expect(screen.getByTestId('accepted-plan-viewer')).not.toBeNull();
    const record = screen.getByTestId('accepted-plan-record');
    // WHO signed.
    expect(within(record).getByTestId('signer-name').textContent).toContain('Maria Santos');
    // WHEN (some rendered date — not the raw ISO string).
    const ts = within(record).getByTestId('decision-timestamp').textContent ?? '';
    expect(ts.length).toBeGreaterThan(0);
    expect(ts).not.toContain('2026-06-11T08:30:00.000Z');
    // The accepted decision is stated.
    expect(record.textContent?.toLowerCase()).toContain('accepted');
  });

  test('renders the immutable itemized plan that was accepted (phases + grand total)', () => {
    render(React.createElement(AcceptedPlanViewer, { aggregate: makeAggregate() }));
    expect(screen.getByText(/Filling/)).not.toBeNull();
    expect(screen.getByText(/Crown/)).not.toBeNull();
    // ₱25,000.00 grand total (2,500,000 cents) — what was signed for.
    expect(screen.getByTestId('grand-total').textContent).toContain('25,000');
    // Coherence guard (summary-vs-body bug class): the grand total must equal the
    // sum of the line-item prices actually rendered — derived from the DOM, not the
    // fixture, so a viewer that read a different total than it lists would fail.
    const viewer = screen.getByTestId('accepted-plan-viewer');
    const rowAmounts = Array.from(viewer.querySelectorAll('li span.tabular-nums')).map((el) =>
      parseMoney(el.textContent),
    );
    assertTotalExplainedByRows({
      total: parseMoney(screen.getByTestId('grand-total').textContent),
      rowAmounts,
      label: 'accepted plan total',
    });
  });

  test('renders a declined record with the rejection reason and timestamp', () => {
    render(React.createElement(AcceptedPlanViewer, {
      aggregate: makeAggregate({
        presentation: {
          id: 'p1', patientId: 'pat1', treatmentPlanId: 'plan1', status: 'rejected',
          decision: 'rejected', signerName: null,
          decisionAt: '2026-06-11T09:00:00.000Z', rejectionReason: 'Wants to defer the crown',
        },
      }),
    }));
    const record = screen.getByTestId('accepted-plan-record');
    expect(record.textContent?.toLowerCase()).toContain('declined');
    expect(within(record).getByText(/Wants to defer the crown/)).not.toBeNull();
  });

  test('shows an undecided state when the presentation has no decision yet', () => {
    render(React.createElement(AcceptedPlanViewer, {
      aggregate: makeAggregate({
        presentation: {
          id: 'p1', patientId: 'pat1', treatmentPlanId: 'plan1', status: 'viewed',
          decision: null, signerName: null, decisionAt: null, rejectionReason: null,
        },
      }),
    }));
    expect(screen.getByTestId('accepted-plan-undecided')).not.toBeNull();
    expect(screen.queryByTestId('accepted-plan-record')).toBeNull();
  });
});
