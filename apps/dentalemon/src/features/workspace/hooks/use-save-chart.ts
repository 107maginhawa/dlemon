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
import { upsertDentalChart } from '@monobase/sdk-ts/generated';
import { getDentalChartQueryKey } from '@monobase/sdk-ts/generated/react-query';
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
      const { data } = await upsertDentalChart({
        path: { visitId: input.visitId },
        body: { visitId: input.visitId, patientId: input.patientId, teeth: input.teeth as Parameters<typeof upsertDentalChart>[0]['body']['teeth'] },
        throwOnError: true,
      });
      return data;
    },
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({
        queryKey: getDentalChartQueryKey({ path: { visitId: input.visitId } }),
      });
    },
  });
}
