/**
 * MedicalHistoryForm — integration-style component tests
 *
 * Uses a real QueryClient + mocked global.fetch (same pattern as hook tests).
 * Tests verify:
 *  - Loading skeleton renders while fetch is pending
 *  - Error state renders on non-ok fetch
 *  - Preset checkboxes render and reflect active state from loaded entries
 *  - Surgical history textarea renders
 *  - Pregnancy radio options render
 *  - Save button renders
 *  - Checkbox click calls POST (addEntry) or PATCH (toggleEntry)
 *  - Save button calls POST for new surgical history
 *  - Save button calls POST for pregnancy label
 */
import { describe, test, expect, mock, afterEach } from 'bun:test';
import { render, screen, waitFor, act, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { MedicalHistoryForm } from './medical-history-form';
import { freshClientWithMutations, makeWrapper as wrap, jsonResponse } from '@/test-utils';

afterEach(cleanup);

const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });

const PATIENT_ID = 'patient-form-test';

function freshClient() {
  return freshClientWithMutations();
}

function renderForm(qc = freshClient()) {
  return render(
    React.createElement(MedicalHistoryForm, { patientId: PATIENT_ID }),
    { wrapper: wrap(qc) },
  );
}

const mockEntry = {
  id: 'e1',
  patientId: PATIENT_ID,
  entryType: 'condition',
  displayName: 'Hypertension',
  code: 'I10',
  codeSystem: 'ICD-10',
  active: true,
  notes: null,
  onsetDate: null,
  resolvedDate: null,
  createdAt: '2026-05-01T00:00:00Z',
  updatedAt: '2026-05-01T00:00:00Z',
};

// ─── Rendering ────────────────────────────────────────────────────────────────

describe('MedicalHistoryForm — rendering', () => {
  test('shows loading skeleton while fetch is pending', () => {
    global.fetch = mock(() => new Promise(() => {}));
    renderForm();
    expect(screen.getByTestId('medical-history-loading')).not.toBeNull();
    // Skeleton primitive animates via animate-pulse placeholders.
    expect(document.querySelector('.animate-pulse')).not.toBeNull();
  });

  test('shows error message on non-ok fetch', async () => {
    global.fetch = mock(() =>
      jsonResponse({}, 500),
    );
    renderForm();
    await waitFor(() =>
      expect(screen.queryByText(/Failed to load medical history/)).not.toBeNull(),
    );
  });

  test('renders all preset condition checkboxes after loading', async () => {
    // SDK listMedicalHistoryResponseTransformer expects { data: [...] } shape
    global.fetch = mock(() =>
      jsonResponse({ data: [] }),
    );
    renderForm();
    await waitFor(() =>
      expect(document.querySelector('[data-testid="checkbox-diabetes"]')).not.toBeNull(),
    );
    expect(document.querySelector('[data-testid="checkbox-hypertension"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="checkbox-heart-disease"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="checkbox-asthma"]')).not.toBeNull();
  });

  test('renders all preset allergy checkboxes after loading', async () => {
    global.fetch = mock(() =>
      jsonResponse({ data: [] }),
    );
    renderForm();
    await waitFor(() =>
      expect(document.querySelector('[data-testid="checkbox-penicillin"]')).not.toBeNull(),
    );
    expect(document.querySelector('[data-testid="checkbox-latex"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="checkbox-aspirin"]')).not.toBeNull();
  });

  test('renders surgical history textarea after loading', async () => {
    global.fetch = mock(() =>
      jsonResponse({ data: [] }),
    );
    renderForm();
    await waitFor(() =>
      expect(document.querySelector('[data-testid="surgical-history-textarea"]')).not.toBeNull(),
    );
  });

  test('renders pregnancy radio options after loading', async () => {
    global.fetch = mock(() =>
      jsonResponse({ data: [] }),
    );
    renderForm();
    await waitFor(() =>
      expect(document.querySelector('[data-testid="pregnancy-not_applicable"]')).not.toBeNull(),
    );
    expect(document.querySelector('[data-testid="pregnancy-pregnant"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="pregnancy-breastfeeding"]')).not.toBeNull();
  });

  test('renders save button after loading', async () => {
    global.fetch = mock(() =>
      jsonResponse({ data: [] }),
    );
    renderForm();
    await waitFor(() =>
      expect(document.querySelector('[data-testid="save-medical-history-btn"]')).not.toBeNull(),
    );
  });
});

