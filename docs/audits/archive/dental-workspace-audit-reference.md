# Gold-Standard Audit Reference: Dental Clinical Workspace / Chart (Odontogram)

> Authoritative, opinionated reference for auditing a dental PMS charting workspace.
> Validated against FDI/ISO 3950 + Universal notation, ADA/CDT coding, ADA dental
> record-keeping guidance, and the operational models of Open Dental / Dentrix /
> Eaglesoft / Curve / axiUm. Codebase NOT consulted by design — this is the canonical
> "what good looks like" against which the build is graded.

---

## 0. Mental Model (read this first)

A dental chart is **not a drawing tool**. It is a **clinical-legal ledger** rendered
as teeth. Every mark is an event with: a tooth (and often surface/root), a status,
a provider, a timestamp, a procedure code, and an immutable history. The odontogram
is the *view*; the procedure/condition log is the *truth*. Auditors who only look
at the picture miss 80% of the defects. Always trace: **picture → underlying record
→ status machine → audit trail → billing linkage.**

Three orthogonal axes that must never be conflated:
- **Conditions/findings** (caries, fracture, missing, impacted, mobility) — what *is*.
- **Procedures** (restorations, extractions, endo, perio tx) — what was/will be *done*.
- **Status** (Existing, Existing-Other, Treatment-Planned, Completed, Referred, Condition, Voided/Deleted, Invalid/Rejected).

A restoration is a *procedure* with status Existing or Completed. Decay is a
*condition*. "Watch" is a *condition*, not a treatment plan item. Getting these
collapsed into one "annotation" type is the single most common architectural sin.

---

## 1. Core User Roles at the Chart Workspace

| Role | Can do | Cannot do (hard rule) |
|---|---|---|
| **General dentist (treating provider)** | Chart conditions; diagnose; create/sequence/version treatment plans; mark TP→completed; sign/lock notes; void with reason; set provider-of-record; prescribe; bill-trigger on completion | Edit another provider's *signed* note (only addendum); delete locked entries; bill un-completed tx |
| **Specialist (endo/perio/OS/ortho)** | Same as GP within scope; chart referred-in work as Existing-Other; own their procedure entries | Alter referring provider's diagnoses without addendum |
| **Hygienist (RDH)** | Full perio chart (6-pt PD, BOP, recession, mobility, furcation, CAL, plaque/calculus, suppuration); chart existing conditions; record prophy/SRP/perio maint; flag findings for dentist dx; co-sign workflows | Diagnose definitively / finalize treatment plan / mark restorative TP as completed (jurisdiction-dependent — must be configurable, not hardcoded) |
| **Dental assistant (DA/EFDA)** | Chart existing conditions during exam (dentist dictates); enter imaging links; clinical photo capture; assist note drafting; set procedure as in-progress | Sign/lock notes; finalize diagnosis; accept treatment plan; trigger billing |
| **Front office / treatment coordinator** | View chart read-mostly; present treatment plan to patient; capture plan acceptance + financial; schedule TP items; manage estimates/insurance; capture consent doc | Edit clinical findings; change procedure status to completed; alter notes |
| **Read-only / referring external / auditor** | View chart, audit trail, plan history | Any mutation |

**Audit rule:** role capability must be **policy-configurable per jurisdiction**
(hygienist scope varies by US state / country). A hardcoded RBAC matrix is a finding.
Provider-of-record on each procedure must be explicit and may differ from the
logged-in user (delegated entry).

---

## 2. Canonical Clinical User Journeys

For each: **trigger → steps → decision points → exit/gate**. A journey is "supported"
only if every decision point is representable AND the record + audit trail + billing
linkage hold.

### J1. New-patient comprehensive oral evaluation (CDT D0150) + charting existing

1. Open/triage chart → dentition mode auto-set (adult / child / mixed) from DOB.
2. Medical history + alerts surface on chart (allergies, premed, anticoagulant, etc.).
3. Chart **existing conditions/restorations**: per tooth/surface — missing, existing
   restorations (amalgam/composite/crown/bridge/implant/RCT), caries, fracture, wear,
   recession, mobility, defective restoration, watch.
