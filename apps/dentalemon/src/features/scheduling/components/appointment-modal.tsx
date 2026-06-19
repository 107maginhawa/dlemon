/**
 * AppointmentModal — slide-up sheet for creating/editing appointments
 *
 * Fields: Patient ID, Dentist Member ID, Branch ID, Date, Time,
 *         Duration, Service Type, Notes, Walk-in toggle
 *
 * Wireframe: docs/prd/context/wireframes/appointment-modal.html
 */

import React, { useState, useEffect } from 'react';
import { Button, Checkbox, Input, Textarea } from '@monobase/ui';
import { useSheetA11y } from '@/hooks/use-sheet-a11y';
import {
  createAppointment,
  updateAppointment,
  type VisitType,
  type CreateAppointmentRequest,
  type UpdateAppointmentRequest,
} from '@monobase/sdk-ts/generated';
import { useOrgContextStore } from '@/stores/org-context.store';
import { toast } from 'sonner';
import { toastError } from '@/lib/error-toast';

export const DURATION_OPTIONS = [
  { value: 30, label: '30 min' },
  { value: 60, label: '1 hr' },
  { value: 90, label: '1.5 hr' },
  { value: 120, label: '2 hr' },
] as const;

export interface AppointmentModalProps {
  open: boolean;
  onClose: () => void;
  onSaved?: (appointment: unknown) => void;
  initialDate?: string;
  appointmentId?: string;
}

export function validateAppointmentForm(form: {
  patientId: string;
  serviceType: string;
  date: string;
  time: string;
}): string[] {
  const errors: string[] = [];
  if (!form.patientId.trim()) errors.push('Patient ID is required');
  if (!form.serviceType.trim()) errors.push('Service type is required');
  if (!form.date.trim() || !form.time.trim()) errors.push('Scheduled date and time are required');
  return errors;
}

export const VISIT_TYPE_OPTIONS = [
  { value: 'checkup', label: 'Checkup' },
  { value: 'treatment', label: 'Treatment' },
  { value: 'emergency', label: 'Emergency' },
  { value: 'recall', label: 'Recall' },
] as const;

/** Build start/end ISO timestamps from a date + time + duration (minutes). */
export function buildTimeRange(date: string, time: string, durationMinutes: number) {
  // Interpret the entered date+time as local wall-clock, then emit BOTH bounds as
  // full ISO-8601 (UTC Z). The backend validates startAt/endAt with
  // z.string().datetime(), which rejects a timezone-naive string like
  // "2026-06-07T10:00:00" — so startAt must be normalised, not passed raw.
  const start = new Date(`${date}T${time}:00`);
  const end = new Date(start.getTime() + (durationMinutes || 30) * 60_000);
  return { startAt: start.toISOString(), endAt: end.toISOString() };
}

export function buildAppointmentPayload(form: {
  patientId: string;
  dentistMemberId: string;
  branchId: string;
  date: string;
  time: string;
  durationMinutes: number;
  serviceType: VisitType;
  notes: string;
  walkIn: boolean;
}): CreateAppointmentRequest {
  // Canonical wire shape: providerId / startAt / endAt / visitType (V-SCH-006/007).
  // Cause-fix (oli QA_ESCAPES §6 / QA-009): visitType is the SDK VisitType enum
  // (the backend validates it with z.enum) — not free text. startAt/endAt are Date
  // (the SDK request type; serialized to the ISO string the validator expects).
  // Returning the exact CreateAppointmentRequest lets the call site drop its cast.
  const { startAt, endAt } = buildTimeRange(form.date, form.time, form.durationMinutes);
  return {
    patientId: form.patientId.trim(),
    providerId: form.dentistMemberId.trim(),
    branchId: form.branchId.trim() || useOrgContextStore.getState().branchId || '',
    startAt: new Date(startAt),
    endAt: new Date(endAt),
    visitType: form.serviceType,
    notes: form.notes.trim() || undefined,
    walkIn: form.walkIn,
  };
}

