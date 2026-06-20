# Product Pass Backlog — dentalemon

Follow-on to the `/qa` sweep (`docs/audits/QA_SWEEP_CHECKLIST.md`). The QA sweep
cleared every **bug**; what remains are **feature gaps** — backend (SDK +
handlers) exists, but there is **no FE surface** — plus two polish items. These
are product builds, not QA fixes: each needs a placement decision and a vertical
slice, so they were deliberately deferred from the sweep.

## How we work this backlog
- **One item at a time.** Pick the next `pending` item in sequence.
- **Root cause first.** Before building, run the *Verify on pickup* checks — confirm
  the backend endpoint/SDK really exists, find whether any hidden FE caller already
  touches it, and read the relevant handler/validator/FSM. The "backend exists"
  claims below are from the live sweep; re-confirm them, don't assume.
- **Vertical TDD slice.** TypeSpec (if needed) → backend test → contract → FE test →
  FE → E2E/verify. One atomic commit per item, continue the `ISSUE-0xx` numbering
  in the QA checklist, and update **both** this file's Status and the checklist.
- **Gate per item:** relevant suite green + `bun run typecheck`, no regressions.

## Sequence (my call — value-per-effort, then dependency/unblocking)

| # | Item | Tier | Status | Source |
|---|------|------|--------|--------|
| PP-1 | Appointment **no-show** action | P0 | ✅ done (ISSUE-035) | ISSUE-024 |
| PP-2 | **Insurance-profile** create/update | P0 | ✅ done (ISSUE-036) | ISSUE-024 |
| PP-3 | **Queue-board** enqueue (check-in → queue) | P1 | ✅ done (ISSUE-037) | ISSUE-020 |
| PP-4 | **Online-booking** config (staff) | P1 | ✅ done (ISSUE-038) | ISSUE-020 |
| PP-5 | **Waitlist** management UI | P2 | ✅ done (ISSUE-039) | ISSUE-020 |
| PP-6 | **Household** add/remove/link | P2 | ✅ done (ISSUE-040) | ISSUE-024 |
| PP-7 | Dental-alerts / patient-tasks / consultations / occlusion-screening | P2 | ⬜ pending | ISSUE-024 |
| PP-8 | Discard-visit **modal** (replace `window.prompt()`) | polish | ⬜ pending | ISSUE-010 tail |
| PP-9 | iPad **768px sidebar** collapse | polish (needs design call) | ⬜ pending | ISSUE-018 |

Status legend: ⬜ pending · 🔨 in-progress · ✅ done · ⏸ blocked (needs decision)

---

## PP-1 — Appointment no-show action  · P0  — ✅ DONE (ISSUE-035)
- **Outcome:** pure FE slice — the backend (`PATCH /dental/appointments/:id {status:'no_show'}`
  → `markNoShow`), the FSM guards, and the SDK (`UpdateAppointmentRequest.status`) were all
  already in place and backend-tested. Added a `canMarkNoShow` helper (mirrors the FSM, like
  `canCancelStatus`) + a "No Show" hover button on `AppointmentCard`, threaded `onNoShow`
  through `CalendarDay`, and a `handleNoShow` in `calendar.tsx` (`throwOnError` → invalidate +
  toast, no swallow). Live-verified: scheduled appt → No Show → card flips + "Marked as no-show"
  toast, no errors. +5 unit assertions; FE suite 2598/0; typecheck clean.
- **Gap:** the appointment FSM already allows `scheduled/confirmed/checked_in → no_show`
  and the card renders a "No Show" badge, but **no FE action writes it**. The
  morning briefing even counts no-shows staff can't create.
- **Proposed placement:** appointment-card action menu, next to Confirm / Check-In / Cancel.
- **Value / effort:** high / low (likely an afternoon — one action + one mutation).
- **Verify on pickup:** confirm the SDK mutation + endpoint (transition-status / a
  dedicated no-show route); confirm the FSM guards (which from-states are legal);
  confirm zero existing FE call-sites write `no_show`; check whether the card already
  has a status-transition helper to reuse (Confirm/Check-In path).
- **Acceptance:** a "No Show" action on eligible appointments → 200 → card flips to
  No Show + list refreshes; illegal transition surfaces an error (not swallowed);
  unit + (if drivable) E2E.

## PP-2 — Insurance-profile create/update  · P0  — ✅ DONE (ISSUE-036)
- **Outcome:** FE-only slice — backend `POST/PATCH .../insurance-profiles` + the
  `listPatientInsuranceProfiles` read all existed and were backend-tested; the claim
  payer-picker already read profiles via `usePatientInsuranceProfiles`. Added an
  `InsuranceCard` (list + add/edit sheet form, `useSheetA11y`, required insurer/policy/
  subscriber + payerType/relationship/groupNumber/notes/active) on the patient profile
  next to Household, and a `useInsuranceProfileMutations` hook that invalidates the
  SAME `listPatientInsuranceProfilesQueryKey` the claim flow uses. Live-verified the
  full round-trip: created "Maxicare/PhilHealth/MX-77001" from the card → it shows in
  the card AND in the claim payer-picker without API seeding. +10 unit assertions; FE
  suite 2607/0; typecheck + lint clean. (annualLimit/accredited fields deferred.)
