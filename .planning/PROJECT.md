# Dentalemon — Dental Practice Frontend

## What This Is

Dentalemon is a dental practice management web application built on the Monobase platform. It provides a patient workspace with dental charting, treatment planning, visit management, imaging workspace, and a patient folder browser for dental practitioners.

## Core Value

A practitioner can open any patient folder, view their dental chart, plan treatments, record visits, and manage clinical X-ray imaging — all from a single cohesive workspace.

## Current Milestone: v1.4 Clinical Imaging

**Goal:** Structured clinical findings documented on radiographs + cephalometric workspace with auto-calculated measurements.

**Target features:**
- Structured imaging findings (type, status, tooth, surface) linked to image annotation, visit, and treatment plan
- Finding status workflow: suspected → confirmed → monitoring → resolved
- Manual ceph landmark placement (15+ landmarks) on lateral ceph images
- Auto-calculated SNA, SNB, ANB and other measurements
- Toggle-able tracing overlays
- Ceph report generation + smoke test

## Requirements

### Validated

- ✅ Read hooks (useVisits, useDentalChart, useTreatments, usePatients, useStaffMembers)
- ✅ Shared components (patient-folder-card, timeline-carousel, workspace-tabs, tooth-slideout, dental-chart)
- ✅ Brand system (brand.ts + tailwind lemon scale + CSS vars)
- ✅ Feature modules (imaging, treatment, visit, chart, etc.)
- ✅ Dental patient backend (TypeSpec + codegen + validated handlers — v1.0)
- ✅ Full workspace reconciliation (treatment table, visit lifecycle, SOAP notes, clinical sheets — v1.2.1)
- ✅ Imaging workspace (upload, viewer, measurements, annotations, comparison, offline — v1.3)
- ✅ IMG-01–IMG-18 all satisfied

### Active

- [ ] Structured imaging findings (CIMG-01–CIMG-06)
- [ ] Cephalometric workspace (CIMG-07–CIMG-15)
- [ ] Ceph reports + smoke test

### Out of Scope

- Periodontal tab — deferred to v1.5 (PERIO-01–03)
- E2E test harness routes (/imaging-test) — deferred from v1.3 (self-skip pattern)
- Missing data-testids in imaging components — deferred from v1.3
- Refactoring orphaned components from raw fetch() to TanStack Query (DEBT-01 — v1.5)

## Context

- App: `apps/dentalemon/` (Vite + TanStack Router + React)
- Branch: `feat/v1.3-imaging-workspace`
- API: `services/api-ts/src/handlers/`
- Imaging: `apps/dentalemon/src/features/imaging/`
- Design tokens: `apps/dentalemon/src/constants/brand.ts`

## Constraints

- **Tech Stack**: Bun + Vite + React 19 + TanStack Router/Query + Shadcn UI + Tailwind
- **Typecheck**: `bun run typecheck` must pass at every phase boundary
- **TypeSpec pattern**: Interface-level @route on operations must be relative (not absolute) when main.tsp adds @route prefix

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| imagingTier as org enum column | Enables free/basic/addon tier gating without separate table | ✅ Good |
| Annotations share useMeasurements endpoint | Single table, discriminated by type — avoids separate annotation endpoint | ✅ Good |
| Union adapter for legacy X-rays | dental_attachment source:'legacy' surfaces alongside imaging_study records | ✅ Good |
| Self-skip E2E pattern for imaging | /imaging-test harness routes absent — tests auto-skip vs. fail | ✅ Acceptable |
| TypeSpec @route on op not interface | main.tsp overrides interface-level @route; relative op route required | ✅ Documented |
| CIMG findings link to annotations | Finding references annotation ID for spatial context on image | ⏳ TBD |

## Evolution

This document evolves at phase transitions and milestone boundaries.

---
*Last updated: 2026-05-11 — Milestone v1.4 started (v1.3 archived)*