/** Extract DOUBLE_BOOKING warning marker from a create response, if present. */
export function extractDoubleBookingWarning(appointment: unknown): boolean {
  const warnings = (appointment as { warnings?: unknown })?.warnings;
  return Array.isArray(warnings) && warnings.includes('DOUBLE_BOOKING');
}

export function AppointmentModal({ open, onClose, onSaved, initialDate, appointmentId }: AppointmentModalProps) {
  useSheetA11y({ open, onClose });
  const storeBranchId = useOrgContextStore((s) => s.branchId) ?? '';
  const [patientId, setPatientId] = useState('');
  const [dentistMemberId, setDentistMemberId] = useState('');
  const [branchId, setBranchId] = useState(storeBranchId);
  const [date, setDate] = useState(initialDate || '');
  const [time, setTime] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [serviceType, setServiceType] = useState<VisitType | ''>('');
  const [notes, setNotes] = useState('');
  const [walkIn, setWalkIn] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  // V-SCH-005: surface the backend DOUBLE_BOOKING warning to the scheduler.
  const [doubleBookingWarning, setDoubleBookingWarning] = useState(false);

  useEffect(() => {
    if (initialDate) setDate(initialDate);
  }, [initialDate]);

  useEffect(() => {
    if (open) setBranchId(storeBranchId);
  }, [open, storeBranchId]);

  if (!open) return null;

  function handleClose() {
    setPatientId('');
    setDentistMemberId('');
    setBranchId(storeBranchId);
    setDate(initialDate || '');
    setTime('');
    setDurationMinutes(30);
    setServiceType('');
    setNotes('');
    setWalkIn(false);
    setErrors([]);
    setDoubleBookingWarning(false);
    onClose();
  }

  async function handleSave() {
    const errs = validateAppointmentForm({ patientId, serviceType, date, time });
    if (errs.length > 0) {
      setErrors(errs);
      return;
    }
    // validateAppointmentForm guarantees a non-empty serviceType; narrow '' away so
    // the SDK-typed body (visitType: VisitType) type-checks without a cast.
    if (!serviceType) return;
    setErrors([]);
    setDoubleBookingWarning(false);
    setSaving(true);
    try {
      let appointment: unknown;
      if (appointmentId) {
        const { startAt, endAt } = buildTimeRange(date, time, durationMinutes);
        const body: UpdateAppointmentRequest = {
          startAt: new Date(startAt),
          endAt: new Date(endAt),
          visitType: serviceType,
          notes: notes.trim() || undefined,
        };
        const { data } = await updateAppointment({ path: { appointmentId }, body });
        appointment = data;
      } else {
        const payload = buildAppointmentPayload({
          patientId,
          dentistMemberId,
          branchId,
          date,
          time,
          durationMinutes,
          serviceType,
          notes,
          walkIn,
        });
        const { data } = await createAppointment({ body: payload });
        appointment = data;
      }
      if (!appointment) {
        setErrors([appointmentId ? 'Failed to update appointment' : 'Failed to create appointment']);
        return;
      }
      // V-SCH-005 / AC-SCH-001: appointment was created, but the backend flagged a
      // double-booking. Keep the modal open and show the warning rather than silently
      // closing — the scheduler stays informed but the booking still succeeded.
      if (!appointmentId && extractDoubleBookingWarning(appointment)) {
        setDoubleBookingWarning(true);
        onSaved?.(appointment);
        return;
      }
      onSaved?.(appointment);
      toast.success(appointmentId ? 'Appointment rescheduled' : 'Appointment saved');
      handleClose();
    } catch (err) {
      toastError(err, appointmentId ? 'Could not reschedule the appointment. Please try again.' : 'Could not save the appointment. Please try again.');
      throw err;
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
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            aria-label="Close modal"
            className="w-8 h-8 p-0 rounded-full bg-secondary flex items-center justify-center text-muted-foreground text-sm"
          >
            ✕
          </Button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-4">
          {errors.length > 0 && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
              {errors.map(e => <p key={e}>{e}</p>)}
            </div>
          )}

          {/* V-SCH-005 / AC-SCH-001 / §9: double-booking warning (soft — booking succeeded) */}
          {doubleBookingWarning && (
            <div
              data-testid="double-booking-warning"
              role="alert"
              className="rounded-lg bg-amber-100 border border-amber-300 px-3 py-2.5 text-sm text-amber-900 flex items-start gap-2"
            >
              <span aria-hidden className="text-base leading-none">⚠️</span>
              <div>
                <p className="font-semibold">Double-booking warning</p>
                <p className="text-amber-800">
                  This provider already has an appointment in the selected time window. The
                  appointment was still booked — review the schedule to avoid conflicts.
                </p>
              </div>
            </div>
          )}

          {/* Patient ID */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block" htmlFor="appt-patient-id">
              Patient ID *
            </label>
            <Input
              id="appt-patient-id"
              type="text"
              value={patientId}
              onChange={e => setPatientId(e.target.value)}
              placeholder="Enter patient ID"
              className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none"
            />
          </div>

          {/* Dentist Member ID */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block" htmlFor="appt-dentist-id">
              Dentist Member ID
            </label>
            <Input
              id="appt-dentist-id"
              type="text"
              value={dentistMemberId}
              onChange={e => setDentistMemberId(e.target.value)}
              placeholder="Enter dentist member ID"
              className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none"
            />
          </div>

          {/* Branch ID */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block" htmlFor="appt-branch-id">
              Branch ID
            </label>
            <Input
              id="appt-branch-id"
              type="text"
              value={branchId}
              onChange={e => setBranchId(e.target.value)}
              className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none"
            />
          </div>

          <div className="h-px bg-border" />

          {/* Date + Time */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block" htmlFor="appt-date">
                Date *
              </label>
              <Input
                id="appt-date"
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block" htmlFor="appt-time">
                Time *
              </label>
              <Input
                id="appt-time"
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none"
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
                <Button
                  key={opt.value}
                  type="button"
                  variant="ghost"
                  onClick={() => setDurationMinutes(opt.value)}
                  aria-pressed={durationMinutes === opt.value}
                  className={`flex-1 h-11 px-0 text-[13px] font-medium rounded-lg transition-colors ${
                    durationMinutes === opt.value
                      ? 'bg-lemon text-lemon-foreground font-semibold hover:bg-lemon'
                      : 'text-muted-foreground hover:bg-background'
                  }`}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Service Type */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block" htmlFor="appt-procedure">
              Service Type *
            </label>
            {/* QA-009: the backend validates visitType against a fixed enum, so the
                input must be a constrained select — a free-text field produced 400s
                ("Invalid option: expected one of checkup|treatment|emergency|recall"). */}
            <select
              id="appt-procedure"
              value={serviceType}
              onChange={e => setServiceType(e.target.value as VisitType)}
              className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none"
            >
              <option value="" disabled>Select a service type…</option>
              {VISIT_TYPE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block" htmlFor="appt-notes">
              Notes (optional)
            </label>
            <Textarea
              id="appt-notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Any notes or special instructions..."
              rows={3}
              className="w-full rounded-xl border border-border px-3 py-2.5 text-sm bg-background focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none resize-none"
            />
          </div>

          {/* Walk-in toggle */}
          <label className="flex items-center gap-2.5 cursor-pointer">
            <Checkbox
              checked={walkIn}
              onCheckedChange={checked => setWalkIn(checked === true)}
              className="w-4 h-4 rounded"
            />
            <span className="text-sm">Walk-in appointment</span>
          </label>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 h-16 border-t flex-shrink-0">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            className="h-11 px-5 rounded-xl border border-border text-sm hover:bg-secondary transition-colors"
          >
            Cancel
          </Button>
          {doubleBookingWarning ? (
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              className="h-11 px-5 rounded-xl bg-lemon text-lemon-foreground text-sm font-semibold hover:bg-lemon-hover transition-colors"
            >
              Done
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              onClick={handleSave}
              disabled={saving}
              className="h-11 px-5 rounded-xl bg-lemon text-lemon-foreground text-sm font-semibold hover:bg-lemon-hover transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Appointment'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
