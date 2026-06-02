# P2-4 — Voice / Hands-Free Perio Charting (Design Plan)

> Plan 09. Backlog ID **P2-4** (`docs/reviews/IMPROVEMENT_BACKLOG.md` L70). Effort **L**.
> Source findings: `docs/reviews/modules/perio-review.md` §4–5, `docs/reviews/research/perio.md` §"How leading PMS handle perio charting UX" (Dentrix Voice Perio, Open Dental voice/auto-advance).
> **Hard dependency: P0-1 (Perio frontend, plan 01) must ship first.** This plan adds a voice input layer *on top of* the perio chart UI; it does not build the chart.
> No code in this document. Design only.

---

## 1. Problem & current state

A full-mouth adult periodontal exam is **~500 discrete inputs**: 32 teeth × (6 probing depths + 6 per-site BOP + recession/gingival-margin + mobility + furcation + plaque + suppuration). The backend already persists every one of these per site (`dental_perio_tooth_reading`, `services/api-ts/src/handlers/dental-perio/repos/perio-reading.schema.ts`: `depthBM…depthLD`, `bopBM…bopLD`, `gmBM…gmLD`, `recession`, `mobility`, `furcation`, `plaque`, `suppuration`).

**Current state of entry:**
- There is **no perio UI at all** today (perio-review §4). Plan 01 (P0-1) builds the first one: a 6-point grid with keyboard auto-advance, opened from the visit/workspace, writing per tooth via `PUT /dental/perio-charts/{chartId}/readings/{toothNumber}` and finalizing via `POST …/complete`.
- Even with plan 01's keyboard auto-advance, a solo clinician probing chairside cannot reach a keyboard between sites — both hands are occupied (probe + mirror/air). Manual entry forces either a **second person to scribe** or constant glove-contamination breaks to type.
- Industry treats **voice / hands-free auto-advance entry as table-stakes** for the solo workflow precisely for this reason. Dentrix Voice Perio is a hands-free "computer assistant" that enters spoken depths/bleeding/suppuration/recession/mobility/furcation and smart-places each value; Open Dental ships voice charting plus configurable auto-advance sequencing (maxillary-first / facial-first). dentalemon has **none** of this (perio-review §3 "Voice / hands-free entry ❌", §5 P1/P2 finding; `MODULE_SPEC.md` lists voice as out of scope).

**Net:** the data model is complete and the (plan-01) UI will be functional, but the *entry mechanism* remains a two-hands-on-keyboard bottleneck. P2-4 closes that.

---

## 2. Target

Hands-free spoken entry of a periodontal exam by a single clinician, with:

1. **Spoken values** for: probing depths (numbers 0–20), bleeding ("bleeding"/"BOP"), suppuration ("pus"/"suppuration"), recession / gingival margin (signed numbers, "recession three", "minus two"), mobility ("mobility two"), furcation ("furcation grade two"), plus navigation words ("next tooth", "skip", "back", "missing").
2. **Smart auto-placement** — each spoken value lands in the correct site/field based on a deterministic sequencer (which tooth, which of the 6 sites, which field), exactly like Dentrix smart-script, so the clinician never says "depth buccal-mesial."
3. **Auto-advance sequencing** matching the keyboard sequencer from plan 01 — maxillary-first, facial(buccal)-first, configurable order — so depths are spoken in a continuous "walking stroke" rhythm and the cursor moves itself.
4. **Mic state feedback** — an always-visible, color-coded indicator (idle / listening / heard-and-applied / paused / error), modeled on Dentrix's blue-ready / orange-pause / red-recording convention, plus a live transcript of the last utterance and what field it wrote.
5. **Accuracy + confirmation UX** — low-confidence or out-of-range values are flagged, not silently written; the clinician can correct by voice ("back", "correct, four") or touch.
6. **Accessibility** — voice is an *additive* input path; the keyboard/touch grid from plan 01 remains fully usable, and the voice layer is itself operable/announced for assistive tech.

