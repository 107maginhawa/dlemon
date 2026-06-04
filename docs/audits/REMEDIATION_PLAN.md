---
oli-version: "1.0"
based-on:
  - docs/audits/CHECK_SUMMARY.md (2026-06-02 full --auto run, GATE PASS)
last-modified: 2026-06-02
last-modified-by: oli-check remediation
status: complete (gate green; 11 commits)
---

## Final result (2026-06-02)
All actionable findings fixed or verified-already-satisfied across 11 commits on
`feat/ceph-demoable-and-manual-ux`. Final gate GREEN: root lint ✅ · api-ts typecheck ✅ ·
frontend typecheck ✅ · `check:boundaries` ✅ · `check:fsm-tokens` ✅ ·
api-ts **2975 pass / 0 fail** · frontend **1506 pass / 0 fail / 5 skip** (CalibrationDialog
flake eliminated — recovered 15 previously-poisoned tests).

# OLI-Check Remediation Plan — 2026-06-02

Source: `CHECK_SUMMARY.md` §5 (19 improvements). GATE was already PASS (0 in-scope P0/P1);
these are P2/P3 quality + gap closures. Executed systematically in conflict-aware waves
(parallel agents on disjoint file domains; central verify gate after each wave — `bun run typecheck`
+ `bun run test` + `bun run check:boundaries`; shared test DB forbids concurrent suite runs).

## Verify gate per wave
`bun run typecheck` · `bun run test` (NEVER `bun test <path>` — pollutes clone template) ·
`bun run check:boundaries` · `bun run lint`.

## Execution table

| ID | Finding | Dimension | Sev | Commit | Status |
|----|---------|-----------|-----|--------|--------|
| F1 | api-ts lint in CI gate | Enforcement EF-LINT | P3 | 66f29e50 | ✅ DONE |
| F2 | 3 prod `scheduler && emit()` → `if (scheduler) void emit()` | Enforcement | P3 | 66f29e50 | ✅ DONE |
| F3 | Remove dead `publishAuditEvent`+queue scaffold | Compliance V-EVT-001 | P2 | 6f8bc119 | ✅ DONE (verified 0 call sites) |
| F4 | DB append-only trigger on `dental_audit_log` | Compliance V-AUD-IMM-001 | P3 | d128fb94 | ✅ DONE (+test, 8 cleanups→TRUNCATE) |
| F5 | FSM-token CI lint | Consistency F-044 | P2 | 66f29e50 | ✅ DONE (caught+fixed real `sent`/`void` drift) |
| F6 | `cargo audit` CVE scan | Enforcement | P3 | 66f29e50 | ✅ DONE (script + CI job) |
| F7 | `emr-consultation/API_CONTRACTS.md` | Compliance V-CONS-001 / F-045 | P2/P3 | 1b83724a | ✅ DONE |
| F8 | SEED_MANIFEST imaging boundary doc | Seed-Coherence SC-IMAGE | P2 | 1b83724a | ✅ DONE (seed-row part skipped — see notes) |
| F9 | legal-hold + retention MODULE_SPECs | Traceability TR-LH/RET-001 | P2 | 1b83724a | ✅ DONE |
| F10 | Explicit error state on list hooks | Compliance V-FE-ERR-002 / Journeys | P2 | a10cfc4e | ✅ DONE (shared `<ListErrorState>`) |
| F11 | Role-filter sidebar via `rbac.ts` ACCESS_MATRIX | Journeys J-RBAC-NAV-001 | P2 | 7c23bd3f | ✅ DONE |
| F12/F13 | `branchId` required on `listDentalPatients` | Seed-Coherence #2 | P2 | 04f7d00c | ✅ DONE (imaging already required) |
| F14 | Lemon cva variant + token sweep (slice) | Enforcement EU-COLOR | P3 | 8b50ec23 | ◑ PARTIAL (variant + 4 files; 147 occ backlog) |
| F15 | imaging nav surface | Journeys J-NAV-002 | P2 | ba9f44e0 | ✅ DONE (NAV reconciled — workspace-scoped by design) |
| F16 | Facade migration (imaging reach-ins) | Enforcement EB-BOUNDARY | P2 | — | ⊘ DEFERRED (gate green; advisory; pervasive multi-PR backlog) |
| F17 | AC tags + dental-perio AC IDs | Traceability | P2 | — | ✅ VERIFIED ALREADY-SATISFIED (AC-P01–P10 exist; no AC-BL drift) |
| F18 | Curate UI_CONSISTENCY_SPEC `[VERIFY]` | UI-Consistency | P3 | ba9f44e0 | ✅ DONE (DRAFT→REVIEWED-PENDING-SIGNOFF) |

