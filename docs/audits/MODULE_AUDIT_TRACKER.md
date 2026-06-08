# Module Audit Tracker — 2026-06-08

Per-module deep audit + safe-gap closure. Product-first clinical vertical sequence
(15 audit rounds; bounded-context modules fold into their parent). One commit per module.

**Sequence:**
dental-org → dental-patient → dental-scheduling → dental-visit → dental-clinical → dental-perio →
dental-imaging → dental-pmd → dental-billing → dental-audit → erasure/legal-hold/retention →
dental-portal → emr-consultation → provider → external-records-import

| # | Module | Verdict | Gaps closed | Deferred | Report |
|---|--------|---------|-------------|----------|--------|
| 1 | dental-org | ✅ READY | 5 (1 test gap, 3 doc drift, 1 registry drift) | BR-016c → imaging round | [MODULE_dental-org_AUDIT_2026-06-08.md](modules/MODULE_dental-org_AUDIT_2026-06-08.md) |
| 2 | dental-patient | ✅ READY | 9 (3 cross-tenant PHI holes, 1 stub 500→501, 5 doc/registry drift) | 8 test gaps + archived-sub-resource-guard product decision + KG-backlog | [MODULE_dental-patient_AUDIT_2026-06-08.md](modules/MODULE_dental-patient_AUDIT_2026-06-08.md) |
| 3 | dental-scheduling | ✅ READY | 8 (1 RBAC bypass, 1 adversarial test, 1 stale comment, 1 wrong FSM/table doc note, 4 registry/spec/contract drift) | BR-SCH-003-on-PATCH-cancel decision + sub-feature negative-path line-audit + KG over-claim | [MODULE_dental-scheduling_AUDIT_2026-06-08.md](modules/MODULE_dental-scheduling_AUDIT_2026-06-08.md) |
| 4 | dental-visit | ✅ READY | 10 (5 security: applyTemplate RBAC + cross-clinic template leak + 3× treatment-plan cross-tenant PHI; 5 registry/spec/contract/workflow-map drift) | carry-over cross-branch decision + TypeSpec shape reconciliation + BR-005 flag-ON test + template-CRUD RBAC + KG-backlog | [MODULE_dental-visit_AUDIT_2026-06-08.md](modules/MODULE_dental-visit_AUDIT_2026-06-08.md) |
| 5 | dental-clinical | ✅ READY | 6 (1 consent-integrity bug: revoke-then-sign + gate ignored revoked; 5 contract/spec/registry/comment drift). _Post-audit: updatePrescription BR-003 field-edit guard added (resolved)._ | post-sign consent-withdrawal decision (ratified as-is) + AC-CLI-005 405 pin + KG-backlog | [MODULE_dental-clinical_AUDIT_2026-06-08.md](modules/MODULE_dental-clinical_AUDIT_2026-06-08.md) |
| 6 | dental-perio | ✅ READY | 7 (1 clinical-correctness bug: partial-chart over-staging to IV via charted-count `remainingTeeth`; 1 wrong-role RBAC test; 1 stale comment; 4 registry/spec/contract drift incl. whole module absent from br-registry) | WF-P03 amendment + WF-P05 PDF export deferred + cascade-audit-row test gap + cross-branch positive test + KG-backlog | [MODULE_dental-perio_AUDIT_2026-06-08.md](modules/MODULE_dental-perio_AUDIT_2026-06-08.md) |
| 7 | dental-imaging | ⏳ pending | — | — | — |
| 8 | dental-pmd | ⏳ pending | — | — | — |
| 9 | dental-billing | ⏳ pending | — | — | — |
| 10 | dental-audit | ⏳ pending | — | — | — |
| 11 | erasure/legal-hold/retention | ⏳ pending | — | — | — |
| 12 | dental-portal | ⏳ pending | — | — | — |
| 13 | emr-consultation | ⏳ pending | — | — | — |
| 14 | provider | ⏳ pending | — | — | — |
| 15 | external-records-import | ⏳ pending | — | — | — |

## Cross-module carry-forward

- **BR-016c (imagingTier gate)** — declared in dental-org §5 but enforced/tested in dental-imaging.
  Register in the **dental-imaging** round (correct module attribution).
