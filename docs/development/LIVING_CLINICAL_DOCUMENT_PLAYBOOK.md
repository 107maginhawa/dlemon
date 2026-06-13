# The Living Clinical Document

**A paradigm for clinical software, extracted from a working implementation (Dentalemon), written so any health product — a hospital system, a general EMR, a specialty clinic app — can adopt it.** The clinical specifics below happen to be dental; the concept is domain-neutral. Hand this document to the team (or AI agent) building the new system.

---

## 1. The inversion

A traditional EMR treats the patient record as an **archive**: the clinician treats the patient, then goes somewhere else — forms, tabs, dropdowns — to *file* what happened. History is a list of past entries you open one at a time. Documentation, planning, and billing are three separate acts of transcription, and the gaps between them are where errors and revenue leak.

The Living Clinical Document inverts this. **The record is the clinician's working surface:**

> One continuously evolving document that carries the patient's whole story — which the clinician reads, writes, plans, and bills from directly — instead of operating a database through forms.

Four properties make it work. All four are load-bearing; implement them together.

| # | Property | What it means |
|---|----------|---------------|
| P1 | **The record is the interface** | The clinician acts directly on the clinical visualization (a dental chart, a body map, a problem list). One gesture — click the tooth, mark the wound, tap the problem — *is* the documentation, *is* the plan entry, *is* the billing line. No transcription step. |
| P2 | **Time is a navigation axis** | The encounter history is physically scrubbable — a timeline carousel the clinician flicks backward and forward. Each stop shows the record *exactly as it was* at that encounter. "What did this look like in March?" is answered mid-consultation with a swipe, not a chart-pull. |
| P3 | **The present view is living, not a snapshot** | Today's view is *derived* from the entire history: completed work shows as done, open proposals stay visible, declined items stay visible-but-marked, and unfinished work from prior encounters is offered for carry-over into the new one. The document already knows what's outstanding when the patient sits down. |
| P4 | **History is trustworthy** | Past encounters are append-only. Corrections happen through role-guarded *amendments* layered on top, never edits. Concurrent/offline edits produce *visible* conflicts on the canvas, never silent merges. This is what lets P2 and P3 be legally and clinically safe. |

## 2. Proof it works — how Dentalemon implements each property

This section grounds every claim in shipped code, so adopters know this is an extraction, not a pitch.

**P1 — record as interface.** The workspace screen is one canvas: tapping a tooth opens a short stepped panel (site → finding → planned treatment + code + cost). Saving creates the clinical entry *and* the treatment-plan item in one write; marking it done later feeds billing. Consents, medical-history review, attachments, perio exams, and the payment summary all hang off the same screen — the clinician never "goes to the billing module" to make the visit billable.

**P2 — scrubbable time.** The production `TimelineCarousel` (Swiper coverflow) renders one full chart snapshot per visit. Keyboard and swipe navigate; the active slide drives the whole screen (header date, findings table, chart).

**P3 — living present, derived not copied.** The core function is ~15 lines and is the heart of the paradigm:

```ts
// Effective display state of a clinical element "today", derived at READ time
// from cumulative cross-encounter sets. Precedence: completed > proposed > declined > baseline.
function resolveToothLayer(tooth, baselineClassification, sets) {
  if (sets.completed.has(tooth)) return 'completed';  // treated → shown done, even if a stale plan references it
  if (sets.proposed.has(tooth))  return 'proposed';   // fresh proposal supersedes an old declination
  if (sets.declined.has(tooth))  return 'declined';   // declined stays visible, marked (gray hatch)
  return baselineClassification;                      // otherwise: what this encounter recorded
}
```

The cumulative sets come from a patient-level treatment-plan aggregate, computed when the chart is read. **Nothing is copied forward between encounters** (see §4, ADR-1). Separately, when a new visit is opened, unfinished treatments from prior visits trigger an explicit *carry-over prompt* — the clinician confirms which items follow the patient into today's visit via a dedicated endpoint (`POST …/carry-over` with source-status guards). Deliberate, audited, never silent.

**P4 — trustworthy history.** Visits are immutable once completed; corrections are amendment records with role guards (who may amend what is enforced server-side and tested). The app is offline-first: writes carry client-generated idempotency IDs, merges are clock-aware last-writer-wins *per field*, and losing writes are persisted as conflict records surfaced in a banner on the chart itself — the clinician resolves them on the canvas, in context.

**Measured effect on the product:** the workspace became the center of gravity — scheduling flows into it, billing flows out of it, and most other modules (imaging, perio, prescriptions, case presentation) attach to it rather than living as peers. Adopters should expect the same gravitational pull and design for it.

## 3. Translating to your domain

