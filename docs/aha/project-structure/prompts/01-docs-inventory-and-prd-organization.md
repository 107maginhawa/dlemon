# 01 — Docs Inventory and PRD Organization

You are auditing the `/docs` folder of a large software codebase.

Your goal is to organize documentation safely, identify PRD/product-requirement files, propose a cleaner structure, and prevent broken references.

This is an **inventory and planning prompt only**.

Do not move, delete, rename, archive, or rewrite existing files yet.

---

## 1. Scope

Audit:

`[CODEBASE_ROOT]/docs/`

Also search the rest of the codebase for references to docs files, including:

* Markdown links
* README links
* `/docs/...` references
* relative links
* prompt references
* audit references
* package scripts
* CI/workflow references
* test references
* code comments that point to docs
* scripts that read from docs

---

## 2. AHA Output Location

All outputs from this prompt must be placed under:

`[CODEBASE_ROOT]/docs/aha/project-structure/`

Create these folders if missing:

```text
[CODEBASE_ROOT]/docs/aha/project-structure/outputs/
[CODEBASE_ROOT]/docs/aha/project-structure/migration-plans/
```

Do not place this audit’s output files directly under `/docs`.

---

## 3. Safety Rules

Follow these strictly:

1. Inventory first.
2. Do not delete files.
3. Do not move files.
4. Do not rename files.
5. Do not archive files yet.
6. Do not rewrite existing docs.
7. Do not merge documents.
8. If uncertain, mark the file as `[NEEDS REVIEW]`.
9. Before recommending a move, check whether the file is referenced elsewhere.
10. Do not mix PRDs, audit outputs, engineering notes, and AI prompt files.
11. Preserve existing specialized structures such as `docs/aha/` if present.
12. Do not treat AHA audit files as product PRDs unless explicitly stated inside the file.

---

## 4. Classify All Docs

Classify every file under `/docs` into one primary category.

Use these categories:

### Product / Requirements

Examples:

* PRD
* product requirements
* feature requirements
* user stories
* acceptance criteria
* business rules
* workflows
* roadmap
* module requirements

Suggested folder:

`docs/product/`

PRD-specific folder:

`docs/product/prd/`

---

### Architecture

Examples:

* system architecture
* module architecture
* data architecture
* ADRs
* technical design
* integration design
* security architecture

Suggested folder:

`docs/architecture/`

---

### Engineering

Examples:

* setup guides
* development guides
* testing guides
* deployment guides
* coding standards
* database notes
* CI/CD notes
* troubleshooting

Suggested folder:

`docs/engineering/`

---

### API / Integrations

Examples:

* API references
* webhook docs
* HL7/FHIR docs
* payload examples
* external integration guides

Suggested folder:

`docs/api/` or `docs/integrations/`

Use the repo’s existing convention if already present.

---

### Audit / AHA / AI Prompting

Examples:

* audit prompts
* audit outputs
* gap plans
* fix plans
* evidence logs
* AI execution prompts
* TDD audit outputs
* AHA files

Suggested folder:

Keep the existing audit structure if already present.

Especially preserve:

`docs/aha/`

Do not move AHA files into PRD folders.

---

### Runbooks / Operations

Examples:

* production runbooks
* support procedures
* backup/restore
* incident response
* release procedures

Suggested folder:

`docs/runbooks/`

---

### Archive Candidates

Examples:

* superseded docs
* deprecated plans
* old drafts
* duplicate documents
* outdated PRDs
* temporary AI outputs
* historical notes

Suggested folder:

`docs/archive/`

Do not archive yet. Only recommend.

---

## 5. PRD Detection Rules

Identify all PRD-related files.

A file may be PRD-related if its filename or content includes:

* PRD
* Product Requirements
* Requirements Document
* Feature Requirements
* User Stories
* Acceptance Criteria
* Product Spec
* Functional Spec
* Business Rules
* Workflow Requirements
* Module Requirements
* MVP Scope
* V1 Scope
* Product Plan
* Feature Brief

Do not assume every “spec” is a PRD.

Classify PRD-related files as:

### 1. Canonical PRD

Current main PRD for a module or feature.

Suggested target:

`docs/product/prd/active/`

---

### 2. Historical PRD

Old or superseded PRD.

Suggested target:

`docs/product/prd/historical/`

---

### 3. Supporting Requirement

User stories, workflows, acceptance criteria, or business rules.

Suggested target:

`docs/product/requirements/`

---

### 4. Engineering Spec

Technical implementation, architecture, API, or code-level design.

Should not go under PRD unless clearly product-facing.

Suggested target:

`docs/architecture/`, `docs/engineering/`, `docs/api/`, or `docs/integrations/`

---

### 5. Audit-Derived Requirement

Requirement discovered from an audit.

Should remain in audit/AHA folders unless explicitly promoted into a canonical PRD.

Suggested target:

Keep in its existing audit/AHA folder.

