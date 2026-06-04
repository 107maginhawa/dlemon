/**
 * useCasePresentation — P1-20 patient-facing case presentation (Phase 1, staff session)
 *
 * Reads the patient-readable aggregate (phased ₱ breakdown + alternates + annotated
 * image refs) and exposes accept (e-sign) / reject mutations. Phase 1 runs entirely
 * under the staff bearerAuth session (operatory iPad); the public by-token path is
 * deferred to Phase 2.
 *
 * API: GET  /dental/patients/:patientId/case-presentations/:presentationId
 *      POST /dental/patients/:patientId/case-presentations/:presentationId/accept
 *      POST /dental/patients/:patientId/case-presentations/:presentationId/reject
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiBaseUrl } from '@/lib/config';

export interface CasePresentationLineItem {
  id: string;
  toothNumber: number | null;
  surfaces: string[] | null;
  description: string;
  cdtCode: string;
  status: string;
  priceCents: number;
  optionGroupId: string | null;
  recommended: boolean;
}

export interface CasePresentationPhase {
  phase: string | null;
  items: CasePresentationLineItem[];
  subtotalCents: number;
}

export interface CasePresentationOptionGroup {
  optionGroupId: string;
  options: CasePresentationLineItem[];
}

export interface CasePresentationImageRef {
  id: string;
  imageType: string;
  toothNumber: number | null;
  findingCount: number;
}

export interface CasePresentationRecord {
  id: string;
  patientId: string;
  treatmentPlanId: string;
  status: string;
  decision: 'accepted' | 'rejected' | null;
}

export interface CasePresentationAggregate {
  presentation: CasePresentationRecord;
  plan: { id: string; status: string; totalEstimateCents: number };
  patientFirstName: string;
  phases: CasePresentationPhase[];
  optionGroups: CasePresentationOptionGroup[];
  images: CasePresentationImageRef[];
  grandTotalCents: number;
}

function presentationQueryKey(patientId: string, presentationId: string) {
  return ['dental-case-presentation', patientId, presentationId] as const;
}

export function useCasePresentation(patientId: string, presentationId: string) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: presentationQueryKey(patientId, presentationId),
    queryFn: async (): Promise<CasePresentationAggregate> => {
      const res = await fetch(
        `${apiBaseUrl}/dental/patients/${patientId}/case-presentations/${presentationId}`,
        { credentials: 'include' },
      );
      if (!res.ok) throw new Error(`Failed to load case presentation (${res.status})`);
      return res.json() as Promise<CasePresentationAggregate>;
    },
    enabled: Boolean(patientId && presentationId),
    staleTime: 15_000,
  });

  const accept = useMutation({
    mutationFn: async (input: { signerName: string; signatureData: string }) => {
      const res = await fetch(
        `${apiBaseUrl}/dental/patients/${patientId}/case-presentations/${presentationId}/accept`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        },
      );
      if (!res.ok) throw new Error(`Failed to accept case presentation (${res.status})`);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: presentationQueryKey(patientId, presentationId) });
    },
  });

  const reject = useMutation({
    mutationFn: async (input: { rejectionReason?: string }) => {
      const res = await fetch(
        `${apiBaseUrl}/dental/patients/${patientId}/case-presentations/${presentationId}/reject`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        },
      );
      if (!res.ok) throw new Error(`Failed to reject case presentation (${res.status})`);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: presentationQueryKey(patientId, presentationId) });
    },
  });

  return {
    aggregate: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    accept: (input: { signerName: string; signatureData: string }) => accept.mutateAsync(input),
    isAccepting: accept.isPending,
    reject: (input: { rejectionReason?: string }) => reject.mutateAsync(input),
    isRejecting: reject.isPending,
  };
}
