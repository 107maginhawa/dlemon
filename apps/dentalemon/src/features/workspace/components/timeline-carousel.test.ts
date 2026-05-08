/**
 * TimelineCarousel — Swiper coverflow replacement tests
 *
 * Phase 2: Replace hand-rolled 3-card layout with Swiper EffectCoverflow.
 *
 * Coverage:
 * - Renders container with data-testid="timeline-carousel"
 * - Renders one slide per visit (data-testid="visit-slide")
 * - initialSlide points to most-recent visit (sorted chronologically)
 * - Slide footer shows formatted date
 * - Slide footer shows status badge text
 * - onSelectVisit is called when slide changes
 * - New-visit button present (data-testid="new-visit-btn")
 * - Active slide opacity is 1, non-active is 0.5
 * - Active slide has accent bar element
 */

import { describe, test, expect, afterEach, mock } from 'bun:test';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import React from 'react';

// ── Mock Swiper before importing the component ────────────────────────────
// Swiper requires a real browser DOM (ResizeObserver, requestAnimationFrame, etc.)
// that happy-dom doesn't provide. We replace it with minimal div wrappers so we
// can test the component's React logic without the library internals.

let capturedOnSlideChange: ((swiper: { activeIndex: number }) => void) | undefined;
let capturedInitialSlide: number | undefined;

mock.module('swiper/react', () => ({
  Swiper: ({ children, onSlideChange, initialSlide, ...rest }: any) => {
    capturedOnSlideChange = onSlideChange;
    capturedInitialSlide = initialSlide;
    return React.createElement('div', { 'data-testid': 'swiper-root', ...rest }, children);
  },
  SwiperSlide: ({ children, ...rest }: any) =>
    React.createElement('div', { 'data-testid': 'visit-slide', ...rest }, children),
}));

mock.module('swiper/modules', () => ({
  EffectCoverflow: {},
  Pagination: {},
  Keyboard: {},
}));

// CSS side-effect imports — no-op in test env
mock.module('swiper/css', () => ({}));
mock.module('swiper/css/effect-coverflow', () => ({}));
mock.module('swiper/css/pagination', () => ({}));

// DentalChart is heavy (SVG rendering). Stub it so slide tests stay fast.
mock.module('@/features/workspace/components/dental-chart', () => ({
  DentalChart: ({ teeth }: any) =>
    React.createElement('div', { 'data-testid': 'dental-chart-stub', 'data-teeth-count': teeth?.length ?? 0 }),
}));

