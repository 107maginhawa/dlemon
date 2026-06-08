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
| 7 | dental-imaging | ✅ READY | 6 (1 cross-branch PHI isolation test; 5 doc/registry drift: DOMAIN_MODEL SM-01 mislabel, MODULE_SPEC §6 permissions / §13 edge-cases / §15 errors, br-registry CIMG-001/002 tier + CIMG-010 analyses) | AI auto-tracing/DICOM/structural-superimposition non-goals + imaging audit-row test gap + detect kill-switch-OFF test + 403/404-mask convention note + KG-backlog | [MODULE_dental-imaging_AUDIT_2026-06-08.md](modules/MODULE_dental-imaging_AUDIT_2026-06-08.md) |
| 8 | dental-pmd | ✅ READY | 5 (1 cross-branch PHI isolation test; 4 doc/registry drift: MODULE_SPEC §7/§7.2 phantom columns, §10 wrong list route + multipart, §15 error table, br-registry enriched 2→7 rules) | getImportedPMD-patient-self-detail decision + async/presigned/multipart/notif deferred + 2 test gaps (detail-read audit row, care-record superseded-exclusion) + KG over-claim (PMD mis-expansion / phantom route / recall claim) | [MODULE_dental-pmd_AUDIT_2026-06-08.md](modules/MODULE_dental-pmd_AUDIT_2026-06-08.md) |
| 9 | dental-billing | ✅ READY (1 security fix) | 6 (1 REAL cross-tenant money+PHI hole on 5 optional-branchId report endpoints; 5 doc/registry drift: br-registry +BR-014/BR-015/EM-BIL-002 & BR-010/012 stale, MODULE_SPEC §8 FSM / §10 routes, API_CONTRACTS plan-frequency enum) | recordedByMemberId server-validation product decision + 2 test gaps (empty-membership pin, DE-008 partial-negative pin) + KG-backlog (phantom ar/aging route) | [MODULE_dental-billing_AUDIT_2026-06-08.md](modules/MODULE_dental-billing_AUDIT_2026-06-08.md) |
| 10 | dental-audit | ⏳ pending | — | — | — |
| 11 | erasure/legal-hold/retention | ⏳ pending | — | — | — |
| 12 | dental-portal | ⏳ pending | — | — | — |
| 13 | emr-consultation | ⏳ pending | — | — | — |
| 14 | provider | ⏳ pending | — | — | — |
| 15 | external-records-import | ⏳ pending | — | — | — |

## Cross-module carry-forward

