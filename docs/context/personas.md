# Personas & Roles

Dental practice management platform personas. Used by `/persona-audit` to validate user journeys before implementation.

---

## Role System

Roles come from two sources:
- **Better-Auth admin plugin**: `admin` (promoted via `adminEmails` config)
- **DentalMembership table**: `dentist_owner` | `dentist_associate` | `staff_full` | `staff_scheduling`

Authentication methods: email + password, PIN-only (kiosk mode), passkey, magic link, API key.

---

## Personas

### 1. Alex — Dentist Owner (Practice Principal)

**System role:** `dentist_owner`  
**Auth:** Email + password + optional 2FA  
**Branch:** One membership per branch (can own multiple)

**Who they are:**  
Runs the practice. Responsible for clinical quality, staff management, and business performance. Works chairside 60% of the day, handles admin during off-hours or between patients. Not highly technical — expects the software to stay out of their way.

**Goals:**
- See today's schedule and patient status at a glance
- Prescribe, order labs/imaging, record visit notes
- Manage staff (add members, set PINs, deactivate)
- Submit insurance claims and track payment status
- Review branch-level performance

**Context of use:** Desktop (clinical), mobile (quick checks between patients)

**Module access:**
| Module | Access |
|--------|--------|
| dental-org | Read/Write (branch admin) |
| dental-patient | Read/Write |
| dental-clinical | Read/Write (prescriptions, labs, conditions) |
| dental-scheduling | Read/Write |
| dental-billing | Read/Write (claims, eligibility) |
| dental-visit | Read/Write |
| dental-pmd | Read/Write (manage practitioners) |
| booking | Read/Write |
| comms | Read/Write |
| notifs | Read/Write |
| audit | Read |

**Critical journeys:**
1. Open today's appointments → check in patient → record visit → prescribe
2. Staff management → add new member → assign role → set PIN
3. Billing → check eligibility → submit claim → track status

---

### 2. Jordan — Dentist Associate (Associate Dentist)

**System role:** `dentist_associate`  
**Auth:** Email + password  
**Branch:** One membership per branch

**Who they are:**  
Employed dentist. Sees patients assigned to their schedule. Focused purely on clinical work — no admin responsibilities. May work at multiple branches.

**Goals:**
- See their own schedule (not full branch schedule)
- Record visit notes, prescriptions, conditions
- Order labs and imaging
- View patient history before appointments

**Context of use:** Desktop (clinical workstation), occasionally tablet

**Module access:**
| Module | Access |
|--------|--------|
| dental-patient | Read/Write |
| dental-clinical | Read/Write |
| dental-scheduling | Read (own schedule only) |
| dental-visit | Read/Write |
| dental-pmd | Read |
| dental-billing | Read |
| notifs | Read |

**Critical journeys:**
1. Check own schedule → select patient → view history → record visit
2. Write prescription → submit → print/send to pharmacy
3. Order lab → record results when received

---

### 3. Sam — Front Desk Staff (Full Access)

**System role:** `staff_full`  
**Auth:** Email + password OR PIN-only (kiosk mode)  
**Branch:** One membership per branch

**Who they are:**  
Manages patient flow and administrative tasks. First point of contact. Handles check-in, booking, and consent. May also process insurance eligibility. Not clinical — never prescribes or records clinical data.

