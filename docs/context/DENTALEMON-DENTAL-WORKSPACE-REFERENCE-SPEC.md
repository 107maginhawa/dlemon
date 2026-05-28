# Dentalemon Dental Workspace Reference Spec

> **Purpose of this file**  
> This document defines the intended Dentalemon dental workspace so an AI engineer, product designer, or developer can understand and implement it without reducing it to a generic dental chart screen. The key idea is the **visit-based timeline carousel**: every patient visit is a full dental chart snapshot, and the clinician navigates clinical history visually through time.

---

## 1. Product Intent

Dentalemon is a dental management workspace designed around the way dentists actually review a patient over time.

Most dental systems treat the dental chart as a single current record that gets updated repeatedly. History is usually hidden in tables, audit logs, or separate treatment lists. Dentalemon’s differentiator is that the dental chart itself becomes historical.

The clinician should be able to ask:

- What did the patient’s mouth look like during the first visit?
- What changed between visits?
- Which tooth was diagnosed, planned, treated, or completed at each point in time?
- What work remains pending?
- What was done today and what should be charged?

The workspace should answer these visually and structurally, not only through tables.

---

## 2. Core Differentiator: Timeline Carousel

The **timeline carousel** is the primary historical navigation layer of the dental workspace.

It is not decorative. It is not just a gallery. It is the main way the clinician moves through a patient’s dental history.

### Core rule

Each carousel card represents **one patient visit**.

Each card renders the dental chart as it existed at that visit.

The carousel should be read as:

```text
Oldest visit  →  Middle visits  →  Most recent visit
```

The most recent visit should be auto-selected on load.

### Mental model

Each visit is like a commit in Git:

- It is a full snapshot, not merely a diff.
- It can be compared visually with adjacent snapshots.
- Once completed or locked, it should not be casually overwritten.
- A new visit can begin by carrying forward the previous snapshot.

### Product distinction

A normal dental system says:

> “Here is the current dental chart. Look elsewhere for history.”

Dentalemon says:

> “Here is the patient’s dental chart through time. Swipe through visits to see how the mouth changed.”

---

## 3. Workspace Layout Model

The Dentalemon workspace has three synchronized regions.

```text
┌───────────────────────────────────────────────────────────────┬───────────────┐
│ Header / active visit controls                                │ Tooth panel   │
├───────────────────────────────────────────────────────────────┤               │
│                                                               │               │
│ Timeline carousel of visit chart snapshots                    │ Condition     │
│                                                               │ Treatment     │
│                                                               │ Review        │
├───────────────────────────────────────────────────────────────┤               │
│ Active visit breakdown table                                  │               │
└───────────────────────────────────────────────────────────────┴───────────────┘
```

### A. Timeline carousel

The carousel controls the active visit.

- Each card is one visit.
- The active card is centered and visually emphasized.
- Inactive cards remain visible behind/around it to communicate time/history.
- The active card determines what the right panel and bottom breakdown show.

### B. Right tooth input panel

The right panel opens when a tooth is selected.

It is the guided tooth-level input workflow.

Typical steps:

1. **Condition** — what is observed on the tooth.
2. **Treatment** — what is planned or recommended.
3. **Review** — confirm the structured entry before saving.

The panel should be contextual to:

- active visit
- selected tooth
- selected surface, if applicable
- current tooth state
- existing treatment status

### C. Bottom breakdown panel

The bottom breakdown summarizes the active visit.

It should show the structured items recorded for that selected visit, such as:

- tooth
- surface
- condition
- treatment plan
- work done
- fee/amount
- row actions

This section bridges clinical documentation and commercial/payment workflow.

---

## 4. Synchronization Rule

The carousel, right panel, and bottom breakdown must never behave like disconnected features.

They are one synchronized workspace.

### Primary synchronization chain

```text
Selected patient
  → available visits
  → selected carousel card / active visit
  → active visit chart snapshot
  → selected tooth
  → right panel tooth workflow
  → saved tooth/treatment entries
  → bottom breakdown
  → payment/quotation handoff
```

### Required behavior

When the user selects a visit card:

- active visit changes
- active chart changes
- bottom breakdown changes
- selected tooth should reset unless the product intentionally preserves it
- right panel should either close or refresh to reflect the selected visit

