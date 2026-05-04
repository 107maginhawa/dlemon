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
import type { PatientCardData } from '@/features/patients/components/patient-folder-card';
import { usePatients } from '@/features/patients/hooks/use-patients';
import { apiBaseUrl } from '@/utils/config';

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

  const branchId = localStorage.getItem('currentBranchId') ?? undefined;

  const { patients, isLoading, error } = usePatients({
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

    setShowRegistration(false);
    // Invalidate the patients query so the list refreshes
    queryClient.invalidateQueries({ queryKey: ['dental-patients'] });
  }

  return (
    <div className="p-6 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Patients</h1>
        <button
          onClick={() => setShowRegistration(true)}
          className="px-4 py-2 rounded-lg bg-[#FFE97D] text-[#4A4018] text-sm font-medium hover:bg-[#F5DC60] transition-colors"
          data-testid="register-patient-btn"
        >
          + New Patient
        </button>
      </div>

      {/* Filter tabs */}
      <PatientFilterTabs
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
      />

      {/* Error state */}
      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Failed to load patients. Please refresh.
        </div>
      )}

      {/* Patient list */}
      <PatientList
        patients={patients}
        isLoading={isLoading}
        onSelect={(patient: PatientCardData) =>
          navigate({ to: '/$patientId', params: { patientId: patient.id } })
        }
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <PatientRegistrationModal
        open={showRegistration}
        onClose={() => setShowRegistration(false)}
        onSubmit={handleRegister}
      />
    </div>
  );
}
