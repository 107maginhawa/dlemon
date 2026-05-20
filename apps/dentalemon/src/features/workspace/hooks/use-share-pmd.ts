/**
 * useSharePMD -- TanStack Query mutation for sharing a Portable Medical Document
 *
 * Replaces the inline fetch in handleSharePMD() in $patientId.tsx.
 * API: POST /dental/visits/:visitId/pmd
 * Returns PMD payload including checksum for Web Share API.
 */
import { useMutation } from '@tanstack/react-query';
import { generatePmd } from '@monobase/sdk-ts/generated';

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
      const { data } = await generatePmd({
        path: { visitId: input.visitId },
        body: { patientId: input.patientId } as Parameters<typeof generatePmd>[0]['body'],
        throwOnError: true,
      });
      return data as unknown as PMDResult;
    },
  });
}
