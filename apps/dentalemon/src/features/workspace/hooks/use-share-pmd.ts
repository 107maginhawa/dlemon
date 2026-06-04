/**
 * useSharePMD -- TanStack Query mutation for sharing a Portable Medical Document
 *
 * Replaces the inline fetch in handleSharePMD() in $patientId.tsx.
 * API: POST /dental/visits/:visitId/pmd
 * Returns PMD payload including checksum for Web Share API.
 */
import { useMutation } from '@tanstack/react-query';
import { generatePmd } from '@monobase/sdk-ts/generated';
import { toastError } from '@/lib/error-toast';

interface SharePMDInput {
  visitId: string;
  patientId: string;
}

export function useSharePMD() {
  return useMutation({
    // Cause-fix (oli QA_ESCAPES §6): the SDK GeneratePmdRequest body requires both
    // visitId and patientId — the previous body sent only { patientId } behind an
    // `as Parameters<…>` cast. Send the full, SDK-typed body and let the
    // PmdDocument response flow (consumer reads .checksum); both casts removed.
    mutationFn: async (input: SharePMDInput) => {
      const { data } = await generatePmd({
        path: { visitId: input.visitId },
        body: { visitId: input.visitId, patientId: input.patientId },
        throwOnError: true,
      });
      return data;
    },
    // V-FE-ERR-001: surface PMD generation/share failures rather than letting
    // the rejected promise fall through silently.
    onError: (err) => {
      toastError(err, 'Failed to share medical document. Please try again.');
    },
  });
}
