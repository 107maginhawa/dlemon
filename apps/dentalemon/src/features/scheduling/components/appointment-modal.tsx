/**
 * AppointmentModal — slide-up sheet for creating/editing appointments
 *
 * Fields: Patient ID, Dentist Member ID, Branch ID, Date, Time,
 *         Duration, Procedure Type, Notes, Walk-in toggle
 *
 * Wireframe: docs/prd/context/wireframes/appointment-modal.html
 */

import React, { useState, useEffect } from 'react';
import { apiBaseUrl } from '@/utils/config';

const DURATION_OPTIONS = [
  { value: 30, label: '30 min' },
  { value: 60, label: '1 hr' },
  { value: 90, label: '1.5 hr' },
  { value: 120, label: '2 hr' },
] as const;

const DEFAULT_BRANCH_ID = '00000000-0000-4000-8000-000000000001';

export interface AppointmentModalProps {
  open: boolean;
  onClose: () => void;
  onSaved?: (appointment: unknown) => void;
  initialDate?: string;
  appointmentId?: string;
}

export function validateAppointmentForm(form: {
  patientId: string;
  procedureType: string;
  date: string;
  time: string;
}): string[] {
  const errors: string[] = [];
  if (!form.patientId.trim()) errors.push('Patient ID is required');
  if (!form.procedureType.trim()) errors.push('Procedure type is required');
  if (!form.date.trim() || !form.time.trim()) errors.push('Scheduled date and time are required');
  return errors;
}

export function buildAppointmentPayload(form: {
  patientId: string;
  dentistMemberId: string;
  branchId: string;
  date: string;
  time: string;
  durationMinutes: number;
  procedureType: string;
  notes: string;
  walkIn: boolean;
}) {
  const scheduledAt = `${form.date}T${form.time}:00`;
  return {
    patientId: form.patientId.trim(),
    dentistMemberId: form.dentistMemberId.trim() || undefined,
    branchId: form.branchId.trim() || DEFAULT_BRANCH_ID,
    scheduledAt,
    durationMinutes: form.durationMinutes || 30,
    procedureType: form.procedureType.trim(),
    notes: form.notes.trim() || undefined,
    walkIn: form.walkIn,
  };
}

export function AppointmentModal({ open, onClose, onSaved, initialDate, appointmentId }: AppointmentModalProps) {
  const [patientId, setPatientId] = useState('');
  const [dentistMemberId, setDentistMemberId] = useState('');
  const [branchId, setBranchId] = useState(DEFAULT_BRANCH_ID);
  const [date, setDate] = useState(initialDate || '');
  const [time, setTime] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [procedureType, setProcedureType] = useState('');
  const [notes, setNotes] = useState('');
  const [walkIn, setWalkIn] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialDate) setDate(initialDate);
  }, [initialDate]);

  if (!open) return null;

  function handleClose() {
    setPatientId('');
    setDentistMemberId('');
    setBranchId(DEFAULT_BRANCH_ID);
    setDate(initialDate || '');
    setTime('');
    setDurationMinutes(30);
    setProcedureType('');
    setNotes('');
    setWalkIn(false);
    setErrors([]);
    onClose();
  }

  async function handleSave() {
    const errs = validateAppointmentForm({ patientId, procedureType, date, time });
    if (errs.length > 0) {
      setErrors(errs);
      return;
    }
    setErrors([]);
    setSaving(true);
    try {
      const payload = buildAppointmentPayload({
        patientId,
        dentistMemberId,
        branchId,
        date,
        time,
        durationMinutes,
        procedureType,
        notes,
        walkIn,
      });
      const res = await fetch(`${apiBaseUrl}/dental/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErrors([body.message || 'Failed to create appointment']);
        return;
      }
      const appointment = await res.json();
      onSaved?.(appointment);
      handleClose();
    } finally {
      setSaving(false);
    }
  }

  const isEdit = !!appointmentId;
  const title = isEdit ? 'Edit Appointment' : 'New Appointment';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />

      <div
        data-testid="appointment-modal"
        className="relative w-full max-w-[520px] max-h-[calc(100vh-80px)] bg-background rounded-2xl shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 h-[52px] border-b flex-shrink-0">
          <h2 className="text-[17px] font-semibold tracking-tight">{title}</h2>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close modal"
            className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground text-sm"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-4">
          {errors.length > 0 && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
              {errors.map(e => <p key={e}>{e}</p>)}
            </div>
          )}

          {/* Patient ID */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block" htmlFor="appt-patient-id">
              Patient ID *
            </label>
            <input
              id="appt-patient-id"
              type="text"
              value={patientId}
              onChange={e => setPatientId(e.target.value)}
              placeholder="Enter patient ID"
              className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus:border-[#FFE97D] outline-none"
            />
          </div>

          {/* Dentist Member ID */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block" htmlFor="appt-dentist-id">
              Dentist Member ID
            </label>
            <input
              id="appt-dentist-id"
              type="text"
              value={dentistMemberId}
              onChange={e => setDentistMemberId(e.target.value)}
              placeholder="Enter dentist member ID"
              className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus:border-[#FFE97D] outline-none"
            />
          </div>

          {/* Branch ID */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block" htmlFor="appt-branch-id">
              Branch ID
            </label>
            <input
              id="appt-branch-id"
              type="text"
              value={branchId}
              onChange={e => setBranchId(e.target.value)}
              className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus:border-[#FFE97D] outline-none"
            />
          </div>

          <div className="h-px bg-border" />

          {/* Date + Time */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block" htmlFor="appt-date">
                Date *
              </label>
              <input
                id="appt-date"
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus:border-[#FFE97D] outline-none"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block" htmlFor="appt-time">
                Time *
              </label>
              <input
                id="appt-time"
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus:border-[#FFE97D] outline-none"
              />
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
              Duration
            </label>
            <div className="flex border border-border rounded-xl overflow-hidden bg-secondary/30 p-0.5 gap-0.5" role="group" aria-label="Appointment duration">
              {DURATION_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDurationMinutes(opt.value)}
                  aria-pressed={durationMinutes === opt.value}
                  className={`flex-1 h-9 text-[13px] font-medium rounded-lg transition-colors ${
                    durationMinutes === opt.value
                      ? 'bg-[#FFE97D] text-[#4A4018] font-semibold'
                      : 'text-muted-foreground hover:bg-background'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Procedure Type */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block" htmlFor="appt-procedure">
              Procedure Type *
            </label>
            <input
              id="appt-procedure"
              type="text"
              value={procedureType}
              onChange={e => setProcedureType(e.target.value)}
              placeholder="e.g. Cleaning, Filling, Crown"
              className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus:border-[#FFE97D] outline-none"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block" htmlFor="appt-notes">
              Notes (optional)
            </label>
            <textarea
              id="appt-notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Any notes or special instructions..."
              rows={3}
              className="w-full rounded-xl border border-border px-3 py-2.5 text-sm bg-background focus:border-[#FFE97D] outline-none resize-none"
            />
          </div>

          {/* Walk-in toggle */}
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={walkIn}
              onChange={e => setWalkIn(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <span className="text-sm">Walk-in appointment</span>
          </label>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 h-16 border-t flex-shrink-0">
          <button
            type="button"
            onClick={handleClose}
            className="h-11 px-5 rounded-xl border border-border text-sm hover:bg-secondary transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="h-11 px-5 rounded-xl bg-[#FFE97D] text-[#4A4018] text-sm font-semibold hover:bg-[#F5DC60] transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Appointment'}
          </button>
        </div>
      </div>
    </div>
  );
}
