# P1-20 — Patient-Facing Treatment Case-Presentation + E-Signature Accept/Reject

> Implementation DESIGN PLAN (no code). Date 2026-06-02 · Effort: **L** · Module: `dental-patient` (finance namespace) + `dental-visit` (presentation aggregate) + new `apps/dentalemon` presentation surface.
>
> Source review: `docs/reviews/modules/treatment-planning-review.md` §5 "[P1] No patient-facing case-presentation + no reject path". Research: `docs/reviews/research/treatment-planning.md` (CareStack/Curve/Open Dental/Dentrix case-presentation + e-sign patterns).

---

## 1. Problem & current state

Treatment-plan **acceptance is a clinician-side action**, not a patient experience:

- **Accept is a clinician button.** Two parallel surfaces drive acceptance, both staff-only behind `bearerAuth` + membership RBAC:
  - The **header FSM** (`treatment-plans-sheet.tsx`) exposes Present/Approve/Reject/Schedule transition buttons; `updateTreatmentPlan.ts` enforces `TREATMENT_PLAN_FSM` and now (P2-8) appends a `dental_treatment_plan_status_history` row per transition.
  - The **pending-treatment plan** (`acceptTreatmentPlan.ts`, owned by dental-visit) snapshots diagnosed+planned treatments into an immutable `treatment_plan_version` and optionally binds a `consent_form` via `accepted_plan_version_id`.
- **No patient-facing presentation.** There is no read-only "here is your plan" surface for the patient — no phases, no annotated radiographs, no before/after photos, no itemized ₱ breakdown framed for a layperson. The clinician reads the Treatment Breakdown table to the patient verbally.
- **No patient reject path.** P2-8 added a `rejected` terminal state and the sheet renders a "Reject" button, but it is a **staff** action; the patient cannot themselves decline. Research (`treatment-planning.md` §"Case presentation & acceptance UX") shows CareStack/Open Dental let patients **sign OR reject** online — the two top acceptance levers are financial clarity and communication clarity, both of which require a patient-readable surface.
- **E-signature is accept-only and staff-mediated.** `signConsentForm.ts` captures `signatureData` and is immutable once `signed=true` (V-CLN-005), but it is invoked by staff during a visit; `approval.method` already enumerates `portal` yet no portal surface exists.

**Net:** DentaLemon has all the *backing stores* (immutable version snapshot, append-only approval + status-history, consent e-sig immutability, `rejected` state, P1-19 alternates, P1-21 appointment links) but **no patient-facing read surface and no patient-authenticated accept/reject action** to drive case acceptance.

## 2. Target

A **patient-facing case-presentation surface** that turns a presented plan into a decision the patient can make themselves:

- **Visual / photo-driven** — the odontogram/carousel Proposed layer, before/after intraoral photos, and **annotated radiographs** (reuse imaging findings/measurements overlays) so the patient *sees* the problem and the plan.
- **Clear financial breakdown** — itemized ₱ line items grouped by clinical **phase** (P1 phasing), per-phase + grand total, all in `₱`/`en-PH`. **No US insurance estimation** (out-of-scope, §8).
- **Alternates with a recommended option** — render P1-19 option groups with the clinician-recommended case highlighted; accepting one declines its siblings.
- **Online sign OR reject** — the patient e-signs (reuse the consent e-sig immutability pattern) to **accept**, or records a **reject** with an optional reason. Accept drives the plan to `approved`→`scheduled` (via P1-21 links); reject drives it to the `rejected` terminal state (P2-8).
- **Delivery model** — both an **in-app read-only view** (staff opens it on the operatory iPad / hands the patient the device) and a **shareable tokenized link** the patient opens on their own device (CareStack "patient portal" analog, but token-scoped — DentaLemon has no patient login).

Mirrors the CareStack/Curve/Open Dental/Dentrix patterns documented in research while staying ₱-native.

## 3. Proposed design

### 3.1 Data model (additive, append-only)

New table `dental_case_presentation` (in `dental-patient/repos/case-presentation.schema.ts`, following `treatment-plan.schema.ts` conventions — `baseEntityFields`, patient FK cascade, indexes):

