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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@monobase/ui';
import { PatientFolderCard, type PatientCardData } from './patient-folder-card';
import { ListErrorState } from '@/components/list-error-state';

/** Pending confirmation for a destructive patient action. */
type ConfirmState =
  | { kind: 'archive'; id: string; name: string }
  | { kind: 'restore'; id: string; name: string }
  | { kind: 'bulk'; count: number };

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
  /** Query errored — show the error state instead of the empty state */
  isError?: boolean;
  /** Error message to display in the error state */
  errorMessage?: string;
  /** Retry handler wired to the query's refetch */
  onRetry?: () => void;
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
  isError = false,
  errorMessage,
  onRetry,
}: PatientListProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

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
      setConfirm({ kind: 'archive', id: patientId, name: displayName });
    },
    [onArchive],
  );

  const handleRestore = useCallback(
    (patientId: string, displayName: string) => {
      if (!onRestore) return;
      setConfirm({ kind: 'restore', id: patientId, name: displayName });
    },
    [onRestore],
  );

  const handleBulkArchive = useCallback(() => {
    if (!onBulkArchive || selectedIds.size === 0) return;
    setConfirm({ kind: 'bulk', count: selectedIds.size });
  }, [onBulkArchive, selectedIds.size]);

  // The real action behind a confirmed dialog, dispatched by kind.
  const runConfirmedAction = useCallback(() => {
    if (!confirm) return;
    if (confirm.kind === 'archive') {
      onArchive?.(confirm.id);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(confirm.id);
        return next;
      });
    } else if (confirm.kind === 'restore') {
      onRestore?.(confirm.id);
    } else if (confirm.kind === 'bulk') {
      if (onBulkArchive) {
        onBulkArchive(Array.from(selectedIds));
        setSelectedIds(new Set());
      }
    }
    setConfirm(null);
  }, [confirm, onArchive, onRestore, onBulkArchive, selectedIds]);

  // Title/description copy derived from the pending confirmation kind.
  const confirmCopy = confirm
    ? confirm.kind === 'archive'
      ? {
          title: 'Archive patient?',
          description: `Archive patient "${confirm.name}"? They will be moved to the archived list.`,
        }
      : confirm.kind === 'restore'
        ? {
            title: 'Restore patient?',
            description: `Restore patient "${confirm.name}"? They will be moved back to the active list.`,
          }
        : {
            title: `Archive ${confirm.count} patients?`,
            description: `Archive ${confirm.count} selected patient(s)?`,
          }
    : null;

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

      {/* Error state — distinct from the empty "no patients" state */}
      {isError && (
        <ListErrorState
          message={errorMessage || 'Failed to load patients.'}
          onRetry={() => onRetry?.()}
        />
      )}

      {/* Loading skeleton */}
      {!isError && isLoading && (
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
      {!isError && !isLoading && filtered.length === 0 && (
        <div
          data-testid="patient-list-empty"
          className="text-center text-sm text-muted-foreground py-12"
        >
          No patients found.
        </div>
      )}

      {!isError && !isLoading && filtered.length > 0 && (
        <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(192px,max-content))] auto-rows-fr">
          {filtered.map((p) => (
            <div key={p.id} className="relative flex flex-col h-full">
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

      {/* Confirmation dialog — replaces native window.confirm for archive/restore/bulk */}
      <AlertDialog
        open={!!confirm}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
      >
        <AlertDialogContent data-testid="patient-confirm-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmCopy?.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmCopy?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="patient-confirm-cancel">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              data-testid="patient-confirm-action"
              onClick={runConfirmedAction}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