4. Existing work done elsewhere → status **Existing-Other** (not Completed-by-us).
5. Perio screening or full perio chart (see J3).
6. Imaging linked to chart (FMX/pano/BWs/photos) and to specific teeth/findings.
7. Diagnoses recorded per tooth/finding (ICD/SNODENT or internal dx).
8. Comprehensive exam note authored → **sign/lock** (D0150 recorded as Completed).

**Decision points:** adult vs child vs mixed dentition; existing-by-us vs
existing-other; condition (watch) vs needs-treatment (→ J4); perio screening vs full;
supernumerary / congenitally missing handling; primary tooth over-retained with
permanent present.

**Gate:** every existing restoration has tooth + surface(s) + material/type +
Existing status; D0150 cannot be Completed without an authored exam note.

### J2. Periodic exam / recall (D0120) / re-eval

1. Load chart with prior baseline visible (last exam date, last perio, prior plan).
2. **Diff since last visit**: new caries, restoration breakdown, perio change,
   completed-since markers.
3. Update conditions; convert "watch" → diagnosed → plan if progressed.
4. Re-perio if due (compare to baseline — pocket worsening trend).
5. Update/re-version active treatment plan (J9).
6. D0120 note signed/locked.

**Decision points:** is full perio due? has watch progressed? does prior unaccepted
plan need re-pricing/re-versioning? recall interval change?

### J3. Periodontal charting and its odontogram relationship

1. Enter perio chart linked to **same tooth identities** as odontogram (missing teeth
   on odontogram MUST be absent/locked in perio grid — no probing a missing tooth).
2. Capture **6 sites/tooth**: PD ×6, BOP per site, recession/gingival margin, CAL
   (computed or entered), mobility (0–III), furcation (I–III) on multi-rooted teeth
   only, suppuration, plaque/calculus, MGJ/keratinized tissue.
3. Auto-derive: CAL = PD + recession; perio case type / AAP staging+grading; sextant
   summary; PSR if screening mode.
4. Perio findings feed diagnosis → SRP (D4341/D4342), perio maint (D4910), gingival
   (D4346), surgical codes — per-quadrant tooth-count rules enforced.
5. Trend view across exams; perio chart timestamped/locked, comparable.

**Decision points:** screening (PSR) vs full; D4341 (≥4 teeth/quadrant) vs D4342
(1–3); reclassify prophy→perio; furcation only valid on molars (and max first
premolar); recession can be negative (overgrowth).

**Hard invariant:** perio sites must reference live tooth identity. Probing a tooth
charted missing/extracted = data integrity bug. Furcation on a single-rooted tooth =
validation failure.

### J4. Diagnosis → treatment plan → presentation → acceptance → schedule → deliver → complete → bill

1. Finding/diagnosis on tooth/surface.
2. Add **treatment-planned procedure** (CDT code, tooth, surface(s), provider, fee,
   phase/priority). Status = **TP**.
3. Sequence/phase (J8). Compute estimate + insurance + patient portion.
4. **Present** plan (printable/portal), capture **acceptance** (full/partial/declined)
   + signature/date + **informed consent** for the procedures.
5. Schedule accepted items to appointments (TP item ↔ appointment link).
6. **Deliver**: at appointment, procedure → in-progress → **Completed** with
   completion note, provider, surfaces actually treated, materials, anesthesia.
7. Completion **triggers billing eligibility** (claim/ledger) — never before.
8. Post-op / follow-up scheduling; chart reflects Completed restoration.

**Decision points:** accept all vs partial vs decline (must persist *declined* with
reason — informed refusal is legally critical); pre-auth required?; alternative
benefit / downgrade; tooth surface change between plan and delivery (replan, don't
silently mutate); same-day tx (plan→complete same visit) still must pass consent gate.

**Gate (non-negotiable):** **no billing/claim for a procedure not in Completed
status.** Completion requires authored note + provider + date. Treatment requires
recorded consent for that procedure (or documented emergency exception).

### J5. Existing / Planned / Completed model on the odontogram

- **Existing**: pre-existing work (by us historically) — neutral color, no fee event.
- **Existing-Other**: done by another provider/elsewhere — distinct from Existing.
- **Treatment-Planned (TP)**: proposed, distinct color, carries estimate, not in
  clinical history of *done* work, must be acceptance-gated to schedule.
