# P3-D — Stop Fabricating Caries: Plan + Expert Review — 2026-06-27

Status: **GO-WITH-CHANGES**. BE+FE coupled vertical slice. The original plan is directionally
correct and safe for the timeline invariants, but all three review lenses converge on the same
under-scope: the plan fixes only the *snapshot-less* subset of the fabrication and leaves the more
common *snapshot-present treated-tooth* case still rendering a non-diagnosis odontogram `state` in
the **Condition** column. The revised plan in §5 closes the actual root cause (the FE axis-split),
keeps the BE `synthState` deletion as belt-and-suspenders, and adds the generated-validator regen
the original plan missed.

This run wrote ONLY this doc. No code edited, no commits.

---

## 1. Decision recap + neutral-disposition tokens

**Decision (user-DECIDED):** `getToothHistory` must stop inventing a clinical condition name
(`'filled'` / `'caries'`) for a treatment row that has no chart snapshot for that visit. A guessed
disease shown in the Condition/State axis is a charting hazard — a dentist could read a diagnosis
that was never charted. Replace the fabrication with a **neutral, non-diagnostic disposition**
derived only from treatment status, surfaced through UI that already exists.

**Tokens (locked to the shipped six-word vocab — NOT "Pending"):**

| treatment status | neutral disposition (existing badge) | Condition cell | State cell |
|---|---|---|---|
| `performed` / `verified` | **"Treated"** (`getToothHistoryStatusBadge:341-344`) | "—" unless real `conditionCode` | "—" unless `watchlist` |
| `diagnosed` / `planned` | **"Planned"** (`:345-347`) | "—" unless real `conditionCode` | "—" unless `watchlist` |
| `declined` | "Declined" (`:348-350`) | "—" | "—" |
| `dismissed` | filtered out at `getToothHistory.ts:82` (never emitted) | — | — |
| (no status, no snapshot) | no badge (`default: return null`, NOT a false "Pending") | "—" | "—" |

**Vocabulary correction (clinical lens C-vocab):** the original plan prose said "Pending" in two
places. The shipped badge vocab is **"Planned"** (`dental-chart.helpers.ts:255`, `:345-347`).
Do **not** introduce "Pending" — it is a vocabulary regression against the CAROUSEL_TIMELINE bible.

**Shape decision (endorsed by all three lenses):** `state?: ToothState` (make it optional) + delete
`synthState` + **no new field**. The neutral disposition rides the **existing** `treatmentStatus`
status badge. Do **NOT** widen `ToothState` (rejected — pollutes the clinical enum + odontogram +
thumbnail consumers) and do **NOT** add a `disposition` field (rejected — redundant with
`treatmentStatus`, creates a second source of truth that can drift from the FSM).

---

## 2. Implementation plan (BE+FE coupling, Vertical-TDD, verify gate)

**Verdict: BE+FE coupled vertical slice** — the wire shape (`state` optional) changes → regenerate
SDK + validators → FE must handle `state: undefined`. Touches TypeSpec → BE → contract → FE.

### The two fabrication sources (verified in code)

`tooth?.state ?? synthState(t.status)` at `getToothHistory.ts:96` means `synthState` fires **only
when `tooth` is undefined** (no snapshot). But the FE then maps **any** non-watchlist `entry.state`
into the Condition column at `tooth-overview-step.tsx:395-399`:

```ts
const conditionLabel = entry.conditionCode
  ? findingLabel(entry.conditionCode as ConditionCode)
  : !isStateAxis
    ? titleCase(entry.state)   // ← prints a bare odontogram state as a "Condition"
    : null;
```

- **Source 1 (snapshot-less):** `state='filled'` synth → Condition "Filled". Fixed by deleting `synthState`.
- **Source 2 (snapshot-present, the common case):** you just filled the tooth, `tooth.state='filled'`,
  no separate `conditionCode` → real `'filled'` flows in (synthState never fires) → Condition "Filled".
  **NOT fixed by the BE change.** This is the under-scope all three lenses caught.

The actual root cause is the FE axis-split printing `titleCase(entry.state)` as a Condition. Fixing
the FE closes **both** sources; the BE change is correctness belt-and-suspenders (a snapshot-less row
genuinely has no state).

### Files and line-precise edits

