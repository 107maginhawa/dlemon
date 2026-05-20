/**
 * PatientProfilePage — unit tests (PROF-01, PROF-02, PROF-03, PROF-04)
 *
 * Uses global.fetch mocking — no mock.module() to prevent process contamination.
 * @tanstack/react-router Link mock is in test-setup.ts.
 */
import { describe, test, expect, afterEach, beforeEach, mock } from 'bun:test';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { freshClient, makeWrapper, jsonResponse } from '@/test-utils';
import { PatientProfilePage } from '../components/patient-profile-page';
import type { Invoice } from '../hooks/use-patient-billing';
import type { Visit } from '@/features/workspace/hooks/use-visits';

// ── Fixtures ─────────────────────────────────────────────────────────────

const RAW_PROFILE = {
  id: 'p1',
  displayName: 'Russel Herrera',
  person: {
    firstName: 'Russel',
    lastName: 'Herrera',
    dateOfBirth: '1984-01-01',
    gender: 'Male',
    phone: '+63 917 555 1234',
    email: 'russel@email.com',
  },
  visitCount: 15,
  lastVisit: '2026-03-05',
  nextAppointment: null,
  hasBalance: false,
  hasActivePaymentPlan: false,
  balanceCents: 0,
  status: 'active',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const VISITS: Visit[] = [
  {
    id: 'v1',
    patientId: 'p1',
    status: 'completed',
    chiefComplaint: 'Tooth pain',
    createdAt: '2026-03-05T08:00:00Z',
    completedAt: '2026-03-05T10:00:00Z',
  },
  {
    id: 'v2',
    patientId: 'p1',
    status: 'completed',
    chiefComplaint: 'Routine cleaning',
    createdAt: '2026-01-10T08:00:00Z',
    completedAt: '2026-01-10T09:00:00Z',
  },
];

const INVOICES: Invoice[] = [
  {
    id: 'inv-1',
    invoiceNumber: 'INV-001',
    patientId: 'p1',
    visitDate: '2026-03-05',
    totalCents: 350000,
    paidCents: 350000,
    balanceCents: 0,
    status: 'paid',
    createdAt: '2026-03-05T10:00:00Z',
  },
];

const EMPTY_PAGINATION = {
  offset: 0, limit: 20, count: 0, totalCount: 0, totalPages: 1,
  currentPage: 1, hasNextPage: false, hasPreviousPage: false,
};

// ── Fetch router helper ───────────────────────────────────────────────────

function installFetch(opts: {
  profile?: object | null;
  invoices?: Invoice[];
  visits?: Visit[];
  profileError?: boolean;
} = {}) {
  const {
    profile = RAW_PROFILE,
    invoices = [],
    visits = [],
    profileError = false,
  } = opts;

  global.fetch = mock((url: string | Request) => {
    const urlStr = typeof url === 'string' ? url : url.url;
    if (urlStr.includes('follow-up-notes')) {
      return jsonResponse({ notes: [], total: 0 });
    }
    if (urlStr.includes('dental/visits') || urlStr.includes('/visits')) {
      return jsonResponse({ data: visits, pagination: EMPTY_PAGINATION });
    }
    if (urlStr.includes('billing/invoices') || urlStr.includes('dental/invoices')) {
      return jsonResponse({ data: invoices, total: invoices.length });
    }
    if (urlStr.includes('dental/patients')) {
      if (profileError) return Promise.resolve(new Response('Not Found', { status: 404 }));
      return jsonResponse(profile);
    }
    return jsonResponse({});
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('PatientProfilePage', () => {
  const originalFetch = global.fetch;

  beforeEach(() => installFetch());

  afterEach(() => {
    global.fetch = originalFetch;
    cleanup();
  });

  function renderPage(patientId = 'p1') {
    const qc = freshClient();
    render(React.createElement(PatientProfilePage, { patientId }), { wrapper: makeWrapper(qc) });
    return qc;
  }

  test('shows loading skeleton while data is pending', () => {
    global.fetch = mock(() => new Promise(() => {}));
    renderPage();
    expect(screen.getByTestId('profile-loading')).not.toBeNull();
  });

  test('PROF-01: renders patient name and demographics', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId('profile-name')).not.toBeNull());
    expect(screen.getByText(/Russel Herrera/i)).not.toBeNull();
    await waitFor(() => expect(document.body.textContent).toContain('Male'));
    expect(document.body.textContent).toContain('42');
  });

  test('PROF-01: renders contact info (phone and email)', async () => {
    renderPage();
    // Phone is rendered inside a <span> with an emoji sibling <span aria-hidden>📱</span>,
    // so getByText exact match fails — check body textContent instead.
    await waitFor(() =>
      expect(document.body.textContent).toContain('+63 917 555 1234'),
    );
    expect(document.body.textContent).toContain('russel@email.com');
  });

  test('PROF-01: renders visit count stat', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId('stat-visit-count')).not.toBeNull());
    expect(screen.getByText('15')).not.toBeNull();
  });

  test('PROF-02: renders recent visits in overview tab', async () => {
    installFetch({ visits: VISITS });
    renderPage();
    await waitFor(() => expect(screen.getByText('Tooth pain')).not.toBeNull());
    expect(screen.getByTestId('visit-history-section')).not.toBeNull();
    expect(screen.getByText('Routine cleaning')).not.toBeNull();
  });

  test('PROF-02: shows empty state when no visits', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId('no-visits-message')).not.toBeNull());
  });

  test('PROF-03: payment tab shows invoice rows', async () => {
    const user = userEvent.setup();
    installFetch({ invoices: INVOICES });
    renderPage();
    await waitFor(() => expect(screen.getByTestId('tab-payment')).not.toBeNull());
    await user.click(screen.getByTestId('tab-payment'));
    await waitFor(() => expect(screen.getByText('INV-001')).not.toBeNull());
    expect(screen.getByText('paid')).not.toBeNull();
    expect(screen.getAllByText(/3,500/).length).toBeGreaterThan(0);
  });

  test('PROF-04: renders back link to patients list', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId('back-to-patients')).not.toBeNull());
  });

  test('shows error message on profile fetch failure', async () => {
    installFetch({ profileError: true });
    renderPage();
    await waitFor(() => expect(screen.getByTestId('profile-error')).not.toBeNull());
  });
});
