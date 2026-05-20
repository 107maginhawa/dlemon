/**
 * AnnotationToolbar tests
 *
 * Covers: toolbar rendering, active state toggle
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { AnnotationToolbar } from './annotation-toolbar';

afterEach(cleanup);

function renderToolbar(props: Partial<React.ComponentProps<typeof AnnotationToolbar>> = {}) {
  const defaults = {
    toolMode: 'none' as const,
    onToolChange: mock(() => {}),
  };
  const merged = { ...defaults, ...props };
  return {
    onToolChange: merged.onToolChange,
    ...render(React.createElement(AnnotationToolbar, merged)),
  };
}

describe('AnnotationToolbar', () => {
  test('renders 5 tool buttons (Label, Arrow, Freehand, Shape, Tooth)', () => {
    renderToolbar();
    expect(screen.getByRole('button', { name: 'Label' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Arrow' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Freehand' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Shape' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Tooth' })).not.toBeNull();
  });

  test('active tool gets aria-pressed="true"', () => {
    renderToolbar({ toolMode: 'arrow' });
    const arrowBtn = screen.getByRole('button', { name: 'Arrow' });
    expect(arrowBtn.getAttribute('aria-pressed')).toBe('true');
    // Others false
    expect(screen.getByRole('button', { name: 'Label' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button', { name: 'Freehand' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button', { name: 'Shape' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button', { name: 'Tooth' }).getAttribute('aria-pressed')).toBe('false');
  });

  test('clicking active tool toggles back to none', async () => {
    const user = userEvent.setup();
    const { onToolChange } = renderToolbar({ toolMode: 'freehand' });
    await user.click(screen.getByRole('button', { name: 'Freehand' }));
    expect(onToolChange).toHaveBeenCalledWith('none');
  });

  test('clicking inactive tool selects it', async () => {
    const user = userEvent.setup();
    const { onToolChange } = renderToolbar({ toolMode: 'none' });
    await user.click(screen.getByRole('button', { name: 'Tooth' }));
    expect(onToolChange).toHaveBeenCalledWith('tooth');
  });
});
