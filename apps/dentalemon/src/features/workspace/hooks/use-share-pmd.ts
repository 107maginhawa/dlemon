/**
 * useSharePMD -- TanStack Query mutation for sharing a Portable Medical Document
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