- **Gap:** `createInsuranceProfile` / `updateInsuranceProfile` exist with **zero FE
  call-sites**; the claim flow assumes a profile already exists, so today you must
  seed one via the API to file any claim. Real revenue-workflow blocker.
- **Placement (CONFIRMED):** patient profile → a new **Insurance card** (alongside
  the Household card) for create/edit.
- **Value / effort:** high / medium (form + create/update wiring; backend done).
- **Verify on pickup:** confirm SDK create/update signatures + required fields
  (payer, member id, plan, validity); confirm the claim flow reads the profile and
  how it keys to the patient; check cache invalidation so a freshly-created profile
  shows immediately in the claim flow (same family as the 001/002/003 cache bugs).
- **Acceptance:** create + edit an insurance profile from the patient profile card,
  persists, and the claim flow can then file against it without API seeding;
  validation + error surfacing; unit + E2E.

## PP-3 — Queue-board enqueue  · P1  — ✅ DONE (ISSUE-037)
- **Decision (you chose):** auto-enqueue on check-in (best-effort), no manual action.
- **Outcome:** backend-only slice — `checkInAppointment` now also creates a `'waiting'`
  queue item for the appointment, after the check-in commit tx, in its own
  `withTenantTx` (dental_queue_item RLS scope), wrapped so a queue failure NEVER rolls
  back a successful check-in (same posture as reminder-expiry). No dedupe guard: check-in
  is a one-way FSM transition → fires exactly once (ponytail note flags the upgrade path
  if a manual "Add to queue" is ever added). The board UI + update-status FSM already
  worked once items exist. RED→GREEN unit test + full backend batch 4581/0 + scheduling
  neighbors green; queue-board UI smoke-checked (renders, reads active branch). Live
  check-in→board round-trip not driven (seed: all candidate patients have active visits;
  today=Saturday → new bookings 422) — backend path is authoritative.
- **Gap:** `/queue-board` renders the FSM columns + auto-refresh but is **permanently
  empty** — `createQueueItem` (`POST /appointments/{id}/queue-item`) is never called,
  check-in doesn't enqueue, and the seed has no queue items. Update-status FSM is
  wired but unreachable.
- **Proposed placement:** enqueue on check-in (primary), plus an optional manual
  "Add to queue" affordance on the appointment card / queue board.
- **Value / effort:** medium / medium.
- **Verify on pickup:** confirm the enqueue endpoint + payload; decide whether
  check-in auto-enqueues or it's an explicit action (product call at pickup);
  confirm the existing `use-queue-board` update-status path is sound to build on.
- **Acceptance:** checking a patient in (or the manual action) creates a queue item
  that appears on the board; status transitions Waiting→…→Completed drive correctly.

## PP-4 — Online-booking config (staff)  · P1  — ✅ DONE (ISSUE-038)
- **Outcome:** FE-only slice — the per-branch policy lives in `settings.onlineBooking`
  JSONB (`parseOnlineBookingConfig` defaults/validates it server-side) and the public
  wizard's gate reads `config.enabled`; the owner-only `PUT /branches/:id/settings`
  write path + the `useBranchSettings`/`useUpdateBranchSettings` hooks already existed.
  Added an **OnlineBookingSettings** panel (registered in `settings-panels.tsx` as
  "Online Booking") with the enable toggle + bookable visit types + lead-time/horizon/
  slot-step + require-auth, saved via the shared branch-settings endpoint. Live-verified
  the round-trip: `/book/$branchId` went from "Online booking unavailable" → after
  enabling in Settings → bookable (Check-up / Recall-Hygiene / provider / times). +6
  unit assertions; FE suite 2613/0; typecheck + lint clean. Schedule-exceptions +
  provider allow-list (stays 'all') scoped out per the backlog's "separately if it balloons".
- **Gap:** `createOnlineBooking` is only used by the public `/book/$branchId` wizard;
  there is **no staff surface** to enable/configure online booking — which is why the
  public page shows "Online booking unavailable." Schedule-exceptions UI also absent.
- **Proposed placement:** Settings → Online Booking (enable toggle + config); consider
  schedule-exceptions here too.
- **Value / effort:** medium / medium.
- **Verify on pickup:** confirm the config endpoint + shape (what "enabled" means
  server-side, per-branch); confirm the public wizard's "unavailable" gate reads the
  same flag; scope schedule-exceptions separately if it balloons.
- **Acceptance:** staff enable + configure online booking → the public `/book/$branchId`
  page becomes bookable; round-trip verified.

