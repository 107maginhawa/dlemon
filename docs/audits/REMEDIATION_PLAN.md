---
oli-version: "1.0"
based-on:
  - docs/audits/CHECK_SUMMARY.md (2026-06-02 full --auto run, GATE PASS)
last-modified: 2026-06-02
last-modified-by: oli-check remediation
status: in-progress
---

# OLI-Check Remediation Plan — 2026-06-02

Source: `CHECK_SUMMARY.md` §5 (19 improvements). GATE was already PASS (0 in-scope P0/P1);
these are P2/P3 quality + gap closures. Executed systematically in conflict-aware waves
(parallel agents on disjoint file domains; central verify gate after each wave — `bun run typecheck`
+ `bun run test` + `bun run check:boundaries`; shared test DB forbids concurrent suite runs).

## Verify gate per wave
`bun run typecheck` · `bun run test` (NEVER `bun test <path>` — pollutes clone template) ·
`bun run check:boundaries` · `bun run lint`.

## Execution table

| ID | Finding | Dimension | Sev | Wave | Domain | Status |
|----|---------|-----------|-----|------|--------|--------|
| F1 | api-ts lint included in CI gate (`--filter '*' lint`) | Enforcement EF-LINT | P3 | 0 | root config | ☐ |
| F2 | 3 prod `scheduler && emit()` → `if (scheduler) void emit()` | Enforcement | P3 | 1 | api-ts handlers | ☐ |
| F3 | Remove dead `publishAuditEvent`+`DENTAL_AUDIT_EVENTS_QUEUE` scaffold | Compliance V-EVT-001 | P2 | 1 | api-ts audit | ☐ |
| F4 | DB append-only trigger on `dental_audit_log` (deny UPDATE/DELETE) | Compliance V-AUD-IMM-001 | P3 | 1 | api-ts migration | ☐ |
| F5 | State-machine token CI lint (FSM tokens ⊆ code enums) | Consistency F-044 | P2 | 0 | scripts/CI | ☐ |
| F6 | `cargo audit` CVE scan for cadence + api-ts-embedded | Enforcement | P3 | 0 | scripts/CI | ☐ |
| F7 | Generate `emr-consultation/API_CONTRACTS.md` | Compliance V-CONS-001 / Consistency F-045 | P2/P3 | 0 | docs | ☐ |
| F8 | SEED_MANIFEST imaging boundary doc + seed 1 `imaging_study_image` row | Seed-Coherence SC-IMAGE | P2 | 0+2 | docs + seed | ☐ |
| F9 | MODULE_SPEC/WF nodes for legal-hold + retention | Traceability TR-LH/RET-001 | P2 | 0 | docs | ☐ |
| F10 | Explicit error state (vs empty) on `isError` in patients/scheduling/billing list hooks | Compliance V-FE-ERR-002 / Journeys | P2 | 3 | dentalemon FE | ☐ |
| F11 | Role-filter sidebar via existing `rbac.ts` ACCESS_MATRIX | Journeys J-RBAC-NAV-001 | P2 | 3 | dentalemon FE | ☐ |
| F12 | `branchId` → `required: true` in patients/imaging list ops | Seed-Coherence #2 | P2 | 2 | TypeSpec | ☐ |
| F13 | Tighten `branchId` callers / verify no regression | (paired with F12) | — | 2 | api-ts+FE | ☐ |
| F14 | Lemon-literal sweep → tokens + cva `lemon` Button variant (bounded slice + backlog) | Enforcement EU-COLOR | P3 | 4 | dentalemon FE | ☐ |
| F15 | Top-level `/imaging` route + studies-list screen | Journeys J-NAV-002 | P2 | 4 | dentalemon FE | ☐ |
| F16 | Facade-migration slice (imaging reach-ins) + backlog doc | Enforcement EB-BOUNDARY | P2 | 5 | api-ts | ☐ |
| F17 | AC tag normalization (AC-BIL/AC-BL) + dental-perio AC-NNN IDs | Traceability | P2 | 5 | tests+spec | ☐ |
| F18 | Curate UI_CONSISTENCY_SPEC `[VERIFY]` markers → promote from DRAFT | UI-Consistency | P3 | 5 | spec | ☐ |

## Deferred (product decision / separate repo — NOT executed, documented only)
| D1 | ADR-007 session TTL value + WFG-006 GDPR Art.20 portability format | needs product decision |
| D2 | oli-engine repo: widen scan scope + behavior.ts resolver + response_shape | separate repo |

## Backlog (large, staged beyond first slice)
- Lemon-literal full sweep (174 occ / 59 files) — one feature folder per PR after F14 variant lands.
- Full facade migration (54 reach-ins / 8 modules) — one PR per module after F16 imaging slice.
- E2E coverage for unit-only BRs (imaging annotation, scheduling) — raise BR→E2E above 26%.
