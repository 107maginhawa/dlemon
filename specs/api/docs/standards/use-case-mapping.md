# Use Case Mapping

API operation sequences for standard healthcare workflows. Each use case maps clinical or administrative processes to Monobase Healthcare API operations in execution order. This document is intended for integration developers, AI agents building workflows, and QA engineers validating end-to-end flows.

---

## Notation

Each use case follows this structure:

```
### UC-<DOMAIN>-<NNN>: <Name>
**Operations:**
1. `operationId` — purpose

**Actors:** Who initiates and participates
**Preconditions:** What must be true before this use case can start
**Dependencies:** reads / writes / triggers
**Expected Outcome:** What the system state looks like after successful completion
```

---

## Encounter Use Cases

### UC-ENC-001: Patient Check-In (Outpatient)

**Operations:**
1. `searchPatient` — locate patient record by MRN or name/DOB
2. `getAppointment` — verify the scheduled appointment exists and is in `booked` status
3. `getCoverageEligibility` — verify insurance eligibility for today's visit
4. `transitionAppointmentStatus` → `arrived` — mark patient as arrived for the appointment
5. `createEncounter` — create Encounter with `class=AMB`, `status=arrived`, linked to Appointment and Patient
6. `createOrUpdateDemographics` (optional) — update patient address, insurance, emergency contact if changed since last visit
7. `transitionEncounterStatus` → `triaged` (if clinical triage is the next step)

**Actors:** Receptionist (primary), Patient
**Preconditions:**
- Active Patient record exists
- Appointment exists with status=booked
- Active Coverage record exists for the patient

**Dependencies:**
- Reads: `Patient`, `Appointment`, `Coverage`
- Writes: `Encounter`, updates `Appointment.status`
- Triggers: AuditEvent (creation), notification to care team (encounter.created event)

**Expected Outcome:**
- Appointment status = arrived
- Encounter status = arrived (or triaged if triage performed)
- Encounter is linked to the Appointment via `Encounter.appointment`
- Patient appears in the clinical queue for the visit

---

### UC-ENC-002: Inpatient Admission

**Operations:**
1. `searchPatient` — locate or create Patient record
2. `getCoverageEligibility` — verify inpatient coverage
3. `getPriorAuthorizationStatus` (if required by insurer) — confirm PA exists for admission
4. `createEncounter` — with `class=IMP`, `status=arrived`, `hospitalization.admitSource` set
5. `transitionEncounterStatus` → `inProgress` — clinician assigned and care begins
6. `createCondition` — record admitting diagnosis linked to Encounter
7. `createServiceRequest` (multiple) — initial orders: labs, imaging, medications
8. `createMedicationRequest` (multiple) — admission medication orders
9. `assignLocation` — assign patient to specific bed via `Encounter.location`

**Actors:** Admissions Clerk (registration), Admitting Physician, Nurse
**Preconditions:**
- Patient identity verified
- Insurance coverage verified or financial responsibility acknowledged
- Admitting physician order exists (written or verbal with countersign)
- Bed available in target unit

**Dependencies:**
- Reads: `Patient`, `Coverage`, `Location` (bed availability), `PriorAuthorization`
- Writes: `Encounter`, `Condition`, `ServiceRequest` (multiple), `MedicationRequest` (multiple)
- Triggers: AuditEvent, bed assignment, clinical decision support alerts (allergy/drug checks), lab and pharmacy order events

**Expected Outcome:**
- Encounter status = inProgress with class=IMP
- Admitting diagnosis attached to Encounter
- Patient assigned to a bed (Location entry active)
- Initial orders active and routed to pharmacy/lab/radiology

---

### UC-ENC-003: Patient Discharge (Inpatient)

