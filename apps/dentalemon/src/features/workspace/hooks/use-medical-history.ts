/**
 * useMedicalHistory — TanStack Query hooks for patient medical history
 *
 * API:
 *   GET  /dental/clinical/medical-history?patientId=  → { items, total }
 *   POST /dental/clinical/medical-history             → create entry
 *   PATCH /dental/clinical/medical-history/{entryId}  → update entry (toggle active, add notes)
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiBaseUrl } from '@/utils/config';

const API = apiBaseUrl;

export type MedicalHistoryEntryType =
  | 'condition'
  | 'medication'
  | 'allergy'
  | 'procedure'
  | 'vaccination'
  | 'familyHistory';

export interface MedicalHistoryEntry {
  id: string;
  patientId: string;
  entryType: MedicalHistoryEntryType;
  codeSystem?: string | null;
  code?: string | null;
  displayName: string;
  notes?: string | null;
  onsetDate?: string | null;
  resolvedDate?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEntryInput {
  patientId: string;
  entryType: MedicalHistoryEntryType;
  displayName: string;
  codeSystem?: string;
  code?: string;
  notes?: string;
}

export interface UpdateEntryInput {
  active?: boolean;
  notes?: string;
  displayName?: string;
  resolvedDate?: string;
}

export function medicalHistoryKey(patientId: string) {
  return ['medical-history', patientId] as const;
}

async function fetchMedicalHistory(patientId: string): Promise<MedicalHistoryEntry[]> {
  const res = await fetch(
    `${API}/dental/clinical/medical-history?patientId=${encodeURIComponent(patientId)}&limit=200`,
    { credentials: 'include' },
  );
  if (!res.ok) throw new Error(`Failed to load medical history (${res.status})`);
  const data = await res.json();
  return Array.isArray(data) ? data : (data.items ?? []);
}

async function createEntry(input: CreateEntryInput): Promise<MedicalHistoryEntry> {
  const res = await fetch(`${API}/dental/clinical/medical-history`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Failed to create entry (${res.status})`);
  return res.json();
}

async function updateEntry(entryId: string, patch: UpdateEntryInput): Promise<MedicalHistoryEntry> {
  const res = await fetch(`${API}/dental/clinical/medical-history/${entryId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`Failed to update entry (${res.status})`);
  return res.json();
}

export function useMedicalHistory(patientId: string) {
  const query = useQuery({
    queryKey: medicalHistoryKey(patientId),
    queryFn: () => fetchMedicalHistory(patientId),
    enabled: !!patientId,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  return {
    entries: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error as Error | null,
  };
}

export function useMedicalHistoryMutations(patientId: string) {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: medicalHistoryKey(patientId) });

  const addMutation = useMutation({
    mutationFn: (input: CreateEntryInput) => createEntry(input),
    onSuccess: invalidate,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ entryId, active }: { entryId: string; active: boolean }) =>
      updateEntry(entryId, { active }),
    onSuccess: invalidate,
  });

  const updateNotesMutation = useMutation({
    mutationFn: ({ entryId, patch }: { entryId: string; patch: UpdateEntryInput }) =>
      updateEntry(entryId, patch),
    onSuccess: invalidate,
  });

  return {
    addEntry: addMutation.mutateAsync,
    isAdding: addMutation.isPending,
    addError: addMutation.error as Error | null,

    toggleEntry: toggleMutation.mutateAsync,
    isToggling: toggleMutation.isPending,

    updateEntry: updateNotesMutation.mutateAsync,
    isSaving: addMutation.isPending || updateNotesMutation.isPending,
    saveError: (addMutation.error ?? updateNotesMutation.error) as Error | null,
  };
}
