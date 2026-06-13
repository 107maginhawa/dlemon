# Plan: Checkpoint research to GitHub for device transfer

## Context (current task)

The workspace-workflow gap research is DONE — `docs/audits/workspace-workflow-research/`
holds `REPORT.md` (494 lines) + 6 appendices. The user is switching devices and wants
this pushed to GitHub, plus a self-contained prompt to resume on the new device. Two
constraints: (a) the forward roadmap + resume prompt currently live only in this local
`~/.claude/plans/` file, which git does NOT transfer; (b) the project's per-device memory
(`~/.claude/projects/.../memory/`) also won't transfer — so the resume context must be
captured IN the repo.

Branch: `chore/workflow-verification-sweep` (already pushed; in sync with origin before
this checkpoint).

## Steps

1. **Mirror resume context into the repo** (so the new device is self-sufficient):
   - Create `docs/audits/workspace-workflow-research/NEXT-STEPS.md` — status, the Tier-1
     ready-to-execute slices (SL-03/SL-05/SL-08), pointer to REPORT §5 (slice plan) + §6
     (21 decisions), and the verbatim **resume prompt** below.
   - Copy this plan file's research-prompt + roadmap into
     `docs/audits/workspace-workflow-research/RESEARCH-PROMPT-AND-ROADMAP.md` for
     traceability (the methodology that produced the report).

2. **Commit A — research deliverable:** `docs/audits/workspace-workflow-research/`
   (REPORT + 6 appendices + NEXT-STEPS + RESEARCH-PROMPT-AND-ROADMAP).
   Message: `docs(research): workspace workflow gap research — REPORT, 6 appendices, next-steps`.

3. **Commit B — checkpoint pre-existing audit docs** (so they travel; flag that these were
   authored in prior sessions, not this one): `docs/audits/module-gap-plans/*.md`,
   `docs/audits/workflow-verification/runs/**`, and the modified
   `docs/audits/workflow-verification/TRACKER.md`.
   Message: `docs(audit): checkpoint module-gap-plans + workflow-verification runs`.

4. **`outputs/` (19MB scratch):** do NOT commit. Append `outputs/` to `.gitignore` (own
   commit: `chore: gitignore outputs/ audit scratch`). It is regenerable working output;
   if the user later needs it on the other device it can be copied manually.

5. **Push** `chore/workflow-verification-sweep` to origin.

6. **Hand the user the resume prompt** (also in NEXT-STEPS.md).

## Resume prompt (for the new device — paste into Claude Code at the repo root)

> On branch `chore/workflow-verification-sweep`. Read
> `docs/audits/workspace-workflow-research/NEXT-STEPS.md` and `REPORT.md` (especially §5
> Master Slice Plan and §6 Decisions). We just finished a read-only workspace-workflow
> gap-research pass. I want to start executing the fixes. Begin with the three
> no-decision P1 slices, each via Vertical TDD (RED tests first, full gate, one atomic
> commit per slice):
> - **SL-03** — per-tooth chart data-loss: `updateTooth`/per-surface PATCH skips the
>   baseline merge that `upsertDentalChart` does, so single-tooth edits drop out of
>   next-visit carry-over (appendix-B, B-G1).
> - **SL-05** — make `voidDentalInvoice` audit fail-closed like payment-void
>   (`services/api-ts/src/handlers/dental-billing/voidDentalInvoice.ts:61`; appendix-E,
>   E-NEW-02; also corrects MASTER-GAP-MATRIX P1-C).
> - **SL-08** — cross-tenant optional-branch sweep for portal/emr/provider/
>   external-import (appendix-F, F-G06).
> Then surface decisions #1 (canonical plan-accept), #2 (offline-sync harden now vs
> defer — recommended now), #7 (carry-over model), #14 (EMR scope + do the cross-tenant
> regression test regardless) before the gated slices. Gotchas: backend tests per-file via
> `services/api-ts/scripts/test-with-db.ts` with `DATABASE_URL=...monobase_test`; restart
> API before contract; api-ts `bunx tsc` separately from root `bun run typecheck`.