- **Completed**: delivered by us this/again — fee/claim eligible, dated, signed.
- **Condition**: caries/fracture/watch/missing — a *finding*, never billable as a
  procedure, drives diagnosis.
- **Referred**: sent out; tracked to closure (becomes Existing-Other when returned).
- **Voided / Invalid / Rejected (insurance)**: audited terminal states.

**Audit rule:** these must be **distinct statuses on the procedure record**, color +
legend-rendered, filterable, and each must drive correct downstream behavior
(billing, scheduling, history). A single boolean "done?" or merging Existing with
Completed is a major finding. Legend must be present and accurate.

### J6. Multi-visit / phased treatment plans & sequencing

1. Plan groups into **phases/visits** with ordering and dependencies (e.g., extract
   #14 → bone graft → implant → crown; SRP before restorative; endo before crown).
2. Priority/urgency per item (urgent/recommended/elective).
3. Per-phase estimate, per-appointment grouping, scheduling respects sequence.
4. Progress tracking: phase 1 done, phase 2 pending; partially completed plan state.
5. Re-sequence/re-version when clinical reality changes (J9).

**Decision points:** dependency enforcement (warn/block out-of-order completion);
phased financials; provider per phase (perio vs restorative vs specialist).

### J7. Charting granularity: surface / tooth / quadrant / arch + dentition

- **Surface-level**: M O D B/F L/P I (incisal) — surface-set must match procedure
  type (e.g., MOD for restoration; crown = whole tooth; root for endo/RCT;
  perio/SRP per quadrant; sealant occlusal; SDF surface).
- **Whole tooth**: extraction, implant, crown, RCT, missing, impacted.
- **Root-level**: endo, apicoectomy, perio furcation.
- **Quadrant/sextant**: SRP, perio maintenance scope, surgical flaps.
- **Arch/full-mouth**: dentures, FMX, ortho, full-mouth debridement.
- **Dentition modes:** Permanent (1–32 / FDI 11–48), Primary (A–T / FDI 51–85),
  **Mixed** — child losing primary, gaining permanent simultaneously. Notation
  system (Universal / FDI / Palmer) must be a display setting over a stable internal
  tooth identity.

**Hard invariants:** surface validity per tooth class (incisors have no occlusal —
they have incisal); anterior vs posterior surface sets differ; primary tooth ids
distinct from permanent; mixed dentition must show both correctly for same patient;
supernumerary teeth representable; quadrant/arch procedures must not require a single
tooth.

### J8. Sequencing detail (clinical dependency rules)

Auditor should confirm the system at least *warns* on: crown on a tooth with no
completed/planned RCT when indicated; restorative scheduled before SRP on
perio-active patient; prosthetic on a tooth slated for extraction; implant crown
before implant placement. Block vs warn is a policy choice — *silence is the bug*.

### J9. Treatment plan versioning & re-planning

1. Plans are **versioned/immutable snapshots**, not mutated in place.
2. New version on material change (new findings, declined items, fee change,
   re-sequence). Prior versions retained, viewable, with reason/date/author.
3. Exactly **one active/proposed plan** at a time (alternatives allowed as separate
   labeled options A/B, but one is *the* plan); historical versions archived.
4. Presented + accepted version is preserved verbatim (what the patient agreed to).

**Audit rule:** if editing a presented plan silently changes the accepted record =
serious legal finding. The accepted version must be frozen.

### J10. Void / correct / amend a charted entry

- **Deletion disallowed** for signed/locked/completed/billed entries. Allowed only
  for never-signed drafts, and even then audit-logged.
- **Correction before sign**: editable, but edit history retained.
- **After sign/lock**: only via **addendum/amendment** — new entry, current date,
  author, reason, original remains visible (strike-through semantics, not erasure).
- **Void**: terminal status with mandatory reason, author, timestamp; entry remains
  in record (e.g., charted on wrong tooth → void + re-enter, both visible).
- **Charted on wrong patient**: void/move with audit, never silent delete.

**Audit rule:** any path that hard-deletes clinical or billed history = critical
finding. Metadata/version trail must survive (attorneys read metadata).

---

## 3. Critical Business Rules & Invariants

**Billing/financial**
- B1. No claim/ledger charge for a procedure not in **Completed** status.
- B2. Completion requires: provider-of-record, date, authored note.
- B3. Fee/estimate captured at planning; final charge at completion; variance audited.
- B4. Voided/declined/rejected procedures are non-billable and explicit.
- B5. CDT code ↔ procedure mapping enforced; code drives surface/tooth/quadrant
  requirement (D2391 needs surfaces; D4341 needs quadrant + tooth count; D7140 whole
  tooth). Invalid/retired CDT codes flagged. Code year/version tracked.

**Status machine (legal transitions only)**
- TP → Completed (via delivery), TP → Voided, TP → re-versioned.
- Existing/Existing-Other → (immutable except void-with-reason).
- Condition → diagnosed → TP (does not become Completed by itself).
- Completed → Voided (reason) only; **never** Completed → TP → editable silently.
- Referred → Existing-Other (on return) or Voided.
- No transition may skip consent gate for treatment delivery.

**Dentition / anatomy**
- D1. Cannot plan/complete a restorative/endo procedure on a tooth charted
  **missing/extracted** (must un-chart missing first, audited — tooth "returned").
- D2. Surface set valid for tooth class & procedure type.
- D3. Furcation only on multi-rooted teeth; mobility scale bounded; PD plausibility
  bounds (e.g., >12mm warn).
- D4. Primary tooth cannot coexist with its permanent successor as both "present &
  healthy" without mixed-dentition handling.
- D5. Quadrant/arch procedures don't require single-tooth selection.

**Clinical/legal**
- C1. Treatment delivery requires recorded **informed consent** for that procedure
  (or documented emergency/exception).
- C2. Signed/locked notes immutable — amendment only, original preserved.
- C3. Exactly one active treatment plan; accepted version frozen.
- C4. Declined treatment ("informed refusal") must be persistable with reason.
- C5. Provider-of-record explicit per procedure; may differ from data-entry user;
  hygienist scope policy-configurable.
- C6. Medical alerts (allergy/premed/anticoagulant) surfaced at chart before tx.

**Data integrity**
- I1. Odontogram is a projection of the procedure/condition log — they cannot diverge.
- I2. Perio chart references live tooth identity (no orphan/missing-tooth sites).
- I3. Imaging/notes link to durable tooth+finding ids that survive re-versioning.
- I4. Notation system is display-only over stable internal ids.

---

## 4. Compliance & Record-Integrity Dimensions (practical)

1. **Immutable audit trail** — every create/modify/void/sign of a clinical or
   financial entry: who, what (before→after), when, from where. Queryable, exportable,
   tamper-evident. Not optional, not "log file only".
2. **Sign-off / chart lock** — exam & treatment notes can be signed; signed = locked;
   locked = addendum-only. Lock state visible on the entry.
3. **Amendment history** — corrections are addenda with current date + author +
   reason; original text preserved and viewable (strike-through, not deletion).
   Late-entry handling supported and labeled as such.
4. **Malpractice-defensible documentation** — completion notes capture clinical
   detail (tooth/surface, anesthesia, materials, complications, post-op); declined
   treatment + informed refusal captured; consent linked to specific procedures;
   medical history reviewed/dated.
5. **Consent capture** — per-procedure or per-plan informed consent with date,
   signer, content/version; treatment-delivery gate references it.
6. **PHI handling** — access-logged chart views (who viewed which patient when),
   least-privilege RBAC, no PII leakage in exports/logs/URLs, secure imaging
   storage, retention/destruction policy honored (incl. minors' extended retention).
7. **Provider attribution** — every clinical/financial entry attributable to a
   licensed individual; co-sign/supervision workflows where scope requires.
8. **Time integrity** — server-authoritative timestamps; back-dating blocked or
   explicitly flagged as late entry.

---

## 5. Highest-Risk Gaps (looks fine in demo, breaks in clinic / creates liability)

1. **Status collapse** — Existing vs Completed vs TP merged into one annotation /
   boolean "done". Breaks billing, history, legality. #1 offender.
2. **No Existing-Other** — work done elsewhere recorded as Completed-by-us → false
   provider attribution + erroneous billing exposure.
3. **Hard delete of charted/billed entries** — instead of void+audit. Spoliation /
   malpractice liability. Demo "edit" button that destroys history.
4. **Billing not gated on Completed** — claim can fire from a plan. Insurance fraud
   risk.
5. **Editable signed notes** — no lock/addendum model. Record alterability =
   indefensible in litigation; metadata exposes it.
6. **No treatment-plan versioning** — accepted plan mutates silently; can't prove
   what patient agreed to.
7. **Perio chart decoupled from odontogram** — can probe missing teeth; perio data
   doesn't survive tooth/plan changes; no trend/baseline.
8. **No mixed dentition** — pediatric/transitional patients unrepresentable; primary
   + permanent collision.
9. **Surface/code validation missing** — restoration with no surfaces; crown with
   surfaces; SRP without quadrant; retired CDT codes; D-code ↔ requirement mismatch.
10. **Plan on extracted/missing tooth** — no anatomical guard.
11. **No consent gate / no informed-refusal capture** — treatment proceeds with no
    consent linkage; declined tx not persisted.
12. **No audit trail / weak attribution** — can't answer who-did-what-when; no view
    access logging (PHI).
13. **Single hardcoded RBAC** — hygienist scope not jurisdiction-configurable;
    provider-of-record = logged-in user only (no delegated entry).
14. **No sequencing/dependency awareness** — crown before RCT, restorative before
    SRP, prosthetic on to-be-extracted tooth — system silent.
15. **Notation hardcoded** — Universal-only with no FDI/Palmer display, or notation
    baked into stored ids (re-numbering corrupts history).
16. **Same-day treatment bypasses gates** — plan→complete in one click skips consent
    / note authoring.

---

## 6. Audit Question Bank (walk-the-workspace, by journey)

### A. Roles & access
1. Can a hygienist finalize a definitive diagnosis or mark a restorative TP as
   completed? Should be blocked/policy-gated — is it?
2. Is provider-of-record per procedure explicit and can it differ from the
   logged-in user (delegated entry)?
3. Is hygienist/assistant scope configurable per jurisdiction, or hardcoded?
4. Is every chart **view** access-logged for PHI, not just edits?
5. Can front office change a clinical finding or procedure status to Completed?
   (should be no)

### B. New exam & existing-conditions (J1/J5)
6. Can you chart a pre-existing crown as **Existing** with no fee/claim event?
7. Is **Existing-Other** (done elsewhere) a distinct status from Completed-by-us?
8. Does the legend show distinct colors for Existing / Existing-Other / TP /
   Completed / Condition / Referred / Voided?
9. Can D0150/D0120 be marked Completed with **no authored exam note**? (should be no)
10. Are medical alerts (allergy/premed) surfaced on the chart before treatment?

### C. Perio (J3)
11. Does the perio grid suppress/lock teeth charted **missing** on the odontogram?
12. Are all 6 sites/tooth captured (PD, BOP, recession, CAL, mobility, furcation,
    suppuration)?
13. Is furcation blocked on single-rooted teeth?
14. Is CAL auto-derived from PD + recession, and is a trend/baseline comparison
    available across exams?
15. Does perio classification drive correct CDT (D4341 ≥4/quad vs D4342 1–3;
    D4910; D4346) with tooth-count enforcement?
16. Is the perio chart timestamped and lockable?

### D. Diagnosis → plan → accept → deliver → bill (J4)
17. Can you generate an insurance claim / ledger charge for a procedure still in
    **TP** status? (must be no)
18. Does marking Completed require provider + date + completion note?
19. Is **informed consent** required/linked before treatment delivery (or a
    documented emergency exception)?
20. If a patient **declines** treatment, is that informed refusal persisted with
    reason?
21. If surfaces treated differ from surfaces planned, does it replan/version or
    silently mutate the original?
22. Are TP items linkable to appointments and is acceptance required before
    scheduling?
23. Does same-day "plan then complete" still enforce consent + note?

### E. Existing/Planned/Completed integrity (J5)
24. Are these four+ distinct **statuses on the record** (not a boolean), each
    filterable?
25. Does the odontogram visually and accurately reflect the underlying procedure
    log (no divergence)? Force a status change and confirm picture + ledger agree.

### F. Phasing & sequencing (J6/J8)
26. Can a plan be split into ordered phases/visits with priorities?
27. Does the system warn/block crown completion when no RCT planned/done where
    indicated, or restorative before SRP on a perio-active patient?
28. Can a prosthetic be planned on a tooth slated for extraction without any warning?

### G. Granularity & dentition (J7)
29. Does it reject an occlusal surface on an incisor (incisal expected)?
30. Does a restoration require ≥1 valid surface; does a crown reject surface entry;
    does SRP require a quadrant not a single tooth?
31. Does dentition mode support Permanent, Primary, and **Mixed** for the same
    patient (transitional child)?
32. Are supernumerary / congenitally-missing teeth representable?
33. Can notation switch (Universal/FDI/Palmer) as display without altering stored
    history ids?

### H. Versioning & re-planning (J9)
34. Are treatment plans versioned immutable snapshots with reason/date/author per
    version?
35. Is there exactly one active plan, and is the **accepted** version frozen
    (editing creates a new version, doesn't rewrite the accepted one)?

### I. Void / amend / audit (J10 / §4)
36. Try to delete a signed/completed/billed entry — is hard delete blocked,
    leaving void+reason+audit instead?
37. After signing a note, can it still be edited, or only amended via dated
    addendum with original preserved?
38. Does the audit trail show before→after, who, when, where for every clinical &
    financial mutation, and is it exportable?
39. Chart on the wrong tooth/patient — is the correction a void+re-enter with both
    visible, never a silent overwrite?
40. Can a missing/extracted tooth receive a planned/completed restorative without
    first un-charting missing (audited)? (must be guarded)

---

## 7. Scoring Guidance for the Audit

- **P0 (critical / liability):** Q17, Q18, Q19, Q36, Q37, Q38, Q40, plus Gap #1–#6.
  Any failure here = not clinically deployable.
- **P1 (workflow-breaking):** Q6–Q8, Q11–Q15, Q24–Q25, Q31, Q34–Q35.
- **P2 (correctness/quality):** Q26–Q30, Q32–Q33, Q39.
- **P3 (polish/configurability):** Q3, Q9, Q22, Q23, Q33.

Rule of thumb: a workspace that demos beautifully but fails any P0 is **more**
dangerous than one that looks rough — false confidence in a clinical-legal record is
the core risk. Audit the ledger and audit trail, not the pixels.

---

## Sources (standards validation)

- [Open Dental — Chart Module](https://www.opendental.com/manual/chart.html)
- [Open Dental — Enter Treatment / statuses (TP/C/EO/EC/R)](https://opendental.com/manual/entertreatment.html)
- [Dentrix Ascend — Charting symbols / status colors](https://hsps.pro/DentrixAscend/Help/Charting_symbols.htm)
- [Dentrix — Charting Existing / Existing-Other](https://learn.dentrixascend.com/courses/clinical-essentials-for-teams/lessons/charting/topic/charting-existing-treatment/)
- [FDI / ISO 3950 notation — Wikipedia: Dental notation](https://en.wikipedia.org/wiki/Dental_notation)
- [Universal Numbering System — Wikipedia](https://en.wikipedia.org/wiki/Universal_Numbering_System)
- [ADA — What and How to Write, or Change, in the Dental Record](https://www.ada.org/resources/practice/practice-management/writing-in-the-dental-record)
- [ADA / AAPD — Dental Records (Legal Affairs)](https://www.aapd.org/globalassets/media/safety-toolkit/dental-records-ada.pdf)
- [The Doctors Company — Requests to Amend a Medical or Dental Record](https://www.thedoctors.com/articles/requests-to-amend-a-medical-or-dental-record)
- [MLMIC — FAQs About Dental Records: A Legal Perspective](https://www.mlmic.com/dentists/blog/faqs-about-dental-records/)
- [Noridian — Documentation Guidelines for Amended Records](https://med.noridianmedicare.com/web/jeb/cert-reviews/mr/documentation-guidelines-for-amended-records)
- [ADA — Guide to Reporting D4346 (perio charting requirements)](https://www.ada.org/-/media/project/ada-organization/ada/ada-org/files/publications/cdt/v6_adaguidetoreportingd4346_2023jan.pdf)
- [Dentalcare — PSR / periodontal screening & recording codes](https://www.dentalcare.com/en-us/ce-courses/ce617/interpretation-of-codes)
- [DentistryIQ — Coding for Basic Periodontal Treatment (D4341/D4342)](https://www.dentistryiq.com/practice-management/insurance/article/16351236/coding-for-basic-periodontal-treatment)
