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

// ── Batch B (FIX-004): consent history + revoke ─────────────────────────────
// WF-035 — consent revocation + a history view of signed/pending/revoked forms
// and informed refusals. The history list reads listConsentForms +
// listConsentRefusals; the Revoke action calls revokeConsentForm (PATCH) and is
// gated to PENDING (unsigned, un-revoked) forms AND to the caller's role
// (canRevoke), mirroring the dentist_owner/associate server gate.

const HISTORY_DATES = { createdAt: '2024-01-10T09:00:00Z', updatedAt: '2024-01-10T09:00:00Z' };

const HISTORY_FORMS = [
  { id: 'cf-pending', visitId: 'v-1', patientId: 'p-1', templateId: 't1', templateName: 'General Dental Consent', signed: false, revoked: false, ...HISTORY_DATES },
  { id: 'cf-signed', visitId: 'v-1', patientId: 'p-1', templateId: 't2', templateName: 'Tooth Extraction Consent', signed: true, revoked: false, signedAt: HISTORY_DATES.createdAt, ...HISTORY_DATES },
  { id: 'cf-revoked', visitId: 'v-1', patientId: 'p-1', templateId: 't3', templateName: 'Implant Surgery Consent', signed: false, revoked: true, revokedAt: HISTORY_DATES.createdAt, ...HISTORY_DATES },
];

const HISTORY_REFUSALS = [
  { id: 'ref-1', visitId: 'v-1', patientId: 'p-1', refusingMemberId: 'm-1', procedureDescription: 'Root canal on #36', refusalReason: 'Cost', patientAcknowledgement: 'Understood', refusedAt: HISTORY_DATES.createdAt, ...HISTORY_DATES },
];