## PP-5 — Waitlist management UI  · P2  — ✅ DONE (ISSUE-039)
- **Decision (you chose):** calendar slide-over panel (sibling of the Recare panel).
- **Outcome:** FE-only — `listWaitlist` (GET, default active) + `promoteWaitlistEntry`
  (books a `scheduled` appointment + marks the entry scheduled) already existed; added a
  `WaitlistPanel` toggled from the calendar top bar that lists active entries and fills a
  slot via an inline date/time/duration/provider/visit-type form → `POST /waitlist/:id/
  promote`. `useWaitlist` invalidates both the waitlist key AND the appointments list on
  promote. Live-verified end-to-end: seeded an active entry → it appeared in the panel →
  "Fill slot" → "Slot filled from the waitlist" toast → entry dropped off the active list
  (booked). +10 unit assertions; FE suite 2618/0; typecheck + lint clean.
- **Scope:** view + promote (the endpoints that exist). **Cancel/remove deferred** — no
  backend endpoint exists. Patient names show as truncated ids (same as the queue board;
  no server-side name enrichment yet). Add-from-staff is a possible follow-up.
- **Gap:** `createWaitlistEntry` / `promoteWaitlistEntry` exist server-side but are
  only referenced by the public `BookingWizard`; no staff waitlist surface.
- **Proposed placement:** a waitlist panel on the calendar, or a dedicated route.
- **Value / effort:** medium / medium-high.
- **Verify on pickup:** confirm endpoints + promote semantics (waitlist → appointment);
  decide placement (calendar panel vs route) at pickup.

## PP-6 — Household add/remove/link  · P2  — ✅ DONE (ISSUE-040)
- **Outcome:** made the read-only `HouseholdCard` interactive. Empty state → "Create
  household" (this patient becomes the guarantor; name input → `POST /dental/households`).
  Existing household → "Add member" (patient search via `usePatients` → select →
  relationship → `POST /households/:id/members`) + a "Remove" on each non-guarantor
  member (`DELETE /households/:id/members/:patientId`; the guarantor has no Remove,
  mirroring the backend `GUARANTOR_NOT_REMOVABLE` rule). `useHouseholdMutations`
  invalidates the patient's household query so the card re-renders immediately.
  Live-verified end-to-end (empty → created "Dela Cruz Family" → added Maria Santos as
  spouse → removed her → back to guarantor-only). +14 unit assertions; FE suite 2621/0;
  typecheck + lint clean. GOTCHA captured: `listDentalPatients` returns a `{data:[…]}`
  envelope (SDK transformer does `data.data.map`) — the member-search test mock must
  return that shape, not a bare array.
- **Gap:** `HouseholdCard` is read-only; `createHousehold` / `addHouseholdMember` /
  `removeHouseholdMember` exist with zero FE call-sites.
- **Proposed placement:** make the existing patient-profile Household card interactive.
- **Value / effort:** medium / medium.
- **Verify on pickup:** confirm endpoints + member-linking model (search/select a
  person, primary designation); `HouseholdRepository.createOne` uses an internal tx
  (RLS note in memory) — confirm no surprises.

## PP-7 — Dental-alerts / patient-tasks / consultations / occlusion-screening  · P2
- **Gap:** `createDentalAlert` / `createPatientTask` / `createConsultation` /
  `createOcclusionScreening` all exist; **no FE file even references these nouns.**
- **Proposed placement:** workspace (clinical) surfaces — likely separate slices per noun.
- **Value / effort:** low / medium (niche; lowest traffic). **Split into 4 sub-slices**
  when picked up — do not batch.
- **Verify on pickup:** for each noun, confirm the endpoint + where in the clinical
  flow it belongs; this cluster may be partly descoped if low demand.

## PP-8 — Discard-visit modal (replace `window.prompt()`)  · polish
- **Gap:** discarding a visit uses a native `window.prompt()` for the reason
  (`apps/dentalemon/src/routes/_workspace/$patientId.tsx`, ~the discard handler) —
  works, but inaccessible and off-brand. No product decision needed.
- **Proposed fix:** a small modal (reason textarea + the existing min-5-char
  validation) reusing the hand-rolled-overlay + `useSheetA11y` pattern.
- **Value / effort:** low / low.
- **Verify on pickup:** find the exact handler + confirm the min-length validation
  currently enforced so the modal preserves it.

## PP-9 — iPad 768px sidebar collapse  · polish (NEEDS DESIGN CALL)
- **Gap:** at iPad-portrait 768px the sidebar does **not** auto-collapse → the billing
  invoices table clips the Status column and the page widens to 1024. Root: the global
  shadcn sidebar mobile breakpoint is `<768`, which excludes 768px tablets.
- **Blocked on:** one design decision — collapse the sidebar ≤1024px, or shrink the
  inset/table instead? Pick the rule, then it's a small change.
- **Value / effort:** medium / low (once the rule is decided).

---

*Derived from the 2026-06-20 `/qa` sweep (sessions 1–7). See
`docs/audits/QA_SWEEP_CHECKLIST.md` for the bug history and the ISSUE-020/024/018/010
source flags.*