**Operations:**
1. `getEncounter` — retrieve current inpatient Encounter
2. `searchMedicationRequest` — retrieve all active MedicationRequests for reconciliation
3. `createMedicationStatement` (multiple) — record discharge medication list (reconciled)
4. `createComposition` — create discharge summary document (type=18842-5 Discharge Summary)
5. `attestComposition` — attending physician attests/signs the discharge summary
6. `createCarePlan` — create follow-up care plan with goals and activities
7. `createServiceRequest` — create referral or follow-up appointment order if needed
8. `updateEncounter` — set `hospitalization.dischargeDisposition`
9. `transitionEncounterStatus` → `finished` — finalize the Encounter

**Actors:** Attending Physician, Nurse Case Manager, Discharge Coordinator, Patient
**Preconditions:**
- Encounter is in inProgress status
- Admitting diagnosis documented
- At least one Condition linked to Encounter

**Dependencies:**
- Reads: `Encounter`, `MedicationRequest` (all active), `Condition`, `AllergyIntolerance`, `Observation` (labs, vitals)
- Writes: `Composition` (discharge summary), `MedicationStatement`, `CarePlan`, `ServiceRequest` (follow-up)
- Updates: `Encounter.status` → finished, `Encounter.hospitalization.dischargeDisposition`
- Triggers: AuditEvent, billing workflow (ChargeItem creation), bed release, encounter.completed event, DocumentReference creation for discharge summary

**Expected Outcome:**
- Encounter status = finished with period.end set
- Signed discharge summary (Composition) available as DocumentReference
- Reconciled medication list recorded as MedicationStatements
- Follow-up CarePlan created
- Billing workflow initiated for all encounter charges

---

### UC-ENC-004: Emergency Visit

**Operations:**
1. `createPatient` (if unknown) OR `searchPatient` — identify or register patient
2. `createEncounter` — with `class=EMER`, `status=arrived` — may be created before full patient ID
3. `transitionEncounterStatus` → `triaged` — triage assessment performed
4. `createObservation` (multiple) — triage vital signs, pain score
5. `createCondition` — chief complaint / presenting problem
6. `transitionEncounterStatus` → `inProgress` — physician evaluation begins
7. `createServiceRequest` (multiple) — diagnostic orders (labs, imaging, ECG)
8. `createMedicationRequest` (multiple) — emergency medications
9. `createProcedure` (if applicable) — procedures performed in ED
10. `updateEncounter` — set `hospitalization.dischargeDisposition` (discharge home, admit, transfer)
11. `transitionEncounterStatus` → `finished` — visit complete

**Actors:** Triage Nurse, Emergency Physician, ED Technician, Registration Clerk (may be concurrent)
**Preconditions:**
- None required at initiation (emergency care must be provided regardless of identity or coverage)

**Dependencies:**
- Reads: `Patient` (if found), `AllergyIntolerance` (if available), `MedicationRequest` (prior medications if available)
- Writes: `Encounter`, `Patient` (if new), `Observation`, `Condition`, `ServiceRequest`, `MedicationRequest`, `Procedure`
- Triggers: AuditEvent, STAT order events, critical lab notifications, triage queue updates, billing initiation on finish

**Expected Outcome:**
- Emergency Encounter documented end-to-end
- All clinical events (vitals, orders, procedures, medications) linked to the Encounter
- Disposition documented (admit/discharge/transfer)
- Encounter finished with all diagnoses recorded

---

## Appointment Use Cases

### UC-APPT-001: Book Appointment

**Operations:**
1. `searchPatient` — locate patient record
2. `searchPractitionerRole` — find available practitioners by specialty and location
3. `searchSlot` — find available time slots for the selected PractitionerRole
4. `createAppointment` — book the appointment with all participants and slot reference
5. `transitionAppointmentStatus` → `booked` — all participants accept

**Actors:** Scheduler, Patient (self-scheduling portal), Referring Provider
**Preconditions:**
- Patient record exists
- At least one Slot is available (status=free) for the desired time
- If referral-based, a ServiceRequest with intent=referral exists

**Dependencies:**
- Reads: `Patient`, `PractitionerRole`, `Slot`, `ServiceRequest` (if referral-driven)
- Writes: `Appointment`
- Updates: `Slot.status` → busy
- Triggers: AuditEvent, booking confirmation notifications to patient and practitioner

