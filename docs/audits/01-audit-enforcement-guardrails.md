
# Audit Enforcement Guardrails

## Purpose

This file defines the enforcement rules every dental audit pass must follow.

No audit pass is valid unless it applies these guardrails.

---

## Core Rule

Do not issue broad audit conclusions until you have proven what was audited.

The audit must distinguish between:

- `AUDITED`
- `PARTIALLY_AUDITED`
- `NOT_AUDITED`
- `NOT_FOUND`
- `NOT_APPLICABLE`

---

## Required Coverage Manifest

Create or update:

`docs/audits/AUDIT_COVERAGE_MANIFEST.md`

This file must include the following sections:

```md
# Audit Coverage Manifest

## Audit Run Metadata

- Date:
- Auditor:
- Repo/branch:
- Commit hash if available:
- Audit scope:
- Resume from previous run: yes/no

## Source Artifacts Inventory

| Artifact | Path | Exists | Audited | Notes |
|---|---|---:|---:|---|

## Backend Inventory

| Module | Path | Routes | Services | Repos | Schemas | Tests | Status | Notes |
|---|---|---:|---:|---:|---:|---:|---|---|

## Frontend Inventory

| Area | Path | Routes | Components | Hooks | Tests | Status | Notes |
|---|---|---:|---:|---:|---:|---|---|

## Spec Inventory

| Module | MODULE_SPEC | API_CONTRACTS | UI_BLUEPRINT | SLICE_SPEC | TDD_PROOF | Status |
|---|---:|---:|---:|---:|---:|---|

## Workflow Inventory

| Workflow | Backend Audited | Frontend Audited | Tests Audited | Status | Notes |
|---|---:|---:|---:|---|---|

## Audit Pass Completion

| Pass | Status | Audited Areas | Partial Areas | Not Audited Areas | Notes |
|---|---|---:|---:|---:|---|

## Coverage Score

- Backend modules audited:
- Frontend areas audited:
- Specs audited:
- Tests audited:
- Workflows audited:
- TDD proofs audited:
