/**
 * useTreatments — TanStack Query hook for visit treatments
 *
 * Fetches the treatment plan for a given visit.
 * Fixes the treatment status bug: backend now uses 'diagnosed' | 'planned'
 * (not the old 'proposed' status).
 *
 * API: GET /dental/visits/:visitId/treatments
 */
import { useQuery } from '@tanstack/react-query';
import { listDentalTreatmentsOptions } from '@monobase/sdk-ts/generated/react-query';
import { type DentalTreatment } from '@monobase/sdk-ts/generated';

// Cause-fix (oli QA_ESCAPES §6): consume the generated SDK `DentalTreatment`
// instead of a hand-rolled view-model. The old type invented four fields the API
// never returns — `procedureCode`, `procedureName`, `currency`, `note` (live-
// confirmed 2026-06-04: GET /dental/visits/:id/treatments returns `cdtCode` +
// `description` + `priceCents`, none of those four) — so every consumer read of
// them was silently `undefined` (QA-003 class), hidden by the `as unknown as`.
// The ONE genuine derivation is `priceAmount` (QA-002: API sends integer cents,
// consumers display dollars). Everything else is now the real SDK shape, so tsc
// validates each field-access (and corrects toothNumber→optional, surfaces→
// ToothSurfaceCode[], createdAt→Date).
export type Treatment = DentalTreatment & {
  /** Derived from `priceCents` (÷100) at this read boundary — see QA-002. */
  priceAmount: number;
};

interface UseTreatmentsOptions {
  visitId: string | null;
}

export function useTreatments({ visitId }: UseTreatmentsOptions) {
  const query = useQuery({
    ...listDentalTreatmentsOptions({
      path: { visitId: visitId as string },
    }),
    enabled: !!visitId,
    select: (data) => {
      const items = Array.isArray(data) ? data : (data?.data ?? []);
      return items.map((it): Treatment => ({ ...it, priceAmount: (it.priceCents ?? 0) / 100 }));
    },
  });

  return {
    treatments: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
