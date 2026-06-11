/**
 * useCasePresentation — P1-20 patient-facing case presentation (Phase 1, staff session)
 *
 * Reads the patient-readable aggregate (phased ₱ breakdown + alternates + annotated
 * image refs) and exposes accept (e-sign) / reject mutations. Phase 1 runs entirely
 * under the staff bearerAuth session (operatory iPad); the public by-token path is
 * deferred to Phase 2.
 *
 * SDK-only data access: the generated TanStack Query hooks own the URL/auth/transport
 * (the OpenAPI contract is the source of truth). This hook only maps the SDK aggregate
 * into the view-model the presentational components consume.
 *
 * API: GET  /dental/patients/:patientId/case-presentations/:presentationId
 *      POST /dental/patients/:patientId/case-presentations/:presentationId/accept
 *      POST /dental/patients/:patientId/case-presentations/:presentationId/reject
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getCasePresentationOptions,
  getCasePresentationQueryKey,
  acceptCasePresentationMutation,
  rejectCasePresentationMutation,
} from '@monobase/sdk-ts/generated/react-query';
import type { DentalPatientFinanceModuleCasePresentationAggregate } from '@monobase/sdk-ts/generated';

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
  // FIX-002: the signed-acceptance legal artifact (who signed, when, why declined).
  // Previously write-only on the record; surfaced read-only by the accepted-plan viewer.
  signerName: string | null;
  decisionAt: string | null;
  rejectionReason: string | null;
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

type SdkAggregate = DentalPatientFinanceModuleCasePresentationAggregate;

// Map the SDK aggregate into the narrow, string-dated view-model the presentational
// components consume. The SDK presentation record carries the full BaseEntity; the
// view only needs id/patientId/treatmentPlanId/status/decision, and treats an
// undecided presentation as decision=null (the SDK enum omits the null variant).
function toViewModel(agg: SdkAggregate): CasePresentationAggregate {
  return {
    presentation: {
      id: agg.presentation.id,
      patientId: agg.presentation.patientId,
      treatmentPlanId: agg.presentation.treatmentPlanId,
      status: agg.presentation.status,
      decision: agg.presentation.decision ?? null,
      // SDK dates arrive as strings at runtime; keep the view-model string-dated.
      signerName: agg.presentation.signerName ?? null,
      decisionAt: (agg.presentation.decisionAt as unknown as string | null) ?? null,
      rejectionReason: agg.presentation.rejectionReason ?? null,
    },
    plan: {
      id: agg.plan.id,
      status: agg.plan.status,
      totalEstimateCents: agg.plan.totalEstimateCents,
    },
    patientFirstName: agg.patientFirstName,
    phases: agg.phases.map((p) => ({
      phase: p.phase,
      subtotalCents: p.subtotalCents,
      items: p.items.map(toLineItem),
    })),
    optionGroups: agg.optionGroups.map((g) => ({
      optionGroupId: g.optionGroupId,
      options: g.options.map(toLineItem),
    })),
    images: agg.images.map((img) => ({
      id: img.id,
      imageType: img.imageType,
      toothNumber: img.toothNumber,
      findingCount: img.findingCount,
    })),
    grandTotalCents: agg.grandTotalCents,
  };
}

function toLineItem(item: SdkAggregate['phases'][number]['items'][number]): CasePresentationLineItem {
  return {
    id: item.id,
    toothNumber: item.toothNumber,
    surfaces: item.surfaces,
    description: item.description,
    cdtCode: item.cdtCode,
    status: item.status,
    priceCents: item.priceCents,
    optionGroupId: item.optionGroupId,
    recommended: item.recommended,
  };
}

export function useCasePresentation(patientId: string, presentationId: string) {
  const qc = useQueryClient();
  const path = { patientId, presentationId };
  const queryKey = getCasePresentationQueryKey({ path });

  const query = useQuery({
    ...getCasePresentationOptions({ path }),
    enabled: Boolean(patientId && presentationId),
    staleTime: 15_000,
    select: (data): CasePresentationAggregate => toViewModel(data as SdkAggregate),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey });

  const accept = useMutation({
    ...acceptCasePresentationMutation(),
    onSuccess: invalidate,
  });

  const reject = useMutation({
    ...rejectCasePresentationMutation(),
    onSuccess: invalidate,
  });

  return {
    aggregate: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    accept: (input: { signerName: string; signatureData: string }) =>
      accept.mutateAsync({ path, body: input }),
    isAccepting: accept.isPending,
    reject: (input: { rejectionReason?: string }) =>
      reject.mutateAsync({ path, body: input }),
    isRejecting: reject.isPending,
  };
}
