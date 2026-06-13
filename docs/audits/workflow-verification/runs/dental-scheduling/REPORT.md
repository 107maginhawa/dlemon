# Workflow-verification run — dental-scheduling

```result
module: dental-scheduling
status: DONE
rating: GREEN
personas_driven: [Riley (staff_scheduling), Dr. Maria Reyes (dentist_owner, owner), Ana Santos (staff_full, RBAC-neg)]
workflows_verified: { happy: 4, error: 2, rbac_neg: 2, coherence: 1, affordance: 1, cross: 1 }
ideal_s4_seams_checked: ["X1->X2: book -> check-in CREATES visit (BR-004) -> visit state=active (assert BR-SCH-001 branch-scoped, BR-002 no double-active visit)"]
gaps_fixed:
  - id: SCH-DRIFT-001
    priority: P1
    fix: "DentalAppointment wire payload drifted from the declared SDK/TypeSpec model — toWire dropped the REQUIRED version (optimistic-lock counter) and the optional confirmedVia, and the contract field was the lone snake_case no_showAt while the handler emits camelCase noShowAt. Net consumer impact: SDK version/confirmedVia read undefined, and the SDK response transformer revived a non-existent no_showAt while leaving the real noShowAt as a raw string (no Date). Fixed at true source: toWire emits version+confirmedVia; TypeSpec no_showAt->noShowAt (regen -> validator + SDK types + SDK date transformer). Additive on the wire; FE normalizes wire->display and was unaffected."
    commit: e49e411d
tests_added:
  - workflow: "Book appointment (wire-contract shape)"
    layer: backend
    file: services/api-ts/src/handlers/dental-scheduling/dental-scheduling.test.ts
    commit: e49e411d
  - workflow: "Book appointment + no-show transition (FE<->BE wire shape)"
    layer: contract
    file: specs/api/tests/contract/dental-scheduling.hurl
    commit: e49e411d
doc_fixes: []
deferred_reported:
  - gap: "BR-SCH-003 not enforced on the PATCH-cancel path (DELETE requires reason->422; PATCH {status:cancelled} accepts a missing/blank cancellationReason->200). An EXISTING test encodes the 200 behavior (dental-scheduling-transitions.test.ts:370,383). Reconciling churns a passing test + risks unverified FE wiring -> audit flagged CHECKPOINT-before-change."
    reason: "No BR/AC mandates reason on the PATCH path specifically; the two-path asymmetry is a documented product/test decision, not a contract bug. Default-deny: not unilaterally fixable."
    source: "MODULE_dental-scheduling_AUDIT_2026-06-08.md Ranked Remaining Gaps #1"
  - gap: "Seed/wire emits free-text visitType (e.g. 'Sensitivity follow-up', 'Cleaning') for some seeded appointments, violating the declared VisitType enum (checkup|treatment|emergency|recall|hygiene). The create HANDLER correctly validates the enum (V-SCH-007 -> 400); the violating rows are inserted directly by the seed, bypassing the validator."
    reason: "Seed-coherence issue, not a scheduling-handler contract bug. No BR/AC cites it and the handler is correct. Out of module scope (default-deny)."
    source: "Live API observation (GET /dental/appointments wire body) during STEP 3a"
  - gap: "Automated SMS/email appointment reminders (WF-080/WF-081, flags dental_scheduling_sms_reminder + slot generation G-001)."
    reason: "Phase-2 / default-false flag — DO-NOT-FIX per module-notes + MODULE_SPEC section 18."
    source: "MODULE_SPEC section 18 Feature Flags; global digest DO-NOT-FIX"
  - gap: "Adversarial negative-path strength of online-booking / holds / waitlist / queue / token-confirm test files (hold-expiry race, queue illegal-transition 4xx, online-booking pending provenance, FIFO tie-break) verified present+green, not line-audited."
    reason: "Out of safe scope this round; impl present + green. Report-only per audit Ranked Gaps #2/#3."
    source: "MODULE_dental-scheduling_AUDIT_2026-06-08.md Ranked Remaining Gaps #2,#3"
ran_regen: true
regen_operationIds: [createAppointment, listAppointments, getAppointment, updateAppointment, cancelAppointment, checkInAppointment, confirmAppointment, getPublicBookingConfig, getPublicAvailability, createBookingHold, createOnlineBooking, getOnlineBooking, confirmAppointmentByToken]
circuit_breaker_tripped: none
evidence_path: docs/audits/workflow-verification/runs/dental-scheduling/
gate: { typecheck: PASS (api-ts 0, sdk-ts 0, FE 0), backend: PASS (263 pass / 0 fail per-file isolated), contract: PASS (dental-scheduling.hurl 22 req Succeed), fe_unit: PASS (126 pass / 0 fail), lint_boundaries: PASS (lint 0 errors; check:boundaries:dental-scheduling clean), smoke: pending-orchestrator }
commits: [e49e411d]
```