**Expected Outcome:**
- Appointment status = booked
- Slot status = busy
- Confirmation notifications sent
- Appointment linked to referral ServiceRequest if applicable

---

### UC-APPT-002: Cancel Appointment

**Operations:**
1. `getAppointment` — retrieve the appointment to be cancelled
2. `transitionAppointmentStatus` → `cancelled` — with cancellationReason provided
3. `updateSlot` — set Slot.status back to free (or trigger via automated side effect)

**Actors:** Patient (self-service), Scheduler, Provider
**Preconditions:**
- Appointment exists with status=booked or pending
- Cancellation is within the allowed cancellation window (configurable per tenant)

**Dependencies:**
- Reads: `Appointment`, `Slot`
- Updates: `Appointment.status` → cancelled, `Slot.status` → free
- Triggers: AuditEvent, cancellation notifications to all participants, no-show risk counter update if same-day

**Expected Outcome:**
- Appointment status = cancelled with cancellation reason recorded
- Slot freed for rebooking
- All participants notified of cancellation

---

### UC-APPT-003: Reschedule Appointment

**Operations:**
1. `getAppointment` — retrieve the current appointment
2. `searchSlot` — find alternative available slots
3. `transitionAppointmentStatus` → `cancelled` — cancel the original with reason=reschedule
4. `createAppointment` — create new appointment in the desired slot
5. `transitionAppointmentStatus` → `booked` — confirm new booking

**Actors:** Patient, Scheduler
**Preconditions:**
- Original appointment exists and is cancellable
- At least one alternative Slot is available

**Dependencies:**
- Reads: `Appointment` (original), `Slot`
- Writes: `Appointment` (new)
- Updates: original `Appointment.status` → cancelled, original `Slot.status` → free, new `Slot.status` → busy
- Triggers: AuditEvent, cancellation notification for old, confirmation notification for new

**Expected Outcome:**
- Original appointment cancelled with reason=reschedule
- New appointment booked in alternative slot
- Patient notified of new appointment details
- Original slot available for other patients

---

## Medication Use Cases

### UC-MED-001: Prescribe Medication

**Operations:**
1. `getPatient` — confirm patient identity and retrieve active AllergyIntolerance list
2. `searchMedicationRequest` — review existing active medications to check for interactions
3. `searchAllergyIntolerance` — explicit allergy/intolerance check for the intended medication
4. `createMedicationRequest` — create MedicationRequest with status=draft, intent=order
5. `transitionMedicationRequestStatus` → `active` — prescriber signs the order
6. `createTask` (automated) — pharmacy dispensing Task created as side effect

**Actors:** Prescribing Physician, Nurse Practitioner, Physician Assistant
**Preconditions:**
- Patient record exists and is active
- Prescriber has active PractitionerRole with prescribing authority
- Medication is on formulary (if formulary enforcement is enabled)

**Dependencies:**
- Reads: `Patient`, `AllergyIntolerance`, `MedicationRequest` (existing active), `MedicationKnowledge` (formulary)
- Writes: `MedicationRequest`, `DetectedIssue` (if drug allergy/interaction found)
- Triggers: AuditEvent, pharmacy notification, drug-allergy and drug-drug interaction checks

**Expected Outcome:**
- MedicationRequest status = active
- Pharmacy notified of new prescription
- Drug safety checks performed and results recorded as DetectedIssues (if any)
- Patient's active medication list updated

---

### UC-MED-002: Dispense Medication

**Operations:**
1. `getMedicationRequest` — retrieve and validate the prescription/order
2. `searchAllergyIntolerance` — pharmacist allergy verification (second safety check)
3. `searchMedicationRequest` — check for duplicate therapy
4. `createMedicationDispense` — record dispense with quantity, lot number, expiry
5. `updateMedicationDispense` — status=completed once medication handed to patient or delivered

