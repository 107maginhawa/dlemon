/**
 * MeasurementToolbar tests
 *
 * Covers: toolbar rendering, active state toggle, calibrated indicator, panoramic warning
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { MeasurementToolbar } from './measurement-toolbar';

afterEach(cleanup);

function renderToolbar(props: Partial<React.ComponentProps<typeof MeasurementToolbar>> = {}) {
  const defaults = {
    toolMode: 'none' as const,
    onToolChange: mock(() => {}),
    isCalibrated: false,
  };
  const merged = { ...defaults, ...props };
  return {
    onToolChange: merged.onToolChange,
    ...render(React.createElement(MeasurementToolbar, merged)),
  };
}

describe('MeasurementToolbar', () => {
  test('renders 4 tool buttons (Calibrate, Distance, Angle, Area)', () => {
    renderToolbar();
    expect(screen.getByRole('button', { name: 'Calibrate' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Distance' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Angle' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Area' })).not.toBeNull();
  });

  test('active tool gets aria-pressed="true"', () => {
    renderToolbar({ toolMode: 'distance' });
    const distBtn = screen.getByRole('button', { name: 'Distance' });
    expect(distBtn.getAttribute('aria-pressed')).toBe('true');
    // Others should be false
    expect(screen.getByRole('button', { name: 'Calibrate' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button', { name: 'Angle' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button', { name: 'Area' }).getAttribute('aria-pressed')).toBe('false');
  });

  test('clicking active tool toggles back to none', async () => {
    const user = userEvent.setup();
    const { onToolChange } = renderToolbar({ toolMode: 'angle' });
    await user.click(screen.getByRole('button', { name: 'Angle' }));
    expect(onToolChange).toHaveBeenCalledWith('none');
  });

  test('clicking inactive tool selects it', async () => {
    const user = userEvent.setup();
    const { onToolChange } = renderToolbar({ toolMode: 'none' });
    await user.click(screen.getByRole('button', { name: 'Area' }));
    expect(onToolChange).toHaveBeenCalledWith('area');
  });

  test('shows calibrated indicator when isCalibrated=true', () => {
    renderToolbar({ isCalibrated: true });
    expect(screen.getByText('Calibrated')).not.toBeNull();
  });

  test('hides calibrated indicator when isCalibrated=false', () => {
    renderToolbar({ isCalibrated: false });
    expect(screen.queryByText('Calibrated')).toBeNull();
  });

  test('shows panoramic warning when modality=panoramic and a tool is active', () => {
    renderToolbar({ modality: 'panoramic', toolMode: 'distance' });
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('panoramic');
  });

  test('hides panoramic warning when modality=panoramic but toolMode=none', () => {
    renderToolbar({ modality: 'panoramic', toolMode: 'none' });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  test('hides panoramic warning when tool is active but modality is not panoramic', () => {
    renderToolbar({ modality: 'periapical', toolMode: 'distance' });
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
