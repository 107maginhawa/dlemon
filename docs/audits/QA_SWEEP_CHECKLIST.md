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

### Auth & session — **swept live 2026-06-20** ✅ clean
- [x] ✅ email/password sign-in · PIN select + entry · land on dashboard · wrong password → "Invalid email or password" toast (password cleared)
- [x] ✅ sign out → returns to `/auth/sign-in`
- [x] ✅ magic link (`/auth/magic-link` → "Check your email for the magic link") · email code (`/auth/email-otp` → "Verify code" entry + "check your email") · passkey (button present, no crash; WebAuthn not drivable headless — no authenticator)
- [x] ✅ forgot password (empty → "Email is invalid"; valid → "Check your email for the password reset link") · sign up (renders Name/Email/Password; email-format validation blocks)
- [x] ✅ PIN inactivity lock + refresh-clears-PIN (by design — `pin-session.ts`)

### Dashboard — **quick-actions swept live 2026-06-20** ✅ clean
- [x] ✅ load + KPIs + seeded data + console clean
- [x] ✅ quick actions: New Patient → `/patients` · New Appointment → `/calendar` · Open Workspace → `/patients` (picker) — all navigate
- [x] ✅ links: Today's Schedule "View all" → `/calendar` · Daily Collections "Details" → `/billing` · Overdue Alerts "View all" → `/billing` · Pending Treatments "View all" → `/patients` · Payment Plans "Manage" → `/billing` · Tomorrow Preview "Open Calendar" → `/calendar` — all navigate correctly

### Patients — list
- [x] ✅ list load · search
- [ ] ⬜ filter tabs (All / Active / Needs Follow-Up / Archived)
- [ ] ⬜ select-all + bulk archive
- [ ] ⬜ export CSV (dentist-owner only)
- [ ] ⬜ find-duplicates panel → review & merge
- [x] ✅ register patient (ISSUE-001)

