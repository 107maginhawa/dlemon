# Verification Snapshot — 2026-06-06 (live gate run)

**What this is.** A dated, evidence-based answer to three questions: *is the code
clean and green? is it mapped and tested? can AI extend it?* Unlike a cited
status, every number below comes from a **live run executed this session** on
`main` HEAD `d9f50d22`. It is a point-in-time snapshot, not a living source of
truth — re-run the commands to refresh.

Companion docs: [E2E_COVERAGE_ASSESSMENT_2026-06-06.md](./E2E_COVERAGE_ASSESSMENT_2026-06-06.md)
· [BACKEND_COVERAGE_TOPOLOGY.md](./BACKEND_COVERAGE_TOPOLOGY.md) · [TEST_STANDARDS.md](./TEST_STANDARDS.md)

---

## 1. Is it clean and green? — PROVEN, this session

Every gate was run live (not cited). All green.

| Gate | Command | Result |
|---|---|---|
| Backend unit | `services/api-ts` → `test-with-db.ts` (per-file DB clones, `monobase_test`) | **3380 pass / 0 fail** (288 files, 71s) |
| Contract | `bun scripts/run-contract-tests.ts` (Hurl vs booted impl + MinIO/Mailpit) | **38/38 files, 586 requests, 0 fail** |
| Typecheck | `bun run typecheck` | **0 errors** |
| Lint | `bun run lint` | **0 errors** (4479 `no-explicit-any` *warnings* in api-ts — non-blocking) + FSM tokens match |
| Module boundaries | `check:boundaries:error` (strict) | **No cross-module repo boundary violations** |
| Frontend unit | `bun run test` | **1952 pass / 0 fail** (169 files, 5225 assertions) |
| Golden-path E2E | `cold-start-full-loop.spec.ts` (chromium) | **1 passed** — fresh signup → onboarding → clinical → billing → back-office, asserting rendered content |

**Interpretation:** "clean / industry-standard / no broken points" is replaced by
a binary fact: **all gates pass on HEAD.** "No bugs" is not a provable claim for
any codebase — see the deferred backlog (§4) for what is *known* and open.

## 2. Is it mapped and tested? — Mapping is fresh; coverage is real

### Contract spine (the load-bearing map), regenerated to HEAD this session
`scripts/build-contract-spine.ts` → `.understand-anything/contract-spine.json`:

| Metric | Count | Meaning |
|---|---|---|
| Operations | **352** | every OpenAPI operation |
| With handler | **352 / 352** | 100% wired — no orphan routes |
| With SDK hook | **344 / 352** | the 8 without are intentional integration-only surfaces (PMD import/export, `listEMRPatients`) — documented in [INTEGRATION_ENDPOINTS.md](../architecture/INTEGRATION_ENDPOINTS.md) |
| With FE consumer | **76 / 352** (static lower bound) | see caveat |

> **Consumer-count caveat (read this).** "76 with consumers / 276 without" is a
> **static-scan lower bound**, not "276 dead endpoints." The spine counts only
> *direct* SDK-hook references under `features/**`. Hooks wrapped one layer deep,
> calls made via E2E API-assist, and not-yet-surfaced admin operations all read
> as "0 consumers" while being perfectly live (e.g. `cancelAppointment`,
> `applyDentalDiscount`). The reliable columns are **handler (352/352)** and
> **SDK (344/352)**; treat the consumer column as a floor.

### Coverage is asserted, not mocked
Per the companion E2E assessment: 39 of 52 non-journey E2E specs seed real
records and assert rendered content; the ~13 chrome-only specs are legitimately
UI-scoped (responsive layout, tool-state, PIN keypad) or covered by the
cold-start golden path. Backend coverage includes FSM property tests, RBAC/HTTP,
cross-org isolation, and a 65-case business-rules suite.

## 3. Can AI extend it easily? — Yes; the extension path is in place

What actually makes AI extension cheap (and all of it is current):
1. **The contract spine** — `operationId → handler → SDK hook → consumer`, fresh
   at HEAD. An agent traces it to know exactly where a new module plugs in.
2. **A repeatable module path** — Vertical TDD 10-step (`docs/development/VERTICAL_TDD.md`),
   `specs/api/IMPLEMENTING.md`, and the `.claude/skills/` (typespec → handler →
   frontend-module → test-*). TypeSpec → OpenAPI → codegen → implement.
3. **Enforced invariants** — strict module boundaries (CI-gated), no-raw-fetch
   lint rule (SDK-only data access), FSM-token sync check.

## 4. Known / deferred backlog (honest "what's open")

"No broken points" is the wrong frame; this is the right one. Per project memory
(the OLI tracking artifacts that held these were purged in `9bbd60db` — **re-confirm
before relying**):
- 3 dependency CVEs (transitive; `overrides` already pin several in root `package.json`).
- Data-governance: retention / right-to-erasure (WFG-006) completeness.
- Misc spec-precision items (401 declaration, datetime query-param typing) — fuzz
  showed **0 real 500s**; these are contract-precision, not impl bugs.

None block the gate. They are tracked product decisions, not hidden defects.

## 5. Knowledge-graph freshness — a deliberate low-debt choice

The full `knowledge-graph.json` (architecture/tour/prose summaries) is a **derived,
regenerable artifact** last *fully* built at `0c0f1588` (~19 commits back, mostly
the doc-reorg + SDK-migration). Decision taken 2026-06-06:

- **Did:** regenerated the load-bearing `contract-spine.json` to HEAD; **enabled
  `autoUpdate`** in `.understand-anything/config.json`. The plugin's own hooks
  (commit-triggered + session-start staleness check) now keep the graph current
  via **fingerprint-gated incremental analysis** — zero LLM tokens for cosmetic
  changes, re-analysis only on structural change.
- **Did not:** a one-time manual full rebuild — for a derived artifact that's the
  effort-equivalent of resetting a clock that restarts on the next commit.
  Automation is the lower-debt, standards-aligned answer.
- **To force a full refresh anytime:** `/understand --full`.

---

### Reproduce this snapshot
```bash
# infra (Postgres local; MinIO/Mailpit/stripe-mock via docker)
docker compose -f services/api-ts/docker-compose.deps.yml up -d minio mailpit stripe-mock
# backend
cd services/api-ts && DATABASE_URL=postgresql://postgres:password@localhost:5432/monobase_test bun run scripts/test-with-db.ts
# contract (boot impl on a scratch DB first, then:)
API_URL=http://localhost:7213 bun scripts/run-contract-tests.ts
# frontend gates
bun run typecheck && bun run lint && (cd services/api-ts && bun run check:boundaries:error)
bun run test
cd apps/dentalemon && bunx playwright test cold-start-full-loop.spec.ts --project=chromium
# refresh the spine
bun scripts/build-contract-spine.ts
```
