# Screens — dental-scheduling
<!-- oli: v3-dentalemon | dental-scheduling | ui-prototype -->

Apple HIG + Lemon `#FFE97D` accent. SF Pro font. `#F2F2F7` grouped background, white card surfaces. 44px touch targets. Radix UI primitives from `apps/dentalemon/src/components/`.

Status color tokens:
- scheduled = `#0A84FF` (system blue)
- checked-in = `#FFE97D` (lemon accent, dark text)
- completed = `#8E8E93` (gray)
- cancelled = `#FF3B30` (system red)
- no-show = `#FF9500` (system orange)

---

## Screen: Calendar View (`/schedule`)
**Roles:** all dental roles (view); staff_full + dentist_owner (book/cancel/check-in)
**Layout:**
- Top bar: `Today` button, `<` `>` chevrons, current date/range label, `Week | Day` segmented toggle, `By Dentist | By Room` grouping toggle, `+ Book Appointment` primary CTA (lemon, top-right).
- Left rail (240px): MiniMonthNav + DentistFilterChips + room filter list.
- Main grid: time slots vertical (07:00–20:00, 15-min increments), columns horizontal (dentist or room). Current-time line in lemon. Appointment blocks color-coded by status. Click block → AppointmentDetailPopover. Click empty cell → BookAppointmentDialog pre-filled with slot.
- Sticky column headers (dentist photo + name OR room name + chair icon).

**Components:** CalendarGrid, AppointmentBlock, AppointmentDetailPopover, MiniMonthNav, DentistFilterChips, AppointmentStatusBadge
**States:**
- Loading: gray skeleton blocks in time grid.
- Empty: "No appointments scheduled" centered illustration + `+ Book Appointment` CTA.
- Week vs Day toggle: Week = 7 columns × dentists nested; Day = full-width per-dentist columns.
- Today highlight: column header lemon-tinted.
- Past slots: rendered at 50% opacity, non-clickable for booking.
- Current-time indicator: 2px lemon horizontal line on today column.

---

## Screen: Appointment Detail Popover
**Roles:** all (view); staff_full + dentist_owner (actions)
**Layout:** Radix Popover anchored to clicked AppointmentBlock. 360px wide card, white surface, `shadow-lg`, `rounded-xl`.
- Header row: patient avatar (40px) + patient name (SF Pro Semibold 17pt) + AppointmentStatusBadge.
- Meta rows (icon + label + value): clock (start–end time + duration), user-md (dentist name), door (room), tag (appointment type), sticky-note (notes preview, 2 lines max).
- Action bar (sticky bottom): `Check In` (primary lemon, only when today + status=scheduled), `Reschedule` (secondary), `Cancel` (destructive ghost). Role-gated buttons hidden for view-only roles.
- Tap patient name → navigate to patient detail.

**Components:** AppointmentDetailPopover, AppointmentStatusBadge
**States:**
- scheduled today: Check In + Reschedule + Cancel visible.
- checked-in: Check In hidden; "Checked in at HH:MM" inline; Cancel/Reschedule disabled.
- completed: actions hidden, "View Visit" CTA appears.
- cancelled: greyed-out, only "View reason" expandable.
- Loading actions: spinner overlay on button.

---

## Screen: Book Appointment Dialog
**Roles:** staff_full, dentist_owner
**Layout:** Radix Dialog, 560px wide, 3-step wizard with top StepIndicator (Patient · Slot · Details).
- **Step 1 — Select Patient:** Search input (debounced, 250ms), recent patients list (5), `+ New patient` link. Selected patient card shows name + DOB + photo + outstanding-balance chip.
- **Step 2 — Select Dentist + Date + Time:** Date picker (calendar), DentistFilterChips, SlotPicker grid (rows = dentists, columns = 15-min slots, color-coded availability). Tap slot → highlighted lemon.
- **Step 3 — Details:** Appointment type dropdown (Exam, Cleaning, Filling, Crown Prep, Extraction, Consult, Other), duration (auto-filled from type, editable), room select, notes textarea (500 char limit, counter).
- Footer: `Back` (steps 2–3), `Cancel`, `Next` / `Confirm Booking` (primary lemon, disabled until valid).