**Non-goals:** no medical dictation/NLP of free-text notes; no speaker ID; no offline on-device model in v1 (see §10). Voice writes only the structured perio fields the backend already accepts.

---

## 3. Proposed design

### 3.1 Speech-recognition approach

Three options evaluated; recommendation is a **two-tier strategy**.

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **A. Web Speech API** (`SpeechRecognition`, browser-native) | Zero infra, zero per-use cost, no audio leaves device in some impls, trivial to integrate, real-time interim results | Chrome/Edge route audio to Google servers (PHI concern, §10); Safari/iPad support is partial and historically unreliable; no custom vocabulary/grammar; accuracy on isolated digits in a noisy operatory is mediocry | **v1 default** behind a feature flag — fastest path, good enough for a constrained digit/keyword grammar |
| **B. Cloud STT** (e.g. a streaming speech service with a phrase/boost list) | Best accuracy, custom vocabulary boosting ("buccal", "furcation", digit boosting), word-level confidence, consistent cross-browser | Per-minute cost; **audio + therefore PHI-adjacent acoustic data leaves the device** → needs BAA/DPA + consent + region pinning; added latency; streaming infra | **v2 / opt-in** for clinics that sign the data agreement and want higher accuracy |
| **C. On-device small model** (e.g. a WASM/WebGPU speech model bundled in-app) | No audio leaves device (strongest PHI posture), works offline (aligns with the Tauri offline-first story), no per-use cost | Large download, heavy CPU/GPU on an iPad, integration + tuning effort, lower accuracy than cloud | **Future** — revisit when the Tauri/offline path matures; out of scope here |

**Key design decision:** the speech engine is hidden behind a **`SpeechProvider` interface** (`startListening`, `stopListening`, `onResult(transcript, confidence, isFinal)`, `onStateChange`). The grammar/parser/sequencer (§3.2–3.3) consume *normalized transcript tokens*, not raw engine output, so swapping Web Speech → cloud STT → on-device later is a provider change with **zero change to the testable core**. This is the crux that makes the bulk of the feature unit-testable (§4).

A small **command grammar / phrase hint list** (digits zero–twenty, "bleeding", "pus", "recession", "mobility", "furcation", "grade", "next", "back", "skip", "missing", "tooth", "stop") is passed to providers that support biasing (Web Speech `SpeechGrammarList` where available; cloud phrase boost) to lift digit/keyword accuracy.

### 3.2 Perio-specific grammar / parser (pure, unit-testable)

A **pure function** `parseUtterance(transcript, ctx) → ParsedCommand[]` turning a normalized transcript string into zero or more structured commands. No DOM, no network, no engine — just string → command. This is the heart of the test plan.

Recognized command classes:

- **Depth values** — bare integers, including the clinician's natural triple cadence "three two three" → three sequential depth values (matches Open Dental's triple entry `323`). Words and digits both accepted ("three", "3"). Range-checked 0–20 (`assertValidDepths`, `perio-validation.ts`).
- **Signed recession / gingival margin** — "recession three", "minus two", "gum margin minus one" → signed value, bounds −5..20 (mirrors `assertValidGingivalMargins` / recession bounds in `perio-validation.ts`).
- **Per-site flags** — "bleeding" / "BOP" → BOP true on the *current* site; "pus" / "suppuration" → suppuration; "plaque" → plaque. These attach to the site the sequencer is currently on.
- **Per-tooth grades** — "mobility two", "furcation grade three" → mobility/furcation 0–3 (`assertValidGrades`). Furcation is gated to multi-rooted teeth (warn + ignore on single-rooted, per perio-review §3 furcation note).
- **Navigation** — "next tooth", "back" (one site/field back), "skip" (leave site null, advance), "missing" (mark tooth missing, jump to next), "redo"/"correct" (re-enter the just-spoken value), "stop"/"pause" (mic), "go to tooth twenty-six" (jump).
- **Homophone / mishear normalization** — a normalization table maps common digit mishears ("to/too/two"→2, "for/four"→4, "tree"→3, "ate"→8, "won"→1) and unit noise ("millimeters", "mil") before parsing. Documented and table-driven so it's testable and extensible.

