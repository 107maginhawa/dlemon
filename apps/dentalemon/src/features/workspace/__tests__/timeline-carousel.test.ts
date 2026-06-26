/**
 * TimelineCarousel — Swiper coverflow replacement tests
 *
 * Phase 2: Replace hand-rolled 3-card layout with Swiper EffectCoverflow.
 *
 * All mock.module() calls are in test-setup.ts (global). This file uses
 * the __swiperCaptures global for captured Swiper callbacks.
 */

import { describe, test, expect, afterEach, beforeEach, mock } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { render, screen, cleanup, waitFor, act } from '@testing-library/react';
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

    // Item 2: the carousel must not claim >~45% of screen height. The fixed
    // 560px slide is replaced by a viewport clamp in CSS and the carousel's own
    // vertical padding is reduced from py-4.
    test('carousel root uses reduced vertical padding (not py-4)', () => {
      renderCarousel({
          visits: THREE_VISITS,
          patientId: 'test-patient',
          onSelectVisit: () => {},
          onNewVisit: () => {},
        });
      const root = screen.getByTestId('timeline-carousel');
      expect(root.className).not.toContain('py-4');
    });

    test('globals.css clamps the swiper slide height to a viewport-relative value', () => {
      const css = readFileSync(
        resolvePath(import.meta.dir, '../../../styles/globals.css'),
        'utf8',
      );
      const swiperSlide = css.match(/\.dental-swiper \.swiper-slide \{[^}]*\}/);
      expect(swiperSlide).not.toBeNull();
      const block = swiperSlide![0];
      // No fixed 560px height; one consistent viewport-relative height for every
      // visit (~min(64vh,600px)) — fill-mode teeth scale to it, no per-visit resize.
      expect(block).not.toContain('560px');
      expect(block).toMatch(/min\(\s*64vh\s*,\s*600px\s*\)/);
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
    test('initialSlide equals visits.length - 1 (most-recent visit last in sorted order)', () => {
      renderCarousel({
          visits: THREE_VISITS,
          patientId: 'test-patient',
          onSelectVisit: () => {},
          onNewVisit: () => {},
        });
      // Visits are sorted chronologically oldest->newest so last index = most recent
      expect(getCaptures().initialSlide).toBe(THREE_VISITS.length - 1);
    });

    test('initialSlide is 0 for a single visit', () => {
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
      // Assert the per-visit status via the stable status-badge contract rather
      // than loose text — the header now also hosts layer tabs (Existing / Planned
      // / Completed / Declined) whose labels would otherwise collide with /completed/i.
      const statuses = screen
        .getAllByTestId('visit-status-badge')
        .map((el) => el.textContent);
      expect(statuses).toContain('completed');
      expect(statuses).toContain('active');
      expect(statuses).toContain('draft');
    });

    // CHART-XV: the active chart is cumulative (all visits); historical cards are
    // per-visit snapshots. Label the scope so the difference isn't misread as data loss.
    test('active card is labeled cumulative; historical cards are labeled snapshots', () => {
      renderCarousel({
          visits: THREE_VISITS,
          patientId: 'test-patient',
          onSelectVisit: () => {},
          onNewVisit: () => {},
        });
      const labels = screen.getAllByTestId('chart-scope-label').map((el) => el.textContent);
      expect(labels).toContain('Current — all visits');
      expect(labels.filter((t) => t === 'Visit snapshot').length).toBe(THREE_VISITS.length - 1);
    });

    test('renders a DentalChart stub inside each slide', async () => {
      renderCarousel({
          visits: THREE_VISITS,
          patientId: 'test-patient',
          onSelectVisit: () => {},
          onNewVisit: () => {},
        });
      // Each card fetches its chart via useQuery; the stub only appears once the
      // (empty) chart query resolves — wait for it rather than asserting on the
      // synchronous loading-skeleton frame.
      await waitFor(() =>
        expect(screen.getAllByTestId('dental-chart-stub')).toHaveLength(THREE_VISITS.length),
      );
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

    test('non-active slides are not marked active', () => {
      // The active card is distinguished via the stable `data-active-card`
      // contract (which drives its border + shadow styling). We assert that
      // contract rather than any decorative element or CSS class — only the
      // most-recent slide is marked active, the rest are not.
      renderCarousel({
          visits: THREE_VISITS,
          patientId: 'test-patient',
          onSelectVisit: () => {},
          onNewVisit: () => {},
        });
      const slides = screen.getAllByTestId('visit-slide');
      // First two slides (index 0, 1) are not the most recent -> not active.
      expect(slides[0].getAttribute('data-active-card')).toBeNull();
      expect(slides[slides.length - 1].getAttribute('data-active-card')).toBe('1');
    });
  });

  describe('onSlideChange callback', () => {
    test('calls onSelectVisit with the visit id of the new active slide', () => {
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

    test('calls onSelectVisit with the correct id when sliding to middle index', () => {
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

    // ── Item 5: solid, always-visible New Visit affordance ──────────────────
    test('enabled: full-opacity solid lemon button, not a faint opacity-60 dead tile', () => {
      renderCarousel({
        visits: THREE_VISITS,
        patientId: 'test-patient',
        onSelectVisit: () => {},
        onNewVisit: () => {},
        // no newVisitDisabledHint → enabled
      });
      const btn = screen.getByTestId('new-visit-btn');
      expect((btn as HTMLButtonElement).disabled).toBe(false);
      // solid inviting CTA in the lemon accent — never the faint resting opacity.
      expect(btn.className).toContain('bg-lemon');
      expect(btn.className).not.toContain('opacity-60');
      // legible tap target
      expect(btn.className).toContain('min-h-[44px]');
    });

    test('disabled: legible (not opacity-60) with the reason rendered ON-SURFACE', () => {
      renderCarousel({
        visits: THREE_VISITS,
        patientId: 'test-patient',
        onSelectVisit: () => {},
        onNewVisit: () => {},
        newVisitDisabledHint: 'Finish or discard the open visit to start a new one.',
      });
      const btn = screen.getByTestId('new-visit-btn');
      expect((btn as HTMLButtonElement).disabled).toBe(true);
      // distinct but legible — a muted surface, NOT the faint opacity-60/40 dead tile.
      expect(btn.className).not.toContain('opacity-60');
      expect(btn.className).not.toContain('opacity-40');
      expect(btn.className).toContain('bg-muted');
      // the reason is on-surface (visible text node), not hover/title-only.
      const hint = screen.getByTestId('new-visit-disabled-hint');
      expect(hint.textContent).toMatch(/finish or discard the open visit/i);
    });

    // Refined placement: New Visit only occupies the right gutter when the
    // most-recent card is centered. Initial render centers the last card → shown.
    test('shows the New Visit gutter on initial render (last/most-recent card centered)', () => {
      renderCarousel({
        visits: THREE_VISITS,
        patientId: 'test-patient',
        onSelectVisit: () => {},
        onNewVisit: () => {},
      });
      expect(screen.getByTestId('new-visit-gutter')).not.toBeNull();
    });

    // ...and is HIDDEN once an older card is centered (a newer card peeks right).
    test('hides New Visit when an older (non-last) card is centered', () => {
      renderCarousel({
        visits: THREE_VISITS,
        patientId: 'test-patient',
        onSelectVisit: () => {},
        onNewVisit: () => {},
      });
      // Slide to index 0 (oldest) — no longer the last card.
      act(() => {
        (getCaptures().onSlideChange as (s: { activeIndex: number }) => void)?.({ activeIndex: 0 });
      });
      expect(screen.queryByTestId('new-visit-gutter')).toBeNull();
      expect(screen.queryByTestId('new-visit-btn')).toBeNull();
    });
  });

  // ── P0-1: cumulative scope binds to the OPEN visit, not the centered card ──
  // THE BUG (provenance falsification): the cumulative "Current — all visits"
  // overlay + label were gated to whichever card is *centered* (isActive), not to
  // which visit is genuinely open. Centering an old Completed card relabeled it
  // "Current — all visits" and would attribute today's cumulative status to the
  // wrong, historical visit. Fix: bind the cumulative scope to the open visit
  // (status active|draft) — historical centered cards stay dated snapshots.

  describe('P0-1: cumulative scope binds to the open visit (provenance)', () => {
    // Exactly one open (active) visit, two historical completed snapshots.
    const H1 = { id: 'h1', status: 'completed' as const, createdAt: '2024-01-10T09:00:00Z' };
    const H2 = { id: 'h2', status: 'completed' as const, createdAt: '2024-03-10T09:00:00Z' };
    const OPEN = { id: 'open', status: 'active' as const, createdAt: '2024-06-15T10:00:00Z' };
    // Server order is arbitrary; sorted oldest→newest = [H1, H2, OPEN] (DOM order).
    const WITH_OPEN = [OPEN, H1, H2];

    test('the open visit owns "Current — all visits" on initial render', () => {
      renderCarousel({
        visits: WITH_OPEN,
        patientId: 'test-patient',
        openVisitId: 'open',
        onSelectVisit: () => {},
        onNewVisit: () => {},
      });
      const labels = screen.getAllByTestId('chart-scope-label').map((el) => el.textContent);
      // DOM/sorted order: [H1, H2, OPEN]
      expect(labels[2]).toBe('Current — all visits');
      expect(labels.filter((t) => t === 'Current — all visits')).toHaveLength(1);
    });

    test('centering a historical card does NOT relabel it "Current" — the open visit keeps it', () => {
      renderCarousel({
        visits: WITH_OPEN,
        patientId: 'test-patient',
        openVisitId: 'open',
        onSelectVisit: () => {},
        onNewVisit: () => {},
      });
      // Slide to the oldest historical completed card (index 0 = H1).
      act(() => {
        (getCaptures().onSlideChange as (s: { activeIndex: number }) => void)?.({ activeIndex: 0 });
      });
      const labels = screen.getAllByTestId('chart-scope-label').map((el) => el.textContent);
      // The centered historical card (H1) must remain a dated snapshot...
      expect(labels[0]).toBe('Visit snapshot');
      // ...and the genuine open visit keeps the cumulative label — never acquired
      // by centering a historical card.
      expect(labels[2]).toBe('Current — all visits');
      expect(labels.filter((t) => t === 'Current — all visits')).toHaveLength(1);
    });

    test('with no open visit, no card is labeled "Current — all visits" (all snapshots)', () => {
      renderCarousel({
        visits: [H1, H2],
        patientId: 'test-patient',
        openVisitId: undefined,
        onSelectVisit: () => {},
        onNewVisit: () => {},
      });
      const labels = screen.getAllByTestId('chart-scope-label').map((el) => el.textContent);
      expect(labels.every((t) => t === 'Visit snapshot')).toBe(true);
      expect(labels.filter((t) => t === 'Current — all visits')).toHaveLength(0);
    });
  });

  // ── P1-14: Compare affordance ───────────────────────────────────────────
  // RED: compare button and overlay do not yet exist — tests will fail until
  // the compare feature is implemented in timeline-carousel.tsx.

  describe('compare affordance (P1-14)', () => {
    test('renders a Compare button when there are at least 2 visits', () => {
      renderCarousel({
        visits: THREE_VISITS,
        patientId: 'test-patient',
        onSelectVisit: () => {},
        onNewVisit: () => {},
      });
      expect(screen.getByTestId('compare-btn')).not.toBeNull();
    });

    test('does NOT render a Compare button when there is only 1 visit', () => {
      renderCarousel({
        visits: [VISIT_NEW],
        patientId: 'test-patient',
        onSelectVisit: () => {},
        onNewVisit: () => {},
      });
      expect(screen.queryByTestId('compare-btn')).toBeNull();
    });

    test('clicking Compare opens the compare overlay', async () => {
      const user = userEvent.setup();
      renderCarousel({
        visits: THREE_VISITS,
        patientId: 'test-patient',
        onSelectVisit: () => {},
        onNewVisit: () => {},
      });
      await user.click(screen.getByTestId('compare-btn'));
      expect(screen.getByTestId('compare-overlay')).not.toBeNull();
    });

    test('compare overlay shows a reference visit selector', async () => {
      const user = userEvent.setup();
      renderCarousel({
        visits: THREE_VISITS,
        patientId: 'test-patient',
        onSelectVisit: () => {},
        onNewVisit: () => {},
      });
      await user.click(screen.getByTestId('compare-btn'));
      // Overlay should show a way to pick the reference visit
      expect(screen.getByTestId('compare-reference-picker')).not.toBeNull();
    });

    test('compare overlay can be dismissed', async () => {
      const user = userEvent.setup();
      renderCarousel({
        visits: THREE_VISITS,
        patientId: 'test-patient',
        onSelectVisit: () => {},
        onNewVisit: () => {},
      });
      await user.click(screen.getByTestId('compare-btn'));
      expect(screen.getByTestId('compare-overlay')).not.toBeNull();
      await user.click(screen.getByTestId('compare-close-btn'));
      expect(screen.queryByTestId('compare-overlay')).toBeNull();
    });

    test('compare overlay shows diff summary (added / resolved counts)', async () => {
      const user = userEvent.setup();
      renderCarousel({
        visits: THREE_VISITS,
        patientId: 'test-patient',
        onSelectVisit: () => {},
        onNewVisit: () => {},
      });
      await user.click(screen.getByTestId('compare-btn'));
      // Diff summary should be visible in the overlay
      expect(screen.getByTestId('compare-diff-summary')).not.toBeNull();
    });
  });

  // ── Change B: same-day encounter disambiguation ─────────────────────────────
  // A visit = an encounter; same-day encounters are legitimate (no day-grouping).
  // When two or more cards share a calendar day their date labels collide, so each
  // gets a time suffix. Single-per-day visits stay date-only. The "·" separator we
  // render before the time is the stable, decoration-free signal asserted here.
  describe('same-day disambiguation (Change B)', () => {
    test('appends a time to each card when two visits share a calendar day', () => {
      // Both fall on May 2 2024 in any plausible runner timezone (UTC..UTC+8).
      const SAME_DAY_A = { id: 'sd-a', status: 'completed' as const, createdAt: '2024-05-02T04:00:00Z' };
      const SAME_DAY_B = { id: 'sd-b', status: 'completed' as const, createdAt: '2024-05-02T08:00:00Z' };
      renderCarousel({
        visits: [SAME_DAY_A, SAME_DAY_B],
        patientId: 'test-patient',
        onSelectVisit: () => {},
        onNewVisit: () => {},
      });
      // One time suffix per same-day card.
      expect(screen.getAllByText(/·/)).toHaveLength(2);
    });

    test('shows no time suffix when every visit falls on a distinct day', () => {
      renderCarousel({
        visits: THREE_VISITS, // Jan / Jun / Dec 2024 — all distinct days
        patientId: 'test-patient',
        onSelectVisit: () => {},
        onNewVisit: () => {},
      });
      expect(screen.queryByText(/·/)).toBeNull();
    });
  });

  // ── Per-visit layers on historical cards ────────────────────────────────
  // Historical (non-open) carousel cards must paint their own per-visit
  // completed/declined layers from chart.layers returned by the API — NOT the
  // cumulative cross-visit sets that only the open card should receive.

  describe('per-visit layers on historical cards', () => {
    test('historical card paints per-visit completed/declined layers from chart.layers', async () => {
      global.fetch = () =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              teeth: [
                { toothNumber: 11, state: 'crown' },
                { toothNumber: 46, state: 'healthy' },
              ],
              layers: { completed: [11], proposed: [], declined: [46] },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );

      // VISIT_OLD is completed (historical) — no openVisitId, so isOpenVisit=false.
      renderCarousel({
        visits: [VISIT_OLD],
        patientId: 'p',
        onSelectVisit: () => {},
        onNewVisit: () => {},
      });

      const stub = await screen.findByTestId('dental-chart-stub');
      expect(stub.getAttribute('data-completed')).toBe('11');
      expect(stub.getAttribute('data-declined')).toBe('46');
      expect(stub.getAttribute('data-proposed')).toBe('');
    });
  });
});