### Bonus fix (found during verify)
| FX | CalibrationDialog suite-order flake — process-wide `mock.module` leak | Confidence FE-FLAKE | P2 | 32caad6d | ✅ DONE (recovered 15 tests) |

### Notes / decisions
- **F8 seed-row skipped:** the committed "empty by design" boundary doc already closes SC-IMAGE-LIST-EMPTY; mutating the seed adds risk without changing finding status.
- **F16 deferred:** `check:boundaries` is green; the 54 reach-ins are advisory ESLint relative-import warnings and a pervasive established pattern (33+ files import `patient.schema` directly). True one-PR-per-module backlog; imaging's 2 are test-file schema imports — no value in isolation.
- **F17 already-satisfied:** verified perio MODULE_SPEC defines AC-P01–AC-P10 and billing tests/spec use `AC-BIL-` consistently (no `AC-BL`). The traceability finding was inaccurate on specifics.

## Deferred (product decision / separate repo — NOT executed, documented only)
| D1 | ADR-007 session TTL value + WFG-006 GDPR Art.20 portability format | needs product decision |
| D2 | oli-engine repo: widen scan scope + behavior.ts resolver + response_shape | separate repo |

## Backlog (large, staged — tracked, not done this session)
- **Lemon-literal full sweep** — ✅ DONE (2026-06-03). Swept all tokenizable lemon Tailwind arbitrary-value classes across 65 files (47 safe folders + 13 imaging + empty-state + shared) to the `lemon` token scale: `-[#FFE97D]`→`-lemon`, `-[#F5DC60]`→`-lemon-hover`, `-[#4A4018]`→`-lemon-foreground`, `-[rgba(255,233,125,.15)]`→`-lemon-soft`, `-[rgba(255,233,125,.35)]`→`-lemon-focus` (byte-identical CSS). Updated 3 imaging tests that asserted on the raw hex class. `src/constants/brand.ts` left as the source-of-truth. **Intentionally NOT swept:** SVG `fill="#FFE97D"` (CephReportView — SVG attrs can't use Tailwind tokens), off-token rgba opacities (0.03/0.08/0.1/0.3 today-highlights — no matching token), non-lemon hexes (`#FFD60A` crown, `#c8b800`), and inline styles using the `BRAND_GOLD_TEXT` constant. FE typecheck green; FE unit 1915/0/5.
- **Facade migration** — ✅ DONE (2026-06-04, zero reach-ins, rule now `error`). Drove the cross-module `no-restricted-imports` count **72 → 0** across 4 phases (Phase 1 unused-imports + REPO wraps + type re-exports; Phase 2 relocate batchable aggregate/report joins; Phase 3 relocate the inseparable name/branch joins — `patient.repo`, `provider.repo`, `recall.repo`, `bookingEvent.repo`, `billing.repo` — into same-module `*.facade.ts` bridge files with **byte-identical SQL**, no denormalization). Flipped the ESLint rule `warn → error` so the boundary stays at zero. Full backend suite 3366/0; typecheck + lint green. New facades: billing-booking, billing-dental-patient, billing-report, billing-person, clinical-dental-patient, visit-treatment-plan, patient-person, provider-person, recall-person, bookingEvent-person (+ extended visit-dental-patient & patient-dental-patient). Original partial-state note below is superseded.

- **Facade migration (superseded note)** — ⧗ PARTIAL (2026-06-03). Corrected the inflated count: an ESLint regex bug flagged `*.facade` imports as violations, so `emr/*` (already migrated) showed as 6 false positives — fixed the rule (`(?!.*\.facade)` lookahead) to mirror `check-module-boundaries.ts`. True backlog was 62 (not 54). **Migrated the clean handler reach-ins** (DI / existence-check / composition): `notifs` 5→0 (person-notifs facade), `billing` 13→1 (person-billing facade), `patient`/`provider` 2→1 each (person-provisioning facade), `dental-billing` getPatientBalance. **42 warnings remain** and are dominated by **read-joins that cannot be facaded without an N+1 downgrade** (`*.repo.ts` joining `persons` for list/name-search; `dental-billing` AR-aging/statement; `booking` persons joins) plus the **`dental-patient` aggregate (31)** which reads visits/invoices/medical-history across modules by design and can never reach 0 without query relocation. The global `no-restricted-imports` warn→error flip therefore stays blocked on cases where `warn` is the correct end-state; treat the rule as a steady-state advisory, not a migration to completion. **Update 2026-06-04:** migrated the last clean chunk — `dental-patient/identity` + `engagement` PatientRepository reach-ins (11 files) → extended `patient-dental-patient.facade` with 7 purpose-named wrappers; dental-patient 31→20, total **42→31**. The remaining 31 are all read-joins / type-only imports / the aggregate — `warn` is correct; no further migration planned.
- **Stale SDK regen** — ✅ DONE (2026-06-03, commit 7c0b8661). The "~33K lines" estimate was stale: the feared renames (`dentistMemberId→providerId`, removed `scheduledAt`/`durationMinutes`) had already landed in a prior regen. Only real drift was the `/dental/onboarding` endpoint (never regenerated) — purely additive (136 lines). dentalemon typecheck green; sdk-ts tests 64/0.
- **Contract suite reds** — ✅ DONE (2026-06-04, 35/38 → 38/38). All three long-standing "platform reds" were stale CONTRACT tests, not impl bugs: (a) `storage-edge` asserted a flat 50 MiB presign cap, stale since P2-7's per-MIME ceilings raised the generic default to 100 MiB → bumped the oversize fixture to >100 MiB; (b) `auth-password-reset` used the Better-Auth-renamed endpoint `/auth/forget-password` (404) → `/auth/request-password-reset` (200); (c) `cors` section 2 assumed the dev wildcard default and asserted a disallowed origin is echoed, but the dev `.env` (and production) use a strict allow-list that correctly rejects evil.com → realigned to the test's stated intent (preflight handled, HTTP 204).
- **E2E coverage for unit-only BRs** — ⊘ ASSESSED, NOT A REAL GAP (2026-06-04). Investigated: all 58/58 BRs already carry test coverage; imaging annotation BR-024..035 each have backend unit tests (BR-026: 6, BR-027: 6, BR-035: 4, …) and BR-024 also has E2E; scheduling BR-SCH-001..004 are covered (SCH-004 tagged + calendar-riley.spec.ts). The "~26% BR→E2E" is a layer-DISTRIBUTION metric, not a coverage hole — the unit-only BRs are predominantly backend data-integrity / RBAC / validation rules (NOT NULL, soft-delete, branch-isolation, modality default, MIME allow-list, 100 MB cap) where unit/contract is the CORRECT layer; the project's own TRACE_REPORT classifies this as P2/report-only. Adding canvas-drawing / upload E2E to inflate the metric would add flake risk for no real coverage gain. Recommendation: keep as report-only; add targeted E2E only for a specific high-value persistence/RBAC flow if a concrete need arises.

## Deferred — product decision / separate repo (unchanged)
- **D1** ADR-007 session TTL value + WFG-006 GDPR Art.20 portability format — needs product decision.
- **D2** oli-engine repo: widen scan to `services/api-ts/**` + `spec_trace_optin` + behavior.ts raw-fetch resolver + `response_shape`. Clears TR-INFRA-001 + restores Confidence headline 9.