## Verification

- `git status` clean except ignored `outputs/`; `git log --oneline -3` shows the new
  commits; branch in sync with origin (`git status -sb` shows `...origin/... ` with no
  ahead/behind after push).
- `REPORT.md` + `NEXT-STEPS.md` present at the pushed commit (`git show --stat HEAD`).

---

# (Prior task) Workspace Workflow + Edge-Case Gap Research Prompt

> This is the research methodology that produced the report above. Mirrored into the repo
> as `RESEARCH-PROMPT-AND-ROADMAP.md` for traceability.

## Context

The dental **workspace timeline carousel** is the product's hub — it orchestrates the
visit lifecycle, the living-document odontogram, the treatment/treatment-plan FSMs, and
~11 auxiliary sheets (SOAP, Rx, consent, lab, PMD, attachments, imaging, perio, recalls,
payment, plan-versioning). Recent work shipped cumulative cross-visit chart layers and
closed the declined/carried-over seed gap. The user now wants to step back and, **before
building anything**, get a rigorous research pass that:

1. enumerates every workflow + business rule already implemented across the workspace,
2. researches *candidate* new workflows and edge cases a real dental practice needs,
3. surfaces gaps — especially **sequencing/ordering logic** — through four lenses,
4. binds every finding to the existing KG, module specs, and BR registry, and
5. expresses each accepted candidate as a **Vertical-TDD-ready slice** (no implementation).

The deliverable of THIS plan is the **research prompt** below — it is not an
implementation. It is engineered so the research lands against the repo's real
sources of truth instead of free-associating, and so its output is directly
executable later via the project's Vertical-TDD protocol.

Scope decisions (confirmed): **whole workspace surface** · output = **report + TDD-ready
slices** · lenses = **all four** (sequencing, security/RBAC/multi-tenant, offline P2P
sync, clinical-correctness).

## How to run it

The prompt is tool-agnostic but the surface is too large for one pass — **mandate
chunk-by-family + a synthesizer** so parallel researchers partition identically (one
agent per chunk, all emitting the same per-finding row schema; the synthesizer dedupes
and reconciles). Fixed chunks:

- **Chunk A — Visit lifecycle + FSMs:** visit FSM, treatment FSM, treatment-plan
  phasing/versioning/carry-over.
- **Chunk B — Living-document odontogram:** baseline/proposed/completed/declined/
  carried-over layers, compare/diff, mixed dentition, per-surface tooth slideout, merge.
- **Chunk C — Clinical sheets:** SOAP/notes, emr-consultation note, Rx, consent,
  case-presentation/acceptance, perio.
- **Chunk D — Ancillary sheets:** lab orders, PMD, attachments, external-records-import,
  imaging.
- **Chunk E — Commercial + recall:** payment/invoice (billing), recalls (scheduling).
- **Chunk F — Cross-cutting (one researcher, spans all chunks):** audit ordering,
  RBAC/branch-scope, offline P2P sync, retention/legal-hold interactions.
- **Synthesizer:** dedupes, reconciles against `MASTER-GAP-MATRIX.md`, owns the executive
  summary + cross-chunk ordering invariants + slice dependency ordering.

Run as a `Workflow` (chunk researchers in parallel → synthesizer) or `/deep-research`
per chunk. It is read-only; it writes one report doc + proposes slices. Nothing else
changes. Output path: `docs/audits/workspace-workflow-research/REPORT.md` (+ per-chunk
appendices), beside the existing `docs/audits/` corpus it cites.

---

## THE PROMPT (hand this to the researcher / workflow)

