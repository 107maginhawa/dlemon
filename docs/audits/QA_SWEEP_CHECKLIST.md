# QA Sweep Checklist — dentalemon

Master tracker for systematic `/qa` coverage. Drive a session by picking the next
unchecked batch and prompting, e.g.:

> `/qa` — execute the next pending batch from `docs/audits/QA_SWEEP_CHECKLIST.md`
> (Workspace clinical journey), live in the browser. Update statuses here when done.

## Status legend
- ✅ **live** — driven end-to-end in the browser, verified (DB/console/UI)
- 🟢 **static** — code-reviewed (validation / error-handling / refresh) but not browser-driven
- ⬜ **pending** — not yet covered
- 🚫 **blocked** — environment blocker (see notes)

## Dimensions (check each per flow)
`refresh` (list/detail updates after write) · `validation` (required/edge inputs) ·
`errors` (failures surfaced, not swallowed) · `data` (correct fields/units persisted) ·
`crash` (no console errors / unguarded access)

## Environment prerequisites
- API `:7213` + web `:3003` up; Postgres `monobase`. Build spec first: `cd specs/api && bun run build`.
- Demo login `demo@dentalemon.com` / `DemoClinic1!` → PIN `1 2 3 4 5 6`. Profiles: **Dr. Maria Reyes (Dentist-Owner)**, **Ana Santos (Staff)**.
- ⚠️ **PIN inactivity lock = 5 min** — full page reload (`goto`) clears the PIN session; navigate **client-side** between flows. (During QA you may temporarily raise `INACTIVITY_TIMEOUT_MS` in `apps/dentalemon/src/lib/pin-session.ts`, but **revert before committing**.)
- 🚫 **Imaging/Ceph need MinIO/S3** (`bun run infra:up`) — currently down → those flows are code-review only until infra is up.
- New Appointment + payment modals use **controlled inputs** the headless driver struggles with — use the browse `fill` command, or verify in DB + treat as code-verified if it won't submit.

---

## ✅ Already done this session (do not redo)
Fixes committed `9421c956`→`b31def48`; gates green (typecheck 0, 1290 tests):
- **ISSUE-001** patient registration list refresh — fixed + **live-verified** + regression test.
- **ISSUE-002** calendar refresh after appointment write — fixed + **live-verified** (cancel).
- **ISSUE-003** billing list/totals refresh after invoice write — fixed (code-verified).
- **ISSUE-004** ceph latest-report refresh — fixed (LOW, code-verified; imaging blocked).
- **ISSUE-005** New Appointment requires dentist (was opaque 400) — fixed + **live-verified**.
- **Cache-invalidation dimension: swept exhaustively across all 59 write surfaces — clean app-wide.**
- **Swallowed-error scan: clean app-wide** (no `catch(()=>{})` / ignored `response.ok`).

---

## Module checklists

### Auth & session
- [x] ✅ email/password sign-in · PIN select + entry · land on dashboard
- [ ] ⬜ sign out → returns to sign-in
- [ ] ⬜ magic link / email code / passkey sign-in
- [ ] ⬜ forgot password · sign up
- [x] ✅ PIN inactivity lock + refresh-clears-PIN (by design — `pin-session.ts`)

### Dashboard
- [x] ✅ load + KPIs + seeded data + console clean
- [ ] ⬜ quick actions (New Patient / New Appointment / Open Workspace) navigate correctly
- [ ] ⬜ "View all" / "Details" / "Manage" / "Open Calendar" links

### Patients — list
- [x] ✅ list load · search
- [ ] ⬜ filter tabs (All / Active / Needs Follow-Up / Archived)
- [ ] ⬜ select-all + bulk archive
- [ ] ⬜ export CSV (dentist-owner only)
- [ ] ⬜ find-duplicates panel → review & merge
- [x] ✅ register patient (ISSUE-001)

### Patients — profile/record
- [ ] 🟢 edit demographics (validation static — drive live)
- [ ] ⬜ contacts add/edit/delete
- [ ] ⬜ household add/remove member
- [ ] ⬜ recalls create/update/dispatch
- [ ] ⬜ follow-up notes
- [ ] ⬜ communication consent toggle
- [ ] ⬜ insurance profiles · conditions
- [ ] ⬜ merge / unmerge duplicates (data: survivor correctness)
- [ ] 🟢 credits add/apply
- [ ] ⬜ deactivate · patient statement · care-record/PMD export · erasure request
- [ ] 🟢 archive / restore (refresh ✅; drive live)

