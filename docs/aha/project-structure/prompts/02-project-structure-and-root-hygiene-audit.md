# 02 — Project Structure and Root Hygiene Audit

You are auditing the overall project folder structure and root-level files of a large software codebase.

Your goal is to make the repository easier to understand, safer for developers, cleaner for AI agents, and more aligned with common software engineering conventions.

This is an **inventory and migration-planning prompt only**.

Do not move, delete, rename, archive, or rewrite existing files yet.

---

## 1. Scope

Audit the full project structure starting from:

`[CODEBASE_ROOT]/`

Focus especially on:

* root-level files
* root-level folders
* `.github/`
* `apps/`
* `packages/`
* `modules/`
* `docs/`
* `scripts/`
* `tools/`
* `tests/`
* `infra/`
* config files
* build/test/lint scripts
* AI prompt/instruction files
* temporary files
* duplicated files
* generated files committed by mistake
* misplaced documentation outside `/docs`

Also search for references before recommending any move.

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

## 3. Important Rule

Do not restructure the application architecture.

This prompt is not for:

* moving domain modules into new boundaries
* changing imports
* refactoring services
* changing package ownership
* renaming source folders for style only
* converting architecture patterns
* changing framework conventions
* changing business logic
* changing database schema
* changing runtime behavior

This prompt is only for:

* root hygiene
* misplaced files
* duplicate files
* temporary files
* stale files
* documentation placement
* script/tool placement
* infrastructure placement
* repo convention cleanup
* migration planning

---

## 4. Root File Rules

The root should contain only files that are repo-wide entry points, repo-wide configuration, or contributor-facing instructions.

Root may contain:

### Repository Entry Files

* `README.md`
* `CONTRIBUTING.md`
* `SECURITY.md`
* `CHANGELOG.md`
* `LICENSE`, if applicable
* `CODE_OF_CONDUCT.md`, if applicable

### Package / Workspace Config

* `package.json`
* `pnpm-workspace.yaml`
* `yarn.lock`, `package-lock.json`, or `pnpm-lock.yaml`
* `turbo.json`, if used
* `nx.json`, if used
* `tsconfig.json`
* `tsconfig.base.json`

### Tooling Config

* `eslint.config.js`
* `.eslintrc.*`, if used
* `prettier.config.js`
* `.prettierrc`, if used
* `.editorconfig`
* `.gitignore`
* `.dockerignore`
* `.env.example`
* `docker-compose.yml`, if used for local development

### AI / Developer Instruction Files

* `AGENTS.md`
* `CLAUDE.md`
* `.cursor/`
* `.windsurf/`
* other intentional AI agent instruction files

### CI / Community Files

* `.github/`
* `CODEOWNERS`
* issue templates
* PR templates

Anything else should be classified for possible relocation.

---

## 5. Folder Classification Rules

Classify root folders using these categories.

### `apps/`

Deployable applications.

Examples:

* web app
* API server
* admin portal
* worker app
* mobile app
* desktop app

---

### `packages/`

Shared libraries used by multiple apps or modules.

Examples:

* UI package
* DB package
* shared types
* config package
* test utilities
* SDKs
* math engines

---

### `modules/`

Business/domain modules.

Examples:

* patient
* visit
* billing
* scheduling
* dental
* pharmacy
* laboratory
* imaging

Only recommend this if the repo already follows a domain-module convention.

---

### `docs/`

Documentation.

Examples:

* product docs
* PRDs
* architecture
* engineering guides
* API docs
* audit prompts
* audit outputs

---

### `scripts/`

Repeatable project automation.

Examples:

* seed scripts
* migration helpers
* test runners
* setup scripts
* validation scripts

Scripts should be executable or clearly intended to automate repeatable tasks.

---

### `tools/`

Internal developer tools.

Examples:

* code generators
* custom CLIs
* repo analyzers
* graph builders
* local utilities

---

### `tests/`

Cross-cutting tests.

Examples:

* e2e tests
* integration tests
* test fixtures
* test harnesses

Module-specific tests may remain near modules if that is the existing convention.

---

### `infra/`

Infrastructure and deployment-related files.

Examples:

* Docker files
* database migration infrastructure
* deployment manifests
* Terraform
* Kubernetes
* environment setup
* hosting config

---

### `public/`

Static public assets.

---

### `config/`

Shared configuration.

Only recommend this if the repo already uses this convention or has too many root-level config files.

---

### Archive

Avoid a root-level `/archive` unless the repo already uses it intentionally.

Prefer:

`docs/archive/`

---

## 6. Misplaced File Detection

Look for files that may be misplaced, including:

* random Markdown files in root
* old plans in root
* AI-generated drafts in root
* temporary JSON outputs
* duplicate audit files
* one-off scripts in root
* test files in root
* migration notes in root
* old requirements files outside docs
* config backups
* generated outputs committed by mistake
* screenshots or images outside expected asset/docs folders

Examples of suspicious names:

* `final`
* `latest`
* `copy`
* `old`
* `backup`
* `temp`
* `tmp`
* `draft`
* `v2`
* `new-new`
* `fixed`
* `output`
* `report`
* `audit`
* `notes`

Do not assume they are useless.

Classify and recommend action.

---

## 7. Reference Safety

Before recommending any file/folder move, search references in:

* Markdown docs
* README files
* package.json scripts
* tsconfig paths
* import aliases
* CI workflows
* Docker files
* deployment scripts
* test setup files
* AI prompt files
* code comments where relevant

For each proposed move, identify reference risk:

* **Low** — no references found or only docs references
* **Medium** — references found but easy to update
* **High** — referenced by scripts, CI, build config, tests, or imports
* **Do Not Move** — moving may break architecture or runtime behavior

---

## 8. Relationship to Prompt 01

