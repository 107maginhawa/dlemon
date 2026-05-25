# Dental Spec Backfill Tasks

Generated: 2026-05-25 | Run: 001

These tasks create or complete missing OLI specification artifacts. They do not change behavior but improve traceability, auditability, and future development quality.

---

## SBT-001 — Create MASTER_PRD.md

**Gap ref:** Implied by OLI Phase A requirements  
**Priority:** P2  
**Artifact type:** Phase A  

**Description:**  
No master PRD exists at `docs/product/MASTER_PRD.md`. The product scope is reconstructible from module specs and code, but the absence of a single authoritative PRD document means:
- New team members cannot understand the full product scope in one document
- PRD-driven auditing (PRD_AUDIT_REPORT) cannot be run
- Future milestone planning lacks a clear scope baseline

**Task:**  
Create `docs/product/MASTER_PRD.md` by synthesizing:
1. All 11 module specs (dental-org, dental-patient, dental-visit, dental-clinical, dental-billing, dental-scheduling, dental-perio, dental-imaging, dental-pmd, dental-emr, dental-audit)
2. Confirmed workflows (WF-001 through WF-013)
3. Core product identity: iPad-first dental management system, timeline carousel as core UX, multi-branch orgs, clinical safety focus

Minimum sections:
- Product vision and target users
- Module inventory with status (implemented / planned / future)
- Workflow inventory
- Out of scope (local-first sync — future phase; hospital-grade enterprise — out of scope)

---

## SBT-002 — Create WORKFLOW_MAP.md

**Gap ref:** Implied by OLI Phase A requirements  
**Priority:** P2  
**Artifact type:** Phase A  

**Description:**  
No `docs/product/WORKFLOW_MAP.md` found. The 14 dental clinic workflows (WF-001 through WF-014) were reconstructed during this audit from code, but no authoritative workflow map document exists.

**Task:**  
Create `docs/product/WORKFLOW_MAP.md` with:
- Each workflow (WF-001 through WF-014) as a section
- Per workflow: actor(s), preconditions, steps, postconditions, failure modes, relevant module(s), backend route(s), frontend route(s)
- Cross-module transition points highlighted (e.g., WF-007 treatment plan → WF-012 billing)

---

## SBT-003 — Create ROLE_PERMISSION_MATRIX.md

**Gap ref:** Implied by OLI Phase A requirements; WF-002 auth/role audit  
**Priority:** P2  
**Artifact type:** Phase A  

**Description:**  
No `docs/product/ROLE_PERMISSION_MATRIX.md` found. RBAC is enforced via `assert-branch-role.ts` and `assert-branch-access.ts`, but the full role/action matrix is not documented.

Known roles from code: `dentist_owner`, `dentist_associate`, `staff_full`, `staff_scheduling`, `staff_billing`, `admin`.

**Task:**  
Create `docs/product/ROLE_PERMISSION_MATRIX.md` with:
- Rows: all dental actions (create visit, sign note, create invoice, view audit logs, manage members, etc.)
- Columns: all roles
- Cells: ALLOW / DENY / CONDITIONAL (e.g., same branch only)
- Derive from `assert-branch-role.ts` call sites in each handler

---

## SBT-004 — Create G1 Phase Artifacts

**Gap ref:** GAP-DENTAL-011  
**Priority:** P2  
**Artifact type:** Phase C execution  

**Description:**  
G1 foundation-stabilization phase has only `G1-RESEARCH.md`. Need CONTEXT.md and PLAN.md before executing G1 slices.

**Task:**  
Create `.planning/phases/G1-foundation-stabilization/G1-CONTEXT.md`:
- Phase goal (from RESEARCH.md executive summary)
- Slices to execute (e.g., G1-S1: assertBranchAccess + MemberRole)
- File manifest: which files each slice touches
- Verification commands: which tests must pass after each slice
- Test baseline: current test count before G1

Create `.planning/phases/G1-foundation-stabilization/G1-PLAN.md`:
- Ordered task list with specific file changes
- Dependencies between tasks
- Definition of done

