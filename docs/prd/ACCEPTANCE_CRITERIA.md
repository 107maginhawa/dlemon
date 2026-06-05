# Dentalemon — Acceptance Criteria

**V3 Addendum · Plan B Phase 4 · May 2026**

Companion to `docs/prd/v3-dentalemon.md`. Defines Given/When/Then criteria for all P0 workflows. These are the verification gates for every feature — a workflow is only complete when its acceptance criteria pass.

---

## How to Read This Document

- **AC-NNN** — acceptance criteria identifier (reference in tests, PRs, and bug reports)
- **P0** — must ship in Phase 1 Core Product
- **P1** — ships in Phase 2 Growth
- **Given** — precondition state of the system
- **When** — the user action or system event
- **Then** — observable outcome that must be true

---

## 1. Patient Registration (AC-REG)

### AC-REG-01: Register new patient with consent

**Given** a logged-in staff member on the Patients page  
**And** no existing patient record with the same name + date of birth  
**When** they fill in display name, date of birth, gender, and tick the consent checkbox, then submit  
**Then** a new patient record is created and appears in the patient list  
**And** the patient's `consentGiven` flag is `true` with `consentDate` set to now  
**And** the staff member is navigated to the new patient's profile  

### AC-REG-02: Registration blocked without consent

**Given** a logged-in staff member on the patient registration form  
**When** they submit without ticking the consent checkbox  
**Then** registration is rejected with an error: "Patient consent is required"  
**And** no patient record is created  

### AC-REG-03: Walk-in from calendar

**Given** a logged-in staff member on the Calendar page  
**When** they click "Walk-In"  
**Then** the appointment modal opens with today's date and time pre-filled  
**And** after saving, the appointment appears in the day view  
**And** a check-in button is visible on the appointment card  

---

## 2. Scheduling (AC-SCHED)

### AC-SCHED-01: Create appointment

**Given** a logged-in staff member on the Calendar page  
**When** they click "New Appointment", select a patient, date, time, and dentist, then save  
**Then** the appointment appears in the correct time slot on the calendar  
**And** the appointment status is `scheduled`  

### AC-SCHED-02: Edit existing appointment

**Given** an existing `scheduled` or `confirmed` appointment  
**When** a staff member clicks the appointment card and edits the time or dentist  
**Then** the appointment updates and the calendar reflects the change  

### AC-SCHED-03: Check in from appointment

**Given** a `scheduled` or `confirmed` appointment for today  
**When** a staff member clicks "Check In" on the appointment card  
**Then** the appointment status changes to `checked_in`  
**And** a new visit record is created for that patient, linked to the branch  
**And** the staff member is navigated to the clinical workspace for that visit  

### AC-SCHED-04: Cancel appointment

**Given** a `scheduled` or `confirmed` appointment  
**When** a staff member cancels it  
**Then** the appointment status changes to `cancelled`  
**And** the slot is freed on the calendar  

### AC-SCHED-05: Date-filtered appointment list

**Given** appointments exist across multiple dates  
**When** a staff member requests the appointment list with a specific date filter  
**Then** only appointments scheduled on that date are returned  
**And** appointments on other dates are excluded from the results

### AC-SETTINGS-01: Configure branch working hours

**Given** a branch admin with dentist_owner membership  
**When** they submit a working hours config via PUT `/dental/branches/:branchId/working-hours`  
**Then** the configuration is persisted and returned with correct open/close times per day  
**And** a subsequent GET returns the saved config  
**And** appointment creation outside configured hours is rejected with `OUTSIDE_WORKING_HOURS`

---

## 3. Clinical Workspace — Visit (AC-VISIT)

### AC-VISIT-01: Open clinical workspace

**Given** a logged-in dentist and an `active` (checked_in or in_progress) visit  
**When** they navigate to `/_workspace/:patientId`  
**Then** the workspace renders with the top bar showing patient name and safety floor (allergies, medications, conditions)  
**And** the timeline carousel shows the patient's visit history  
**And** the treatment table shows treatments for the current visit  

### AC-VISIT-02: Workspace is read-only after checkout

**Given** a visit with status `completed` or `locked`  
**When** a dentist opens the workspace for that patient  
**Then** chart entries cannot be edited or added  
**And** the footer shows "View Invoice" instead of "Continue to Payment"  
**And** all action buttons (Rx, consent, lab) are disabled  

### AC-VISIT-03: Create new visit

**Given** a patient with no active visit  
**When** a dentist clicks "New Visit" in the timeline carousel  
**Then** a new visit record is created with status `in_progress`  
**And** the new visit card appears at the right end of the carousel  
**And** the new visit becomes the active (focal) card  

### AC-VISIT-04: Year filter

