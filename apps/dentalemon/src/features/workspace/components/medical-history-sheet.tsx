/**
 * MedicalHistorySheet — sheet wrapper around MedicalHistoryForm
 *
 * Triggered from safety floor pill taps in the workspace.
 * Spec: docs/superpowers/specs/2026-05-09-workspace-reconciliation-design.md §4.8
 */

import React from 'react';
import { MedicalHistoryForm } from './medical-history-form';

export interface MedicalHistorySheetProps {
  patientId: string;
  open: boolean;
  onClose: () => void;
}

export function MedicalHistorySheet({ patientId, open, onClose }: MedicalHistorySheetProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-end"
      role="dialog"
      aria-modal="true"
      aria-label="Medical history"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Sheet */}
      <div
        data-testid="medical-history-sheet"
        className="relative w-full max-h-[85vh] bg-background rounded-t-2xl shadow-2xl flex flex-col"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-2.5 pb-1 flex-shrink-0">
          <div className="w-9 h-1 bg-muted-foreground/30 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-3 border-b flex-shrink-0">
          <h2 className="text-base font-semibold">Medical History</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close medical history"
            className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-muted-foreground text-sm"
          >
            ✕
          </button>
        </div>

        {/* Body — MedicalHistoryForm manages its own mutations */}
        <div className="flex-1 overflow-y-auto">
          <MedicalHistoryForm patientId={patientId} />
        </div>
      </div>
    </div>
  );
}