---

## 6. Required Output Files

Create:

`[CODEBASE_ROOT]/docs/aha/project-structure/outputs/DOCS_INVENTORY.md`

Use this format:

```md
# Documentation Inventory

## Summary

- Total files scanned:
- Markdown files:
- Non-markdown files:
- PRD-related files:
- Architecture files:
- Engineering files:
- API/integration files:
- Audit/prompt files:
- Archive candidates:
- Duplicate candidates:
- Broken reference risks:

## Current Docs Observations

Summarize:
- folder structure issues
- misplaced files
- duplicate documents
- outdated files
- PRD fragmentation
- audit/prompt clutter
- link/reference risks

## File Classification

| Current Path | Category | Confidence | Referenced By | Suggested Action |
|---|---|---:|---|---|

## PRD Candidates

| Current Path | PRD Type | Confidence | Suggested Target | Notes |
|---|---|---:|---|---|

## Archive Candidates

| Current Path | Reason | Safe to Archive Later? | References Found |
|---|---|---|---|

## Duplicate / Near-Duplicate Candidates

| File A | File B | Similarity Reason | Suggested Canonical |
|---|---|---|---|

## Do Not Move Yet

| Current Path | Reason |
|---|---|
```

Also create:

`[CODEBASE_ROOT]/docs/aha/project-structure/migration-plans/DOCS_MIGRATION_PLAN.md`

Use this format:

```md
# Documentation Migration Plan

## Proposed Docs Folder Structure

Show the recommended `/docs` structure.

## File Move Map

| Current Path | Proposed Path | Reason | Risk |
|---|---|---|---|

## Files Proposed for Archive

| Current Path | Archive Path | Reason |
|---|---|---|

## Files Proposed to Keep In Place

| Current Path | Reason |
|---|---|

## PRD Organization Plan

| Current File | PRD Classification | Proposed Path | Reason |
|---|---|---|---|

## References That Must Be Updated Later

| Referencing File | Old Reference | New Reference | Risk |
|---|---|---|---|

## Validation Checklist for Execution Phase

- [ ] Markdown links checked
- [ ] Codebase references checked
- [ ] README links checked
- [ ] Prompt file references checked
- [ ] CI/script references checked
- [ ] PRD index ready
- [ ] Archive index ready
```

Also create:

`[CODEBASE_ROOT]/docs/aha/project-structure/outputs/PRD_INDEX_DRAFT.md`

Use this format:

```md
# PRD Index Draft

## Active PRD Candidates

| Module / Feature | Current File | Suggested Canonical Path | Confidence | Notes |
|---|---|---|---:|---|

## Historical PRD Candidates

| Module / Feature | Current File | Suggested Historical Path | Reason | Notes |
|---|---|---|---|---|

## Supporting Requirement Files

| Area | Current File | Type | Suggested Path | Notes |
|---|---|---|---|---|

## Engineering Specs Mistaken for PRDs

| File | Reason Not PRD | Suggested Category |
|---|---|---|

## Needs Review

| File | Reason | Suggested Action |
|---|---|---|
```

---

## 7. Recommended Docs Structure

Use this only as a guide.

Do not force this structure if the repo already has a clean convention.

```text
docs/
├── README.md
├── INDEX.md
├── product/
│   ├── prd/
│   │   ├── active/
│   │   └── historical/
│   ├── requirements/
│   └── roadmap/
├── architecture/
│   ├── decisions/
│   ├── system-overview/
│   └── module-architecture/
├── engineering/
│   ├── setup/
│   ├── testing/
│   ├── deployment/
│   └── standards/
├── api/
├── integrations/
├── runbooks/
├── aha/
│   ├── prompts/
│   ├── outputs/
│   ├── module-gap-plans/
│   ├── module-fix-plans/
│   ├── evidence/
│   └── project-structure/
└── archive/
    ├── deprecated/
    ├── duplicates/
    ├── superseded/
    └── old-ai-drafts/
```

Important:

The files created by this prompt belong under:

`docs/aha/project-structure/`

But the proposed final organized docs may still belong under canonical folders such as:

* `docs/product/`
* `docs/architecture/`
* `docs/engineering/`
* `docs/api/`
* `docs/integrations/`
* `docs/runbooks/`
* `docs/archive/`

Do not confuse AHA audit output location with final documentation destination.

---

## 8. Final Response Required

At the end, summarize:

1. What is currently wrong or risky in `/docs`
2. What PRD files were found
3. What should become canonical PRDs
4. What should be archived later
5. What should not be moved yet
6. Whether it is safe to proceed to execution later

Do not execute the migration.

Stop after producing:

* `docs/aha/project-structure/outputs/DOCS_INVENTORY.md`
* `docs/aha/project-structure/migration-plans/DOCS_MIGRATION_PLAN.md`
* `docs/aha/project-structure/outputs/PRD_INDEX_DRAFT.md`
