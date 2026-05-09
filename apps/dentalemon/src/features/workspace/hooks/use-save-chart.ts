/**
 * useSaveChart -- TanStack Query mutation for saving dental chart tooth data
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

export function useSaveChart() {
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
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({ queryKey: ['dental-chart', input.visitId] });
    },
  });
}