**Actors:** Pharmacist, Pharmacy Technician
**Preconditions:**
- Active MedicationRequest exists (status=active)
- Remaining refills available (numberOfRepeatsAllowed not exhausted)
- Medication is in inventory

**Dependencies:**
- Reads: `MedicationRequest`, `AllergyIntolerance`, `Patient`, `Coverage` (for copay)
- Writes: `MedicationDispense`
- Triggers: AuditEvent, inventory deduction, refill count update on MedicationRequest, patient notification

**Expected Outcome:**
- MedicationDispense status = completed
- Inventory decremented by dispensed quantity
- Refill counter incremented on MedicationRequest
- Patient receives medication and dispensing record

---

### UC-MED-003: Medication Reconciliation at Discharge

**Operations:**
1. `searchMedicationRequest` — retrieve all active inpatient MedicationRequests
2. `searchMedicationStatement` — retrieve pre-admission medications (if recorded)
3. `searchMedicationAdministration` — review what was actually given during admission
4. `createMedicationRequest` (multiple) — create discharge prescription orders for continued medications
5. `transitionMedicationRequestStatus` (multiple) — stop/cancel inpatient orders that are not continued
6. `createMedicationStatement` (multiple) — record the reconciled discharge medication list
7. `createList` — create a formal reconciled medication list resource linking all MedicationStatements

**Actors:** Attending Physician, Clinical Pharmacist, Discharge Nurse
**Preconditions:**
- Inpatient Encounter is in progress and discharge is being planned
- All inpatient medication records are current and complete

**Dependencies:**
- Reads: `MedicationRequest`, `MedicationStatement`, `MedicationAdministration`, `AllergyIntolerance`
- Writes: `MedicationStatement` (multiple), `MedicationRequest` (discharge scripts), `List` (reconciled list)
- Updates: `MedicationRequest.status` → stopped (for inpatient-only medications)
- Triggers: AuditEvent, pharmacy notification for new discharge prescriptions

**Expected Outcome:**
- Complete discharge medication list documented as MedicationStatements
- Discharge prescriptions created for all continued medications
- Inpatient-only medications stopped
- Reconciled List resource created as a summary artifact
- Reconciliation included in discharge summary Composition

---

## Lab Use Cases

### UC-LAB-001: Order Lab Test

**Operations:**
1. `getPatient` — confirm patient identity
2. `getEncounter` — link order to current encounter context
3. `createServiceRequest` — create lab order with LOINC code, priority, specimen requirements
4. `createSpecimen` (optional, if pre-collection) — pre-register specimen collection details
5. `createTask` — phlebotomy/collection task assigned to lab or nursing (may be created as side effect)

**Actors:** Ordering Physician, Nurse Practitioner
**Preconditions:**
- Patient has an active Encounter
- Ordering provider has active PractitionerRole

**Dependencies:**
- Reads: `Patient`, `Encounter`, `PractitionerRole`
- Writes: `ServiceRequest`, `Specimen` (optional), `Task`
- Triggers: AuditEvent, lab order event to LIS, accession number assignment, STAT notification if priority=stat

**Expected Outcome:**
- ServiceRequest status = active
- Lab order received by LIS and assigned accession number
- Collection Task assigned to appropriate staff
- Result-expected tracking initiated

---

### UC-LAB-002: Record Lab Results

**Operations:**
1. `getServiceRequest` — retrieve the originating order for context
2. `getSpecimen` — confirm specimen received and accepted
3. `createObservation` (multiple) — create individual result Observations (one per test in panel)
4. `createDiagnosticReport` — create DiagnosticReport grouping all Observations, with status=preliminary
5. `updateDiagnosticReport` — status=final when pathologist/lab director verifies results
6. `notifyOrderingProvider` (automated side effect) — critical value notification if applicable

**Actors:** Laboratory Technician, Pathologist (for verification), Laboratory Information System (automated)
**Preconditions:**
- ServiceRequest exists and is active
- Specimen has been received and accepted (Specimen.status=available)

