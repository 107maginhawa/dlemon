# Mock Data — dental-scheduling
<!-- oli: v3-dentalemon | dental-scheduling | ui-prototype -->
<!-- Stub: see screens.md and components.md for primary specification -->

**Dentists:** Dr. Maya Chen (dentist_owner), Dr. Liam Park (dentist_associate).
**Rooms:** Operatory 1, Operatory 2, Consult Room.

**Sample week (today = Wed):**
- Mon 09:00 — Jordan Reyes — Exam — Dr. Chen — Op 1 — `scheduled`
- Mon 14:30 — Priya Patel — Cleaning — Dr. Park — Op 2 — `completed`
- Tue 10:30 — Marco Silva — Filling (45 min) — Dr. Chen — Op 1 — `checked-in`
- Wed 11:00 — Aisha Khan — Crown Prep (90 min) — Dr. Chen — Op 1 — `scheduled` (today)
- Wed 11:30 — Tom Becker — Consult — Dr. Park — Consult Room — `scheduled` (today)
- Thu 09:30 — Lin Wei — Extraction — Dr. Park — Op 2 — `scheduled`
- Thu 13:00 — Hannah Owens — Exam — Dr. Chen — Op 1 — `cancelled` (reason: "Patient requested reschedule, called back to rebook next week")
- Fri 15:00 — Carlos Mendez — Cleaning — Dr. Park — Op 2 — `no-show`

**Double-booking scenario:** attempt to book Aisha Khan Wed 11:30 with Dr. Chen — conflicts with existing 11:00 crown prep (overlap 30 min). Warning blocks.

**Same-day reschedule:** Marco Silva 10:30 today — Reschedule dialog opens with blocking Alert.

**Working hours sample (Dr. Chen):** Mon–Thu 08:00–17:00 (break 12:00–13:00), Fri 08:00–14:00, Sat/Sun closed.
