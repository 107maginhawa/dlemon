/**
 * P1-26 — insurance / revenue-cycle hooks (TanStack Query + generated SDK).
 *
 * - useInsuranceClaims     : claim worklist (filter by status / payer / branch)
 * - usePayerArAging        : AR-by-payer aging buckets
 * - useClaimMutations      : submit (mark + attach reference) + record remittance
 * - useCoverageEstimate    : read-only coverage estimate (no persistence)
 * - usePatientAuthorizations / useAuthorizationMutations : LOA capture + approval
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listInsuranceClaimsOptions,
  listInsuranceClaimsQueryKey,
  getPayerArAgingOptions,
  getPayerArAgingQueryKey,
  listCoverageAuthorizationsOptions,
  listCoverageAuthorizationsQueryKey,
  listPatientInsuranceProfilesOptions,
  listPatientInsuranceProfilesQueryKey,
  getInsuranceClaimOptions,
  getInsuranceClaimQueryKey,
} from '@monobase/sdk-ts/generated/react-query';
import {
  createInsuranceClaim,
  addInsuranceClaimLine,
  updateInsuranceClaimLine,
  updateInsuranceClaimStatus,
  recordClaimRemittance,
  estimateClaimCoverage,
  createCoverageAuthorization,
  updateCoverageAuthorizationStatus,
  createInsuranceProfile,
  updateInsuranceProfile,
  type InsuranceClaimList,
  type PayerArAgingResponse,
  type CoverageEstimateResult,
  type DentalPatientFinanceModuleCoverageAuthorization,
  type DentalPatientFinanceModuleInsuranceProfile,
  type DentalPatientFinanceModuleCreateInsuranceProfileRequest,
  type DentalPatientFinanceModuleUpdateInsuranceProfileRequest,
  type InsuranceClaimWithLines,
} from '@monobase/sdk-ts/generated';
import { toInsuranceClaimRow } from '../components/insurance.helpers';
import type { InsuranceClaimStatus } from '../components/insurance.helpers';

interface BranchOpt {
  branchId?: string | null;
}

// Cause-fix (oli QA_ESCAPES §6): the generated SDK models every response in this
// file, so the previous local re-declarations + `as unknown as` casts were
// type-blinding. The query responses are typed `Payload | ErrorResponse` (the
// OpenAPI puts the error in the 200 slot), but the SDK queryFn uses
// throwOnError:true so an error surfaces via React Query's isError — at runtime
// `data` is always the success arm. We narrow off ErrorResponse with a single
// (non-`unknown`) `as`, then normalize the date fields the SDK over-types (these
// endpoints have NO response transformer → timestamps are ISO strings, §6).

export function useInsuranceClaims({ branchId, status }: BranchOpt & { status?: InsuranceClaimStatus }) {
  const query = useQuery({
    ...listInsuranceClaimsOptions({
      query: { branchId: branchId ?? undefined, status: status ?? undefined },
    }),
    enabled: Boolean(branchId),
    select: (data) => {
      const list = data as InsuranceClaimList;
      return { items: list.items.map(toInsuranceClaimRow), total: list.total };
    },
    staleTime: 30_000,
  });
  return {
    claims: query.data?.items ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}

// asOf is over-typed as Date by the SDK but getPayerArAging has no transformer →
// it is an ISO string at runtime (§6). Re-type it accordingly.
export type PayerArData = Omit<PayerArAgingResponse, 'asOf'> & { asOf: string };

export function usePayerArAging({ branchId }: BranchOpt) {
  const query = useQuery({
    ...getPayerArAgingOptions({ query: { branchId: branchId ?? undefined } }),
    enabled: Boolean(branchId),
    select: (data): PayerArData => {
      const r = data as PayerArAgingResponse;
      return { ...r, asOf: String(r.asOf) };
    },
    staleTime: 30_000,
  });
  return {
    aging: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}

export function useClaimMutations({ branchId }: BranchOpt) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: listInsuranceClaimsQueryKey({ query: { branchId: branchId ?? undefined } }) });
    queryClient.invalidateQueries({ queryKey: getPayerArAgingQueryKey({ query: { branchId: branchId ?? undefined } }) });
  };

  // Originate a claim (Phase 1b sub-slice A). Lines derive from the anchored
  // invoice server-side when none are supplied.
  const create = useMutation({
    mutationFn: async (args: { patientId: string; insuranceProfileId: string; invoiceId?: string; visitId?: string; authorizationId?: string }) => {
      const { data } = await createInsuranceClaim({ body: args, throwOnError: true });
      return data;
    },
    onSuccess: invalidate,
  });

  const submit = useMutation({
    mutationFn: async (args: { claimId: string; payerReference?: string; submissionChannel?: string }) => {
      const { data } = await updateInsuranceClaimStatus({
        path: { claimId: args.claimId },
        body: { status: 'submitted', payerReference: args.payerReference, submissionChannel: args.submissionChannel as never },
        throwOnError: true,
      });
      return data;
    },
    onSuccess: invalidate,
  });

  const markReady = useMutation({
    mutationFn: async (claimId: string) => {
      const { data } = await updateInsuranceClaimStatus({
        path: { claimId }, body: { status: 'ready' }, throwOnError: true,
      });
      return data;
    },
    onSuccess: invalidate,
  });

  const remit = useMutation({
    mutationFn: async (args: { claimId: string; amountCents: number; remittanceReference?: string; disallowanceCents?: number; disallowanceReason?: string }) => {
      const { data } = await recordClaimRemittance({
        path: { claimId: args.claimId },
        body: {
          amountCents: args.amountCents,
          remittanceReference: args.remittanceReference,
          disallowanceCents: args.disallowanceCents,
          disallowanceReason: args.disallowanceReason,
        },
        throwOnError: true,
      });
      return data;
    },
    onSuccess: invalidate,
  });

  return {
    create: create.mutateAsync,
    isCreating: create.isPending,
    submit: submit.mutateAsync,
    isSubmitting: submit.isPending,
    markReady: markReady.mutateAsync,
    remit: remit.mutateAsync,
    isRemitting: remit.isPending,
    error: (create.error ?? submit.error ?? remit.error ?? markReady.error) as Error | null,
  };
}

// Single claim + its lines (detail view / line editor).
export function useClaimDetail(claimId?: string | null) {
  const query = useQuery({
    ...getInsuranceClaimOptions({ path: { claimId: claimId ?? '' } }),
    enabled: Boolean(claimId),
    select: (data) => data as InsuranceClaimWithLines,
  });
  return {
    claim: (query.data ?? null) as InsuranceClaimWithLines | null,
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}

// Query key for the claim detail — handlers invalidate this after line edits.
export const claimDetailQueryKey = (claimId: string) => getInsuranceClaimQueryKey({ path: { claimId } });

// Add / update lines on a claim (line editor). Invalidates the claim detail (and
// the worklist totals) so the rollup re-renders from the server's recompute.
export function useClaimLineMutations(claimId: string, branchId?: string | null) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: claimDetailQueryKey(claimId) });
    queryClient.invalidateQueries({ queryKey: listInsuranceClaimsQueryKey({ query: { branchId: branchId ?? undefined } }) });
  };

  const addLine = useMutation({
    mutationFn: async (args: { cdtCode: string; description: string; billedAmountCents: number; treatmentId?: string; invoiceLineItemId?: string }) => {
      const { data } = await addInsuranceClaimLine({ path: { claimId }, body: args, throwOnError: true });
      return data;
    },
    onSuccess: invalidate,
  });

  const updateLine = useMutation({
    mutationFn: async (args: { lineId: string; billedAmountCents?: number; description?: string; approvedAmountCents?: number; paidAmountCents?: number; status?: 'pending' | 'covered' | 'partial' | 'disallowed' }) => {
      const { lineId, ...body } = args;
      const { data } = await updateInsuranceClaimLine({ path: { claimId, lineId }, body, throwOnError: true });
      return data;
    },
    onSuccess: invalidate,
  });

  return {
    addLine: addLine.mutateAsync,
    updateLine: updateLine.mutateAsync,
    isMutating: addLine.isPending || updateLine.isPending,
    error: (addLine.error ?? updateLine.error) as Error | null,
  };
}

// Patient insurance profiles — the payer picker for the create-claim form.
export function usePatientInsuranceProfiles(patientId?: string | null) {
  const query = useQuery({
    ...listPatientInsuranceProfilesOptions({ path: { patientId: patientId ?? '' } }),
    enabled: Boolean(patientId),
    staleTime: 30_000,
    select: (data) => (Array.isArray(data) ? (data as DentalPatientFinanceModuleInsuranceProfile[]) : []),
  });
  return {
    profiles: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error as Error | null,
  };
}

// PP-2 (ISSUE-036): create / update a patient's insurance profile. Lives here next
// to usePatientInsuranceProfiles + the query key so both the patient-profile
// Insurance card AND the claim payer-picker refresh off the SAME cache key after a
// write (the 001/002/003 cache-invalidation family). Consumed by the patients-feature
// InsuranceCard — insurance profiles are billing data surfaced on the profile.
export function useInsuranceProfileMutations(patientId?: string | null) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    if (patientId) {
      queryClient.invalidateQueries({ queryKey: listPatientInsuranceProfilesQueryKey({ path: { patientId } }) });
    }
  };

  const create = useMutation({
    mutationFn: async (body: DentalPatientFinanceModuleCreateInsuranceProfileRequest) => {
      const { data } = await createInsuranceProfile({ path: { patientId: patientId ?? '' }, body, throwOnError: true });
      return data;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async (args: { profileId: string; body: DentalPatientFinanceModuleUpdateInsuranceProfileRequest }) => {
      const { data } = await updateInsuranceProfile({ path: { patientId: patientId ?? '', profileId: args.profileId }, body: args.body, throwOnError: true });
      return data;
    },
    onSuccess: invalidate,
  });

  return {
    create: create.mutateAsync,
    update: update.mutateAsync,
    isSaving: create.isPending || update.isPending,
    error: (create.error ?? update.error) as Error | null,
  };
}

export interface CoverageEstimateLine {
  cdtCode: string;
  billedAmountCents: number;
  description?: string;
}

// Re-export the SDK result type (it fully models the estimate response — no dates)
// so callers keep importing it under the historical name without a local copy.
export type { CoverageEstimateResult };

export function useCoverageEstimate() {
  const mutation = useMutation({
    mutationFn: async (args: { patientId?: string; insuranceProfileId?: string; authorizationId?: string; lines: CoverageEstimateLine[] }) => {
      // throwOnError narrows the runtime value to the success arm; a single `as`
      // strips the ErrorResponse type-union member.
      const { data } = await estimateClaimCoverage({ body: args, throwOnError: true });
      return data as CoverageEstimateResult;
    },
  });
  return {
    estimate: mutation.mutateAsync,
    result: mutation.data ?? null,
    isEstimating: mutation.isPending,
    error: mutation.error as Error | null,
  };
}

export function usePatientAuthorizations(patientId?: string | null) {
  const query = useQuery({
    ...listCoverageAuthorizationsOptions({ path: { patientId: patientId ?? '' } }),
    enabled: Boolean(patientId),
    staleTime: 30_000,
  });
  return {
    // Narrow off the ErrorResponse union arm with a single `as`; the SDK auth type
    // carries the fields the LOA UI reads (id/status/loaNumber/approvedAmountCents).
    authorizations: (query.data ?? []) as DentalPatientFinanceModuleCoverageAuthorization[],
    isLoading: query.isLoading,
    error: query.error as Error | null,
  };
}

export function useAuthorizationMutations(patientId?: string | null) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    if (patientId) queryClient.invalidateQueries({ queryKey: listCoverageAuthorizationsQueryKey({ path: { patientId } }) });
  };

  const create = useMutation({
    mutationFn: async (args: { insuranceProfileId: string; loaNumber?: string; approvedAmountCents?: number }) => {
      const { data } = await createCoverageAuthorization({
        path: { patientId: patientId ?? '' },
        body: { insuranceProfileId: args.insuranceProfileId, loaNumber: args.loaNumber, approvedAmountCents: args.approvedAmountCents },
        throwOnError: true,
      });
      return data;
    },
    onSuccess: invalidate,
  });

  const approve = useMutation({
    mutationFn: async (args: { authorizationId: string; approvedAmountCents?: number }) => {
      const { data } = await updateCoverageAuthorizationStatus({
        path: { patientId: patientId ?? '', authorizationId: args.authorizationId },
        body: { status: 'approved', approvedAmountCents: args.approvedAmountCents },
        throwOnError: true,
      });
      return data;
    },
    onSuccess: invalidate,
  });

  const deny = useMutation({
    mutationFn: async (args: { authorizationId: string }) => {
      const { data } = await updateCoverageAuthorizationStatus({
        path: { patientId: patientId ?? '', authorizationId: args.authorizationId },
        body: { status: 'denied' },
        throwOnError: true,
      });
      return data;
    },
    onSuccess: invalidate,
  });

  return {
    create: create.mutateAsync,
    approve: approve.mutateAsync,
    deny: deny.mutateAsync,
    isCreating: create.isPending,
    isUpdating: approve.isPending || deny.isPending,
    error: (create.error ?? approve.error ?? deny.error) as Error | null,
  };
}