// Method-aware fetch router: the bespoke installFetch() above keys only on URL
// substrings and would route GET /consents (list) into the create stub. This
// disambiguates by method so the history GETs and the revoke PATCH resolve.
function installHistoryFetch() {
  const calls: Array<{ url: string; method: string; body: unknown }> = [];
  const original = global.fetch;
  global.fetch = mock(async (req: Request | string | URL, init?: RequestInit) => {
    const url = req instanceof Request ? req.url : String(req);
    const method = (req instanceof Request ? req.method : init?.method ?? 'GET').toUpperCase();
    const raw = req instanceof Request ? await req.clone().text() : (init?.body as string | undefined);
    calls.push({ url, method, body: raw ? JSON.parse(raw) : undefined });
    const json = (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

    if (method === 'PATCH' && url.includes('/revoke')) {
      // Echo the revoked form (matches the handler's full-row response).
      const id = url.split('/consents/')[1]?.split('/revoke')[0];
      const form = HISTORY_FORMS.find(fm => fm.id === id) ?? HISTORY_FORMS[0];
      return json({ ...form, signed: false, revoked: true, revokedAt: HISTORY_DATES.createdAt });
    }
    if (method === 'GET' && url.includes('/consent-refusals')) {
      return json({ data: HISTORY_REFUSALS, pagination: { totalCount: HISTORY_REFUSALS.length } });
    }
    if (method === 'GET' && url.includes('/consents')) {
      return json({ data: HISTORY_FORMS, pagination: { offset: 0, limit: 50, count: HISTORY_FORMS.length, totalCount: HISTORY_FORMS.length } });
    }
    return json({ id: 'consent-x', visitId: 'v-1', signed: false, revoked: false, ...HISTORY_DATES }, 201);
  }) as unknown as typeof fetch;
  return { calls, restore: () => { global.fetch = original; } };
}

function renderHistorySheet(overrides: Partial<{ canRevoke: boolean; onSaved: () => void }> = {}) {
  return render(
    React.createElement(ConsentSheet, {
      visitId: 'v-1',
      patientId: 'p-1',
      currentMemberId: 'm-1',
      canRevoke: overrides.canRevoke ?? true,
      open: true,
      onClose: () => {},
      onSaved: overrides.onSaved,
    } as React.ComponentProps<typeof ConsentSheet>),
  );
}

describe('ConsentSheet — consent history + revoke (Batch B / FIX-004)', () => {
  test('History tab lists consent forms with status and informed refusals', async () => {
    const f = installHistoryFetch();
    try {
      renderHistorySheet();
      await userEvent.setup().click(screen.getByRole('tab', { name: /history/i }));

      // Forms render with their template names and derived statuses.
      await screen.findByText('General Dental Consent');
      expect(screen.getByTestId('consent-status-cf-pending').textContent).toMatch(/pending/i);
      expect(screen.getByTestId('consent-status-cf-signed').textContent).toMatch(/signed/i);
      expect(screen.getByTestId('consent-status-cf-revoked').textContent).toMatch(/revoked/i);

      // Refusals render in the same history view.
      expect(screen.getByText('Root canal on #36')).toBeTruthy();
    } finally {
      f.restore();
    }
  });

  test('Revoke action shows ONLY on pending forms (hidden on signed + revoked)', async () => {
    const f = installHistoryFetch();
    try {
      renderHistorySheet({ canRevoke: true });
      await userEvent.setup().click(screen.getByRole('tab', { name: /history/i }));
      await screen.findByText('General Dental Consent');

      const revokeButtons = screen.getAllByRole('button', { name: /revoke/i });
      expect(revokeButtons.length).toBe(1);
      // The single revoke button belongs to the pending form.
      expect(screen.getByRole('button', { name: /revoke general dental consent/i })).toBeTruthy();
      expect(screen.queryByRole('button', { name: /revoke tooth extraction consent/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /revoke implant surgery consent/i })).toBeNull();
    } finally {
      f.restore();
    }
  });

  test('clicking Revoke issues PATCH .../consents/{id}/revoke and refetches history', async () => {
    const onSaved = mock(() => {});
    const f = installHistoryFetch();
    try {
      renderHistorySheet({ canRevoke: true, onSaved });
      const user = userEvent.setup();
      await user.click(screen.getByRole('tab', { name: /history/i }));
      await screen.findByText('General Dental Consent');

      await user.click(screen.getByRole('button', { name: /revoke general dental consent/i }));

      await waitFor(() =>
        expect(f.calls.some(c => c.method === 'PATCH' && c.url.includes('/consents/cf-pending/revoke'))).toBe(true),
      );
      // History is refetched after a successful revoke (>= 2 GET /consents calls).
      await waitFor(() =>
        expect(f.calls.filter(c => c.method === 'GET' && /\/consents(\?|$)/.test(c.url)).length).toBeGreaterThanOrEqual(2),
      );
      await waitFor(() => expect(onSaved.mock.calls.length).toBeGreaterThanOrEqual(1));
    } finally {
      f.restore();
    }
  });

  test('Revoke is hidden for roles without revoke permission (canRevoke=false)', async () => {
    const f = installHistoryFetch();
    try {
      renderHistorySheet({ canRevoke: false });
      await userEvent.setup().click(screen.getByRole('tab', { name: /history/i }));
      await screen.findByText('General Dental Consent');

      // Pending form still renders, but no revoke affordance is offered.
      expect(screen.getByTestId('consent-status-cf-pending').textContent).toMatch(/pending/i);
      expect(screen.queryByRole('button', { name: /revoke/i })).toBeNull();
    } finally {
      f.restore();
    }
  });
});

// ── Batch E (FIX-009): clinic consent-template body wording (FR8.4b) ─────────
// dental-org owns the per-clinic consent templates ({ name, body, ... }). The
// picker must surface the clinic's configured `body` — the actual consent text
// the patient reads and signs — read-only when a template is selected, instead
// of dropping it. When the clinic has configured NONE, the picker falls back to
// generic name-only options with a nudge to configure real per-clinic wording.

const CLINIC_TEMPLATES = [
  { id: 'srv-1', name: 'Clinic Surgical Consent', body: 'I authorize Dr. Cruz to surgically extract tooth #48 under local anesthesia.' },
  { id: 'srv-2', name: 'Clinic Endo Consent', body: 'I consent to root canal therapy on the indicated tooth, including possible retreatment.' },
];

function renderWithTemplates(templates: Array<{ id: string; name: string; body?: string }>) {
  return render(
    React.createElement(ConsentSheet, {
      visitId: 'v-1',
      patientId: 'p-1',
      currentMemberId: 'm-1',
      open: true,
      onClose: () => {},
      templates,
    } as React.ComponentProps<typeof ConsentSheet>),
  );
}

describe('ConsentSheet — clinic template body wording (Batch E / FIX-009)', () => {
  test('selecting a clinic template surfaces its body as read-only consent wording', async () => {
    renderWithTemplates(CLINIC_TEMPLATES);
    const user = userEvent.setup();

    // Nothing rendered before a template is chosen.
    expect(screen.queryByTestId('consent-template-body')).toBeNull();

    await user.selectOptions(screen.getByLabelText(/select consent form template/i), 'srv-1');

    const panel = await screen.findByTestId('consent-template-body');
    expect(panel.textContent).toContain('surgically extract tooth #48');
    // Read-only reference — the wording is NOT an editable form field.
    expect(screen.queryByDisplayValue(/surgically extract tooth #48/)).toBeNull();
  });

  test('switching the selected template swaps the displayed wording', async () => {
    renderWithTemplates(CLINIC_TEMPLATES);
    const user = userEvent.setup();

    await user.selectOptions(screen.getByLabelText(/select consent form template/i), 'srv-1');
    expect((await screen.findByTestId('consent-template-body')).textContent).toContain('extract tooth #48');

    await user.selectOptions(screen.getByLabelText(/select consent form template/i), 'srv-2');
    await waitFor(() =>
      expect(screen.getByTestId('consent-template-body').textContent).toContain('root canal therapy'),
    );
    expect(screen.getByTestId('consent-template-body').textContent).not.toContain('extract tooth #48');
  });

  test('a clinic template with an empty body renders no wording panel', async () => {
    // Guard pin: `selectedTemplate?.body &&` must suppress the panel for ''
    // (body is a required string but can legitimately come back empty).
    renderWithTemplates([{ id: 'empty-1', name: 'Empty Body Template', body: '' }]);
    await userEvent.setup().selectOptions(
      screen.getByLabelText(/select consent form template/i),
      'empty-1',
    );
    expect(screen.queryByTestId('consent-template-body')).toBeNull();
  });

  test('generic fallback options (no body) show no wording panel', async () => {
    // No templates prop → hardcoded name-only fallback list.
    render(
      React.createElement(ConsentSheet, {
        visitId: 'v-1',
        patientId: 'p-1',
        currentMemberId: 'm-1',
        open: true,
        onClose: () => {},
      }),
    );
    await userEvent.setup().selectOptions(
      screen.getByLabelText(/select consent form template/i),
      'tpl-extraction',
    );
    expect(screen.queryByTestId('consent-template-body')).toBeNull();
  });

  test('shows a configure-in-settings nudge only when falling back to defaults', async () => {
    // Fallback (no clinic templates) → nudge present.
    const fallback = render(
      React.createElement(ConsentSheet, {
        visitId: 'v-1',
        patientId: 'p-1',
        currentMemberId: 'm-1',
        open: true,
        onClose: () => {},
      }),
    );
    const hint = screen.getByTestId('consent-template-fallback-hint');
    expect(hint.textContent).toMatch(/settings/i);
    expect(hint.textContent).toMatch(/consent forms/i);
    fallback.unmount();
    cleanup();

    // Clinic templates configured → no nudge.
    renderWithTemplates(CLINIC_TEMPLATES);
    expect(screen.queryByTestId('consent-template-fallback-hint')).toBeNull();
  });
});