When the user selects a tooth:

- right panel opens
- selected tooth is highlighted
- panel loads existing condition/treatment data for that tooth within the active visit

When the user saves tooth data:

- active visit chart updates
- bottom breakdown updates
- related treatment/billing item updates if applicable
- user receives clear success or partial-failure feedback

---

## 5. User Mental Model

The user should understand the system in this simple way:

1. **Pick the patient.**
2. **Swipe through visits.**
3. **Select the active visit.**
4. **Click a tooth.**
5. **Add condition/treatment details in the side panel.**
6. **Review the visit breakdown below.**
7. **Continue to payment or complete the visit.**

The workspace should feel like a clinical timeline, not a form-heavy admin screen.

---

## 6. Visit Lifecycle

A visit is the primary unit of dental chart history.

Recommended visit statuses:

```text
draft → active → completed → locked
             ↘ discarded
```

### Draft

A visit exists but is not yet clinically active.

### Active

The clinician can chart findings, plan treatment, edit tooth data, and build the visit breakdown.

### Completed

The visit is clinically completed. Edits should be restricted or require controlled addendum/versioning.

### Locked

The visit is finalized. Historical chart data should be read-only. Changes should require an addendum or new visit, not direct overwrite.

### Discarded

The visit was opened but intentionally abandoned.

---

## 7. Dental Chart Snapshot Logic

The chart is visit-based.

### Core snapshot rule

Each visit should have its own dental chart snapshot.

A new visit should start from the latest available prior chart snapshot, then allow new changes for the current visit.

### Important distinction

The chart is not simply the patient’s global current chart.

Instead:

```text
Patient
  └── Visit 1
        └── Chart snapshot at Visit 1
  └── Visit 2
        └── Chart snapshot at Visit 2
  └── Visit 3
        └── Chart snapshot at Visit 3
```

### Snapshot behavior

- If a tooth is healthy and untouched, it may be implied as healthy.
- If a tooth has recorded findings or treatment, it should appear in the snapshot data.
- The current visit can inherit prior chart state.
- The current visit can change tooth state, condition, planned treatment, work done, or notes.
- Locked historical visits should not be mutated in place.

### What AI must not do

AI must not implement the workspace as a single mutable dental chart that overwrites history.

That would destroy the core product idea.

---

## 8. Tooth Numbering and Charting Scope

The system should support adult charting first, with pediatric support designed but optionally phased.

### Adult dentition

Support all 32 permanent teeth.

Recommended notation:

- FDI numbering preferred for international clarity.
- Universal numbering can be displayed if needed for market-specific workflows.

### Tooth surfaces

Support surfaces such as:

- mesial
- distal
- buccal/facial
- lingual/palatal
- occlusal
- incisal
- cervical

### Pediatric dentition

Pediatric charting should be treated as a separate mode, not a hacked variation of adult charting.

Expected future support:

- 20 deciduous teeth
- pediatric numbering
- mixed dentition considerations
- eruption/exfoliation status

If pediatric support is scaffolded but not wired, AI should not claim the system fully supports pediatric charting.

---

## 9. Tooth Data Model: Separate the Axes

AI must not confuse tooth appearance, clinical findings, treatment workflow, and billing.

These are related but separate concepts.

### Axis A: Structural / visual tooth state

This describes what the tooth currently looks like or structurally has.

Examples:

- healthy
- caries
- fractured
- filled
- crown
- missing
- implant
- extracted
- watchlist

This axis drives the visual chart appearance.

### Axis B: Clinical condition / diagnosis

This describes what the clinician observed or diagnosed.

Examples:

- caries
- fracture
- impacted tooth
- abscess
- mobility
- gingival recession
- defective restoration
- sensitivity
- periodontal issue

This may use ICD-10, SNODENT, custom condition codes, or clinic-defined codes depending on implementation scope.

### Axis C: Treatment workflow status

This describes where the recommended or performed work is in the clinical workflow.

Recommended statuses:

```text
diagnosed → planned → performed → verified
```

Terminal or alternate statuses:

```text
dismissed
declined
cancelled
```

Optional future status:

```text
in_progress
```

Only add `in_progress` if the product has a clear workflow where treatment spans multiple sessions.

