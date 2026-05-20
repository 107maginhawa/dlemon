/**
 * PatientList
 *
 * Searchable grid of patient folder cards with loading skeleton.
 * Supports bulk selection, archive/restore actions, and export.
 *
 * FR2.7: Archive patient (confirm dialog)
 * FR2.8: Restore archived patient (confirm dialog)
 * FR2.13: Export patients as JSON
 *
 * Wireframe: docs/prd/context/wireframes/patient-list.html
 */

import React, { useState, useCallback } from 'react';
import { PatientFolderCard, type PatientCardData } from './patient-folder-card';

interface PatientListProps {
  patients: PatientCardData[];
  isLoading?: boolean;
  onSelect: (patient: PatientCardData) => void;
  onProfile?: (patient: PatientCardData) => void;
  searchQuery: string;
  onSearchChange?: (q: string) => void;
  /** Current filter tab — controls which action buttons appear */
  activeFilter?: 'all' | 'active' | 'archived' | 'needs-follow-up';
  /** Archive a single patient */
  onArchive?: (patientId: string) => void;
  /** Restore a single archived patient */
  onRestore?: (patientId: string) => void;
  /** Bulk archive selected patients */
  onBulkArchive?: (patientIds: string[]) => void;
  /** Export all patients */
  onExport?: () => void;
  /** Whether archive/restore is in progress */
  isActionPending?: boolean;
  /** Whether export is in progress */
  isExporting?: boolean;
}

export function PatientList({
  patients,
  isLoading = false,
  onSelect,
  onProfile,
  searchQuery,
  onSearchChange,
  activeFilter,
  onArchive,
  onRestore,
  onBulkArchive,
  onExport,
  isActionPending = false,
  isExporting = false,
}: PatientListProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const filtered = searchQuery
    ? patients.filter((p) =>
        p.displayName.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : patients;

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((p) => p.id)));
    }
  }, [filtered, selectedIds.size]);

  const handleArchive = useCallback(
    (patientId: string, displayName: string) => {
      if (!onArchive) return;
      const confirmed = window.confirm(
        `Archive patient "${displayName}"? They will be moved to the archived list.`,
      );
      if (confirmed) {
        onArchive(patientId);
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(patientId);
          return next;
        });
      }
    },
    [onArchive],
  );

  const handleRestore = useCallback(
    (patientId: string, displayName: string) => {
      if (!onRestore) return;
      const confirmed = window.confirm(
        `Restore patient "${displayName}"? They will be moved back to the active list.`,
      );
      if (confirmed) {
        onRestore(patientId);
      }
    },
    [onRestore],
  );

  const handleBulkArchive = useCallback(() => {
    if (!onBulkArchive || selectedIds.size === 0) return;
    const confirmed = window.confirm(
      `Archive ${selectedIds.size} selected patient(s)?`,
    );
    if (confirmed) {
      onBulkArchive(Array.from(selectedIds));
      setSelectedIds(new Set());
    }
  }, [onBulkArchive, selectedIds]);

  const showArchiveActions = activeFilter === 'active' || activeFilter === 'all';
  const showRestoreActions = activeFilter === 'archived';
  const showBulkSelect = showArchiveActions && onBulkArchive;

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar: Search + Actions */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Search patients..."
          value={searchQuery}
          onChange={(e) => onSearchChange?.(e.target.value)}
          className="w-full max-w-sm rounded-lg border border-border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          aria-label="Search patients"
        />

        <div className="flex items-center gap-2 ml-auto">
          {/* Export button */}
          {onExport && (
            <button
              data-testid="export-patients-btn"
              onClick={onExport}
              disabled={isExporting}
              className="px-3 py-1.5 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
            >
              {isExporting ? 'Exporting...' : 'Export'}
            </button>
          )}

          {/* Bulk archive button — visible when items selected */}
          {showBulkSelect && selectedIds.size > 0 && (
            <button
              data-testid="bulk-archive-btn"
              onClick={handleBulkArchive}
              disabled={isActionPending}
              className="px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive text-sm font-medium hover:bg-destructive/20 transition-colors disabled:opacity-50"
            >
              Archive Selected ({selectedIds.size})
            </button>
          )}
        </div>
      </div>

      {/* Select all checkbox */}
      {showBulkSelect && filtered.length > 0 && !isLoading && (
        <label
          className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer"
          data-testid="select-all-checkbox"
        >
          <input
            type="checkbox"
            checked={selectedIds.size === filtered.length && filtered.length > 0}
            onChange={toggleSelectAll}
            className="rounded border-border"
          />
          Select all ({filtered.length})
        </label>
      )}

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
            <div key={p.id} className="relative flex flex-col">
              {/* Bulk select checkbox */}
              {showBulkSelect && (
                <label
                  className="absolute top-3 left-2 z-10 cursor-pointer"
                  data-testid={`select-patient-${p.id}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(p.id)}
                    onChange={() => toggleSelect(p.id)}
                    className="rounded border-border"
                  />
                </label>
              )}

              <PatientFolderCard patient={p} onClick={onSelect} onProfile={onProfile} />

              {/* Archive button for active patients */}
              {showArchiveActions && onArchive && p.status !== 'archived' && (
                <button
                  data-testid={`archive-btn-${p.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleArchive(p.id, p.displayName);
                  }}
                  disabled={isActionPending}
                  className="mt-1 text-xs text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                >
                  Archive
                </button>
              )}

              {/* Restore button for archived patients */}
              {showRestoreActions && onRestore && (
                <button
                  data-testid={`restore-btn-${p.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRestore(p.id, p.displayName);
                  }}
                  disabled={isActionPending}
                  className="mt-1 text-xs text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                >
                  Restore
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
