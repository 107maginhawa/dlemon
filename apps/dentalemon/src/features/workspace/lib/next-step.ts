/**
 * next-step — pure derivation of the workspace's state-aware guided next step.
 *
 * PASSIVE guidance (Item 4): a single state-aware line + ONE primary action,
 * driven entirely off already-computed visit state (currentVisit.status /
 * openVisit / treatments). No new API calls, no wizard, no tour.
 *
 * Kept pure + separate from the component so the state machine is unit-testable
 * in isolation and can never drift from what the strip renders.
 */

import { isClosedVisit, type VisitLike } from './visit-status';

export type VisitStatus = 'draft' | 'active' | 'completed' | 'locked' | 'discarded';

/** The action a next-step primary/secondary button performs. */
export type NextStepAction =
  | 'start-visit' // create / resume a visit (handleNewVisit)
  | 'complete' // open the pre-completion checklist
  | 'discard' // discard the open visit
  | 'chart' // informational — tap a tooth (no button)
  | 'mark-done'; // informational — mark treatments done / add notes (no button)

export type NextStepKind =
  | 'no-visit'
  | 'empty-chart'
  | 'none-performed'
  | 'work-performed'
  | 'open-visit-blocker'
  | 'closed-no-open';

export interface NextStepButton {
  label: string;
  action: NextStepAction;
  /** Visually primary (lemon) vs secondary (outline). */
  primary: boolean;
}

export interface NextStep {
  kind: NextStepKind;
  /** Single state-aware guidance line. */
  message: string;
  /** Zero, one (primary) or two (e.g. Complete + Discard) actions. */
  buttons: NextStepButton[];
}

export interface DeriveNextStepInput {
  /** Status of the currently-selected visit, if any. */
  currentVisitStatus?: VisitStatus;
  /** The patient's open (active/draft) visit, if any (one-active-visit rule). */
  openVisit?: VisitLike | null;
  /** Whether the currently-selected visit is the open one. */
  currentIsOpen: boolean;
  /** Count of treatments on the current visit. */
  treatmentCount: number;
  /** Count of treatments already performed/verified on the current visit. */
  performedCount: number;
}

/**
 * Derive the single next step from the current workspace state.
 *
 * Ordering of the state machine (first match wins):
 *  1. no visit selected at all → start the first visit.
 *  2. a visit is open but it's NOT the one being viewed → blocker: finish/discard.
 *  3. current visit is read-only (completed/locked) AND nothing is open → start new.
 *  4. current open visit, empty chart → tap a tooth to chart.
 *  5. current open visit, treatments but none performed → mark done / add notes.
 *  6. current open visit, work performed → review & complete.
 */
export function deriveNextStep(input: DeriveNextStepInput): NextStep {
  const {
    currentVisitStatus,
    openVisit,
    currentIsOpen,
    treatmentCount,
    performedCount,
  } = input;

  // 1. No visit selected → start the first visit.
  if (!currentVisitStatus) {
    return {
      kind: 'no-visit',
      message: 'No visit yet — start a visit to chart teeth, plan treatment, and take payment.',
      buttons: [{ label: 'Start visit', action: 'start-visit', primary: true }],
    };
  }

  // 2. An open visit exists but the user is viewing a different (historical) visit.
  //    Make the one-active-visit blocker explicit and surface the real next actions.
  if (openVisit && !currentIsOpen) {
    return {
      kind: 'open-visit-blocker',
      message: 'Finish or discard the open visit to start a new one.',
      buttons: [
        { label: 'Complete visit', action: 'complete', primary: true },
        { label: 'Discard visit', action: 'discard', primary: false },
      ],
    };
  }

  const isReadOnly = isClosedVisit(currentVisitStatus);

  // 3. Read-only visit with nothing open → the closed-visit landing CTA.
  if (isReadOnly && !openVisit) {
    return {
      kind: 'closed-no-open',
      message: 'Visit closed — start a new visit to chart today.',
      buttons: [{ label: 'Start new visit', action: 'start-visit', primary: true }],
    };
  }

  // From here the current visit is the open (editable) one.
  // 4. Empty chart → tap a tooth. Complete stays available as a secondary action:
  //    closing an open visit is a core flow (WF-012) and must not require charting
  //    first — the pre-completion checklist gates whether it's actually allowed.
  if (treatmentCount === 0) {
    return {
      kind: 'empty-chart',
      message: 'Tap a tooth to chart, or apply a treatment template to get started.',
      buttons: [{ label: 'Complete visit', action: 'complete', primary: false }],
    };
  }

  // 6. Some work performed → ready to review & complete. One consistent label
  //    ("Complete visit") across every state for the same action (it opens the
  //    pre-completion review checklist); here it's the PRIMARY nudge.
  if (performedCount > 0) {
    return {
      kind: 'work-performed',
      message: 'Work recorded — review the visit and complete it.',
      buttons: [{ label: 'Complete visit', action: 'complete', primary: true }],
    };
  }

  // 5. Treatments planned but none performed yet. Complete stays available as a
  //    secondary action (same rationale as state 4 — the checklist is the gate).
  return {
    kind: 'none-performed',
    message: 'Mark treatments done or add notes as you work.',
    buttons: [{ label: 'Complete visit', action: 'complete', primary: false }],
  };
}

/**
 * G-02: the visit a "Complete visit" action must target. Completion always
 * applies to the patient's OPEN visit — never the historical visit being viewed.
 * In the open-visit-blocker state (state 2) the user is viewing a closed visit
 * while an open one exists, so the displayed (current) visit id is the WRONG
 * target. When no open visit exists, fall back to the current visit.
 */
export function visitToComplete(
  currentVisitId: string | null | undefined,
  openVisit: { id: string } | null | undefined,
): string | null {
  return openVisit?.id ?? currentVisitId ?? null;
}
