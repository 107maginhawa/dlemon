---
name: audit-compliance
description: "Verify codebase compliance against specs — P0-P3 violations, stabilization plan, health score, spec gap detection. The policeman."
argument-hint: "[--module <name>] [--all] [--category rules|permissions|terms|errors|tests|api] [--fix] [--strict] [--auto]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
---

<objective>
Check whether implemented code matches written specs. Finds drift, missing enforcement, untested criteria, wrong terminology, and permission gaps. Produces prioritized compliance report with stabilization guidance.

**Read-only by default.** Documents violations first, recommends fixes second.

**Requires:** Specs must exist (from `/prd-audit` → `/module-specs` workflow or equivalent). If no specs found, suggests running `/audit-codebase` instead.

**What it checks (8 categories):**
1. **Business rules** — every BR-NNN in specs has corresponding enforcement in code
2. **Acceptance criteria** — every AC-NNN has a matching test (existence, not execution)
3. **Permissions** — role permission matrix matches actual middleware/guards/checks
4. **Domain terminology** — glossary terms used consistently in code
5. **Error contracts** — error response shapes match spec definitions; missing contracts flagged as spec gaps
6. **API contracts** — endpoints match spec expectations
7. **State transitions** — only valid transitions allowed in code
8. **Data validation** — required fields, validation rules enforced

**Also detects:**
- **Spec gaps** — where specs are incomplete (missing sections, empty rules). These are NOT code violations.
- **Unauditable items** — things that require runtime/manual verification

**Flags:**
- `--module <name>` — audit one module only
- `--all` — audit all modules
- `--category rules|permissions|terms|errors|tests|api` — audit specific category only
- `--fix` — suggest code fixes for each violation
- `--strict` — exit with error code if any P0 violations found

**Output:** `docs/audits/COMPLIANCE_REPORT.md` — includes executive summary, per-module violations with P0-P3 severity, spec gaps, stabilization plan, and health score
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/audit-compliance.md
</execution_context>

<context>
Arguments: $ARGUMENTS

Parse $ARGUMENTS:
- `--module <name>`: audit single module (slug format)
- `--all`: audit every module with a MODULE_SPEC.md
- `--category <cat>`: limit to one audit category
- `--fix`: include suggested code fixes
- `--strict`: non-zero exit on P0 violations

If no module flag: auto-detect modules from `docs/product/modules/*/MODULE_SPEC.md`
If no modules found: error — suggest `/audit-codebase` for projects without specs

Required spec artifacts:
- `docs/product/modules/{name}/MODULE_SPEC.md` — per-module specs
- Domain glossary — `docs/product/DOMAIN_GLOSSARY.md` or Domain Glossary section in MASTER_PRD.md
- Role permission matrix — `docs/product/ROLE_PERMISSION_MATRIX.md` or Role/Permission section in MASTER_PRD.md

Optional:
- `docs/prd/v3-dentalemon.md` — canonical PRD, cross-module rules (companions: `docs/prd/BUSINESS_RULES.md`, `docs/prd/ACCEPTANCE_CRITERIA.md`)
- `docs/execution/VERTICAL_SLICE_PLAN.md` — slice completion status
- `ARCHITECTURE.md` — pattern expectations
</context>

<process>
Execute the audit-compliance workflow from the execution_context file end-to-end.
Process one module at a time. Report violations with file paths and line references.
</process>

<success_criteria>
- All target modules audited against their specs
- Spec completeness pre-checked — gaps flagged separately from code violations
- Every BR-NNN checked for code enforcement with P0-P3 severity
- Every AC-NNN checked for test existence with P0-P3 severity
- Permission matrix cross-referenced with actual auth checks
- Domain terms checked for consistency in code
- Error response shapes validated; missing contracts flagged as spec gaps
- API endpoints matched against spec
- State transitions validated
- Compliance report generated at docs/audits/COMPLIANCE_REPORT.md
- Executive summary with top 3 risks
- Stabilization plan: fix now (P0) / fix before new work (P1) / fix when touching (P2) / track (P3)
- Health score computed across 8 dimensions (0-10 each)
- "What's next" routing: fix violations → re-run, or proceed with development
- If --fix: concrete code suggestions for each violation
- If --strict: exits with error if any P0 violations
</success_criteria>
