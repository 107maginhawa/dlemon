# Global spec digest — workflow-verification sweep

Single-reference authority for the module subagents so they don't each re-read the 5 global docs.
Cites section numbers; drill into source only if disputed. Built 2026-06-08 from
IDEAL_DENTAL_MODULE_WORKFLOW_STANDARD.md, personas.md, ROLE_PERMISSION_MATRIX.md, DOMAIN_MODEL.md §6,
br-registry.json.

## 1. Scales (IDEAL §11)
- **Rating**: 🟢 Green = V1-required mostly implemented/tested/usable · 🟡 Yellow = core present, important gaps · 🟠 Orange = many core workflows/rules missing/untested · 🔴 Red = not production-ready.
- **Priority**: P0 = blocks safe V1 clinical/billing · P1 = important V1 gap, fix before prod · P2 = recommended · P3 = V2/deferred (document, don't block).

## 2. Per-module quick reference (IDEAL §3; br-registry)
| Module | Owner persona(s) | Top RBAC-negatives to drive | §4 seam(s) | DO-NOT-FIX |
|--------|-----------------|-----------------------------|-----------|-----------|
| dental-org | Alex (dentist_owner) | staff_full ❌ user-admin; hygienist ❌ admin | M1: user add → role grant → branch access | multi-branch hierarchy (V2) |
| dental-patient | Alex, Sam (front-desk) | staff_scheduling ❌ register; billing_staff ❌ update demographics | X1: register → search → open timeline | **patient merge BR-020 (Phase 2)**; portal Phase-2 reads/payments |
| dental-scheduling | Riley (staff_scheduling) | patient ❌ cancel/check-in; hygienist ❌ check-in general visits | X1→X2: book → check-in creates visit → visit active | automated SMS/email reminders |
| dental-visit | Alex, Jordan (dentist_assoc) | staff_full ❌ edit chart/treatments; staff_scheduling ❌ create visit | X2→X3: active → encounter/chart → create treatment | empty-visit auto-discard (flag-gated BR-005) |
| dental-clinical | Alex, Jordan | dental_assistant ❌ sign notes; staff_full ❌ encounter/consent | X3→X4: diagnosis → consent → treatment-plan create | specialty templates ortho/endo (V2) |
| dental-perio | Alex, Jordan, hygienist | dental_assistant ❌ create/complete chart; staff_full ❌ read perio | X3→perio: visit → create/complete chart → AAP/EFP stage | **AI voice charting** (manual UX SHIPS) |
| dental-imaging | Alex, Jordan | dental_assistant ✅ capture; staff_full ❌ delete | X3→imaging: visit → upload/link → annotate → ceph landmark | DICOM; full AI findings; **AI ceph auto-tracing** (manual ceph SHIPS) |
| dental-billing | Morgan (billing_staff) | dentist_assoc ❌ void; staff_full ❌ create invoice (✅ record payment only) | X4→X5: treatment performed → invoice → payment | **clearinghouse e-submission; ERA/EOB** |
| dental-pmd | Alex | read_only ✅ read; external PMD immutable R/O | X5→X6: visit locked → PMD immutable snapshot | — (all V1-required implemented) |
| case-presentation | treatment_coordinator | TC ❌ clinical write; ❌ billing create | X4 adjunct: plan → present → accept | — |
| dental-portal | Taylor (patient) | staff_full ❌ patient-self reads; non-patient ❌ own writes | X6→patient self-reads balance/appts/invoices | **Phase-2 reads /me/visits,/me/treatment-plans,/me/imaging; online payments** |
| provider | Pat (external) / platform | — | platform referral | platform layer, not dental-scoped |
| emr-consultation | platform layer | — | external EMR import | — |
| external-records-import | platform | — | — | **deferred Phase 2 (spec/plan only)** |
| notifications | all roles | — | post-event notifs (appt/payment/lab) | campaign/CRM automation (V2) |
| dental-audit | Alex (owner-only read) | ALL ❌ write audit; read role-limited | audit event on clinical/billing/permission change | — |
| erasure/legal-hold/retention | Alex/admin | non-admin ❌ erasure/hold | admin-only; cross-tenant scope TBD | — |

## 3. Cross-module journeys X1–X6 (IDEAL §4; DOMAIN_MODEL §5)
- **X1 Register→Search→Timeline**: patient created (DE-021) → searchable → timeline shows visits/invoices/procedures. Assert PAT-BR-001 (name + ID/contact required); demographics updatable only pre-archive (BR-015b); timeline includes all clinical events + invoices.
- **X2 Appointment→Check-in→Visit-active**: booking → check-in **creates** visit (BR-004, visitType general/hygiene) → state=active. Assert BR-SCH-001 (branch-scoped); BR-SCH-004 (working-hours except walk-in); BR-002 (no double-active visit per patient globally).
- **X3 Visit-active→Encounter+Chart**: active → encounter (ENC-BR-001) → baseline chart (CHART-BR-001) → diagnosis. Assert chief-complaint required (ENC-BR-002); medical alerts visible (ENC-BR-004); chart layers baseline/proposed/completed immutable (BR-003).
- **X4 Diagnosis→Plan→Consent**: diagnosis → plan draft → presented → approved → consent signed (BR-014/015) → treatments performable. Assert TP-BR-003 (status FSM); TP-BR-004 (approved-only→performed); consent immutable once signed; **no clinical work without consent**.
- **X5 Performed→Invoice→Payment**: treatment performed (DE-005, immutable BR-007) → invoice (BR-009 ≥1 performed) → payment (BR-012 FSM). Assert BR-006 (forward-only treatment state); BR-012 (draft→issued→paid/partial/overdue/voided); overpayment rejected (BR-015).
- **X6 Visit-locked→PMD→Patient-self**: visit completed (after 24h) → locked (job DE-003) → PMD generated (BR-021, immutable SHA-256 snapshot) → patient self-reads (V-PMD-008). Assert PMD only from completed/locked visit; checksum integrity (EF-PMD-001); patient-self scope (user.id === patient.person_id, no branch membership needed).

## 4. State machines (DOMAIN_MODEL §6)
- **SM-VISIT**: draft→active→completed→locked. Guards BR-001 (no concurrent active), BR-002 (linear), BR-003 (immutable post-completed). Downstream locks: chart/treatments immutable; perio chart locks (V-PER-007); consent + billing gates (BR-014).
- **SM-TREATMENT**: diagnosed→planned→performed→verified (↘ dismissed from any non-terminal). Guards BR-006 (forward-only), BR-007 (performed/verified field-immutable). Only performed/verified billable (BR-009); treatment→invoice item. ⚠️ single-jump diagnosed→performed is 422 (two steps).
- **SM-INVOICE**: draft→issued→paid/partial/overdue/voided/uncollectible. Guards BR-012 (linear), BR-011 (active payment-plan blocks void/uncollectible), BR-013 (uncollectible terminal). Payments valid only on issued/partial/overdue.
- **SM-CONSENT**: pending→signed/revoked (mutually exclusive terminal). BR-014 immutable once signed; signed↔revoke mutual exclusion (V-CLN-010). Blocks treatment.performed + invoicing without signed consent.
- **SM-LABORDER**: ordered→in_fabrication→delivered/cancelled. BR-018 delivered = LabOrderCompleted (DE-015).
- **SM-IMAGING-FINDING (SM-01)**: draft→confirmed→resolved.
- **SM-CEPH-LANDMARK (SM-02)**: not_placed→placed→locked (terminal, immutable CIMG-004/014).
- **SM-PERIO-CHART**: draft→complete→locked (immutable post-visit-lock V-PER-007). Min readings 16 adult / 8 primary before complete (BR-P07); one chart per visit (BR-P01); AAP/EFP 2017 staging at complete.

## 5. RBAC model (ROLE_PERMISSION_MATRIX §7; personas)
7 personas / 10 context roles:
1. **Alex** dentist_owner — full clinic + user-admin + billing + audit ✅
2. **Jordan** dentist_associate — clinical-only, own-patient billing, ❌ staff/settings
3. **Sam** staff_full — check-in/schedule/consent, **record payment ✅**, ❌ clinical edit, ❌ invoice create/void, ❌ admin
4. **Riley** staff_scheduling — appointments + public booking, ❌ clinical/billing create, ❌ check-in
5. **Morgan** billing_staff — invoices/payments, ❌ clinical write
6. **Taylor** patient (no membership) — self-appt book, self-balance read, self-invoices; Phase-2 payments deferred
7. **Pat** external provider — API key, referral, limited read
8. **hygienist** — hygiene-typed visits create/sign ✅, perio full-stack ✅, ❌ general visit
9. **dental_assistant** — single-tooth chart upsert ✅, imaging capture ✅, draft notes ✅, ❌ sign, ❌ treatments
10. **treatment_coordinator** — case-presentation create ✅, ❌ clinical write, ❌ billing create

Billing writes: owner ✅ create/void/write-off · associate ✅ create(own-patient)+record payment · staff_full ✅ **record payment only** (❌ create/void, corrected 2026-05-30) · others ❌.

## 6. Global DO-NOT-FIX / deferred (IDEAL §3.14, §12) — report only, never build
Patient-portal **Phase-2** reads (/me/visits, /me/treatment-plans, /me/imaging) + **online payments**; electronic **clearinghouse submission** + ERA/EOB; full **conflict-resolution UI**; **external EMR import**; **patient-merge action (BR-020)**; full **CRDT/P2P sync** (cadence stub); ortho case mgmt; supplier inventory mgmt; GL accounting; full DICOM; CRM campaigns; **AI voice charting**; **AI ceph auto-tracing**.
**Shipped (don't mistake for missing)**: perio charting full-stack (grid + multi-exam compare + E2E); ceph workspace v1.4 (landmarking, 6 analyses, superimposition, manual UX); basic inventory; sync metadata + offline create.

## 7. br-registry buckets (counts; drill into specs/api/docs/standards/br-registry.json)
dental-visit 10 · dental-scheduling 7 · dental-billing 13 (incl EM-BIL-001/002) · dental-clinical 7 · dental-org 2 (BR-016/016b) · dental-patient 7 (incl BR-020 merge) · dental-pmd 7 · dental-perio 8 · dental-imaging 25 (BR-023–038, CIMG-001–015). audit/portal/emr/erasure/external-records/provider buckets are thin/platform.

## 8. Critical cross-tenant / security gates (verify these as RBAC-negatives where {M} owns them)
Principle: every handler calls `assertBranchAccess` (BR-016); caller-supplied `branchId` is NEVER an auth boundary — derive branch from the resource.
- **EM-BIL-002** (billing): 5 reports (AR aging, collections, payer aging, claims, statement batch) — omitting `branchId` must scope to caller's active branches, NOT unfiltered org (money+PHI leak otherwise). **billing is structurally unique here.**
- **V-PAT-002 / V-VIS-011**: treatment-plan read/version gate on the PATIENT's preferredBranchId, not the caller's branchId param.
- **CIMG-007**: non-member ceph request → 404 (not 403) to avoid leaking branch existence.
- **V-PMD-008**: PMD read allows patient-self (user.id === patient.person_id) without branch membership; all other readers require membership.

## 9. Validation / rounding standards
Money (BR-015): discount 0–100%, installments 2–24, payment ≥1¢. Perio depths (BR-P03): 0–20mm; recession −5..20mm. FDI teeth (BR-P04): quadrant-valid (adult 11-18/21-28/31-38/41-48; primary 51-55/61-65/71-75/81-85). Tax (BR-010): always 0, prices pre-tax, per-country tax Phase 2. Ceph report (CIMG-006): requires A, B, Go, Po all confirmed.

## 10. Audit + local-first
Audit: every clinical/billing/permission change → `logAuditEvent()` (owner-only read); synchronous DB write, no async bus (ADR-006). Local-first: local-ID create ✅, sync-status UI ✅, local→server-ID reconciliation ✅, unsynced-state preserved ✅; human conflict-resolution UI ❌ (deferred).
