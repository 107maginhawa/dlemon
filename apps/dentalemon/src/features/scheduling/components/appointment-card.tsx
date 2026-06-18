/**
 * AppointmentCard — compact appointment card used in day/week views
 *
 * Shows: patient ID (truncated), procedure type, time, status badge
 * Check-in button if status === 'scheduled'
 */

import React from 'react';
import { activateOnKey } from '@/lib/a11y';

export interface Appointment {
  id: string;
  patientId: string;
  patientName?: string;
  dentistMemberId?: string;
  branchId?: string;
  scheduledAt: string;
  durationMinutes: number;
  serviceType: string;
  status: string;
  notes?: string;
  walkIn?: boolean;
}

export function getStatusBadgeProps(status: string): { label: string; className: string } {
  switch (status) {
    case 'scheduled':
      return { label: 'Scheduled', className: 'bg-blue-100 text-blue-700' };
    case 'confirmed':
      return { label: 'Confirmed', className: 'bg-teal-100 text-teal-700' };
    case 'checked_in':
      return { label: 'Checked In', className: 'bg-green-100 text-green-700' };
    case 'completed':
      return { label: 'Completed', className: 'bg-green-100 text-green-700' };
    case 'cancelled':
      return { label: 'Cancelled', className: 'bg-gray-100 text-gray-500' };
    case 'no_show':
      return { label: 'No Show', className: 'bg-red-100 text-red-700' };
    default:
      return { label: status, className: 'bg-gray-100 text-gray-500' };
  }
}

export function canCheckIn(status: string): boolean {
  return status === 'scheduled' || status === 'confirmed';
}

export function canConfirm(status: string): boolean {
  return status === 'scheduled';
}

// FR3.4: an appointment can be cancelled only from a state that APPOINTMENT_TRANSITIONS
// allows to reach `cancelled` — scheduled/confirmed/checked_in. NOT no_show (its only
// transition is →completed), nor the terminal completed/cancelled. Mirroring the FSM
// here avoids a false Cancel affordance that the backend would 422.
export function canCancelStatus(status: string): boolean {
  return ['scheduled', 'confirmed', 'checked_in'].includes(status);
}

function formatTime(isoString: string): string {
  const d = new Date(isoString);
  const h = d.getHours();
  const m = d.getMinutes();
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
  const displayM = m.toString().padStart(2, '0');
  return `${displayH}:${displayM} ${period}`;
}

function truncateId(id: string, maxLen = 8): string {
  if (id.length <= maxLen) return id;
  return id.slice(0, maxLen) + '...';
}

interface AppointmentCardProps {
  appointment: Appointment;
  onClick?: (appointment: Appointment) => void;
  onCheckIn?: (appointmentId: string) => void;
  onConfirm?: (appointmentId: string) => void;
  /** FR3.4: cancel affordance. Parent supplies it only for cancel-capable roles. */
  onCancel?: (appointment: Appointment) => void;
  compact?: boolean;
}

export function AppointmentCard({ appointment, onClick, onCheckIn, onConfirm, onCancel, compact }: AppointmentCardProps) {
  const badge = getStatusBadgeProps(appointment.status);
  const time = formatTime(appointment.scheduledAt);
  const checkInAllowed = canCheckIn(appointment.status);
  const confirmAllowed = canConfirm(appointment.status);
  const cancelAllowed = canCancelStatus(appointment.status);

  const statusStyles: Record<string, string> = {
    scheduled: 'border-l-blue-500 bg-blue-50/60',
    confirmed: 'border-l-teal-500 bg-teal-50/60',
    checked_in: 'border-l-green-500 bg-green-50/60',
    checkedIn: 'border-l-green-500 bg-green-50/60',
    completed: 'border-l-gray-400 bg-gray-50/40',
    cancelled: 'border-l-gray-300 bg-gray-50/30 opacity-60',
    noShow: 'border-l-red-500 bg-red-50/60',
  };

  const cardStyle = statusStyles[appointment.status] || 'border-l-gray-300 bg-gray-50/30';

  if (compact) {
    return (
      <div
        className={`border-l-3 rounded-md px-2 py-1 cursor-pointer hover:brightness-95 transition-all ${cardStyle}`}
        onClick={() => onClick?.(appointment)}
        onKeyDown={activateOnKey(() => onClick?.(appointment))}
        role="button"
        tabIndex={0}
        aria-label={`${appointment.patientName ?? truncateId(appointment.patientId)}, ${time}, ${appointment.serviceType}`}
      >
        <div className="text-[11px] font-semibold truncate">{appointment.patientName ?? truncateId(appointment.patientId)}</div>
        <div className="text-[10px] text-muted-foreground">{time}</div>
      </div>
    );
  }

  return (
    <div
      className={`border-l-[3px] rounded-lg px-3 py-2 cursor-pointer hover:shadow-md transition-all relative group focus-within:ring-2 focus-within:ring-ring ${cardStyle}`}
      onClick={() => onClick?.(appointment)}
      onKeyDown={activateOnKey(() => onClick?.(appointment))}
      role="button"
      tabIndex={0}
      aria-label={`${appointment.patientName ?? truncateId(appointment.patientId)}, ${time}, ${appointment.serviceType}, ${badge.label}`}
    >
      <div className="text-xs font-semibold truncate">{appointment.patientName ?? truncateId(appointment.patientId)}</div>
      <div className="text-[11px] text-muted-foreground truncate">
        {appointment.serviceType} · {time}
      </div>
      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold mt-1 ${badge.className}`}>
        {badge.label}
      </span>
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
        {confirmAllowed && onConfirm && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onConfirm(appointment.id);
            }}
            className="bg-secondary text-foreground text-[11px] font-semibold px-2.5 py-1 rounded-md border border-border hover:bg-background transition-colors"
            aria-label={`Confirm ${appointment.patientName ?? truncateId(appointment.patientId)}`}
          >
            Confirm
          </button>
        )}
        {checkInAllowed && onCheckIn && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCheckIn(appointment.id);
            }}
            className="bg-lemon text-lemon-foreground text-[11px] font-semibold px-2.5 py-1 rounded-md"
            aria-label={`Check in ${appointment.patientName ?? truncateId(appointment.patientId)}`}
          >
            Check In
          </button>
        )}
        {cancelAllowed && onCancel && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCancel(appointment);
            }}
            className="bg-secondary text-destructive text-[11px] font-semibold px-2.5 py-1 rounded-md border border-border hover:bg-background transition-colors"
            aria-label={`Cancel ${appointment.patientName ?? truncateId(appointment.patientId)}`}
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
