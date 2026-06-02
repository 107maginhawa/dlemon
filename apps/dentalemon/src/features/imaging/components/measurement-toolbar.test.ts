/**
 * MeasurementToolbar tests
 *
 * Covers: toolbar rendering, active state toggle, calibrated indicator, panoramic warning,
 * calibration guard (P1-12) — distance/area disabled when uncalibrated.
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
    onRequestCalibrate: merged.onRequestCalibrate,
    ...render(React.createElement(MeasurementToolbar, merged)),
  };
}

describe('MeasurementToolbar', () => {
  test('renders 4 tool buttons (Calibrate, Distance, Angle, Area)', () => {
    renderToolbar();
    expect(screen.getByRole('button', { name: 'Calibrate' })).not.toBeNull();
    // distance/area are rendered as disabled buttons when uncalibrated
    expect(screen.getByText('Distance')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Angle' })).not.toBeNull();
    expect(screen.getByText('Area')).not.toBeNull();
  });

  test('active tool gets aria-pressed="true"', () => {
    renderToolbar({ toolMode: 'angle', isCalibrated: true });
    const angleBtn = screen.getByRole('button', { name: 'Angle' });
    expect(angleBtn.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Calibrate' }).getAttribute('aria-pressed')).toBe('false');
  });

  test('clicking active tool toggles back to none', async () => {
    const user = userEvent.setup();
    const { onToolChange } = renderToolbar({ toolMode: 'angle', isCalibrated: true });
    await user.click(screen.getByRole('button', { name: 'Angle' }));
    expect(onToolChange).toHaveBeenCalledWith('none');
  });

  test('clicking inactive calibrated-only tool (Area) selects it when calibrated', async () => {
    const user = userEvent.setup();
    const { onToolChange } = renderToolbar({ toolMode: 'none', isCalibrated: true });
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

  // ── P1-12 calibration guard ────────────────────────────────────────────────

  test('Distance button is disabled when not calibrated', () => {
    renderToolbar({ isCalibrated: false });
    const distBtn = screen.getByText('Distance').closest('button');
    expect(distBtn).not.toBeNull();
    expect((distBtn as HTMLButtonElement).disabled).toBe(true);
  });

  test('Area button is disabled when not calibrated', () => {
    renderToolbar({ isCalibrated: false });
    const areaBtn = screen.getByText('Area').closest('button');
    expect(areaBtn).not.toBeNull();
    expect((areaBtn as HTMLButtonElement).disabled).toBe(true);
  });

  test('Distance button is enabled when calibrated', () => {
    renderToolbar({ isCalibrated: true });
    const distBtn = screen.getByRole('button', { name: 'Distance' });
    expect((distBtn as HTMLButtonElement).disabled).toBe(false);
  });

  test('Area button is enabled when calibrated', () => {
    renderToolbar({ isCalibrated: true });
    const areaBtn = screen.getByRole('button', { name: 'Area' });
    expect((areaBtn as HTMLButtonElement).disabled).toBe(false);
  });

  test('clicking disabled Distance button does not call onToolChange', async () => {
    const user = userEvent.setup();
    const { onToolChange } = renderToolbar({ isCalibrated: false });
    const distBtn = screen.getByText('Distance').closest('button') as HTMLButtonElement;
    await user.click(distBtn);
    expect(onToolChange).not.toHaveBeenCalled();
  });

  test('Angle and Calibrate buttons are always enabled regardless of calibration', () => {
    renderToolbar({ isCalibrated: false });
    expect((screen.getByRole('button', { name: 'Angle' }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole('button', { name: 'Calibrate' }) as HTMLButtonElement).disabled).toBe(false);
  });

  test('shows uncalibrated warning status when not calibrated', () => {
    renderToolbar({ isCalibrated: false });
    const status = screen.getByRole('status');
    expect(status.textContent).toContain('calibration');
  });

  test('hides uncalibrated warning when calibrated', () => {
    renderToolbar({ isCalibrated: true });
    expect(screen.queryByRole('status')).toBeNull();
  });

  test('"Calibrate now" CTA calls onRequestCalibrate and switches tool to calibration', async () => {
    const user = userEvent.setup();
    const onRequestCalibrate = mock(() => {});
    const { onToolChange } = renderToolbar({ isCalibrated: false, onRequestCalibrate });
    const cta = screen.getByRole('button', { name: 'Switch to calibration tool' });
    await user.click(cta);
    expect(onRequestCalibrate).toHaveBeenCalledTimes(1);
    expect(onToolChange).toHaveBeenCalledWith('calibration');
  });

  // ── Panoramic warning ──────────────────────────────────────────────────────

  test('shows panoramic warning when modality=panoramic and a tool is active', () => {
    renderToolbar({ modality: 'panoramic', toolMode: 'angle', isCalibrated: true });
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('panoramic');
  });

  test('hides panoramic warning when modality=panoramic but toolMode=none', () => {
    renderToolbar({ modality: 'panoramic', toolMode: 'none' });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  test('hides panoramic warning when tool is active but modality is not panoramic', () => {
    renderToolbar({ modality: 'periapical', toolMode: 'angle', isCalibrated: true });
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