Load and consider the output from Prompt 01 if available:

`[CODEBASE_ROOT]/docs/aha/project-structure/outputs/DOCS_INVENTORY.md`

`[CODEBASE_ROOT]/docs/aha/project-structure/migration-plans/DOCS_MIGRATION_PLAN.md`

`[CODEBASE_ROOT]/docs/aha/project-structure/outputs/PRD_INDEX_DRAFT.md`

Do not duplicate Prompt 01’s work.

Use Prompt 01 outputs to understand:

* proposed docs structure
* PRD organization plan
* docs archive candidates
* docs reference risks

This prompt should focus on the wider project/root structure.

---

## 9. Required Output Files

Create:

`[CODEBASE_ROOT]/docs/aha/project-structure/outputs/PROJECT_STRUCTURE_INVENTORY.md`

Use this format:

```md
# Project Structure Inventory

## Summary

- Root files scanned:
- Root folders scanned:
- Misplaced file candidates:
- Duplicate candidates:
- Temporary/generated candidates:
- High-risk move candidates:
- Files recommended to keep in root:
- Files recommended for docs:
- Files recommended for scripts:
- Files recommended for tools:
- Files recommended for infra:
- Files recommended for archive:

## Current Root Observations

Summarize:
- whether root is clean or cluttered
- whether folder naming is consistent
- whether source folders follow a clear convention
- whether AI/audit artifacts are mixed with product/engineering docs
- whether scripts/configs appear misplaced
- whether generated/temp files are committed
- whether any project structure issues may affect AI agents, CI, tests, or developer onboarding

## Root File Assessment

| File | Current Purpose | Keep in Root? | Reason | Suggested New Location |
|---|---|---|---|---|

## Root Folder Assessment

| Folder | Apparent Purpose | Standard Category | Issue | Suggested Action |
|---|---|---|---|---|

## Misplaced Files

| File | Current Path | Suggested Path | Reason | Risk |
|---|---|---|---|---|

## Duplicate / Temporary / Generated Files

| File | Reason Flagged | Suggested Action | Risk |
|---|---|---|---|

## High-Risk Items

| File / Folder | Risk | Recommendation |
|---|---|---|

## Do Not Move Yet

| File / Folder | Reason |
|---|---|
```

Also create:

`[CODEBASE_ROOT]/docs/aha/project-structure/migration-plans/PROJECT_STRUCTURE_MIGRATION_PLAN.md`

Use this format:

```md
# Project Structure Migration Plan

## Proposed Root Structure

Show the recommended root structure.

## Root Files to Keep

| File | Reason |
|---|---|

## Proposed File Move Map

| Current Path | Proposed Path | Reason | Risk | References to Update |
|---|---|---|---|---|

## Proposed Archive Map

| Current Path | Archive Path | Reason | Risk |
|---|---|---|---|

## Files to Keep In Place

| Current Path | Reason |
|---|---|

## High-Risk Items

| Path | Risk | Recommendation |
|---|---|---|

## Relationship to Docs Migration Plan

Summarize how this root/project migration plan aligns with:

`docs/aha/project-structure/migration-plans/DOCS_MIGRATION_PLAN.md`

## Validation Checklist for Execution Phase

- [ ] package scripts checked
- [ ] tsconfig paths checked
- [ ] import aliases checked
- [ ] CI workflows checked
- [ ] Docker/deployment files checked
- [ ] README/docs references checked
- [ ] AI prompt references checked
- [ ] test references checked
```

---

## 10. Recommended Root Structure

Use this only as a guide.

Do not force this structure if the repo already has a clean and working convention.

```text
[CODEBASE_ROOT]/
├── .github/
│   ├── workflows/
│   ├── ISSUE_TEMPLATE/
│   ├── PULL_REQUEST_TEMPLATE.md
│   └── CODEOWNERS
├── apps/
├── packages/
├── modules/
├── docs/
├── scripts/
├── tools/
├── tests/
├── infra/
├── public/
├── README.md
├── CONTRIBUTING.md
├── SECURITY.md
├── CHANGELOG.md
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.json
├── eslint.config.js
├── prettier.config.js
├── .editorconfig
├── .env.example
├── docker-compose.yml
└── AGENTS.md / CLAUDE.md
```

Important:

Do not introduce folders just because they appear in this guide.

Only recommend folders that fit the actual repo.

---

## 11. Root Cleanup Decision Logic

Use this logic:

* Keep in root if it controls the whole repo.
* Keep in root if it is a primary contributor entry point.
* Move to `/docs` if it explains the project.
* Move to `/docs/product` if it describes product scope.
* Move to `/docs/architecture` if it describes system design.
* Move to `/docs/engineering` if it describes development process.
* Move to `/docs/archive` if it is old, superseded, or historical.
* Move to `/scripts` if it is executable repeatable automation.
* Move to `/tools` if it is an internal developer utility.
* Move to `/infra` if it concerns deployment, Docker, databases, or environments.
* Move to `/tests` if it is test-only and cross-cutting.
* Mark `[NEEDS REVIEW]` if uncertain.
* Mark `Do Not Move` if moving may break architecture, CI, imports, runtime behavior, or AI workflows.

---

## 12. Final Response Required

At the end, summarize:

1. Whether the root is clean or cluttered
2. Which files should stay in root
3. Which files are misplaced
4. Which files should move to docs/scripts/tools/infra/tests
5. Which files should be archived later
6. Which files should not be moved yet
7. Whether it is safe to proceed to execution later

Do not execute the migration.

Stop after producing:

* `docs/aha/project-structure/outputs/PROJECT_STRUCTURE_INVENTORY.md`
* `docs/aha/project-structure/migration-plans/PROJECT_STRUCTURE_MIGRATION_PLAN.md`

