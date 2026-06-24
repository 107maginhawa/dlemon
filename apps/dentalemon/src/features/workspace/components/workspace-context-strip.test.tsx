/**
 * WorkspaceContextStrip — consolidated sticky context strip (Items 3 + 4).
 *
 * Verifies: the strip is sticky and anchors the visit date + status + read-only
 * state; the conflict banner is gated on conflictCount; the Compare trigger lives
 * here; and the passive guided next-step renders the right line + buttons per
 * state and wires them to the correct handlers.
 */

import { describe, test, expect, afterEach, mock } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { freshClientWithMutations, makeWrapper as makeWrapperBase } from '@/test-utils';

mock.module('sonner', () => ({ toast: { error: mock(() => {}), success: mock(() => {}) } }));

import { WorkspaceContextStrip, type WorkspaceContextStripProps } from './workspace-context-strip';

function makeWrapper() {
  return makeWrapperBase(freshClientWithMutations());
}

const OPEN_VISIT = { id: 'v-open', status: 'active' };

function baseProps(over: Partial<WorkspaceContextStripProps> = {}): WorkspaceContextStripProps {
  return {
    patientId: 'pat-1',
    visitDate: 'Jun 24, 2026',
    currentVisitStatus: 'active',
    openVisit: OPEN_VISIT,
    currentIsOpen: true,
    treatmentCount: 0,
    performedCount: 0,
    conflictCount: 0,
    canCompare: false,
    onCompare: () => {},
    onStartVisit: () => {},
    onComplete: () => {},
    onDiscard: () => {},
    canDiscard: true,
    ...over,
  };
}

function renderStrip(over: Partial<WorkspaceContextStripProps> = {}) {
  return render(React.createElement(WorkspaceContextStrip, baseProps(over)), {
    wrapper: makeWrapper(),
  });
}

afterEach(cleanup);

describe('WorkspaceContextStrip — Item 3 (anchor + consolidation)', () => {
  test('is a sticky top band', () => {
    renderStrip();
    const strip = screen.getByTestId('workspace-context-strip');
    expect(strip.className).toContain('sticky');
    expect(strip.className).toContain('top-0');
  });

  test('anchors the visit date and status', () => {
    renderStrip({ visitDate: 'Jun 24, 2026', currentVisitStatus: 'active' });
    expect(screen.getByTestId('context-strip-date').textContent).toContain('Jun 24, 2026');
    expect(screen.getByTestId('context-strip-status').textContent).toMatch(/active/i);
  });

  test('shows a read-only marker for completed/locked visits', () => {
    renderStrip({ currentVisitStatus: 'completed', openVisit: null, currentIsOpen: false });
    expect(screen.getByTestId('context-strip-readonly')).not.toBeNull();
  });

  test('does NOT render the conflict banner when conflictCount is 0', () => {
    renderStrip({ conflictCount: 0 });
    expect(screen.queryByTestId('chart-conflict-banner')).toBeNull();
  });

  test('hosts the Compare trigger when canCompare', async () => {
    const user = userEvent.setup();
    let compared = false;
    renderStrip({ canCompare: true, onCompare: () => { compared = true; } });
    const btn = screen.getByTestId('compare-btn');
    await user.click(btn);
    expect(compared).toBe(true);
  });

  test('omits Compare when canCompare is false', () => {
    renderStrip({ canCompare: false });
    expect(screen.queryByTestId('compare-btn')).toBeNull();
  });

  test('viewing the open visit shows the in-progress indicator + owner discard', async () => {
    const user = userEvent.setup();
    let discarded = false;
    renderStrip({
      currentVisitStatus: 'active',
      openVisit: OPEN_VISIT,
      currentIsOpen: true,
      canDiscard: true,
      onDiscard: () => { discarded = true; },
    });
    expect(screen.getByTestId('visit-in-progress-indicator')).not.toBeNull();
    await user.click(screen.getByTestId('discard-visit-btn'));
    expect(discarded).toBe(true);
  });

  test('discard escape hatch hidden for non-owner while viewing the open visit', () => {
    renderStrip({
      currentVisitStatus: 'active',
      openVisit: OPEN_VISIT,
      currentIsOpen: true,
      canDiscard: false,
    });
    expect(screen.getByTestId('visit-in-progress-indicator')).not.toBeNull();
    expect(screen.queryByTestId('discard-visit-btn')).toBeNull();
  });

  test('no in-progress indicator when viewing a closed visit', () => {
    renderStrip({
      currentVisitStatus: 'completed',
      openVisit: null,
      currentIsOpen: false,
    });
    expect(screen.queryByTestId('visit-in-progress-indicator')).toBeNull();
  });
});

