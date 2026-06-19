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

### Calendar / scheduling
- [x] ✅ day view load · cancel (ISSUE-002) · create validation (ISSUE-005)
- [ ] ⬜ week / month views
- [ ] ⬜ **full appointment create** (with dentist) → persists + shows on calendar
- [ ] ⬜ edit appointment
- [ ] ⬜ check-in · confirm · no-show
- [ ] ⬜ walk-in
- [ ] ⬜ recare-due list → reach out
- [ ] ⬜ queue board (create / update status)
- [ ] ⬜ waitlist (create / promote)
- [ ] ⬜ online-booking config · schedule exceptions

### Workspace (clinical) — ❗ HIGHEST-VALUE GAP (never driven live)
- [ ] ⬜ open workspace (`/_workspace/$patientId`) · queue board
- [ ] ⬜ **start visit** · discard visit
- [ ] ⬜ dental charting — tooth states / surfaces / update tooth
- [ ] ⬜ initialize dentition
- [ ] ⬜ add finding → convert finding to treatment
- [ ] ⬜ treatment plan create / accept / approve · treatment options accept
- [ ] ⬜ apply template · carry-over treatments · mark treatment done
- [ ] 🟢 prescriptions (Rx) create (validation static — drive live)
- [ ] ⬜ SOAP/visit notes save / sign / addendum
- [ ] ⬜ perio chart create / complete / tooth readings
- [ ] ⬜ medical history entries + review
- [ ] ⬜ dental alerts · patient tasks · consultations · occlusion screening
- [ ] ⬜ consent forms sign / refuse · amendments create / approve
- [ ] ⬜ lab orders create / update
- [ ] ⬜ chart conflicts resolve (offline sync)
- [ ] 🟢 workspace payment (create invoice & pay)
- [ ] 🚫 attachments upload (MinIO)

### Billing
- [x] ✅ list + totals · issue invoice (live)
- [ ] ⬜ tabs: Paid / Partial / Outstanding / Overdue / Collections / Insurance
- [ ] ⬜ invoice create · finalize · delete
- [ ] 🟢 void invoice
- [ ] 🟢 record payment (validation confirmed; drive live — needs amount+method+receipt)
- [ ] 🟢 void payment · refund payment · apply discount
- [ ] 🟢 payment plans create / view
- [ ] 🟢 insurance claims (draft / status / lines / remittance / coverage estimate)
- [ ] 🟢 collections (notes / worklist / mark-uncollectible)
- [ ] 🟢 patient credits (add / apply) · statements (generate / send)
- [ ] ⬜ AR aging / KPIs render

### Reports
- [x] ✅ page load
- [ ] ⬜ each report type renders with data
- [ ] ⬜ filters · export

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

### Notifications
- [ ] ⬜ bell list renders
- [ ] 🟢 mark read / mark all read

### Onboarding
- [ ] ⬜ org / dental onboarding wizard (create org → activate)

### Portal (patient-facing `_portal`) — never touched
- [ ] ⬜ portal index · my appointments · my bills

### Public booking
- [ ] ⬜ `book.$branchId` (thin route — confirm it renders / books)

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
