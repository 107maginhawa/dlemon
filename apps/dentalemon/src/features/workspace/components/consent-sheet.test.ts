/**
 * ConsentSheet component tests
 *
 * Renders the SHIPPED ConsentSheet and exercises its real wiring: the Save
 * button is gated on a captured signature, and a valid sign flow issues
 * createConsentForm → signConsentForm. Replaces the prior version, which
 * asserted a re-declared `validateConsentBeforeSign` helper that the real
 * component does not export (it inlines validation in handleSave).
 *
 * The signature canvas is stubbed (happy-dom has no 2D context) so the
 * pointer-draw → toDataURL capture path can run.
 */

import { describe, test, expect, afterEach, beforeEach, mock } from 'bun:test';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { ConsentSheet } from './consent-sheet';

// ── Canvas stubs ────────────────────────────────────────────────────────────
const origGetContext = HTMLCanvasElement.prototype.getContext;
const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
const origSetPointerCapture = (HTMLElement.prototype as any).setPointerCapture;

beforeEach(() => {
  const ctxStub: any = { beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, clearRect() {} };
  (HTMLCanvasElement.prototype as any).getContext = () => ctxStub;
  (HTMLCanvasElement.prototype as any).toDataURL = () => 'data:image/png;base64,SIGNATURE';
  (HTMLElement.prototype as any).setPointerCapture = () => {};
});

afterEach(() => {
  (HTMLCanvasElement.prototype as any).getContext = origGetContext;
  (HTMLCanvasElement.prototype as any).toDataURL = origToDataURL;
  (HTMLElement.prototype as any).setPointerCapture = origSetPointerCapture;
  cleanup();
});