---

## SBT-005 — Create SLICE_SPEC.md + TDD_PROOF.md for G1 Slices

**Gap ref:** GAP-DENTAL-005  
**Priority:** P2  
**Artifact type:** Phase C / oli-execution-gate  

**Description:**  
The oli-execution-gate.md format requires SLICE_SPEC.md and TDD_PROOF.md per slice. These do not exist for any previously executed phase. Going forward, all G1+ slices need them.

**Task:**  
For each G1 slice (at minimum G1-S1 from the research doc: assertBranchAccess + MemberRole):

Create `docs/execution/slices/g1-s1-branch-access-rbac/SLICE_SPEC.md`:
```yaml
---
slice: g1-s1-branch-access-rbac
phase: G1
modules: [dental-org, shared]
agent_skills: [skills/oli-execution-gate]
---

## Acceptance Criteria

AC-001: assertBranchAccess returns 403 for a member not in the specified branch
AC-002: assertBranchRole returns 403 for a member with insufficient role
AC-003: getBranchesByUser returns only branches the authenticated user is a member of
...
```

Create `docs/execution/slices/g1-s1-branch-access-rbac/TDD_PROOF.md`:
- Context loaded section
- Spec items table with RED output and GREEN evidence
- Coverage summary
- Verification commands

---

## SBT-006 — Backfill dental-emr MODULE_SPEC with Concrete Workflows

**Gap ref:** GAP-DENTAL-007, GAP-DENTAL-010  
**Priority:** P2  
**Artifact type:** Phase B module spec  

**Description:**  
`docs/product/modules/dental-emr/MODULE_SPEC.md` has only INFERRED workflows (WF-100, WF-101). Before this module can be scheduled for implementation, it needs:
- Concrete business rules
- Concrete acceptance criteria
- Defined entities (if separate from dental-visit)
- Role/permission requirements
- Decision on boundary vs dental-visit