`ParsedCommand` carries `confidence` and an `ambiguous` flag; ambiguous/low-confidence commands route to confirmation UX (§3.4) instead of being applied.

### 3.3 Auto-advance state machine (pure, unit-testable)

A **finite-state sequencer** independent of both the engine and React. It owns: current tooth, current site index (0–5 over `PERIO_SITES = ['BM','BC','BD','LM','LC','LD']` from `services/api-ts/src/handlers/dental-perio/utils/perio-cal.ts`), current field-phase (depth vs margin pass), and the tooth-traversal order.

- **State:** `{ toothOrder: number[], toothIdx, siteIdx, phase: 'depth'|'margin', dentition }`.
- **Reducer:** `advance(state, command) → { nextState, write: {toothNumber, field, value} | null, event }`. Pure function: given a state and a parsed command, returns the field to write and the next cursor position. This is **the** unit-test target — every sequencing rule (maxillary-first, buccal pass then lingual pass, wrap to next tooth, skip missing teeth, "back" decrements correctly across tooth boundaries, jump-to-tooth) is a table-driven test.
- **Sequencing rules** (configurable, defaults mirror clinical convention + Open Dental):
  - **Arch order:** maxillary first (FDI quadrants 1→2, i.e. 18→11 then 21→28), then mandibular (48→41, 31→38). Configurable to mandibular-first.
  - **Surface order:** facial/buccal pass for the whole arch first, then lingual pass (the "walking stroke" continuous-circuit convention) — configurable to per-tooth buccal-then-lingual.
  - **Site order within a surface:** mesial → mid → distal.
  - **Dentition aware:** uses `isPrimaryToothNumber` / FDI quadrant logic already in `perio-validation.ts`; primary dentition uses 51–85 ordering and the ≥8-reading completion floor (BR-P07).
  - **Missing-tooth aware:** teeth marked missing (voice "missing" or pre-known from the odontogram) are skipped.
- **Decoupled from writes:** the reducer emits a write intent; a thin React effect debounces and flushes it through the existing `PUT …/readings/{toothNumber}` SDK hook (the same mutation plan 01 uses). Voice and keyboard share one write path — voice is just another command source feeding the same sequencer.

### 3.4 How it writes into the perio chart UI (plan 01)

- Voice mode is a **toggle on the plan-01 perio grid** (mic button in the chart toolbar). Enabling it starts the `SpeechProvider` and binds the sequencer's cursor to the grid's existing "active cell" highlight.
- Each applied command (a) writes to local chart state, (b) moves the visible cursor (same highlight plan 01 already renders for keyboard), (c) batches the per-tooth upsert. Because one tooth = one row = one `PUT`, writes are coalesced per tooth on "next tooth" / debounce, not per site — keeping request volume at ~32 calls, matching keyboard entry.
- CAL stays **read-only / derived** — voice never speaks or writes CAL; it's computed on read by `computeReadingCal` (`perio-cal.ts`). Voice captures depth + gingival margin; CAL follows automatically.
- Completion is unchanged: voice "complete chart" (with explicit confirm) calls `POST …/complete`, which still enforces the ≥16/≥8 reading floor (BR-P07) and freezes summary stats.

### 3.5 Accuracy / confirmation UX

- **Mic state indicator** (always visible): idle (grey) → listening (blue, animated) → applied (brief green flash on the written cell + spoken value echoed in a transcript strip) → paused (orange) → error/no-match (red + the misheard text shown). Mirrors Dentrix's color convention so trained users feel at home.
- **Live transcript strip** shows the last utterance and the field+value it wrote ("18 BM → depth 3"), so the clinician verifies without looking away for long.
- **Confirmation gating:** values below a confidence threshold, out of range, or ambiguous are **not auto-written** — the cell shows a pending/"did you say 3?" state; clinician says "yes"/"correct, four" or taps. High-confidence in-range values write immediately (the common case) for flow.
- **Correction:** "back" steps the cursor back and clears; re-speaking overwrites. A visible "last 3 entries" mini-log supports quick eyeball verification.
- **Audio feedback option:** optional short tones (distinct for applied vs needs-confirmation vs error) so the clinician keeps eyes on the patient.

