/**
 * useStaffMembers — TanStack Query hook for GET /dental/org/members?branchId=
 * useStaffMutations — create (POST + PIN reset) and deactivate (DELETE) mutations
 *
 * Both mutations invalidate the listMembers cache on success.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listMembersOptions,
  listMembersQueryKey,
  createMemberMutation,
  resetMemberPinMutation,
  deactivateMemberMutation,
} from '@monobase/sdk-ts/generated/react-query';
import type { DentalOrgModuleDentalMembership, DentalOrgModuleCreateFlatMemberRequest } from '@monobase/sdk-ts/generated';

export type MemberRole = 'dentist_owner' | 'dentist_associate' | 'staff_full' | 'staff_scheduling';

export interface Member {
  id: string;
  branchId: string;
  displayName: string;
  role: MemberRole;
  status: 'active' | 'inactive';
  avatarUrl: string | null;
  createdAt: string;
}

export interface CreateMemberInput {
  displayName: string;
  role: string;
  pin: string;
}

// ─── Query key ───────────────────────────────────────────────────────────────

export function staffMembersKey(branchId: string) {
  return listMembersQueryKey({ query: { branchId } });
}

// ─── View-model mapper ────────────────────────────────────────────────────────

function toMember(m: DentalOrgModuleDentalMembership): Member {
  return {
    id: m.id,
    branchId: m.branchId,
    displayName: m.displayName,
    role: m.role as MemberRole,
    status: m.status as 'active' | 'inactive',
    avatarUrl: m.avatarUrl ?? null,
    createdAt: typeof m.createdAt === 'string' ? m.createdAt : (m.createdAt as Date).toISOString(),
  };
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useStaffMembers(branchId: string) {
  const query = useQuery({
    ...listMembersOptions({ query: { branchId } }),
    enabled: !!branchId,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    select: (data): Member[] => {
      const items = Array.isArray(data) ? data : (data?.data ?? []);
      return items.map(toMember);
    },
  });

  return {
    members: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}

export function useStaffMutations(branchId: string) {
  const queryClient = useQueryClient();

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: staffMembersKey(branchId) });

  // create = POST /dental/org/members, then reset-pin immediately after
  const createMut = useMutation({
    ...createMemberMutation(),
    onSuccess: invalidate,
  });

  const resetPinMut = useMutation({
    ...resetMemberPinMutation(),
  });

  const deactivateMut = useMutation({
    ...deactivateMemberMutation(),
    onSuccess: invalidate,
  });

  async function create(input: CreateMemberInput): Promise<Member> {
    const created = await createMut.mutateAsync({
      // branchId is a required query param on POST /dental/org/members (the
      // handler 400s without it). It was absent from the contract until the
      // createMember op gained @query branchId — without this the SDK cannot
      // scope the new member to a branch and every create fails 400.
      query: { branchId },
      body: { displayName: input.displayName, role: input.role as DentalOrgModuleCreateFlatMemberRequest['role'] },
    });
    // Set PIN immediately — narrow union: created is DentalOrgModuleDentalMembership on 201
    const member = created as DentalOrgModuleDentalMembership;
    try {
      await resetPinMut.mutateAsync({
        path: { memberId: member.id },
        body: { newPin: input.pin },
      });
    } catch {
      throw new Error('Staff member created but PIN setup failed. Use reset PIN to set the PIN.');
    }
    return toMember(member);
  }

  return {
    create,
    isCreating: createMut.isPending || resetPinMut.isPending,
    createError: (createMut.error ?? resetPinMut.error) as Error | null,
    resetCreate: () => { createMut.reset(); resetPinMut.reset(); },

    deactivate: (memberId: string) => deactivateMut.mutateAsync({ path: { memberId } }),
    isDeactivating: deactivateMut.isPending,
    deactivateError: deactivateMut.error as Error | null,
  };
}