| Field | Type | Notes |
|---|---|---|
| `treatmentPlanId` | uuid, FK→`dental_treatment_plan` cascade | the header being presented |
| `planVersionId` | uuid, loose ref | the immutable `treatment_plan_version` snapshot presented (medico-legal "what was shown") |
| `shareToken` | text, unique, indexed | high-entropy opaque token for the shareable link (NOT the plan id) |
| `shareTokenExpiresAt` | timestamp | short TTL (default 14 days, configurable) — mirrors storage presign expiry pattern |
| `status` | text enum: `draft`/`sent`/`viewed`/`accepted`/`rejected`/`expired`/`revoked` | presentation lifecycle, distinct from the plan FSM |
| `decision` | text enum nullable: `accepted`/`rejected` | terminal patient decision |
| `decisionAt` | timestamp nullable | |
| `signatureData` | text nullable | captured signature on accept (reuse consent e-sig payload shape) |
| `signerName` | text nullable | who signed (patient/guardian name typed at signing) |
| `consentFormId` | uuid, loose ref nullable | links to the `consent_form` row when accept consents the plan version |
| `rejectionReason` | text nullable | optional free-text on reject |
| `firstViewedAt` / `lastViewedAt` | timestamp nullable | engagement telemetry |

**Immutability rule (reuses V-CLN-005 pattern):** once `decision` is set the presentation is terminal — re-deciding is a `422 PRESENTATION_DECIDED` BusinessLogicError, exactly like re-signing a consent form. The signature payload, once captured, is never mutated.

No change to `treatment-plan.schema.ts`, `treatment.schema.ts`, `treatment-plan-version.schema.ts`, or `consent-form.schema.ts` — we **compose** the existing stores.

### 3.2 Presentation aggregate (what it shows)

A new read handler `getCasePresentation` assembles a **denormalized, patient-readable aggregate** from existing repos (no new clinical writes):

- **Phases** — group the plan's `dental_treatment` items by the P1 `phase` field (once landed) / fall back to Diagnosed-Planned grouping; per-phase ₱ subtotal.
- **Line items** — tooth, surfaces, CDT description (layperson `description`, not the raw CDT code), `priceCents` → `₱` via `formatCents`/`CURRENCY_SYMBOL`/`APP_LOCALE`. **Grand total** + per-phase totals.
- **Alternates** — P1-19 `TreatmentOptionGroup`s with the `recommended` flag surfaced; an "Accept this option" affordance feeds `acceptTreatmentOption`.
- **Imaging** — annotated radiographs and before/after photos: reuse the imaging findings/measurements overlay (`workspace-imaging-overlay.tsx`) + presigned download URLs (the `getFileDownload`/`downloadUrl` presign pattern). For the **tokenized link**, image URLs are minted as short-TTL presigned GETs scoped to the presentation, never raw S3 keys.
- **Chart/carousel** — the Proposed snapshot layer (read-only) so the patient sees the spatial what's-planned view.
- **Scheduling** — show P1-21 appointment links so accepted phases read "proposed → booked".

### 3.3 Auth model — two access paths

**Path A — in-app (staff-mediated, iPad in operatory).** Existing `bearerAuth` + membership RBAC. Staff opens the presentation; patient taps Accept/Reject on the staff's authenticated session. New ops reuse `assertPatientBranchAccess`. This is the **demoable, lowest-risk** path and the Phase-1 default.

