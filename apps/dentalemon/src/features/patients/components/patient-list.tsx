/**
 * PatientList
 *
 * Renders a searchable grid of patient folder cards.
 * Supports follow-up filter toggle.
 *
 * Wireframe: docs/prd/context/wireframes/patient-list.html
 */

import React from 'react';
import { PatientFolderCard, type PatientCardData } from './patient-folder-card';

interface PatientListProps {
  patients: PatientCardData[];
  onSelect: (patient: PatientCardData) => void;
  searchQuery: string;
  followUpOnly?: boolean;
  onSearchChange?: (q: string) => void;
}

export function PatientList({
  patients,
  onSelect,
  searchQuery,
  followUpOnly = false,
  onSearchChange,
}: PatientListProps) {
  const filtered = patients.filter((p) => {
    const matchesSearch =
      !searchQuery ||
      p.displayName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFollowUp = !followUpOnly || p.needsFollowUp;
    return matchesSearch && matchesFollowUp;
  });

  return (
    <div className="flex flex-col gap-4">
      {/* Search */}
      <input
        type="text"
        placeholder="Search patients..."
        value={searchQuery}
        onChange={(e) => onSearchChange?.(e.target.value)}
        className="w-full max-w-sm rounded-lg border border-border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
        aria-label="Search patients"
      />

      {/* Grid or empty state */}
      {filtered.length === 0 ? (
        <div
          data-testid="patient-list-empty"
          className="text-center text-sm text-muted-foreground py-12"
        >
          No patients found.
        </div>
      ) : (
        <div className="flex flex-wrap gap-4">
          {filtered.map((p) => (
            <PatientFolderCard key={p.id} patient={p} onClick={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
}