### Calendar / scheduling — **swept live 2026-06-20**
- [x] ✅ day view load · cancel (ISSUE-002) · create validation (ISSUE-005)
- [x] ✅ week view (**fixed ISSUE-011** — was showing patient UUIDs, now names) · ✅ month view (count badges + dots)
- [ ] 🟢 **full appointment create** — modal + validation verified; raw UUID inputs (flagged UX) + controlled date/time hard to drive headless
- [x] ✅ edit appointment (**fixed ISSUE-012** — modal opened blank, now pre-fills patient/date/time/duration/service)
- [x] ✅ check-in · confirm (**fixed ISSUE-013** — failures showed false success; now surface real error e.g. "Visit already active") · ⬜ no-show
- [ ] 🟢 walk-in (+ Walk-In button present; modal = same as create)
- [ ] ⬜ recare-due list → reach out
- [ ] ⬜ queue board (create / update status)
- [ ] ⬜ waitlist (create / promote)
- [ ] ⬜ online-booking config · schedule exceptions

**Calendar-batch findings (2026-06-20):** ISSUE-011 week-view UUIDs (FIXED) · ISSUE-012 edit modal blank (FIXED) · ISSUE-013 check-in/confirm false-success (FIXED).

### Workspace (clinical) — ❗ HIGHEST-VALUE GAP — **swept live 2026-06-20** (Juan dela Cruz, open visit)
- [x] ✅ open workspace (`/$patientId`) — renders clean (chart + layers + allergy badge); console clean
- [x] ✅ **start visit** (gating verified — disabled while a visit is open, w/ explanation) · ✅ discard visit (native `prompt()` for reason, min-5-char validation enforced — see ISSUE-010)
- [ ] 🟢 dental charting — tooth states / surfaces / update tooth (chart renders; SVG cell entry not drivable headless — unit-tested)
- [ ] 🟢 initialize dentition (code-verified; needs pristine patient)
- [ ] 🟢 add finding → convert finding to treatment (chart interaction — headless-limited)
- [x] ✅ treatment plan **accept** (POST `/treatment-plan/accept` → 201) · 🟢 create/approve · treatment options accept — **see ISSUE-008** (no UI feedback + re-clickable/non-idempotent)
- [x] ✅ apply template (Grand Total ₱5,500→₱9,500) · 🟢 carry-over treatments · ✅ mark treatment done (moved to Completed, pending 2→1)
- [x] ✅ prescriptions (Rx) create (validation ✅ + saved + persists in Prescriptions tab) — **see ISSUE-007** (no drug-allergy warning)
- [x] ✅ SOAP/visit notes save ✅ / sign & lock ✅ / addendum ✅ (Note History 1→2)
- [x] ✅ perio chart create (Draft exam) · complete correctly gated/disabled until readings · 🟢 tooth readings (cell entry headless-limited)
- [ ] 🟢 medical history entries + review (View Medical History present — not driven)
- [ ] ⬜ dental alerts · patient tasks · consultations · occlusion screening
- [ ] 🟢 consent forms — modal + template select pre-fills ✅; sign gated on signature canvas (headless-limited) · refuse/amendments not driven — **see ISSUE-006** (template dup)
- [x] ✅ lab orders create ✅ (toast + persists) / update ✅ (Ordered → In Fabrication)
- [ ] 🟢 chart conflicts resolve (offline sync) — code only
- [x] ✅ workspace payment — modal + invoice detail + Record Payment form render ✅; submission code-verified (controlled inputs behind fixed footer) — **see ISSUE-009** (due-date raw ISO)
- [ ] 🚫 attachments upload (MinIO)

**Workspace-batch findings (2026-06-20):** ISSUE-006 template duplication · ISSUE-007 no drug-allergy warning · ISSUE-008 Accept-Plan no-feedback/non-idempotent · ISSUE-009 invoice due-date raw ISO · ISSUE-010 workspace modals not Escape-dismissible + discard uses native prompt(). See `.gstack/qa-reports/`.

