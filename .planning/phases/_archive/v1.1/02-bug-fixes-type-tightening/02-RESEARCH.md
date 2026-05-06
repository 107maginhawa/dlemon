---
phase: 2
status: complete
---

# Research: Phase 2 — Bug Fixes + Type Tightening

**Researched:** 2026-05-06
**Domain:** TypeScript type safety, React state management, Tailwind tokens
**Confidence:** HIGH (all findings from direct codebase reads)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Fold CR-01 (empty localStorage guard), CR-02 (stale visitId), WR-02 (parallel save race), CR-03 (as any casts) into Phase 2
- Add `bg-lemon`, `text-lemon-contrast`, `hover:bg-lemon-hover` to tailwind config extending brand.ts — replace hardcoded colors only in Phase 2 touched files
- Update Treatment type to include `cdtCode`, `description` fields — remove `as any` casts
- Derive ToothState type from TOOTH_STATES const via `typeof` — remove `| string`
- FDI validation guard in `dental-chart.helpers.ts` (reusable, testable)

### Claude's Discretion
- Chain saves: saveChart → onSuccess → saveTreatment (if treatment data present)
- Price NaN guard: reject non-numeric input before mutation fires, not silently default to 0
- FDI validation: accept both Universal (1-32) and FDI (11-48) numbering systems

### Deferred Ideas (OUT OF SCOPE)
- Toast/notification system for mutation error feedback (WR-03)
- Codebase-wide `bg-[#FFE97D]` → `bg-lemon` replacement (50+ files)
- Billing page navigation with visit context (N3)
- Share PMD button loading/disabled state during mutation (N4)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Finding |
|----|-------------|-----------------|
| BUG-01 | Treatment status enum uses `diagnosed \| planned` (not `proposed`) | Status type correct in `SaveTreatmentInput` and `Treatment`. Real fix: `$patientId.tsx` hardcodes `status: 'diagnosed'` — needs to be a derived value from user intent or a sensible default |
| BUG-02 | Price field renamed from `priceCents` to `priceInput` | **Already done** — `ToothSlideoutData.priceInput` exists; no `priceCents` anywhere |
| BUG-03 | Tooth slideout resets state when `selectedTooth` changes | **Already done** — `useEffect([toothNumber])` at tooth-slideout.tsx:58-66 |
| BUG-04 | `ToothData.state` typed as `ToothState` only; `ToothSurface` canonicalized | `ToothData.state` is already `ToothState`. Fixes needed: `ToothData.surfaces: string[]` → `ToothSurface[]`; `buildToothMap` and `getToothColorClass` signatures use `string` where `ToothState` applies |
| BUG-05 | FDI validation guard rejects invalid tooth numbers | No guard exists — `fdiToUniversal` returns `NaN` silently; guard functions need to be added to `dental-chart.helpers.ts` |
| BUG-06 | Price validated before cents conversion (NaN guard) | No cents conversion exists (API takes float directly). Guard needed: `parseFloat(data.priceInput) \|\| 0` silently coerces bad input to 0 |
| BUG-07 | Hardcoded `bg-[#FFE97D]` replaced with `bg-lemon` token | Two locations: tooth-slideout.tsx:297, $patientId.tsx:302. Tailwind `lemon` token already defined — no config changes needed |
</phase_requirements>

---

## 1. Codebase Findings

### tooth-slideout.tsx — Full Status

**Path:** `apps/dentalemon/src/features/workspace/components/tooth-slideout.tsx`

Key facts:
- `TOOTH_STATES` const (lines 17-27): 9 values, `as const` — can derive type
- `ToothSlideoutData` (lines 29-37): uses `priceInput?: string` (not `priceCents`) — BUG-02 already fixed
- `useEffect([toothNumber])` (lines 58-66): resets all state — BUG-03 already fixed
- Save button (line 297): `bg-[#FFE97D] text-[#4A4018] hover:bg-[#F5DC60]` — BUG-07 fix target
- No status enum field — tooth state (condition) and treatment status are separate concepts

**[VERIFIED: direct file read]**

---

### Type Definitions

#### ToothData and ToothState
**Path:** `apps/dentalemon/src/features/workspace/components/dental-chart.helpers.ts`

