/**
 * next-step — state-machine tests for the guided next step (Item 4).
 *
 * The derivation is pure: each visit state maps to exactly one guidance line and
 * the correct set of action buttons. These pin every branch of the happy path
 * plus the open-visit blocker and closed-visit landing.
 */

import { describe, test, expect } from 'bun:test';
import { deriveNextStep } from './next-step';

const OPEN_VISIT = { id: 'v-open', status: 'active' };

describe('deriveNextStep', () => {
  test('no visit → Start visit primary CTA', () => {
    const s = deriveNextStep({
      currentVisitStatus: undefined,
      openVisit: null,
      currentIsOpen: false,
      treatmentCount: 0,
      performedCount: 0,
    });
    expect(s.kind).toBe('no-visit');
    expect(s.message).toMatch(/start a visit/i);
    expect(s.buttons).toHaveLength(1);
    expect(s.buttons[0]).toMatchObject({ action: 'start-visit', primary: true });
    expect(s.buttons[0].label).toMatch(/start visit/i);
  });

  test('active + empty chart → tap a tooth, no buttons (template surfaced in table)', () => {
    const s = deriveNextStep({
      currentVisitStatus: 'active',
      openVisit: OPEN_VISIT,
      currentIsOpen: true,
      treatmentCount: 0,
      performedCount: 0,
    });
    expect(s.kind).toBe('empty-chart');
    expect(s.message).toMatch(/tap a tooth/i);
    expect(s.buttons).toHaveLength(0);
  });

  test('treatments but none performed → mark done / add notes', () => {
    const s = deriveNextStep({
      currentVisitStatus: 'active',
      openVisit: OPEN_VISIT,
      currentIsOpen: true,
      treatmentCount: 3,
      performedCount: 0,
    });
    expect(s.kind).toBe('none-performed');
    expect(s.message).toMatch(/mark treatments done|add notes/i);
    expect(s.buttons).toHaveLength(0);
  });

  test('work performed → Review & complete primary', () => {
    const s = deriveNextStep({
      currentVisitStatus: 'active',
      openVisit: OPEN_VISIT,
      currentIsOpen: true,
      treatmentCount: 3,
      performedCount: 1,
    });
    expect(s.kind).toBe('work-performed');
    expect(s.message).toMatch(/review|complete/i);
    expect(s.buttons).toHaveLength(1);
    expect(s.buttons[0]).toMatchObject({ action: 'complete', primary: true });
    expect(s.buttons[0].label).toMatch(/review.*complete/i);
  });

  test('open visit exists but viewing another → explicit blocker with Complete + Discard', () => {
    const s = deriveNextStep({
      currentVisitStatus: 'completed', // viewing a historical/closed card
      openVisit: OPEN_VISIT, // but the patient still has an open visit
      currentIsOpen: false,
      treatmentCount: 0,
      performedCount: 0,
    });
    expect(s.kind).toBe('open-visit-blocker');
    expect(s.message).toMatch(/finish or discard the open visit/i);
    const actions = s.buttons.map((b) => b.action);
    expect(actions).toContain('complete');
    expect(actions).toContain('discard');
  });

  test('completed/read-only with NO open visit → Start new visit', () => {
    const s = deriveNextStep({
      currentVisitStatus: 'completed',
      openVisit: null,
      currentIsOpen: false,
      treatmentCount: 2,
      performedCount: 2,
    });
    expect(s.kind).toBe('closed-no-open');
    expect(s.message).toMatch(/visit closed/i);
    expect(s.buttons).toHaveLength(1);
    expect(s.buttons[0]).toMatchObject({ action: 'start-visit', primary: true });
  });

  test('locked visit with no open visit also lands on Start new visit', () => {
    const s = deriveNextStep({
      currentVisitStatus: 'locked',
      openVisit: null,
      currentIsOpen: false,
      treatmentCount: 1,
      performedCount: 1,
    });
    expect(s.kind).toBe('closed-no-open');
    expect(s.buttons[0].action).toBe('start-visit');
  });
});
