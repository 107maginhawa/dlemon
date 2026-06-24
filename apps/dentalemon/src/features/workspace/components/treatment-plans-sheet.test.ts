/**
 * TreatmentPlansSheet component tests
 *
 * Renders the SHIPPED TreatmentPlansSheet (real useTreatmentPlans +
 * useCasePresentations hooks) against a mocked fetch and exercises the
 * cold-start fixes:
 *   - drawer conversion keeps role="dialog" + data-testid="treatment-plans-sheet"
 *   - 1.1: the empty state offers a "New plan" create button; clicking it POSTs a
 *     draft plan with providerId resolved from org-context; disabled without one
 *   - N2: the draft→presented FSM transition reads "Mark presented" (not "Present")
 *   - N4: "Present to patient" is shown disabled (not hidden) for roles that can't
 *     present, with an explanatory title
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { TreatmentPlansSheet } from './treatment-plans-sheet';
import type { TreatmentPlanDoc } from '../hooks/use-treatment-plans';
import { useOrgContextStore } from '@/stores/org-context.store';

const PATIENT_ID = 'p-1';

function makePlan(overrides: Partial<TreatmentPlanDoc> = {}): TreatmentPlanDoc {
  return {
    id: 'plan-1',
    status: 'draft',
    createdAt: '2026-05-01T00:00:00.000Z',
    ...overrides,
  } as TreatmentPlanDoc;
}

/** GET (treatment-plans + case-presentations) → array; POST/PATCH → echo. */
function installFetch(plans: TreatmentPlanDoc[] = [], opts: { hangPost?: boolean } = {}) {
  const calls: Array<{ url: string; method: string; body: unknown }> = [];
  const original = global.fetch;
  global.fetch = mock(async (req: Request | string | URL, init?: RequestInit) => {
    const url = req instanceof Request ? req.url : String(req);
    const method = (req instanceof Request ? req.method : init?.method ?? 'GET').toUpperCase();
    const raw = req instanceof Request ? await req.clone().text() : (init?.body as string | undefined);
    calls.push({ url, method, body: raw ? JSON.parse(raw) : undefined });
    if (method === 'GET') {
      const list = url.includes('/treatment-plans') ? plans : [];
      return new Response(JSON.stringify(list), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (method === 'POST' && opts.hangPost) {
      return new Promise<Response>(() => {}); // never resolves → mutation stays pending
    }
    return new Response(JSON.stringify(makePlan({ id: 'plan-new' })), {
      status: method === 'POST' ? 201 : 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as unknown as typeof fetch;
  return { calls, restore: () => { global.fetch = original; } };
}

function renderSheet(props: Partial<React.ComponentProps<typeof TreatmentPlansSheet>> = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    React.createElement(
      QueryClientProvider,
      { client: qc },
      React.createElement(TreatmentPlansSheet, {
        patientId: PATIENT_ID,
        open: true,
        onClose: () => {},
        ...props,
      }),
    ),
  );
}

afterEach(() => {
  cleanup();
  useOrgContextStore.getState().clearContext();
});

describe('TreatmentPlansSheet — shipped component', () => {
  test('does not render when open=false', () => {
    const f = installFetch();
    try {
      renderSheet({ open: false });
      expect(screen.queryByTestId('treatment-plans-sheet')).toBeNull();
    } finally {
      f.restore();
    }
  });

  test('renders as a dialog with its testid preserved through the drawer conversion', async () => {
    const f = installFetch([]);
    try {
      renderSheet();
      await waitFor(() => expect(screen.getByTestId('treatment-plans-sheet')).not.toBeNull());
      expect(screen.getByRole('dialog')).not.toBeNull();
    } finally {
      f.restore();
    }
  });

  test('"Back to workspace" closes the modal', async () => {
    const user = userEvent.setup();
    const onClose = mock(() => {});
    const f = installFetch([]);
    try {
      renderSheet({ onClose });
      await user.click(await screen.findByTestId('treatment-plans-back-btn'));
      expect(onClose).toHaveBeenCalled();
    } finally {
      f.restore();
    }
  });

  test('1.1: empty state create button POSTs a draft plan with providerId from org-context', async () => {
    const user = userEvent.setup();
    useOrgContextStore.setState({ memberId: 'member-7', role: 'dentist_owner' });
    const f = installFetch([]);
    try {
      renderSheet();
      await waitFor(() => expect(screen.getByText(/No treatment plans/i)).not.toBeNull());
      await user.click(screen.getByTestId('treatment-plans-empty-new-btn'));
      await waitFor(() =>
        expect(f.calls.some((c) => c.method === 'POST' && c.url.includes('/treatment-plans'))).toBe(true),
      );
      const post = f.calls.find((c) => c.method === 'POST')!;
      expect((post.body as { providerId: string }).providerId).toBe('member-7');
    } finally {
      f.restore();
    }
  });

  test('1.1: create is disabled when no provider context is available', async () => {
    const f = installFetch([]);
    try {
      renderSheet();
      await waitFor(() => expect(screen.getByText(/No treatment plans/i)).not.toBeNull());
      expect((screen.getByTestId('treatment-plans-empty-new-btn') as HTMLButtonElement).disabled).toBe(true);
    } finally {
      f.restore();
    }
  });

  test('1.1: create button disables while the create mutation is pending', async () => {
    const user = userEvent.setup();
    useOrgContextStore.setState({ memberId: 'member-7', role: 'dentist_owner' });
    const f = installFetch([], { hangPost: true });
    try {
      renderSheet();
      await waitFor(() => expect(screen.getByText(/No treatment plans/i)).not.toBeNull());
      const btn = screen.getByTestId('treatment-plans-empty-new-btn') as HTMLButtonElement;
      await user.click(btn);
      await waitFor(() => expect((screen.getByTestId('treatment-plans-empty-new-btn') as HTMLButtonElement).disabled).toBe(true));
    } finally {
      f.restore();
    }
  });

  test('N2: a draft plan offers a "Mark presented" transition, not "Present"', async () => {
    useOrgContextStore.setState({ memberId: 'member-7', role: 'dentist_owner' });
    const f = installFetch([makePlan({ status: 'draft' })]);
    try {
      renderSheet();
      await waitFor(() => expect(screen.getByRole('button', { name: 'Mark presented' })).not.toBeNull());
      expect(screen.queryByRole('button', { name: 'Present' })).toBeNull();
    } finally {
      f.restore();
    }
  });

  test('N4: "Present to patient" renders disabled with a role hint for non-presenting roles', async () => {
    useOrgContextStore.setState({ memberId: 'member-7', role: 'front_desk' });
    const f = installFetch([makePlan({ status: 'presented' })]);
    try {
      renderSheet();
      const btn = (await screen.findByTestId('present-to-patient-btn')) as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
      expect(btn.getAttribute('title')).toMatch(/treatment-coordinator/i);
    } finally {
      f.restore();
    }
  });
});