The dental chart is just Dentalemon's **signature visualization** — the visual form of the patient's clinical state that clinicians in the specialty already think in. Every health vertical has one (or a small set). Fill in this table before writing any code:

| Slot | Dentalemon | Hospital / general EMR examples |
|---|---|---|
| Encounter unit | Dental visit | Admission, ward round, outpatient consult, therapy session, dialysis run |
| Signature visualization | 32-tooth chart, per-surface states | Problem list + body map; vitals/med flowsheet; wound photo grid; obstetric partograph; mental-status timeline |
| Clickable clinical element | Tooth → surface | Problem, body region, wound site, drug order, lab panel |
| Element state vocabulary | caries, filling, crown, extraction… | Your coding reality: ICD/SNOMED problems, order states, wound stages |
| Recording gesture | Tap tooth → 3-step panel | Tap problem → assess/plan panel; tap region → finding panel |
| Plan item lifecycle | proposed → accepted → completed / declined | proposed → ordered → done / discontinued / declined |
| Billing convergence | Treatment done → invoice line (CDT code) | Order/procedure done → charge capture (CPT/DRG/local) |
| Carry-over semantics | Untreated findings offered into new visit | Open problems & pending orders offered into new admission/visit |

Two adaptation notes for larger systems:

- **A general EMR's "chart" may not be anatomical.** A problem-oriented list *is* a valid signature visualization — the paradigm needs direct manipulation and per-element state layers, not necessarily a picture. If a visual artifact exists (body map, flowsheet), prefer it: spatial memory is part of why this works.
- **Multi-clinician concurrency is the hospital-grade extension** of the same P4 machinery dentalemon built for offline: per-field merge + persisted, in-canvas conflicts. The single-user-offline and multi-user-concurrent problems have the same correct answer.

## 4. Architecture

### 4.1 Domain model (minimum viable shape)

```
Patient ──< Encounter (immutable after completion; status FSM: open → completed | discarded)
               │
               ├──< ClinicalEntry      (finding/observation on an element: site, vocabulary code,
               │                        classification: baseline | condition | existing)
               ├──< PlanItem           (intervention proposal; FSM: proposed → accepted →
               │                        completed | declined; links to ClinicalEntry; carries
               │                        billing code + price; carryOverSourceId → prior PlanItem)
               ├──< Amendment          (append-only correction; role-guarded; targets any record above)
               ├──< ConsentRecord      (versioned template + signature, attached to encounter)
               └──< ConflictRecord     (losing concurrent write, persisted with payload, resolvable)

Patient-level READ aggregates (computed, never stored):
   • CumulativeState  = fold(all encounters' PlanItems + ClinicalEntries)
                        → per-element layer via precedence (completed > proposed > declined > baseline)
   • OutstandingWork  = PlanItems where status ∈ {proposed, accepted} and encounter ≠ current
```

### 4.2 The two read models — the architectural heart

Every screen renders one of exactly two views, both served by the read layer:

```
                                   ┌────────────────────────────┐
  GET /patients/:id/encounters/:e  │  SNAPSHOT VIEW (P2)        │  "as it was" — only this
  ────────────────────────────────▶│  encounter's own entries   │  encounter's rows, verbatim
                                   └────────────────────────────┘
                                   ┌────────────────────────────┐
  GET /patients/:id/chart          │  LIVING VIEW (P3)          │  fold of ALL encounters,
  ────────────────────────────────▶│  cumulative, derived at    │  precedence-resolved per
                                   │  read time                 │  element
                                   └────────────────────────────┘
```

**ADR-1 (the one decision that matters most): derive the living view at read time; never copy state forward at write time.** Copy-forward means every historical correction, amendment, voided payment, or late-arriving offline write must hunt down and fix every downstream copy — that class of sync bug is unbounded. Read-time derivation keeps one source of truth (the encounter log) and makes corrections automatically propagate. Cache the fold if it gets hot; do not materialize it as writable state.

**ADR-2: carry-over is an explicit, guarded write — not part of the fold.** The living view *shows* outstanding work (read-only). Pulling it into today's encounter is `POST /encounters/:id/carry-over { itemIds }`, server-validated (source item must still be open, same patient, clinician-confirmed). This keeps "the document reminds you" separate from "the document acted on its own" — clinicians must stay the authors.

**ADR-3: append-only + amendments, enforced server-side.** Completed encounters reject mutation at the API layer. Amendments are first-class records with their own role matrix. This is also what makes the timeline trustworthy enough to be the primary UI.

**ADR-4 (if offline/concurrent): per-field clock-aware merge + persisted visible conflicts.** Client writes carry a client-generated `localId` (idempotency key, safe retries) and a logical clock. Merges are per-field LWW gated by clock; the losing payload is *stored* as a ConflictRecord and surfaced as a banner on the canvas. Never silently drop a clinical write.