function installFetch() {
  const calls: Array<{ url: string; method: string; body: unknown }> = [];
  const original = global.fetch;
  global.fetch = mock(async (req: Request | string | URL, init?: RequestInit) => {
    const url = req instanceof Request ? req.url : String(req);
    const method = (req instanceof Request ? req.method : init?.method ?? 'GET').toUpperCase();
    const raw = req instanceof Request ? await req.clone().text() : (init?.body as string | undefined);
    calls.push({ url, method, body: raw ? JSON.parse(raw) : undefined });
    const dates = { createdAt: '2024-01-10T09:00:00Z', updatedAt: '2024-01-10T09:00:00Z' };
    const json = (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
    if (url.includes('/sign')) return json({ id: 'consent-1', signed: true, ...dates });
    if (url.includes('/consent-refusals')) {
      return json({ id: 'refusal-1', visitId: 'v-1', refusedAt: dates.createdAt, ...dates }, 201);
    }
    return json({ id: 'consent-1', visitId: 'v-1', signed: false, ...dates }, 201);
  }) as unknown as typeof fetch;
  return { calls, restore: () => { global.fetch = original; } };
}

function renderSheet(overrides: Partial<{ onSaved: () => void; onClose: () => void; currentMemberId: string }> = {}) {
  return render(
    React.createElement(ConsentSheet, {
      visitId: 'v-1',
      patientId: 'p-1',
      currentMemberId: overrides.currentMemberId ?? 'm-1',
      open: true,
      onClose: overrides.onClose ?? (() => {}),
      onSaved: overrides.onSaved,
    }),
  );
}

async function captureSignature() {
  const canvas = screen.getByLabelText(/signature canvas/i);
  fireEvent.pointerDown(canvas, { clientX: 5, clientY: 5, pointerId: 1 });
  fireEvent.pointerMove(canvas, { clientX: 20, clientY: 20, pointerId: 1 });
  fireEvent.pointerUp(canvas, { clientX: 20, clientY: 20, pointerId: 1 });
}

describe('ConsentSheet — shipped component', () => {
  test('Save is gated on a captured signature', async () => {
    renderSheet();
    const save = screen.getByRole('button', { name: /save consent form to visit record/i });
    expect((save as HTMLButtonElement).disabled).toBe(true);

    await captureSignature();
    await waitFor(() =>
      expect(
        (screen.getByRole('button', { name: /save consent form to visit record/i }) as HTMLButtonElement)
          .disabled,
      ).toBe(false),
    );
  });

  test('signing issues createConsentForm then signConsentForm with the signature', async () => {
    const onSaved = mock(() => {});
    const f = installFetch();
    try {
      renderSheet({ onSaved });

      await userEvent.setup().selectOptions(
        screen.getByLabelText(/select consent form template/i),
        'tpl-extraction',
      );
      await captureSignature();

      const save = await screen.findByRole('button', { name: /save consent form to visit record/i });
      await waitFor(() => expect((save as HTMLButtonElement).disabled).toBe(false));
      await userEvent.setup().click(save);

      await waitFor(() => expect(f.calls.some(c => c.url.includes('/sign'))).toBe(true));
      // Create precedes sign, and the signature payload is sent.
      const create = f.calls.find(c => c.url.includes('/consents') && !c.url.includes('/sign'))!;
      const sign = f.calls.find(c => c.url.includes('/sign'))!;
      expect(create.method).toBe('POST');
      expect((create.body as { templateId: string }).templateId).toBe('tpl-extraction');
      expect((sign.body as { signatureData: string }).signatureData).toContain('SIGNATURE');
      await waitFor(() => expect(onSaved.mock.calls.length).toBe(1));
    } finally {
      f.restore();
    }
  });

  test('uses API-provided templates when passed (FR8.4b: no hardcoded legal text)', async () => {
    const f = installFetch();
    try {
      render(
        React.createElement(ConsentSheet, {
          visitId: 'v-1',
          patientId: 'p-1',
          currentMemberId: 'm-1',
          open: true,
          onClose: () => {},
          templates: [{ id: 'srv-tpl-1', name: 'Clinic Surgical Consent' }],
        }),
      );
      const user = userEvent.setup();

      // The configured clinic template appears; the hardcoded const options do not.
      expect(screen.getByRole('option', { name: 'Clinic Surgical Consent' })).toBeTruthy();
      expect(screen.queryByRole('option', { name: 'Tooth Extraction Consent' })).toBeNull();

      await user.selectOptions(screen.getByLabelText(/select consent form template/i), 'srv-tpl-1');
      await captureSignature();
      const save = await screen.findByRole('button', { name: /save consent form to visit record/i });
      await waitFor(() => expect((save as HTMLButtonElement).disabled).toBe(false));
      await user.click(save);

      await waitFor(() => expect(f.calls.some(c => c.url.includes('/sign'))).toBe(true));
      const create = f.calls.find(c => c.url.includes('/consents') && !c.url.includes('/sign'))!;
      expect((create.body as { templateId: string }).templateId).toBe('srv-tpl-1');
      expect((create.body as { templateName: string }).templateName).toBe('Clinic Surgical Consent');
    } finally {
      f.restore();
    }
  });

  test('createConsentForm sends structured content fields when filled (P1-3)', async () => {
    const f = installFetch();
    try {
      renderSheet();
      const user = userEvent.setup();

      await user.selectOptions(
        screen.getByLabelText(/select consent form template/i),
        'tpl-extraction',
      );
      await user.type(screen.getByLabelText(/nature of procedure/i), 'Surgical extraction');
      await user.type(screen.getByLabelText(/^risks$/i), 'Bleeding, dry socket');
      await user.type(screen.getByLabelText(/risks of non-treatment/i), 'Spreading infection');
      await captureSignature();

      const save = await screen.findByRole('button', { name: /save consent form to visit record/i });
      await waitFor(() => expect((save as HTMLButtonElement).disabled).toBe(false));
      await user.click(save);

      await waitFor(() => expect(f.calls.some(c => c.url.includes('/sign'))).toBe(true));
      const create = f.calls.find(c => c.url.includes('/consents') && !c.url.includes('/sign'))!;
      const body = create.body as Record<string, string>;
      expect(body.procedureNature).toBe('Surgical extraction');
      expect(body.risks).toBe('Bleeding, dry socket');
      expect(body.risksOfNonTreatment).toBe('Spreading infection');
    } finally {
      f.restore();
    }
  });
});

describe('ConsentSheet — informed refusal (P1-3)', () => {
  test('switching to refusal mode shows the refusal form', async () => {
    renderSheet();
    await userEvent.setup().click(screen.getByRole('tab', { name: /informed refusal/i }));
    expect(screen.getByLabelText(/treatment refused/i)).toBeTruthy();
    expect(screen.getByLabelText(/reason for refusal/i)).toBeTruthy();
    expect(screen.getByLabelText(/patient acknowledgement/i)).toBeTruthy();
  });

  test('recording a refusal POSTs to consent-refusals with attribution', async () => {
    const onSaved = mock(() => {});
    const f = installFetch();
    try {
      renderSheet({ onSaved });
      const user = userEvent.setup();

      await user.click(screen.getByRole('tab', { name: /informed refusal/i }));
      await user.type(screen.getByLabelText(/treatment refused/i), 'Extraction of #48');
      await user.type(screen.getByLabelText(/reason for refusal/i), 'Wants conservative care');
      await user.type(screen.getByLabelText(/patient acknowledgement/i), 'I understand the risks.');

      await user.click(screen.getByRole('button', { name: /record informed refusal to visit record/i }));

      await waitFor(() => expect(f.calls.some(c => c.url.includes('/consent-refusals'))).toBe(true));
      const refusal = f.calls.find(c => c.url.includes('/consent-refusals'))!;
      const body = refusal.body as Record<string, string>;
      expect(refusal.method).toBe('POST');
      expect(body.refusingMemberId).toBe('m-1');
      expect(body.procedureDescription).toBe('Extraction of #48');
      expect(body.refusalReason).toBe('Wants conservative care');
      expect(body.patientAcknowledgement).toBe('I understand the risks.');
      await waitFor(() => expect(onSaved.mock.calls.length).toBe(1));
    } finally {
      f.restore();
    }
  });
});
