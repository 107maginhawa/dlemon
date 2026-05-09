---
plan: "01-plan2"
phase: "1"
wave: 2
depends_on: ["01-plan1"]
requirements_addressed: [MUT-01, MUT-02]
files_modified:
  - apps/dentalemon/src/routes/_workspace/$patientId.tsx
autonomous: true
must_haves:
  goal: "The workspace page contains zero inline fetch() calls — all four mutations delegate to the hooks created in plan1."
  truths:
    - "handleNewVisit() calls createVisitMutation.mutate(...) instead of fetch()"
    - "handleSharePMD() calls sharePMDMutation.mutate(...) instead of fetch()"
    - "handleSaveToothData() calls saveChartMutation.mutate(...) and saveTreatmentMutation.mutate(...) instead of fetch()"
    - "The teeth array building logic in handleSaveToothData stays in the component (not moved to the hook)"
    - "No import of apiBaseUrl remains in $patientId.tsx"
    - "bun run typecheck passes with no errors"
---

<objective>
Refactor $patientId.tsx to consume the four mutation hooks, removing all four inline fetch() blocks.

Purpose: The workspace page becomes a pure coordinator — no raw HTTP calls, no manual invalidation.
Output: Modified $patientId.tsx with hooks wired in.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/phases/01-mutation-hooks-dead-code/01-plan1-SUMMARY.md

<!-- Files to read before editing -->
@apps/dentalemon/src/routes/_workspace/$patientId.tsx
@apps/dentalemon/src/features/workspace/hooks/use-create-visit.ts
@apps/dentalemon/src/features/workspace/hooks/use-share-pmd.ts
@apps/dentalemon/src/features/workspace/hooks/use-save-chart.ts
@apps/dentalemon/src/features/workspace/hooks/use-save-treatment.ts

<interfaces>
<!-- Mutation hook signatures from plan1 -->

useCreateVisit(patientId: string) → UseMutationResult
  .mutate({ patientId, branchId, dentistMemberId })
  onSuccess returns CreatedVisit { id: string; ... }

useSharePMD() → UseMutationResult
  .mutate({ visitId, patientId })
  onSuccess returns PMDResult { checksum: string; ... }

useSaveChart(visitId: string | null) → UseMutationResult
  .mutate({ visitId, patientId, teeth: ToothData[] })

useSaveTreatment(visitId: string | null) → UseMutationResult
  .mutate({ visitId, patientId, cdtCode, description, toothNumber,
            surfaces, conditionCode, priceAmount, currency, status })
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Wire mutation hooks into WorkspacePage</name>
  <files>apps/dentalemon/src/routes/_workspace/$patientId.tsx</files>

  <read_first>
    - apps/dentalemon/src/routes/_workspace/$patientId.tsx — full file before touching anything
    - apps/dentalemon/src/features/workspace/hooks/use-create-visit.ts
    - apps/dentalemon/src/features/workspace/hooks/use-share-pmd.ts
    - apps/dentalemon/src/features/workspace/hooks/use-save-chart.ts
    - apps/dentalemon/src/features/workspace/hooks/use-save-treatment.ts
  </read_first>

  <action>
Edit apps/dentalemon/src/routes/_workspace/$patientId.tsx with the following changes. Make surgical edits — change only what is specified below.

**1. Replace import block additions.**

Remove this import (no longer needed):
```typescript
import { useQueryClient } from '@tanstack/react-query';
import { apiBaseUrl } from '@/utils/config';
```

Add these imports (in the imports section, after the existing hook imports):
```typescript
import { useCreateVisit } from '@/features/workspace/hooks/use-create-visit';
import { useSharePMD } from '@/features/workspace/hooks/use-share-pmd';
import { useSaveChart } from '@/features/workspace/hooks/use-save-chart';
import { useSaveTreatment } from '@/features/workspace/hooks/use-save-treatment';
```

Note: `useQueryClient` can be removed entirely — invalidation is now inside the hooks.
Note: `apiBaseUrl` import can be removed entirely.
Note: `const API = apiBaseUrl;` line must also be removed.

**2. Add hook instantiations inside WorkspacePage, after the existing data hooks block.**

Replace:
```typescript
  // ── Mutations ─────────────────────────────────────────────────────────────
```

With:
```typescript
  // ── Mutations ─────────────────────────────────────────────────────────────
  const createVisitMutation = useCreateVisit(patientId);
  const sharePMDMutation = useSharePMD();
  const saveChartMutation = useSaveChart(currentVisitId);
  const saveTreatmentMutation = useSaveTreatment(currentVisitId);
```

**3. Replace handleNewVisit body.**

Replace:
```typescript
  async function handleNewVisit() {
    const res = await fetch(`${API}/dental/visits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        patientId,
        branchId: localStorage.getItem('currentBranchId') ?? '',
        dentistMemberId: localStorage.getItem('currentMemberId') ?? '',
      }),
    });
    if (!res.ok) return;
    const visit = await res.json();
    queryClient.invalidateQueries({ queryKey: ['dental-visits', patientId] });
    setCurrentVisitId(visit.id);
  }
```

With:
```typescript
  function handleNewVisit() {
    createVisitMutation.mutate(
      {
        patientId,
        branchId: localStorage.getItem('currentBranchId') ?? '',
        dentistMemberId: localStorage.getItem('currentMemberId') ?? '',
      },
      {
        onSuccess: (visit) => {
          setCurrentVisitId(visit.id);
        },
      },
    );
  }
