# Dentalemon — Dental Practice Frontend

## What This Is

Dentalemon is a dental practice management web application built on the Monobase platform. It provides a patient workspace with dental charting, treatment planning, visit management, and a patient folder browser for dental practitioners.

## Core Value

A practitioner can open any patient folder, view their dental chart, plan treatments, and record visits — all from a single cohesive workspace.

## Current Milestone: v1.2 Wire & Ship

**Goal:** Wire existing components, fill wireframe gaps, and deliver a feature-complete web MVP covering all ~60 web-applicable PRD FRs.

**Target features:**
- Build workspace action bar + wire 5 orphaned sheet components (Rx, Consent, LabOrders, PMD, PMDImport)
- Fill Treatment Plan tab placeholder with live data
- Build Patient Profile screen from wireframe
- Build workspace attachments + quick payment modal
- Build report detail drilldown + full smoke test

## Requirements

### Validated

- ✅ Read hooks (useVisits, useDentalChart, useTreatments, usePatients, useStaffMembers)
- ✅ Shared components (patient-folder-card, timeline-carousel, workspace-tabs, tooth-slideout, dental-chart, five-surface-selector)
- ✅ Brand system (brand.ts + tailwind lemon scale + CSS vars)
- ✅ Feature modules (10 feature dirs with components and hooks)
- ✅ Dental patient backend (TypeSpec + codegen + validated handlers — v1.0)
- ✅ Mutation hooks extracted, dead code removed (v1.1)
- ✅ Bug fixes: treatment enum, price naming, slideout reset, type tightening, FDI/NaN guards (v1.1)
- ✅ DentalChartThumbnail + patient card enhancements (v1.1)
- ✅ Frontend tests for hooks and components (v1.1)
- ✅ Developer docs SCREENS.md + COMPONENTS.md (v1.1)

### Active

- [ ] Workspace action bar + 5 orphaned sheet wiring
- [ ] Treatment Plan tab with live data
- [ ] Patient Profile screen
- [ ] Workspace attachments component
- [ ] Quick payment modal
- [ ] Report detail drilldown

### Out of Scope

- Periodontal tab — deferred to v1.3 (no backend schema/repo/handler, no wireframe)
- ~30 deferred FRs requiring iPad-native (Apple Pencil, gestures) or P2P sync
- TDD retrofit on existing code
- Responsive/polish pass
- Refactoring orphaned components from raw fetch() to TanStack Query (tech debt — tracked)

## Context

- App: `apps/dentalemon/` (Vite + TanStack Router + React)
- Branch: `fix/boilerplate-bugs-reviewed`
- API: `services/api-ts/src/handlers/dental-patient/`
- Design tokens: `apps/dentalemon/src/constants/brand.ts`
- 22/28 wireframes already built; 5 complete components orphaned (built but never imported)
- Backend is production-grade (~87 handlers, all 39 FRs checked off)
- Previous milestones: v1.0 (dental-patient backend), v1.1 (frontend plumbing) — both completed 2026-05-06

## Constraints

- **Tech Stack**: Bun + Vite + React 19 + TanStack Router/Query + Shadcn UI + Tailwind
- **Branch**: Stay on `fix/boilerplate-bugs-reviewed` — no new branches
- **Typecheck**: `bun run typecheck` must pass at every phase boundary

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Phases 1-5 reset numbering | New frontend milestone separate from backend Phase 01 | ✓ Good |
| No research phase | Requirements already defined from plan file | ✓ Good |
| Cascade guard after Phase 2 | Type tightening can break Phase 1 hooks | ✓ Good |
| Assembly-first, no TDD retrofit | Backend has 254 repo + 297 handler + contract + E2E tests. Save vertical TDD for v1.3 greenfield | — Pending |
| Periodontal → v1.3 | No backend schema/repo/handler, no wireframe. Full vertical feature, not assembly | ✓ Good |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition:**
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions

---
*Last updated: 2026-05-06 — Milestone v1.2 started*
