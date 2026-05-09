/**
 * AppointmentCard — compact appointment card used in day/week views
 *
 * Shows: patient ID (truncated), procedure type, time, status badge
 * Check-in button if status === 'scheduled'
 */

import React from 'react';

export interface Appointment {
  id: string;
  patientId: string;
  patientName?: string;
  dentistMemberId?: string;
  branchId?: string;
  scheduledAt: string;
  durationMinutes: number;
  procedureType: string;
  status: string;
  notes?: string;
  walkIn?: boolean;
}

export function getStatusBadgeProps(status: string): { label: string; className: string } {
  switch (status) {
    case 'scheduled':
      return { label: 'Scheduled', className: 'bg-blue-100 text-blue-700' };
    case 'checkedIn':
      return { label: 'Checked In', className: 'bg-green-100 text-green-700' };
    case 'completed':
      return { label: 'Completed', className: 'bg-green-100 text-green-700' };
    case 'cancelled':
      return { label: 'Cancelled', className: 'bg-gray-100 text-gray-500' };
    case 'noShow':
      return { label: 'No Show', className: 'bg-red-100 text-red-700' };
    default:
      return { label: status, className: 'bg-gray-100 text-gray-500' };
  }
}

export function canCheckIn(status: string): boolean {
  return status === 'scheduled';
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
  compact?: boolean;
}

export function AppointmentCard({ appointment, onClick, onCheckIn, compact }: AppointmentCardProps) {
  const badge = getStatusBadgeProps(appointment.status);
  const time = formatTime(appointment.scheduledAt);
  const isScheduled = canCheckIn(appointment.status);

  const statusStyles: Record<string, string> = {
    scheduled: 'border-l-blue-500 bg-blue-50/60',
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
        role="button"
        tabIndex={0}
        aria-label={`${appointment.patientName ?? truncateId(appointment.patientId)}, ${time}, ${appointment.procedureType}`}
      >
        <div className="text-[11px] font-semibold truncate">{appointment.patientName ?? truncateId(appointment.patientId)}</div>
        <div className="text-[10px] text-muted-foreground">{time}</div>
      </div>
    );
  }

  return (
    <div
      className={`border-l-[3px] rounded-lg px-3 py-2 cursor-pointer hover:shadow-md transition-all relative group ${cardStyle}`}
      onClick={() => onClick?.(appointment)}
      role="button"
      tabIndex={0}
      aria-label={`${appointment.patientName ?? truncateId(appointment.patientId)}, ${time}, ${appointment.procedureType}, ${badge.label}`}
    >
      <div className="text-xs font-semibold truncate">{appointment.patientName ?? truncateId(appointment.patientId)}</div>
      <div className="text-[11px] text-muted-foreground truncate">
        {appointment.procedureType} · {time}
      </div>
      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold mt-1 ${badge.className}`}>
        {badge.label}
      </span>
      {isScheduled && onCheckIn && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onCheckIn(appointment.id);
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 bg-[#FFE97D] text-[#4A4018] text-[11px] font-semibold px-2.5 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label={`Check in ${appointment.patientName ?? truncateId(appointment.patientId)}`}
        >
          Check In
        </button>
      )}
    </div>
  );
}
