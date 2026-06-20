/**
 * Calendar page — scheduling view with day/week toggle
 *
 * Fetches appointments via useAppointments (TanStack Query).
 * Top bar: date navigation, view toggle, new appointment / walk-in buttons.
 * Appointment click opens the edit modal.
 */

import React, { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { CalendarDay } from '../../features/scheduling/components/calendar-day';
import { CalendarWeek } from '../../features/scheduling/components/calendar-week';
import { CalendarMonth } from '../../features/scheduling/components/calendar-month';
import { AppointmentModal } from '../../features/scheduling/components/appointment-modal';
import type { Appointment } from '../../features/scheduling/components/appointment-card';
import { CancelAppointmentDialog } from '../../features/scheduling/components/cancel-appointment-dialog';
import { useAppointments } from '../../features/scheduling/hooks/use-appointments';
import { ListErrorState } from '@/components/list-error-state';
import { Skeleton } from '@monobase/ui';
import { checkInAppointment, updateAppointment, confirmAppointment, cancelAppointment } from '@monobase/sdk-ts/generated';
import { toast } from 'sonner';
import { toastError } from '@/lib/error-toast';
import { APP_LOCALE } from '@/constants/brand';
import { RecallDueList } from '../../features/scheduling/components/recall-due-list';
import type { RecallDueItem } from '../../features/scheduling/hooks/use-recall-due-list';
import { useOrgContextStore } from '@/stores/org-context.store';

export const Route = createFileRoute('/_dashboard/calendar')({
  component: CalendarPage,
});

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function getMondayOfWeek(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDateTitle(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString(APP_LOCALE, {
    weekday: 'long',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatWeekTitle(weekStart: string): string {
  const start = new Date(weekStart + 'T12:00:00');
  const end = new Date(weekStart + 'T12:00:00');
  end.setDate(end.getDate() + 6);
  const startStr = start.toLocaleDateString(APP_LOCALE, { month: 'short', day: 'numeric' });
  const endStr = end.toLocaleDateString(APP_LOCALE, { month: 'short', day: 'numeric', year: 'numeric' });
  return `${startStr} - ${endStr}`;
}

function formatMonthTitle(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString(APP_LOCALE, { month: 'long', year: 'numeric' });
}

function getFirstOfMonth(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-01`;
}

function CalendarPage() {
  const queryClient = useQueryClient();
  const [view, setView] = useState<'day' | 'week' | 'month'>('day');
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [modalOpen, setModalOpen] = useState(false);
  const [modalInitialDate, setModalInitialDate] = useState<string | undefined>();
  const [editAppointmentId, setEditAppointmentId] = useState<string | undefined>();
  // ISSUE-012: hold the appointment being edited so the modal can pre-populate.
  const [editAppointment, setEditAppointment] = useState<Appointment | null>(null);
  const [showRecare, setShowRecare] = useState(false);
  const branchId = useOrgContextStore((s) => s.branchId) ?? undefined;
  const role = useOrgContextStore((s) => s.role);
  // FR3.4 / EM-SCH-001: cancellation is owner/staff_full only (backend enforces;
  // the FE hides the affordance for other roles to avoid a button that 403s).
  const canCancel = role === 'dentist_owner' || role === 'staff_full';
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelSaving, setCancelSaving] = useState(false);

  const weekStart = getMondayOfWeek(selectedDate);

  const { appointments, isLoading, error, refetch } = useAppointments({ date: selectedDate, view, branchId });

  function invalidateAppointments() {
    // The appointments list comes from the generated SDK (useAppointments →
    // listAppointmentsOptions), whose key is [{ _id: 'listAppointments', … }].
    // A literal ['appointments'] key never matched it, so the calendar silently
    // stayed stale after create/edit/cancel/walk-in. Match the SDK key by _id.
    queryClient.invalidateQueries({
      predicate: (q) => (q.queryKey[0] as { _id?: string })?._id === 'listAppointments',
    });
  }

  function handlePrev() {
    if (view === 'month') {
      setSelectedDate((d) => {
        const dt = new Date(d + 'T12:00:00');
        dt.setMonth(dt.getMonth() - 1);
        return dt.toISOString().slice(0, 10);
      });
    } else {
      setSelectedDate((d) => addDays(d, view === 'day' ? -1 : -7));
    }
  }

  function handleNext() {
    if (view === 'month') {
      setSelectedDate((d) => {
        const dt = new Date(d + 'T12:00:00');
        dt.setMonth(dt.getMonth() + 1);
        return dt.toISOString().slice(0, 10);
      });
    } else {
      setSelectedDate((d) => addDays(d, view === 'day' ? 1 : 7));
    }
  }

  function handleToday() {
    setSelectedDate(todayISO());
  }

  function handleSlotClick(_time: string) {
    setEditAppointmentId(undefined);
    setEditAppointment(null);
    setModalInitialDate(selectedDate);
    setModalOpen(true);
  }

  function handleNewAppointment(_walkIn = false) {
    setEditAppointmentId(undefined);
    setEditAppointment(null);
    setModalInitialDate(selectedDate);
    setModalOpen(true);
  }

  function handleAppointmentClick(appointment: Appointment) {
    setEditAppointmentId(appointment.id);
    setEditAppointment(appointment);
    setModalInitialDate(undefined);
    setModalOpen(true);
  }

  async function handleCheckIn(appointmentId: string) {
    try {
      // ISSUE-013 (QA 2026-06-20): without throwOnError the SDK resolves on a
      // 409/500, the catch never fires, and we'd show a false "Patient checked
      // in" toast while the appointment stays unchanged. Throw so failures surface.
      await checkInAppointment({ path: { appointmentId }, throwOnError: true });
      invalidateAppointments();
      toast.success('Patient checked in');
    } catch (err) {
      toastError(err, 'Check-in failed. Please try again.');
    }
  }

  async function handleConfirm(appointmentId: string) {
    try {
      // P1-24: dedicated staff-confirm endpoint (scheduled→confirmed, confirmedVia='staff',
      // synchronously expires queued reminders).
      // ISSUE-013: throwOnError so a failed confirm shows the error, not a false success.
      await confirmAppointment({ path: { appointmentId }, throwOnError: true });
      invalidateAppointments();
      toast.success('Appointment confirmed');
    } catch (err) {
      toastError(err, 'Could not confirm the appointment. Please try again.');
    }
  }

  async function handleNoShow(appointment: Appointment) {
    try {
      // PP-1 (ISSUE-035): mark a no-show via the canonical PATCH status transition.
      // throwOnError so a 403/409/422 surfaces instead of a false success toast
      // (same swallowed-error guard as handleCheckIn/handleConfirm).
      await updateAppointment({ path: { appointmentId: appointment.id }, body: { status: 'no_show' }, throwOnError: true });
      invalidateAppointments();
      toast.success('Marked as no-show');
    } catch (err) {
      toastError(err, 'Could not mark the appointment as no-show. Please try again.');
    }
  }

  function handleRequestCancel(appointment: Appointment) {
    setCancelError(null);
    setCancelTarget(appointment);
  }

  async function handleConfirmCancel(reason: string) {
    if (!cancelTarget) return;
    setCancelSaving(true);
    setCancelError(null);
    try {
      // FR3.4: canonical reason-gated cancel — DELETE with reason query param.
      await cancelAppointment({ path: { appointmentId: cancelTarget.id }, query: { reason }, throwOnError: true });
      setCancelTarget(null);
      invalidateAppointments();
    } catch {
      setCancelError('Could not cancel the appointment. Please try again.');
    } finally {
      setCancelSaving(false);
    }
  }

  async function handleReschedule(appointmentId: string, newStartAt: string, newDurationMinutes: number) {
    const startAt = new Date(newStartAt);
    const endAt = new Date(startAt.getTime() + newDurationMinutes * 60_000);
    try {
      await updateAppointment({
        path: { appointmentId },
        // startAt/endAt are Date — matches UpdateAppointmentRequest directly
        // (cast removed; oli QA_ESCAPES §6 / GAP-D).
        body: { startAt, endAt },
      });
      invalidateAppointments();
    } catch {
      // Reschedule conflict / network error — refetch to restore the original position
      invalidateAppointments();
    }
  }

  function handleDayClick(date: string) {
    setSelectedDate(date);
    setView('day');
  }

  function handleSaved() {
    setModalOpen(false);
    setEditAppointmentId(undefined);
    invalidateAppointments();
  }

  // P1-24: "Schedule" from the recare due-list → open the appointment modal.
  function handleScheduleFromRecall(_recall: RecallDueItem) {
    setShowRecare(false);
    setEditAppointmentId(undefined);
    setModalInitialDate(selectedDate);
    setModalOpen(true);
  }

  const dateTitle = view === 'day'
    ? formatDateTitle(selectedDate)
    : view === 'week'
      ? formatWeekTitle(weekStart)
      : formatMonthTitle(selectedDate);

  return (
    <div className="flex flex-col h-full min-w-0">
      {/* Top bar — wraps to a second row on narrow (iPad-portrait) widths so the
          10 controls never force horizontal page overflow. min-h preserves the
          single-row height on desktop. */}
      <div className="min-h-14 bg-background/70 backdrop-blur-xl border-b border-border flex flex-wrap items-center justify-between gap-y-2 px-4 py-2 flex-shrink-0 z-10">
        {/* Left: date nav */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handlePrev}
            className="h-11 w-11 rounded-lg border border-border bg-background flex items-center justify-center text-sm hover:bg-secondary transition-colors"
            aria-label={view === 'day' ? 'Previous day' : view === 'week' ? 'Previous week' : 'Previous month'}
          >
            ‹
          </button>
          <span className="text-base font-semibold tracking-tight mx-2 whitespace-nowrap" aria-live="polite">
            {dateTitle}
          </span>
          <button
            type="button"
            onClick={handleNext}
            className="h-11 w-11 rounded-lg border border-border bg-background flex items-center justify-center text-sm hover:bg-secondary transition-colors"
            aria-label={view === 'day' ? 'Next day' : view === 'week' ? 'Next week' : 'Next month'}
          >
            ›
          </button>
          <button
            type="button"
            onClick={handleToday}
            className="ml-2 h-11 px-3 rounded-lg border border-border bg-background text-xs font-medium hover:bg-secondary transition-colors"
          >
            Today
          </button>
        </div>

        {/* Center: view toggle */}
        <div className="flex border border-border rounded-[9px] overflow-hidden bg-secondary/30 p-0.5 gap-0.5" role="group" aria-label="Calendar view">
          <button
            type="button"
            onClick={() => setView('day')}
            aria-pressed={view === 'day'}
            className={`px-3.5 h-11 text-[13px] font-medium rounded-[7px] transition-colors ${
              view === 'day'
                ? 'bg-lemon text-lemon-foreground font-semibold'
                : 'text-muted-foreground hover:bg-background/60'
            }`}
          >
            Day
          </button>
          <button
            type="button"
            onClick={() => setView('week')}
            aria-pressed={view === 'week'}
            className={`px-3.5 h-11 text-[13px] font-medium rounded-[7px] transition-colors ${
              view === 'week'
                ? 'bg-lemon text-lemon-foreground font-semibold'
                : 'text-muted-foreground hover:bg-background/60'
            }`}
          >
            Week
          </button>
          <button
            type="button"
            onClick={() => setView('month')}
            aria-pressed={view === 'month'}
            className={`px-3.5 h-11 text-[13px] font-medium rounded-[7px] transition-colors ${
              view === 'month'
                ? 'bg-lemon text-lemon-foreground font-semibold'
                : 'text-muted-foreground hover:bg-background/60'
            }`}
          >
            Month
          </button>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowRecare((v) => !v)}
            aria-pressed={showRecare}
            className={`h-11 px-4 rounded-[10px] border border-border text-[13px] font-medium flex items-center gap-1.5 transition-colors ${
              showRecare ? 'bg-secondary' : 'bg-background hover:bg-secondary'
            }`}
            aria-label="Toggle recare due-list"
          >
            Recare due
          </button>
          <button
            type="button"
            onClick={() => handleNewAppointment(true)}
            className="h-11 px-4 rounded-[10px] border border-border bg-background text-[13px] font-medium flex items-center gap-1.5 hover:bg-secondary transition-colors"
            aria-label="Add walk-in appointment"
          >
            <span className="text-xs">+</span> Walk-In
          </button>
          <button
            type="button"
            onClick={() => handleNewAppointment(false)}
            className="h-11 px-4 rounded-[10px] bg-lemon text-lemon-foreground text-[13px] font-semibold flex items-center gap-1.5 hover:bg-lemon-hover transition-colors"
            aria-label="Create new appointment"
          >
            <span className="text-xs">+</span> New Appointment
          </button>
        </div>
      </div>

      {/* Calendar content */}
      {error ? (
        <div className="flex-1 flex items-center justify-center" data-testid="calendar-error">
          <ListErrorState
            message={error.message || 'Failed to load appointments.'}
            onRetry={() => refetch()}
          />
        </div>
      ) : isLoading && appointments.length === 0 ? (
        <div className="flex-1 overflow-hidden p-4" aria-label="Loading appointments" aria-busy="true">
          <div className="flex flex-col gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="h-4 w-12 mt-1 shrink-0" />
                <Skeleton className="h-16 flex-1 rounded-xl" />
              </div>
            ))}
          </div>
        </div>
      ) : view === 'day' ? (
        <CalendarDay
          date={selectedDate}
          appointments={appointments}
          onAppointmentClick={handleAppointmentClick}
          onSlotClick={handleSlotClick}
          onCheckIn={handleCheckIn}
          onConfirm={handleConfirm}
          onCancel={canCancel ? handleRequestCancel : undefined}
          onNoShow={handleNoShow}
          onReschedule={handleReschedule}
        />
      ) : view === 'week' ? (
        <CalendarWeek
          weekStart={weekStart}
          appointments={appointments}
          onAppointmentClick={handleAppointmentClick}
          onDayClick={handleDayClick}
        />
      ) : (
        <CalendarMonth
          selectedDate={selectedDate}
          appointments={appointments}
          onDayClick={handleDayClick}
        />
      )}

      {/* P1-24: recare due-list slide-over panel */}
      {showRecare && (
        <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-label="Recare due-list">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowRecare(false)} />
          <div className="relative w-full max-w-[420px] h-full bg-background shadow-2xl overflow-y-auto p-4">
            <RecallDueList branchId={branchId} onSchedule={handleScheduleFromRecall} />
          </div>
        </div>
      )}

      {/* Appointment modal — create or edit */}
      <AppointmentModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditAppointmentId(undefined); setEditAppointment(null); }}
        onSaved={handleSaved}
        initialDate={modalInitialDate}
        appointmentId={editAppointmentId}
        appointment={editAppointment ?? undefined}
      />

      {/* FR3.4: reason-gated cancellation dialog */}
      <CancelAppointmentDialog
        open={!!cancelTarget}
        patientLabel={cancelTarget?.patientName}
        error={cancelError}
        saving={cancelSaving}
        onClose={() => { setCancelTarget(null); setCancelError(null); }}
        onConfirm={handleConfirmCancel}
      />
    </div>
  );
}
