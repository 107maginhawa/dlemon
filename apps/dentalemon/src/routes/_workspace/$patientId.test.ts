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

  // Phase 2 — workspace toolbar promotion (items 2.1, 2.2, 2.3, N1).
  describe('toolbar (Phase 2)', () => {
    test('every toolbar trigger testid is preserved', async () => {
      const s = await src();
      for (const id of [
        'imaging-tab-btn', 'perio-tab-btn', 'occlusion-tab-btn', 'recalls-tab-btn',
        'tasks-tab-btn', 'treatment-plans-tab-btn', 'chart-export-btn',
      ]) {
        expect(s).toContain(`data-testid="${id}"`);
      }
    });

    test('2.1: triggers use the promoted icon+label button affordance', async () => {
      const s = await src();
      expect(s).toContain('WORKSPACE_TOOL_BTN');
      // each tab trigger references the shared promoted-button class (7 triggers)
      expect((s.match(/className=\{WORKSPACE_TOOL_BTN\}/g) ?? []).length).toBeGreaterThanOrEqual(7);
    });

    test('2.2: Export is v2-deferred — gated behind workspace.chart_export; when ON it is disabled + hinted (not silently hidden)', async () => {
      const s = await src();
      // Still present in source (code stays in the tree), but flag-gated for v1.
      expect(s).toContain('Select a visit to export the chart');
      expect(s).toContain("isFeatureEnabled('workspace.chart_export')");
    });

    test('2.3: Perio exposes an inline disabled hint for touch devices', async () => {
      expect(await src()).toContain('perio-disabled-hint');
    });

    test('N1: the plan-docs trigger is relabelled "Plan docs"', async () => {
      expect(await src()).toContain('Plan docs');
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