### Axis D: Entry classification

This describes the historical meaning of an entry.

Examples:

- existing: already present before this clinic documented it
- existing_other: done by another clinic/provider
- condition: observation/finding only
- treatment_plan: planned future work
- work_done: completed during this clinic’s care

### Axis E: Financial line item

This describes whether a clinical entry should become a charge, quotation item, package item, discountable item, or insurance/claims item.

Financial data should not be fused directly with diagnosis. A diagnosis may not always create a billable item.

---

## 10. Recommended Display Status Layer

Because the clinical model has multiple axes, the UI should use a computed display layer.

Recommended approach:

```ts
ComputedToothDisplayStatus = deriveDisplayStatus({
  structuralState,
  activeCondition,
  treatmentStatus,
  entryClassification,
  workDoneStatus,
});
```

### Why this is needed

A tooth can have:

- a crown structurally
- recurrent caries clinically
- a planned replacement treatment
- a prior restoration from another dentist
- an unpaid treatment plan item

One simple enum cannot safely represent all of this.

### UI rendering principle

Use layered visual signals:

- base tooth fill = structural state
- border/outline = active condition or watchlist
- badge/icon = treatment workflow status
- surface highlight = affected surface
- row in breakdown = treatment/billing detail

This prevents the chart from becoming clinically misleading.

---

## 11. Carousel UX Rules

### Active card

The active card should be visually unmistakable.

Recommended signals:

- centered position
- larger size
- stronger border
- subtle shadow
- visible visit title/date
- active accent line

### Inactive cards

Inactive cards should communicate history without competing with the active card.

Recommended signals:

- smaller scale
- reduced opacity or contrast
- less detail
- read-only interaction unless clicked to activate

### Default selection

On load:

- sort visits oldest to newest
- select the newest visit by default
- scroll carousel to the newest visit

### Interaction

Supported interactions:

- swipe/drag horizontally
- keyboard left/right navigation
- click inactive card to activate
- select tooth only on active card
- prevent accidental editing of inactive cards

### New visit

The “+ New Visit” action should be clearly separate from the visit cards.

When creating a new visit:

- create a new visit record
- seed its chart from the latest completed/locked/active snapshot, depending on business rule
- make the new visit active
- center it in the carousel

---

## 12. Right Tooth Panel UX Rules

The right panel is the structured tooth-level workflow.

### Opening behavior

The panel opens when a user selects a tooth on the active chart.

It should show:

- tooth number
- selected surface visualization
- current tooth state
- existing conditions for that tooth in this visit
- existing treatment plans/work done for that tooth

### Recommended steps

#### Step 1: Condition

Capture the clinical finding.

Fields may include:

- condition
- surfaces affected
- severity
- diagnosis code
- note
- image/x-ray reference
- existing vs newly diagnosed classification

#### Step 2: Treatment

Capture the proposed or performed treatment.

Fields may include:

- CDT/procedure code
- treatment description
- treatment status
- surfaces
- quantity
- price
- provider
- priority
- consent required flag

#### Step 3: Review

Confirm before saving.

Show:

- tooth number
- condition summary
- treatment summary
- amount, if billable
- warnings or missing required fields

### Save behavior

Saving should be atomic where possible.

If chart save succeeds but treatment save fails, the user must be informed. Silent partial failure is not acceptable.

Recommended feedback:

```text
Chart updated, but treatment plan was not saved. Please retry or review the treatment entry.
```

---

## 13. Bottom Breakdown UX Rules

The bottom breakdown is the structured summary of the active visit.

It should not be a passive table only. It is the bridge between charting, treatment planning, and payment.

### Recommended columns

- Tooth
- Surface
- Condition
- Treatment Plan
- Work Done
- Status
- Amount
- Actions

### Row behavior

Each row should support:

- click to reopen tooth panel
- edit if visit is active
- read-only if completed/locked
- remove/dismiss if permitted
- mark as performed, if workflow allows
- show consent requirement if applicable

### Totals

Show:

- subtotal
- discounts, if applicable
- insurance/coverage, if applicable
- grand total

### Payment handoff

The “Continue to Payment” button should use the bottom breakdown as source context.