**Goals:**
- Check in patients quickly (they're standing at the desk)
- Book and reschedule appointments
- Record patient consent
- Verify insurance eligibility
- Update patient contact info

**Context of use:** Desktop (reception desk), PIN-only mode for shared kiosk stations. High-frequency, quick interactions. Interrupted constantly.

**Module access:**
| Module | Access |
|--------|--------|
| dental-patient | Read/Write |
| dental-scheduling | Read/Write |
| dental-billing | Read (eligibility checks) |
| dental-org | Read |
| booking | Read/Write |
| notifs | Read |

**Critical journeys:**
1. Patient arrives → find record → mark checked-in → collect consent
2. Phone call → find slot → book appointment → send confirmation
3. Insurance question → verify eligibility → report back to patient

---

### 4. Riley — Scheduling Specialist

**System role:** `staff_scheduling`  
**Auth:** Email + password OR PIN-only  
**Branch:** One membership per branch

**Who they are:**  
Dedicated to managing appointment availability and bookings. Works the phone and online queue. May also handle referral-based bookings from external practitioners.

**Goals:**
- Set up and manage provider availability (slots)
- Book, cancel, reschedule appointments
- Verify insurance before booking
- Process referral bookings from external providers

**Context of use:** Desktop, heavily phone-driven workflow. Works quickly through a queue.

**Module access:**
| Module | Access |
|--------|--------|
| dental-scheduling | Read/Write |
| dental-patient | Read |
| dental-billing | Read (eligibility only) |
| dental-pmd | Read (practitioner schedules) |
| booking | Read/Write |
| notifs | Read |

**Critical journeys:**
1. Set practitioner availability → publish slots → confirm bookings
2. Inbound call → check availability → book → send confirmation
3. Referral received → book slot → notify provider

---

### 5. Morgan — Billing Specialist

**System role:** `staff_full` (billing-focused)  
**Auth:** Email + password  
**Branch:** One membership per branch

**Who they are:**  
Handles all insurance and payment workflows. Works from a billing queue — not patient-facing. Focused on claim accuracy and timely reimbursement.

**Goals:**
- Verify eligibility before treatment
- Submit clean claims after visits
- Track claim status and follow up on rejections
- Manage prior authorization requests

**Context of use:** Desktop only. Processes a queue of claims daily. Detail-oriented — values accuracy over speed.

**Module access:**
| Module | Access |
|--------|--------|
| dental-billing | Read/Write |
| dental-patient | Read |
| dental-visit | Read |
| dental-clinical | Read |
| audit | Read |

**Critical journeys:**
1. End-of-day → review completed visits → submit claims
2. Claim rejected → review error → correct → resubmit
3. Prior auth required → gather docs → submit → track

---

### 6. Taylor — Patient (End User)

**System role:** `user` (default, with Person profile)  
**Auth:** Email + password, magic link, passkey  
**Onboarding:** Required (Person profile completion)

**Who they are:**  
Patient of the dental practice. Uses the platform to manage their own appointments, see their records, and pay bills. Variable tech comfort. Often anxious about dental visits — the UX should reduce friction, not add to it.

**Goals:**
- Book or reschedule an appointment
- See upcoming appointments and reminders
- View their treatment history and invoices
- Pay outstanding balances
- Receive and read notifications

**Context of use:** Mobile-first. Uses the app infrequently (before/after appointments). May be seeing this for the first time at check-in.

**Module access:**
| Module | Access |
|--------|--------|
| dental-patient | Read/Write (own record only) |
| dental-scheduling | Read/Write (own appointments) |
| dental-billing | Read (own invoices) |
| dental-clinical | Read (own records) |
| booking | Read/Write (own bookings) |
| notifs | Read/Write |
| comms | Read |

**Critical journeys:**
1. Receive reminder → confirm appointment → arrive → check in
2. Need appointment → browse slots → book → receive confirmation
3. Invoice received → view details → pay online

---

### 7. Pat — External Practitioner / Referring Provider

**System role:** External (not a DentalMembership member)  
**Auth:** API key or limited session (referral workflow)

**Who they are:**  
A provider from another practice who sends referrals. May not have a full account — interacts primarily through the referral workflow. Doesn't use the practice management UI directly.

**Goals:**
- Send a patient referral to the practice
- Check appointment status for their referred patient
- Receive results or discharge notes

**Context of use:** External — API integration or limited guest access.

**Module access:**
| Module | Access |
|--------|--------|
| dental-pmd | Read/Write (own record) |
| dental-scheduling | Read (referral-based bookings) |
| dental-visit | Read (referral outcomes) |

**Critical journeys:**
1. Create referral → select practice → attach patient info → submit
2. Check referral status → see booked appointment → receive outcome note

---

## Decision Rules for Persona Audits

When running `/persona-audit`, use this priority order:

1. **Taylor (Patient)** — highest volume, mobile-first, most sensitive to friction
2. **Sam (Front Desk)** — highest frequency of use, real-time pressure, interrupted workflow
3. **Alex (Dentist Owner)** — broadest access, most complex journeys
4. **Jordan (Associate)** — clinical-only, simpler but high stakes (prescriptions)
5. **Riley (Scheduling)** — focused scope, booking queue workflows
6. **Morgan (Billing)** — back-office, detail-oriented, claim accuracy critical
7. **Pat (Practitioner)** — edge case, mostly API/integration surface

## Auth Notes

- PIN-only users (`staff_full`, `staff_scheduling`) do NOT have a `Person` profile — skip `requirePerson` guard for these roles
- `requireEmailVerified` guard is currently disabled in guards.ts (line 92-96) — note this in audit reports
- `adminEmails` promotion happens at sign-up — platform admins have all-access and don't follow module restrictions
