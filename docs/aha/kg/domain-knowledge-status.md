# AHA — Domain Knowledge Status

**Date:** 2026-06-11 · **Prompt:** 01-platform-discovery-audit-index

| Item | Status | Notes |
| --- | --- | --- |
| `/understand-domain` available | Yes | understand-anything plugin; existing output at `.understand-anything/domain-graph.json` (74 KB, generated 2026-06-08, 15 domains) — gitignored |
| Domain graph/output used | Yes | Used as a cross-check for the workflow table in `docs/aha/outputs/module-audit-index.md`; primary domain sources are the curated docs below (richer + more current). |
| Domain output appears sufficient | Yes | The platform also has hand-maintained domain docs that supersede the generated graph for audit purposes: `docs/product/DOMAIN_MODEL.md`, `DOMAIN_GLOSSARY.md`, `WORKFLOW_MAP.md` (33 KB), `ROLE_PERMISSION_MATRIX.md`, plus PRD §6 feature areas. |
| Domain output refreshed or regenerated | No | Not needed — domain boundaries have not changed since 2026-06-08; only intra-module features landed. |
| Missing or unclear domain areas | Few | (1) `case-presentation` is a product capability that spans dental-patient treatment-plans + dental-clinical consent + FE feature, with no single owning handler dir — treated as its own audit batch. (2) `emr-consultation` scope was decision-gated (resolved 2026-06-10 as dormant-relabel + clinic-scope) `[NEEDS CONFIRMATION]` that the relabel landed everywhere. (3) `external-records-import` is Phase-3+ by design. |
| Domain status file saved | Yes | This file |
