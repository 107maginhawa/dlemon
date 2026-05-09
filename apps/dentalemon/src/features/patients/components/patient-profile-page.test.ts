/**
 * PatientProfilePage — unit tests (PROF-01, PROF-02, PROF-03, PROF-04)
 *
 * Mocks all hooks to test rendering logic in isolation.
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import React from 'react';
import type { PatientProfileData } from '../hooks/use-patient-profile';
import type { Visit } from '@/features/workspace/hooks/use-visits';
import type { Invoice } from '../hooks/use-patient-billing';

// ── Mock TanStack Router (Link needs RouterProvider) ────────────────────
mock.module('@tanstack/react-router', () => ({
  Link: ({ children, to, ...props }: { children: React.ReactNode; to: string; [key: string]: unknown }) =>
    React.createElement('a', { href: to, ...props }, children),
  useNavigate: () => () => {},
  useRouter: () => ({ isServer: false }),
}));

// ── Mock hooks before importing component ────────────────────────────────

type MockProfile = { data: PatientProfileData | null; isLoading: boolean; error: Error | null };
type MockVisits = { visits: Visit[]; isLoading: boolean; error: Error | null };
type MockBilling = { invoices: Invoice[]; isLoading: boolean; error: Error | null };

let mockProfile: MockProfile = { data: null, isLoading: true, error: null };
let mockVisits: MockVisits = { visits: [], isLoading: true, error: null };
let mockBilling: MockBilling = { invoices: [], isLoading: true, error: null };

mock.module('../hooks/use-patient-profile', () => ({
  usePatientProfile: () => mockProfile,
}));
mock.module('@/features/workspace/hooks/use-visits', () => ({
  useVisits: () => mockVisits,
}));
mock.module('../hooks/use-patient-billing', () => ({
  usePatientBilling: () => mockBilling,
}));

const { PatientProfilePage } = await import('./patient-profile-page');

// ── Fixtures ─────────────────────────────────────────────────────────────

const PROFILE: PatientProfileData = {
  id: 'p1',
  displayName: 'Russel Herrera',
  firstName: 'Russel',
  lastName: 'Herrera',
  dateOfBirth: '1984-01-01',
  age: 42,
  gender: 'Male',
  phone: '+63 917 555 1234',
  email: 'russel@email.com',
  visitCount: 15,
  lastVisit: new Date('2026-03-05'),
  nextAppointment: null,
  hasBalance: false,
  balanceCents: 0,
  status: 'active',
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

// ── Tests ─────────────────────────────────────────────────────────────────

describe('PatientProfilePage', () => {
  afterEach(() => {
    mockProfile = { data: null, isLoading: true, error: null };
    mockVisits = { visits: [], isLoading: true, error: null };
    mockBilling = { invoices: [], isLoading: true, error: null };
    cleanup();
  });

  test('shows loading skeleton while data is pending', () => {
    render(React.createElement(PatientProfilePage, { patientId: 'p1' }));
    expect(screen.getByTestId('profile-loading')).toBeTruthy();
  });

  test('PROF-01: renders patient name and demographics', () => {
    mockProfile = { data: PROFILE, isLoading: false, error: null };
    mockVisits = { visits: [], isLoading: false, error: null };
    mockBilling = { invoices: [], isLoading: false, error: null };

    render(React.createElement(PatientProfilePage, { patientId: 'p1' }));

    expect(screen.getByTestId('profile-name')).toBeTruthy();
    expect(screen.getByText(/Russel Herrera/i)).toBeTruthy();
    expect(screen.getByText(/Male/i)).toBeTruthy();
    expect(screen.getByText(/42/)).toBeTruthy();
  });

  test('PROF-01: renders contact info (phone and email)', () => {
    mockProfile = { data: PROFILE, isLoading: false, error: null };
    mockVisits = { visits: [], isLoading: false, error: null };
    mockBilling = { invoices: [], isLoading: false, error: null };

    render(React.createElement(PatientProfilePage, { patientId: 'p1' }));

    expect(screen.getByText('+63 917 555 1234')).toBeTruthy();
    expect(screen.getByText('russel@email.com')).toBeTruthy();
  });

  test('PROF-01: renders visit count stat', () => {
    mockProfile = { data: PROFILE, isLoading: false, error: null };
    mockVisits = { visits: [], isLoading: false, error: null };
    mockBilling = { invoices: [], isLoading: false, error: null };

    render(React.createElement(PatientProfilePage, { patientId: 'p1' }));

    expect(screen.getByTestId('stat-visit-count')).toBeTruthy();
    expect(screen.getByText('15')).toBeTruthy();
  });

  test('PROF-02: renders recent visits in overview tab', () => {
    mockProfile = { data: PROFILE, isLoading: false, error: null };
    mockVisits = { visits: VISITS, isLoading: false, error: null };
    mockBilling = { invoices: [], isLoading: false, error: null };

    render(React.createElement(PatientProfilePage, { patientId: 'p1' }));

    expect(screen.getByTestId('visit-history-section')).toBeTruthy();
    expect(screen.getByText('Tooth pain')).toBeTruthy();
    expect(screen.getByText('Routine cleaning')).toBeTruthy();
  });

  test('PROF-02: shows empty state when no visits', () => {
    mockProfile = { data: PROFILE, isLoading: false, error: null };
    mockVisits = { visits: [], isLoading: false, error: null };
    mockBilling = { invoices: [], isLoading: false, error: null };

    render(React.createElement(PatientProfilePage, { patientId: 'p1' }));

    expect(screen.getByTestId('no-visits-message')).toBeTruthy();
  });

  test('PROF-03: payment tab shows invoice rows', () => {
    mockProfile = { data: PROFILE, isLoading: false, error: null };
    mockVisits = { visits: [], isLoading: false, error: null };
    mockBilling = { invoices: INVOICES, isLoading: false, error: null };

    render(React.createElement(PatientProfilePage, { patientId: 'p1' }));

    fireEvent.click(screen.getByTestId('tab-payment'));

    expect(screen.getByText('INV-001')).toBeTruthy();
    expect(screen.getByText('paid')).toBeTruthy();
    // 350000 cents = 3,500
    expect(screen.getAllByText(/3,500/).length).toBeGreaterThan(0);
  });

  test('PROF-04: renders back link to patients list', () => {
    mockProfile = { data: PROFILE, isLoading: false, error: null };
    mockVisits = { visits: [], isLoading: false, error: null };
    mockBilling = { invoices: [], isLoading: false, error: null };

    render(React.createElement(PatientProfilePage, { patientId: 'p1' }));

    expect(screen.getByTestId('back-to-patients')).toBeTruthy();
  });

  test('shows error message on profile fetch failure', () => {
    mockProfile = { data: null, isLoading: false, error: new Error('Not found') };
    mockVisits = { visits: [], isLoading: false, error: null };
    mockBilling = { invoices: [], isLoading: false, error: null };

    render(React.createElement(PatientProfilePage, { patientId: 'p1' }));

    expect(screen.getByTestId('profile-error')).toBeTruthy();
  });
});