- **AC-ORG-002** fee-schedule → new-invoice default: dental-org proves the per-branch override;
  the invoice-time price snapshot is billing-side — verify in the **dental-billing** round.
- ~~**BR-015b archived = read-only (product decision)**~~ **RESOLVED 2026-06-08.** Re-verification
  shows the EF-PAT-001 guard (`patient.status==='archived'` → 403 `PATIENT_ARCHIVED`) is now
  pervasive across all sub-resource writers (insurance/contacts/alerts/tasks/household-create/
  treatment-plan/case-presentation/consent/follow-up) — the round-2 note was stale. The lone
  straggler `removeHouseholdMember` (had no guard while its sibling `addHouseholdMember` did) was
  fixed this session (403 `PATIENT_ARCHIVED` + test). Scope decision = enforce (not narrow).
- **PATCH-status-field bypass class (from dental-scheduling)** — a generic `PATCH {status}` update
  path can bypass the narrower RBAC/validation enforced by a transition's dedicated endpoint. In
  scheduling, `PATCH {status:'cancelled'}` bypassed the owner/staff_full cancel restriction (fixed)
  and still bypasses the BR-SCH-003 reason requirement (surfaced). **Check every module with a
  generic status-PATCH against its dedicated transition endpoints** (visit checkout/lock, treatment-plan,
  consent, claim FSM) for the same role/validation asymmetry.
  - **dental-visit instance found + fixed:** `applyTemplate` was an alternate treatment-creation
    path with weaker RBAC than `createDentalTreatment` (assertBranchAccess vs assertBranchRole).
    Keep checking alternate-path writers (templates, carry-over, bulk ops) in every module.
- **Asymmetric FSM transition guards (from dental-clinical V-CLN-010).** A state machine
  with two terminal exits (e.g. consent signed⊥revoked) can guard one direction but not the
  other: `revoke` blocked signed→revoke, but `sign` did **not** block revoke→sign, producing a
  contradictory signed+revoked row that the downstream `signed=true`-only gate honored — letting
  a treatment proceed on a revoked consent. **For every paired terminal transition, check BOTH
  guards are symmetric AND that any read-gate filters on the full invariant (signed=true AND
  revoked=false), not just one flag.** Recurs anywhere a status read-gate (billing, completion,
  treatment) trusts a single boolean.
- **Generic update handlers may skip the immutability guard the create handler enforces
  (from dental-clinical `updatePrescription`).** All five clinical *create* handlers block
  writes to a locked/completed visit (BR-003), but `updatePrescription` had no such guard.
  **RESOLVED 2026-06-08:** `updatePrescription` now blocks field edits on a locked/completed
  visit (422 `VISIT_IMMUTABLE`) while still allowing status FSM progression (dispense/cancel are
  external, per the lab-order §13 carve-out) — tests pin both. The *pattern* still stands: check
  every module's *update* path for the immutability guard its *create* path enforces.
- **Absence-of-evidence must not be inferred as a clinical signal (from dental-perio IDEAL-§343).**
  `classifyChart` defaulted `remainingTeeth` to the count of teeth *charted* on a (partial) perio
  exam, so a fully-dentate patient charted on <20 teeth tripped the `<20 teeth` Stage-IV factor and
  was over-staged — and a test had *enshrined* the wrong result. **For every derived clinical/scoring
  default, check that an omitted optional input is treated as "no evidence" (passed through as
  undefined), not silently substituted with a structurally-related but semantically-different value.**
  Recurs anywhere a classifier/score fills a missing risk input from the data at hand.
- **A whole module can be missing from br-registry (from dental-perio).** dental-perio's BR-P01..P07
  + V-PER codes were entirely absent from `br-registry.json` (8 of 10 dental modules registered).
  **When auditing a module, confirm it has a registry block at all** — not just that individual rules
  are present.
- **Caller-supplied branchId is not an auth boundary (V-PAT-002 → V-VIS-011).** A `branchId`
  query param that is access-checked but never tied to the path resource (patientId) leaks
  cross-tenant. dental-patient (list visits/conditions) and dental-visit (treatment-plan
  get/accept/version) both had it. **Audit every patient/resource-scoped read+write that takes
  a `branchId` query param** in the remaining modules (billing, pmd, portal, emr) — authorize
  against the resource's own branch, not the param.