- ~~**BR-016c (imagingTier gate)** — declared in dental-org §5 but enforced/tested in dental-imaging.~~
  **RESOLVED 2026-06-08 (dental-imaging round).** The gate is implemented as strict `imagingTier !== 'addon'`
  at study create (cephalometric/CBCT) AND on every ceph endpoint, blocking free/basic/null with 403
  IMAGING_TIER_REQUIRED. br-registry CIMG-001/002 reconciled (had understated `basic` as allowed). Tests
  pin free→403, basic→403, null→403, addon→pass.
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
  - **dental-imaging = the SAFE pattern (no hole found).** Every imaging handler derives branch
    from the resource (`study.branchId`, or image→study), then `assertBranchAccess/Role`; the
    `listPatientImages?branchId=` repo filters images by `branchId` AND the caller must be a member
    of it, so a member of a different branch sees zero rows (no leak). The 2026-06-08 round only
    ADDED the missing *test* for this (a same-org member of `OTHER_BRANCH` is denied a `BRANCH_ID`
    radiograph) — it was correct by source but unpinned. **Cross-branch isolation should be tested
    with a member of a *different* branch (full role), not just a no-membership `OUTSIDER` — the two
    deny for different reasons and only the former proves the resource-scoped-branch invariant.**
  - **dental-pmd = also the SAFE pattern (no hole found) — 2026-06-08.** dental-pmd trusts **no
    `branchId` query param at all**; visit-scoped handlers derive branch from `visit.branchId`,
    patient-scoped handlers from `patient.preferredBranchId` (the patient resource's own branch,
    org-scoped so it can't cross an org boundary), then `assertBranchAccess/Role`. The round only
    ADDED the missing cross-branch *tests*.
  - **dental-billing = HOLE FOUND + FIXED (EM-BIL-002) — 2026-06-08.** The *mutating* handlers are
    SAFE (branch from `invoice.branchId`/`claim.branchId`/`patient.preferredBranchId` + assertBranchRole),
    and `listDentalInvoices` *requires* branchId (400 otherwise). But **five REPORT/LIST endpoints**
    (`getArAging`, `getCollectionsSummary`, `getPayerArAging`, `listInsuranceClaims`,
    `generateStatementBatch`) treated `branchId` as an OPTIONAL filter and only `assertBranchAccess`
    *when supplied* — so **omitting branchId applied NO branch condition and scanned every org's
    invoices/payments/claims/balances + patient names** (cross-tenant financial-data + PHI). This is
    a **NEW, stronger variant** of the class: not "caller-supplied branchId untied to the resource"
    but **"optional branchId omitted → no scoping at all → full multi-tenant aggregate."** Fixed TDD:
    omitted-branch now scopes to the caller's own active branches via `getActiveBranchIdsForPerson`
    → `inArray` (empty membership → zero rows, never the whole DB). **NEW CARRY-FORWARD: audit EVERY
    list/report/aggregate endpoint whose tenant/branch filter is OPTIONAL — an omitted optional scope
    must default to the caller's accessible set, never to "unfiltered = all tenants." Check portal +
    emr (the last two modules) for the same optional-filter-omitted pattern, not just caller-supplied
    branchId.**
  - **branchId-auth-boundary class status: CLEAR for org/patient/scheduling/visit/clinical/perio/
    imaging/pmd; HOLES found+fixed in dental-patient + dental-visit (caller-supplied branchId) and
    dental-billing (omitted optional branchId). Remaining to chase: portal, emr.**
  - **TARGETED CROSS-MODULE SWEEP for the optional-branchId-omission variant — CLEAN (2026-06-08).**
    After EM-BIL-002, swept all 45 list/report/aggregate/search/export endpoints across the eight
    already-audited modules (org/patient/scheduling/visit/clinical/perio/imaging/pmd) specifically for
    *"optional branchId omitted → unscoped → all tenants."* **ZERO holes found** — the variant is unique
    to dental-billing. Every list/report endpoint in these modules is either (a) **branchId-required**
    (400/throw on omit → hard `eq(branchId)`), (b) **resource-anchored** — branch derived from a path
    resource (visit/patient/study/image/household/chart/template) then `assertBranchAccess/Role`, the
    query `branchId` only a further-narrowing filter (the V-PAT-002/V-VIS-011 posture), or (c) scoped to
    the caller's **own memberships** (`getBranchesByUser`, `getPermissionGrid` org-resolution). The six
    repos with a conditional `if (filters.branchId)` (`visit.repo:35`, `perio-chart.repo:27`,
    `dental-appointment.repo:37`, `waitlist-entry.repo:34`, `queue-item.repo:25`, `membership.repo:62`)
    were each traced to callers that require branchId or derive+assert it from a resource first — none
    leaves an unfiltered all-tenant path. **Why clean, not a coverage gap:** the billing hole was
    structural — its reports aggregate *across patients* (AR aging / collections / payer aging / claim
    worklist / statement batch), so there is no path-resource to anchor the branch and the only scope was
    the optional `branchId`. Every report in the other 8 modules is resource-anchored or branchId-required,
    so there is no "cross-resource aggregate with an optional-only scope" surface to leak. **The
    optional-filter-omission hazard therefore remains live ONLY for cross-resource aggregate/report
    endpoints — chase it specifically in portal + emr (and any future reporting module).** Coverage proof:
    [SWEEP_optional-branchid_2026-06-08.md](SWEEP_optional-branchid_2026-06-08.md) (full per-endpoint table,
    negative results included).
- **A br-registry rule can UNDERSTATE a gate, not just be absent (from dental-imaging CIMG-001).**
  CIMG-001 said the ceph tier gate blocks "free or null" — but the code is strict `!== 'addon'`, so
  `basic` is blocked too (a test already proved it). **When a registry rule enumerates the blocked
  set, re-derive it from the operator in code** (`!== 'addon'` ⇒ everything except addon), not from
  the prose. Same class as a stale "only one analysis type exists" claim after N shipped (CIMG-010).
- **A MODULE_SPEC can list PHANTOM schema columns / wrong routes a sibling doc already fixed (from
  dental-pmd §7/§10).** API_CONTRACTS had already been reconciled to the inline-JSON reality
  (V-PMD-006), but MODULE_SPEC §7 still listed `storage_file_id`/`format_version`/`imported_pmd.branch_id`
  columns that don't exist and §10 still listed the wrong list route + multipart upload. **When two
  spec docs for a module disagree, diff BOTH against the schema/routes — don't assume the
  most-recently-edited one propagated its fix.** Re-derive the column set from `*.schema.ts` and the
  route set from `generated/openapi/routes.ts`, not from prose.
- **KG node summaries can carry a wrong domain-term EXPANSION + a phantom route (from dental-pmd).**
  The graph expanded "PMD" as "Patient medical data" (canonical is "**Portable** Medical Document",
  V-PMD-009), cited a non-existent `POST /dental/pmd/generate` (real: `POST /dental/visits/:visitId/pmd`),
  and claimed out-of-scope "recall management". **Treat KG node prose as DESCRIPTIVE-and-possibly-stale:
  verify the acronym expansion against MODULE_SPEC §2 and every cited route against the generated
  routes before trusting a summary.** Query-only — flag for next regeneration, never hand-edit the KG.
