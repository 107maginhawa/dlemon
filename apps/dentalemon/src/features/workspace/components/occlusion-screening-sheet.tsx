/**
 * OcclusionScreeningSheet — bottom sheet for occlusion screenings
 * (PP-7 sub-slice 3 / ISSUE-044).
 *
 * Lists a patient's occlusion screenings and lets staff record a new one
 * (Angle class, overjet/overbite, crossbite/crowding/spacing, midline, notes).
 * Create + list only — no update/delete endpoint exists. Mirrors RecallsSheet.
 */
import React, { useState } from 'react';
import { useSheetA11y } from '@/hooks/use-sheet-a11y';
import { X, Activity, Plus } from 'lucide-react';
import {
  useOcclusionScreenings,
  OCCLUSION_CLASSES,
  OCCLUSION_CLASS_LABELS,
  type OcclusionClass,
  type OcclusionScreening,
  type CreateOcclusionScreeningBody,
} from '../hooks/use-occlusion-screenings';

interface OcclusionScreeningSheetProps {
  patientId: string;
  open: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Row
// ---------------------------------------------------------------------------

function ScreeningRow({ screening }: { screening: OcclusionScreening }) {
  const flags = [
    screening.crossbite ? 'Crossbite' : null,
    screening.crowding ? 'Crowding' : null,
    screening.spacing ? 'Spacing' : null,
  ].filter(Boolean) as string[];

  const metrics = [
    screening.overjetMm != null ? `Overjet ${screening.overjetMm}mm` : null,
    screening.overbiteMm != null ? `Overbite ${screening.overbiteMm}mm` : null,
  ].filter(Boolean) as string[];

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-background p-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
          {OCCLUSION_CLASS_LABELS[screening.angleClass]}
        </span>
        {flags.map((flag) => (
          <span
            key={flag}
            className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700"
          >
            {flag}
          </span>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">
          {new Date(screening.createdAt).toLocaleDateString()}
        </span>
      </div>
      {(metrics.length > 0 || screening.midlineDeviation) && (
        <p className="text-xs text-muted-foreground">
          {[...metrics, screening.midlineDeviation ? `Midline: ${screening.midlineDeviation}` : null]
            .filter(Boolean)
            .join(' · ')}
        </p>
      )}
      {screening.notes && (
        <p className="text-xs text-muted-foreground line-clamp-2">{screening.notes}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sheet
// ---------------------------------------------------------------------------

export function OcclusionScreeningSheet({ patientId, open, onClose }: OcclusionScreeningSheetProps) {
  // WCAG 2.4.3: Escape closes the sheet; focus returns to the opener on close.
  useSheetA11y({ open, onClose });

  const { screenings, isLoading, isError, createScreening, isCreating } =
    useOcclusionScreenings(patientId);

  const [showForm, setShowForm] = useState(false);
  const [angleClass, setAngleClass] = useState<OcclusionClass>('class_i');
  const [overjet, setOverjet] = useState('');
  const [overbite, setOverbite] = useState('');
  const [crossbite, setCrossbite] = useState(false);
  const [crowding, setCrowding] = useState(false);
  const [spacing, setSpacing] = useState(false);
  const [midline, setMidline] = useState('');
  const [notes, setNotes] = useState('');

  function resetForm() {
    setAngleClass('class_i');
    setOverjet('');
    setOverbite('');
    setCrossbite(false);
    setCrowding(false);
    setSpacing(false);
    setMidline('');
    setNotes('');
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const body: CreateOcclusionScreeningBody = {
      angleClass,
      crossbite,
      crowding,
      spacing,
      ...(overjet !== '' ? { overjetMm: Number(overjet) } : {}),
      ...(overbite !== '' ? { overbiteMm: Number(overbite) } : {}),
      ...(midline.trim() ? { midlineDeviation: midline.trim() } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    };
    createScreening(body);
    setShowForm(false);
    resetForm();
  }

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} aria-hidden="true" />

      {/* Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Occlusion screenings"
        data-testid="occlusion-screening-sheet"
        className="fixed bottom-0 left-0 right-0 z-50 flex max-h-[85dvh] flex-col rounded-t-2xl bg-background shadow-2xl"
      >
        {/* Handle */}
        <div className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30" />

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Occlusion</h2>
            {screenings.length > 0 && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                {screenings.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowForm((v) => !v)}
              aria-label="New screening"
              className="flex h-8 items-center gap-1 rounded-lg bg-muted px-3 text-xs font-semibold text-foreground hover:bg-muted/80 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              New Screening
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close occlusion screenings"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* New screening form */}
        {showForm && (
          <form
            onSubmit={handleCreate}
            className="shrink-0 border-b bg-muted/30 px-4 py-3 flex flex-col gap-2"
          >
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              New Screening
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground" htmlFor="occ-class">
                  Angle class
                </label>
                <select
                  id="occ-class"
                  value={angleClass}
                  onChange={(e) => setAngleClass(e.target.value as OcclusionClass)}
                  className="rounded border border-border bg-background px-2 py-1.5 text-sm"
                  required
                >
                  {OCCLUSION_CLASSES.map((c) => (
                    <option key={c} value={c}>
                      {OCCLUSION_CLASS_LABELS[c]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground" htmlFor="occ-overjet">
                    Overjet (mm)
                  </label>
                  <input
                    id="occ-overjet"
                    type="number"
                    value={overjet}
                    onChange={(e) => setOverjet(e.target.value)}
                    className="rounded border border-border bg-background px-2 py-1.5 text-sm"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground" htmlFor="occ-overbite">
                    Overbite (mm)
                  </label>
                  <input
                    id="occ-overbite"
                    type="number"
                    value={overbite}
                    onChange={(e) => setOverbite(e.target.value)}
                    className="rounded border border-border bg-background px-2 py-1.5 text-sm"
                  />
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-4 py-1">
              <label className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" checked={crossbite} onChange={(e) => setCrossbite(e.target.checked)} />
                Crossbite
              </label>
              <label className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" checked={crowding} onChange={(e) => setCrowding(e.target.checked)} />
                Crowding
              </label>
              <label className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" checked={spacing} onChange={(e) => setSpacing(e.target.checked)} />
                Spacing
              </label>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground" htmlFor="occ-midline">
                Midline deviation (optional)
              </label>
              <input
                id="occ-midline"
                type="text"
                value={midline}
                onChange={(e) => setMidline(e.target.value)}
                placeholder="e.g. 2mm to the left"
                className="rounded border border-border bg-background px-2 py-1.5 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground" htmlFor="occ-notes">
                Notes (optional)
              </label>
              <textarea
                id="occ-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Add a note…"
                className="rounded border border-border bg-background px-2 py-1.5 text-sm resize-none"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded px-3 py-1.5 text-xs font-semibold bg-muted text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isCreating}
                className="rounded px-3 py-1.5 text-xs font-semibold bg-lemon text-lemon-foreground hover:bg-lemon-hover disabled:opacity-50"
              >
                {isCreating ? 'Saving…' : 'Save Screening'}
              </button>
            </div>
          </form>
        )}

        {/* Screening list */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {isLoading ? (
            <p className="text-center text-sm text-muted-foreground py-8">Loading screenings…</p>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
              <Activity className="h-8 w-8 text-destructive/50" />
              <p className="text-sm text-destructive">Couldn’t load occlusion screenings. Please try again.</p>
            </div>
          ) : screenings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
              <Activity className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                No occlusion screenings yet. Record the Angle class and bite findings.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {screenings.map((screening) => (
                <ScreeningRow key={screening.id} screening={screening} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
