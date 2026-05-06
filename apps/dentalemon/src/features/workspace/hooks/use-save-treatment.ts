/**
 * useSaveTreatment -- TanStack Query mutation for adding a treatment to a visit
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

export function useSaveTreatment() {
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
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({ queryKey: ['dental-treatments', input.visitId] });
    },
  });
}
