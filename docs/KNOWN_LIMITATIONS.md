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

## Frontend spec-drift TODOs (4)

These mark fields the UI wants but the TypeSpec/SDK does not yet expose; the UI
falls back to base fields until the contract is extended and the SDK regenerated:

- `apps/dentalemon/src/features/workspace/components/rx-sheet.tsx:78` — prescription `warnings`
- `apps/dentalemon/src/features/workspace/hooks/use-treatment-plan.ts:15`
- `apps/dentalemon/src/features/billing/hooks/use-invoices.ts:15` — `patientName` + `visitDate` on invoice list
- `apps/dentalemon/src/features/billing/hooks/use-invoice-detail.ts:47` — `outstandingCents`/`patientName`/`visitDate`/`lineItems`/`payments`

## Logging hygiene

- **Frontend**: ~30 `console.*` calls remain in `apps/dentalemon/src` (hotspots:
  `features/imaging/hooks/use-image-library.ts`, `features/notifications/onesignal.ts`,
  workspace tooth-save flows). These should migrate to a shared logger/error hook.
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
  `docs/` and could move to `docs/_ai-process/` or `.claude/`. One untracked file
  (`docs/aha/prompts/08-qa-uat-workflow-guide.md.md`) has a `.md.md` typo — left
  untouched (untracked, not in scope).

## Architectural decisions in flight

These are under review (do not assume the current state is final):

- **DB row-level security (RLS)**: not implemented; tenant isolation is enforced at
  the application/repository layer. `docs/decisions/ADR-007-self-service-onboarding.md`
  flags RLS as recommended before GA.
- **Form library**: 4 person forms use `react-hook-form`; the documented stack
  standard is TanStack Form. Either migrate or record a project override.
- **`no-raw-fetch` coverage**: the ESLint rule globs only `apps/dentalemon/src/features/**`;
  `routes/` and `lib/` are unguarded and contain a few direct `fetch` calls (some
  bootstrap-justified, e.g. PIN entry; one — `routes/imaging-ceph-report.$imageId.tsx`
  — has an SDK equivalent).
- **Lint warning ceiling**: ~549 lint warnings (mostly `no-unused-vars` in api-ts and
  `no-explicit-any` at `warn` in the frontend) are advisory; no `--max-warnings` gate.
