/**
 * MedicalHistoryForm — integration-style component tests
 *
 * Uses a real QueryClient + mocked global.fetch (same pattern as hook tests).
 * Tests verify:
 *  - Loading spinner renders while fetch is pending
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
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { MedicalHistoryForm } from './medical-history-form';

afterEach(cleanup);

const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });

const PATIENT_ID = 'patient-form-test';

function freshClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function wrap(qc: QueryClient) {
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
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
  test('shows loading spinner while fetch is pending', () => {
    global.fetch = mock(() => new Promise(() => {}));
    renderForm();
    expect(document.querySelector('.animate-spin')).not.toBeNull();
  });

  test('shows error message on non-ok fetch', async () => {
    global.fetch = mock(() =>
      Promise.resolve({ ok: false, status: 500 } as Response),
    );
    renderForm();
    await waitFor(() =>
      expect(screen.queryByText(/Failed to load medical history/)).not.toBeNull(),
    );
  });

  test('renders all preset condition checkboxes after loading', async () => {
    global.fetch = mock(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve([]) } as Response),
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
      Promise.resolve({ ok: true, json: () => Promise.resolve([]) } as Response),
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
      Promise.resolve({ ok: true, json: () => Promise.resolve([]) } as Response),
    );
    renderForm();
    await waitFor(() =>
      expect(document.querySelector('[data-testid="surgical-history-textarea"]')).not.toBeNull(),
    );
  });

  test('renders pregnancy radio options after loading', async () => {
    global.fetch = mock(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve([]) } as Response),
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
      Promise.resolve({ ok: true, json: () => Promise.resolve([]) } as Response),
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
      Promise.resolve({ ok: true, json: () => Promise.resolve([mockEntry]) } as Response),
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
      Promise.resolve({ ok: true, json: () => Promise.resolve([inactiveEntry]) } as Response),
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

    global.fetch = mock((url: string, opts: any) => {
      requestCount++;
      if (opts?.method === 'POST') {
        capturedUrl = url;
        capturedMethod = opts.method;
        capturedBody = JSON.parse(opts.body);
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ...mockEntry, id: 'new-e', entryType: 'allergy', displayName: 'Penicillin' }),
        } as Response);
      }
      // GET request — return empty list
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) } as Response);
    });

    renderForm();
    await waitFor(() =>
      expect(document.querySelector('[data-testid="checkbox-penicillin"]')).not.toBeNull(),
    );

    await act(async () => {
      fireEvent.click(document.querySelector('[data-testid="checkbox-penicillin"]') as HTMLElement);
    });

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

    global.fetch = mock((url: string, opts: any) => {
      if (opts?.method === 'PATCH') {
        capturedPatchUrl = url;
        capturedPatchBody = JSON.parse(opts.body);
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ...penicillinEntry, active: false }),
        } as Response);
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([penicillinEntry]) } as Response);
    });

    renderForm();
    await waitFor(() => {
      const el = document.querySelector('[data-testid="checkbox-penicillin"]');
      return el?.getAttribute('aria-checked') === 'true';
    });

    await act(async () => {
      fireEvent.click(document.querySelector('[data-testid="checkbox-penicillin"]') as HTMLElement);
    });

    await waitFor(() => expect(capturedPatchUrl).toContain('/dental/clinical/medical-history/e-penic'));
    expect(capturedPatchBody.active).toBe(false);
  });
});

// ─── Save button ──────────────────────────────────────────────────────────────

describe('MedicalHistoryForm — save button', () => {
  test('save with text in surgical history textarea calls POST for procedure entry', async () => {
    const postBodies: any[] = [];

    global.fetch = mock((_url: string, opts: any) => {
      if (opts?.method === 'POST') {
        postBodies.push(JSON.parse(opts.body));
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ...mockEntry, id: 'new-e' }),
        } as Response);
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) } as Response);
    });

    renderForm();
    await waitFor(() =>
      expect(document.querySelector('[data-testid="surgical-history-textarea"]')).not.toBeNull(),
    );

    fireEvent.change(
      document.querySelector('[data-testid="surgical-history-textarea"]') as HTMLElement,
      { target: { value: 'Appendectomy 2020' } },
    );

    await act(async () => {
      fireEvent.click(document.querySelector('[data-testid="save-medical-history-btn"]') as HTMLElement);
    });

    await waitFor(() => expect(postBodies.length).toBeGreaterThan(0));
    const surgCall = postBodies.find((b) => b.entryType === 'procedure');
    expect(surgCall).toBeTruthy();
    expect(surgCall.displayName).toBe('Surgical History');
    expect(surgCall.notes).toBe('Appendectomy 2020');
  });

  test('save with pregnancy=pregnant calls POST for Pregnancy: Pregnant entry', async () => {
    const postBodies: any[] = [];

    global.fetch = mock((_url: string, opts: any) => {
      if (opts?.method === 'POST') {
        postBodies.push(JSON.parse(opts.body));
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ...mockEntry, id: 'new-e' }),
        } as Response);
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) } as Response);
    });

    renderForm();
    await waitFor(() =>
      expect(document.querySelector('[data-testid="pregnancy-pregnant"]')).not.toBeNull(),
    );

    fireEvent.click(document.querySelector('[data-testid="pregnancy-pregnant"]') as HTMLElement);

    await act(async () => {
      fireEvent.click(document.querySelector('[data-testid="save-medical-history-btn"]') as HTMLElement);
    });

    await waitFor(() => expect(postBodies.length).toBeGreaterThan(0));
    const pregCall = postBodies.find((b) => b.displayName?.startsWith('Pregnancy:'));
    expect(pregCall).toBeTruthy();
    expect(pregCall.displayName).toBe('Pregnancy: Pregnant');
  });
});