> **Role.** You are a clinical-software workflow analyst auditing the dental **workspace**
> of the Dentalemon monorepo (`/Users/eladventures/Desktop/dentalemon`). Your job is
> research and analysis only — **write no production code, run no migrations, make no
> commits.** You produce one report plus TDD-ready slice specs.
>
> **Goal.** For the entire workspace surface reachable from the timeline carousel,
> (1) inventory what workflows and business rules already exist, (2) research candidate
> new workflows and edge cases a real dental practice needs, (3) find gaps — with
> explicit attention to *sequencing/ordering logic* — and (4) express each accepted
> candidate as a Vertical-TDD slice. Every claim must cite a `file:line` or a canonical
> doc; mark anything you could not verify as `[ASSUMPTION]`.
>
> ### Surface to cover (whole workspace)
> Visit lifecycle FSM · living-document odontogram (baseline/proposed/completed/declined/
> carried-over, compare/diff, mixed dentition) · treatment FSM + treatment-plan
> (phasing, accept/versioning, carry-over) · tooth slideout (per-surface condition) ·
> and every sheet: SOAP/notes, Rx, consent, **case-presentation/acceptance**,
> **emr-consultation note**, lab orders, PMD, attachments, **external-records-import**,
> imaging, perio, recalls, payment/invoice. (reviews/NPS is a base-template module, NOT
> part of the clinical workspace surface — out of scope.) FE hub:
> `apps/dentalemon/src/routes/_workspace/$patientId.tsx` and
> `apps/dentalemon/src/features/workspace/`. Cross-check the surface against the handler
> dirs under `services/api-ts/src/handlers/` so no implemented module is missed.
>
> ### Step 0 — Read the sources of truth first (do NOT reinvent the inventory)
> These already codify the workflows/rules. Read them before exploring code, and cite
> them by id throughout:
> - **BR registry:** `specs/api/docs/standards/br-registry.json` (rule id → status →
>   source `file:line` → test) and prose FSMs in `specs/api/docs/standards/business-rules.md`.
> - **Module specs:** `docs/product/modules/{module}/MODULE_SPEC.md` — the real module
>   dirs are: dental-visit, dental-patient, dental-clinical, dental-perio, dental-imaging,
>   dental-org, dental-scheduling, dental-billing, dental-pmd, dental-audit,
>   emr-consultation, external-records-import, legal-hold, retention (14 dirs; workflows
>   `WF-xxx`, ACs, edge cases, threat model, permissions). **case-presentation,
>   dental-portal, provider, reviews have handlers + `docs/audits/module-gap-plans/*.md`
>   but NO MODULE_SPEC — use the gap-plan as the spec surrogate for those.**
> - **Known gaps (so you don't re-report them as new):** `docs/audits/MASTER-GAP-MATRIX.md`,
>   `docs/audits/module-gap-plans/*.md`, `docs/audits/MODULE_AUDIT_TRACKER.md`.
> - **Wiring truth / KG:** `.understand-anything/contract-spine.json`
>   (operationId→handler→SDK→FE consumers; use it to spot orphan ops and FE-pending
>   endpoints) and `.understand-anything/domain-graph.json` (domain/entity KG —
>   **note: stale on type-import edges since 2026-06-06; trust it for domains/entities,
>   not fine-grained imports**).
> - **Contracts/FSMs:** `specs/api/src/modules/*.tsp`; backend FSM transition tables
>   `services/api-ts/src/handlers/dental-visit/repos/treatment.schema.ts:167`
>   (`TREATMENT_TRANSITIONS`) and `visit.schema.ts:64` (`VISIT_TRANSITIONS`, statuses
>   `draft/active/completed/locked/discarded`). FE mirror:
>   `apps/dentalemon/src/features/workspace/lib/visit-status.ts`. Other FSM property-test
>   exemplars exist (consultation-note, appointment, claim, prescription, imaging-finding,
>   ceph-landmark `*.fsm.property.test.ts`).
> - **TDD protocol (binds your slice output):** `docs/development/VERTICAL_TDD.md`.
>
> ### Step 1 — Baseline inventory
> Produce a table of **implemented** workflows + business rules across the surface. For
> each: workflow name · FE entry (`file:line`) · backend handler/endpoint · governing rule
> ids (FR/BR/AC/CHART-*/V-VIS-*/EM-*/EF-*/P0-P1/ADR-00x) · current test coverage
> (backend unit / contract / FE unit / E2E — cite the test file, or mark `UNTESTED`).
> Reconcile against br-registry + contract-spine. Flag deferred/interim markers
> (e.g. ADR-008 read-time-interim, ADR-010 auto-discard flag).
>
> ### Step 2 — Sequencing analysis (the "applicable logic in the sequence" focus)
> For each workflow family, write the **ordered step sequence** with pre/postconditions,
> then probe where the *ordering itself* can break:
> - out-of-order actions (e.g. invoice before treatment performed; complete before
>   consent; chart edit after lock; carry-over from a non-completed source),
> - concurrent / interleaved actions (two devices, two members, two open sheets),
> - partial-failure / resumability (the two-step mark-done FIX-01 pattern is the
>   reference — find other multi-write sequences lacking it),
> - idempotency & retries (localId/GAP-001 — which writes still aren't idempotent),
> - cross-workflow ordering invariants (visit→consent→perform→complete→invoice;
>   phase order P1-18; chart-layer precedence completed>proposed>declined).
> Output a per-family sequence diagram (text) + a list of ordering gaps.
>
> ### Step 3 — Candidate workflows & edge cases (research outward)
> Beyond what exists, research what a real dental practice workflow needs that this
> surface lacks or under-serves. Ground candidates in dental-practice reality (cite
> reasoning; reference standards where relevant). For EACH candidate or edge case,
> run **all four lenses** and tag which surfaced it:
> 1. **Sequencing/ordering** (per Step 2).
> 2. **Security / RBAC / multi-tenant** — branch-scope leaks, role-authority gaps,
>    cross-tenant read/write (the V-VIS-011 / EM-BIL-002 bug class). Check every new
>    op for branch-scope + role gate.
> 3. **Offline-first / P2P sync (cadence)** — idempotent localId, last-write-wins
>    per-tooth chart merge, concurrent visit/treatment edits across devices, conflict
>    resolution + audit ordering. (See `services/cadence/`, baseline-merge in
>    `upsertDentalChart.ts`.)
> 4. **Clinical-correctness / standards** — FDI numbering, perio AAP/EFP staging,
>    FSM clinical validity, consent legal-record integrity (BR-014), dentition rules
>    (P1-17), extracted-tooth guards (EC2). Respect intentional non-goals (local-first,
>    no-AI — do NOT propose ceph AI auto-tracing or perio voice charting).
>
> ### Step 4 — Map every finding (KG + modules + BR alignment)
> For each gap/candidate/edge case, record:
> - **KG node**: matching `domain-graph.json` domain/entity (or note "new entity").
> - **Module**: owning `MODULE_SPEC.md` + workflow id (`WF-xxx`), or "spec gap — no WF".
> - **BR**: existing `BR-xxx` it strengthens, or a **proposed new `BR-####`** with a
>   one-line guard statement in business-rules.md style.
> - **Wiring**: contract-spine operationId/handler if it exists, or "no endpoint yet".
> - **Status vs known gaps**: `KNOWN` (cite MASTER-GAP-MATRIX/module-gap-plan id) or `NEW`.
> - **Severity P0–P3** + blast radius. Use the closed vocabulary: blast-radius ∈
>   {PHI-leak, money, data-loss, cross-tenant, cosmetic}; severity per MASTER-GAP-MATRIX
>   (P0 = PHI/money/data-loss/cross-tenant in a prod path; P1 = workflow-breaking;
>   P2 = correctness/coverage; P3 = cosmetic/docs).
>
> Emit every register row with this exact schema (so parallel chunks stay consistent):
> `| id | finding | chunk | IMPLEMENTED|KNOWN|NEW | lenses{S,R,O,C} | KG-node | MODULE/WF-id | BR-id (existing|proposed BR-####) | spine-op/handler | severity | blast-radius |`
>
> ### Step 5 — TDD-ready slices (for accepted candidates)
> For each NEW candidate worth building, emit a **Vertical-TDD slice spec** per
> `VERTICAL_TDD.md` — design only, no code. Number slices `SL-01…` in value order and
> express dependencies as `depends: SL-0x`:
> - the 10-step sequence scoped (apply skip rules: backend-only skips FE steps),
> - named **RED tests first**:
>   - backend `*.test.ts` — run **from `services/api-ts/`** via
>     `bun run scripts/test-with-db.ts <file>` (i.e. `services/api-ts/scripts/test-with-db.ts`)
>     with `DATABASE_URL=postgresql://postgres:password@localhost:5432/monobase_test`;
>     **per-file** invocation — never `bun test <path>`, never the directory-arg mode
>     (shares one DB clone → false cross-suite failures);
>   - contract `*.hurl` — run via `scripts/run-contract-tests.ts` against `$API_URL`;
>     **restart the API server before the run** (a stale dev server masks contract drift);
>   - FE `*.test.ts` — note the **DentalChart is globally stubbed** at
>     `apps/dentalemon/src/test-setup.ts` (renders `data-testid="dental-chart-stub"`), so
>     chart logic is tested as pure functions (`deriveChartLayerSets`/`resolveToothLayer`)
>     and asserted live **only in E2E**; FE unit tests must not assert rendered-chart DOM;
>   - E2E `*.spec.ts` — self-seeded via `tests/e2e/helpers/e2e-seed.ts`;
> - the AC ids + BR id(s) each test binds to,
> - FSM/transition-table changes if any (and a property test à la
>   `treatment.fsm.property.test.ts`),
> - the gate it must pass green: api-ts `bunx tsc` (root `bun run typecheck` covers **FE
>   only** — run api-ts tsc separately) + `bun run check:boundaries`, backend, contract,
>   FE tsc + unit, E2E.
> Order slices by value/risk; note dependencies between slices.
>
> ### Rigor rules
> - Every claim carries exactly one of `[ASSUMPTION]` (unverifiable) OR a `file:line`/
>   doc-id citation — no other confidence markers, no claims from memory. Reuse existing
>   rule-id prefixes (FR/BR/AC/CHART-*/V-VIS-*/EM-*/EF-*/ADR-00x); proposed rules use
>   `BR-####` only — never invent a new prefix.
> - **Verify negative claims** ("no test exists", "not wired") by grep/contract-spine —
>   subagents historically *under-count* coverage; double-check before asserting a gap.
> - Distinguish IMPLEMENTED / KNOWN-GAP / NEW-CANDIDATE explicitly; never relabel a
>   known gap as a new discovery.
> - Reuse before proposing: if a utility/handler/test pattern already exists, cite it
>   and build on it rather than proposing a parallel one.
> - Honor intentional non-goals (local-first, offline, no-AI). Flag, don't assume.
> - Keep the report skimmable: one row per finding in summary tables, detail in
>   appendices.
>
> ### Output structure
> 1. Executive summary (counts: implemented / known gaps / new candidates by severity).
> 2. Baseline inventory table (Step 1).
> 3. Per-family sequencing analysis + ordering-gap list (Step 2).
> 4. Gap & candidate register (Steps 3–4) — one row each, four-lens tags, KG/module/BR
>    mapping, severity, KNOWN vs NEW.
> 5. TDD-ready slice specs (Step 5), value-ordered with dependencies.
> 6. Open questions / `[ASSUMPTION]` list for the user to resolve before execution.

---

## Verification (how to judge the research output is good)

- **Coverage check:** every workflow family in the surface list appears in the baseline
  inventory; every entry has a coverage cell (test file or `UNTESTED`).
- **No-hallucinated-gaps check:** spot-check 5 "NEW" findings against
  `contract-spine.json` + grep to confirm they aren't already wired/tested.
- **Mapping completeness:** every gap/candidate row has KG node + module/WF + BR id
  (existing or proposed) + severity. Reject rows missing any.
- **TDD bindability:** pick 2 slices and confirm the named test files/paths and run
  commands match the conventions in `VERTICAL_TDD.md` and existing tests.
- **Known-vs-new integrity:** cross-check the register's `KNOWN` rows against
  `MASTER-GAP-MATRIX.md` ids; no known gap mislabeled `NEW`.

## Not in scope (of this plan)

Executing any slice. This plan delivers the prompt + the structure for its output only;
implementation is a separate, later decision after the user reviews the research report.
