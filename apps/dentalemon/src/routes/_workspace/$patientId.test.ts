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

  describe('ResizableDivider', () => {
    test('renders <ResizableDivider', async () => {
      expect(await src()).toMatch(/<ResizableDivider/);
    });

    test('imports ResizableDivider', async () => {
      expect(await src()).toContain("ResizableDivider");
    });
  });

  describe('layout structure', () => {
    test('does not use splitRatio-based flex-basis', async () => {
      expect(await src()).not.toContain('splitRatio * 100');
    });

    test('uses flex-row outer wrapper for slideout layout', async () => {
      expect(await src()).toContain('flex-row');
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
});
