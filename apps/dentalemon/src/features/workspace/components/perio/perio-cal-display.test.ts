/**
 * Test #2 — CAL is rendered strictly read-only from the API value.
 *
 * CAL = PD + GM is derived server-side and returned on every read/upsert. The FE
 * must NEVER recompute it or expose an editable control: any drift from the
 * backend formula would be a clinical-safety bug. A null CAL (a partial site
 * missing depth or GM) must show a placeholder, not 0.
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/react';
import React from 'react';
import { PerioCalCell } from './perio-cal-cell';

afterEach(cleanup);

function renderCal(props: { tooth: number; site: 'BM' | 'BC' | 'BD' | 'LM' | 'LC' | 'LD'; value: number | null | undefined }) {
  return render(React.createElement(PerioCalCell, props));
}

describe('PerioCalCell', () => {
  test('renders the API-provided CAL value', () => {
    renderCal({ tooth: 16, site: 'BM', value: 5 });
    expect(screen.getByText('5')).not.toBeNull();
  });

  test('renders a placeholder (not 0) when CAL is null', () => {
    renderCal({ tooth: 16, site: 'BM', value: null });
    expect(screen.queryByText('0')).toBeNull();
    expect(screen.getByText('–')).not.toBeNull();
  });

  test('renders a placeholder when CAL is undefined', () => {
    renderCal({ tooth: 16, site: 'BM', value: undefined });
    expect(screen.getByText('–')).not.toBeNull();
  });

  test('renders 0 as 0 when explicitly returned (clamped non-null)', () => {
    renderCal({ tooth: 16, site: 'BM', value: 0 });
    expect(screen.getByText('0')).not.toBeNull();
  });

  test('exposes no editable input (read-only by construction)', () => {
    const { container } = renderCal({ tooth: 16, site: 'BM', value: 4 });
    expect(container.querySelector('input')).toBeNull();
    expect(container.querySelector('button')).toBeNull();
  });

  test('is labelled as CAL for the tooth + site', () => {
    renderCal({ tooth: 16, site: 'BD', value: 4 });
    expect(screen.getByLabelText(/Tooth 16 distobuccal clinical attachment level/i)).not.toBeNull();
  });
});
