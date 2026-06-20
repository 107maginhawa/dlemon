/**
 * HouseholdCard — PP-6 (ISSUE-040) interactivity: create / add / remove.
 *
 * Pins the write paths closed: the empty state creates a household (this patient =
 * guarantor), an existing household adds members (patient search → relationship)
 * and removes non-guarantor members. Asserts the wire body/URL each write sends.
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import React from 'react';
import { freshClientWithMutations, makeWrapper, jsonResponse } from '@/test-utils';
import { useOrgContextStore } from '@/stores/org-context.store';
import { HouseholdCard } from './household-card';

const PATIENT_ID = 'a0000000-0000-1000-8000-000000000001';
const HOUSEHOLD = {
  household: { id: 'hh-1', branchId: 'br-1', name: 'Santos Family', guarantorPatientId: PATIENT_ID, notes: null },
  members: [
    { id: 'm-1', householdId: 'hh-1', patientId: PATIENT_ID, relationship: 'self', isGuarantor: true },
    { id: 'm-2', householdId: 'hh-1', patientId: 'a0000000-0000-1000-8000-000000000002', relationship: 'child', isGuarantor: false },
  ],
};

const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; useOrgContextStore.setState({ branchId: null }); cleanup(); });

function renderCard(fetchImpl: Parameters<typeof mock>[0]) {
  global.fetch = mock(fetchImpl);
  const qc = freshClientWithMutations();
  render(React.createElement(HouseholdCard, { patientId: PATIENT_ID }), { wrapper: makeWrapper(qc) });
}

describe('HouseholdCard — create (empty state)', () => {
  test('creates a household with this patient as guarantor', async () => {
    useOrgContextStore.setState({ branchId: 'br-1' });
    const captured: { method?: string; url?: string; body?: Record<string, unknown> } = {};
    renderCard(async (req: Request | string | URL, init?: RequestInit) => {
      const url = req instanceof Request ? req.url : String(req);
      const method = req instanceof Request ? req.method : (init?.method ?? 'GET');
      if (method === 'POST' && url.endsWith('/dental/households')) {
        captured.method = method; captured.url = url;
        const raw = req instanceof Request ? await req.text() : (init?.body as string);
        captured.body = raw ? JSON.parse(raw) : undefined;
        return jsonResponse({ household: { ...HOUSEHOLD.household }, members: [] }, 201);
      }
      // GET household → 404 (not in a household)
      return Promise.resolve(new Response('not found', { status: 404 }));
    });

    await waitFor(() => expect(screen.getByTestId('create-household-btn')).not.toBeNull());
    fireEvent.click(screen.getByTestId('create-household-btn'));
    fireEvent.change(screen.getByTestId('household-name-input'), { target: { value: 'Santos Family' } });
    fireEvent.click(screen.getByTestId('create-household-submit'));

    await waitFor(() => expect(captured.body).toBeDefined());
    expect(captured.url).toContain('/dental/households');
    expect(captured.body).toMatchObject({ branchId: 'br-1', name: 'Santos Family', guarantorPatientId: PATIENT_ID });
  });
});

describe('HouseholdCard — add member', () => {
  test('searches a patient and adds them with a relationship', async () => {
    const captured: { method?: string; url?: string; body?: Record<string, unknown> } = {};
    renderCard(async (req: Request | string | URL, init?: RequestInit) => {
      const url = req instanceof Request ? req.url : String(req);
      const method = req instanceof Request ? req.method : (init?.method ?? 'GET');
      if (method === 'POST' && url.includes('/households/hh-1/members')) {
        captured.method = method; captured.url = url;
        const raw = req instanceof Request ? await req.text() : (init?.body as string);
        captured.body = raw ? JSON.parse(raw) : undefined;
        return jsonResponse({ id: 'm-3', householdId: 'hh-1', patientId: 'pt-new', relationship: 'spouse', isGuarantor: false }, 201);
      }
      if (method === 'GET' && url.includes('/dental/patients?') && url.includes('q=')) {
        // listDentalPatients returns a { data: [...] } envelope (the SDK transformer
        // does data.data.map) — NOT a bare array.
        return jsonResponse({ data: [{ id: 'pt-new', displayName: 'Maria Reyes', person: null, visitCount: 0, lastVisit: null, needsFollowUp: false, hasBalance: false, hasActivePaymentPlan: false, status: 'active' }] });
      }
      if (url.includes('/household')) return jsonResponse(HOUSEHOLD);
      return jsonResponse([]);
    });

    await waitFor(() => expect(screen.getByTestId('add-member-btn')).not.toBeNull());
    fireEvent.click(screen.getByTestId('add-member-btn'));
    fireEvent.change(screen.getByTestId('add-member-search'), { target: { value: 'Maria' } });
    await waitFor(() => expect(screen.getByTestId('add-member-opt-pt-new')).not.toBeNull());
    fireEvent.click(screen.getByTestId('add-member-opt-pt-new'));
    fireEvent.change(screen.getByTestId('add-member-relationship'), { target: { value: 'spouse' } });
    fireEvent.click(screen.getByTestId('add-member-submit'));

    await waitFor(() => expect(captured.body).toBeDefined());
    expect(captured.url).toContain('/dental/households/hh-1/members');
    expect(captured.body).toMatchObject({ patientId: 'pt-new', relationship: 'spouse' });
  });
});

describe('HouseholdCard — remove member', () => {
  test('removes a non-guarantor member; guarantor has no remove button', async () => {
    const captured: { method?: string; url?: string } = {};
    renderCard(async (req: Request | string | URL, init?: RequestInit) => {
      const url = req instanceof Request ? req.url : String(req);
      const method = req instanceof Request ? req.method : (init?.method ?? 'GET');
      if (method === 'DELETE' && url.includes('/households/hh-1/members/')) {
        captured.method = method; captured.url = url;
        return jsonResponse({ ok: true });
      }
      if (url.includes('/household')) return jsonResponse(HOUSEHOLD);
      return jsonResponse([]);
    });

    await waitFor(() => expect(screen.getByTestId('household-card')).not.toBeNull());
    // guarantor (self) has no remove button; the child member does
    expect(screen.queryByTestId(`remove-member-${PATIENT_ID}`)).toBeNull();
    const childId = 'a0000000-0000-1000-8000-000000000002';
    fireEvent.click(screen.getByTestId(`remove-member-${childId}`));

    await waitFor(() => expect(captured.url).toBeDefined());
    expect(captured.method).toBe('DELETE');
    expect(captured.url).toContain(`/dental/households/hh-1/members/${childId}`);
  });
});
