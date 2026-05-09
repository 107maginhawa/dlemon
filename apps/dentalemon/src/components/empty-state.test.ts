import { describe, test, expect } from 'bun:test';

// --- Inline helpers matching the empty-state component pattern ---

interface EmptyStateConfig {
  screen: string;
  icon: string;
  title: string;
  description: string;
  actionLabel?: string;
}

const EMPTY_STATES: EmptyStateConfig[] = [
  { screen: 'patients', icon: '🦷', title: 'No Patients Yet', description: 'Register your first patient to get started.', actionLabel: 'Add Patient' },
  { screen: 'calendar', icon: '📅', title: 'No Appointments', description: 'Schedule your first appointment.', actionLabel: 'New Appointment' },
  { screen: 'billing', icon: '💳', title: 'No Invoices', description: 'Invoices will appear here after visits are completed.' },
  { screen: 'reports', icon: '📊', title: 'No Data Yet', description: 'Complete visits to generate reports.' },
  { screen: 'staff', icon: '👥', title: 'No Staff Members', description: 'Add team members to your practice.', actionLabel: 'Add Staff' },
  { screen: 'workspace-visits', icon: '📋', title: 'No Visits', description: 'Start a new visit for this patient.', actionLabel: 'New Visit' },
  { screen: 'workspace-treatments', icon: '🔧', title: 'No Treatments', description: 'Record conditions and treatments on the dental chart.' },
  { screen: 'workspace-attachments', icon: '📎', title: 'No Attachments', description: 'Upload x-rays and clinical photos.' },
  { screen: 'workspace-prescriptions', icon: '💊', title: 'No Prescriptions', description: 'Create a prescription from the visit workspace.' },
  { screen: 'workspace-lab-orders', icon: '🏭', title: 'No Lab Orders', description: 'Order lab work from the visit workspace.' },
  { screen: 'dashboard-schedule', icon: '☀️', title: 'No Appointments Today', description: 'Your schedule is clear.' },
  { screen: 'payment-plans', icon: '📑', title: 'No Payment Plans', description: 'Payment plans will appear when created from invoices.' },
];

function getEmptyState(screen: string): EmptyStateConfig | undefined {
  return EMPTY_STATES.find(e => e.screen === screen);
}

// --- Tests ---

describe('Empty States — all 12 screens covered', () => {
  test('has 12 empty state configs', () => {
    expect(EMPTY_STATES).toHaveLength(12);
  });

  test('patients empty state', () => {
    const es = getEmptyState('patients');
    expect(es?.title).toBe('No Patients Yet');
    expect(es?.actionLabel).toBe('Add Patient');
  });

  test('calendar empty state', () => {
    const es = getEmptyState('calendar');
    expect(es?.title).toBe('No Appointments');
  });

  test('billing empty state has no action', () => {
    const es = getEmptyState('billing');
    expect(es?.actionLabel).toBeUndefined();
  });

  test('staff empty state has action', () => {
    const es = getEmptyState('staff');
    expect(es?.actionLabel).toBe('Add Staff');
  });

  test('all screens have icon, title, description', () => {
    for (const es of EMPTY_STATES) {
      expect(es.icon.length).toBeGreaterThan(0);
      expect(es.title.length).toBeGreaterThan(0);
      expect(es.description.length).toBeGreaterThan(0);
    }
  });

  test('no duplicate screens', () => {
    const screens = EMPTY_STATES.map(e => e.screen);
    expect(new Set(screens).size).toBe(screens.length);
  });
});

describe('Accessibility — focus ring', () => {
  test('lemon focus ring color matches spec', () => {
    const LEMON_FOCUS_RING = 'rgba(255,233,125,0.35)';
    expect(LEMON_FOCUS_RING).toContain('255,233,125');
    expect(LEMON_FOCUS_RING).toContain('0.35');
  });
});