// ─── Checkbox active state from entries ───────────────────────────────────────

describe('MedicalHistoryForm — checkbox active state', () => {
  test('checkbox is aria-checked=true when matching active entry loaded', async () => {
    global.fetch = mock(() =>
      jsonResponse({ data: [mockEntry] }),
    );
    renderForm();
    await waitFor(() => {
      const el = document.querySelector('[data-testid="checkbox-hypertension"]');
      return el?.getAttribute('aria-checked') === 'true';
    });
    expect(
      document.querySelector('[data-testid="checkbox-hypertension"]')?.getAttribute('aria-checked'),
    ).toBe('true');
  });

  test('checkbox is aria-checked=false when entry is inactive', async () => {
    const inactiveEntry = { ...mockEntry, displayName: 'Diabetes Mellitus Type 2', code: 'E11', active: false };
    global.fetch = mock(() =>
      jsonResponse({ data: [inactiveEntry] }),
    );
    renderForm();
    await waitFor(() =>
      expect(document.querySelector('[data-testid="checkbox-diabetes"]')).not.toBeNull(),
    );
    expect(
      document.querySelector('[data-testid="checkbox-diabetes"]')?.getAttribute('aria-checked'),
    ).toBe('false');
  });
});

// ─── Checkbox interactions ────────────────────────────────────────────────────

describe('MedicalHistoryForm — checkbox interactions', () => {
  test('clicking unchecked checkbox (no existing entry) POSTs to create entry', async () => {
    let requestCount = 0;
    let capturedUrl = '';
    let capturedMethod = '';
    let capturedBody: any = null;

    global.fetch = mock((req: Request | string | URL, opts: any) => {
      const url = req instanceof Request ? req.url : String(req);
      const method = req instanceof Request ? req.method : (opts?.method ?? 'GET');
      requestCount++;
      if (method === 'POST') {
        capturedUrl = url;
        capturedMethod = method;
        if (req instanceof Request) {
          req.clone().text().then(t => { capturedBody = JSON.parse(t); });
        } else {
          capturedBody = JSON.parse(opts.body);
        }
        return jsonResponse({ ...mockEntry, id: 'new-e', entryType: 'allergy', displayName: 'Penicillin' });
      }
      // GET request — return empty list (SDK transformer expects { data: [...] })
      return jsonResponse({ data: [] });
    });

    renderForm();
    await waitFor(() =>
      expect(document.querySelector('[data-testid="checkbox-penicillin"]')).not.toBeNull(),
    );

    const user = userEvent.setup();
    await user.click(document.querySelector('[data-testid="checkbox-penicillin"]') as HTMLElement);

    await waitFor(() => expect(capturedMethod).toBe('POST'));
    expect(capturedUrl).toContain('/dental/clinical/medical-history');
    expect(capturedBody.entryType).toBe('allergy');
    expect(capturedBody.displayName).toBe('Penicillin');
    expect(capturedBody.patientId).toBe(PATIENT_ID);
  });

  test('clicking checked checkbox PATCHes active=false', async () => {
    let capturedPatchUrl = '';
    let capturedPatchBody: any = null;

    const penicillinEntry = {
      ...mockEntry,
      id: 'e-penic',
      entryType: 'allergy',
      displayName: 'Penicillin',
      code: '372687004',
      codeSystem: 'SNOMED',
      active: true,
    };

    global.fetch = mock((req: Request | string | URL, opts: any) => {
      const url = req instanceof Request ? req.url : String(req);
      const method = req instanceof Request ? req.method : (opts?.method ?? 'GET');
      if (method === 'PATCH') {
        capturedPatchUrl = url;
        if (req instanceof Request) {
          req.clone().text().then(t => { capturedPatchBody = JSON.parse(t); });
        } else {
          capturedPatchBody = JSON.parse(opts.body);
        }
        return jsonResponse({ ...penicillinEntry, active: false });
      }
      // GET request — SDK transformer expects { data: [...] }
      return jsonResponse({ data: [penicillinEntry] });
    });

    renderForm();
    await waitFor(() => {
      const el = document.querySelector('[data-testid="checkbox-penicillin"]');
      return el?.getAttribute('aria-checked') === 'true';
    });

    const user = userEvent.setup();
    await user.click(document.querySelector('[data-testid="checkbox-penicillin"]') as HTMLElement);

    await waitFor(() => expect(capturedPatchUrl).toContain('/dental/clinical/medical-history/e-penic'));
    expect(capturedPatchBody.active).toBe(false);
  });
});

