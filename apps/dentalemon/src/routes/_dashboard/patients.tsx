/**
 * Patients Route — /patients
 *
 * Shows the patient list with search and registration modal.
 * FR2.1: Fetches patient list from API (GET /patients?branchId=...)
 * FR2.3: Registration modal posts to API (POST /persons + POST /patients)
 * FR2.20: Consent required before registration
 *
 * Wireframe: docs/prd/context/wireframes/patient-list.html
 */

import { createFileRoute, useNavigate } from '@tanstack/react-router';
import React, { useState, useEffect } from 'react';
import { PatientList } from '@/features/patients/components/patient-list';
import { PatientRegistrationModal } from '@/features/patients/components/patient-registration-modal';
import type { PatientCardData } from '@/features/patients/components/patient-folder-card';
import { apiBaseUrl } from '@/utils/config';

export const Route = createFileRoute('/_dashboard/patients')({
  component: PatientsPage,
});

const API = apiBaseUrl;

/**
 * Map the API patient response to the PatientCardData shape used by PatientFolderCard.
 * The API returns patient with expanded person data.
 */
function toPatientCard(p: any): PatientCardData {
  const person = typeof p.person === 'object' ? p.person : null;
  const firstName = person?.firstName ?? '';
  const lastName = person?.lastName ?? '';
  const displayName = p.displayName || [firstName, lastName].filter(Boolean).join(' ') || 'Unknown Patient';

  let age = 0;
  const dob = person?.dateOfBirth ?? p.dateOfBirth;
  if (dob) {
    const dobDate = new Date(dob);
    const today = new Date();
    age = today.getFullYear() - dobDate.getFullYear();
    if (today < new Date(today.getFullYear(), dobDate.getMonth(), dobDate.getDate())) age--;
  }

  return {
    id: p.id,
    displayName,
    age,
    lastVisit: p.lastVisit ? new Date(p.lastVisit) : undefined,
    visitCount: p.visitCount ?? 0,
    needsFollowUp: p.needsFollowUp ?? false,
    hasBalance: p.hasBalance ?? p.hasActivePaymentPlan ?? false,
  };
}

function PatientsPage() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState<PatientCardData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [followUpOnly, setFollowUpOnly] = useState(false);
  const [showRegistration, setShowRegistration] = useState(false);

  const branchId = localStorage.getItem('currentBranchId') ?? '';

  async function fetchPatients(search?: string) {
    try {
      const params = new URLSearchParams();
      if (search) params.set('q', search);
      if (branchId) params.set('branchId', branchId);
      const res = await fetch(
        `${API}/dental/patients${params.toString() ? `?${params}` : ''}`,
        { credentials: 'include' },
      );
      if (!res.ok) return;
      const data = await res.json();
      const items = Array.isArray(data) ? data : (data.patients ?? data.data ?? data.items ?? []);
      setPatients(items.map(toPatientCard));
    } catch {
      // Network error — keep existing list
    }
  }

  useEffect(() => {
    fetchPatients();
  }, []);

  async function handleRegister(data: {
    displayName: string;
    dateOfBirth: string;
    gender: string;
    consentGiven: boolean;
  }) {
    // FR2.3/FR2.20: Use dental patient registration endpoint (staff creating patient for another person)
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
    // Refresh list to show newly registered patient
    await fetchPatients();
  }

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
        patients={patients}
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
        onSubmit={handleRegister}
      />
    </div>
  );
}