```typescript
// Line 8 — ToothState is already a correct narrow union
export type ToothState = 'healthy' | 'caries' | 'fractured' | 'filled' | 'crown' | 'missing' | 'implant' | 'extracted' | 'watchlist';

// Line 10-16 — ToothData
export interface ToothData {
  toothNumber: number;
  state: ToothState;        // ✅ already typed correctly — no | string
  surfaces?: string[];      // ❌ should be ToothSurface[]
  conditionCode?: string;
  note?: string;
}

// Line 37 — buildToothMap accepts string, returns string — should use ToothState
export function buildToothMap(teeth: Array<{ toothNumber: number; state: string }>): Map<number, string>

// Line 101 — getToothColorClass accepts ToothState | string — redundant | string
export function getToothColorClass(state: ToothState | string): string
```

**Issues to fix:**
1. `ToothData.surfaces?: string[]` → `ToothSurface[]` (import from five-surface-selector.helpers)
2. `buildToothMap` parameter/return: `state: string` → `ToothState`, `Map<number, string>` → `Map<number, ToothState>`
3. `getToothColorClass` signature: remove `| string`

**[VERIFIED: direct file read]**

#### ToothSurface
**Path:** `apps/dentalemon/src/features/workspace/components/five-surface-selector.helpers.ts`

```typescript
// Line 8 — single canonical definition
export type ToothSurface = 'mesial' | 'distal' | 'buccal' | 'lingual' | 'occlusal' | 'incisal';
```

**No duplicate definitions found.** Already imported in `tooth-slideout.tsx`. Only fix: add to `ToothData.surfaces` type.

**[VERIFIED: direct file read]**

#### Treatment type (for CR-03)
**Path:** `apps/dentalemon/src/features/workspace/hooks/use-treatments.ts`

```typescript
// Lines 13-25 — current Treatment interface
export interface Treatment {
  id: string;
  visitId: string;
  toothNumber: number;
  surfaces?: string[];
  procedureCode: string;    // old field name
  procedureName: string;    // old field name
  status: 'diagnosed' | 'planned' | 'in_progress' | 'completed' | 'cancelled';
  priceAmount: number;
  currency: string;
  note?: string;
  createdAt: string;
}
```

**Missing fields that `$patientId.tsx` accesses via `as any`:**
- `cdtCode` (accessed as `(t as any).cdtCode`) — not on type
- `description` (accessed as `(t as any).description`) — not on type

**Fix:** Add optional fields to Treatment:
```typescript
cdtCode?: string;       // new API field name
description?: string;   // new API field name
```

The fallback chains `(t as any).cdtCode ?? (t as any).procedureCode` and `(t as any).description ?? t.procedureName` suggest the API response is transitioning field names. After adding the optional fields, the `as any` casts can be removed.

**[VERIFIED: direct file read]**

---

### BUG-01: Treatment Status — Actual Issue

**File:** `$patientId.tsx` line 142

```typescript
status: 'diagnosed',   // hardcoded — never passes 'planned'
```

The `SaveTreatmentInput.status` type is `'diagnosed' | 'planned'` (correct). The `Treatment.status` from the API is also `'diagnosed' | 'planned' | ...` (correct). The hardcoded `'diagnosed'` means all new treatments are always submitted as diagnosed regardless of context.

Per CONTEXT.md, this is in scope. Since `ToothSlideoutData` has no `status` field, the fix is either:
- Keep `'diagnosed'` as the default for new treatments (simplest — no UI change needed)
- Or the CONTEXT.md intent is just ensuring the type is correct (which it already is)

**[ASSUMED]** — The planner should clarify: is BUG-01 a type fix (already done) or does it require a UI control for status selection?

---

### BUG-05: FDI Validation

**Path:** `apps/dentalemon/src/features/workspace/components/dental-chart.helpers.ts`

`TOOTH_NUMBERS` array (lines 23-32) contains all 32 valid permanent FDI numbers. Functions `fdiToUniversal` and `universalToFdi` return `NaN` for invalid input but callers don't check.

No `isValidFdiNumber` or `isValidUniversalNumber` guard functions exist.

**Guard functions to add:**
```typescript
// Can be derived from existing TOOTH_NUMBERS constant
export function isValidFdiNumber(n: number): boolean {
  return TOOTH_NUMBERS.includes(n);
}

export function isValidUniversalNumber(n: number): boolean {
  return Number.isInteger(n) && n >= 1 && n <= 32;
}
```

Primary/deciduous teeth (51-85) are not in `TOOTH_NUMBERS` and not in `FDI_TO_UNIVERSAL` map — current app scope is permanent teeth only.

**[VERIFIED: direct file read]**

---

### BUG-06: Price NaN Guard

**File:** `$patientId.tsx` line 139

```typescript
priceAmount: parseFloat(data.priceInput) || 0,
```

- No cents conversion (`*100`) — API takes a float directly (`priceAmount: number`)
- `parseFloat('')` → `NaN`, `NaN || 0` → `0` — silently coerces
- `parseFloat('abc')` → `NaN` → `0` — silently coerces

