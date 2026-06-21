/**
 * DentalAlertsSheet — bottom sheet for managing chairside dental alerts
 * (PP-7 sub-slice 1 / ISSUE-042).
 *
 * Lists a patient's dental alerts (latex allergy, needle phobia, gag reflex, …),
 * lets staff add one (type + severity + optional description), and deactivate an
 * active alert. Active alerts also surface as badges in the workspace top bar.
 */
import React, { useState } from 'react';
import { useSheetA11y } from '@/hooks/use-sheet-a11y';
import { X, AlertTriangle, Plus } from 'lucide-react';
import {
  useDentalAlerts,
  DENTAL_ALERT_TYPES,
  DENTAL_ALERT_TYPE_LABELS,
  DENTAL_ALERT_SEVERITIES,
  DENTAL_ALERT_SEVERITY_LABELS,
  type DentalAlert,
  type DentalAlertType,
  type DentalAlertSeverity,
  type CreateDentalAlertBody,
} from '../hooks/use-dental-alerts';

interface DentalAlertsSheetProps {
  patientId: string;
  open: boolean;
  onClose: () => void;
}

export const SEVERITY_BADGE_CLASS: Record<DentalAlertSeverity, string> = {
  high: 'bg-red-100 text-red-700 border-red-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  low: 'bg-slate-100 text-slate-600 border-slate-200',
};

// ---------------------------------------------------------------------------
// Row
// ---------------------------------------------------------------------------

interface AlertRowProps {
  alert: DentalAlert;
  onDeactivate: (alertId: string) => void;
  isUpdating: boolean;
}

function AlertRow({ alert, onDeactivate, isUpdating }: AlertRowProps) {
  return (
    <div
      className={`flex items-start gap-3 rounded-lg border border-border bg-background p-3 ${
        alert.active ? '' : 'opacity-60'
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">{DENTAL_ALERT_TYPE_LABELS[alert.alertType]}</span>
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${SEVERITY_BADGE_CLASS[alert.severity]}`}
          >
            {DENTAL_ALERT_SEVERITY_LABELS[alert.severity]}
          </span>
          {!alert.active && (
            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
              Inactive
            </span>
          )}
        </div>
        {alert.description && (
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{alert.description}</p>
        )}
      </div>

      {alert.active && (
        <button
          type="button"
          disabled={isUpdating}
          onClick={() => onDeactivate(alert.id)}
          className="shrink-0 rounded px-2 py-1 text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground transition-colors disabled:opacity-50"
        >
          Deactivate
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sheet
// ---------------------------------------------------------------------------

export function DentalAlertsSheet({ patientId, open, onClose }: DentalAlertsSheetProps) {
  // WCAG 2.4.3: Escape closes the sheet; focus returns to the opener on close.
  useSheetA11y({ open, onClose });

  const { alerts, isLoading, isError, createAlert, deactivateAlert, isCreating, isUpdating } =
    useDentalAlerts(patientId);

  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<DentalAlertType>('latex_allergy');
  const [formSeverity, setFormSeverity] = useState<DentalAlertSeverity>('medium');
  const [formDescription, setFormDescription] = useState('');

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const body: CreateDentalAlertBody = {
      alertType: formType,
      severity: formSeverity,
      ...(formDescription.trim() ? { description: formDescription.trim() } : {}),
    };
    createAlert(body);
    setShowForm(false);
    setFormType('latex_allergy');
    setFormSeverity('medium');
    setFormDescription('');
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
        aria-label="Dental alerts"
        data-testid="dental-alerts-sheet"
        className="fixed bottom-0 left-0 right-0 z-50 flex max-h-[85dvh] flex-col rounded-t-2xl bg-background shadow-2xl"
      >
        {/* Handle */}
        <div className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30" />

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Alerts</h2>
            {alerts.length > 0 && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                {alerts.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowForm((v) => !v)}
              aria-label="New alert"
              className="flex h-8 items-center gap-1 rounded-lg bg-muted px-3 text-xs font-semibold text-foreground hover:bg-muted/80 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              New Alert
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close alerts"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* New alert form */}
        {showForm && (
          <form
            onSubmit={handleCreate}
            className="shrink-0 border-b bg-muted/30 px-4 py-3 flex flex-col gap-2"
          >
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              New Alert
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground" htmlFor="alert-type">
                  Type
                </label>
                <select
                  id="alert-type"
                  value={formType}
                  onChange={(e) => setFormType(e.target.value as DentalAlertType)}
                  className="rounded border border-border bg-background px-2 py-1.5 text-sm"
                  required
                >
                  {DENTAL_ALERT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {DENTAL_ALERT_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground" htmlFor="alert-severity">
                  Severity
                </label>
                <select
                  id="alert-severity"
                  value={formSeverity}
                  onChange={(e) => setFormSeverity(e.target.value as DentalAlertSeverity)}
                  className="rounded border border-border bg-background px-2 py-1.5 text-sm"
                  required
                >
                  {DENTAL_ALERT_SEVERITIES.map((s) => (
                    <option key={s} value={s}>
                      {DENTAL_ALERT_SEVERITY_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground" htmlFor="alert-desc">
                Description (optional)
              </label>
              <textarea
                id="alert-desc"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
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
                {isCreating ? 'Saving…' : 'Save Alert'}
              </button>
            </div>
          </form>
        )}

        {/* Alert list */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {isLoading ? (
            <p className="text-center text-sm text-muted-foreground py-8">Loading alerts…</p>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
              <AlertTriangle className="h-8 w-8 text-destructive/50" />
              <p className="text-sm text-destructive">Couldn’t load alerts. Please try again.</p>
            </div>
          ) : alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
              <AlertTriangle className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                No alerts. Flag latex allergy, needle phobia, and other chairside risks.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {alerts.map((alert) => (
                <AlertRow
                  key={alert.id}
                  alert={alert}
                  onDeactivate={deactivateAlert}
                  isUpdating={isUpdating}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
