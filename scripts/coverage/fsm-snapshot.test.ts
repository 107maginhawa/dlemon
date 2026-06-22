/**
 * fsm-snapshot.test.ts — frozen snapshot of every domain state-machine table (plan 014 S4).
 *
 * Converts Cat-4's per-edge transition debt into ONE drift guard: discoverFsms() parses every
 * `*_FSM` / `*_TRANSITIONS` Record under services/api-ts/src/handlers, and this test asserts
 * the whole set (table names + each from→to[] map) equals a committed literal. Any edit to a
 * transition table — a new edge, a removed edge, a reorder, a new/renamed/deleted table — fails
 * CI until the snapshot below is updated in the same diff, forcing a reviewer onto the change.
 *
 * To intentionally change a transition table: make the code edit, then update FROZEN to match
 * (re-dump via discoverFsms) in the SAME commit. The diff IS the review trigger.
 */

import { describe, test, expect } from 'bun:test';
import { discoverFsms } from './fsm-matrix';

const FROZEN: Record<string, Record<string, string[]>> = {
  "APPOINTMENT_TRANSITIONS": {
    "scheduled": [
      "confirmed",
      "checked_in",
      "cancelled",
      "no_show"
    ],
    "confirmed": [
      "checked_in",
      "cancelled",
      "no_show"
    ],
    "checked_in": [
      "completed",
      "cancelled",
      "no_show"
    ],
    "completed": [],
    "cancelled": [],
    "no_show": [
      "completed"
    ]
  },
  "CEPH_LANDMARK_TRANSITIONS": {
    "not_placed": [
      "placed"
    ],
    "placed": [
      "confirmed"
    ],
    "confirmed": [
      "locked"
    ],
    "locked": []
  },
  "CLAIM_DRAFT_FSM": {
    "draft": [
      "ready"
    ],
    "ready": [
      "submitted"
    ],
    "submitted": [
      "accepted",
      "rejected"
    ],
    "accepted": [],
    "rejected": [
      "draft"
    ]
  },
  "COVERAGE_AUTH_FSM": {
    "requested": [
      "approved",
      "denied"
    ],
    "approved": [
      "partial",
      "expired"
    ],
    "partial": [
      "expired"
    ],
    "denied": [],
    "expired": []
  },
  "FINDING_TRANSITIONS": {
    "draft": [
      "confirmed",
      "resolved"
    ],
    "confirmed": [
      "resolved"
    ],
    "resolved": []
  },
  "INSURANCE_CLAIM_FSM": {
    "draft": [
      "ready"
    ],
    "ready": [
      "submitted"
    ],
    "submitted": [
      "under_review",
      "approved",
      "denied"
    ],
    "under_review": [
      "approved",
      "denied"
    ],
    "approved": [
      "partially_paid",
      "paid",
      "denied"
    ],
    "partially_paid": [
      "paid",
      "denied"
    ],
    "paid": [],
    "denied": [
      "appealed",
      "written_off"
    ],
    "appealed": [
      "submitted",
      "written_off"
    ],
    "written_off": []
  },
  "LAB_ORDER_TRANSITIONS": {
    "ordered": [
      "in_fabrication",
      "cancelled"
    ],
    "in_fabrication": [
      "delivered",
      "cancelled"
    ],
    "delivered": [
      "fitted",
      "cancelled"
    ],
    "fitted": [],
    "cancelled": []
  },
  "PAYMENT_PLAN_TRANSITIONS": {
    "on_track": [
      "behind",
      "completed",
      "defaulted"
    ],
    "behind": [
      "on_track",
      "completed",
      "defaulted"
    ],
    "completed": [],
    "defaulted": []
  },
  "PRESCRIPTION_TRANSITIONS": {
    "pending": [
      "dispensed",
      "cancelled"
    ],
    "dispensed": [],
    "cancelled": []
  },
  "QUEUE_ITEM_FSM": {
    "waiting": [
      "called",
      "cancelled"
    ],
    "called": [
      "in_progress",
      "cancelled"
    ],
    "in_progress": [
      "completed",
      "cancelled"
    ],
    "completed": [],
    "cancelled": []
  },
  "RECALL_FSM": {
    "pending": [
      "sent",
      "cancelled"
    ],
    "sent": [
      "completed",
      "cancelled"
    ],
    "completed": [],
    "cancelled": []
  },
  "SYNC_FSM": {
    "pending": [
      "syncing",
      "failed"
    ],
    "syncing": [
      "synced",
      "failed"
    ],
    "synced": [],
    "failed": [
      "syncing"
    ]
  },
  "TASK_FSM": {
    "open": [
      "in_progress",
      "cancelled"
    ],
    "in_progress": [
      "done",
      "cancelled"
    ],
    "done": [],
    "cancelled": []
  },
  "TREATMENT_PLAN_FSM": {
    "draft": [
      "presented",
      "cancelled"
    ],
    "presented": [
      "approved",
      "rejected",
      "cancelled"
    ],
    "approved": [
      "scheduled",
      "partially_completed",
      "cancelled"
    ],
    "scheduled": [
      "partially_completed",
      "cancelled"
    ],
    "rejected": [],
    "partially_completed": [
      "completed",
      "cancelled"
    ],
    "completed": [],
    "cancelled": []
  },
  "TREATMENT_TRANSITIONS": {
    "diagnosed": [
      "planned",
      "dismissed",
      "declined"
    ],
    "planned": [
      "performed",
      "dismissed",
      "declined"
    ],
    "performed": [
      "verified",
      "dismissed"
    ],
    "verified": [
      "dismissed"
    ],
    "dismissed": [],
    "declined": []
  },
  "VISIT_TRANSITIONS": {
    "draft": [
      "active"
    ],
    "active": [
      "completed",
      "discarded"
    ],
    "completed": [
      "locked"
    ],
    "locked": [],
    "discarded": []
  },
  "WAITLIST_ENTRY_FSM": {
    "active": [
      "scheduled",
      "cancelled"
    ],
    "scheduled": [],
    "cancelled": []
  }
};

function liveTables(): Record<string, Record<string, string[]>> {
  return Object.fromEntries(discoverFsms().map((f) => [f.constName, f.legalMap]));
}

describe('FSM transition tables — frozen snapshot (plan 014 S4)', () => {
  test('the discovered set of FSM tables is exactly the frozen set (new/removed/renamed table tripwire)', () => {
    expect(Object.keys(liveTables()).sort()).toEqual(Object.keys(FROZEN).sort());
  });

  test('every domain transition table matches the committed snapshot (edge drift tripwire)', () => {
    expect(liveTables()).toEqual(FROZEN);
  });
});
