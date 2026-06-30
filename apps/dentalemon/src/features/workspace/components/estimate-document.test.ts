/**
 * EstimateDocument — Phase 2A. Presentational, print-ready estimate render.
 * Written RED before implementation.
 */
import { describe, test, expect, afterEach } from 'bun:test';
import { render, screen, cleanup, within } from '@testing-library/react';
import React from 'react';
import { EstimateDocument, type EstimateLineItem } from './estimate-document';

afterEach(cleanup);

const LINE_ITEMS: EstimateLineItem[] = [
  { toothNumber: 16, cdtCode: 'D2740', description: 'Crown — porcelain', priceCents: 1200000 },
  { toothNumber: null, cdtCode: 'D1110', description: 'Prophylaxis', priceCents: 150000 },
];

function renderDoc(overrides: Partial<React.ComponentProps<typeof EstimateDocument>> = {}) {
  return render(
    React.createElement(EstimateDocument, {
      estimateNo: 'DRAFT',
      date: '2026-06-30T08:00:00Z',
      patientName: 'Maria Santos',
      lineItems: LINE_ITEMS,
      totalCents: 1350000,
      ...overrides,
    }),
  );
}

describe('EstimateDocument', () => {
  test('renders patient name, estimate number and every line item', () => {
    renderDoc();
    const doc = screen.getByTestId('estimate-document');
    expect(doc.textContent).toContain('Maria Santos');
    expect(doc.textContent).toContain('DRAFT');
    expect(doc.textContent).toContain('Crown — porcelain');
    expect(doc.textContent).toContain('Prophylaxis');
    expect(screen.getAllByTestId('estimate-line-item')).toHaveLength(2);
  });

  test('shows the total formatted as pesos', () => {
    renderDoc();
    const total = screen.getByTestId('estimate-total');
    expect(total.textContent).toContain('₱13,500.00');
  });

  test('draft estimate shows an awaiting-approval signature block (no signature image)', () => {
    renderDoc();
    const sig = screen.getByTestId('estimate-signature-block');
    expect(sig.textContent?.toLowerCase()).toContain('awaiting');
    expect(within(sig).queryByRole('img')).toBeNull();
  });

  test('approved estimate renders the captured signature and signed date', () => {
    renderDoc({
      estimateNo: 'EST-0003',
      approved: true,
      signatureDataUrl: 'data:image/png;base64,SIGNATURE',
      signedAt: '2026-06-30T09:30:00Z',
    });
    const sig = screen.getByTestId('estimate-signature-block');
    expect(sig.textContent?.toLowerCase()).toContain('approved');
    const img = within(sig).getByRole('img') as HTMLImageElement;
    expect(img.src).toContain('data:image/png;base64,SIGNATURE');
    expect(screen.getByTestId('estimate-document').textContent).toContain('EST-0003');
  });
});