**Given** a patient with visits spanning more than one calendar year  
**When** the dentist selects a specific year from the segment control  
**Then** the carousel shows only visits from that year  
**And** the treatment table updates to show treatments from the focal visit in that year  

---

## 4. Dental Charting (AC-CHART)

### AC-CHART-01: Select tooth and open slideout

**Given** the clinical workspace with an active visit  
**When** the dentist taps a tooth on the dental chart  
**Then** the tooth slideout opens showing the tooth number and current conditions  
**And** the dentist can select surface(s), condition, treatment, and add notes  

### AC-CHART-02: Save tooth chart entry

**Given** the tooth slideout is open with at least one condition or treatment selected  
**When** the dentist taps "Save"  
**Then** the tooth entry is persisted via the API  
**And** the dental chart updates to reflect the new status (color coding)  
**And** the slideout closes  

### AC-CHART-03: Chart entry blocked for completed visit

**Given** a visit with status `completed` or `locked`  
**When** the dentist taps a tooth on the chart  
**Then** the slideout opens in read-only mode  
**And** no save action is available  

### AC-CHART-04: View tooth history

**Given** a tooth with entries across multiple visits  
**When** the dentist opens the tooth slideout  
**Then** a history section shows all past entries for that tooth, sorted newest first  
**And** each entry shows the visit date, condition, and treatment  

### AC-CHART-05: Five-surface selector

**Given** the tooth slideout is open  
**When** the dentist taps a surface zone (Mesial, Distal, Occlusal, Buccal, Lingual)  
**Then** the tapped surface is highlighted  
**And** multiple surfaces can be selected simultaneously  
**And** the selection is included in the saved chart entry  

---

## 5. Treatment Plan (AC-TXPLAN)

### AC-TXPLAN-01: View treatment plan

**Given** a patient with a treatment plan on file  
**When** a dentist or staff member opens the Treatment Plan sheet  
**Then** all planned treatments are listed with tooth number, procedure, estimated cost, and status  

### AC-TXPLAN-02: Carried-over treatments appear in workspace

**Given** a treatment plan with items marked `carriedOver: true`  
**When** the dentist opens the clinical workspace for a new visit  
**Then** carried-over items are displayed in the treatment table with a visual indicator  
**And** they can be completed or rescheduled in the current visit  

---

## 6. Medical History and Consent (AC-MED)

### AC-MED-01: Record medical history entry

**Given** an open clinical workspace  
**When** the dentist opens Medical History / Notes and adds an entry (allergy, medication, or condition)  
**Then** the entry is saved and appears in the safety floor of the top bar if `active: true`  

### AC-MED-02: Safety floor shows active alerts

**Given** a patient with active allergies, medications, or conditions  
**When** the dentist opens the workspace  
**Then** the top bar center shows color-coded badges for each active alert (red=allergy, orange=medication, yellow=condition)  
**And** badges are capped at 6 with a "+N more" indicator  

### AC-MED-03: Collect e-signature consent

**Given** an active visit and an open Consent Sheet  
**When** the dentist selects a consent template, and the patient signs  
**Then** the consent form is saved with status `signed` and is immutable  
**And** re-opening the form shows it in read-only state with "This consent form has already been signed"  

### AC-MED-04: Consent form cannot be re-signed

**Given** a consent form with status `signed`  
**When** a staff member or dentist attempts to sign it again  
**Then** the request is rejected with a 400 error matching `/already signed/i`  
**And** the consent form record is unchanged

### AC-MED-05: Lab order advances through full lifecycle

**Given** a lab order with status `ordered`  
**When** it is updated through `in_fabrication` → `delivered` → `fitted`  
**Then** each status transition returns 200 with the new status  
**And** the final status is `fitted`

---

## 7. Prescriptions (AC-RX)

### AC-RX-01: Write prescription

**Given** an active visit and a logged-in dentist (with prescriberMemberId)  
**When** the dentist opens the Rx sheet, fills in drug, dosage, frequency, and duration, then submits  
**Then** the prescription is saved and linked to the visit  
**And** the Rx sheet shows the new prescription in the list  

### AC-RX-02: Prescription requires prescriber

**Given** a staff member without a dentist membership role  
**When** they open the Rx sheet  
**Then** the form is disabled or hidden with a message indicating prescribing is not permitted  

### AC-PRES-01: Prescription requires prescriberMemberId

**Given** an active visit  
**When** a prescription is submitted without a `prescriberMemberId`  
**Then** the request is rejected with a 400 validation error

### AC-PRES-02: Prescriptions can be listed by visitId

**Given** one or more prescriptions created for a visit  
**When** a GET request is made to `/dental/visits/:visitId/prescriptions`  
**Then** the response contains those prescriptions in the `data` array

### AC-PRES-03: Updating a prescription changes the dosage field

