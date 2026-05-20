/**
 * useDentalChart — TanStack Query hook for visit chart data
 *
 * Replaces the closure-based use-dental-chart.ts (not React state).
 * Fetches tooth states for a given visit and manages selected tooth.
 *
 * API: GET /dental/visits/:visitId/chart
 */
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { getDentalChartOptions } from '@monobase/sdk-ts/generated/react-query';
import type { ToothData } from '../components/dental-chart.helpers';

interface UseDentalChartOptions {
  visitId: string | null;
}

export function useDentalChart({ visitId }: UseDentalChartOptions) {
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null);

  const query = useQuery({
    ...getDentalChartOptions({
      path: { visitId: visitId as string },
    }),
    enabled: !!visitId,
    select: (data) => {
      const chart = data as { teeth?: ToothData[] } | null;
      return chart?.teeth ?? [];
    },
  });

  function selectTooth(toothNumber: number) {
    setSelectedTooth((prev) => (prev === toothNumber ? null : toothNumber));
  }

  function clearSelection() {
    setSelectedTooth(null);
  }

  return {
    teeth: query.data ?? [],
    selectedTooth,
    selectTooth,
    clearSelection,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