It should not pull arbitrary chart conditions as charges unless those entries have been explicitly converted to billable treatment/procedure items.

---

## 14. Treatment Planning and Work Done Logic

The system should distinguish between:

1. A condition observed.
2. A treatment recommended.
3. A treatment accepted/planned.
4. A treatment performed.
5. A treatment verified/completed.
6. A treatment billed or paid.

### Example

A dentist sees caries on Tooth #9.

That may create:

- condition: caries
- treatment plan: restoration/cleaning/etc.
- status: planned
- amount: quoted fee

Later, when work is done:

- treatment status becomes performed
- work done appears in the breakdown
- chart structural state may change to filled/restored
- billing/payment may be completed

The system should not automatically assume diagnosis equals billed procedure.

---

## 15. Carry-Over Logic

Carry-over means unresolved clinical work from prior visits appears in the current visit context.

### Carry-over candidates

Potentially carry over:

- diagnosed but unresolved treatment
- planned but not performed treatment
- watchlist items
- pending procedures
- declined items only if the clinic wants to keep them visible historically

Do not carry over:

- dismissed items
- verified/completed items
- duplicate completed work

### Important product decision

If the system limits carry-over to a fixed number of prior visits, that must be documented as an explicit business rule.

A hidden magic number can cause old unresolved treatment to disappear from the current workflow.

Recommended safer behavior:

- carry over all unresolved items by default, or
- use a named configurable limit with clear UI messaging

---

## 16. Audit, Immutability, and Versioning

Because dental records are clinical records, the system should avoid silent overwrites.

### Required principle

Completed or locked visit snapshots should be immutable or versioned.

### Recommended behavior

For active visits:

- edits may update current chart state
- every meaningful save may be audit logged

For completed visits:

- direct editing should be restricted
- changes should create an addendum or version

For locked visits:

- no direct mutation
- addendum/version-only changes

### Recommended chart versioning

A future implementation should consider a `dental_chart_version` table similar to note versioning.

It should preserve:

- chart ID
- version number
- teeth snapshot
- author/user
- timestamp
- reason/addendum note, if applicable

---

## 17. Time-Lapse Playback

Time-lapse is a future/high-value carousel enhancement.

### Concept

The clinician clicks Play and the carousel advances through visits automatically, allowing the dental chart to visually change over time.

### Behavior

- Play/pause control
- configurable speed
- stop at latest visit
- no infinite loop by default
- keyboard support
- reduced-motion support

### Visual goal

The clinician should feel like they are watching the patient’s dental condition evolve across visits.

This is especially useful for:

- long-term patients
- orthodontic/prosthodontic progress
- periodontal deterioration/improvement
- treatment plan completion tracking

---

## 18. Year Grouping and Long Histories

For patients with many visits, the carousel should not become overwhelming.

Recommended future behavior:

- group by year
- tabs such as `2026`, `2025`, `2024`, `All`
- quick jump to first visit, latest visit, and active treatment visits
- optional filters for planned, completed, unpaid, or watchlist items

The carousel should remain useful for patients with 3 visits and patients with 50 visits.

---

## 19. Accessibility and Reduced Motion

The carousel must be visually strong without excluding users.

### Required accessibility behavior

- keyboard navigation
- visible focus states
- screen-reader-friendly active visit announcement
- clear labels for tooth buttons
- non-color-only indicators
- sufficient contrast

### Reduced motion

If `prefers-reduced-motion: reduce` is enabled:

- reduce or remove 3D coverflow effects
- use flat horizontal snap scrolling
- disable animated tooth transitions
- preserve all functionality

---

## 20. Performance Expectations

The carousel can easily become expensive because every card renders a dental chart.

### Performance risks

- one API request per visit card
- large SVG render count
- many teeth and surface overlays
- many historical visits
- slow time-to-active-chart

### Recommended behavior

- prioritize loading the active/latest visit first
- batch-fetch chart snapshots where possible
- cache chart data per visit
- lazy-load far-off carousel cards
- keep inactive cards visually lighter
- avoid unnecessary remounting of SVG charts

### Performance target

For a patient with 10 visits:

- active visit chart should appear quickly
- carousel should not issue 10+ avoidable network requests if a batch endpoint exists
- switching cards should feel immediate after initial load/cache