**Given** an existing prescription  
**When** a PATCH request updates the `dosage` field  
**Then** the response reflects the new dosage value

### AC-PRES-04: Prescription without drugName is rejected

**Given** an active visit  
**When** a prescription is submitted with `drugName` omitted  
**Then** the request is rejected with a 400 validation error

### AC-PRES-05: Prescription medication name is required

**Given** an active visit  
**When** a prescription body is submitted without a medication name (`drugName`)  
**Then** the request returns 400 with an `error` key in the response body

---

## 8. Lab Orders (AC-LAB)

### AC-LAB-01: Create lab order

**Given** an active visit  
**When** the dentist opens the Lab Orders sheet and submits an order with type, lab, and notes  
**Then** the lab order is saved with status `ordered`  
**And** it appears in the lab orders list  

### AC-LAB-02: Lab order status progression

**Given** a lab order with status `ordered`  
**When** it moves to `in_progress` then `completed`  
**Then** each status change is reflected in the lab orders sheet  
**And** a `completed` order cannot be returned to `in_progress`  

---

## 9. Attachments (AC-ATTACH)

### AC-ATTACH-01: Upload attachment

**Given** an active visit and the Attachments sheet open  
**When** the dentist selects a file (image, X-ray, document)  
**Then** the file uploads to storage and appears in the attachments list  
**And** the attachment is linked to the current visit  

### AC-ATTACH-02: View attachments

**Given** a visit with attachments  
**When** the dentist opens the Attachments sheet  
**Then** all attachments for the current visit are listed with filename, type, and upload date  

---

## 10. Invoicing (AC-INV)

### AC-INV-01: Continue to payment from workspace

**Given** an active visit with at least one treatment  
**When** the dentist clicks "Continue to Payment" in the workspace footer  
**Then** the payment modal opens showing all treatments as line items with unit prices  
**And** a subtotal is calculated from the sum of line items  

### AC-INV-02: Invoice requires line items

**Given** the payment modal is open  
**When** the dentist attempts to create an invoice with no treatments selected  
**Then** the action is blocked with an error: "At least one treatment is required"  

### AC-INV-03: Invoice generated on checkout

**Given** the payment modal is open with treatments and a payment method  
**When** the dentist confirms  
**Then** an invoice is created with status `draft` → `sent` (or `paid` if payment captured immediately)  
**And** the visit status advances to `completed`  
**And** the workspace becomes read-only  

### AC-INV-04: View invoice from completed visit

**Given** a visit with status `completed` and an associated invoice  
**When** a staff member opens the workspace  
**Then** the footer button reads "View Invoice" and opens the invoice detail  

---

## 11. Payment (AC-PAY)

### AC-PAY-01: Record payment against invoice

**Given** an invoice with status `draft` or `sent`  
**When** a staff member records a full payment (cash, card, or transfer)  
**Then** the invoice status changes to `paid`  
**And** the payment appears in the invoice line items  

### AC-PAY-02: Partial payment creates payment plan

**Given** an invoice with a balance > 0  
**When** a staff member records a payment less than the invoice total  
**Then** the invoice status changes to `partial`  
**And** a payment plan record is created tracking the remaining balance  

### AC-PAY-03: Payment plan blocks invoice void

**Given** an invoice with an active payment plan  
**When** a staff member attempts to void the invoice  
**Then** the action is blocked with an error: "Invoice has an active payment plan"  

### AC-PAY-04: Payment plan with installments persists all records

**Given** an issued invoice  
**When** a payment plan is created with `numberOfInstallments: 3`  
**Then** the response includes an `installments` array of length 3  
**And** all 3 installment records are persisted in the database

### AC-PAY-05: Active payment plan blocks invoice void

**Given** an invoice with an active payment plan  
**When** a void request is submitted for that invoice  
**Then** the request is rejected with a 400 error code `ACTIVE_PAYMENT_PLAN`

---

## 12. PMD — Portable Medical Document (AC-PMD)

### AC-PMD-01: Generate PMD for completed visit

**Given** a visit with status `completed`  
**When** a dentist requests PMD generation  
**Then** a PMD record is created with a checksum and linked to the visit  
**And** the PMD is immutable — future chart edits do not alter it  

### AC-PMD-02: Share PMD

**Given** a completed visit with an associated PMD  
**When** a dentist clicks "Share PMD" in the workspace  
**Then** the native share sheet opens with the PMD document  
**And** the PMD includes all visit data: chart entries, treatments, prescriptions, and attachments  

### AC-PMD-03: Import external PMD

**Given** a PMD file from another provider  
**When** a staff member imports it via the PMD Import sheet  
**Then** the imported data is saved and linked to the patient  
**And** the patient profile shows the imported PMD in their history  

---

## 13. Notifications (AC-NOTIF)

### AC-NOTIF-01: Appointment creation triggers notification