**Fix location:** Inside `handleSaveToothData`, before `saveTreatmentMutation.mutate(...)` call. After WR-02 is fixed (sequential saves), the guard lives in the `onSuccess` callback:

```typescript
const rawPrice = data.priceInput ? parseFloat(data.priceInput) : 0;
if (data.priceInput && isNaN(rawPrice)) {
  // Per CONTEXT.md: no toast (WR-03 deferred), so console.error + return
  console.error('Invalid price input — treatment not saved');
  return;
}
```

**[VERIFIED: direct file read]**

---

### BUG-07: Hardcoded Colors

**Location 1 — tooth-slideout.tsx line 297** (Save button):
```typescript
className="... bg-[#FFE97D] text-[#4A4018] ... hover:bg-[#F5DC60] ..."
```

**Location 2 — $patientId.tsx line 302** (Continue to Payment button):
```typescript
className="... bg-[#FFE97D] ... text-[#4A4018] hover:bg-[#F5DC60] ..."
```

**Tailwind config already has lemon tokens** (`tailwind.config.ts` lines 49-55):
```typescript
lemon: {
  DEFAULT: "#FFE97D",      // bg-lemon
  hover: "#F5DC60",        // bg-lemon-hover
  foreground: "#4A4018",   // text-lemon-foreground
}
```

Replacements:
- `bg-[#FFE97D]` → `bg-lemon`
- `text-[#4A4018]` → `text-lemon-foreground`
- `hover:bg-[#F5DC60]` → `hover:bg-lemon-hover`

No tailwind.config.ts changes needed — tokens exist.

**Additional hardcoded lemon in dental-chart.helpers.ts line 107:**
```typescript
case 'crown': return 'tooth-crown fill-[#FFE97D] text-[#4A4018]';
```
This is a string value returned from a function (SVG fill classes), not a JSX className. Tailwind JIT needs the class in a template literal or className prop to purge correctly. Out of scope per deferred decision.

**[VERIFIED: direct file read]**

---

### CR-01: LocalStorage Guard

**File:** `$patientId.tsx` lines 76-78

```typescript
branchId: localStorage.getItem('currentBranchId') ?? '',
dentistMemberId: localStorage.getItem('currentMemberId') ?? '',
```

No guard. Empty strings passed to API silently. Fix: early return with `console.error` if either value is missing (WR-03 toast deferred).

**[VERIFIED: direct file read]**

---

### CR-02: Stale visitId Closure

**Files:** `use-save-chart.ts` line 35, `use-save-treatment.ts` line 39

Both hooks close over `visitId` parameter in `onSuccess`:
```typescript
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['dental-chart', visitId] });
}
```

**Fix:** Read from mutation input (always fresh):
```typescript
onSuccess: (_data, input) => {
  queryClient.invalidateQueries({ queryKey: ['dental-chart', input.visitId] });
}
```

`SaveChartInput.visitId` and `SaveTreatmentInput.visitId` both exist — fix is mechanical.

**[VERIFIED: direct file read]**

---

### WR-02: Parallel Save Race

**File:** `$patientId.tsx` lines 120-143

`saveChartMutation.mutate(...)` and `saveTreatmentMutation.mutate(...)` fire simultaneously. Fix: move treatment save into `saveChartMutation`'s `onSuccess`. This also consolidates the NaN guard (BUG-06) and `clearSelection()` call.

**[VERIFIED: direct file read]**

---

### CR-03: `as any` Casts

**File:** `$patientId.tsx` lines 249, 252

```typescript
{(t as any).cdtCode ?? (t as any).procedureCode ?? '—'}
{(t as any).description ?? t.procedureName ?? '—'}
```

Fix: add `cdtCode?: string` and `description?: string` to `Treatment` interface in `use-treatments.ts`. After that, remove `as any` and access directly.

**[VERIFIED: direct file read]**

---

### Cascade Guard: Phase 1 Hook Imports

**File:** `$patientId.tsx` imports (lines 24-27)

```typescript
import { useCreateVisit } from '@/features/workspace/hooks/use-create-visit';
import { useSharePMD } from '@/features/workspace/hooks/use-share-pmd';
import { useSaveChart } from '@/features/workspace/hooks/use-save-chart';
import { useSaveTreatment } from '@/features/workspace/hooks/use-save-treatment';
```

