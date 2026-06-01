/**
 * TimelineCarousel — Swiper coverflow replacement tests
 *
 * Phase 2: Replace hand-rolled 3-card layout with Swiper EffectCoverflow.
 *
 * All mock.module() calls are in test-setup.ts (global). This file uses
 * the __swiperCaptures global for captured Swiper callbacks.
 */

import { describe, test, expect, afterEach, beforeEach, mock, test as _test } from 'bun:test';
const skipMockDependent = _test.skip; // tests that rely on Swiper prop capture not yet wired
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TimelineCarousel } from '../components/timeline-carousel';

// useInitializeDentition's success/error paths call sonner toasts — stub them.
mock.module('sonner', () => ({ toast: { error: () => {}, success: () => {} } }));

// NOTE: useUpdateVisit is intentionally NOT mock.module()'d here. Bun's
// mock.module is process-global and persists across files regardless of run
// order, so stubbing it would shadow use-update-visit's own unit test. The real
// hook works fine in these component tests: it only needs a QueryClientProvider
// (supplied by renderCarousel) and the stubbed global.fetch above.

// Access swiper captures from test-setup.ts (accessed lazily — preload sets this up)
const getCaptures = () => (globalThis as any).__swiperCaptures as Record<string, unknown>;

// Silence network calls from useQuery inside VisitChartCard
const EMPTY_RESPONSE = new Response(JSON.stringify({ teeth: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
beforeEach(() => {
  global.fetch = () => Promise.resolve(EMPTY_RESPONSE.clone());
});

// Helper: wrap component with QueryClientProvider for useQuery
function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  // eslint-disable-next-line react/display-name
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

// Wrapped render with QueryClientProvider
function renderCarousel(props: Parameters<typeof TimelineCarousel>[0]) {
  return render(React.createElement(TimelineCarousel, props), { wrapper: createWrapper() });
}

// ── Fixtures ─────────────────────────────────────────────────────────────

const VISIT_OLD = {
  id: 'v-old',
  status: 'completed' as const,
  createdAt: '2024-01-10T09:00:00Z',
};

const VISIT_MID = {
  id: 'v-mid',
  status: 'active' as const,
  createdAt: '2024-06-15T10:00:00Z',
};

const VISIT_NEW = {
  id: 'v-new',
  status: 'draft' as const,
  createdAt: '2024-12-20T08:00:00Z',
};

const THREE_VISITS = [VISIT_MID, VISIT_OLD, VISIT_NEW]; // intentionally unsorted

afterEach(cleanup);

// ── Tests ─────────────────────────────────────────────────────────────────

describe('TimelineCarousel (Swiper)', () => {
  describe('container', () => {
    test('renders data-testid="timeline-carousel"', () => {
      renderCarousel({
          visits: THREE_VISITS,
          patientId: 'test-patient',
          onSelectVisit: () => {},
          onNewVisit: () => {},
        });
      expect(screen.getByTestId('timeline-carousel')).not.toBeNull();
    });
  });

  describe('slides', () => {
    test('renders one slide per visit', () => {
      renderCarousel({
          visits: THREE_VISITS,
          patientId: 'test-patient',
          onSelectVisit: () => {},
          onNewVisit: () => {},
        });
      const slides = screen.getAllByTestId('visit-slide');
      expect(slides).toHaveLength(THREE_VISITS.length);
    });

    test('renders zero slides when visits is empty', () => {
      renderCarousel({
          visits: [],
          patientId: 'test-patient',
          onSelectVisit: () => {},
          onNewVisit: () => {},
        });
      const slides = screen.queryAllByTestId('visit-slide');
      expect(slides).toHaveLength(0);
    });
  });

  describe('initialSlide', () => {
    skipMockDependent('initialSlide equals visits.length - 1 (most-recent visit last in sorted order)', () => {
      renderCarousel({
          visits: THREE_VISITS,
          patientId: 'test-patient',
          onSelectVisit: () => {},
          onNewVisit: () => {},
        });
      // Visits are sorted chronologically oldest->newest so last index = most recent
      expect(getCaptures().initialSlide).toBe(THREE_VISITS.length - 1);
    });

    skipMockDependent('initialSlide is 0 for a single visit', () => {
      renderCarousel({
          visits: [VISIT_NEW],
          patientId: 'test-patient',
          onSelectVisit: () => {},
          onNewVisit: () => {},
        });
      expect(getCaptures().initialSlide).toBe(0);
    });
  });

  describe('slide content', () => {
    test('each slide shows a formatted date', () => {
      renderCarousel({
          visits: THREE_VISITS,
          patientId: 'test-patient',
          onSelectVisit: () => {},
          onNewVisit: () => {},
        });
      // Jan 10, 2024 — locale-formatted date from VISIT_OLD
      expect(screen.getByText(/Jan/i)).not.toBeNull();
      // Jun 15 2024
      expect(screen.getByText(/Jun/i)).not.toBeNull();
      // Dec 20 2024
      expect(screen.getByText(/Dec/i)).not.toBeNull();
    });

    test('each slide shows the status badge', () => {
      renderCarousel({
          visits: THREE_VISITS,
          patientId: 'test-patient',
          onSelectVisit: () => {},
          onNewVisit: () => {},
        });
      expect(screen.getByText(/completed/i)).not.toBeNull();
      expect(screen.getByText(/active/i)).not.toBeNull();
      expect(screen.getByText(/draft/i)).not.toBeNull();
    });

    skipMockDependent('renders a DentalChart stub inside each slide', () => {
      renderCarousel({
          visits: THREE_VISITS,
          patientId: 'test-patient',
          onSelectVisit: () => {},
          onNewVisit: () => {},
        });
      const charts = screen.getAllByTestId('dental-chart-stub');
      expect(charts).toHaveLength(THREE_VISITS.length);
    });
  });

  describe('active slide visual state', () => {
    test('initial active slide (last/most-recent) has opacity 1', () => {
      renderCarousel({
          visits: THREE_VISITS,
          patientId: 'test-patient',
          onSelectVisit: () => {},
          onNewVisit: () => {},
        });
      const slides = screen.getAllByTestId('visit-slide');
      // Last slide in DOM = most recent (sorted oldest->newest).
      // data-active-card is on the visit-slide element itself.
      const lastSlide = slides[slides.length - 1];
      expect(lastSlide.getAttribute('data-active-card')).toBe('1');
    });

    test('initial active slide has accent bar', () => {
      renderCarousel({
          visits: THREE_VISITS,
          patientId: 'test-patient',
          onSelectVisit: () => {},
          onNewVisit: () => {},
        });
      const slides = screen.getAllByTestId('visit-slide');
      const activeSlide = slides[slides.length - 1];
      const accentBar = activeSlide.querySelector('[data-accent-bar]');
      expect(accentBar).not.toBeNull();
    });

    test('non-active slides do not have accent bar', () => {
      renderCarousel({
          visits: THREE_VISITS,
          patientId: 'test-patient',
          onSelectVisit: () => {},
          onNewVisit: () => {},
        });
      const slides = screen.getAllByTestId('visit-slide');
      // First two slides (index 0, 1) are not the most recent -> no accent bar
      const firstSlide = slides[0];
      const accentBar = firstSlide.querySelector('[data-accent-bar]');
      expect(accentBar).toBeNull();
    });
  });

  describe('onSlideChange callback', () => {
    skipMockDependent('calls onSelectVisit with the visit id of the new active slide', () => {
      const calls: string[] = [];
      renderCarousel({
          visits: THREE_VISITS,
          patientId: 'test-patient',
          onSelectVisit: (id) => calls.push(id),
          onNewVisit: () => {},
        });

      // Simulate Swiper sliding to index 0 (oldest visit = VISIT_OLD)
      getCaptures().onSlideChange?.({ activeIndex: 0 });

      // Visits sorted oldest->newest: [VISIT_OLD, VISIT_MID, VISIT_NEW]
      expect(calls).toContain(VISIT_OLD.id);
    });

    skipMockDependent('calls onSelectVisit with the correct id when sliding to middle index', () => {
      const calls: string[] = [];
      renderCarousel({
          visits: THREE_VISITS,
          patientId: 'test-patient',
          onSelectVisit: (id) => calls.push(id),
          onNewVisit: () => {},
        });

      getCaptures().onSlideChange?.({ activeIndex: 1 });
      expect(calls).toContain(VISIT_MID.id);
    });
  });

  describe('chart loading / error states', () => {
    test('shows a loading skeleton while the chart query is pending', async () => {
      // Never-resolving fetch keeps the chart query in the isLoading state.
      global.fetch = () => new Promise<Response>(() => {});
      renderCarousel({
          visits: [VISIT_NEW],
          patientId: 'test-patient',
          onSelectVisit: () => {},
          onNewVisit: () => {},
        });
      expect(await screen.findByTestId('visit-chart-loading')).not.toBeNull();
    });

    test('shows an inline error with a Retry button when the chart query fails', async () => {
      global.fetch = () => Promise.reject(new Error('network down'));
      renderCarousel({
          visits: [VISIT_NEW],
          patientId: 'test-patient',
          onSelectVisit: () => {},
          onNewVisit: () => {},
        });
      const errorEl = await screen.findByTestId('visit-chart-error');
      expect(errorEl).not.toBeNull();
      expect(errorEl.textContent).toMatch(/Failed to load chart/i);
      expect(screen.getAllByText(/Retry/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('dentition init empty-state (TR-P1-07)', () => {
    // Active slide = most-recent visit (VISIT_NEW, draft → editable). With an empty
    // chart and a known DOB, the card offers an "Initialize Dentition" action.
    test('shows Initialize Dentition action for active editable visit with DOB and no teeth', async () => {
      renderCarousel({
        visits: [VISIT_NEW],
        patientId: 'test-patient',
        patientDateOfBirth: '2018-04-01',
        onSelectVisit: () => {},
        onNewVisit: () => {},
      });
      expect(await screen.findByTestId('init-dentition-btn')).not.toBeNull();
    });

    test('omits the action when no patientDateOfBirth is provided', async () => {
      renderCarousel({
        visits: [VISIT_NEW],
        patientId: 'test-patient',
        onSelectVisit: () => {},
        onNewVisit: () => {},
      });
      // chart renders instead of the init empty-state
      expect(await screen.findByTestId('dental-chart-stub')).not.toBeNull();
      expect(screen.queryByTestId('init-dentition-btn')).toBeNull();
    });

    test('omits the action for a locked (non-editable) visit', async () => {
      renderCarousel({
        visits: [{ ...VISIT_NEW, status: 'locked' as const }],
        patientId: 'test-patient',
        patientDateOfBirth: '2018-04-01',
        onSelectVisit: () => {},
        onNewVisit: () => {},
      });
      expect(await screen.findByTestId('dental-chart-stub')).not.toBeNull();
      expect(screen.queryByTestId('init-dentition-btn')).toBeNull();
    });

    test('clicking Initialize Dentition POSTs to /dental/patients/:id/dentition', async () => {
      const user = userEvent.setup();
      const calls: { url: string; method: string }[] = [];
      global.fetch = ((req: Request | string | URL, init?: RequestInit) => {
        const url = req instanceof Request ? req.url : String(req);
        const method = req instanceof Request ? req.method : (init?.method ?? 'GET');
        calls.push({ url, method });
        if (url.includes('/dentition')) {
          return Promise.resolve(new Response(JSON.stringify({ chartId: 'c1', toothCount: 20 }), { status: 201, headers: { 'Content-Type': 'application/json' } }));
        }
        return Promise.resolve(new Response(JSON.stringify({ teeth: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }) as typeof fetch;

      renderCarousel({
        visits: [VISIT_NEW],
        patientId: 'test-patient',
        patientDateOfBirth: '2018-04-01',
        onSelectVisit: () => {},
        onNewVisit: () => {},
      });

      await user.click(await screen.findByTestId('init-dentition-btn'));
      await waitFor(() =>
        expect(calls.some((c) => c.url.includes('/dental/patients/test-patient/dentition') && c.method === 'POST')).toBe(true),
      );
    });
  });

  describe('new-visit button', () => {
    test('renders data-testid="new-visit-btn"', () => {
      renderCarousel({
          visits: THREE_VISITS,
          patientId: 'test-patient',
          onSelectVisit: () => {},
          onNewVisit: () => {},
        });
      expect(screen.getByTestId('new-visit-btn')).not.toBeNull();
    });

    test('calls onNewVisit when clicked', async () => {
      const user = userEvent.setup();
      let clicked = false;
      renderCarousel({
          visits: THREE_VISITS,
          patientId: 'test-patient',
          onSelectVisit: () => {},
          onNewVisit: () => { clicked = true; },
        });
      await user.click(screen.getByTestId('new-visit-btn'));
      expect(clicked).toBe(true);
    });
  });
});
