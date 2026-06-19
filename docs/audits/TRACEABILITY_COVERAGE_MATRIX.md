# Traceability Coverage Matrix

**Generated:** 2026-06-19 against HEAD `4b13dc0a` (KG refreshed same commit).
**Question answered:** can we trace persona → workflow → business rule → test → code, end to end, per module?
**Method:** computed from `br-registry.json` (BRs), `contract-spine.json` (API ops + FE consumers), `knowledge-graph.json` (code map), and the 22 journey specs. Not a manual audit.

## Matrix

| Module | KG files | BRs | BR-traced¹ | BR-in-journey² | Ops | Ops w/ FE |
|---|--:|--:|--:|--:|--:|--:|
| dental-visit | 59 | 9 | 7 (78%) | 3 | 30 | 29 (97%) |
| dental-scheduling | 45 | 6 | 1 (17%) | 1 | 19 | 12 (63%) |
| dental-billing | 74 | 14 | 13 (93%) | 0 | 26 | 19 (73%) |
| dental-clinical | 71 | 5 | 4 (80%) | 0 | 33 | 22 (67%) |
| dental-org | 58 | 2 | 1 (50%) | 0 | 35 | 19 (54%) |
| dental-patient | 128 | 6 | 3 (50%) | 0 | 75 | 35 (47%) |
| dental-pmd | 15 | 7 | 2 (29%) | 1 | 9 | 0 (0%) |
| dental-perio | 15 | 9 | 9 (100%) | 0 | 6 | 5 (83%) |
| dental-imaging | 73 | 40 | 25 (63%) | 0 | 33 | 26 (79%) |
| dental-audit | 6 | 6 | 0 (0%) | 0 | 1 | 1 (100%) |
| erasure-legal-hold-retention | 43 | 6 | 0 (0%) | 0 | 9 | 3 (33%) |
| dental-portal | 4 | 5 | 0 (0%) | 0 | 3 | 3 (100%) |
| emr-consultation | 11 | 5 | 0 (0%) | 0 | 6 | 0 (0%) |
| provider | 19 | 4 | 0 (0%) | 0 | 11 | 0 (0%) |
| external-records-import | 0 | 4 | 0 (0%) | 0 | 0 | 0 (0%) |
| **TOTAL** | | **128** | **65 (51%)** | **5** | **296** | **174 (59%)** |

¹ BR-traced = the rule id appears in a test file **OR** the registry rule's `source` cites a `.test.ts`/`.spec.ts`. Measures explicit traceability, not whether behavior is tested.
² BR-in-journey = the rule id is cited inside a journey spec. Journeys rarely cite BR ids by convention, so this column under-reads real journey coverage.

## The key finding: this is a LINKING gap, not a TEST gap

Every module that shows 0% BR-traced still has a substantial real test suite:

| Module | test files | `expect()` calls | Verdict |
|---|--:|--:|---|
| dental-audit | 6 | 147 | tested, not BR-linked |
| erasure/legalhold/retention | 22 | 294 | tested, not BR-linked |
| dental-portal | 1 | 73 | tested, not BR-linked |
| emr-consultation | 6 | 219 | tested, not BR-linked |
| provider | 5 | 78 | tested, not BR-linked |
| external-records-import | 0 | 0 | **no code home** — BRs may live in dental-pmd import |

So the behavior is largely tested. What's missing is the **back-link** that says "test X proves rule Y." 49% of BRs have no such pointer, which is exactly why an end-to-end persona trace isn't currently computable.

## Genuine gaps, ranked

1. **BR↔test back-link missing for ~49% of rules** (audit, erasure set, portal, emr, provider have zero links despite rich suites). Fix = add a `source`/`testRef` to each registry rule. Cheap, mechanical, makes traceability computable and keeps future audits honest.
2. **FE-consumer gaps (backend ops with no UI caller):** dental-pmd (9 ops), provider (11), emr-consultation (6). Decide per module: intentional backend-only, or missing UI. PMD (medical/dental history) having zero FE consumers is the most clinically notable.
3. **`external-records-import`: 4 BRs, no code home.** Reconcile — either point the rules at their real implementation (likely dental-pmd import) or retire them.
4. **Journey↔BR labeling near-absent** (5 ids across 22 journeys). Low priority; journeys are persona-flow tests, not BR-cited. Adding a one-line `Covers: BR-xxx` header per journey would close it.

## Personas covered by journeys

All 22 journeys carry `Persona:` — `dentist` (+ variants: documents/edits/plans/presents), `free-clinic dentist`, `admin-allowlisted owner with no clinic yet`. No receptionist/front-desk or patient-portal persona journey exists yet.

## What this does NOT prove

The matrix proves wiring (code exists, tests exist, links exist-or-not). It does **not** prove the flows actually run green in a live app — that's the live journey-harness run (next task).

---

## UPDATE 2026-06-19 — gap closed

**Live journey harness:** ran the full roster against a booted stack (reseed + DOM-drive) → **22/22 PASS, 0 broken, 0 error**. The mapped flows work end-to-end, not just on paper.

**BR→test back-link backfill: COMPLETE.** A read-only agent sweep (one per module, 3 review-gated waves) located the deciding assertion for every untraced rule and verified it against the test source (never filename/comment). Applied centrally with a file-existence guard.

| | Before | After |
|---|--:|--:|
| BR-traced (rule cites its proving test) | 65/128 (51%) | **127/128 (99%)** |
| Rules with a `\|\| TEST:` link in `source` | ~ | **123** |
| Documented NO_TEST (with reason) | 0 | **5** |
| Unaccounted rules | 63 | **0** |

### The 5 documented NO_TEST (each a real, named finding)
1. **BR-010 (billing tax) — DRIFT RISK.** No test asserts tax is server-hardcoded to 0/ignored-from-caller, and `invoice-lifecycle.test.ts` FR4.10 stores an arbitrary `taxRate=0.12` at the repo level (the opposite). Ties directly to the deferred PH-VAT work (ADR-011 descope). **Decide intent before PH localization.**
2. **BR-019 (clinical-record immutability)** — the amendment/append-only behavior lives in the `dental-visit` module (amendment table), not `dental-patient`; the rule is mis-homed in the registry. Re-home or cross-ref.
3. **BR-031** — frontend-only IndexedDB offline cache; backend unaffected. No backend test expected (could add an FE test).
4. **BR-032** — schema default `modality='other'` exists but no test omits the field to prove the default applies. One-line test would close it.
5. **V-XRI-003** — FHIR/CDA/PDF import bridge is future-phase, not built. Correct to have no test.

### Residual non-blocking findings (carried as their own tasks)
- **Partials** (rule mostly tested, one sub-clause not): provider V-PROV-004 (handler 404/204 path), audit V-AUD-007 (connection-retry + explicit-row-id sub-claims), scheduling BR-004 (delete-doesn't-delete-visit — structurally guaranteed, no hard-delete path), imaging BR-023/BR-035, pmd EF-PMD-005 (200-char cap). All noted inline in the rule `source`.
- **FE-consumer gaps** unchanged: dental-pmd (9 ops), provider (11), emr (6) have backend ops with no UI caller — intentional-backend-only vs missing-screen call still open.
- **BR-020** (patient merge/unmerge) is `501 NOT_IMPLEMENTED` — the test pins the stub; real implementation is future work.