**Path B — shareable tokenized link (patient's own device, no login).** A **new public (unauthenticated) route family** scoped entirely by the opaque `shareToken`:
- `GET /dental/case-presentations/by-token/{shareToken}` — returns the read aggregate **redacted to presentation-relevant PHI only** (plan items, fees, the patient's own images, first name). No access to other patient records, no staff data, no full chart history.
- `POST /dental/case-presentations/by-token/{shareToken}/accept` — captures `signatureData` + `signerName`, writes the `consent_form` (immutable e-sig), drives the plan FSM `presented→approved`.
- `POST /dental/case-presentations/by-token/{shareToken}/reject` — captures optional `rejectionReason`, drives the plan FSM `presented→rejected`.

These routes use `authMiddleware({ required: false })` and authorize **solely** on a valid, non-expired, non-decided `shareToken` (constant-time compare; rate-limited; single-decision). Every token action emits an audit row (`case_presentation.viewed/accepted/rejected`) and a P2-8 status-history row attributed to a synthetic `patient_self_service` actor. Token minting (`createCasePresentation` / `sendCasePresentation`) stays behind staff `bearerAuth`.

### 3.4 Accept → schedule flow

On accept (either path): write immutable consent e-sig + presentation `decision=accepted`, transition plan `presented→approved` (status-history row), then surface the P1-21 **attach-appointment** affordance so the front desk books the approved phases (`approved→scheduled`). The accept handler does NOT auto-book — booking stays a staff action against real calendar slots; accept just unlocks it.

### 3.5 Reject → status

On reject: presentation `decision=rejected` + `rejectionReason`, plan FSM `presented→rejected` (the P2-8 terminal state already wired in `TREATMENT_PLAN_FSM` and the sheet). Reject is terminal for that presented version; the clinician can present a **new** version later (new presentation row, new token).

### 3.6 API surface (TypeSpec-first)

Add to `specs/api/src/modules/dental-patient-finance.tsp` a `CasePresentationManagement` interface (staff, `bearerAuth`) for create/get/send/list, and a **separate public interface** for the three `by-token` ops with **no `@useAuth(bearerAuth)`**. Regenerate OpenAPI + validators + route registry per the API-first workflow; handlers live in `dental-patient/case-presentation/`. SDK hooks regenerate via `@hey-api/openapi-ts`. Frontend consumes generated TanStack Query hooks (no `mock-api`).

### 3.7 Frontend surface

New feature route `apps/dentalemon/src/features/case-presentation/` (read-only, mobile-first, shadcn primitives, `#FFE97D` lemon accent per DESIGN.md):
- `CasePresentationView` — phased line items + ₱ breakdown, annotated-imaging gallery (reuse overlay), alternates with Recommended badge, carousel Proposed layer.
- `SignaturePad` + Accept/Reject CTAs — Accept opens signature capture; Reject opens a reason popover (mirrors the existing decline-with-reason Radix popover in `treatment-table.tsx`).
- Staff entry: a "Present to patient" action in `treatment-plans-sheet.tsx` that mints a presentation (and copyable share link). Fix the pre-existing **USD currency leak** (review N1) in the sheet while here — use `CURRENCY_SYMBOL`/`APP_LOCALE`.

## 4. Vertical-TDD test plan

Per `docs/development/VERTICAL_TDD.md` — RED→GREEN per layer, one vertical slice, gate = all layers green + `bun run test` + `bun run typecheck` + `bun run check:boundaries` (per feedback memory) with no regressions.

1. **TypeSpec** — add models/interfaces; `cd specs/api && bun run build` clean.
2. **Codegen** — `cd services/api-ts && bun run generate`; validators/registry emit; server boots (route-registration smoke test, like `treatment-plans-route-registration.test.ts`).
3. **Backend unit (RED→GREEN)** — `case-presentation.test.ts`:
   - create mints unique token + `draft`; `getCasePresentation` aggregate shape (phases, ₱ totals, alternates, imaging refs).
   - **token auth:** valid token → 200; unknown/expired/revoked token → 404/410; decided token re-decide → `422 PRESENTATION_DECIDED`.
   - **accept:** writes immutable consent e-sig, plan `presented→approved`, status-history row, audit row; second accept 422.
   - **reject:** plan `presented→rejected` (terminal), reason persisted, audit row.
   - **PHI scoping:** by-token aggregate excludes other-patient data, staff fields, raw S3 keys; image URLs are short-TTL presigned.
   - **FSM guard:** accept/reject only legal from `presented`; from any other state → `422 PLAN_INVALID_TRANSITION`.
   - archived-patient block (EF-PAT-001); branch access on staff path.
4. **Contract (RED→GREEN)** — Hurl scenarios in `specs/api/tests/contract/`: staff create→send, anonymous token GET, token accept (signature), token reject (reason), expired-token 410, re-decide 422.
5. **Frontend unit (RED→GREEN)** — `CasePresentationView` renders phases/₱/alternates/images; SignaturePad disables after submit; Reject popover requires confirm; USD-leak regression test (asserts `₱`).
6. **E2E (Playwright)** — staff presents → open token link in fresh context (no auth) → view → sign → assert plan `approved` + appointment-attach affordance; second flow → reject → assert `rejected`. (Per memory: Playwright over human checkpoints.)
7. **Verify gate** — `bun run test` + `bun run typecheck` + `bun run lint` + `bun run check:boundaries` green.

## 5. Phasing & effort (L)

- **Phase 1 — Backend + in-app (Path A).** Schema + migration, TypeSpec, staff create/get/accept/reject handlers, presentation aggregate, backend+contract tests, in-app `CasePresentationView` + signature/reject UI, accept→approve + reject→rejected wiring, USD-leak fix. *Demoable end of Phase 1 (iPad-in-operatory).* — **M**
- **Phase 2 — Shareable tokenized link (Path B).** Public `by-token` route family, token minting/TTL/revoke, PHI-redacted aggregate + presigned image URLs, rate-limiting, audit, token E2E. — **M**
- **Phase 3 — Polish.** Engagement telemetry (viewed timestamps), "present new version after reject" flow, carousel Proposed-layer embed, accept→P1-21 schedule handoff polish. — **S**

Combined: **L**. Phase 1 alone delivers the reviewed P1 capability for the demo; Phase 2 is the differentiating portal.

## 6. Dependencies

- **P1-19 alternate cases** (`acceptTreatmentOption`, `TreatmentOptionGroup`) — landed; consumed by the alternates section. ✅
- **P2-8 lifecycle** (`rejected`/`scheduled` states, status-history table + `recordStatusHistory`) — landed; accept/reject transitions ride this. ✅
- **P1-21 plan→appointment links** (`attachTreatmentAppointment`) — landed; accept→schedule handoff. ✅
- **Consent e-sig immutability** (`signConsentForm`, V-CLN-005, `acceptedPlanVersionId`) — reused for the signature record. ✅
- **Immutable version snapshot** (`acceptTreatmentPlan`/`treatment_plan_version`) — reused as the presented artifact. ✅
- **Imaging overlay + presign** (`workspace-imaging-overlay.tsx`, `getFileDownload` downloadUrl pattern) — reused for annotated radiographs. ✅
- **P1 phasing field** (review §5 [P1]) — *soft* dependency: if not yet landed, Phase 1 groups by Diagnosed/Planned status and upgrades to phase grouping when phasing lands. Not blocking.

## 7. Risks

- **Patient auth on the shareable link (BIGGEST RISK).** DentaLemon has **no patient login** (confirmed: no patient-portal/patient-user concept in code or TypeSpec). The token IS the credential. Mitigations: high-entropy opaque token (not the plan id, not guessable), short TTL + explicit staff revoke, single-decision (token dies on accept/reject), constant-time compare, rate-limiting, and **server-side authorization scoped strictly to that one presentation**. Defer Path B to Phase 2 so Phase 1 ships entirely under existing `bearerAuth`.
- **PHI exposure in a shareable link.** The by-token aggregate must be **minimally scoped** — only this presentation's items, fees, the patient's own images (short-TTL presigned, never raw S3 keys), and first name. Never the full chart, other patients, or staff fields. Covered by a dedicated PHI-scoping backend test; every token hit audited.
- **E-sig legal integrity.** Reuse V-CLN-005 immutability verbatim (once decided, terminal; signature never mutated) so the accepted presentation is a defensible medico-legal record tied to the immutable `treatment_plan_version`.
- **Two-plan-model confusion (review N4).** Anchor the presentation on the header plan (`treatmentPlanId`) + the version snapshot (`planVersionId`) together, so "what was presented" and "what was accepted" are one reconciled record — don't add a third acceptance verb.
- **FSM divergence (FE vs BE).** Accept/reject must go through `TREATMENT_PLAN_FSM` + `recordStatusHistory` server-side; the FE `FSM` map in the sheet is presentation-only and already mirrors the backend.

## 8. PH-market note

Financial model stays **₱ / `en-PH`** end-to-end (`CURRENCY_SYMBOL`, `APP_LOCALE`, `formatCents`); the presentation shows gross fee + phase subtotals + grand total only. **US insurance estimation is explicitly out-of-scope** — no LEAT/alternate-benefit downgrade, no primary/secondary coverage math, no benefit-year/annual-max timing (review §5 P3, out-of-market for a PHIC/self-pay/HMO economy). The "financial clarity" acceptance lever is met by clear ₱ itemization + flexible-phase staging, not payer estimation. If a PH coverage model is ever added (PHIC case-rate / HMO copay, review §5 P2), it slots in as an additive per-line annotation without changing this surface.