**TypeSpec** — `specs/api/src/modules/dental-visit.tsp:526` `state: ToothState` → `state?: ToothState`.
(Enum `ToothState` at `:64-74` is left unchanged — do NOT widen it.)

**BE handler** — `services/api-ts/src/handlers/dental-visit/chart/getToothHistory.ts`:
- Delete `synthState` (`:74-75`) and its comment (`:71-73`).
- `:96` `state: tooth?.state ?? synthState(t.status)` → `state: tooth?.state` (omit when no snapshot;
  `undefined` serializes out).
- Local entry type `:59` `state: string` → `state?: string`.
- Finding branch (`:124` `state: tooth.state`) is **untouched** — finding rows always carry a real state.

**Generated files (regen only — never hand-edit):**
- `services/api-ts/src/generated/openapi/validators.ts:19367` `state: ToothStateSchema` →
  `ToothStateSchema.optional()` inside `ToothHistoryEntrySchema` (`:19363`). **The original plan
  missed this file** (red-team C2). It does not 500 today only because the response is not
  validated (route at `routes.ts` runs `zValidator('param', …)` only, no response validation) — but
  the stale required schema must be regenerated for contract honesty and to keep the Schemathesis
  shadow profile (`response_schema_conformance`) quiet.
- `packages/sdk-ts/src/generated/types.gen.ts:61851` `state: ToothState` → `state?: ToothState`.

**FE** — `apps/dentalemon/src/features/workspace/components/tooth-overview-step.tsx:392-400`
(**the real fix**, red-team C1). Stop mapping `entry.state` into `conditionLabel`; harden against
`titleCase(undefined)` throwing (timeline lens — `titleCase:37` does `value.charAt(0)`):

```ts
const isStateAxis = !!entry.state && STATE_AXIS_VALUES.has(entry.state);
const conditionLabel = entry.conditionCode
  ? findingLabel(entry.conditionCode as ConditionCode)
  : null;                              // never titleCase(state) into Condition
const stateLabel = isStateAxis ? titleCase(entry.state!) : null;
```

Result: Condition = curated finding vocab or "—"; State = "Watchlist" or "—". A treated tooth's
restored-state ("Filled"/"Crown") surfaces via the colored odontogram + the **"Treated"** status
badge (Row 1, `:435-439`), never as a fabricated Condition.

### Vertical-TDD sequence

1. **TypeSpec** — `dental-visit.tsp:526` → `state?: ToothState`.
2. **Codegen** — `cd specs/api && bun run build`; `cd ../../services/api-ts && bun run generate`;
   then SDK regen. This must regenerate **both** `validators.ts:19367` (`.optional()`) AND
   `types.gen.ts:61851`. Do NOT hand-edit any generated file.
3. **BE test (RED)** — extend `dental-visit.test.ts:1035-1057` (tooth 36 crown performed, no
   snapshot) to assert `body.data[0].state` is `undefined` (was synth `'filled'`). **Add a second
   case**: a `diagnosed`/`planned` snapshot-less row also yields `state === undefined` (covers the
   other synth branch — both `'filled'` and `'caries'` must now omit). **Add a third assertion**: a
   finding row still carries a real `state` (lock that optionality only ever bites treatment rows).
   RED because `synthState` still fires.
4. **BE impl (GREEN)** — apply the `getToothHistory.ts` edits above.
5. **Contract (RED→GREEN)** — Hurl tooth-history scenario (`dental-visit.hurl:470`+) asserts only
   `$.data isCollection` / `$.pagination isCollection` (auth/shape only — no `state` assertion), and
   the snapshot fixtures all chart real states, so contract stays GREEN. **Add a contract assertion
   (now MANDATORY, clinical C2)**: assert a snapshot-less treatment row omits `state`
   (`jsonpath "$.data[?(@.eventKind=='treatment')].state"` absent/null). If the fixtures cannot
   produce a snapshot-less row, **document that explicitly** and rely on the BE+FE unit proof — do
   not hand-wave "optional." Run `bun run test:contract` against `$API_URL` regardless.