**Dependencies:**
- Reads: `ServiceRequest`, `Specimen`, `Patient`
- Writes: `Observation` (multiple), `DiagnosticReport`
- Triggers: AuditEvent, critical value notifications, result-available notification to ordering provider, updates ServiceRequest status to completed

**Expected Outcome:**
- All result Observations created and linked to DiagnosticReport
- DiagnosticReport status = final
- ServiceRequest status = completed
- Ordering provider notified of result availability
- Critical values flagged and communicated per CLIA requirements

---

## Imaging Use Cases

### UC-IMG-001: Order Imaging Study

**Operations:**
1. `getPatient` — confirm patient identity
2. `getEncounter` — link order to current encounter
3. `createServiceRequest` — create imaging order with LOINC or SNOMED code (e.g., CT Chest with contrast), priority, clinical indication
4. `getPriorAuthorizationStatus` (if required by insurance) — check if PA required for this study
5. `submitPriorAuthorization` (if required) — submit PA request to insurer
6. `createTask` — scheduling task for radiology department (may be created as automated side effect)

**Actors:** Ordering Physician, Radiologist (for protocol), Radiology Scheduler
**Preconditions:**
- Patient has an active Encounter
- Clinical indication (Condition or Condition code) documented
- PA obtained or confirmed not required

**Dependencies:**
- Reads: `Patient`, `Encounter`, `Condition`, `Coverage`, `PriorAuthorization`
- Writes: `ServiceRequest`, `Task`, `Claim` (for PA)
- Triggers: AuditEvent, imaging order event to RIS, STAT notification if urgent

**Expected Outcome:**
- ServiceRequest status = active, routed to RIS
- Scheduling Task created for radiology
- PA obtained and documented (if required)
- Patient contacted for scheduling (if outpatient)

---

## Claims and Billing Use Cases

### UC-CLM-001: Submit Insurance Claim

**Operations:**
1. `getEncounter` — retrieve finished Encounter with all diagnoses
2. `searchChargeItem` — retrieve all ChargeItems linked to the Encounter
3. `searchCoverage` — confirm active insurance coverage for the service period
4. `createClaim` — assemble Claim with patient, insurer, diagnoses, and items from ChargeItems
5. `submitClaim` — transmit Claim to payer via clearinghouse
6. `getClaimResponse` (async) — poll for or receive payer response (ClaimResponse)

**Actors:** Billing Specialist, Billing System (automated)
**Preconditions:**
- Encounter status = finished
- At least one ChargeItem linked to the Encounter
- Active Coverage exists for the patient
- All required ICD-10 and CPT codes present

**Dependencies:**
- Reads: `Encounter`, `ChargeItem`, `Coverage`, `Patient`, `Condition` (for ICD-10 codes), `Procedure` (for CPT codes)
- Writes: `Claim`
- Triggers: AuditEvent, payer transmission, ChargeItem locking, PaymentReconciliation placeholder creation

**Expected Outcome:**
- Claim status = active (submitted to payer)
- ClaimResponse received with adjudication result
- Payment posted or denial recorded
- EOB (ExplanationOfBenefit) available to patient

---

### UC-CLM-002: Verify Insurance Eligibility

**Operations:**
1. `getPatient` — retrieve patient demographics
2. `getCoverage` — retrieve active Coverage record(s) for the patient
3. `createCoverageEligibilityRequest` — submit eligibility request to payer with service date and type
4. `getCoverageEligibilityResponse` — receive payer response with benefit details

**Actors:** Front Desk Staff, Billing Specialist, Automated Scheduling System
**Preconditions:**
- Patient record exists with coverage information
- Service date is known (or checking for today)

**Dependencies:**
- Reads: `Patient`, `Coverage`
- Writes: `CoverageEligibilityRequest`, `CoverageEligibilityResponse`
- Triggers: AuditEvent, payer eligibility query

**Expected Outcome:**
- Eligibility confirmed or denied for the specified service date
- Benefit details documented (deductible remaining, copay, coinsurance)
- Coverage record updated with eligibility verification date
- Staff informed of patient's cost-sharing responsibility

