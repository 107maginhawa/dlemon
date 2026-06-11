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

// ─── useUpdatePatient (FR2.4) ───────────────────────────────────────────────

/** Demographics body the form can send (name / DOB / gender). */
export interface UpdatePatientDemographics {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  gender?: string;
}

export function useUpdatePatient(patientId: string) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    ...updateDentalPatientMutation(),
    onSuccess: () => {
      // Refresh the single profile (getDentalPatient) and the list so the edit
      // is reflected on reload (edit-save-reload journey).
      queryClient.invalidateQueries({
        predicate: (q) => {
          const id = (q.queryKey[0] as { _id?: string })?._id;
          return id === 'getDentalPatient' || id === 'listDentalPatients';
        },
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
        predicate: (q) => (q.queryKey[0] as { _id?: string })?._id === 'listDentalPatients',
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
        predicate: (q) => (q.queryKey[0] as { _id?: string })?._id === 'listDentalPatients',
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
        predicate: (q) => (q.queryKey[0] as { _id?: string })?._id === 'listDentalPatients',
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
    } finally {
      setIsExporting(false);
    }
  }, [branchId]);

  return {
    exportPatients,
    isExporting,
  };
}