6. **FE test (RED — additive, not a regression of an existing test)** — timeline lens: no FE fixture
   sends `state: undefined` today, so nothing is RED today; this is a **new** scenario. Add **two**
   cases to `tooth-slideout.test.ts` (or a focused `tooth-overview-step` test):
   - **(a) snapshot-less:** `{ eventKind:'treatment', treatmentStatus:'performed', state: undefined,
     conditionCode: undefined, treatmentDescription:'Crown' }` → assert the FULL row stays
     **informative** (clinical C1/C3): date present **AND "Treated" badge present AND description
     "Crown" present AND Condition "—" AND State "—"**, and that rendering does not throw on
     `state: undefined`. Asserting only `Condition === '—'` is insufficient — assert presence of the
     disposition, not just absence of the fabrication.
   - **(b) snapshot-PRESENT (the case the original plan forgot — red-team C4):**
     `{ eventKind:'treatment', treatmentStatus:'performed', state:'filled', conditionCode: undefined }`
     → assert **Condition: "—"**. This RED-fails today AND would still fail under the plan-as-written,
     proving the FE fix is the load-bearing one.
7. **FE impl (GREEN)** — apply the `tooth-overview-step.tsx:392-400` edits above.
8. **E2E** — verify `tests/e2e/journeys/36-tooth-panel-edit.journey.spec.ts`: no breakdown card shows
   "Caries"/"Filled" in the Condition field for a treatment row. Assertion-by-absence is acceptable
   since BE+FE units carry the proof.
9. **Verify gate** (below) — including the guard re-run.

### Verify gate

- **BE:** `cd services/api-ts && bun run typecheck && bun run lint && DATABASE_URL=…/monobase_test bun run test && bun run check:boundaries`
  (per MEMORY: never `bun test <path>`; always `bun run test` on `monobase_test`; boundaries is part
  of the gate).
- **FE:** `cd apps/dentalemon && bun run test && bun run typecheck && bun run lint` + Playwright E2E journey 36.
- **GUARD (MANDATORY):** `bun services/api-ts/scripts/check-timeline-coherence.ts` → **must stay 0
  violations.**

---

## 3. Blast radius + invariant analysis

**Consumers of `getToothHistory.entry.state` — exactly one render site.** (Precision per clinical C4:
this is "exactly one consumer of `getToothHistory.entry.state`"; other `.state` reads in the
workspace are **snapshot-sourced**, not ledger-sourced.)

| Consumer | Reads | Impact |
|---|---|---|
| **A. FE axis-split** `tooth-overview-step.tsx:392-400` | `entry.state` (ledger) | **THE site.** Two fabrication sources here; FE fix closes both. |
| **B. badges** `dental-chart.helpers.ts:336-373` | `treatmentStatus` / `eventKind` only | **Zero change.** Already produce "Treated"/"Planned"/"Flagged". |
| **C. `getLayerLabel`** `:259-261` | `ChartLayer` | Not a getToothHistory consumer. No change. |
| **D. `deriveLayerSetsAsOf`** `chart-export.ts:138-186` | treatments + visit dates | Does NOT read getToothHistory. Callers: `inspect-tooth-timeline.ts`, `check-timeline-coherence.ts`. Independent. |
| **D′. odontogram fill colors** `tooth-overview-step.tsx:160-167` | chart snapshot props (`surfaceConditions`) | NOT `entry.state`. Independent. |
| **D″. carousel** `timeline-carousel.tsx` | (grep: no `entry.state` ref) | Independent. |
| **E. `use-tooth-history.ts:27`** | passthrough (`query.data?.data ?? []`) | No `state` access. No change. |
| **F. `chart-conflict-banner.tsx:63`** (`#{t.toothNumber} {t.state}`) | **conflict-payload `teeth[]` (snapshot)**, NOT the ledger | Genuinely unaffected. Listed for precision so a future reader doesn't make it optional. |

**Invariant independence — VERIFIED SAFE (all three lenses):**

- **Coherence guard** (`check-timeline-coherence.ts`): docstring + code read RAW `chartRepo.findByVisit`
  snapshots + `treatmentRepo` + `deriveLayerSetsAsOf` — **never** `getToothHistory`, explicitly
  *because* getToothHistory synthesizes states (`CAROUSEL_TIMELINE.md:144-147`). Removing `synthState`
  cannot move the guard. **Expected: still 0 violations.**
- **`deriveLayerSetsAsOf`:** reads `AsOfTreatment[]` + `visitDateById`. Zero `getToothHistory` /
  `entry.state` reference. Independent.