---

## Consent Use Cases

### UC-CON-001: Record Patient Consent

**Operations:**
1. `getPatient` — confirm patient identity
2. `searchConsent` — check for existing Consent records to avoid duplication
3. `createConsent` — record consent with scope, category, patient reference, and provisions
4. `attestConsent` (optional) — witness or staff member attests the consent was obtained
5. `createDocumentReference` — link scanned consent form PDF if physical form was signed

**Actors:** Registration Staff, Clinical Staff, Patient
**Preconditions:**
- Patient record exists
- Patient has decision-making capacity (or legal guardian/surrogate is authorized)

**Dependencies:**
- Reads: `Patient`, `Consent` (existing)
- Writes: `Consent`, `DocumentReference` (if physical form)
- Triggers: AuditEvent, access control refresh (immediate)

**Expected Outcome:**
- Consent status = active
- Provisions recorded (permitted or denied data uses/disclosures)
- Access control policies updated to reflect consent
- Consent document linked if physical form exists

---

## Document Use Cases

### UC-DOC-001: Create Discharge Summary

**Operations:**
1. `getEncounter` — retrieve the finished (or finishing) inpatient Encounter
2. `searchCondition` — gather all diagnoses linked to the Encounter
3. `searchMedicationStatement` — retrieve discharge medication list
4. `searchObservation` — gather relevant labs, vitals, and assessments
5. `searchProcedure` — gather procedures performed during admission
6. `createComposition` — create structured discharge summary with sections: Reason for Admission, History, Physical Exam, Hospital Course, Diagnoses, Medications, Follow-Up, Instructions
7. `attestComposition` — attending physician signs (attester mode=legal)
8. `updateComposition` — status=final after attestation
9. `createDocumentReference` — create pointer to the finalized Composition for document search

**Actors:** Attending Physician, Resident (may author draft), Medical Records
**Preconditions:**
- Encounter is in inProgress or finished status
- Admitting diagnosis documented
- Discharge medication reconciliation complete

**Dependencies:**
- Reads: `Encounter`, `Condition`, `MedicationStatement`, `Observation`, `Procedure`, `AllergyIntolerance`, `CarePlan`
- Writes: `Composition`, `DocumentReference`
- Triggers: AuditEvent, discharge workflow evaluation, DocumentReference creation, encounter.finished side effects

**Expected Outcome:**
- Composition status = final with legal attestation
- DocumentReference created pointing to Composition
- Discharge summary available in patient's medical record
- Summary transmitted to follow-up providers if Direct messaging or CDA exchange is configured

---

## Referral Use Cases

### UC-REF-001: Create Referral

**Operations:**
1. `getPatient` — confirm patient identity
2. `getEncounter` (if within encounter context) — link referral to current visit
3. `searchPractitionerRole` — search for appropriate specialist by specialty and location
4. `searchCoverage` — confirm referral is covered and PA requirements
5. `getPriorAuthorizationStatus` (if required) — check if PA needed for specialist visit
6. `submitPriorAuthorization` (if required) — obtain PA from insurer
7. `createServiceRequest` — create referral with intent=referral, requester=ordering provider, performer=target specialist, reasonCode=clinical indication
8. `createAppointment` (optional) — book specialist appointment directly if scheduling integration available
9. `createCommunication` — notify receiving specialist of referral details

**Actors:** Referring Physician, Referral Coordinator, Specialist Office
**Preconditions:**
- Patient record exists and is active
- Referring provider has active PractitionerRole
- Clinical indication (Condition) documented
- Insurance coverage confirmed (or self-pay acknowledged)

**Dependencies:**
- Reads: `Patient`, `Encounter`, `PractitionerRole`, `Coverage`, `Condition`
- Writes: `ServiceRequest` (intent=referral), `Appointment` (optional), `Communication`, `Claim` (if PA required)
- Triggers: AuditEvent, referral notification to specialist, PA submission if required, patient notification

