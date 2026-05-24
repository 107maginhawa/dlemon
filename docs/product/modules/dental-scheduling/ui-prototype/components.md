# Components — dental-scheduling
<!-- oli: v3-dentalemon | dental-scheduling | ui-prototype -->

All components built on Radix UI primitives in `apps/dentalemon/src/components/`. Apple HIG sizing, SF Pro, lemon `#FFE97D` accent. 44px min touch targets.

---

## CalendarGrid
**Props:**
- `view: 'week' | 'day'`
- `groupBy: 'dentist' | 'room'`
- `date: Date`
- `appointments: Appointment[]`
- `dentists: Dentist[]`
- `rooms: Room[]`
- `onSlotClick(dentistId, datetime)`
- `onAppointmentClick(appointmentId)`
- `loading: boolean`

**Behavior:** Renders vertical time axis (07:00–20:00, 15-min increments, 24px per slot). Horizontal columns by dentist or room. Appointment blocks absolutely positioned (top = start offset, height = duration × 24/15). Click empty slot → onSlotClick (only future). Click block → onAppointmentClick. Sticky time gutter (left) and column headers (top). Current-time line (2px lemon, today only). Past slots 50% opacity. Auto-scroll on mount to current hour − 1.

---

## AppointmentBlock
**Props:**
- `appointment: { id, patientName, type, durationMins, status }`
- `compact: boolean` (true in week view)
- `onClick()`

**Behavior:** Color-coded by status (left border 4px solid, surface 8% tint). Compact mode: patient name only (truncate). Full mode: patient name + type + duration indicator. SF Pro 13pt Semibold name, 11pt Regular meta. Lemon focus ring on keyboard focus. `aria-label`: "{patient}, {type}, {time}, {status}". Min height 24px (1 slot).

---

## AppointmentDetailPopover
**Props:**
- `appointmentId: string`
- `anchorRef: RefObject`
- `open: boolean`
- `onOpenChange(open)`
- `onAction(action: 'check-in' | 'reschedule' | 'cancel' | 'view-visit')`

**Behavior:** Radix Popover. Fetches full detail on open (TanStack Query). 360px wide. Renders header + meta + action bar. Action visibility computed from `status`, `isToday`, `currentUserRole`. Click patient name → navigate. Closes on outside click + ESC. Animated fade+scale (150ms).

---

## SlotPicker
**Props:**
- `date: Date`
- `dentists: Dentist[]`
- `selectedDentistIds: string[]`
- `durationMins: number` (highlights N consecutive slots)
- `existingAppointments: Appointment[]`
- `workingHours: WorkingHoursMap`
- `selected: { dentistId, startTime } | null`
- `onSelect(dentistId, startTime)`

**Behavior:** Grid: dentist rows × 15-min time columns (08:00–18:00 default, clipped to working hours). Cells:
- available = white surface, hover lemon tint.
- occupied = striped gray, non-clickable.
- outside-hours = greyed solid.
- selected = lemon fill + N-slot span outlined.
Click available cell → onSelect. Keyboard nav (arrow keys, Enter). `aria-grid` semantics. Tooltip on occupied: "Booked: {patient} {type}".

---

## MiniMonthNav
**Props:**
- `selectedDate: Date`
- `onSelect(date)`
- `appointmentDensity: Map<dateStr, number>`

**Behavior:** Radix calendar primitive. Month grid with `<` `>` nav. Today = bold + lemon underline. Selected day = lemon fill, dark text. Days with appointments = small lemon dot below number, opacity scales with density. Range highlight when in week view (Mon–Sun band).

---

## DentistFilterChips
**Props:**
- `dentists: Dentist[]`
- `selectedIds: string[]`
- `onChange(ids)`

**Behavior:** Multi-select chip group (Radix ToggleGroup type=multiple). Chip = avatar (20px) + first name. Selected chip = lemon fill. `All` chip toggles full set. Min 44px height. Horizontal scroll on overflow.

---

## BookAppointmentDialog
**Props:**
- `open: boolean`
- `onOpenChange(open)`
- `initialSlot?: { dentistId, startTime }`
- `initialPatientId?: string`
- `onSuccess(appointmentId)`

**Behavior:** Radix Dialog, 3-step wizard. StepIndicator top. State managed via TanStack Form. Step transitions disabled until step valid. On Confirm: POST appointment; on 409 conflict → render DoubleBookingWarning (blocking). Closes on success with toast.

---

## RescheduleDialog
**Props:**
- `appointmentId: string`
- `open: boolean`
- `onOpenChange(open)`
- `onSuccess()`

**Behavior:** Radix Dialog. Fetches current appointment. Checks `isToday(currentAppt.startTime)` → if true, renders blocking Alert and disables Confirm permanently. Otherwise mounts SlotPicker, computes diff card, submits PATCH on confirm.

---

## CancelDialog
**Props:**
- `appointmentId: string`
- `open: boolean`
- `onOpenChange(open)`
- `onSuccess()`

**Behavior:** Radix AlertDialog. Reason textarea (controlled, min 10 chars). Confirm button disabled until valid. POST cancel on confirm. Optimistic update: appointment block flips to cancelled state immediately.

---

## CheckInDialog
**Props:**
- `appointmentId: string`
- `open: boolean`
- `onOpenChange(open)`
- `onSuccess(visitId)`

**Behavior:** Radix AlertDialog. Pre-check at trigger: if `!isToday(startTime)` → block dialog open + toast (BR-004 enforcement). Confirm → POST check-in → creates visit → returns visitId. Toast + cache invalidation (calendar + PMD queue).

---

## DoubleBookingWarning
**Props:**
- `conflicts: Appointment[]` (existing overlapping appointments)
- `onDismiss()`

**Behavior:** Blocking Radix AlertDialog over BookAppointmentDialog. Lists conflicting appointments (patient, time, dentist). Single action: `Pick another slot`. No override (FR3.7 hard-block). Red `#FF3B30` accent icon + heading.

---

## AppointmentStatusBadge
**Props:**
- `status: 'scheduled' | 'checked-in' | 'completed' | 'cancelled' | 'no-show'`
- `size: 'sm' | 'md'`

**Behavior:** Pill badge, status color background at 16% opacity + matching text color. SF Pro 11pt Semibold (sm) / 13pt (md). 4px vertical / 8px horizontal padding. Rounded full. `aria-label` mirrors status.

---

## WorkingHoursForm
**Props:**
- `dentistId: string`
- `value: WeeklySchedule`
- `onChange(value)`
- `onSave()`
- `dirty: boolean`

**Behavior:** Card with 7 day rows. Each row: Radix Switch (active), 2 time pickers (start/end), optional break row(s). `Copy Monday to weekdays` link bulk-applies Mon to Tue–Fri. Validates end > start, breaks within range. Sticky save bar appears when dirty. Disabled rows render "Closed" label.
