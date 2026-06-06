/**
 * useCasePresentations — P1-20 staff entry: list + mint case presentations for a patient.
 *
 * Used by the "Present to patient" action in the treatment-plans sheet. Minting stays
 * behind the staff bearerAuth session (Phase 1); no token is generated in this pass.
 *
 * SDK-only data access: the generated TanStack Query hooks own the URL/auth/transport;
 * this hook only adapts the result into the summary view-model the UI consumes.
 *
 * API: GET  /dental/patients/:patientId/case-presentations
 *      POST /dental/patients/:patientId/case-presentations
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listCasePresentationsOptions,
  listCasePresentationsQueryKey,
  createCasePresentationMutation,
} from '@monobase/sdk-ts/generated/react-query';
import type { DentalPatientFinanceModuleCasePresentation } from '@monobase/sdk-ts/generated';

export interface CasePresentationSummary {
  id: string;
  patientId: string;
  treatmentPlanId: string;
  status: string;
  decision: 'accepted' | 'rejected' | null;
  createdAt: string;
}

const toIso = (d: Date | string | undefined): string =>
  d == null ? '' : d instanceof Date ? d.toISOString() : String(d);

function toSummary(rec: DentalPatientFinanceModuleCasePresentation): CasePresentationSummary {
  return {
    id: rec.id,
    patientId: rec.patientId,
    treatmentPlanId: rec.treatmentPlanId,
    status: rec.status,
    decision: rec.decision ?? null,
    createdAt: toIso(rec.createdAt),
  };
}

export function useCasePresentations(patientId: string) {
  const qc = useQueryClient();
  const path = { patientId };
  const queryKey = listCasePresentationsQueryKey({ path });

  const query = useQuery({
    ...listCasePresentationsOptions({ path }),
    enabled: Boolean(patientId),
    staleTime: 15_000,
    select: (data): CasePresentationSummary[] => {
      const items = (Array.isArray(data) ? data : []) as DentalPatientFinanceModuleCasePresentation[];
      return items.map(toSummary);
    },
  });

  const create = useMutation({
    ...createCasePresentationMutation(),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  return {
    presentations: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    present: async (treatmentPlanId: string, planVersionId?: string): Promise<CasePresentationSummary> => {
      const created = await create.mutateAsync({
        path,
        body: { treatmentPlanId, ...(planVersionId ? { planVersionId } : {}) },
      });
      // The 201 body is the new record; narrow off the ErrorResponse union member.
      if (!created || !('id' in created)) {
        throw new Error('Failed to create case presentation');
      }
      return toSummary(created as DentalPatientFinanceModuleCasePresentation);
    },
    isPresenting: create.isPending,
  };
}
