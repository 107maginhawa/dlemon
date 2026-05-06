// DentalChartThumbnail — unit tests

import { describe, test, expect, afterEach } from 'bun:test';
import { render, cleanup } from '@testing-library/react';
import React from 'react';
import { getThumbnailPipClass, DentalChartThumbnail } from './dental-chart-thumbnail';
import type { ToothState } from '@/features/workspace/components/dental-chart.helpers';

afterEach(cleanup);

describe('getThumbnailPipClass', () => {
  test('healthy → bg-muted', () => {
    expect(getThumbnailPipClass('healthy' as ToothState)).toBe('bg-muted');
  });

  test('caries → bg-red-500/40', () => {
    expect(getThumbnailPipClass('caries' as ToothState)).toBe('bg-red-500/40');
  });

  test('fractured → bg-amber-400', () => {
    expect(getThumbnailPipClass('fractured' as ToothState)).toBe('bg-amber-400');
  });

  test('filled → bg-green-500', () => {
    expect(getThumbnailPipClass('filled' as ToothState)).toBe('bg-green-500');
  });

  test('crown → bg-blue-400', () => {
    expect(getThumbnailPipClass('crown' as ToothState)).toBe('bg-blue-400');
  });

  test('extracted → border border-dashed border-red-500 bg-transparent', () => {
    expect(getThumbnailPipClass('extracted' as ToothState)).toBe('border border-dashed border-red-500 bg-transparent');
  });

  test('missing → bg-muted/50', () => {
    expect(getThumbnailPipClass('missing' as ToothState)).toBe('bg-muted/50');
  });

  test('implant → bg-blue-300', () => {
    expect(getThumbnailPipClass('implant' as ToothState)).toBe('bg-blue-300');
  });

  test('watchlist → bg-amber-300', () => {
    expect(getThumbnailPipClass('watchlist' as ToothState)).toBe('bg-amber-300');
  });
});

describe('DentalChartThumbnail', () => {
  test('renders 32 pip divs (16 upper + 16 lower)', () => {
    const { container } = render(React.createElement(DentalChartThumbnail, { teeth: [] }));
    const pips = container.querySelectorAll('[data-tooth]');
    expect(pips.length).toBe(32);
  });

  test('empty teeth array renders all pips as healthy (bg-muted)', () => {
    const { container } = render(React.createElement(DentalChartThumbnail, { teeth: [] }));
    const pips = Array.from(container.querySelectorAll('[data-tooth]'));
    expect(pips.every(p => (p as HTMLElement).className.includes('bg-muted'))).toBe(true);
  });

  test('renders caries pip class for tooth 11 when state is caries', () => {
    const { container } = render(
      React.createElement(DentalChartThumbnail, {
        teeth: [{ toothNumber: 11, state: 'caries' as ToothState }],
      })
    );
    const pip = container.querySelector('[data-tooth="11"]');
    expect(pip).toBeTruthy();
    expect((pip as HTMLElement).className).toContain('bg-red-500/40');
  });
});
