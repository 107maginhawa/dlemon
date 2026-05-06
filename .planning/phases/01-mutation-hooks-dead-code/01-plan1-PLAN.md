---
plan: "01-plan1"
phase: "1"
wave: 1
depends_on: []
requirements_addressed: [MUT-01]
files_modified:
  - apps/dentalemon/src/features/workspace/hooks/use-create-visit.ts
  - apps/dentalemon/src/features/workspace/hooks/use-share-pmd.ts
  - apps/dentalemon/src/features/workspace/hooks/use-save-chart.ts
  - apps/dentalemon/src/features/workspace/hooks/use-save-treatment.ts
autonomous: true
must_haves:
  goal: "Four TanStack Query mutation hooks exist, each wrapping one inline fetch block from $patientId.tsx."
  truths:
    - "use-create-visit.ts exports useCreateVisit returning a TanStack mutation that POSTs /dental/visits and invalidates ['dental-visits', patientId]"
    - "use-share-pmd.ts exports useSharePMD returning a TanStack mutation that POSTs /dental/visits/:id/pmd"
    - "use-save-chart.ts exports useSaveChart returning a TanStack mutation that POSTs /dental/visits/:visitId/chart and invalidates ['dental-chart', visitId]"
    - "use-save-treatment.ts exports useSaveTreatment returning a TanStack mutation that POSTs /dental/visits/:visitId/treatments and invalidates ['dental-treatments', visitId]"
    - "All four files compile with no TypeScript errors"
---

<objective>
Create the four TanStack Query mutation hooks that will replace the inline fetch() calls in the workspace page.

Purpose: Centralise network mutation logic in proper hooks so $patientId.tsx contains no raw fetch() calls and query invalidation is co-located with the mutation.
Output: Four new hook files under apps/dentalemon/src/features/workspace/hooks/.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md

<!-- Pattern reference — read these before writing any hook -->
@apps/dentalemon/src/features/workspace/hooks/use-visits.ts
@apps/dentalemon/src/features/workspace/hooks/use-treatments.ts

<!-- Source of truth for what each inline fetch does -->
@apps/dentalemon/src/routes/_workspace/$patientId.tsx

<interfaces>
<!-- From use-visits.ts -->
import { useQuery } from '@tanstack/react-query';
import { apiBaseUrl } from '@/utils/config';

<!-- From use-treatments.ts -->
export interface Treatment {
  id: string; visitId: string; toothNumber: number; surfaces?: string[];
  procedureCode: string; procedureName: string;
  status: 'diagnosed' | 'planned' | 'in_progress' | 'completed' | 'cancelled';
  priceAmount: number; currency: string; note?: string; createdAt: string;
}

<!-- From $patientId.tsx — ToothData shape (for useSaveChart input) -->
import type { ToothData } from '@/features/workspace/components/dental-chart.helpers';
// ToothData: { toothNumber: number; state: string; surfaces: string[]; conditionCode?: string }

<!-- Query keys in use -->
// visits:     ['dental-visits', patientId]
// chart:      ['dental-chart', visitId]
// treatments: ['dental-treatments', visitId]
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create useCreateVisit mutation hook</name>
  <files>apps/dentalemon/src/features/workspace/hooks/use-create-visit.ts</files>

  <read_first>
    - apps/dentalemon/src/features/workspace/hooks/use-visits.ts — import style, apiBaseUrl usage, credential pattern
    - apps/dentalemon/src/routes/_workspace/$patientId.tsx lines 69-84 — exact fetch body being replaced
  </read_first>

  <action>
Create apps/dentalemon/src/features/workspace/hooks/use-create-visit.ts with the following exact implementation:

```typescript
/**
 * useCreateVisit — TanStack Query mutation for creating a new dental visit
 *
 * Replaces the inline fetch in handleNewVisit() in $patientId.tsx.
 * API: POST /dental/visits
 * On success: invalidates ['dental-visits', patientId] so the timeline refreshes.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiBaseUrl } from '@/utils/config';

interface CreateVisitInput {
  patientId: string;
  branchId: string;
  dentistMemberId: string;
}

interface CreatedVisit {
  id: string;
  patientId: string;
  status: 'draft' | 'active' | 'completed' | 'locked';
  createdAt: string;
}

export function useCreateVisit(patientId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateVisitInput): Promise<CreatedVisit> => {
      const res = await fetch(`${apiBaseUrl}/dental/visits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`Failed to create visit: ${res.status}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dental-visits', patientId] });
    },
  });
}
```

No other variations. The hook accepts `patientId` as a parameter (not inside mutationFn input) so invalidation uses the correct key without needing access to the mutation result's patientId.
  </action>

  <acceptance_criteria>
    - File exists: apps/dentalemon/src/features/workspace/hooks/use-create-visit.ts
    - grep -c "useMutation" apps/dentalemon/src/features/workspace/hooks/use-create-visit.ts returns 1
    - grep -c "invalidateQueries" apps/dentalemon/src/features/workspace/hooks/use-create-visit.ts returns 1
    - grep -c "dental-visits" apps/dentalemon/src/features/workspace/hooks/use-create-visit.ts returns 2 (queryKey array + invalidation)
    - bun run typecheck passes (no new errors)
  </acceptance_criteria>

  <verify>
    <automated>cd /Users/eladventures/Desktop/dentalemon && bun run typecheck 2>&1 | tail -5</automated>
  </verify>

  <done>use-create-visit.ts exists, exports useCreateVisit, compiles clean.</done>
</task>