// ─── Save button ──────────────────────────────────────────────────────────────

describe('MedicalHistoryForm — save button', () => {
  test('save with text in surgical history textarea calls POST for procedure entry', async () => {
    const postBodies: any[] = [];

    global.fetch = mock((req: Request | string | URL, opts: any) => {
      const method = req instanceof Request ? req.method : (opts?.method ?? 'GET');
      if (method === 'POST') {
        if (req instanceof Request) {
          req.clone().text().then(t => { postBodies.push(JSON.parse(t)); });
        } else {
          postBodies.push(JSON.parse(opts.body));
        }
        return jsonResponse({ ...mockEntry, id: 'new-e' });
      }
      // GET request — SDK transformer expects { data: [...] }
      return jsonResponse({ data: [] });
    });

    renderForm();
    await waitFor(() =>
      expect(document.querySelector('[data-testid="surgical-history-textarea"]')).not.toBeNull(),
    );

    const user = userEvent.setup();
    const textarea = document.querySelector('[data-testid="surgical-history-textarea"]') as HTMLElement;
    await user.clear(textarea);
    await user.type(textarea, 'Appendectomy 2020');

    await user.click(document.querySelector('[data-testid="save-medical-history-btn"]') as HTMLElement);

    await waitFor(() => expect(postBodies.length).toBeGreaterThan(0));
    const surgCall = postBodies.find((b) => b.entryType === 'procedure');
    expect(surgCall).not.toBeNull();
    expect(surgCall.displayName).toBe('Surgical History');
    expect(surgCall.notes).toBe('Appendectomy 2020');
  });

  test('save with pregnancy=pregnant calls POST for Pregnancy: Pregnant entry', async () => {
    const postBodies: any[] = [];

    global.fetch = mock((req: Request | string | URL, opts: any) => {
      const method = req instanceof Request ? req.method : (opts?.method ?? 'GET');
      if (method === 'POST') {
        if (req instanceof Request) {
          req.clone().text().then(t => { postBodies.push(JSON.parse(t)); });
        } else {
          postBodies.push(JSON.parse(opts.body));
        }
        return jsonResponse({ ...mockEntry, id: 'new-e' });
      }
      // GET request — SDK transformer expects { data: [...] }
      return jsonResponse({ data: [] });
    });

    renderForm();
    await waitFor(() =>
      expect(document.querySelector('[data-testid="pregnancy-pregnant"]')).not.toBeNull(),
    );

    const user = userEvent.setup();
    await user.click(document.querySelector('[data-testid="pregnancy-pregnant"]') as HTMLElement);

    await user.click(document.querySelector('[data-testid="save-medical-history-btn"]') as HTMLElement);

    await waitFor(() => expect(postBodies.length).toBeGreaterThan(0));
    const pregCall = postBodies.find((b) => b.displayName?.startsWith('Pregnancy:'));
    expect(pregCall).not.toBeNull();
    expect(pregCall.displayName).toBe('Pregnancy: Pregnant');
  });
});