describe('WorkspaceContextStrip — Item 4 (guided next step)', () => {
  test('no-visit: renders Start visit wired to onStartVisit', async () => {
    const user = userEvent.setup();
    let started = false;
    renderStrip({
      currentVisitStatus: undefined,
      openVisit: null,
      currentIsOpen: false,
      onStartVisit: () => { started = true; },
    });
    expect(screen.getByTestId('next-step-message').getAttribute('data-next-step-kind')).toBe('no-visit');
    await user.click(screen.getByTestId('next-step-start-visit-btn'));
    expect(started).toBe(true);
  });

  test('empty chart: tap-a-tooth line, no action button', () => {
    renderStrip({ treatmentCount: 0, performedCount: 0 });
    const msg = screen.getByTestId('next-step-message');
    expect(msg.getAttribute('data-next-step-kind')).toBe('empty-chart');
    expect(msg.textContent).toMatch(/tap a tooth/i);
    expect(screen.queryByTestId('next-step-complete-btn')).toBeNull();
  });

  test('work performed: Review & complete wired to onComplete', async () => {
    const user = userEvent.setup();
    let completed = false;
    renderStrip({ treatmentCount: 2, performedCount: 1, onComplete: () => { completed = true; } });
    await user.click(screen.getByTestId('next-step-complete-btn'));
    expect(completed).toBe(true);
  });

  test('open-visit blocker: shows Complete + Discard with explicit reason line', async () => {
    const user = userEvent.setup();
    let completed = false;
    let discarded = false;
    renderStrip({
      currentVisitStatus: 'completed', // viewing a historical card
      openVisit: OPEN_VISIT,
      currentIsOpen: false,
      onComplete: () => { completed = true; },
      onDiscard: () => { discarded = true; },
    });
    expect(screen.getByTestId('next-step-message').textContent).toMatch(/finish or discard the open visit/i);
    await user.click(screen.getByTestId('next-step-complete-btn'));
    await user.click(screen.getByTestId('next-step-discard-btn'));
    expect(completed).toBe(true);
    expect(discarded).toBe(true);
  });

  test('open-visit blocker: Discard hidden when role cannot discard', () => {
    renderStrip({
      currentVisitStatus: 'completed',
      openVisit: OPEN_VISIT,
      currentIsOpen: false,
      canDiscard: false,
    });
    expect(screen.queryByTestId('next-step-discard-btn')).toBeNull();
    // Complete still shown — the blocker is still actionable.
    expect(screen.getByTestId('next-step-complete-btn')).not.toBeNull();
  });

  test('closed/read-only with no open visit: Start new visit wired to onStartVisit', async () => {
    const user = userEvent.setup();
    let started = false;
    renderStrip({
      currentVisitStatus: 'completed',
      openVisit: null,
      currentIsOpen: false,
      treatmentCount: 2,
      performedCount: 2,
      onStartVisit: () => { started = true; },
    });
    expect(screen.getByTestId('next-step-message').textContent).toMatch(/visit closed/i);
    await user.click(screen.getByTestId('next-step-start-visit-btn'));
    expect(started).toBe(true);
  });
});
