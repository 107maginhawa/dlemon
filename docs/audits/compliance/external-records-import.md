# Compliance Audit — external-records-import

---
Audit Date: 2026-05-30
Dimension: compliance (oli-check)
Scope: external-records-import (single module)
Spec Version: 1.2 (Last Updated 2026-05-29)
Verdict: SKIP — module is unimplemented by design (future_phase, Phase 3+)
---

## Verdict Summary

**SKIP.** This module has **no implementation code to audit**. The spec
(`docs/product/modules/external-records-import/MODULE_SPEC.md`) explicitly declares
`implementation_status: future_phase (Phase 3+)` and instructs (Section 20, AI
Instruction #3): *"This is a FUTURE PHASE module. Do not implement handler files
until explicitly scheduled."* The absence of code is therefore **spec-compliant and
intentional**, not a violation.

Per the compliance dimension stop condition — *"No source code found at
detected/specified path → STOP, no code to audit against specs"* — this audit
produces zero code-vs-spec violations (P0=P1=P2=P3=0). It is reported as SKIP
rather than PASS because no code was exercised.

## Audit Scope

| Artifact | Available | Steps Executed |
|----------|-----------|----------------|
| MODULE_SPEC.md | ✓ | Spec completeness pre-check only |
| API_CONTRACTS.md (module-local) | ✓ | Read; no code to compare against |
| ui-prototype/ | ✓ (dir present) | Not audited (no backend to bind) |
| Handler source | ✗ (dir absent) | Steps 3-10 SKIPPED — no code |
| DOMAIN_GLOSSARY / DOMAIN_MODEL | n/a | Step 6 not run (no code) |

## Ground-Truth Verification (knowledge graph)

Structural ground truth from `docs/audits/codebase-map/` confirms non-existence:

- **CODE_MODULE_MAP.json** (version 3): enumerates 23 modules. None is
  `external-records-import`, `emr-import`, or maps to namespace `/dental/emr-import`.
- The `emr` module present in the map (`services/api-ts/src/handlers/emr`, 9 files,
  confidence LOW) is the **disclaimed** telemedicine consultation-notes module on
  namespace `/emr` — explicitly NOT this module per the spec's Section 0 Naming Note.
- Filesystem checks (`ls`, `test -d`) confirm
  `services/api-ts/src/handlers/external-records-import/` **does not exist**
  (HANDLER_DIR_MISSING, confirmed twice).
- No source references to `/dental/emr-import`, `emr_record`, or `emrRecord`
  outside `src/generated/` were found in `services/api-ts/src` or
  `apps/dentalemon/src`.

## Spec Completeness Pre-Check

The spec is well-formed and auditable **once implemented**. For the future audit,
note these spec contents that will define the compliance contract:

- **Business Rules (Section 5):** read-only after import; no auto-merge; source
  system identifier required for audit trail; patient referenced by UUID with no DB FK.
- **Permissions (Section 6):** Import = dentist_owner, dentist_associate; View = all
  dental roles; Delete = dentist_owner only.
- **State machine (Section 8):** `imported` is terminal — no transitions; PATCH/DELETE
  of imported records must return 405 (AC-EMR-001).
- **API (Section 10):** `POST /dental/emr-import`, `GET /dental/emr-import/:patientId`,
  `GET /dental/emr-import/:id`. No PATCH/DELETE routes (AI Instruction #2).
- **Acceptance Criteria:** AC-EMR-001 (PATCH/DELETE → 405), AC-EMR-002 (import creates
  read-only record; editable records unchanged), AC-EMR-003 (missing source_system → 422).
- **Aggregate (Section 7b):** EMRRecord is an aggregate root, loose-coupled to Patient
  by UUID (no FK to `dental_patient`).

No spec gaps block a future audit — all required sections (5, 6, 8, 10, 11) are populated.

## Violations

None. No implementation exists, so no code can violate the spec.

| Severity | Count |
|----------|-------|
| P0 | 0 |
| P1 | 0 |
| P2 | 0 |
| P3 | 0 |

## Recommendation

No action required. Re-run this compliance audit when the module is scheduled and a
handler directory is created (per Section 19 Vertical Slice Plan: EMR-S1 Import +
read-only store, EMR-S2 View + patient link — gated behind stability of dental-visit,
dental-clinical, and dental-pmd). At that point, focus on: 405 enforcement for
PATCH/DELETE (AC-EMR-001), 422 on missing `source_system` (AC-EMR-003), the
dentist_owner-only delete guard (Section 6), and `assertBranchAccess` from dental-org
on all three routes.