**Given** a valid appointment creation request  
**When** the appointment is successfully created  
**Then** `notifs.createNotification` is called with `type: 'booking.created'` and `channel: 'in-app'`  
**And** the `relatedEntityType` is `'appointment'`  
**And** if the notifs service is absent, the appointment is still created without error

### AC-NOTIF-02: Invoice finalization triggers notification

**Given** a draft invoice  
**When** the invoice is successfully finalized  
**Then** `notifs.createNotification` is called with `type: 'billing'`  
**And** if the notifs service is absent, the finalization still succeeds without error

---

## 15. Imaging (AC-IMG)

### AC-IMG-01: Create imaging study and receive upload URL

**Given** an authenticated dentist with branch membership  
**When** they submit a valid imaging study creation request  
**Then** a 201 response is returned with an `uploadUrl` for direct file upload  
**And** the imaging study record is linked to the patient and branch

### AC-IMG-02: List patient images enforces branch membership

**Given** a request to list images for a patient  
**When** the requesting user has no membership in the specified branch  
**Then** the request is rejected with 403  
**And** when the user has membership, a 200 response is returned with branch-filtered results (no cross-branch data)

---

## 16. Patient Profile (AC-PROF)

### AC-PROF-01: View patient profile

**Given** any logged-in user  
**When** they navigate to `/patients/:patientId`  
**Then** the profile page shows demographics, contact info, visit summary, billing summary, and medical alerts  

### AC-PROF-02: Navigate workspace from profile

**Given** a patient with an active visit  
**When** a user clicks the workspace link from the profile  
**Then** they are navigated to `/_workspace/:patientId`  

---

## 17. Reporting (AC-REPORT)

### AC-REPORT-01: View daily report

**Given** a logged-in practice owner or admin  
**When** they navigate to Reports  
**Then** they see daily production totals, appointment count, collections, and pending balances  

---

## 18. Periodontal Charting (AC-PERIO)

> Formalized from `docs/product/modules/dental-perio/MODULE_SPEC.md` §11 (was an
> `AC-P0N` checklist there; renamed to the parseable `AC-PERIO-0N` form). Handler
> coverage: `services/api-ts/src/handlers/dental-perio/dental-perio-coverage.test.ts`.

### AC-PERIO-01: Create perio chart

**Given** an authenticated clinician (dentist/hygienist) with branch membership  
**When** they POST `/dental/perio-charts` for a visit  
**Then** a 201 is returned with the chart in `draft` status linked to the visit

### AC-PERIO-02: Duplicate chart rejected

**Given** a visit that already has a perio chart  
**When** a second chart is created for the same visit  
**Then** the request is rejected with 409 `CHART_EXISTS`

### AC-PERIO-03: Upsert tooth readings

**Given** an existing draft perio chart  
**When** a clinician PUTs readings for a tooth  
**Then** a 200 is returned and the per-tooth data is upserted (single-site patches preserve other sites)

### AC-PERIO-04: Probing depth range enforced

**Given** a reading write  
**When** a probing depth is outside [0, 20] mm  
**Then** the request is rejected with 422

### AC-PERIO-05: Valid FDI tooth number enforced

**Given** a reading write  
**When** the tooth number is not a valid FDI number  
**Then** the request is rejected with 422

### AC-PERIO-06: Completion requires minimum readings

**Given** a draft chart with fewer than 16 teeth recorded  
**When** completion is requested  
**Then** the request is rejected with 422 `INSUFFICIENT_READINGS`

### AC-PERIO-07: Completion succeeds with sufficient readings

**Given** a draft chart with ≥ 16 teeth recorded  
**When** completion is requested  
**Then** a 200 is returned and the chart status becomes `completed`

### AC-PERIO-08: Locked visit blocks writes

**Given** a chart whose parent visit is locked/completed  
**When** any write to the chart is attempted  
**Then** the request is rejected with 422

### AC-PERIO-09: Role gate on creation

**Given** a `staff_scheduling` member  
**When** they attempt to create or write a perio chart  
**Then** the request is rejected with 403

### AC-PERIO-10: Read chart returns readings

**Given** a perio chart with persisted readings  
**When** the chart is fetched  
**Then** a 200 is returned with the readings (per-tooth)

---

## Changelog

| Date | Version | Change |
|------|---------|--------|
| 2026-05-09 | 1.0 | Initial acceptance criteria — Plan B Phase 4 |
| 2026-05-21 | 1.1 | G2.5-S2: promoted 15 orphan/unenumerated ACs (AC-SCHED-05, AC-SETTINGS-01, AC-MED-04, AC-MED-05, AC-PRES-01–05, AC-PAY-04–05, AC-NOTIF-01–02, AC-IMG-01–02); tagged AC-PMD-01/02 in test file |