```

**4. Replace handleSharePMD body.**

Replace:
```typescript
  async function handleSharePMD() {
    if (!currentVisitId) return;
    const res = await fetch(`${API}/dental/visits/${currentVisitId}/pmd`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ visitId: currentVisitId, patientId }),
    });
    if (res.ok) {
      const pmd = await res.json();
      if (navigator.share) {
        navigator.share({
          title: 'Portable Medical Document',
          text: `PMD for visit — Checksum: ${pmd.checksum}`,
        }).catch(() => {});
      }
      setPmdShared(true);
    }
  }
```

With:
```typescript
  function handleSharePMD() {
    if (!currentVisitId) return;
    sharePMDMutation.mutate(
      { visitId: currentVisitId, patientId },
      {
        onSuccess: (pmd) => {
          if (navigator.share) {
            navigator.share({
              title: 'Portable Medical Document',
              text: `PMD for visit — Checksum: ${pmd.checksum}`,
            }).catch(() => {});
          }
          setPmdShared(true);
        },
      },
    );
  }
```

**5. Replace handleSaveToothData body.**

Replace:
```typescript
  async function handleSaveToothData(data: ToothSlideoutData) {
    if (!currentVisitId || !selectedTooth) return;

    // Build updated teeth array for chart save
    const updatedTeeth: ToothData[] = [...teeth];
    const idx = updatedTeeth.findIndex((t) => t.toothNumber === selectedTooth);
    const toothEntry: ToothData = {
      toothNumber: selectedTooth,
      state: data.state as ToothData['state'],
      surfaces: data.surfaces,
      conditionCode: data.conditionCode,
    };
    if (idx >= 0) updatedTeeth[idx] = toothEntry;
    else updatedTeeth.push(toothEntry);

    await fetch(`${API}/dental/visits/${currentVisitId}/chart`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ visitId: currentVisitId, patientId, teeth: updatedTeeth }),
    });

    // Add treatment if a procedure was specified
    if (data.cdtCode && data.description && data.priceInput) {
      await fetch(`${API}/dental/visits/${currentVisitId}/treatments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          visitId: currentVisitId,
          patientId,
          cdtCode: data.cdtCode,
          description: data.description,
          toothNumber: selectedTooth,
          surfaces: data.surfaces,
          conditionCode: data.conditionCode,
          // priceInput is a string input; convert to number for the API
          priceAmount: parseFloat(data.priceInput) || 0,
          currency: 'PHP',
          status: 'diagnosed',
        }),
      });
      refetchTreatments();
    }

    refetchChart();
    clearSelection();
  }
```

With:
```typescript
  function handleSaveToothData(data: ToothSlideoutData) {
    if (!currentVisitId || !selectedTooth) return;

    // Build updated teeth array for chart save (logic stays in component)
    const updatedTeeth: ToothData[] = [...teeth];
    const idx = updatedTeeth.findIndex((t) => t.toothNumber === selectedTooth);
    const toothEntry: ToothData = {
      toothNumber: selectedTooth,
      state: data.state as ToothData['state'],
      surfaces: data.surfaces,
      conditionCode: data.conditionCode,
    };
    if (idx >= 0) updatedTeeth[idx] = toothEntry;
    else updatedTeeth.push(toothEntry);

    saveChartMutation.mutate(
      { visitId: currentVisitId, patientId, teeth: updatedTeeth },
      {
        onSuccess: () => {
          clearSelection();
        },
      },
    );

    // Add treatment if a procedure was specified
    if (data.cdtCode && data.description && data.priceInput) {
      saveTreatmentMutation.mutate({
        visitId: currentVisitId,
        patientId,
        cdtCode: data.cdtCode,
        description: data.description,
        toothNumber: selectedTooth,
        surfaces: data.surfaces,
        conditionCode: data.conditionCode,
        priceAmount: parseFloat(data.priceInput) || 0,
        currency: 'PHP',
        status: 'diagnosed',
      });
    }
  }
```

Note: `refetchChart()` and `refetchTreatments()` calls are removed — invalidation now happens inside the hooks' `onSuccess`. The `clearSelection()` moves into `saveChartMutation.onSuccess` callback.

**Verify the variable `refetchChart` and `refetchTreatments` are still destructured** from useDentalChart/useTreatments (they may still be used elsewhere or can be removed from destructuring if only handleSaveToothData used them). Remove from destructuring if unused after this change.
  </action>

  <acceptance_criteria>
    - grep -c "fetch(" apps/dentalemon/src/routes/_workspace/$patientId.tsx returns 0 (no raw fetch calls remain)
    - grep -c "apiBaseUrl" apps/dentalemon/src/routes/_workspace/$patientId.tsx returns 0
    - grep -c "useCreateVisit\|useSharePMD\|useSaveChart\|useSaveTreatment" apps/dentalemon/src/routes/_workspace/$patientId.tsx returns 4
    - bun run typecheck passes with no errors
  </acceptance_criteria>

  <verify>
    <automated>cd /Users/eladventures/Desktop/dentalemon && grep -c "fetch(" apps/dentalemon/src/routes/_workspace/$patientId.tsx && bun run typecheck 2>&1 | tail -5</automated>
  </verify>

  <done>$patientId.tsx has zero raw fetch() calls, imports four mutation hooks, typecheck clean.</done>
</task>

</tasks>

<verification>
```bash
cd /Users/eladventures/Desktop/dentalemon
grep -c "fetch(" apps/dentalemon/src/routes/_workspace/$patientId.tsx   # must be 0
grep -c "apiBaseUrl" apps/dentalemon/src/routes/_workspace/$patientId.tsx  # must be 0
bun run typecheck
```
</verification>

<success_criteria>
- No inline fetch() in $patientId.tsx
- No apiBaseUrl import in $patientId.tsx
- Four mutation hook imports present
- bun run typecheck clean
</success_criteria>

<output>
After completion, create .planning/phases/01-mutation-hooks-dead-code/01-plan2-SUMMARY.md
</output>
