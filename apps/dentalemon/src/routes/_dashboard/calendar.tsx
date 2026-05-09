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
import { AppointmentModal } from '../../features/scheduling/components/appointment-modal';
import type { Appointment } from '../../features/scheduling/components/appointment-card';
import { useAppointments } from '../../features/scheduling/hooks/use-appointments';
import { apiBaseUrl } from '@/utils/config';

export const Route = createFileRoute('/_dashboard/calendar')({
  component: CalendarPage,
});

const API = apiBaseUrl;

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
  return d.toLocaleDateString('en-US', {
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
  const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${startStr} - ${endStr}`;
}

function CalendarPage() {
  const queryClient = useQueryClient();
  const [view, setView] = useState<'day' | 'week'>('day');
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
    setSelectedDate((d) => addDays(d, view === 'day' ? -1 : -7));
  }

  function handleNext() {
    setSelectedDate((d) => addDays(d, view === 'day' ? 1 : 7));
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
      const res = await fetch(`${API}/dental/appointments/${appointmentId}/check-in`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) invalidateAppointments();
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

  const dateTitle = view === 'day' ? formatDateTitle(selectedDate) : formatWeekTitle(weekStart);

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="h-14 bg-background/70 backdrop-blur-xl border-b border-border flex items-center justify-between px-4 flex-shrink-0 z-10">
        {/* Left: date nav */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handlePrev}
            className="w-8 h-8 rounded-lg border border-border bg-background flex items-center justify-center text-sm hover:bg-secondary transition-colors"
            aria-label={view === 'day' ? 'Previous day' : 'Previous week'}
          >
            ‹
          </button>
          <span className="text-base font-semibold tracking-tight mx-2 whitespace-nowrap" aria-live="polite">
            {dateTitle}
          </span>
          <button
            type="button"
            onClick={handleNext}
            className="w-8 h-8 rounded-lg border border-border bg-background flex items-center justify-center text-sm hover:bg-secondary transition-colors"
            aria-label={view === 'day' ? 'Next day' : 'Next week'}
          >
            ›
          </button>
          <button
            type="button"
            onClick={handleToday}
            className="ml-2 h-8 px-3 rounded-lg border border-border bg-background text-xs font-medium hover:bg-secondary transition-colors"
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
            className={`px-3.5 h-8 text-[13px] font-medium rounded-[7px] transition-colors ${
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
            className={`px-3.5 h-8 text-[13px] font-medium rounded-[7px] transition-colors ${
              view === 'week'
                ? 'bg-[#FFE97D] text-[#4A4018] font-semibold'
                : 'text-muted-foreground hover:bg-background/60'
            }`}
          >
            Week
          </button>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleNewAppointment(true)}
            className="h-9 px-4 rounded-[10px] border border-border bg-background text-[13px] font-medium flex items-center gap-1.5 hover:bg-secondary transition-colors"
            aria-label="Add walk-in appointment"
          >
            <span className="text-xs">+</span> Walk-In
          </button>
          <button
            type="button"
            onClick={() => handleNewAppointment(false)}
            className="h-9 px-4 rounded-[10px] bg-[#FFE97D] text-[#4A4018] text-[13px] font-semibold flex items-center gap-1.5 hover:bg-[#F5DC60] transition-colors"
            aria-label="Create new appointment"
          >
            <span className="text-xs">+</span> New Appointment
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-4 mt-3 rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive flex items-center justify-between">
          <span>{error.message}</span>
          <button type="button" onClick={() => refetch()} className="text-xs underline ml-2">
            Retry
          </button>
        </div>
      )}

      {/* Calendar content */}
      {isLoading && appointments.length === 0 ? (
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
      ) : (
        <CalendarWeek
          weekStart={weekStart}
          appointments={appointments}
          onAppointmentClick={handleAppointmentClick}
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
