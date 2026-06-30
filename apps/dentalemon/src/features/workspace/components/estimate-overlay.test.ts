/**
 * EstimateOverlay — Phase 2B/2C. Print-ready estimate overlay with in-person
 * e-signature approval. Written RED before implementation.
 *
 * The signature canvas is stubbed (happy-dom has no 2D context) so the
 * pointer-draw → toDataURL capture path can run.
 */
import { describe, test, expect, afterEach, beforeEach, mock } from 'bun:test';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { EstimateOverlay } from './estimate-overlay';
import type { TreatmentPlanItem } from '../hooks/use-treatment-plan';

const origGetContext = HTMLCanvasElement.prototype.getContext;
const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
const origSetPointerCapture = (HTMLElement.prototype as unknown as { setPointerCapture: unknown }).setPointerCapture;

beforeEach(() => {
  const ctxStub = { beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, clearRect() {} };
  (HTMLCanvasElement.prototype as unknown as { getContext: unknown }).getContext = () => ctxStub;
  (HTMLCanvasElement.prototype as unknown as { toDataURL: unknown }).toDataURL = () => 'data:image/png;base64,SIGNATURE';
  (HTMLElement.prototype as unknown as { setPointerCapture: unknown }).setPointerCapture = () => {};
});

afterEach(() => {
  (HTMLCanvasElement.prototype as unknown as { getContext: unknown }).getContext = origGetContext;
  (HTMLCanvasElement.prototype as unknown as { toDataURL: unknown }).toDataURL = origToDataURL;
  (HTMLElement.prototype as unknown as { setPointerCapture: unknown }).setPointerCapture = origSetPointerCapture;
  cleanup();
});

const PLAN: TreatmentPlanItem[] = [
  { id: 't1', toothNumber: 16, cdtCode: 'D2740', description: 'Crown', surfaces: [], priceCents: 1200000, status: 'planned', visitId: 'v-1', priority: 0 } as TreatmentPlanItem,
  { id: 't2', toothNumber: 11, cdtCode: 'D1110', description: 'Cleaning', surfaces: [], priceCents: 150000, status: 'diagnosed', visitId: 'v-1', priority: 0 } as TreatmentPlanItem,
  { id: 't3', toothNumber: 21, cdtCode: 'D2750', description: 'Declined crown', surfaces: [], priceCents: 999900, status: 'declined', visitId: 'v-1', priority: 0 } as TreatmentPlanItem,
];

function installFetch() {
  const calls: Array<{ url: string; method: string; body: unknown }> = [];
  const original = global.fetch;
  global.fetch = mock(async (req: Request | string | URL, init?: RequestInit) => {
    const url = req instanceof Request ? req.url : String(req);
    const method = (req instanceof Request ? req.method : init?.method ?? 'GET').toUpperCase();
    const raw = req instanceof Request ? await req.clone().text() : (init?.body as string | undefined);
    calls.push({ url, method, body: raw ? JSON.parse(raw) : undefined });
    const dates = { createdAt: '2026-06-30T09:00:00Z', updatedAt: '2026-06-30T09:00:00Z' };
    const json = (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
    // listConsentForms (GET) — no prior approval
    if (method === 'GET' && url.includes('/consents')) return json({ data: [] });
    if (url.includes('/sign')) return json({ id: 'consent-1', signed: true, signedAt: dates.createdAt, signatureData: 'data:image/png;base64,SIGNATURE', ...dates });
    if (url.includes('/treatment-plan/accept')) return json({ id: 'ver-9', version: 3, patientId: 'p-1', snapshot: {}, ...dates }, 201);
    // createConsentForm (POST .../consents)
    if (method === 'POST' && url.includes('/consents')) return json({ id: 'consent-1', visitId: 'v-1', signed: false, ...dates }, 201);
    return json({}, 200);
  }) as unknown as typeof fetch;
  return { calls, restore: () => { global.fetch = original; } };
}

function renderOverlay(overrides: Partial<React.ComponentProps<typeof EstimateOverlay>> = {}) {
  return render(
    React.createElement(EstimateOverlay, {
      open: true,
      onClose: () => {},
      patientId: 'p-1',
      branchId: 'b-1',
      visitId: 'v-1',
      patientName: 'Maria Santos',
      planItems: PLAN,
      version: 0,
      ...overrides,
    }),
  );
}

describe('EstimateOverlay — 2B render + print', () => {
  test('renders nothing when closed', () => {
    renderOverlay({ open: false });
    expect(screen.queryByTestId('estimate-overlay')).toBeNull();
  });

  test('renders the estimate document with planned + diagnosed items, excludes declined', () => {
    renderOverlay();
    expect(screen.getByTestId('estimate-document')).toBeTruthy();
    const items = screen.getAllByTestId('estimate-line-item');
    expect(items).toHaveLength(2);
    const doc = screen.getByTestId('estimate-document');
    expect(doc.textContent).toContain('Crown');
    expect(doc.textContent).toContain('Cleaning');
    expect(doc.textContent).not.toContain('Declined crown');
    // total = 12000.00 + 1500.00 = 13,500.00 (declined excluded)
    expect(screen.getByTestId('estimate-total').textContent).toContain('₱13,500.00');
  });

  test('Print button calls window.print()', () => {
    const printMock = mock(() => {});
    const orig = window.print;
    window.print = printMock as unknown as typeof window.print;
    try {
      renderOverlay();
      fireEvent.click(screen.getByTestId('estimate-print'));
      expect(printMock).toHaveBeenCalled();
    } finally {
      window.print = orig;
    }
  });
});

describe('EstimateOverlay — 2C approve & sign', () => {
  test('approve disabled with hint when there is no current visit', () => {
    renderOverlay({ visitId: null });
    const btn = screen.getByTestId('estimate-approve-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  test('sign flow: create + sign consent then accept plan linking the consent, shows approved state', async () => {
    const { calls, restore } = installFetch();
    try {
      renderOverlay();
      fireEvent.click(screen.getByTestId('estimate-approve-btn'));
      const canvas = await screen.findByLabelText(/signature canvas/i);
      fireEvent.pointerDown(canvas, { clientX: 5, clientY: 5, pointerId: 1 });
      fireEvent.pointerMove(canvas, { clientX: 20, clientY: 20, pointerId: 1 });
      fireEvent.pointerUp(canvas, { clientX: 20, clientY: 20, pointerId: 1 });

      const confirm = await screen.findByTestId('estimate-sign-confirm');
      await waitFor(() => expect((confirm as HTMLButtonElement).disabled).toBe(false));
      fireEvent.click(confirm);

      await waitFor(() => {
        const accept = calls.find((c) => c.url.includes('/treatment-plan/accept'));
        expect(accept).toBeTruthy();
        expect((accept!.body as { consentFormId?: string }).consentFormId).toBe('consent-1');
      });
      // approved signature surfaces in the document
      await waitFor(() => {
        const sig = screen.getByTestId('estimate-signature-block');
        expect(sig.textContent?.toLowerCase()).toContain('approved');
      });
    } finally {
      restore();
    }
  });
});