## Narrative

### Personas & seams
- Owning persona: Riley (staff_scheduling) — appointments + public booking, NOT check-in.
- Also drove Dr. Maria Reyes (dentist_owner) for the full happy path and check-in (which staff_scheduling cannot do).
- RBAC negatives: patient NOT cancel/check-in; hygienist NOT check-in general visits; staff_scheduling NOT check-in. FE-level negatives driven via PIN (hidden controls / route guards). Backend-403 negatives are pinned at the unit/contract layer per the RBAC-PIN backend-identity caveat (demo PIN switches the FE profile but not the backend identity).
- Section 4 seam (this module's side): X1->X2 — book -> check-in CREATES a visit (BR-004, visitType general/hygiene) -> visit state=active. Asserts BR-SCH-001 (branch-scoped, assertBranchAccess), BR-SCH-004 (working hours except walk-in), BR-002 (no double-active visit per patient globally — findInProgressVisitByPatient -> 409 CHECKIN_ACTIVE_VISIT). Verified at the contract + backend layers and driven in the live FE.

### STEP 3a — static contract diff (highest yield) -> 1 confirmed Type-A drift
Compared each scheduling operationId across .tsp <-> generated validator <-> handler toWire <-> SDK type <-> FE consumer. Found SCH-DRIFT-001 (see result block). Confirmed against the LIVE wire (GET /dental/appointments returned a no_show row with noShowAt set, no version, no confirmedVia key). The pre-fix SDK transformer revived a phantom no_showAt — concrete consumer breakage. Fixed at the true source (TypeSpec rename + toWire emit), regenerated validator/SDK/transformer, restarted the API, re-gated.

### CP plan for the live drive (Riley + owner)
1. Owner login -> PIN 123456 -> /calendar loads (happy path, calendar grid renders with branchId).
2. Book an appointment via the in-page appointment modal (create -> 201).
3. Coherence oracle: calendar day/week view appointment count == rendered appointment blocks (derived from DOM, not a fixture).
4. Affordance oracle: Check-in control reachable on a scheduled appointment as owner.
5. Check-in -> creates a visit (X1->X2 seam) -> status becomes "Checked In".
6. RBAC negative: staff_scheduling (Riley) PIN -> calendar view present but check-in affordance withheld / route-guarded; owner-only cancel withheld.
7. Cross-workflow / historical state: a checked-in appointment shows "Checked In" downstream (status persists in the calendar list).

### Gates
All STEP 6 commands green (typecheck FE+api-ts+sdk-ts, backend 263/0 per-file isolated, contract dental-scheduling.hurl 22 req Succeed, FE unit 126/0, lint 0 errors, boundaries clean). NOTE: passing the directory arg to test-with-db.ts runs all 21 files in ONE DB clone -> 89 cross-suite-collision false-fails; the real result is 263/0 with per-file isolation (matches the audit's 262/0 + 1 new test). The standing 8-file infra-fail contract baseline (storage*/imaging*/billing-lifecycle/auth-*) is unrelated and untouched.
