import { describe, test, expect, afterEach, mock } from 'bun:test';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { CasePresentationView } from './case-presentation-view';
import type { CasePresentationAggregate } from './use-case-presentation';

function makeAggregate(
  overrides: Partial<CasePresentationAggregate> = {},
): CasePresentationAggregate {
  return {
    presentation: {
      id: 'p1', patientId: 'pat1', treatmentPlanId: 'plan1', status: 'viewed', decision: null,
      signerName: null, decisionAt: null, rejectionReason: null,
    },
    plan: { id: 'plan1', status: 'presented', totalEstimateCents: 0 },
    patientFirstName: 'Maria',
    phases: [
      {
        phase: 'disease_control',
        subtotalCents: 500000,
        items: [
          { id: 't1', toothNumber: 14, surfaces: null, description: 'Filling', cdtCode: 'D2391', status: 'planned', priceCents: 500000, optionGroupId: null, recommended: false },
        ],
      },
      {
        phase: 'definitive',
        subtotalCents: 2000000,
        items: [
          { id: 't2', toothNumber: 30, surfaces: null, description: 'Crown', cdtCode: 'D2740', status: 'planned', priceCents: 2000000, optionGroupId: null, recommended: false },
        ],
      },
    ],
    optionGroups: [
      {
        optionGroupId: 'og1',
        options: [
          { id: 'o1', toothNumber: 19, surfaces: null, description: 'Implant', cdtCode: 'D6010', status: 'diagnosed', priceCents: 4000000, optionGroupId: 'og1', recommended: true },
          { id: 'o2', toothNumber: 19, surfaces: null, description: 'Bridge', cdtCode: 'D6240', status: 'diagnosed', priceCents: 3000000, optionGroupId: 'og1', recommended: false },
        ],
      },
    ],
    images: [
      { id: 'img1', imageType: 'radiograph', toothNumber: 14, findingCount: 2 },
    ],
    grandTotalCents: 500000 + 2000000,
    ...overrides,
  };
}

const noop = () => {};

describe('CasePresentationView', () => {
  afterEach(() => cleanup());

  test('renders phases, ₱ subtotals, grand total, alternates with Recommended, images', () => {
    render(
      <CasePresentationView
        aggregate={makeAggregate()}
        isAccepting={false}
        isRejecting={false}
        onAccept={noop}
        onReject={noop}
      />,
    );
    expect(screen.getByText(/Maria, here is your treatment plan/)).not.toBeNull();
    expect(screen.getByText('Disease Control')).not.toBeNull();
    expect(screen.getByText('Definitive Care')).not.toBeNull();
    expect(screen.getByText('Implant')).not.toBeNull();
    expect(screen.getByText('Recommended')).not.toBeNull();
    expect(screen.getByText('radiograph')).not.toBeNull();
    expect(screen.getByText('2 findings')).not.toBeNull();
  });

  test('USD-leak regression: all money renders with ₱ (en-PH), never $ / USD', () => {
    const { container } = render(
      <CasePresentationView
        aggregate={makeAggregate()}
        isAccepting={false}
        isRejecting={false}
        onAccept={noop}
        onReject={noop}
      />,
    );
    const grand = screen.getByTestId('grand-total');
    expect(grand.textContent).toContain('₱');
    // No US dollar sign anywhere in the rendered money.
    expect(container.textContent).not.toContain('$');
    expect(container.textContent).not.toContain('USD');
  });

  test('reject requires explicit confirm (popover → confirm fires onReject)', async () => {
    const onReject = mock(noop);
    render(
      <CasePresentationView
        aggregate={makeAggregate()}
        isAccepting={false}
        isRejecting={false}
        onAccept={noop}
        onReject={onReject}
      />,
    );
    // Opening the popover does not reject by itself.
    fireEvent.click(screen.getByTestId('reject-btn'));
    expect(onReject).not.toHaveBeenCalled();
    // Confirm fires the reject.
    fireEvent.click(screen.getByTestId('reject-confirm-btn'));
    expect(onReject).toHaveBeenCalledTimes(1);
  });

  test('accept button is disabled before a signature stroke + name', () => {
    render(
      <CasePresentationView
        aggregate={makeAggregate()}
        isAccepting={false}
        isRejecting={false}
        onAccept={noop}
        onReject={noop}
      />,
    );
    const btn = screen.getByTestId('accept-sign-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  test('decided presentation shows a decision banner and hides the CTAs', () => {
    render(
      <CasePresentationView
        aggregate={makeAggregate({
          presentation: { id: 'p1', patientId: 'pat1', treatmentPlanId: 'plan1', status: 'accepted', decision: 'accepted', signerName: null, decisionAt: null, rejectionReason: null },
        })}
        isAccepting={false}
        isRejecting={false}
        onAccept={noop}
        onReject={noop}
      />,
    );
    expect(screen.getByTestId('decision-banner').textContent).toContain('accepted');
    expect(screen.queryByTestId('reject-btn')).toBeNull();
    expect(screen.queryByTestId('accept-sign-btn')).toBeNull();
  });
});