**Expected Outcome:**
- ServiceRequest (referral) status = active
- Specialist notified of referral with clinical summary
- PA obtained if required
- Patient notified of referral and specialist contact information
- Follow-up appointment booked if direct scheduling is available

---

## Operation-to-Use-Case Cross-Reference

This table maps API operations to the use cases that invoke them, enabling impact analysis when an operation changes.

| Operation | Use Cases |
|---|---|
| `createEncounter` | UC-ENC-001, UC-ENC-002, UC-ENC-004 |
| `transitionEncounterStatus` | UC-ENC-001, UC-ENC-002, UC-ENC-003, UC-ENC-004 |
| `createAppointment` | UC-APPT-001, UC-APPT-003 |
| `transitionAppointmentStatus` | UC-ENC-001, UC-APPT-001, UC-APPT-002, UC-APPT-003 |
| `createMedicationRequest` | UC-ENC-002, UC-ENC-004, UC-MED-001, UC-MED-003 |
| `transitionMedicationRequestStatus` | UC-MED-001, UC-MED-003 |
| `createServiceRequest` | UC-ENC-002, UC-ENC-003, UC-LAB-001, UC-IMG-001, UC-REF-001 |
| `transitionServiceRequestStatus` | UC-LAB-001, UC-LAB-002 |
| `createObservation` | UC-ENC-004, UC-LAB-002 |
| `bulkCreateObservations` | UC-LAB-002 |
| `createDiagnosticReport` | UC-LAB-002 |
| `createCondition` | UC-ENC-002, UC-ENC-004 |
| `createComposition` | UC-ENC-003, UC-DOC-001 |
| `attestComposition` | UC-ENC-003, UC-DOC-001 |
| `createClaim` | UC-CLM-001 |
| `submitClaim` | UC-CLM-001 |
| `createCoverageEligibilityRequest` | UC-CLM-002 |
| `submitPriorAuthorization` | UC-IMG-001, UC-REF-001 |
| `createConsent` | UC-CON-001 |
| `createMedicationDispense` | UC-MED-002 |
| `createMedicationStatement` | UC-MED-003, UC-ENC-003 |
| `createSpecimen` | UC-LAB-001 |
| `createCarePlan` | UC-ENC-003 |
| `searchPatient` | UC-ENC-001, UC-ENC-002, UC-APPT-001, UC-MED-001, UC-CLM-002, UC-CON-001, UC-REF-001 |
| `searchCoverage` | UC-ENC-001, UC-ENC-002, UC-CLM-001, UC-CLM-002, UC-REF-001 |

---

## Use Case Dependency Graph

The following shows which use cases commonly precede or enable others:

```
UC-ENC-001 (Check-In)
    └── requires: UC-APPT-001 (Book Appointment) to have completed

UC-ENC-002 (Inpatient Admission)
    └── may follow: UC-ENC-004 (Emergency Visit) if admitted from ED
    └── requires: UC-CLM-002 (Verify Eligibility) before or concurrent

UC-ENC-003 (Discharge)
    └── requires: UC-MED-003 (Medication Reconciliation) before completion
    └── produces: UC-DOC-001 (Discharge Summary)
    └── may produce: UC-REF-001 (Referral for follow-up)
    └── triggers: UC-CLM-001 (Submit Claim)

UC-LAB-001 (Order Lab)
    └── produces: UC-LAB-002 (Record Lab Results)

UC-MED-001 (Prescribe)
    └── produces: UC-MED-002 (Dispense Medication)

UC-APPT-003 (Reschedule)
    └── requires: UC-APPT-001 (original booking)
    └── internally performs: UC-APPT-002 (Cancel) then UC-APPT-001 (Book)

UC-IMG-001 (Order Imaging)
    └── may require: PA workflow (embedded PriorAuthorization)

UC-REF-001 (Create Referral)
    └── may require: PA workflow
    └── may produce: UC-APPT-001 (Book Appointment at specialist)
```
