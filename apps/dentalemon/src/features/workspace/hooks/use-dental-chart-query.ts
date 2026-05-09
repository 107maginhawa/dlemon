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
import { apiBaseUrl } from '@/utils/config';
import type { ToothData } from '../components/dental-chart.helpers';

interface UseDentalChartOptions {
  visitId: string | null;
}

export function useDentalChart({ visitId }: UseDentalChartOptions) {
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null);

  const query = useQuery({
    queryKey: ['dental-chart', visitId],
    queryFn: async (): Promise<ToothData[]> => {
      const res = await fetch(
        `${apiBaseUrl}/dental/visits/${visitId}/chart`,
        { credentials: 'include' },
      );
      if (!res.ok) throw new Error(`Failed to fetch chart (${res.status})`);
      const data = await res.json();
      return data.teeth ?? [];
    },
    enabled: !!visitId,
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