---

## 21. Data Model Expectations

Recommended conceptual model:

```text
Patient
  └── Visit
        ├── DentalChartSnapshot
        │     └── ToothChartEntry[]
        ├── DentalTreatment[]
        ├── VisitNote
        ├── ClinicalAttachment[]
        └── Billing/Payment Context
```

### Patient

Stores demographic and patient-level clinical context.

### Visit

Stores the encounter/session context.

### Dental chart snapshot

Stores the chart state for that visit.

### Tooth chart entry

Stores tooth-level structural and clinical data.

### Dental treatment

Stores planned/performed dental procedures and workflow status.

### Billing item

Stores commercial/financial line items derived from treatment/procedure records.

### Attachment

Stores or references x-rays, images, intraoral photos, documents, and consent forms.

---

## 22. API Expectations

The API should support the workspace synchronization model.

### Required endpoint categories

#### Visit endpoints

- list visits by patient
- get visit
- create visit
- update visit status
- lock/complete visit

#### Chart endpoints

- get chart by visit
- save chart by visit
- batch get charts by visit IDs
- chart history/version endpoint, if versioning exists

#### Tooth history endpoint

- get history for one tooth across visits

#### Treatment endpoints

- create treatment
- update treatment status
- list treatments by visit
- carry over unresolved treatments

#### Note/consent endpoints

- sign visit note
- add addendum
- upload/attach consent

#### Billing/payment endpoints

- create quotation/invoice from visit breakdown
- record payment
- mark treatment line as billed/paid

---

## 23. Testing Expectations

Testing should follow the actual workspace workflow, not just isolated component rendering.

### Unit tests

Cover:

- tooth display status derivation
- treatment status transitions
- chart snapshot merge/update logic
- carry-over filtering
- pricing parsing
- locked visit edit prevention

### Integration tests

Cover:

- create visit seeded from prior chart
- save tooth condition and treatment
- treatment failure does not silently disappear
- complete/lock visit restricts mutation
- unresolved treatment carry-over

### E2E tests

Cover:

1. Open patient workspace.
2. Latest visit auto-selected.
3. Select tooth.
4. Right panel opens.
5. Add condition.
6. Add treatment plan and price.
7. Save.
8. Tooth chart updates.
9. Bottom breakdown updates.
10. Continue to payment uses the visit breakdown.
11. Switch to previous visit.
12. Previous visit shows historical snapshot and does not accidentally edit current visit.

### Regression tests

Every change to carousel, chart, right panel, or breakdown should verify synchronization.

---

## 24. UX/UI Design Direction

The UI should feel clinical, calm, modern, and fast.

### Recommended visual direction

- clean white/neutral clinical canvas
- soft shadows and rounded panels
- active visit emphasized with warm accent
- inactive cards muted but recognizable
- minimal color noise on the odontogram
- strong spacing and readable table rows
- right panel as a guided workflow, not a cluttered form

### UX principles

1. **The chart should remain the hero.**  
   Avoid burying the odontogram under forms and tables.

2. **The active visit should always be obvious.**  
   The user should never wonder which visit they are editing.

3. **Tooth editing should feel contextual.**  
   The right panel should feel attached to the selected tooth and active visit.

4. **The bottom breakdown should be actionable.**  
   It should help review, edit, charge, and proceed.

5. **History should be visible, not hidden.**  
   The carousel should make past visits feel immediately accessible.

---

## 25. AI Implementation Guardrails

Any AI implementing this workspace must follow these rules.

### Do not treat the carousel as decoration

The carousel is the primary time/history navigation model.

### Do not collapse history into one current chart

Each visit must maintain its own chart snapshot or versioned equivalent.

### Do not mix tooth state and treatment status

A tooth’s structural state and treatment workflow are separate axes.

### Do not silently swallow partial failures

If chart save succeeds but treatment save fails, the user must know.

### Do not allow inactive cards to be edited accidentally

Only the active visit/card should be editable.

### Do not hard-code unexplained business limits

Limits such as “carry over only 5 visits” must be named, documented, and tested.

### Do not ignore locked/completed status

Historical data must be protected.

### Do not implement UI changes without tests

Carousel, right panel, and breakdown synchronization must have tests.