### 3.6 Accessibility

- Voice is **strictly additive** — the plan-01 keyboard/touch grid remains 100% functional with voice off (WCAG: no input modality is the sole path).
- Mic state and each applied write are exposed via an `aria-live="polite"` region (the transcript strip) so screen-reader users get the same confirmation; the mic toggle is a labeled, keyboard-operable button.
- All voice commands have keyboard equivalents (already true via plan 01); voice is a convenience layer, not a gate.
- Respects reduced-motion for the listening animation; color state is paired with an icon/label (not color-only) for color-blind users.
- Clear, persistent indication when the mic is live (privacy + WCAG status-message expectations).

---

## 4. Vertical-TDD test plan

The architecture deliberately isolates **two pure cores** that hold ~all the logic and are fully unit-testable without a browser, mic, or network — matching the project's Vertical-TDD mandate (`docs/development/VERTICAL_TDD.md`). Tests are written RED first.

**Tier 1 — pure unit tests (the bulk; deterministic, fast):**
- `parseUtterance` grammar tests: digit words & numerals, the "three two three" triple cadence → 3 depths, signed recession ("minus two", "recession three"), keyword flags (bleeding/pus/plaque on current site), grades (mobility/furcation 0–3, furcation rejected on single-rooted teeth), navigation words, homophone normalization table (to/too/two, for/four, tree/3, ate/8), range rejection (depth >20, grade >3, margin out of −5..20), ambiguity/low-confidence flagging.
- Sequencer reducer tests (table-driven): maxillary-first vs mandibular-first ordering, buccal-pass-then-lingual vs per-tooth, mesial→mid→distal within surface, wrap to next tooth, "back" across tooth boundaries, "skip" leaves null & advances, "missing" skips tooth, jump-to-tooth, primary-dentition (51–85) ordering, write-intent emitted with correct `{toothNumber, field, value}`.
- Value-bounds parity tests: assert the parser's accepted ranges exactly match the backend validators (`assertValidDepths` 0–20, `assertValidGrades` 0–3, recession/GM −5..20) so voice can never produce a body the API will 422.

**Tier 2 — provider adapter tests:** a **fake `SpeechProvider`** that emits scripted transcript+confidence events; assert it drives parser→sequencer→write-intent end to end (no real engine). Covers interim-vs-final result handling, mic state transitions, confidence gating.

**Tier 3 — component tests:** voice toggle renders, mic state indicator reflects provider state, transcript strip `aria-live` announces writes, cursor highlight moves on applied command, confirmation pending-state renders for low-confidence values. Mock the SDK mutation.

**Tier 4 — E2E (Playwright, fake provider):** with voice mode on and a scripted transcript feed, walk a short sequence (a few teeth), assert the grid fills the right cells, a confirmation prompt appears for a flagged value, "back" corrects it, and `complete` is gated/succeeds. Real microphone/STT is **not** automated (non-deterministic); a manual smoke-test checklist covers real-mic accuracy in an operatory-noise setting.

**Gate:** Tier 1–3 green + the existing perio backend suite (`dental-perio-coverage.test.ts`) unaffected + `bun run typecheck` clean. Voice adds no backend changes, so no contract-test delta is expected (it reuses the existing upsert/complete endpoints).

---

## 5. Phasing & effort

Effort **L** (1–2+ weeks), gated behind a `perio.voice_charting` feature flag throughout.

1. **Phase A — Pure cores (RED→GREEN), no UI.** `parseUtterance` grammar + normalization table; sequencer reducer; bounds-parity tests. Highest-risk logic, fully testable, no engine. (~40% of effort.)
2. **Phase B — Provider abstraction + Web Speech adapter.** `SpeechProvider` interface, Web Speech implementation, fake provider for tests, mic-state model. Wire fake-provider → cores (Tier 2 tests).
3. **Phase C — UI integration on plan-01 grid.** Mic toggle, state indicator, transcript strip, cursor binding, confirmation/correction UX, batched writes through the existing upsert hook. Tier 3 component tests.
4. **Phase D — E2E + manual smoke + polish.** Playwright with scripted provider; real-mic manual checklist; audio cues; reduced-motion/a11y pass; flag default decision.