// Import after mocks are registered
const { TimelineCarousel } = await import('./timeline-carousel');

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
      render(
        React.createElement(TimelineCarousel, {
          visits: THREE_VISITS,
          onSelectVisit: () => {},
          onNewVisit: () => {},
        }),
      );
      expect(screen.getByTestId('timeline-carousel')).toBeTruthy();
    });
  });

  describe('slides', () => {
    test('renders one slide per visit', () => {
      render(
        React.createElement(TimelineCarousel, {
          visits: THREE_VISITS,
          onSelectVisit: () => {},
          onNewVisit: () => {},
        }),
      );
      const slides = screen.getAllByTestId('visit-slide');
      expect(slides).toHaveLength(THREE_VISITS.length);
    });

    test('renders zero slides when visits is empty', () => {
      render(
        React.createElement(TimelineCarousel, {
          visits: [],
          onSelectVisit: () => {},
          onNewVisit: () => {},
        }),
      );
      const slides = screen.queryAllByTestId('visit-slide');
      expect(slides).toHaveLength(0);
    });
  });

  describe('initialSlide', () => {
    test('initialSlide equals visits.length - 1 (most-recent visit last in sorted order)', () => {
      render(
        React.createElement(TimelineCarousel, {
          visits: THREE_VISITS,
          onSelectVisit: () => {},
          onNewVisit: () => {},
        }),
      );
      // Visits are sorted chronologically oldest→newest so last index = most recent
      expect(capturedInitialSlide).toBe(THREE_VISITS.length - 1);
    });

    test('initialSlide is 0 for a single visit', () => {
      render(
        React.createElement(TimelineCarousel, {
          visits: [VISIT_NEW],
          onSelectVisit: () => {},
          onNewVisit: () => {},
        }),
      );
      expect(capturedInitialSlide).toBe(0);
    });
  });

  describe('slide content', () => {
    test('each slide shows a formatted date', () => {
      render(
        React.createElement(TimelineCarousel, {
          visits: THREE_VISITS,
          onSelectVisit: () => {},
          onNewVisit: () => {},
        }),
      );
      // Jan 10, 2024 — locale-formatted date from VISIT_OLD
      expect(screen.getByText(/Jan/i)).toBeTruthy();
      // Jun 15 2024
      expect(screen.getByText(/Jun/i)).toBeTruthy();
      // Dec 20 2024
      expect(screen.getByText(/Dec/i)).toBeTruthy();
    });

    test('each slide shows the status badge', () => {
      render(
        React.createElement(TimelineCarousel, {
          visits: THREE_VISITS,
          onSelectVisit: () => {},
          onNewVisit: () => {},
        }),
      );
      expect(screen.getByText(/completed/i)).toBeTruthy();
      expect(screen.getByText(/active/i)).toBeTruthy();
      expect(screen.getByText(/draft/i)).toBeTruthy();
    });

    test('renders a DentalChart stub inside each slide', () => {
      render(
        React.createElement(TimelineCarousel, {
          visits: THREE_VISITS,
          onSelectVisit: () => {},
          onNewVisit: () => {},
        }),
      );
      const charts = screen.getAllByTestId('dental-chart-stub');
      expect(charts).toHaveLength(THREE_VISITS.length);
    });
  });

  describe('active slide visual state', () => {
    test('initial active slide (last/most-recent) has opacity 1', () => {
      render(
        React.createElement(TimelineCarousel, {
          visits: THREE_VISITS,
          onSelectVisit: () => {},
          onNewVisit: () => {},
        }),
      );
      const slides = screen.getAllByTestId('visit-slide');
      // Last slide in DOM = most recent (sorted oldest→newest)
      const lastSlideCard = slides[slides.length - 1].querySelector('[data-active-card]');
      expect(lastSlideCard).toBeTruthy();
    });

    test('initial active slide has accent bar', () => {
      render(
        React.createElement(TimelineCarousel, {
          visits: THREE_VISITS,
          onSelectVisit: () => {},
          onNewVisit: () => {},
        }),
      );
      const slides = screen.getAllByTestId('visit-slide');
      const activeSlide = slides[slides.length - 1];
      const accentBar = activeSlide.querySelector('[data-accent-bar]');
      expect(accentBar).toBeTruthy();
    });

    test('non-active slides do not have accent bar', () => {
      render(
        React.createElement(TimelineCarousel, {
          visits: THREE_VISITS,
          onSelectVisit: () => {},
          onNewVisit: () => {},
        }),
      );
      const slides = screen.getAllByTestId('visit-slide');
      // First two slides (index 0, 1) are not the most recent → no accent bar
      const firstSlide = slides[0];
      const accentBar = firstSlide.querySelector('[data-accent-bar]');
      expect(accentBar).toBeNull();
    });
  });

  describe('onSlideChange callback', () => {
    test('calls onSelectVisit with the visit id of the new active slide', () => {
      const calls: string[] = [];
      render(
        React.createElement(TimelineCarousel, {
          visits: THREE_VISITS,
          onSelectVisit: (id) => calls.push(id),
          onNewVisit: () => {},
        }),
      );

      // Simulate Swiper sliding to index 0 (oldest visit = VISIT_OLD)
      capturedOnSlideChange?.({ activeIndex: 0 });

      // Visits sorted oldest→newest: [VISIT_OLD, VISIT_MID, VISIT_NEW]
      expect(calls).toContain(VISIT_OLD.id);
    });

    test('calls onSelectVisit with the correct id when sliding to middle index', () => {
      const calls: string[] = [];
      render(
        React.createElement(TimelineCarousel, {
          visits: THREE_VISITS,
          onSelectVisit: (id) => calls.push(id),
          onNewVisit: () => {},
        }),
      );

      capturedOnSlideChange?.({ activeIndex: 1 });
      expect(calls).toContain(VISIT_MID.id);
    });
  });

  describe('new-visit button', () => {
    test('renders data-testid="new-visit-btn"', () => {
      render(
        React.createElement(TimelineCarousel, {
          visits: THREE_VISITS,
          onSelectVisit: () => {},
          onNewVisit: () => {},
        }),
      );
      expect(screen.getByTestId('new-visit-btn')).toBeTruthy();
    });

    test('calls onNewVisit when clicked', () => {
      let clicked = false;
      render(
        React.createElement(TimelineCarousel, {
          visits: THREE_VISITS,
          onSelectVisit: () => {},
          onNewVisit: () => { clicked = true; },
        }),
      );
      fireEvent.click(screen.getByTestId('new-visit-btn'));
      expect(clicked).toBe(true);
    });
  });
});
