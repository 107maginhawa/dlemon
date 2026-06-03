/**
 * Patients Route — /patients
 *
 * Patient list with search, filter tabs, and registration modal.
 * FR2.1: Fetches patient list via usePatients hook (GET /dental/patients)
 * FR2.3: Registration modal posts to API
 * FR2.20: Consent required before registration
 *
 * Wireframe: docs/prd/context/wireframes/patient-list.html
 */

import { createFileRoute, useNavigate } from '@tanstack/react-router';
import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { PatientList } from '@/features/patients/components/patient-list';
import { PatientRegistrationModal } from '@/features/patients/components/patient-registration-modal';
import { PatientFilterTabs, type PatientFilter } from '@/features/patients/components/patient-filter-tabs';
import { DuplicatePatientsPanel } from '@/features/patients/components/duplicate-patients-panel';
import type { PatientCardData } from '@/features/patients/components/patient-folder-card';
import { usePatients } from '@/features/patients/hooks/use-patients';
import {
  useArchivePatient,
  useRestorePatient,
  useBulkArchive,
  useExportPatients,
} from '@/features/patients/hooks/use-patient-actions';
import { apiBaseUrl } from '@/lib/config';
import { useOrgContextStore } from '@/stores/org-context.store';

export const Route = createFileRoute('/_dashboard/patients')({
  component: PatientsPage,
});

const API = apiBaseUrl;

function PatientsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<PatientFilter>('all');
  const [showRegistration, setShowRegistration] = useState(false);
  // P2-16: toggle the duplicate-detection review panel.
  const [showDuplicates, setShowDuplicates] = useState(false);

  const branchId = useOrgContextStore((s) => s.branchId) ?? undefined;

  const { archive, isPending: isArchivePending } = useArchivePatient();
  const { restore, isPending: isRestorePending } = useRestorePatient();
  const { bulkArchive, isPending: isBulkPending } = useBulkArchive();
  const { exportPatients, isExporting } = useExportPatients();

  const { patients, isLoading, error, refetch } = usePatients({
    branchId,
    searchQuery: searchQuery || undefined,
    status: activeFilter === 'all' ? undefined : activeFilter === 'archived' ? 'archived' : 'active',
    needsFollowUp: activeFilter === 'needs-follow-up' ? true : undefined,
  });

  async function handleRegister(data: {
    displayName: string;
    dateOfBirth: string;
    gender: string;
    consentGiven: boolean;
    communicationConsent?: { sms: boolean; email: boolean; phone: boolean; marketing: boolean };
  }) {
    const res = await fetch(`${API}/dental/patients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        displayName: data.displayName,
        dateOfBirth: data.dateOfBirth || undefined,
        gender: data.gender || undefined,
        consentGiven: data.consentGiven,
        branchId: branchId || undefined,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => null);
      const message = err?.message ?? `Registration failed (${res.status})`;
      alert(message);
      return;
    }

    // P1-28: persist per-channel communication consent on the new patient.
    const created = (await res.json().catch(() => null)) as { id?: string } | null;
    if (created?.id && data.communicationConsent) {
      await fetch(`${API}/dental/patients/${created.id}/communication-consent`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data.communicationConsent),
      }).catch(() => {
        /* non-blocking: registration already succeeded */
      });
    }

    setShowRegistration(false);
    // Invalidate the patients query so the list refreshes
    queryClient.invalidateQueries({ queryKey: ['dental-patients'] });
  }

  return (
    <div className="p-6 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Patients</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDuplicates((v) => !v)}
            aria-pressed={showDuplicates}
            className={[
              'px-3 py-2 rounded-lg text-sm font-medium border transition-colors',
              showDuplicates
                ? 'border-lemon bg-[#FFF9DB] text-lemon-foreground'
                : 'border-border text-muted-foreground hover:text-foreground',
            ].join(' ')}
            data-testid="find-duplicates-btn"
          >
            {showDuplicates ? 'Back to list' : 'Find duplicates'}
          </button>
          <button
            onClick={() => setShowRegistration(true)}
            className="px-4 py-2 rounded-lg bg-lemon text-lemon-foreground text-sm font-medium hover:bg-lemon-hover transition-colors"
            data-testid="register-patient-btn"
          >
            + New Patient
          </button>
        </div>
      </div>

      {showDuplicates ? (
        /* P2-16: duplicate-patient review */
        <DuplicatePatientsPanel branchId={branchId ?? null} />
      ) : (
      <>
      {/* Filter tabs */}
      <PatientFilterTabs
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
      />

      {/* Patient list */}
      <PatientList
        patients={patients}
        isLoading={isLoading}
        isError={!!error}
        errorMessage={error ? 'Failed to load patients.' : undefined}
        onRetry={() => refetch()}
        onSelect={(patient: PatientCardData) =>
          navigate({ to: '/$patientId', params: { patientId: patient.id } })
        }
        onProfile={(patient: PatientCardData) =>
          navigate({ to: '/patients/$patientId', params: { patientId: patient.id } } as any)
        }
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        activeFilter={activeFilter}
        onArchive={archive}
        onRestore={restore}
        onBulkArchive={bulkArchive}
        onExport={exportPatients}
        isActionPending={isArchivePending || isRestorePending || isBulkPending}
        isExporting={isExporting}
      />
      </>
      )}

      <PatientRegistrationModal
        open={showRegistration}
        onClose={() => setShowRegistration(false)}
        onSubmit={handleRegister}
      />
    </div>
  );
}
