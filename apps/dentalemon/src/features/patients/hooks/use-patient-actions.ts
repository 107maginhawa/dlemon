/**
 * usePatientActions — mutation hooks for patient archive, restore, bulk archive, export
 *
 * FR2.7: Archive patient
 * FR2.8: Restore archived patient
 * FR2.13: Export patients
 *
 * Uses generated SDK mutation helpers from @monobase/sdk-ts.
 * Each mutation invalidates the patient list cache on success.
 */
import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  archiveDentalPatientMutation,
  restoreDentalPatientMutation,
  bulkArchiveDentalPatientsMutation,
  updateDentalPatientMutation,
} from '@monobase/sdk-ts/generated/react-query';
import { exportDentalPatients } from '@monobase/sdk-ts/generated';
import { toastError } from '@/lib/error-toast';

// ─── shared cache-invalidation predicate ────────────────────────────────────
//
// Any patient mutation that adds/removes/renames an ACTIVE patient changes two
// derived collections, both read off the generated-SDK key shape
// [{ _id: 'listX', … }]:
//   - listDentalPatients      (the list)
//   - detectDuplicatePatients (the Find-Duplicates panel; scans ACTIVE patients
//     only — see patient.repo.ts#findDuplicateCandidates)
// ISSUE-019: create/archive/restore/bulk-archive/demographics-edit invalidated
// only the list, so the duplicates panel kept serving a 5-min-stale result
// (global staleTime is 5 min) — a just-created duplicate showed "no duplicates".
// Invalidate BOTH wherever the active set changes.
export function isPatientCollectionQuery(queryKey: readonly unknown[]): boolean {
  const id = (queryKey[0] as { _id?: string })?._id;
  return id === 'listDentalPatients' || id === 'detectDuplicatePatients';
}

// ─── useUpdatePatient (FR2.4) ───────────────────────────────────────────────

/** Demographics body the form can send (name / DOB / gender / contact — #14). */
export interface UpdatePatientDemographics {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  gender?: string;
  contactInfo?: { email?: string; phone?: string };
}

export function useUpdatePatient(patientId: string) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    ...updateDentalPatientMutation(),
    onSuccess: () => {
      // Refresh the single profile (getDentalPatient), the list, and the
      // duplicates panel (a name/DOB edit can form or resolve a match) so the
      // edit is reflected on reload (edit-save-reload journey).
      queryClient.invalidateQueries({
        predicate: (q) =>
          (q.queryKey[0] as { _id?: string })?._id === 'getDentalPatient' ||
          isPatientCollectionQuery(q.queryKey),
      });
    },
  });

  const update = (demographics: UpdatePatientDemographics) =>
    mutation.mutateAsync({ path: { id: patientId }, body: demographics });

  return {
    update,
    isPending: mutation.isPending,
    error: mutation.error as Error | null,
  };
}

// ─── useArchivePatient ──────────────────────────────────────────────────

export function useArchivePatient() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    ...archiveDentalPatientMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (q) => isPatientCollectionQuery(q.queryKey),
      });
    },
  });

  const archive = (patientId: string) => {
    mutation.mutate({ path: { id: patientId } });
  };

  return {
    archive,
    isPending: mutation.isPending,
    error: mutation.error as Error | null,
  };
}

// ─── useRestorePatient ──────────────────────────────────────────────────

export function useRestorePatient() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    ...restoreDentalPatientMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (q) => isPatientCollectionQuery(q.queryKey),
      });
    },
  });

  const restore = (patientId: string) => {
    mutation.mutate({ path: { id: patientId } });
  };

  return {
    restore,
    isPending: mutation.isPending,
    error: mutation.error as Error | null,
  };
}

// ─── useBulkArchive ─────────────────────────────────────────────────────

export function useBulkArchive() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    ...bulkArchiveDentalPatientsMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (q) => isPatientCollectionQuery(q.queryKey),
      });
    },
  });

  const bulkArchive = (patientIds: string[], reason = 'Bulk archived from patient list') => {
    mutation.mutate({ body: { ids: patientIds, reason } });
  };

  return {
    bulkArchive,
    isPending: mutation.isPending,
    error: mutation.error as Error | null,
  };
}

// ─── useExportPatients ──────────────────────────────────────────────────

export function useExportPatients(branchId?: string) {
  const [isExporting, setIsExporting] = useState(false);

  const exportPatients = useCallback(async () => {
    setIsExporting(true);
    try {
      // GET /dental/patients/export REQUIRES branchId (it 400s without it, to
      // prevent cross-branch leaks). The export call previously omitted it, so
      // the UI export button 400'd for every role. Pass the active branch.
      const { data } = await exportDentalPatients({
        query: { branchId: branchId ?? '' },
        throwOnError: true,
      });
      // Serialize to CSV (FR2.13)
      const headers = ['id', 'name', 'status', 'createdAt'];
      const rows = (data?.patients ?? []).map((p) => [
        p.id ?? '',
        p.displayName ?? '',
        p.status ?? '',
        p.createdAt ? new Date(p.createdAt).toISOString() : '',
      ]);
      const csvContent = [headers, ...rows]
        .map((row) =>
          row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','),
        )
        .join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `patients-export-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return data;
    } catch (err) {
      // Surface the failure instead of a silent no-op. Export is dentist_owner-only
      // server-side (assertBranchRole), so a staff role 403s — without this the user
      // clicked Export and saw nothing happen.
      toastError(err, 'Could not export patients. You may not have permission to export.');
      return undefined;
    } finally {
      setIsExporting(false);
    }
  }, [branchId]);

  return {
    exportPatients,
    isExporting,
  };
}
