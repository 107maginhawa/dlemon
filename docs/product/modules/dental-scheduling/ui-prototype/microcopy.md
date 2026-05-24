# Microcopy — dental-scheduling
<!-- oli: v3-dentalemon | dental-scheduling | ui-prototype -->
<!-- Stub: see screens.md and components.md for primary specification -->

**CTAs:** "Book Appointment", "Check In", "Reschedule", "Cancel Appointment", "Keep Appointment", "Confirm Booking", "Confirm Reschedule", "Save Changes".

**Labels:** "Patient", "Dentist", "Room", "Appointment type", "Duration", "Notes", "Reason for cancellation", "Working hours", "Closed".

**Status:** "Scheduled", "Checked in", "Completed", "Cancelled", "No-show".

**Empty / placeholder:**
- Calendar: "No appointments scheduled."
- Slot picker: "No available slots — try another day."
- Patient search: "Search patients by name, phone, or DOB."

**Errors / blocks:**
- Double-booking: "This slot conflicts with an existing appointment. Please pick another time."
- Same-day reschedule: "Same-day appointments cannot be rescheduled. Cancel and rebook instead."
- Check-in non-today: "Check-in is only allowed for today's appointments."
- Working hours: "End time must be after start time."
- Cancel reason: "At least 10 characters required."

**Success toasts:**
- "Appointment booked for {patient} on {date} at {time}."
- "Appointment rescheduled."
- "Appointment cancelled."
- "Patient checked in. Visit created."
- "Working hours updated."