- **Emit rule** (`getToothHistory.ts:90-129`): P3-D touches **only the `state` VALUE** inside an
  already-emitted treatment row (`:96`). It does NOT change the dismissed filter (`:82`), `eventKind`,
  the finding branch (`:119-129`), or which rows emit. **Preserved.**
- **FSM, chart-close gate:** not edited.
- **Odontogram fill:** chart-snapshot sourced. Independent.

**No test/contract asserts a synth value (no contract renegotiation):**
- BE `:1033-1057` asserts only `eventKind`/`treatmentCdtCode`. The only `data[0].state==='caries'`
  assertion (`:893`) is a **real charted snapshot** (tooth 11 charted `caries`), not a synth path.
- Hurl `:470`+ asserts only `isCollection`. The other Hurl rows chart real states.

---

## 4. Expert verdicts (three lenses, verbatim)

### Lens 1 — clinical-safety — VERDICT: GO-WITH-CHANGES

> The core decision is **clinically correct and the blast-radius analysis is accurate**. Omitting
> `state` for snapshot-less treatment rows (rather than inventing `'filled'`/`'caries'`) genuinely
> eliminates the fabricated-diagnosis hazard without suppressing any real charted finding. … But
> there are **three clinical-honesty gaps** the plan under-weights, plus one consumer the plan
> misclassifies as harmless.
>
> What I verified as SAFE: `synthState` fires ONLY when `tooth` is undefined — real charted
> `tooth.state` always wins, so removing synth cannot suppress a real charted state. The real
> clinical-suppression risk is `conditionCode`, and it survives (`:97`). Blast radius = exactly one
> render site. Guard untouched. No test/contract asserts the synth value.
>
> **REQUIRED CHANGES:**
> - **C1 [BLOCKING, clinical]** — the status badge ("Treated") must actually render for snapshot-less
>   rows (confirmed present at `dental-chart.helpers.ts:364-373`). Make step 6's FE test assert the
>   "Treated" badge is present — lock it as mandatory, not optional. If a future refactor drops the
>   badge, the row collapses to a bare "—/—" with a price and no disposition: an information-loss
>   regression.
> - **C2 [BLOCKING, contract]** — Lock the wire-shape with a contract assertion; do NOT leave it
>   "optional." A BE unit test is necessary but insufficient (per MEMORY `feedback_test_verification.md`:
>   handler unit tests with buildTestApp don't catch serialization bugs; must hit the real server).
>   If fixtures can't produce a snapshot-less row, document why — don't hand-wave "optional."
> - **C3 [clinical]** — "—" for a performed-treatment State is honest but visually identical to a
>   never-examined row. The no-new-field variant is acceptable ONLY because Row 1 (badge + description
>   + price) disambiguates. The FE test must assert the FULL row shape stays informative, not just
>   that the synth is gone.
> - **C4 [missed consumer, low risk]** — `chart-conflict-banner.tsx:63` renders `t.state` from the
>   conflict payload (snapshot), not the ledger — genuinely unaffected. Correct the plan's blanket
>   "exactly one render site" to "exactly one consumer of `getToothHistory.entry.state`."
>
> **Token honesty:** "Treated"/"Planned"/"—" are all honest. **The plan's prose says "Pending" in two
> places — that's stale; the shipped vocab is "Planned" (`getToothHistoryStatusBadge:345`). Don't
> introduce "Pending" — it's a vocabulary regression.**
>
> Reject the new-field variant (correct to NOT widen `ToothState`; `disposition` is redundant with
> `treatmentStatus` and would create a second source of truth that drifts from the FSM).
>
> **Bottom line:** GO-WITH-CHANGES. Make C1–C3 mandatory, fix "Pending"→"Planned", tighten the "one
> render site" wording. STOP only if review demands a fabricated-but-neutral value inside `state`.

### Lens 2 — timeline-invariant — VERDICT: GO-WITH-CHANGES

> The plan's core thesis is **correct and the timeline/ledger blast-radius claims hold under direct
> verification**. `synthState` does not feed `deriveLayerSetsAsOf`, the odontogram, the emit rule, or
> the coherence guard in any path. I1/I2/I3 will hold. BUT the plan **under-counts the FE test
> fallout** and leaves a **gap in the test it proposes to extend**.
>
> Invariant independence VERIFIED SAFE: the coherence guard reads RAW snapshots
> (`chartRepo.findByVisit` `:77`) + treatments (`:81`) → `deriveLayerSetsAsOf` (`:107`); it never
> imports `getToothHistory`. **Expected: still 0 violations.** `deriveLayerSetsAsOf` reads
> `AsOfTreatment[]` + `visitDateById`, zero `entry.state` reference; only callers are
> `inspect-tooth-timeline.ts` + `check-timeline-coherence.ts`. Emit rule preserved. Odontogram
> snapshot-sourced. BE+FE coupling correctly identified.
>
> **REQUIRED CHANGE 1** — Reframe the FE "RED" claim. No FE fixture sends `state: undefined` today, so
> **nothing is RED today**; the FE test is **purely additive** (new scenario). State this honestly so
> the implementer doesn't hunt for a non-existent failing assertion. More importantly:
> `titleCase(entry.state)` at `:398`/`:400` will **throw a runtime TypeError** on `undefined`
> (`titleCase:37` does `value.charAt(0)`). Make the narrowing (`!!entry.state`) a hard precondition and
> add a unit assertion that a `state: undefined` row does not throw.
>
> **REQUIRED CHANGE 2** — The BE test (`:1035-1057`) currently asserts only `length`/`eventKind`/
> `treatmentCdtCode`, never `state` — so it passes whether state is `'filled'` or absent. The new
> `state === undefined` assertion is the ONLY thing pinning the fix. The BE test MUST assert
> `state === undefined` for **BOTH** a `performed` AND a `diagnosed`/`planned` snapshot-less row (both
> synth branches: `'filled'` vs `'caries'`), plus assert a finding row still carries a real state.
>
> Confirmed nothing asserts the synth value (Hurl `:474-479` asserts only `isCollection`; every
> `'filled'`/`'caries'` in the BE tests is request input or a real charted state). Shape decision
> endorsed; widening `ToothState` correctly rejected. Add `check:boundaries` + the guard re-run to the
> gate (plan lists both — good). No STOP condition triggered.

### Lens 3 — red-team — VERDICT: GO-WITH-CHANGES

> The plan's mechanics are sound and its blast-radius analysis is mostly accurate — but it
> **under-scopes the fix**: it eliminates only the *empty-snapshot* subset of the fabrication while
> leaving the **larger, more common subset** (treatment row on a tooth that HAS a snapshot) rendering
> the odontogram `state` as a "Condition." A test written exactly as the plan specifies will pass while
> the real UI continues to lie. That is the textbook "test passes but UI lies" failure.
>
> **CRITICAL — the fix is incomplete (root cause is the FE axis-split, not `synthState`).** The root
> cause lives at `tooth-overview-step.tsx:395-398`: it maps **any** non-watchlist odontogram `state`
> into the Condition column whenever `conditionCode` is absent. Snapshot-WITH treatment,
> `tooth.state='filled'`, no `conditionCode` (you just filled the tooth — the single most common real
> case) → real `'filled'` (synthState never fires) → FE renders **Condition: "Filled"**. The plan
> does NOT fix this. **Required:** the FE Condition fallback must NOT print a bare odontogram `state`;
> Condition = `findingLabel(conditionCode)` or "—", never `titleCase(state)`. This kills BOTH subsets;
> the BE change becomes belt-and-suspenders.
>
> **CRITICAL — the plan missed the BE Zod validator (generated, needs regen).**
> `services/api-ts/src/generated/openapi/validators.ts:19367` → `state: ToothStateSchema` (required).
> The codegen step must regenerate this to `.optional()`. Why it doesn't 500 today: the route runs
> `zValidator('param', …)` only — **no response validation** — so omitting `state` won't throw. The
> plan got the outcome right for an unstated reason.
>
> **MEDIUM — Schemathesis shadow trip-wire.** The blocking fuzz profile is 5xx + status-code only, but
> the **shadow** profile runs `response_schema_conformance` (`continue-on-error: true`). Skipping the
> TypeSpec `state?:` change would make the shadow noisy. The plan includes the TypeSpec change — just
> don't let an executor "simplify" by editing only the handler.
>
> Edge cases hold: `declined`/`dismissed` safe (dismissed filtered `:82`); offline sync conflict rides
> independently; finding rows always carry a real state (`:124`); guard stays 0; no test asserts a
> synth value.
>
> **Required changes:** (1) FE — stop mapping `entry.state` into `conditionLabel`. (2) BE — keep the
> `synthState` deletion + `state?: string` local type. (3) Codegen — explicitly regen `validators.ts`
> + `types.gen.ts`. (4) FE test — add the snapshot-PRESENT case `state:'filled'` → assert Condition
> "—" (RED today AND under the plan-as-written), plus the snapshot-less `state: undefined` case.
> (5) Do NOT widen `ToothState`. (6) Re-run the guard (must stay 0).
>
> **Bottom line:** GO-WITH-CHANGES. Directionally right and safe for the invariants, but as written it
> ships a UI that still fabricates conditions for the most common case. Fix the FE axis-split — the
> actual root cause — not just `synthState`.

---

## 5. CONSOLIDATED VERDICT: GO-WITH-CHANGES + revised plan

**Verdict: GO-WITH-CHANGES.** All three lenses independently GO-WITH-CHANGES; all three converge on
the same load-bearing correction (the FE axis-split is the root cause, not just `synthState`), plus
two test-rigor corrections and one missed generated file. No lens reached NO-GO; no STOP condition is
currently triggered. The invariants (I1/I2/I3), the coherence guard, `deriveLayerSetsAsOf`, the emit
rule, the FSM, and the chart-close gate are all provably untouched.

**Required changes folded into the plan (R1–R7):**

- **R1 (red-team CRITICAL, the load-bearing fix):** Fix the **FE axis-split** so it never prints
  `titleCase(entry.state)` as a Condition. `conditionLabel = findingLabel(conditionCode)` or "—".
  This closes both the snapshot-less AND the snapshot-present fabrication. The BE `synthState`
  deletion stays as belt-and-suspenders.
- **R2 (red-team CRITICAL):** Codegen must explicitly regenerate `validators.ts:19367`
  (`ToothStateSchema.optional()`) **and** `types.gen.ts:61851`. Never hand-edit; run the generators.
- **R3 (clinical C2):** The contract assertion is **MANDATORY**, not optional — assert a snapshot-less
  treatment row omits `state` at the wire (real-server proof per MEMORY). If fixtures can't produce
  the row, document why and rely on BE+FE units.
- **R4 (clinical C1/C3 + timeline CR1):** The FE test asserts the FULL row stays **informative** —
  date + **"Treated" badge** + description present AND both axes "—" — and that a `state: undefined`
  row does **not throw** (`titleCase(undefined)` hazard). Plus the snapshot-present `state:'filled'` →
  Condition "—" case (red-team).
- **R5 (timeline CR2):** The BE test asserts `state === undefined` for **both** a `performed` and a
  `diagnosed`/`planned` snapshot-less row, plus a finding row still carries a real `state`.
- **R6 (clinical vocab):** Use **"Planned"**, never "Pending". The shipped badge already returns
  "Planned" (`dental-chart.helpers.ts:345-347`) and `null` (not a false "Pending") for no-status.
- **R7 (clinical C4 precision):** Blast radius is "exactly one consumer of `getToothHistory.entry.state`"
  (the FE axis-split). `chart-conflict-banner.tsx:63` reads a snapshot `t.state` — unaffected, not
  made optional.

**Revised Vertical-TDD step list (execute in order):**

1. **TypeSpec** — `dental-visit.tsp:526` `state: ToothState` → `state?: ToothState` (do NOT widen the enum).
2. **Codegen** — `specs/api && bun run build` → `services/api-ts && bun run generate` → SDK regen.
   Confirm `validators.ts:19367` is now `.optional()` and `types.gen.ts:61851` is `state?:`. **[R2]**
3. **BE test (RED)** — extend `dental-visit.test.ts:1035-1057`: assert `state === undefined` for a
   `performed` snapshot-less row, a `diagnosed`/`planned` snapshot-less row, and a finding row still
   carrying a real `state`. **[R5]**
4. **BE impl (GREEN)** — `getToothHistory.ts`: delete `synthState` (`:74-75`), `:96` → `state: tooth?.state`,
   local type `:59` → `state?: string`. Finding branch untouched.
5. **Contract (RED→GREEN, MANDATORY assertion)** — add the snapshot-less-omits-`state` Hurl assertion;
   run `bun run test:contract` against `$API_URL`. **[R3]**
6. **FE test (RED — additive)** — two cases in `tooth-slideout.test.ts`: (a) snapshot-less
   `state: undefined` → full informative row (date + "Treated" badge + "Crown" + Condition "—" + State
   "—", no throw); (b) snapshot-present `state:'filled', conditionCode: undefined` → Condition "—".
   **[R1, R4]**
7. **FE impl (GREEN)** — `tooth-overview-step.tsx:392-400`: narrow `isStateAxis` with `!!entry.state`;
   `conditionLabel = findingLabel(conditionCode)` or `null` (never `titleCase(state)`). **[R1, R6]**
8. **E2E** — journey 36: no Condition cell reads "Caries"/"Filled" for a treatment row.
9. **Verify gate** — BE: `typecheck && lint && DATABASE_URL=…/monobase_test bun run test && check:boundaries`;
   FE: `bun run test && typecheck && lint` + Playwright journey 36; **re-run
   `check-timeline-coherence.ts` → must stay 0.**

---

## 6. Open risks / what would force a STOP mid-execution

- **STOP if review demands a fabricated-but-neutral value living *inside* `state`** — that requires
  widening `ToothState` (rejected: pollutes the clinical enum + odontogram + thumbnail consumers).
  Escalate; do not widen. (All three lenses agree.)
- **STOP if `check-timeline-coherence.ts` reports any violation after the change** — it must stay 0,
  since it never reads `getToothHistory` (`CAROUSEL_TIMELINE.md:144-147`). A violation would mean a
  hidden coupling exists contrary to the bible; investigate before proceeding.
- **STOP if `state` cannot be made optional** without breaking a consumer that dereferences
  `entry.state` non-optionally beyond the one FE site. Codegraph + grep show only `tooth-overview-step.tsx`;
  finding rows always carry a real state, so optionality only bites snapshot-less treatment rows.
  No STOP expected.
- **STOP if a contract/Hurl scenario or BE test asserts a specific synth `state` value** for a
  snapshot-less row — none found (`:1035-1057` asserts `eventKind`/`cdtCode`; Hurl `:470` is
  shape/auth-only; `:893` is a real charted snapshot). Proceed.
- **Watch (not a STOP): generated-file drift.** If `validators.ts` is NOT regenerated and a future PR
  adds response validation, omitting `state` against a required schema would 500. R2 closes this; the
  Schemathesis shadow profile will surface it if missed.
- **Watch (not a STOP): test-as-written-but-UI-lies.** If the FE test asserts only `Condition === '—'`
  without asserting the badge/description are still present, a future refactor could silently collapse
  the row. R4 (assert presence of the disposition, not just absence of the fabrication) closes this.

---

### Evidence index (file:line — verified this run)

- Fabrication source 1 (snapshot-less): `getToothHistory.ts:74-75` (`synthState`), `:96` (emit).
- Fabrication source 2 (snapshot-present, common case): `tooth-overview-step.tsx:395-399`
  (`titleCase(entry.state)` into Condition); `titleCase` def `:37` (`value.charAt(0)` → throws on undefined).
- Closed enum (do NOT widen): `dental-visit.tsp:64-74`, `:526`; `validators.ts:565` (`ToothStateSchema`),
  `:19367` (`ToothHistoryEntrySchema.state` required — **missed generated file**); `types.gen.ts:61851`.
- Badges read status not state (no change): `dental-chart.helpers.ts:336-355` (`getToothHistoryStatusBadge`
  → "Treated"/"Planned"/"Declined"/"Dismissed"/null-not-"Pending"), `:364-373` (`getToothHistoryEventBadge`).
- Independent of synthState: `chart-export.ts:138-186` (`deriveLayerSetsAsOf`); odontogram fill via
  `tooth-overview-step.tsx:160-167`; guard non-dependence at `CAROUSEL_TIMELINE.md:144-147`.
- Snapshot-sourced `.state` (not ledger): `chart-conflict-banner.tsx:63`.
- BE test to extend: `dental-visit.test.ts:1035-1057` (asserts only `eventKind`/`treatmentCdtCode`).
  Contract: `dental-visit.hurl:470`+ (shape/auth-only). E2E: `tests/e2e/journeys/36-tooth-panel-edit.journey.spec.ts`.
