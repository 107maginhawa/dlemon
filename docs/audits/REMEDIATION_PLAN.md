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
- **Lemon-literal full sweep** (147 occ / 59 files remaining) — one feature folder per PR; reuse the proven `bg-[#FFE97D]`→`bg-lemon` token mapping + `<Button variant="lemon">`. (`src/constants/brand.ts` is the intentional source-of-truth — do NOT swap.)
- **Facade migration** — ⧗ PARTIAL (2026-06-03). Corrected the inflated count: an ESLint regex bug flagged `*.facade` imports as violations, so `emr/*` (already migrated) showed as 6 false positives — fixed the rule (`(?!.*\.facade)` lookahead) to mirror `check-module-boundaries.ts`. True backlog was 62 (not 54). **Migrated the clean handler reach-ins** (DI / existence-check / composition): `notifs` 5→0 (person-notifs facade), `billing` 13→1 (person-billing facade), `patient`/`provider` 2→1 each (person-provisioning facade), `dental-billing` getPatientBalance. **42 warnings remain** and are dominated by **read-joins that cannot be facaded without an N+1 downgrade** (`*.repo.ts` joining `persons` for list/name-search; `dental-billing` AR-aging/statement; `booking` persons joins) plus the **`dental-patient` aggregate (31)** which reads visits/invoices/medical-history across modules by design and can never reach 0 without query relocation. The global `no-restricted-imports` warn→error flip therefore stays blocked on cases where `warn` is the correct end-state; treat the rule as a steady-state advisory, not a migration to completion. Remaining clean-ish chunk: `dental-patient/identity/*` PatientRepository reach-ins (~11 files) → patient facade, if pursued.
- **Stale SDK regen** — ✅ DONE (2026-06-03, commit 7c0b8661). The "~33K lines" estimate was stale: the feared renames (`dentistMemberId→providerId`, removed `scheduledAt`/`durationMinutes`) had already landed in a prior regen. Only real drift was the `/dental/onboarding` endpoint (never regenerated) — purely additive (136 lines). dentalemon typecheck green; sdk-ts tests 64/0.
- **E2E coverage** for unit-only BRs (imaging annotation BR-024..035, scheduling BR-SCH-001..004) — raise BR→E2E above ~26%.

## Deferred — product decision / separate repo (unchanged)
- **D1** ADR-007 session TTL value + WFG-006 GDPR Art.20 portability format — needs product decision.
- **D2** oli-engine repo: widen scan to `services/api-ts/**` + `spec_trace_optin` + behavior.ts raw-fetch resolver + `response_shape`. Clears TR-INFRA-001 + restores Confidence headline 9.
