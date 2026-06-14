# Known Limitations & Tracked Debt

A handoff-honest catalogue of the cosmetic debt, deferred work, and in-flight
architectural decisions in this repo. None of these are correctness bugs; they
are tracked here so a new developer is not surprised. Last reviewed: 2026-06-13.

## Backend TODOs (6)

| Location | Note |
|----------|------|
| `services/api-ts/src/core/audit.ts:45,78` | `markForPurging` retention method not yet implemented in the repository (audit purge is a no-op). |
| `services/api-ts/src/handlers/billing/createInvoice.ts:119` | `const tax = 0` — jurisdiction-based tax calculation not implemented (configurable via `TAX_RATE_PCT`, defaults 0). |
| `services/api-ts/src/handlers/billing/markInvoiceUncollectible.ts:93` | Post-write-off cleanup hooks not yet wired. |
| `services/api-ts/src/handlers/comms/joinVideoCall.ts:210` | WebRTC join currently reuses the session token; a short-lived WebRTC-scoped JWT is planned. (comms is latent in the dentalemon product.) |
| `services/api-ts/src/utils/expand.ts:358` | Batch expand endpoint is a perf nice-to-have, not built. |

## Frontend spec-drift TODOs (1 remaining)

Four of the five original FE workarounds have been removed by modeling/aligning the
fields the handlers already return: prescription `warnings` (rx-sheet), invoice-list
`patientName`/`visitDate` (use-invoices), the `acceptTreatmentPlan` `branchId` query,
and — 2026-06-13 — the `getTreatmentPlan` response shape.

The treatment-plan fix aliased the FE types to the generated SDK contract
(`TreatmentPlanData = TreatmentPlanResponse`, `TreatmentPlanItem` = the generated item,
`TreatmentPhase = DentalTreatmentPhase`) and dropped the `as any as` cast: the generated
types were accurate all along (`treatmentCount`/`byTooth` optional = omitted on the
empty-plan response; `toothNumber`/`carriedOver` optional = omitted by the `byTooth`
grouping; full `DentalTreatmentStatus`), and the hand-rolled FE duplicates were the
inaccurate side. One item remains, deferred for a concrete reason:

- `apps/dentalemon/src/features/billing/hooks/use-invoice-detail.ts` —
  `outstandingCents`/`lineItems`/`payments` on the invoice **detail** response.
  (`patientName`/`visitDate` are now inherited from the base `DentalInvoice`.) Modeling
  `lineItems`/`payments` would pull `payments.createdAt` under the SDK date transformer —
  a real `string`→`Date` runtime shift for the detail sheet — and the dental `method`
  union is wider than the generated `PaymentMethod`; `outstandingCents` aliases
  `balanceCents` (V-BIL-012). Needs a slice that also updates the detail-sheet rendering.
  The FE keeps a typed intersection (`DentalInvoice & {…}`) plus one documented `as any`
  in the `select` transform — no `as unknown as`.

## Performance

- **`listDentalInvoices` N+1**: `services/api-ts/src/handlers/dental-billing/listDentalInvoices.ts`
  resolves `patientName` + `visitDate` per row (two facade calls each, inside `Promise.all`)
  — 2 round-trips per invoice. Correct, but O(n) DB calls; at scale, batch the patient-name
  and visit-date lookups by invoice id into two queries. (Pre-existing; surfaced when the
  enrichment fields were modeled in the contract, 2026-06-13.)

## Logging hygiene

- **Frontend**: 0 raw `console.*` in `apps/dentalemon/src` — all diagnostic logging
  routes through the `@/lib/logger` seam (env-gated, scope-prefixed, telemetry-sink
  ready; user-facing errors stay on `error-toast.ts`). A `no-console: error` ESLint
  rule (logger seam + test infra excepted) keeps it that way. (Migrated 2026-06-13.)
- **Backend**: 4 `console.*` calls in `services/api-ts/src` — all intentional
  boot-time diagnostics emitted before/around config + the structured logger
  (`core/config.ts` AUTH_SECRET/INTERNAL_SERVICE_TOKEN warnings, `core/database.ts`
  search_path error, `core/openapi.ts` `$ref` warning). Request-path logging goes
  through Pino with PHI redaction; these four are not a PHI exposure.

## Tooling / config

- **`baseUrl` deprecation**: `services/api-ts/tsconfig.json` and
  `apps/dentalemon/tsconfig.json` set `baseUrl`, which TypeScript 7.0 will warn on
  (TS5101). The repo runs TS 5.7/5.9 where this does **not** warn yet; revisit when
  upgrading to TS 7.0 (add `ignoreDeprecations` or drop `baseUrl` for `paths`).
- **Coverage thresholds differ and don't block**: `apps/dentalemon/bunfig.toml`
  enforces line/fn/branch 75/75/60; `services/api-ts/bunfig.coverage.toml` enforces
  62/61/40. The api-ts coverage job runs in CI (`postgres-services.yml`) but is
  `continue-on-error: true` (non-blocking). Reconcile the thresholds and decide
  whether to gate.
- **`docs/aha/` AI-process files**: ~81 generation-process artifacts live under
  `docs/aha/` (with a `project-structure/examples/` mirror). They are first-class in
  `docs/` and could move to `docs/_ai-process/` or `.claude/`. (The `.md.md`-typo prompt
  was renamed to `docs/aha/prompts/08-qa-uat-workflow-guide.md` and tracked, 2026-06-13.)

## Architectural decisions (resolved 2026-06-13)

Previously-open standards questions, now decided:

- **Form library** → `docs/decisions/ADR-009-frontend-form-library.md`: dentalemon
  standardizes on `react-hook-form` + Zod (accepted override of the template's
  TanStack Form mandate); the four person forms are not migrated.
- **DB row-level security (RLS)** → `docs/decisions/ADR-010-tenant-isolation-rls-pre-ga.md`:
  application-level tenant isolation remains the current control; RLS is an explicit,
  tracked **pre-GA gate** (top-PHI tables + a per-request tenant session variable). The
  implementation scoping — tiered target tables, policy shape, `withTenantTx` plumbing,
  migration/test strategy, a 6-PR rollout (~4–6 engineer-weeks), and open decisions
  D1–D7 — is recorded in `docs/decisions/ADR-010-rls-implementation-plan.md` (build
  deferred, not started).
- **`no-raw-fetch` coverage**: the ESLint rule now also enforces in `src/routes/` and
  `src/lib/`. Existing bootstrap / static-asset / legacy fetches carry inline
  disables-with-reason; two (`_dashboard/patients.tsx` POST and the
  `imaging-ceph-report` fetch) are flagged `TODO(sdk)` migration candidates.
- **Lint warning ceiling**: a `--max-warnings` ratchet is pinned (dentalemon 200,
  api-ts 349) so warnings can't grow. Still ~549 advisory warnings to burn down.
