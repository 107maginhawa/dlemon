/**
 * Patients Route — /patients
 *
 * Shows the patient list with search and registration modal.
 *
 * Wireframe: docs/prd/context/wireframes/patient-list.html
 */

import { createFileRoute, useNavigate } from '@tanstack/react-router';
import React, { useState } from 'react';
import { PatientList } from '@/features/patients/components/patient-list';
import { PatientRegistrationModal } from '@/features/patients/components/patient-registration-modal';
import type { PatientCardData } from '@/features/patients/components/patient-folder-card';

export const Route = createFileRoute('/_dashboard/patients')({
  component: PatientsPage,
});

// TODO Phase 1.1: fetch from API via TanStack Query + dental patient endpoint
const STUB_PATIENTS: PatientCardData[] = [];

function PatientsPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [followUpOnly, setFollowUpOnly] = useState(false);
  const [showRegistration, setShowRegistration] = useState(false);

  return (
    <div className="p-6 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Patients</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setFollowUpOnly(f => !f)}
            className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
              followUpOnly
                ? 'bg-yellow-400/20 border-yellow-400 text-yellow-700'
                : 'border-border hover:bg-secondary'
            }`}
            data-testid="follow-up-toggle"
          >
            Follow-up
          </button>
          <button
            onClick={() => setShowRegistration(true)}
            className="px-4 py-2 rounded-lg bg-primary text-sm font-medium hover:bg-primary/90 transition-colors"
            data-testid="register-patient-btn"
          >
            + New Patient
          </button>
        </div>
      </div>

      <PatientList
        patients={STUB_PATIENTS}
        onSelect={(patient) =>
          navigate({ to: '/$patientId', params: { patientId: patient.id } })
        }
        searchQuery={searchQuery}
        followUpOnly={followUpOnly}
        onSearchChange={setSearchQuery}
      />

      <PatientRegistrationModal
        open={showRegistration}
        onClose={() => setShowRegistration(false)}
        onSubmit={async (data) => {
          // TODO Phase 1.1: POST to /patients API
          console.log('Register patient:', data);
          setShowRegistration(false);
        }}
      />
    </div>
  );
}
