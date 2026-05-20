/**
 * useStaffMembers — TanStack Query hook for GET /dental/org/members?branchId=
 * useStaffMutations — create (POST + PIN reset) and deactivate (DELETE) mutations
 *
 * Both mutations invalidate ['staff-members', branchId] on success.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiBaseUrl } from '@/utils/config';

const API = apiBaseUrl;

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
  return ['staff-members', branchId] as const;
}

// ─── Fetch helpers ────────────────────────────────────────────────────────────

async function fetchStaffMembers(branchId: string): Promise<Member[]> {
  const res = await fetch(`${API}/dental/org/members?branchId=${encodeURIComponent(branchId)}`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`Failed to load staff members (${res.status})`);
  const data = await res.json();
  return Array.isArray(data) ? data : (data.data ?? data.items ?? data.members ?? []);
}

async function createMember(branchId: string, input: CreateMemberInput): Promise<Member> {
  const createRes = await fetch(`${API}/dental/org/members?branchId=${encodeURIComponent(branchId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ displayName: input.displayName, role: input.role }),
  });
  if (!createRes.ok) throw new Error(`Failed to create staff member (${createRes.status})`);
  const created: Member = await createRes.json();

  const pinRes = await fetch(`${API}/dental/org/members/${created.id}/reset-pin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ newPin: input.pin }),
  });
  if (!pinRes.ok) throw new Error('Staff member created but PIN setup failed. Use reset PIN to set the PIN.');

  return created;
}

async function deactivateMember(memberId: string): Promise<void> {
  const res = await fetch(`${API}/dental/org/members/${memberId}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`Failed to deactivate member (${res.status})`);
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useStaffMembers(branchId: string) {
  const query = useQuery({
    queryKey: staffMembersKey(branchId),
    queryFn: () => fetchStaffMembers(branchId),
    enabled: !!branchId,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
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

  const createMutation = useMutation({
    mutationFn: (input: CreateMemberInput) => createMember(branchId, input),
    onSuccess: invalidate,
  });

  const deactivateMutation = useMutation({
    mutationFn: (memberId: string) => deactivateMember(memberId),
    onSuccess: invalidate,
  });

  return {
    create: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    createError: createMutation.error as Error | null,
    resetCreate: createMutation.reset,

    deactivate: deactivateMutation.mutateAsync,
    isDeactivating: deactivateMutation.isPending,
    deactivateError: deactivateMutation.error as Error | null,
  };
}
