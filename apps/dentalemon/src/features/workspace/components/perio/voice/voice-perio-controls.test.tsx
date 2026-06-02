/**
 * Tier 3 — VoicePerioControls component tests.
 *
 * The mic toggle renders + is keyboard-operable, the mic-state indicator
 * reflects the provider state with an icon + LABEL (not color-only), the
 * transcript strip is an aria-live region announcing the last write, and the
 * confidence-gated confirmation prompt renders with Yes / No actions.
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { VoicePerioControls } from './voice-perio-controls';
import type { TranscriptEntry } from '../../../hooks/use-voice-perio';

afterEach(cleanup);

const baseProps = {
  active: false,
  micState: 'idle' as const,
  transcriptLog: [] as TranscriptEntry[],
  pending: null,
  onToggle: () => {},
  onConfirm: () => {},
  onDismiss: () => {},
};

function renderControls(props: Partial<React.ComponentProps<typeof VoicePerioControls>> = {}) {
  return render(<VoicePerioControls {...baseProps} {...props} />);
}

describe('VoicePerioControls — toggle', () => {
  test('renders a labeled, keyboard-operable mic toggle', () => {
    renderControls();
    const toggle = screen.getByTestId('voice-mic-toggle');
    expect(toggle.getAttribute('aria-label')).toMatch(/start voice charting/i);
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
  });

  test('aria-pressed reflects active state', () => {
    renderControls({ active: true });
    expect(screen.getByTestId('voice-mic-toggle').getAttribute('aria-pressed')).toBe('true');
  });

  test('clicking the toggle fires onToggle', async () => {
    const user = userEvent.setup();
    let toggled = 0;
    renderControls({ onToggle: () => (toggled += 1) });
    await user.click(screen.getByTestId('voice-mic-toggle'));
    expect(toggled).toBe(1);
  });
});

describe('VoicePerioControls — mic-state indicator (not color-only)', () => {
  const states = [
    ['idle', /mic off/i],
    ['listening', /listening/i],
    ['applied', /applied/i],
    ['paused', /paused/i],
    ['error', /not recognized/i],
  ] as const;

  for (const [state, label] of states) {
    test(`${state} renders a visible text label + data-state`, () => {
      renderControls({ micState: state });
      const indicator = screen.getByTestId('voice-mic-state');
      expect(indicator.getAttribute('data-state')).toBe(state);
      expect(indicator.textContent).toMatch(label);
    });
  }

  test('the indicator is a status region for assistive tech', () => {
    renderControls({ micState: 'listening' });
    expect(screen.getByTestId('voice-mic-state').getAttribute('role')).toBe('status');
  });
});

describe('VoicePerioControls — transcript strip (aria-live)', () => {
  test('the transcript strip is an aria-live polite region', () => {
    renderControls();
    const strip = screen.getByTestId('voice-transcript');
    expect(strip.getAttribute('aria-live')).toBe('polite');
  });

  test('announces the last utterance + the field it wrote', () => {
    const log: TranscriptEntry[] = [
      { transcript: 'three', applied: '18 depthBM → 3', event: 'applied' },
    ];
    renderControls({ transcriptLog: log });
    const strip = screen.getByTestId('voice-transcript');
    expect(strip.textContent).toContain('three');
    expect(strip.textContent).toContain('18 depthBM → 3');
  });

  test('shows a "needs confirmation" hint when nothing was written', () => {
    const log: TranscriptEntry[] = [{ transcript: '25', applied: null, event: 'needs-confirm' }];
    renderControls({ transcriptLog: log });
    expect(screen.getByTestId('voice-transcript').textContent).toMatch(/needs confirmation/i);
  });
});

describe('VoicePerioControls — confirmation prompt', () => {
  const pending = {
    transcript: 'three',
    command: { kind: 'depth' as const, values: [3], confidence: 0.3, ambiguous: false },
    prompt: 'Did you say depth 3?',
  };

  test('renders the prompt with Yes / No actions', () => {
    renderControls({ pending });
    expect(screen.getByTestId('voice-pending-confirm').textContent).toMatch(/did you say depth 3/i);
    expect(screen.getByTestId('voice-confirm-yes')).not.toBeNull();
    expect(screen.getByTestId('voice-confirm-no')).not.toBeNull();
  });

  test('Yes fires onConfirm, No fires onDismiss', async () => {
    const user = userEvent.setup();
    let confirmed = 0;
    let dismissed = 0;
    renderControls({ pending, onConfirm: () => (confirmed += 1), onDismiss: () => (dismissed += 1) });
    await user.click(screen.getByTestId('voice-confirm-yes'));
    await user.click(screen.getByTestId('voice-confirm-no'));
    expect(confirmed).toBe(1);
    expect(dismissed).toBe(1);
  });

  test('no prompt renders when pending is null', () => {
    renderControls({ pending: null });
    expect(screen.queryByTestId('voice-pending-confirm')).toBeNull();
  });
});