**Components:** BookAppointmentDialog, SlotPicker, DentistFilterChips, DoubleBookingWarning
**States:**
- Step validation: Next disabled until required fields filled.
- Double-booking detected on Confirm: DoubleBookingWarning blocking modal (cannot override, FR3.7 hard-block).
- Slot conflict mid-flow (concurrent booking): refetch availability, toast "Slot just taken, pick another."
- Submitting: button spinner + form disabled.
- Success: dialog closes, toast "Appointment booked for [patient] on [date] at [time]", calendar refetches.

---

## Screen: Reschedule Dialog
**Roles:** staff_full, dentist_owner
**Layout:** Radix Dialog, 520px wide.
- Top card: current appointment summary (patient + datetime + dentist + type), greyed.
- Below: SlotPicker (same as Book step 2), pre-filtered to same dentist by default with "Show all dentists" toggle.
- Reason for reschedule (optional textarea).
- Footer: `Cancel`, `Confirm Reschedule` (primary lemon).

**Components:** RescheduleDialog, SlotPicker
**States:**
- Same-day hard-block: if current appointment is today, dialog opens with blocking Alert "Cannot reschedule same-day appointments. Cancel and rebook instead." `Confirm Reschedule` permanently disabled.
- New slot selected: summary diff shown (old → new).
- Submit success: toast "Appointment rescheduled."

---

## Screen: Cancel Appointment Dialog
**Roles:** staff_full, dentist_owner
**Layout:** Radix AlertDialog, 480px wide.
- Title: "Cancel appointment?"
- Body: appointment summary (patient + datetime + dentist + type).
- Reason textarea: required, min 10 chars, counter, placeholder "Reason for cancellation (visible to staff)…".
- Footer: `Keep Appointment` (secondary), `Cancel Appointment` (destructive red, disabled until reason ≥10 chars).

**Components:** CancelDialog
**States:**
- Reason too short: inline helper text "At least 10 characters required."
- Submitting: button spinner.
- Success: dialog closes, calendar block fades to cancelled red, toast "Appointment cancelled."

---

## Screen: Check-in Confirmation
**Roles:** staff_full, dentist_owner
**Layout:** Radix AlertDialog, 440px wide.
- Title: "Check in patient?"
- Body card: patient avatar + name + DOB, appointment time, dentist, type.
- Note: "This will create a visit record and move the patient to today's chair queue."
- Footer: `Cancel`, `Check In` (primary lemon).

**Components:** CheckInDialog
**States:**
- Not today's appointment: dialog cannot open — block at trigger with toast "Check-in only allowed for today's appointments." (BR-004)
- Already checked in: dialog cannot open — Check In button hidden.
- Submitting: button spinner.
- Success: toast "Patient checked in. Visit created.", appointment block flips lemon, patient appears in PMD queue.

---

## Screen: Working Hours Settings (`/settings/working-hours`)
**Roles:** dentist_owner, staff_full
**Layout:** Card-list view, one card per dentist (avatar + name header).
- Each card: 7 rows (Mon–Sun). Per row: day label, active toggle (Radix Switch, lemon when on), start time picker, end time picker, optional break range (+ Add break).
- Bulk action: `Copy Monday to weekdays` link per card.
- Page footer: `Save Changes` (primary lemon, sticky), `Discard` (ghost).

**Components:** WorkingHoursForm
**States:**
- Day inactive: time pickers greyed, "Closed" label.
- Validation: end > start; break within range. Inline red helper on error.
- Unsaved changes banner top of page when dirty.
- Save success: toast "Working hours updated.", banner clears.
- Save error: inline + toast "Could not save changes."
