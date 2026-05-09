/**
 * PatientList
 *
 * Searchable grid of patient folder cards with loading skeleton.
 * Filtering is done at the query level (usePatients hook) — this component
 * only handles client-side search text filtering.
 *
 * Wireframe: docs/prd/context/wireframes/patient-list.html
 */

import React from 'react';
import { PatientFolderCard, type PatientCardData } from './patient-folder-card';

interface PatientListProps {
  patients: PatientCardData[];
  isLoading?: boolean;
  onSelect: (patient: PatientCardData) => void;
  onProfile?: (patient: PatientCardData) => void;
  searchQuery: string;
  onSearchChange?: (q: string) => void;
}

export function PatientList({
  patients,
  isLoading = false,
  onSelect,
  onProfile,
  searchQuery,
  onSearchChange,
}: PatientListProps) {
  const filtered = searchQuery
    ? patients.filter((p) =>
        p.displayName.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : patients;

  return (
    <div className="flex flex-col gap-4">
      {/* Search */}
      <input
        type="text"
        placeholder="Search patients…"
        value={searchQuery}
        onChange={(e) => onSearchChange?.(e.target.value)}
        className="w-full max-w-sm rounded-lg border border-border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
        aria-label="Search patients"
      />

      {/* Loading skeleton */}
      {isLoading && (
        <div data-testid="patient-list-loading" className="flex flex-wrap gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="w-48 h-28 rounded-xl bg-muted animate-pulse"
              aria-hidden="true"
            />
          ))}
        </div>
      )}

      {/* Grid or empty state */}
      {!isLoading && filtered.length === 0 && (
        <div
          data-testid="patient-list-empty"
          className="text-center text-sm text-muted-foreground py-12"
        >
          No patients found.
        </div>
      )}

      {!isLoading && filtered.length > 0 && (
        <div className="flex flex-wrap gap-4">
          {filtered.map((p) => (
            <PatientFolderCard key={p.id} patient={p} onClick={onSelect} onProfile={onProfile} />
          ))}
        </div>
      )}
    </div>
  );
}