### 4.3 The write path (one gesture → three artifacts)

```
clinician taps element on visualization
  → stepped panel (site → finding → plan + code + price)        [UI]
  → ONE transactional API call creates:
       ClinicalEntry + PlanItem(status=proposed) (+ price line)  [API]
  → living view re-derives; element renders 'proposed'           [read model]
  ... later, "mark done":
  → PlanItem FSM transition proposed/accepted → completed        [guarded FSM]
  → billing picks up completed items as charge lines             [billing reads, never re-enters]
```

The invariant to protect: **clinical truth is entered once, at the point of care, and billing/reporting only ever *read* it.** The moment a second entry point exists ("also fill in the charge screen"), the paradigm collapses back into the archive model.

### 4.4 System placement

This paradigm is backend-light and read-model-heavy. It does not require microservices, event sourcing frameworks, or CQRS infrastructure — Dentalemon ships it as: PostgreSQL + a typed ORM, an HTTP API generated from an API spec (spec-first), a React SPA with server-state caching (TanStack Query) per encounter/chart query key, and the fold implemented as plain functions (pure, unit-testable — `resolveToothLayer` and friends). A hospital integrating with an existing HIS can implement the living view as a read service over its encounter store and adopt the workspace UI incrementally (see §6).

## 5. Rules that must survive adoption (and why)

These are the places where a well-meaning team "simplifies" the design and loses the paradigm:

1. **Don't copy state forward.** (ADR-1.) The most tempting shortcut and the most expensive. If your new-encounter code starts with "clone previous encounter's rows," stop.
2. **Don't auto-carry-over.** Silent carry-over turns the document from an assistant into an unaccountable author. Prompt; let the clinician choose; audit the choice.
3. **Don't make history editable.** One "fix the old note" backdoor and the timeline is no longer evidence. Amendments only.
4. **Don't reduce the timeline to a dropdown.** The physical scrubbing — full snapshot per stop, instant back-and-forth — is what changes clinician behavior. A date-picker over the same data does not.
5. **Precedence must be explicit and tested.** `completed > proposed > declined > baseline` (adapt terms to your lifecycle) encodes clinical judgment: treated beats stale plans; a new proposal beats an old refusal. Pin it with unit tests; every adopter bug we hit traced to an unstated precedence assumption.
6. **Summaries must derive from what the body renders.** Any header count/total computed from a different source than the visible rows will eventually lie (we shipped and fixed exactly this bug — a payment footer counting a different set than it billed). Derive summaries from the same data the rows render, and test that invariant against the rendered output.
7. **Conflicts are shown, never swallowed.** A clinical write that silently loses is a patient-safety incident waiting to be discovered.

## 6. Adoption sequence (for the implementing team or AI agent)

Build in this order — each step is independently shippable and de-risks the next:

1. **Fill in the §3 table** for your vertical. Decide the encounter unit, the signature visualization, the element vocabulary, the plan-item lifecycle, the billing code system. This is product work; do it before code.
2. **Prototype the workspace screen in a disposable sandbox** (a standalone Vite/React mini-app with one hand-written mock-encounter file and zero backend). Validate: the visualization is readable at a glance, the recording gesture takes ≤3 steps, scrubbing the timeline *feels* like flipping through a patient's story. The mock file's types become your API-contract draft. Iterate here until clinicians (or domain experts) nod. *(Dentalemon did exactly this; the sandbox still lives in its repo, marked "never ship from here.")*
3. **Model the domain** (§4.1) and expose the **snapshot view** — encounters with their own entries, timeline UI on top. You now have P2 on real data.
4. **Add the write path** — the one-gesture recording flow creating ClinicalEntry + PlanItem transactionally, with the FSM. You now have P1.
5. **Implement the living view** as a pure read-time fold with explicit precedence + the carry-over endpoint and prompt. You now have P3.
6. **Harden history** — server-enforced encounter immutability, amendments with role guards, audit logging. You now have P4 (single-user grade).
7. **Converge billing** — completed PlanItems become charge lines; build the summary-coherence tests (rule 6 above).
8. **Only if needed: offline/concurrency** — localId idempotency, clocked per-field merge, persisted in-canvas conflicts. This is the hardest 20%; ship 1–7 first.

Throughout: spec-first API (write the contract, generate types/clients), and tests at every layer with the precedence fold and FSMs pinned by pure unit tests — they are the paradigm's logic core.

## 7. The pitch, for stakeholders, in three sentences

Clinicians stop transcribing care into software after the fact; the act of care *is* the record. The patient's story becomes something you flip through like pages, with today's page already knowing what's unfinished. And because documentation, planning, and billing are one gesture instead of three systems, nothing is lost between them — clinically or financially.