**Task:**  
Schedule a spec session to decide:
1. Is `dental-emr` the product name for the dental-visit module? → Rename/align
2. Or is dental-emr a separate module for importing external EMR records (e.g., from another practice's EHR system)?

If (2): write concrete MODULE_SPEC with:
- WF-100: Import external EMR record from file (CSV/HL7/FHIR)
- WF-101: View imported record alongside native dental record
- Data model: ExternalEMRRecord entity
- Integration: link to DentalPatient

---

## SBT-007 — Add PRD_AUDIT_REPORT.md

**Gap ref:** Implied by OLI Phase A  
**Priority:** P3  
**Artifact type:** Phase A gate  

**Description:**  
The OLI pipeline expects a `PRD_AUDIT_REPORT.md` after the MASTER_PRD is written, confirming scope, risk flags, and open questions before module spec work begins.

**Task:**  
After SBT-001 (MASTER_PRD.md) is complete, create `docs/product/PRD_AUDIT_REPORT.md` using the `/oli-prd-audit` skill or manually reviewing:
- Scope conflicts
- Missing business rules
- Ambiguous requirements
- Missing actors
- Clinical safety considerations not captured

---

## SBT-008 — Align dental-perio MODULE_SPEC with Backend Implementation

**Gap ref:** GAP-DENTAL-008  
**Priority:** P3  
**Artifact type:** Phase B module spec  

**Description:**  
dental-perio has a MODULE_SPEC and API_CONTRACTS but its test coverage is weak. This suggests the spec may have items that are unverified. After TASK-DENTAL-P2-001 (add handler tests), review the module spec to confirm all AC/BR items are tested.

**Task:**  
1. After adding dental-perio handler tests
2. Read `docs/product/modules/dental-perio/MODULE_SPEC.md` sections 5 and 11 (business rules + AC)
3. For each AC/BR, find the corresponding test or mark as UNCOVERED
4. Create `docs/execution/slices/dental-perio-coverage/SLICE_SPEC.md` mapping AC → tests
5. Mark all COVERED items in the slice spec

---

---

## SBT-009 — Create dental-ceph MODULE_SPEC

**Gap ref:** GAP-DENTAL-019  
**Priority:** P2  
**Artifact type:** New module spec  

**Description:**  
After TASK-DENTAL-P2-008 (move CephMgmt handlers to dental-ceph/), create a full MODULE_SPEC for the new dental-ceph module.

**Task:**  
1. Create `docs/product/modules/dental-ceph/MODULE_SPEC.md`
2. Move WF-030 (Run Ceph Analysis) and WF-031 (Place/Adjust Ceph Landmarks) from dental-imaging MODULE_SPEC into dental-ceph MODULE_SPEC
3. Set: module ID = dental-ceph, domain = Clinical Imaging (advanced), depends on = dental-imaging, dental-org
4. Document: CBCT tier requirement (imagingTier = cbct), landmark FSM, ceph analysis FSM
5. Update dental-imaging MODULE_SPEC §3 Workflows: remove WF-030 and WF-031; add "see dental-ceph for cephalometric analysis"

---

## SBT-010 — Scope dental-emr as external EMR integration (future phase)

**Gap ref:** GAP-DENTAL-020  
**Priority:** P2  
**Artifact type:** Module spec update  

**Description:**  
dental-emr MODULE_SPEC has INFERRED-only workflows. It must be updated to declare its concrete purpose (external EMR bridge) and implementation status (future phase).

**Task:**  
1. Update `docs/product/modules/dental-emr/MODULE_SPEC.md` §1 Overview: purpose = "External EMR data import bridge from third-party practice management systems (Open Dental, Dentrix, Eaglesoft). Not an alias for dental-visit."
2. Add header field `implementation_status: future_phase` (Phase 3+)
3. Replace INFERRED workflows with concrete stub workflows: import-patient-record, import-treatment-history
4. Update `docs/product/MODULE_MAP.md` entry for dental-emr with note pointing to dental-visit as the active EMR

---

## SBT-011 — Add dental-pmd §7.1 Data Scope and §7.2 Import Contract

**Gap ref:** GAP-DENTAL-023  
**Priority:** P2  
**Artifact type:** Module spec update  

**Description:**  
generatePMD aggregates data from 5+ modules. The spec must document what data is included, from which modules, and what the import-side FK isolation contract is.

**Task:**  
1. Read `handlers/dental-pmd/generatePMD.ts` to extract actual data scope
2. Add §7.1 Data Scope Table to `docs/product/modules/dental-pmd/MODULE_SPEC.md`: columns = Source Module | Fields Included | Rationale
3. Add §7.2 Import Contract: define that importedPMD rows use UUID refs only; no FK joins to local dental tables; no PATCH/PUT/DELETE on imported rows; read-only after import

---

## Summary

| SBT ID | Artifact | Priority | Type | Effort |
|---|---|---|---|---|
| SBT-001 | MASTER_PRD.md | P2 | Create | Medium |
| SBT-002 | WORKFLOW_MAP.md | P2 | Create | Medium |
| SBT-003 | ROLE_PERMISSION_MATRIX.md | P2 | Create | Small |
| SBT-004 | G1 CONTEXT.md + PLAN.md | P2 | Create | Small |
| SBT-005 | SLICE_SPEC.md + TDD_PROOF.md for G1 slices | P2 | Create | Medium |
| SBT-006 | dental-emr concrete MODULE_SPEC | P2 | Update | Small |
| SBT-007 | PRD_AUDIT_REPORT.md | P3 | Create | Small |
| SBT-008 | dental-perio spec-to-test alignment | P3 | Update | Small |
| SBT-009 | dental-ceph MODULE_SPEC (new module) | P2 | Create | Small |
| SBT-010 | dental-emr scoped as future phase | P2 | Update | Small |
| SBT-011 | dental-pmd §7.1 data scope + §7.2 import contract | P2 | Update | Small |