### Billing — tabs swept live 2026-06-20
- [x] ✅ list + totals · issue invoice (live)
- [x] ✅ tabs render: Invoices (Paid/Partial/Outstanding/Overdue sub-tabs) · Collections · Insurance (claim-status sub-tabs + empty state). Invoice detail opens from list (due-date now formatted — ISSUE-009 fix applies here too).
- [ ] ⬜ invoice create · finalize · delete
- [ ] 🟢 void invoice
- [ ] 🟢 record payment (validation confirmed; drive live — needs amount+method+receipt)
- [ ] 🟢 void payment · refund payment · apply discount
- [ ] 🟢 payment plans create / view
- [ ] 🟢 insurance claims (draft / status / lines / remittance / coverage estimate)
- [ ] 🟢 collections (notes / worklist / mark-uncollectible)
- [ ] 🟢 patient credits (add / apply) · statements (generate / send)
- [ ] ⬜ AR aging / KPIs render

### Reports — **swept live 2026-06-20** ✅ clean
- [x] ✅ page load
- [x] ✅ each report type renders with data (Revenue: billed/collected/outstanding KPIs + invoices; Treatment: 27 CDT codes/104 tx/₱725k; Patient: 22 active + reg dates)
- [ ] 🟢 filters (date range present) · export (Export CSV present — not driven)

### Settings
- [ ] 🟢 clinic info save → persists on reload
- [ ] 🟢 working hours (validation: start<end confirmed) — drive live
- [ ] 🟢 fee schedule (min=0, cents — confirmed) — drive live
- [ ] ⬜ payment terms · tax/VAT · BIR receipt details · reminder cadence · locale · notifications
- [ ] 🟢 consent form templates · treatment templates (create/update/delete)
- [ ] ⬜ audit log view · postop templates
- [ ] 🟢 data erasure

### Staff
- [ ] ⬜ member list
- [ ] 🟢 create member · 🟢 permissions update
- [ ] ⬜ update member · deactivate · set/reset PIN

### Case presentation
- [ ] 🟢 create · accept / reject · accept treatment option (pending guards + errors OK)
- [ ] ⬜ viewer / presentation mode

### Imaging / Ceph — 🚫 blocked (MinIO down; bring up `infra:up`)
- [ ] 🚫 upload image
- [ ] 🟢 image metadata / modality / calibration (math reviewed clean)
- [ ] 🟢 measurements · imaging findings
- [ ] 🟢 ceph report create (ISSUE-004 fixed) · ceph landmarks
- [ ] ⬜ superimposition · occlusion screening

### Notifications — **swept live 2026-06-20**
- [x] ✅ bell list renders ("You're all caught up" empty state — no seeded notifs)
- [ ] 🟢 mark read / mark all read (no notifications to drive)

### Onboarding
- [ ] ⬜ org / dental onboarding wizard (create org → activate)

### Portal (patient-facing `_portal`) — **swept live 2026-06-20**
- [x] ✅ portal layout renders (My Appointments + bottom nav Appointments/Bills + Sign out); 403 for staff session handled gracefully ("Try again" card, no crash). Happy path needs a patient login (out of scope for staff QA).

### Public booking — **swept live 2026-06-20**
- [x] ✅ `book/$branchId` renders — graceful "Online booking unavailable" state (online-booking not enabled for branch in seed). Actual booking needs online-booking config enabled first.

---

## Cross-cutting (run against every module)
- [ ] ⬜ **Role: Staff (Ana Santos)** — re-run key flows; verify permission gates (cancel, export, billing are owner/staff_full only)
- [ ] ⬜ Empty states (no patients / no appointments / no invoices)
- [ ] ⬜ Loading + error states (network failure surfaced)
- [x] ✅ Console errors per page (breadth sweep — clean except OneSignal/runtime-config dev noise)
- [ ] ⬜ Responsive / iPad (calendar + tables; known prior iPad overflow fix)
- [ ] ⬜ Accessibility pass (landmarks, focus, labels)

## Known non-bugs / by-design (don't re-file)
- PIN clears on refresh — intentional kiosk security (`pin-session.ts`).
- OneSignal init error + runtime-config HTML fallback + `/readyz` 503 — dev `.env` / MinIO down, not product bugs.
- Calendar "+ Book" labels overlap booked cards — cosmetic.
- Two E2E fixture patients (`J21`/`J22`) in the demo seed — seed hygiene nit.
- New Appointment / dentist fields use raw UUID inputs — flagged UX (needs picker), not a defect.