Cloud-STT provider (Option B) and on-device (Option C) are **explicitly deferred** to a later iteration; the provider interface leaves the door open without committing the work now.

---

## 6. Dependencies

- **Hard:** **P0-1 Perio frontend (plan 01)** — the grid, active-cell cursor, per-tooth upsert hook, and completion flow. Voice binds to all of these; it cannot start before plan 01's grid exists. (perio-review §5 P0; this plan adds the entry layer only.)
- **Soft / reuse (no new backend work):** existing perio backend — `PUT /dental/perio-charts/{chartId}/readings/{toothNumber}`, `POST …/complete`, validators (`perio-validation.ts`), site ordering & CAL (`perio-cal.ts`), generated SDK hooks (produced by plan 01). Voice introduces **no schema or handler changes.**
- **Platform:** browser `SpeechRecognition` availability (Chrome/Edge solid; Safari/iPad partial — drives the provider-abstraction + flag strategy). HTTPS + explicit mic-permission grant required for Web Speech.
- **Compliance:** a documented decision on whether the chosen provider sends audio off-device (Web Speech in Chrome does) and the consent/BAA posture that implies (§7).

---

## 7. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| **Recognition accuracy in a clinical setting** — operatory noise (suction, handpieces), masks muffling speech, isolated single digits are the hardest case for general STT; misheard depths are a *clinical-data* error. | **Highest** | Constrained grammar + phrase biasing; homophone normalization table; **confidence gating** (low-confidence values prompt, never auto-write); always-visible transcript + per-write confirmation so errors are caught immediately; manual operatory-noise smoke test before flag-on; keep keyboard/touch as the trusted fallback. |
| **PHI in audio** — Web Speech in Chrome/Edge streams microphone audio to Google's servers; spoken content here is incidental but the acoustic channel is PHI-adjacent in a clinical context. | High | Treat as a compliance decision, not a default-on: feature-flag off until reviewed; document the data path; for clinics requiring no off-device audio, route to the cloud-STT-with-BAA path (Option B) or defer to on-device (Option C); surface a clear "mic is live / audio may be processed by a third party" disclosure; never transmit patient identifiers in the audio path (clinician speaks only numbers/keywords, not names). |
| **Browser/platform support gaps** — Safari/iPad (a primary clinical surface) has historically partial/unreliable Web Speech support. | Med-High | Provider abstraction + capability detection; hide the voice toggle where unsupported and fall back to keyboard; document supported browsers; revisit on-device/Tauri path for iPad. |
| **Mode confusion / accidental writes** — clinician forgets mic is live; stray speech writes data. | Med | Prominent always-on live-mic indicator (color + icon + label); explicit pause word/button; confirmation gating; "last 3 entries" log + easy "back" correction; auto-pause after N seconds of silence. |
| **Sequencer mismatch with clinician habit** — wrong arch/surface order breaks the spoken rhythm. | Med | Configurable order (maxillary/mandibular-first, surface-pass vs per-tooth); defaults mirror Open Dental + clinical convention; cursor always visible so position is never ambiguous. |
| **Scope creep into free-text dictation** | Low | Explicit non-goal (§2): voice writes only structured perio fields via the existing API. |

---

## 8. One-line summary

Add a **hands-free voice entry layer on top of plan-01's perio grid**: an engine-agnostic `SpeechProvider` feeding two pure, fully unit-testable cores — a perio command **parser** and an **auto-advance sequencer** — that smart-place spoken depths/BOP/recession/mobility/furcation into the existing per-tooth upsert path, with color-coded mic state, confidence-gated confirmation, and a keyboard fallback; the live risk is digit-recognition accuracy in a noisy operatory and the PHI implications of off-device audio.
