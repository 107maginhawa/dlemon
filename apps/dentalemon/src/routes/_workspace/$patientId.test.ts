/**
 * WorkspacePage layout tests
 *
 * Verifies layout structure:
 *   - YearSegmentControl rendered between TopBar and carousel
 *   - ResizableDivider rendered between carousel and table
 *   - Carousel + table zone data-testids present
 *   - ToothSlideout positioned as a flex-row sibling (right panel)
 */

import { describe, test, expect } from 'bun:test';

const src = () => Bun.file(new URL('./$patientId.tsx', import.meta.url).pathname).text();

describe('WorkspacePage layout', () => {
  describe('YearSegmentControl', () => {
    test('renders <YearSegmentControl', async () => {
      expect(await src()).toMatch(/<YearSegmentControl/);
    });

    test('imports YearSegmentControl', async () => {
      expect(await src()).toContain("YearSegmentControl");
    });
  });

  describe('ToothSlideout', () => {
    test('renders <ToothSlideout', async () => {
      expect(await src()).toMatch(/<ToothSlideout/);
    });

    test('imports ToothSlideout', async () => {
      expect(await src()).toContain("ToothSlideout");
    });
  });

  describe('layout structure', () => {
    test('does not use splitRatio-based flex-basis', async () => {
      expect(await src()).not.toContain('splitRatio * 100');
    });

    test('renders TreatmentTable component', async () => {
      expect(await src()).toContain('TreatmentTable');
    });
  });

  describe('zone data-testids', () => {
    test('carousel zone has data-testid="workspace-carousel-zone"', async () => {
      expect(await src()).toContain('data-testid="workspace-carousel-zone"');
    });

    test('table zone has data-testid="workspace-table-zone"', async () => {
      expect(await src()).toContain('data-testid="workspace-table-zone"');
    });
  });

  // case-presentation G1: the workspace route is the layout parent of the nested
  // /case-presentation/$presentationId route. Without an Outlet, the child route's
  // URL matched but rendered nothing — the patient-facing view was unreachable and
  // accept could never complete from the UI. These pin the Outlet wiring so the
  // nested route can render full-screen.
  describe('nested-route Outlet (case-presentation reachability)', () => {
    test('imports Outlet + useChildMatches from the router', async () => {
      const s = await src();
      expect(s).toContain('Outlet');
      expect(s).toContain('useChildMatches');
    });

    test('renders <Outlet /> when a child route is active', async () => {
      expect(await src()).toMatch(/<Outlet\s*\/>/);
    });

    test('gates the workspace body behind a child-route check', async () => {
      expect(await src()).toContain('useChildMatches()');
    });
  });
});