All four Phase 1 hooks are imported. After type tightening:
- `useSaveChart` receives `ToothData[]` — if `ToothData.surfaces` becomes `ToothSurface[]`, the array constructed at lines 109-118 must also use `ToothSurface[]`
- `useSaveTreatment` receives `surfaces: string[]` — this input type should also narrow to `ToothSurface[]`

Cascade typecheck after BUG-04 fixes is essential.

**[VERIFIED: direct file read]**

---

## 2. Already-Fixed Items

These BUG requirements are already implemented. Plan tasks = verify only, not re-implement:

| Req | Status | Evidence |
|-----|--------|---------|
| BUG-02 `priceCents` → `priceInput` | DONE | `ToothSlideoutData.priceInput` at tooth-slideout.tsx:35 |
| BUG-03 state reset on tooth change | DONE | `useEffect([toothNumber])` at tooth-slideout.tsx:58-66 |

---

## 3. Validation Strategy

| Fix | Verification |
|-----|-------------|
| All type changes | `cd apps/dentalemon && bun run typecheck` |
| BUG-04 surfaces type | `grep -rn "surfaces.*string\[\]" src/features/workspace/` → should be empty |
| BUG-04 string leak | `grep -n "\| string" src/features/workspace/components/dental-chart.helpers.ts` → should be empty |
| BUG-05 guard exists | `grep -n "isValidFdiNumber\|isValidUniversalNumber" src/features/workspace/components/dental-chart.helpers.ts` |
| BUG-06 NaN guard | `grep -n "isNaN\|parseFloat" src/routes/_workspace/\$patientId.tsx` |
| BUG-07 no hardcodes | `grep -rn "bg-\[#FFE97D\]" src/routes/_workspace/\$patientId.tsx src/features/workspace/components/tooth-slideout.tsx` → empty |
| CR-03 no as any | `grep -n "as any" src/routes/_workspace/\$patientId.tsx` → empty |
| CR-02 fresh input | `grep -n "input\.visitId" src/features/workspace/hooks/use-save-*.ts` |

**Cascade guard command:**
```bash
cd apps/dentalemon && bun run typecheck
```

---

## 4. Risk Assessment

| Change | Risk | Mitigation |
|--------|------|-----------|
| `ToothData.surfaces: string[] → ToothSurface[]` | MEDIUM | Check all callers of `buildToothMap` and `useSaveChart` — tooth array construction in `$patientId.tsx` line 109 must also use `ToothSurface[]` |
| `buildToothMap` return type → `Map<number, ToothState>` | MEDIUM | `map.get()` returns `ToothState \| undefined`; callers must handle `undefined` |
| WR-02 sequential saves | LOW | Chart save must succeed before treatment save fires — only improves correctness |
| CR-01 localStorage guard | LOW | Only blocks calls with missing data; no regression for working sessions |
| CR-02 closure fix | LOW | Mechanical; `input.visitId` always equals the closed-over `visitId` in practice |
| CR-03 Treatment type | LOW | Adding optional fields is non-breaking |
| BUG-07 color swap | LOW | Tokens exist in tailwind.config.ts; pure string replacement |
| BUG-05 FDI guard | LOW | New functions added; no existing function signatures changed |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | BUG-01 only requires verifying the type is correct (already is) — no UI control needed for planned vs diagnosed | BUG-01 | If planner requires a UI control, ToothSlideoutData needs a `status` field and tooth-slideout.tsx needs a new input |
| A2 | API `priceAmount` is a raw float (not cents) — no `*100` conversion needed | BUG-06 | Silent 100x price error if the API actually expects cents |
| A3 | Primary/deciduous teeth (51-85) out of scope for FDI validation guard | BUG-05 | If they're in scope, `TOOTH_NUMBERS` and `FDI_TO_UNIVERSAL` must be extended |

---

## Sources

### Primary (HIGH confidence — direct file reads)
- `apps/dentalemon/src/features/workspace/components/tooth-slideout.tsx`
- `apps/dentalemon/src/features/workspace/components/dental-chart.helpers.ts`
- `apps/dentalemon/src/features/workspace/components/five-surface-selector.helpers.ts`
- `apps/dentalemon/src/features/workspace/hooks/use-create-visit.ts`
- `apps/dentalemon/src/features/workspace/hooks/use-save-chart.ts`
- `apps/dentalemon/src/features/workspace/hooks/use-save-treatment.ts`
- `apps/dentalemon/src/features/workspace/hooks/use-treatments.ts`
- `apps/dentalemon/src/routes/_workspace/$patientId.tsx`
- `apps/dentalemon/tailwind.config.ts`
- `.planning/phases/02-bug-fixes-type-tightening/02-CONTEXT.md`
- `.planning/REQUIREMENTS.md`
