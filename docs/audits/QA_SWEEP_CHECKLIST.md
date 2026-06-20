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

### Patients — list — **swept live 2026-06-20 (session 3)**
- [x] ✅ list load · search
- [x] ✅ filter tabs (All 22 / Active 22 / Needs Follow-Up 3 / Archived 0) — counts correct
- [x] ✅ select-all + bulk archive — select-all cascades + "Archive Selected (N)" bulk bar; archive **confirm-gated** + list refresh; restore round-trip verified (Archived→Active)
- [x] ✅ export CSV (dentist-owner only) — real `text/csv` Blob download, quote-escaped, owner-gated error surface (ISSUE-016 fix holds). Cols id/name/status/createdAt per FR2.13.
- [x] ✅ find-duplicates panel — detection ✅ (strong name+DOB match); **fixed ISSUE-019** (panel showed 5-min-stale "no duplicates" after a create — patient writes didn't invalidate `detectDuplicatePatients`). ⚠ **flagged: merge UI missing** — "Review & merge" links to the patient profile, which has **no merge control**; `mergePatients` SDK is never called from the FE (backend endpoint exists, unused).
- [x] ✅ register patient (ISSUE-001)

**Patients-list findings (2026-06-20 s3):** **fixed ISSUE-019** (duplicates-query stale cache, same family as 001/002/003 — `isPatientCollectionQuery` predicate now invalidates list + duplicates across create/archive/restore/bulk/update; +4 regression tests; reproduced + GREEN-verified live). **Flagged (feature gap, not fixed): merge UI absent** — review-&-merge is a dead-end; needs design (primary selection + field conflict resolution).

### Patients — profile/record — **profile surface swept live 2026-06-20**
- [x] ✅ edit demographics — **live**: first-name-required + email-format validation enforced (form stays open, no save); valid save persists; **fixed ISSUE-015** (phone with spaces silently 400'd — now normalized to E.164 + clear guidance)
- [x] ✅ follow-up notes — min-length gate (5 chars → Add disabled) + add persists in Follow-up Log
- [x] ✅ Payment History tab renders (invoices + Outstanding Balance ₱) · Household section renders ("not linked" state)
- [x] **contacts** = email/phone via Edit form only (covered s2 ISSUE-015); **no separate multi-contact/emergency-contact entity UI** (`person.contact` SDK only patches email/phone). · **recalls** create/dispatch ✅ **driven (s4)** (workspace Recalls sheet, see Calendar recare). · **credits add/apply** ✅ **driven (s4, fixed ISSUE-023)**.
- [x] ⚠ **household add/remove/link — GAP (ISSUE-024)**: `HouseholdCard` is **read-only** ("not linked" / member summary); `createHousehold`/`addHouseholdMember`/`removeHouseholdMember` exist in the SDK with **zero FE call-sites**. No staff UI to form/link a household.
- [x] ⚠ **insurance profiles — GAP (ISSUE-024)**: `createInsuranceProfile`/`updateInsuranceProfile` exist with **zero FE call-sites**; the claim flow assumes a profile already exists. Seeded one via API in s4 to drive the claim lifecycle (see Billing).
- [x] ✅ **conditions** = the **medical-history form** (conditions/meds/allergies checkboxes + ASA) — **driven (s4)**, see Workspace.
- [ ] 🟢 merge / unmerge duplicates — patients-list find-duplicates panel (not profile detail)
- [ ] 🟢 archive / restore — patients-**list** bulk action (no profile-page control; refresh ✅ prior); deactivate/statement/PMD export/erasure are list/workspace/platform-admin surfaces

**Patients-detail finding (2026-06-20):** **fixed ISSUE-015** — Edit Patient Details phone validation allowed spaces but server requires strict E.164 → natural PH numbers 400'd with a generic "Could not save changes". Now normalized to E.164 on submit + regression test.

### Calendar / scheduling — **swept live 2026-06-20**
- [x] ✅ day view load · cancel (ISSUE-002) · create validation (ISSUE-005)
- [x] ✅ week view (**fixed ISSUE-011** — was showing patient UUIDs, now names) · ✅ month view (count badges + dots)
- [x] ✅ **full appointment create** — **driven end-to-end (s4)**: New-Appointment modal filled (patient UUID + dentist UUID + date + 15:00 + Emergency) → `POST` 201 → card "Diego Ramos, 3:00 PM, emergency, Scheduled" appears with Confirm/Check-In/Cancel. Closes the prior code-verified-only caveat (the date/time **textboxes accept `fill`** — not the controlled pickers we feared). Raw-UUID inputs still a flagged UX nit (needs picker).
- [x] ✅ edit appointment (**fixed ISSUE-012** — modal opened blank, now pre-fills patient/date/time/duration/service)
- [x] ✅ check-in · confirm (**fixed ISSUE-013**) · ⚠ **no-show — GAP (ISSUE-024)**: backend FSM allows `scheduled/confirmed/checked_in → no_show` and the card renders a "No Show" badge, but **no FE action sets it** (zero call-sites write `no_show`; appointment-card only exposes Confirm/Check-In/Cancel). Morning-briefing even counts no-shows staff can't create.
- [x] ✅ **walk-in — driven (s4)**: "+ Walk-In" opens the New-Appointment modal with NOTES prefilled "Walk-in appointment"; created live (Diego 3 PM emergency). Same create path as above.
- [x] ✅ recare-due list — **fully driven (s4)**: created recalls in the workspace Recalls sheet (Check-up + Cleaning), dispatched (Mark Sent), and they propagate to Calendar → "Recare due" (badged Due/Reminded). **Drove "Reach out"** end-to-end (pending → 200 → Reminded). **Fixed ISSUE-022** — "Reach out" was offered on already-"Reminded" recalls where it PATCHes `sent→sent` (422, invalid FSM) and the bare `catch{}` swallowed it → silent no-op; now the button is suppressed for sent recalls + errors surface.
- [x] ⚠ queue board — page renders (`/queue-board`, FSM columns Waiting→Called→In Progress→Completed, auto-refresh 15s, empty state). **GAP (ISSUE-020): no FE way to populate it** — `createQueueItem` (`POST /appointments/{id}/queue-item`) is never called from the FE, check-in doesn't enqueue, seed has no queue items. Update-status FSM is wired (`use-queue-board` + tests) but unreachable without items.
- [x] ⚠ waitlist — **GAP (ISSUE-020): no staff UI** — `createWaitlistEntry`/`promoteWaitlistEntry` exist server-side but are only referenced by the public `BookingWizard`; no staff waitlist management surface.
- [x] ⚠ online-booking config — **GAP (ISSUE-020): no staff config UI** — `createOnlineBooking` only used in the public `/book/$branchId` wizard; no staff surface to enable/configure online booking (this is why the public booking page shows "unavailable"). Schedule exceptions: no UI surface found either.

**Calendar-batch findings (2026-06-20):** ISSUE-011/012/013 (FIXED, s1). **s3: ISSUE-020 (flagged gaps):** queue board unpopulatable · no waitlist UI · no online-booking-config UI · no schedule-exceptions UI. **s4: walk-in + full appointment create DRIVEN (works); recalls create/dispatch/recare-due/reach-out DRIVEN + fixed ISSUE-022; no-show is a backend-only gap (ISSUE-024).**

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
- [x] ✅ **medical history entries + review — driven (s4)**: conditions/meds/allergies checkboxes save **immediately on toggle** (Diabetes persisted); "Save Medical History" persists surgical/pregnancy/smoking/alcohol; ASA classification set; **review recorded** (Never reviewed → "Last reviewed 6/20/2026", due-badge clears). Form has good error handling (`toastError` on allergy, surfaced save errors). ⚠ **Access gate (note):** the sheet is reachable **only** via the SOAP-notes sheet's "View Medical History", which is **hidden when the note is locked** (and needs an open visit) → allergies/conditions/ASA are unreachable for a patient with a locked note / no active visit.
- [x] ⚠ **dental alerts · patient tasks · consultations · occlusion screening — GAP (ISSUE-024)**: `createDentalAlert`/`createPatientTask`/`createConsultation`/`createOcclusionScreening` all exist in the SDK; **no FE file even references these nouns** (zero surface). Backend-only.
- [ ] 🟢 consent forms — modal + template select pre-fills ✅; sign gated on signature canvas (headless-limited) · refuse/amendments not driven — **see ISSUE-006** (template dup)
- [x] ✅ lab orders create ✅ (toast + persists) / update ✅ (Ordered → In Fabrication)
- [ ] 🟢 chart conflicts resolve (offline sync) — code only
- [x] ✅ workspace payment — modal + invoice detail + Record Payment form render ✅; submission code-verified (controlled inputs behind fixed footer) — **see ISSUE-009** (due-date raw ISO)
- [x] ✅ attachments upload — **driven (s5, MinIO up)**: file → presigned MinIO PUT → complete →
  `POST /visits/{id}/attachments 201` → list refresh. Covered by the ISSUE-025 upload fix.

**Workspace-batch findings (2026-06-20):** ISSUE-006 template duplication · ISSUE-007 no drug-allergy warning · ISSUE-008 Accept-Plan no-feedback/non-idempotent · ISSUE-009 invoice due-date raw ISO · **ISSUE-010 partially FIXED (s7)** — workspace modals not Escape-dismissible: most sheets already used `useSheetA11y` (Escape + focus-restore); the **4 hand-rolled overlays that still lacked it** are now wired (`workspace-imaging-overlay`, `workspace-payment-modal`, `carry-over-prompt`, and the inline Treatment Plan modal in `$patientId.tsx` — whose `×` was also the lone unlabeled icon button, now `aria-label`'d). +Escape regression test. **Still open (out of scope, flagged):** discard-visit uses a native `prompt()` for the reason (`$patientId.tsx:~242`). See `.gstack/qa-reports/`.

### Billing — **live writes swept 2026-06-20 (session 3)** ✅ clean (no bugs)
- [x] ✅ list + totals · issue invoice (live)
- [x] ✅ tabs render: Invoices (Paid/Partial/Outstanding/Overdue/Voided sub-tabs) · Collections (Aging/Worklist/Metrics) · Insurance (claim-status sub-tabs). Invoice detail due-date formatted (ISSUE-009 fix holds).
- [x] ✅ **finalize** (Issue Invoice → Draft→Issued, `PATCH /issue` 200) · invoice create = workspace per-visit flow (no billing-page create button); **delete = intentionally not surfaced** (void is the audit-safe equivalent — `deleteInvoice` SDK exists, never called from FE; by design)
- [x] ✅ **void invoice** (reason form → `POST /void` 200 → Voided)
- [x] ✅ **record payment** (amount+Cash+receipt → `POST /payments` 201 → Paid, balance ₱0)
- [x] ✅ **void payment** (per-row, reason → `POST /payments/{id}/void` 200) · **refund payment** (owner, amount+reason+book-as-credit → `POST /refund` 200; **credit created** — verified via `/credits` source:"refund" ₱720) · **apply discount** (owner, 10% → Subtotal ₱800 − ₱80 = ₱720, math correct)
- [x] ✅ **payment plans create** (`POST /plan` 201) + **view** (Monthly, 6×₱400=₱2,400 installment schedule 7/1–12/1 all Pending, math correct)
- [x] ✅ **mark uncollectible** (`POST /uncollectible` 200, write-off)
- [x] ✅ **insurance claims — FULL lifecycle driven (s4)**: seeded a Maxicare HMO profile via API (no FE create surface — ISSUE-024) for Diego Ramos (issued INV-S0006, ₱12k). **File claim** → `POST /claims` 201, **line derived from invoice** (D3330 Root canal ₱12,000). **Coverage estimate** → `POST /estimate` 200 "HMO covers ₱12,000 · You pay ₱0". **Status** draft→ready→submitted (two `/status` 200). **Remittance** ₱10k paid + ₱2k disallowed → `POST /remittance` 201 → status **Paid**, outstanding ₱0. **0 bugs** — claim hooks use the good `throwOnError`+exposed-`error` pattern.
- [x] ✅ **collections** — Log collection note (`POST /collections/notes` 201 → worklist Last-Contact "Never"→"Jun 20 · phone (1)") · worklist + Aging + Metrics render
- [x] ✅ **patient credits apply** (`POST /apply-credit` 200, balance ₱720→₱0) · **add credit — driven (s4) + fixed ISSUE-023** (add-credit failures were swallowed: hook never exposed `addError`, no add-error rendered → silent; reproduced live via ₱99,999,999 int4-overflow 500 → now shows "Internal server error", amount kept) · **statements send** (`POST /statement/send` 200) + **generate batch** (`POST /statements/batch` 200)
- [x] ✅ AR aging / KPIs render (Invoices: Outstanding ₱208,050 / Collected ₱71,450 / Overdue ₱18,700 · Collections Aging buckets · Metrics: AR ₱204,470 / Collection Rate / DSO 15d)

**Billing-batch findings (2026-06-20 s3):** **0 bugs** — every money write works with correct math + status transitions + refresh. Demo invoices mutated by the sweep — acceptable dev-DB QA churn.
**Billing-batch findings (2026-06-20 s4):** **insurance claim FULL lifecycle driven** (file→derived-line→coverage→status→remittance→Paid, 0 bugs). **Fixed ISSUE-023** (add-credit swallowed errors). Insurance-profile create has no FE surface (ISSUE-024) — seeded via API. Dev-DB churn: a Maxicare profile + claim CLM-2026-4A6CFF8D (Paid) on Diego Ramos; a walk-in appt (Diego 3 PM); 2 recalls on Juan dela Cruz; medical-history entries on Diego.

### Feature-gap cluster — ISSUE-024 (flagged 2026-06-20 s4; extends ISSUE-020)
> **➡️ Sequenced for the product pass in [`PRODUCT_PASS_BACKLOG.md`](./PRODUCT_PASS_BACKLOG.md)** (PP-1…PP-9). Work that file one item at a time, root-cause first.

Backend (SDK + handlers) complete, **no FE write surface** — each needs a product/design decision on where the surface lives, **not an atomic QA fix**:
- **household** add/remove/link (`createHousehold`/`addHouseholdMember`/`removeHouseholdMember`) — card is read-only
- **insurance profile** create/update (`createInsuranceProfile`/`updateInsuranceProfile`) — claim flow assumes one exists
- **appointment no-show** (`no_show` is a valid FSM target; only displayed, never written)
- **dental alerts** (`createDentalAlert`), **patient tasks** (`createPatientTask`), **consultations** (`createConsultation`), **occlusion screening** (`createOcclusionScreening`) — zero FE references
- (prior ISSUE-020: queue board / waitlist / online-booking-config / schedule-exceptions; prior: duplicates **merge** UI)

### Reports — **swept live 2026-06-20** (filters + export driven s3)
- [x] ✅ page load
- [x] ✅ each report type renders with data (Revenue: billed/collected/outstanding KPIs + invoices; Treatment: 27 CDT codes/104 tx/₱725k; Patient: 22 active + reg dates)
- [x] ✅ **date-range filter** — narrowing to a pre-seed window (05-01→05-15) correctly dropped Revenue KPIs to ₱0.00 (client-side re-filter works)
- [x] ✅ **export CSV** — Revenue/Treatment/Patient all download real `text/csv`. **Fixed ISSUE-021** (Revenue + Treatment CSVs emitted **raw centavos** — ₱279,420.00 exported as "27942000", 100× too large for the accountant; now decimal pesos `279420.00` via shared `csvAmount` helper + 4 regression tests). Verified live.

**Reports-batch findings (2026-06-20 s3):** **fixed ISSUE-021** (raw-centavos CSV money columns, Revenue+Treatment). Note: a `GET /dental/appointments?branchId` 400 seen in console was **self-inflicted** (my manual no-date probe), not a reports bug — fresh nav fires no appointments call.

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

### Imaging / Ceph — **swept live 2026-06-20 (session 5; MinIO up)**
- [x] ✅ **upload image — driven end-to-end** (workspace Imaging Upload → `POST /studies 201` →
  presigned MinIO `PUT 200` → appears in list). **Fixed ISSUE-025** — every UI upload **400'd**: the SDK
  serialized `size: BigInt(file.size)` to a JSON string, the server validates int64 as `z.number()` →
  rejected. Root-fixed in `createClientConfig` (bigint-safe bodySerializer) → covers imaging+attachment+PMD.
- [x] ✅ image metadata / modality Edit form — drives + PATCHes (modality/diagnostic/quality/tags). 🟢
  calibration knob code-verified clean (`confirmCalibrationSave` persists points+mm; ruler-draw canvas-bound).
- [x] ✅ **imaging findings** — **fixed ISSUE-026** (create/update/delete failures were swallowed; hook
  exposed `mutationError` but `FindingsSidebar` never rendered it → now an alert banner). 🟢 measurements
  canvas-click-bound — **fixed ISSUE-027** (measurement delete failures were silent; create toasts, delete
  didn't → added `toastError`).
- [x] 🟢 ceph report create — version-pinning **code-verified intact** (`createCephReport` snapshot pins
  analysis_type/norm_population/norm_version/formula_version/calibration; ISSUE-004 fix holds). Creation
  gated on confirmed landmarks (canvas-bound). ✅ **fixed ISSUE-032** — ceph lock-all swallowed-error
  (`CephWorkspacePanel.handleLockAll` fired `commitLandmark.mutate` in a loop but never read the
  hook's already-exposed `mutationError` → a failed lock-all was silent). Now renders a
  `role="alert"` banner (mirrors the ISSUE-026 FindingsSidebar fix) + component test on the 403 path.
- [x] ✅ **attachments upload — driven** (`/storage/files/upload 201 → PUT 200 → complete 200 →
  /visits/{id}/attachments 201 → list refresh`); same ISSUE-025 fix covers it.
- [ ] 🟢 superimposition · occlusion screening — superimposition canvas-bound (code-verify); occlusion
  screening is the backend-only ISSUE-024 gap (no FE surface).

**Imaging-batch findings (2026-06-20 s5):** **fixed ISSUE-025** (BigInt→string upload break, HIGH — broke
ALL uploads; one SDK-serializer root fix) · **ISSUE-026** (findings swallowed mutationError) · **ISSUE-027**
(measurement-delete silent) · **ISSUE-028** (legacy images had a broken Edit → metadata 404).
**s7: fixed ISSUE-032** (ceph lock-all swallowed-error) · **fixed ISSUE-033**
(imaging endpoints **500 on malformed imageId** — 30 imaging `@path` params were typed as plain `string` in
`specs/api/src/modules/dental-imaging.tsp`, skipping the uuid validation the rest of the API has → handler
queried Postgres with a non-uuid → 500. Retyped to the `UUID` scalar (`@format("uuid")`) + `bun run build` +
`bun run generate` → generated `zValidator('param', …)` now uses `UUIDSchema` → clean **400 VALIDATION_ERROR**.
2 handler tests assert 400-not-500; `landmarkCode` (enum) left as-is).

### Notifications — **swept live 2026-06-20**
- [x] ✅ bell list renders ("You're all caught up" empty state — no seeded notifs)
- [ ] 🟢 mark read / mark all read (no notifications to drive)

### Onboarding — 🚫 not drivable headless (email-verification gate)
- [ ] 🚫 org / dental onboarding wizard (create org → activate) — route guard is `composeGuards(requireAuth, requireEmailVerified, requireNoPerson)`. The demo account is **already onboarded** (`requireNoPerson` fails) **and** its email is unverified (`requireEmailVerified` → redirects to `/verify-email`, which renders correctly: "Verify Your Email" + Resend + Sign Out). Driving the wizard needs a **fresh account with a verified email** — and email verification needs the inbox token (no Mailpit access headless), same blocker class as magic-link/passkey. Wizard components (PersonalInfoForm + AddressForm + create-org) are code-verified; `createOnboarding` is exercised by the demo seed.

### Portal (patient-facing `_portal`) — **swept live 2026-06-20**
- [x] ✅ portal layout renders (My Appointments + bottom nav Appointments/Bills + Sign out); 403 for staff session handled gracefully ("Try again" card, no crash). Happy path needs a patient login (out of scope for staff QA).

### Public booking — **swept live 2026-06-20**
- [x] ✅ `book/$branchId` renders — graceful "Online booking unavailable" state (online-booking not enabled for branch in seed). Actual booking needs online-booking config enabled first.

---

## Cross-cutting (run against every module) — **swept live 2026-06-20**
- [x] ✅ **Role: Staff (Ana Santos, staff_full)** — sidebar correctly hides Reports/Staff/Settings (admin gated); **fixed ISSUE-016** (patient CSV export was shown to staff + 403'd silently — now owner-gated + surfaced). **✅ fixed ISSUE-017 (s7)** — sidebar footer showed the Better-Auth account name ("Dr. Maria Reyes") even when the **Ana Santos** PIN profile was active (role was already Ana's). No design call was actually needed: `pin-entry.$memberId.tsx` already had `member.displayName` (it passes it to `pinSession.startSession`) — it just wasn't written to org-context. Added `memberName` to the org-context store, set it at PIN entry, and the sidebar now shows `memberName ?? session.user.name`. +3 store tests.
- [ ] 🟢 Empty states — not driven (seed is data-rich); spot-checked: notifications "all caught up", portal/public-booking graceful states ✅ (prior)
- [x] ✅ Loading + error states — error surfacing exercised throughout; **3 swallowed-error bugs found+fixed** this batch set (ISSUE-013-family): 014 case-presentation accept/decline, 015 patient phone 400, 016 export 403
- [x] ✅ Console errors per page (breadth sweep — clean except OneSignal/runtime-config dev noise)
- [x] ✅ Responsive / iPad — calendar **clean** at 768px portrait (no h-overflow). ⚠ **ISSUE-018 (flagged, not fixed):** billing invoices table overflows at iPad-portrait 768px (Status column clipped, whole page widens to 1024) because the sidebar does **not** auto-collapse at exactly 768px (manually collapsing it → fits). Root = global shadcn sidebar mobile breakpoint (`<768` excludes 768px tablets); fix is a tablet-UX design decision (collapse ≤1024 or shrink inset) — deferred.
- [x] ✅ Accessibility — `main` + single `h1` landmarks present; **fixed ISSUE-034 (s7)** — sidebar now wraps its menu in `<nav aria-label="Main navigation">` (was 0 nav landmarks) + sign-out button got an explicit `aria-label`. The "~6 unlabeled icon buttons" estimate was high: an exhaustive sweep (183+ files) found only **one** genuinely unlabeled icon button (the Treatment Plan modal's `×`), fixed under ISSUE-010; every other icon button already had `aria-label`/`title`/visible text.

**Cross-cutting findings (2026-06-20):** **fixed ISSUE-016** (export gate + swallowed 403). **s7: fixed ISSUE-034** (a11y nav-landmark + icon-button-label gaps). **s7: fixed ISSUE-017** (sidebar now shows active PIN member, not account owner). **Flagged (need design/arch decision, not fixed):** ISSUE-018 iPad-portrait 768px sidebar non-collapse → billing table overflow.

## Session 6 (2026-06-20) — test-vs-code reconcile + backend test-infra debt
- **ISSUE-029 FIXED** `0428ed4f` (Patients-profile, follows ISSUE-015) — the demographics save **re-sent the re-normalized phone on every edit**: the change-detection compared the form's E.164-normalized phone against the **raw** stored phone (display spaces), so an untouched phone always "differed" → re-sent, silently mutating an unedited PII field + firing a spurious `patient.contact.update` audit. This was the 2 pre-existing `PatientProfilePage` test fails (FR2.4 + #14). Decision (test-is-right): server **merges** the dental-patient PATCH (`person-dental-patient.facade.ts:99-101`; contract `dental-patient.hurl` step 5e proves phone-only PATCH keeps email; BR #14/V-PAT-014) → partial body is correct. Fix = canonicalize **both** diff sides (trim email baseline, reuse exported `normalizePhone` for phone baseline) + 1 guard test. **FE suite now 2589 / 0.**
- **ISSUE-030 FIXED** `6ccefa95` (platform / person handler) — the **generic** `PATCH /persons/{id}` (`updatePerson.ts`) full-**replaced** `contactInfo`, so a partial body wiped omitted sub-fields (silent PII loss); the dental-patient path already merged → the two endpoints disagreed. Only caller = `apps/account` (frozen template, submits the whole object) → **latent**, but a trap for any partial caller. Fix = merge mirroring the facade (`{ ...(existing ?? {}), ...body.contactInfo }`) + DB-backed RED→GREEN test. Person suite 26/26.
- ✅ **ISSUE-031 FIXED** (Session 7) — backend suite restored to **4578 pass / 0 fail** (383 files, 93s). **True root cause: the `monobase_test` TEMPLATE is polluted** — a prior contaminating run left 12 `imaging_ceph_report` + 17 `imaging_study` / `imaging_study_image` + 30 `dental_retention_policy` rows in it, and `test-with-db.ts` clones the template **per file**, so *every* clone inherits them (not cross-file batch pollution as first theorized). The two affected behaviors were tests that couldn't tolerate a non-pristine table: (a) the imaging `beforeEach` teardown deleted `imaging_study_image` but its delete list **omitted the ceph snapshot tables** → the inherited `imaging_ceph_report` rows tripped `imaging_ceph_report_image_id_*_fk`; (b) retention `findEnabled()` was called **unscoped** so it saw the 15 inherited enabled seed rows instead of `['clinical']`. **Durable fix (robust tests, not a one-shot template wipe):** added `imaging_ceph_superimposition`/`_report`/`_analysis`/`_landmark` to both imaging files' teardown in child→parent FK order; scoped the two bare `findEnabled()` assertions to `TENANT_A` (a clean test namespace — seeds use random org uuids). Verified RED→GREEN against polluted clones (3 files 83/83) then full batch 0-fail.

## Product Pass (2026-06-20) — feature-gap builds (see `PRODUCT_PASS_BACKLOG.md`)
- ✅ **ISSUE-035 (PP-1) — Appointment no-show action.** The FSM (`scheduled/confirmed/checked_in → no_show`), the `PATCH /dental/appointments/:id {status:'no_show'}` handler (`markNoShow`), and the SDK `UpdateAppointmentRequest.status` already existed and were backend-tested — but **no FE action wrote `no_show`** (the morning briefing counted no-shows staff couldn't create). Pure FE slice: added `canMarkNoShow` helper (FSM-mirroring, same shape as `canCancelStatus`) + a "No Show" hover button on `AppointmentCard`; threaded `onNoShow` through `CalendarDay`/`DraggableAppointment`; `handleNoShow` in `calendar.tsx` calls `updateAppointment({status:'no_show', throwOnError:true})` → invalidate + success toast, errors surfaced via `toastError` (no swallow — the recurring family). Live-verified (Elena Garcia scheduled → No Show → card flips to "No Show" + "Marked as no-show" toast, no console errors). +5 unit assertions (`appointment-card.test.ts`); FE suite **2598/0**; typecheck clean.

- ✅ **ISSUE-036 (PP-2) — Insurance-profile create/update.** `createInsuranceProfile`/`updateInsuranceProfile` + the `listPatientInsuranceProfiles` read existed and were backend-tested, and the claim payer-picker already read profiles via `usePatientInsuranceProfiles` — but **no FE create/update path**, so a profile had to be API-seeded before any claim could be filed (revenue-workflow blocker). Added `InsuranceCard` on the patient profile (next to Household): list + add/edit sheet form (`useSheetA11y`; required insurer/policy/subscriber + payerType/relationship/groupNumber/notes/active; errors surfaced) + a `useInsuranceProfileMutations` hook that invalidates the SAME `listPatientInsuranceProfilesQueryKey` the claim flow reads (001/002/003 cache family) so a new profile shows in both immediately. Live-verified the full round-trip (created Maxicare/PhilHealth/MX-77001 on the card → appears in card AND claim payer-picker, no API seeding). +10 unit assertions; FE suite **2607/0**; typecheck + lint clean.

- ✅ **ISSUE-037 (PP-3) — Queue-board enqueue (auto on check-in).** `/queue-board` rendered the FSM columns + 15s poll but was **permanently empty** — `createQueueItem` had no FE/flow caller, check-in didn't enqueue, seed had none. **Product decision (user): auto-enqueue on check-in, no manual action.** `checkInAppointment` now creates a `'waiting'` queue item after the check-in commit tx, in its own `withTenantTx` (dental_queue_item RLS), wrapped best-effort so a queue failure never rolls back a successful check-in (mirrors reminder-expiry). No dedupe guard — check-in is a one-way FSM transition (fires once); ponytail note flags the upgrade path if a manual "Add to queue" is added. Backend-only (board UI/FSM already worked once items exist). RED→GREEN unit test (`dental-scheduling.test.ts`: check-in creates exactly one `waiting` item, scoped to suite branch + appt id for template-pollution safety) + **full backend batch 4581/0** + scheduling neighbors green; queue-board UI smoke-checked. Live check-in→board round-trip not driven (seed: all candidate patients have active visits; today=Saturday → bookings 422) — backend path authoritative.

- ✅ **ISSUE-038 (PP-4) — Online-booking config (staff).** `createOnlineBooking` was only reachable from the public `/book/$branchId` wizard, which shows "Online booking unavailable" until a branch enables it — but there was **no staff surface** to flip that flag (so the public page was permanently unavailable). The policy lives in `settings.onlineBooking` JSONB (`parseOnlineBookingConfig` defaults/validates it; public gate reads `config.enabled`); the owner-only `PUT /branches/:id/settings` write + `useBranchSettings`/`useUpdateBranchSettings` hooks already existed. Added an **OnlineBookingSettings** panel (registered in `settings-panels.tsx`) with the enable toggle + bookable visit types + lead-time/horizon/slot-step + require-auth, saved via the shared branch-settings endpoint. **Live-verified round-trip:** `/book/$branchId` went "unavailable" → enable in Settings ("Online booking saved") → bookable (Check-up / Recall-Hygiene / provider / times). +6 unit assertions; FE suite **2613/0**; typecheck + lint clean. Schedule-exceptions + provider allow-list (stays 'all') scoped out (backlog "separately if it balloons").

- ✅ **ISSUE-039 (PP-5) — Waitlist management UI.** `listWaitlist` + `promoteWaitlistEntry` existed server-side but were only referenced by the public `BookingWizard` — no staff surface to view/fill the waitlist. **Placement (user): calendar slide-over panel** (sibling of the Recare panel). Added a `WaitlistPanel` toggled from the calendar top bar: lists active entries + an inline "Fill slot" form (date/time/duration/provider/visit-type) → `POST /waitlist/:id/promote` books a `scheduled` appointment and the entry drops off. `useWaitlist` invalidates the waitlist key + the appointments list on promote. **Live-verified end-to-end** (seeded an active entry via the app's own API → appeared in panel → Fill slot → "Slot filled from the waitlist" toast → entry gone). +10 unit assertions (`canPromote`, `initialPromoteForm`, list/empty render, promote POST body); FE suite **2618/0**; typecheck + lint clean. **Scope:** view + promote; cancel/remove deferred (no endpoint); patient names show as truncated ids (same as queue board, no enrichment yet).

- ✅ **ISSUE-040 (PP-6) — Household add/remove/link.** `HouseholdCard` was read-only; `createHousehold`/`addHouseholdMember`/`removeHouseholdMember` had zero FE call-sites. Made the card interactive: empty state → "Create household" (this patient = guarantor; name → `POST /dental/households`); existing household → "Add member" (patient search via `usePatients` → select → relationship → `POST /households/:id/members`) + per-non-guarantor "Remove" (`DELETE /households/:id/members/:patientId`; guarantor has no Remove, mirroring backend `GUARANTOR_NOT_REMOVABLE`). `useHouseholdMutations` invalidates the household query. **Live-verified** (created "Dela Cruz Family" → added Maria Santos as spouse → removed → guarantor-only). +14 unit assertions; FE suite **2621/0**; typecheck + lint clean. **GOTCHA:** `listDentalPatients` returns a `{data:[…]}` envelope (SDK transformer does `data.data.map`) — a bare-array test mock makes the search silently return [] ("No patients match"); mock must wrap in `{data:[…]}`.

- ✅ **ISSUE-041 (PP-8) — Discard-visit modal (replaces `window.prompt()`).** Discarding a visit used a native `window.prompt()` for the reason (inaccessible, off-brand). Replaced with a `DiscardVisitDialog` (reason textarea + `useSheetA11y` Escape/focus, min 5 / max 500 mirroring the backend `DiscardVisitRequest.reason`); `handleDiscardVisit` opens it, `handleConfirmDiscard` runs the discard mutation (closes on success, stays open on error — the hook toasts). **Live-verified**: Discard → accessible modal (not a prompt) → short reason blocked with the 5-char error → valid reason discards → dialog closes + visit drops. +4 unit assertions; FE suite **2625/0**; typecheck + lint clean.

- ✅ **ISSUE-042 (PP-7 sub-slice 1) — Dental alerts (chairside).** `createDentalAlert`/`listDentalAlerts`/`updateDentalAlert` (full CRUD, patient-scoped `…/patients/:id/dental-alerts`, 8-case BE test) existed with **zero FE references**. Added a `useDentalAlerts` hook (list + create + deactivate-via-PATCH `{active:false}`; `{data:[…]}`-tolerant select; mutation errors surfaced via `toastError`) + a `DentalAlertsSheet` (bottom sheet mirroring `RecallsSheet`: list, add form = type/severity/description, per-active-alert Deactivate) opened from a new top-bar **Alerts** button. Active alerts also render as **severity-coloured badges** in the workspace top bar (beside the medical-history safety floor) so they're visible the moment a patient opens. **Live-verified** (owner workspace: New Alert → Needle phobia/High/desc → shows in sheet AND as a top-bar badge → Deactivate → badge drops, row flips to "Inactive"; no console errors from the flow). +8 unit assertions (6 sheet, 2 top-bar); FE suite **2633/0**; typecheck + lint clean; font ratchet at 346 (token scale only, no new `text-[Npx]`). **Decision:** the `consultation` noun was **descoped** from PP-7 — it's the frozen upstream `/emr/consultations` module (patient+provider, no branch/visit), redundant with the dental `dental_visit` + per-visit SOAP `VisitNotes` flow, with no clean dental-workspace home.

- ✅ **ISSUE-043 (PP-7 sub-slice 2) — Patient follow-up tasks.** `createTask`/`listPatientTasks`/`updateTask` (full CRUD + status FSM `open→in_progress→done/cancelled`, patient-scoped `…/patients/:id/tasks`) existed with **zero FE references**. Added a `usePatientTasks` hook (list + create + FSM update; `{data:[…]}`-tolerant; errors via `toastError`) + a `TasksSheet` (mirrors `RecallsSheet`: list with status badge + FSM transition buttons, add form = title/type/optional-due-date/description) opened from a new **Tasks** trigger in the workspace year-filter bar (beside Recalls). **Live-verified** (created "Send referral to ortho" / Referral → Open → Start → In progress with Complete/Cancel; only the known OneSignal dev error in console). +6 unit assertions; FE suite **2639/0**; typecheck + lint + font ratchet (346) clean. Assignee picker scoped out (`assignedTo` stays nullable, no staff-list UI yet) — ponytail follow-up.

## Known non-bugs / by-design (don't re-file)
- PIN clears on refresh — intentional kiosk security (`pin-session.ts`).
- OneSignal init error + runtime-config HTML fallback + `/readyz` 503 — dev `.env` / MinIO down, not product bugs.
- Calendar "+ Book" labels overlap booked cards — cosmetic.
- Two E2E fixture patients (`J21`/`J22`) in the demo seed — seed hygiene nit.
- New Appointment / dentist fields use raw UUID inputs — flagged UX (needs picker), not a defect.