---

## 26. Acceptance Criteria

The workspace is acceptable when the following are true.

### Carousel

- Visits display oldest to newest.
- Latest visit is active by default.
- Active card is visually clear.
- Clicking/swiping changes the active visit.
- Inactive cards are not editable.
- New visit creation seeds from the correct prior snapshot.

### Chart

- Active visit chart loads correctly.
- Tooth selection opens the right panel.
- Tooth state and treatment status are not conflated.
- Locked/completed visits are protected.

### Right panel

- Shows selected tooth.
- Supports condition → treatment → review flow.
- Saves structured data to the active visit.
- Gives clear feedback for success, validation errors, and partial failures.

### Bottom breakdown

- Reflects the active visit only.
- Updates after tooth save.
- Shows clinical and financial summary.
- Supports payment handoff from valid billable items.

### History

- Past visits remain reviewable.
- Historical snapshots are preserved.
- Tooth history can be reconstructed across visits.

### Performance

- Active/latest chart loads quickly.
- Avoidable N+1 requests are reduced or eliminated.
- Carousel remains responsive with multiple visits.

---

## 27. Suggested Execution Order for AI

If an AI is asked to implement or audit this workspace, use this order:

### Phase 1: Understand current implementation

- Locate carousel component.
- Locate dental chart component.
- Locate right panel/tooth workflow.
- Locate bottom breakdown table.
- Locate visit/chart/treatment APIs.
- Document current behavior before changing code.

### Phase 2: Enforce synchronization

- Ensure selected visit drives chart, panel, and breakdown.
- Ensure selected tooth drives right panel.
- Ensure save updates chart and breakdown.
- Add tests.

### Phase 3: Fix state model clarity

- Keep tooth structural state separate from treatment workflow status.
- Add computed display status if needed.
- Update legend and visual indicators.
- Add tests.

### Phase 4: Strengthen historical integrity

- Prevent edits on completed/locked visits.
- Add versioning/audit where needed.
- Ensure new visits seed from prior snapshot.
- Add tests.

### Phase 5: Improve performance

- Batch chart fetches.
- Reduce N+1 tooth history queries.
- Cache per-visit chart data.
- Add performance tests or query-count checks.

### Phase 6: Add advanced UX

- time-lapse playback
- year grouping
- reduced-motion fallback
- pediatric charting mode

---

## 28. One-Sentence Summary for AI

Dentalemon’s dental workspace is a visit-based, timeline-first odontogram system where the carousel controls historical visit context, the right panel captures tooth-level clinical input, and the bottom breakdown summarizes the active visit for review, treatment planning, and payment.

---

## 29. Short Pasteable Instruction for Another AI

Use this when asking an AI to audit or implement the workspace:

```text
You are working on Dentalemon’s dental workspace. Do not treat it as a normal single dental chart screen. The core product model is visit-based timeline charting: each carousel card is one patient visit and renders that visit’s full dental chart snapshot. Selecting a carousel card changes the active visit, which controls the chart, the right tooth input panel, and the bottom breakdown table. The right panel edits one selected tooth within the active visit using a guided Condition → Treatment → Review flow. The bottom breakdown summarizes all structured clinical/treatment/billing items for the active visit. Preserve history, do not overwrite past visits, and keep tooth structural state separate from treatment workflow status. Implement with tests and stop when a business/product decision is required.
```

---

## 30. Glossary

### Active visit

The visit currently selected in the carousel. It controls what the user sees and edits.

### Chart snapshot

The dental chart state as of a specific visit.

### Tooth structural state

The visual/physical state of a tooth, such as healthy, missing, crown, filled, or implant.

### Clinical condition

A finding or diagnosis, such as caries, fracture, abscess, or watchlist.

### Treatment status

The workflow state of a procedure or treatment recommendation, such as diagnosed, planned, performed, or verified.

### Entry classification

The historical meaning of an entry, such as existing, existing from another provider, condition-only, planned, or work done.

### Breakdown

The active visit’s structured summary table of tooth findings, treatments, work done, and amounts.

### Carry-over

The process of bringing unresolved findings or planned treatments from prior visits into the current visit context.

### Locked visit

A finalized visit that should not be directly edited.
