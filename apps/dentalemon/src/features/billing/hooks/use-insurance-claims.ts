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
} from '@monobase/sdk-ts/generated/react-query';
import {
  updateInsuranceClaimStatus,
  recordClaimRemittance,
  estimateClaimCoverage,
  createCoverageAuthorization,
  updateCoverageAuthorizationStatus,
} from '@monobase/sdk-ts/generated';
import type { InsuranceClaimRow, InsuranceClaimStatus, PayerArRow, PayerArSummary } from '../components/insurance.helpers';

interface BranchOpt {
  branchId?: string | null;
}

export function useInsuranceClaims({ branchId, status }: BranchOpt & { status?: InsuranceClaimStatus }) {
  const query = useQuery({
    ...listInsuranceClaimsOptions({
      query: { branchId: branchId ?? undefined, status: status ?? undefined },
    }),
    enabled: Boolean(branchId),
    select: (data) => (data as unknown as { items: InsuranceClaimRow[]; total: number }),
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

export interface PayerArData {
  asOf: string;
  summary: PayerArSummary;
  payers: PayerArRow[];
}

export function usePayerArAging({ branchId }: BranchOpt) {
  const query = useQuery({
    ...getPayerArAgingOptions({ query: { branchId: branchId ?? undefined } }),
    enabled: Boolean(branchId),
    select: (data) => data as unknown as PayerArData,
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
    submit: submit.mutateAsync,
    isSubmitting: submit.isPending,
    markReady: markReady.mutateAsync,
    remit: remit.mutateAsync,
    isRemitting: remit.isPending,
    error: (submit.error ?? remit.error ?? markReady.error) as Error | null,
  };
}

export interface CoverageEstimateLine {
  cdtCode: string;
  billedAmountCents: number;
  description?: string;
}

export interface CoverageEstimateResult {
  estimatedCoveredCents: number;
  estimatedPatientPortionCents: number;
  estimatedBilledCents: number;
  cappedByAnnualLimit: boolean;
  uncoveredProcedures: string[];
  perLine: Array<{ cdtCode: string; coveredCents: number; patientPortionCents: number; uncovered: boolean }>;
}

export function useCoverageEstimate() {
  const mutation = useMutation({
    mutationFn: async (args: { patientId?: string; insuranceProfileId?: string; authorizationId?: string; lines: CoverageEstimateLine[] }) => {
      const { data } = await estimateClaimCoverage({ body: args, throwOnError: true });
      return data as unknown as CoverageEstimateResult;
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
    authorizations: (query.data ?? []) as unknown as Array<{ id: string; status: string; loaNumber: string | null; approvedAmountCents: number | null }>,
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

  return {
    create: create.mutateAsync,
    approve: approve.mutateAsync,
    isCreating: create.isPending,
    error: (create.error ?? approve.error) as Error | null,
  };
}