### Patients — profile/record — **profile surface swept live 2026-06-20**
- [x] ✅ edit demographics — **live**: first-name-required + email-format validation enforced (form stays open, no save); valid save persists; **fixed ISSUE-015** (phone with spaces silently 400'd — now normalized to E.164 + clear guidance)
- [x] ✅ follow-up notes — min-length gate (5 chars → Add disabled) + add persists in Follow-up Log
- [x] ✅ Payment History tab renders (invoices + Outstanding Balance ₱) · Household section renders ("not linked" state)
- [ ] 🟢 contacts add/edit/delete · household add/remove · recalls create/update/dispatch · communication consent toggle · insurance profiles · conditions · credits add/apply — **workspace/list-resident** (patient sub-nav `Imaging/Perio/Recalls/Plans/Export` + `_dashboard/patients.tsx`), not on the profile page; overlap the Workspace batch; chart-cell/signature parts headless-limited
- [ ] 🟢 merge / unmerge duplicates — patients-list find-duplicates panel (not profile detail)
- [ ] 🟢 archive / restore — patients-**list** bulk action (no profile-page control; refresh ✅ prior); deactivate/statement/PMD export/erasure are list/workspace/platform-admin surfaces

**Patients-detail finding (2026-06-20):** **fixed ISSUE-015** — Edit Patient Details phone validation allowed spaces but server requires strict E.164 → natural PH numbers 400'd with a generic "Could not save changes". Now normalized to E.164 on submit + regression test.

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

### Settings — **swept live 2026-06-20**
- [x] ✅ clinic info save → **persists** (DB JSONB `branch.settings`) + required-field validation. Nit: form doesn't default from existing branch name/address (separate store) — first-run empty.
- [x] ✅ working hours load (seeded) + **start<end validation** (DB unchanged on invalid save)
- [x] ✅ fee schedule — negative price rejected (server: `priceCents >=0`) · valid edit **persists** (per-branch override in `branch.settings.feeSchedule`, catalog defaults in `dental_procedure_code`)
- [x] ✅ payment terms (Net 30 → `defaultPaymentTermsDays`) · tax/VAT (toggle → `taxMode`, restored) · reminder cadence (render) · locale (render) · notifications (toggle → `notificationPreferences`) — all save+persist. BIR receipt details saved with clinic info (`tin`/`registeredName`/`businessStyle`).
- [x] ✅ consent form templates **CRUD** (create/edit/soft-delete all persist) · treatment templates create (w/ items array, centavos) + soft-delete ✅ — **fixed ISSUE-006** (seed non-idempotency: 66 dupes from 22 reseeds; now reuses by name)
- [x] ✅ audit log view (live events incl. this session's settings writes) + event-type filter works · ⬜ postop templates (no UI surface found)
- [x] ✅ data erasure — informational by design (platform-admin operated; no destructive clinic-role form)

**Settings-batch findings (2026-06-20):** ISSUE-006 consent/treatment template duplication **FIXED** (`scripts/seed-demo.ts` now idempotent). Existing 66 dev-DB dupes clear on next `bun run db:reseed` (bulk DB cleanup declined as out-of-scope/destructive).

### Staff — **swept live 2026-06-20** ✅ clean
- [x] ✅ member list (Ana Santos staff_full + Dr. Reyes owner; owner shows "cannot deactivate" gate)
- [x] ✅ create member (PIN-mismatch validation ✅ · Dentist-Owner role disabled "already assigned" ✅ · list refreshes) · permissions update (role change staff_full→staff_scheduling persists)
- [x] ✅ update member (name + role persist) · deactivate (status→inactive) · reset PIN (argon2 hash changes)

### Case presentation — **swept live 2026-06-20**
- [x] ✅ viewer / presentation mode — accepted presentation shows signed-acceptance read-back (signer + timestamp + phased ₱); draft shows interactive patient surface ("Diego, here is your treatment plan", phases, options A/B, name + signature)
- [x] ✅ accept gate (name + signature both required; Accept disabled w/o signature — canvas headless-limited) · reject/decline drivable (reason popover → confirm) · accept treatment option (option-group A/B "Recommended" badge renders) · 🟢 create (Present-to-patient button gated to `presented`-status plan; no presented plan in seed to drive — FSM exercised via seed draft/accepted/rejected rows)
- **fixed ISSUE-014** — accept/decline failures were **swallowed** (panel `void reject()`, hook no error state). Declining an already-approved plan 422'd silently with zero patient feedback. Now surfaces a patient-facing error banner + regression test. Same family as ISSUE-013.

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

## Cross-cutting (run against every module) — **swept live 2026-06-20**
- [x] ✅ **Role: Staff (Ana Santos, staff_full)** — sidebar correctly hides Reports/Staff/Settings (admin gated); **fixed ISSUE-016** (patient CSV export was shown to staff + 403'd silently — now owner-gated + surfaced). ⚠ **ISSUE-017 (flagged, not fixed):** sidebar footer shows the Better-Auth account name "Dr. Maria Reyes" even when the **Ana Santos** profile is active (role IS Ana's). Root: `app-sidebar.tsx` uses `session.user.name`; org-context store has only `memberId`/`role`, not the member displayName. Fix = plumb active member name through org-context (touches PIN-select + store + sidebar — deferred for design confirmation).
- [ ] 🟢 Empty states — not driven (seed is data-rich); spot-checked: notifications "all caught up", portal/public-booking graceful states ✅ (prior)
- [x] ✅ Loading + error states — error surfacing exercised throughout; **3 swallowed-error bugs found+fixed** this batch set (ISSUE-013-family): 014 case-presentation accept/decline, 015 patient phone 400, 016 export 403
- [x] ✅ Console errors per page (breadth sweep — clean except OneSignal/runtime-config dev noise)
- [x] ✅ Responsive / iPad — calendar **clean** at 768px portrait (no h-overflow). ⚠ **ISSUE-018 (flagged, not fixed):** billing invoices table overflows at iPad-portrait 768px (Status column clipped, whole page widens to 1024) because the sidebar does **not** auto-collapse at exactly 768px (manually collapsing it → fits). Root = global shadcn sidebar mobile breakpoint (`<768` excludes 768px tablets); fix is a tablet-UX design decision (collapse ≤1024 or shrink inset) — deferred.
- [x] 🟢 Accessibility — `main` + single `h1` landmarks present; **gaps:** sidebar nav has no `role=navigation`/`<nav>` (0 found) and ~6 icon-only buttons lack `aria-label`. Minor; noted for an a11y pass.

**Cross-cutting findings (2026-06-20):** **fixed ISSUE-016** (export gate + swallowed 403). **Flagged (need design/arch decision, not fixed):** ISSUE-017 sidebar shows account name not active member profile · ISSUE-018 iPad-portrait 768px sidebar non-collapse → billing table overflow · a11y nav-landmark + icon-button-label gaps.

## Known non-bugs / by-design (don't re-file)
- PIN clears on refresh — intentional kiosk security (`pin-session.ts`).
- OneSignal init error + runtime-config HTML fallback + `/readyz` 503 — dev `.env` / MinIO down, not product bugs.
- Calendar "+ Book" labels overlap booked cards — cosmetic.
- Two E2E fixture patients (`J21`/`J22`) in the demo seed — seed hygiene nit.
- New Appointment / dentist fields use raw UUID inputs — flagged UX (needs picker), not a defect.