<task type="auto">
  <name>Task 2: Create useSharePMD, useSaveChart, useSaveTreatment mutation hooks</name>
  <files>
    apps/dentalemon/src/features/workspace/hooks/use-share-pmd.ts
    apps/dentalemon/src/features/workspace/hooks/use-save-chart.ts
    apps/dentalemon/src/features/workspace/hooks/use-save-treatment.ts
  </files>

  <read_first>
    - apps/dentalemon/src/routes/_workspace/$patientId.tsx lines 86-153 — three fetch blocks being replaced
    - apps/dentalemon/src/features/workspace/hooks/use-create-visit.ts — pattern just established
    - apps/dentalemon/src/features/workspace/components/dental-chart.helpers.ts — ToothData type (for useSaveChart)
  </read_first>

  <action>
Create three files following the same pattern as use-create-visit.ts.

--- FILE 1: apps/dentalemon/src/features/workspace/hooks/use-share-pmd.ts ---

```typescript
/**
 * useSharePMD — TanStack Query mutation for sharing a Portable Medical Document
 *
 * Replaces the inline fetch in handleSharePMD() in $patientId.tsx.
 * API: POST /dental/visits/:visitId/pmd
 * Returns PMD payload including checksum for Web Share API.
 */
import { useMutation } from '@tanstack/react-query';
import { apiBaseUrl } from '@/utils/config';

interface SharePMDInput {
  visitId: string;
  patientId: string;
}

interface PMDResult {
  checksum: string;
  [key: string]: unknown;
}

export function useSharePMD() {
  return useMutation({
    mutationFn: async (input: SharePMDInput): Promise<PMDResult> => {
      const res = await fetch(`${apiBaseUrl}/dental/visits/${input.visitId}/pmd`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`Failed to share PMD: ${res.status}`);
      return res.json();
    },
  });
}
```

No invalidation needed — PMD is a one-shot export, not a cached query.

--- FILE 2: apps/dentalemon/src/features/workspace/hooks/use-save-chart.ts ---

```typescript
/**
 * useSaveChart — TanStack Query mutation for saving dental chart tooth data
 *
 * Replaces the first fetch in handleSaveToothData() in $patientId.tsx.
 * API: POST /dental/visits/:visitId/chart
 * On success: invalidates ['dental-chart', visitId] so the chart re-renders.
 *
 * The caller is responsible for building the full teeth array before calling mutate().
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiBaseUrl } from '@/utils/config';
import type { ToothData } from '@/features/workspace/components/dental-chart.helpers';

interface SaveChartInput {
  visitId: string;
  patientId: string;
  teeth: ToothData[];
}

export function useSaveChart(visitId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SaveChartInput): Promise<unknown> => {
      const res = await fetch(`${apiBaseUrl}/dental/visits/${input.visitId}/chart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`Failed to save chart: ${res.status}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dental-chart', visitId] });
    },
  });
}
```

--- FILE 3: apps/dentalemon/src/features/workspace/hooks/use-save-treatment.ts ---

```typescript
/**
 * useSaveTreatment — TanStack Query mutation for adding a treatment to a visit
 *
 * Replaces the second (conditional) fetch in handleSaveToothData() in $patientId.tsx.
 * API: POST /dental/visits/:visitId/treatments
 * On success: invalidates ['dental-treatments', visitId] so the treatment table refreshes.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiBaseUrl } from '@/utils/config';

interface SaveTreatmentInput {
  visitId: string;
  patientId: string;
  cdtCode: string;
  description: string;
  toothNumber: number;
  surfaces: string[];
  conditionCode?: string;
  priceAmount: number;
  currency: string;
  status: 'diagnosed' | 'planned';
}

export function useSaveTreatment(visitId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SaveTreatmentInput): Promise<unknown> => {
      const res = await fetch(`${apiBaseUrl}/dental/visits/${input.visitId}/treatments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`Failed to save treatment: ${res.status}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dental-treatments', visitId] });
    },
  });
}
```

Write all three files exactly as specified above.
  </action>

  <acceptance_criteria>
    - All three files exist at specified paths
    - grep -rn "useMutation" apps/dentalemon/src/features/workspace/hooks/use-share-pmd.ts returns a match
    - grep -rn "invalidateQueries.*dental-chart" apps/dentalemon/src/features/workspace/hooks/use-save-chart.ts returns a match
    - grep -rn "invalidateQueries.*dental-treatments" apps/dentalemon/src/features/workspace/hooks/use-save-treatment.ts returns a match
    - bun run typecheck passes with no new errors
  </acceptance_criteria>

  <verify>
    <automated>cd /Users/eladventures/Desktop/dentalemon && bun run typecheck 2>&1 | tail -5</automated>
  </verify>

  <done>Three hook files exist, each compiles clean, each invalidates correct query key on success.</done>
</task>

</tasks>

<verification>
After both tasks complete:

```bash
cd /Users/eladventures/Desktop/dentalemon
ls apps/dentalemon/src/features/workspace/hooks/use-create-visit.ts
ls apps/dentalemon/src/features/workspace/hooks/use-share-pmd.ts
ls apps/dentalemon/src/features/workspace/hooks/use-save-chart.ts
ls apps/dentalemon/src/features/workspace/hooks/use-save-treatment.ts
bun run typecheck
```

All four files exist and typecheck passes.
</verification>

<success_criteria>
- Four hook files exist under apps/dentalemon/src/features/workspace/hooks/
- Each exports one named function
- useCreateVisit and useSaveChart and useSaveTreatment each call invalidateQueries
- useSharePMD does not invalidate (no cached PMD query)
- bun run typecheck clean
</success_criteria>

<output>
After completion, create .planning/phases/01-mutation-hooks-dead-code/01-plan1-SUMMARY.md
</output>
