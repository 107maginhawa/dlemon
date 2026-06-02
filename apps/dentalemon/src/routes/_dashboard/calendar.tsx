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
import { useAppointments } from '../../features/scheduling/hooks/use-appointments';
import { ListErrorState } from '@/components/list-error-state';
import { checkInAppointment } from '@monobase/sdk-ts/generated';
import { APP_LOCALE } from '@/constants/brand';

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

  const weekStart = getMondayOfWeek(selectedDate);

  const { appointments, isLoading, error, refetch } = useAppointments({ date: selectedDate, view });

  function invalidateAppointments() {
    queryClient.invalidateQueries({ queryKey: ['appointments'] });
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
    setModalInitialDate(selectedDate);
    setModalOpen(true);
  }

  function handleNewAppointment(_walkIn = false) {
    setEditAppointmentId(undefined);
    setModalInitialDate(selectedDate);
    setModalOpen(true);
  }

  function handleAppointmentClick(appointment: Appointment) {
    setEditAppointmentId(appointment.id);
    setModalInitialDate(undefined);
    setModalOpen(true);
  }

  async function handleCheckIn(appointmentId: string) {
    try {
      await checkInAppointment({ path: { appointmentId } });
      invalidateAppointments();
    } catch {
      // Network error — ignore silently
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

  const dateTitle = view === 'day'
    ? formatDateTitle(selectedDate)
    : view === 'week'
      ? formatWeekTitle(weekStart)
      : formatMonthTitle(selectedDate);

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="h-14 bg-background/70 backdrop-blur-xl border-b border-border flex items-center justify-between px-4 flex-shrink-0 z-10">
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
                ? 'bg-[#FFE97D] text-[#4A4018] font-semibold'
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
                ? 'bg-[#FFE97D] text-[#4A4018] font-semibold'
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
                ? 'bg-[#FFE97D] text-[#4A4018] font-semibold'
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
            onClick={() => handleNewAppointment(true)}
            className="h-11 px-4 rounded-[10px] border border-border bg-background text-[13px] font-medium flex items-center gap-1.5 hover:bg-secondary transition-colors"
            aria-label="Add walk-in appointment"
          >
            <span className="text-xs">+</span> Walk-In
          </button>
          <button
            type="button"
            onClick={() => handleNewAppointment(false)}
            className="h-11 px-4 rounded-[10px] bg-[#FFE97D] text-[#4A4018] text-[13px] font-semibold flex items-center gap-1.5 hover:bg-[#F5DC60] transition-colors"
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
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm" aria-label="Loading appointments">
          Loading appointments…
        </div>
      ) : view === 'day' ? (
        <CalendarDay
          date={selectedDate}
          appointments={appointments}
          onAppointmentClick={handleAppointmentClick}
          onSlotClick={handleSlotClick}
          onCheckIn={handleCheckIn}
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

      {/* Appointment modal — create or edit */}
      <AppointmentModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditAppointmentId(undefined); }}
        onSaved={handleSaved}
        initialDate={modalInitialDate}
        appointmentId={editAppointmentId}
      />
    </div>
  );
}
