# NCPDP SCRIPT ePrescribing Guide

**Standard:** NCPDP SCRIPT Standard v2023011
**Purpose:** Electronic prescribing (eRx) workflow mapping to our MedicationRequest model
**Governing Body:** National Council for Prescription Drug Programs (NCPDP)
**Last Updated:** 2026-04-14

---

## Table of Contents

1. [Overview](#overview)
2. [MedicationRequest → NewRx Mapping](#medicationrequest--newrx)
3. [Workflow Messages](#workflow-messages)
4. [RxRenewal Workflow](#rxrenewal-workflow)
5. [RxChange Workflow](#rxchange-workflow)
6. [CancelRx Workflow](#cancelrx-workflow)
7. [RxFill Workflow](#rxfill-workflow)
8. [EPCS Requirements](#epcs-requirements)
9. [RTPB Integration](#rtpb-integration)
10. [Surescripts Integration Notes](#surescripts-integration-notes)

---

## Overview

### Supported NCPDP SCRIPT Message Types

| Message Type | Direction | FHIR Resource | Description |
|-------------|-----------|---------------|-------------|
| NewRx | Outbound | MedicationRequest (new) | Send new prescription to pharmacy |
| RxRenewalRequest | Inbound | Task (renewal request) | Pharmacy requests renewal |
| RxRenewalResponse | Outbound | MedicationRequest (refill) | Prescriber responds to renewal request |
| RxChange | Inbound | Task (change request) | Pharmacy requests change (therapeutic substitution, etc.) |
| RxChangeResponse | Outbound | MedicationRequest (modified) | Prescriber responds to change request |
| CancelRx | Outbound | MedicationRequest (cancelled) | Prescriber cancels a prescription |
| CancelRxResponse | Inbound | Task (cancel response) | Pharmacy confirms or denies cancellation |
| RxFill | Inbound | MedicationDispense | Pharmacy reports dispensing |
| RxHistoryRequest | Outbound | Parameters (query) | Request patient medication history |
| RxHistoryResponse | Inbound | Bundle<MedicationDispense> | Medication history from pharmacy |
| GetMessage | Outbound | N/A | Poll Surescripts mailbox |
| Status | Inbound | N/A | Acknowledgment |
| Error | Inbound | OperationOutcome | Error response |
| Verify | Bidirectional | N/A | Message verification |
| RTPB Request | Outbound | Parameters | Real-time pharmacy benefit query |
| RTPB Response | Inbound | CoverageEligibilityResponse | Pharmacy benefit alternatives |

### Transport

| Method | Description |
|--------|-------------|
| REST (Surescripts Hub) | Primary transport via Surescripts routing infrastructure |
| SOAP/XML | Legacy; maintained for backward compatibility |
| JSON | NCPDP SCRIPT JSON syntax (v10.11+) |
| Direct (TLS) | Point-to-point to pharmacy chains (large chains only) |

---

## MedicationRequest → NewRx

### NewRx Message Structure

```xml
<Message>
  <Header>
    <To>Pharmacy_NCPDPID</To>
    <From>Prescriber_NPI</From>
    <MessageID>UUID</MessageID>
    <SentTime>2026-04-14T12:00:00Z</SentTime>
    <Security>
      <!-- EPCS credentials if controlled substance -->
    </Security>
    <SenderSoftware>
      <SenderSoftwareDeveloper>Monobase</SenderSoftwareDeveloper>
      <SenderSoftwareProduct>MonoRx</SenderSoftwareProduct>
      <SenderSoftwareVersionRelease>1.0</SenderSoftwareVersionRelease>
    </SenderSoftware>
  </Header>
  <Body>
    <NewRx>
      <Patient>...</Patient>
      <Pharmacy>...</Pharmacy>
      <Prescriber>...</Prescriber>
      <MedicationPrescribed>...</MedicationPrescribed>
    </NewRx>
  </Body>
</Message>
```

### Patient Element Mapping

| FHIR Field | NCPDP Element | Notes |
|------------|---------------|-------|
| `Patient.identifier[MRN]` | `Patient.Identification.MedicalRecordIdentificationNumberEHR` | |
| `Patient.name.family` | `Patient.Name.LastName` | |
| `Patient.name.given[0]` | `Patient.Name.FirstName` | |
| `Patient.name.given[1]` | `Patient.Name.MiddleName` | |
| `Patient.birthDate` | `Patient.DateOfBirth.Date` | CCYY-MM-DD |
| `Patient.gender` | `Patient.Gender` | M/F/U |
| `Patient.address[0].line[0]` | `Patient.Address.AddressLine1` | |
| `Patient.address[0].city` | `Patient.Address.City` | |
| `Patient.address[0].state` | `Patient.Address.StateProvince` | 2-letter |
| `Patient.address[0].postalCode` | `Patient.Address.PostalCode` | |
| `Patient.telecom[phone]` | `Patient.CommunicationNumbers.PrimaryTelephone.Number` | |
| `Coverage.subscriberId` | `Patient.Identification.HealthPlanID` | |
| `Coverage.payor.display` | `Patient.Identification.HealthPlanName` | |

### Prescriber Element Mapping

| FHIR Field | NCPDP Element | Notes |
|------------|---------------|-------|
| `Practitioner.identifier[NPI]` | `Prescriber.Identification.NPI` | Required |
| `Practitioner.identifier[DEA]` | `Prescriber.Identification.DEANumber` | Required for controlled substances |
| `Practitioner.identifier[StateLicense]` | `Prescriber.Identification.StateLicenseNumber` | |
| `Practitioner.name.family` | `Prescriber.Name.LastName` | |
| `Practitioner.name.given[0]` | `Prescriber.Name.FirstName` | |
| `PractitionerRole.specialty[0]` | `Prescriber.Specialty` | NCPDP specialty code |
| `Organization.name` | `Prescriber.Clinic.ClinicName` | Practice name |
| `Organization.identifier[NPI]` | `Prescriber.Clinic.Identification.NPI` | Practice NPI |
| `Location.address.line[0]` | `Prescriber.Address.AddressLine1` | |
| `Location.telecom[phone]` | `Prescriber.CommunicationNumbers.PrimaryTelephone.Number` | |
| `Location.telecom[fax]` | `Prescriber.CommunicationNumbers.Fax.Number` | |

### Pharmacy Element Mapping

| FHIR Field | NCPDP Element | Notes |
|------------|---------------|-------|
| `MedicationRequest.extension.pharmacyNpi` | `Pharmacy.Identification.NPI` | Target pharmacy NPI |
| `MedicationRequest.extension.pharmacyNcpdpId` | `Pharmacy.Identification.NCPDPID` | 7-digit NCPDP ID |
| Pharmacy Organization.name | `Pharmacy.BusinessName` | From directory lookup |
| Pharmacy Location.address | `Pharmacy.Address` | From directory lookup |

### MedicationPrescribed Element Mapping

| FHIR Field | NCPDP Element | Notes |
|------------|---------------|-------|
| `MedicationRequest.medication[x]` (RxNorm) | `MedicationPrescribed.DrugDescription` | Text description |
| `MedicationRequest.medication[x]` (RxNorm code) | `MedicationPrescribed.DrugCoded.ProductCode.Code` | RxNorm CUI |
| `MedicationRequest.medication[x]` (NDC) | `MedicationPrescribed.DrugCoded.ProductCode.Code` | NDC 11-digit |
| `MedicationRequest.dispenseRequest.quantity` | `MedicationPrescribed.Quantity.Value` | Quantity to dispense |
| `MedicationRequest.dispenseRequest.quantity.unit` | `MedicationPrescribed.Quantity.CodeListQualifier` + `QuantityUnitOfMeasure` | NCPDP unit code |
| `MedicationRequest.dosageInstruction[0].text` | `MedicationPrescribed.Sig.SigText` | Patient sig instructions |
| `MedicationRequest.dosageInstruction[0].doseQuantity` | `MedicationPrescribed.Sig.SigSegment.DoseDelivered.Value` | Structured sig |
| `MedicationRequest.dosageInstruction[0].route` | `MedicationPrescribed.Sig.SigSegment.RouteOfAdministration.Route` | NCPDP route code |
| `MedicationRequest.dosageInstruction[0].timing` | `MedicationPrescribed.Sig.SigSegment.TimingNumeric` | Structured timing |
| `MedicationRequest.dispenseRequest.numberOfRepeatsAllowed` | `MedicationPrescribed.NumberOfRefills` | 0 = no refills |
| `MedicationRequest.extension.deaSchedule` | `MedicationPrescribed.DEASchedule` | II/IIN/III/IIIN/IV/V |
| `MedicationRequest.substitution.allowedBoolean` | `MedicationPrescribed.Substitutions` | 0=substitution not allowed, 1=allowed |
| `MedicationRequest.note[0].text` | `MedicationPrescribed.Note` | Pharmacy notes |
| `MedicationRequest.reasonCode` | `MedicationPrescribed.Diagnosis` | Diagnosis (optional) |
| `MedicationRequest.dispenseRequest.expectedSupplyDuration` | `MedicationPrescribed.DaysSupply` | Days supply |

---

## Workflow Messages

### NewRx Flow

```
Prescriber (EHR)          Surescripts           Pharmacy System
      |                       |                       |
      |-- NewRx ------------->|                       |
      |                       |-- NewRx ------------->|
      |                       |<-- Status (010) ------|  Received
      |<-- Status (010) ------|                       |
      |                       |<-- Verify ------------|  (optional)
      |<-- Verify ------------|                       |
```

### Status Codes

| Code | Description | Action |
|------|-------------|--------|
| 000 | Successfully processed | No action required |
| 010 | Successful | Verify message accepted |
| 900 | No transactions found | Retry or investigate |
| A00 | Error in request | Fix and resend |
| B00 | System unavailable | Retry with backoff |
| P00 | Pending | Poll for response |

---

## RxRenewal Workflow

### Trigger

Pharmacy initiates when patient requests a refill but no refills remain on the original prescription.

### Flow

```
Pharmacy → RxRenewalRequest → Prescriber (EHR)
Prescriber → RxRenewalResponse → Pharmacy
   (Approved / Denied / ApprovedWithChanges / Replaced)
```

### RxRenewalRequest → Task (FHIR)

| NCPDP Element | FHIR Task Field | Notes |
|--------------|----------------|-------|
| `MessageID` | `Task.identifier[messageId]` | |
| `OriginalPrescription.PrescriptionNumber` | `Task.focus` → MedicationRequest reference | Original Rx |
| `RequestedDaysSupply` | `Task.input[requestedDaysSupply]` | |
| `RequestedQuantity` | `Task.input[requestedQuantity]` | |
| Pharmacy sender | `Task.requester` → Organization | |
| `Note` | `Task.note[]` | |

### RxRenewalResponse Options

| Response Type | NCPDP Code | FHIR Action |
|--------------|-----------|------------|
| Approved | A | New MedicationRequest (status: active) |
| Approved with Changes | C | New MedicationRequest (modified) |
| Denied | D | Task (status: rejected) + reason |
| Denied — New Prescription Sent | K | New MedicationRequest + Task (rejected) |

---

## RxChange Workflow

### Trigger

Pharmacy requests a change due to: formulary, therapeutic substitution, drug not available, patient request, or prior authorization requirement.

### Change Types

| NCPDP Code | Change Type | Description |
|-----------|-------------|-------------|
| G | Generic substitution | Prescriber approves brand → generic |
| T | Therapeutic substitution | Different drug same therapeutic class |
| P | Prior authorization | PA required; prescriber initiates PA |
| D | Drug use evaluation | DUR alert resolution |
| OS | Out of stock | Drug unavailable; request alternative |
| U | Script clarification | Prescriber clarification needed |
| NS | No substitution | Prescriber insists on brand |

### RxChange → Task (FHIR)

| NCPDP Element | FHIR Field |
|--------------|-----------|
| Change type code | `Task.code` |
| Proposed drug | `Task.input[proposedMedication]` → MedicationKnowledge |
| Original prescription | `Task.focus` → MedicationRequest |
| Reason | `Task.statusReason` |

---

## CancelRx Workflow

### Trigger

Prescriber cancels a previously transmitted prescription (before or after dispensing).

### Flow

```
Prescriber → CancelRx → Pharmacy
Pharmacy → CancelRxResponse → Prescriber
   (Accepted / Denied — Already Dispensed / Denied — Not Found)
```

### CancelRx Generation

Triggered when: `MedicationRequest.status` → `cancelled` and the prescription was transmitted to a pharmacy.

| FHIR Field | NCPDP Element |
|------------|--------------|
| `MedicationRequest.id` | `CancelRx.CancelRequestedPrescriptions[].ItemNumber` |
| Prescriber | `CancelRx.Prescriber` |
| Patient | `CancelRx.Patient` |
| Original pharmacy | `CancelRx.Pharmacy.Identification.NCPDPID` |

### CancelRxResponse Outcomes

| Response | NCPDP Code | FHIR Update |
|---------|-----------|------------|
| Cancel Accepted | A | `MedicationRequest.status = cancelled` confirmed |
| Cancel Denied — Already Dispensed | D | `MedicationRequest.status` reverted; note added |
| Cancel Denied — Not Found | U | Error logged; `Task` status = rejected |

---

## RxFill Workflow

### Trigger

Pharmacy reports dispensing event (fill notification). Not all pharmacies send fill notifications; Surescripts Fill Network is required.

### RxFill → MedicationDispense (FHIR)

| NCPDP Element | FHIR Field | Notes |
|--------------|-----------|-------|
| `FillIndicator` | `MedicationDispense.extension.fillIndicator` | Complete/Partial/NotDispensed |
| `DispensedDrug.ProductCode.Code` | `MedicationDispense.medication[x]` | NDC dispensed |
| `DispensedDrug.Quantity.Value` | `MedicationDispense.quantity.value` | Actual quantity dispensed |
| `DaysSupply` | `MedicationDispense.daysSupply` | |
| `DispensedDate` | `MedicationDispense.whenHandedOver` | |
| `PharmacyRequestedRefills` | `MedicationDispense.authorizingPrescription` → MedicationRequest | |
| `PrescriptionNumber` | `MedicationDispense.identifier[]` | Pharmacy Rx number |

---

## EPCS Requirements

**EPCS:** Electronic Prescribing for Controlled Substances
**Regulatory Basis:** DEA 21 CFR Part 1300, 1304, 1306, 1311

### Requirements for EPCS

| Requirement | Description | Our Implementation |
|-------------|-------------|-------------------|
| Identity proofing | Prescriber must complete identity proofing to ILA (In-Person) or Remote | `Practitioner.extension.epcsIdentityVerified` flag |
| Two-factor authentication | Must use two-factor auth at time of signing each controlled substance Rx | TOTP or hardware token + password |
| Logical access control | EHR must control who can prescribe controlled substances | `PractitionerRole.extension.deaAuthorized` |
| DEA number | Valid DEA registration required | `Practitioner.identifier[DEA]` |
| State license | Valid state license for prescribing state | `Practitioner.identifier[StateLicense]` |
| Audit log | All EPCS transactions must be logged | `AuditEvent` with EPCS sub-type |
| Archive | Retain EPCS records per DEA requirements | Minimum 2 years retention |
| Intermediary certification | If using Surescripts or other intermediary, they must be DEA-approved | Surescripts is DEA-approved EPCS intermediary |
| Digital signature | Each controlled substance Rx must be digitally signed | X.509 certificate signing at message generation |

### DEA Schedule Enforcement

| DEA Schedule | Drug Examples | Refill Limit |
|-------------|--------------|--------------|
| Schedule II | Opioids (oxycodone), stimulants (amphetamine) | No refills; new Rx required |
| Schedule III | Testosterone, ketamine (low dose) | 5 refills in 6 months |
| Schedule IV | Benzodiazepines, tramadol | 5 refills in 6 months |
| Schedule V | Low-dose codeine cough syrups | 5 refills in 6 months (some OTC) |

### Our EPCS Workflow

```
1. Prescriber signs in (password + TOTP/hardware token)
2. EHR verifies EPCS credentials
3. MedicationRequest created with DEA schedule extension
4. Two-factor prompt at time of signing (per DEA requirement)
5. Digital signature applied to NewRx message
6. AuditEvent created (actor, time, DEA#, 2FA method, patient, drug)
7. NewRx transmitted via EPCS-certified channel
```

---

## RTPB Integration

**RTPB:** Real-Time Pharmacy Benefit — shows prescriber the patient's actual cost and formulary status before sending the Rx.

### RTPB Request → FHIR Parameters

```json
{
  "resourceType": "Parameters",
  "parameter": [
    { "name": "patient", "valueReference": { "reference": "Patient/123" } },
    { "name": "medication", "valueCodeableConcept": { "coding": [{ "system": "http://www.nlm.nih.gov/research/umls/rxnorm", "code": "1049502" }] } },
    { "name": "quantity", "valueQuantity": { "value": 30, "unit": "TAB" } },
    { "name": "daysSupply", "valueInteger": 30 },
    { "name": "coverage", "valueReference": { "reference": "Coverage/456" } }
  ]
}
```

```http
POST /fhir/$rtpb
```

### RTPB Response Elements

| NCPDP RTPB Element | FHIR Field | Description |
|-------------------|-----------|-------------|
| Patient Cost | `CoverageEligibilityResponse.insurance[].item[].benefit[copay].value` | Patient out-of-pocket cost |
| Formulary Status | `CoverageEligibilityResponse.insurance[].item[].network` | Preferred/Non-preferred/Not Covered |
| Tier | `CoverageEligibilityResponse.insurance[].item[].description` | Formulary tier |
| Alternative Medications | `CoverageEligibilityResponse.insurance[].item[]` (additional) | Lower-cost alternatives |
| PA Required | `CoverageEligibilityResponse.insurance[].item[].authorizationRequired` | Prior auth needed flag |
| Step Therapy | `CoverageEligibilityResponse.insurance[].item[].authorizationSupporting` | Step therapy requirements |
| Pharmacy Options | `CoverageEligibilityResponse.insurance[].item[].network` | Mail order vs retail cost difference |

---

## Surescripts Integration Notes

### Surescripts Network Requirements

| Requirement | Description |
|-------------|-------------|
| Certification | Complete Surescripts certification testing for all message types before production |
| Connectivity | TLS 1.2+ to Surescripts Hub; dedicated certificates |
| Sender ID | Surescripts-assigned SenderID (typically NPI or system ID) |
| Mailbox | Poll-based delivery via GetMessage; webhook delivery available |
| Rate limits | Message throttling per sender ID |
| Routing | Surescripts routes to pharmacy based on NCPDPID or NPI |
| Directory | Use Surescripts Provider and Pharmacy directories |

### Surescripts Provider Directory

Before sending eRx, verify prescriber eligibility via Surescripts Directory:
- Prescriber must be registered with Surescripts
- Prescriber's practice location must be active
- Pharmacy must be registered and active

```http
GET /surescripts/directory/prescriber?npi=1234567890
GET /surescripts/directory/pharmacy?ncpdpid=1234567
```

### Error Handling

| Surescripts Error | FHIR Handling |
|------------------|--------------|
| Message routing failure | `Task.status = failed`; retry queue |
| Prescriber not found | `OperationOutcome` 409; prompt to verify prescriber registration |
| Pharmacy not found | `OperationOutcome` 404; prompt prescriber to select different pharmacy |
| EPCS signature invalid | `OperationOutcome` 422; re-prompt for two-factor auth |
| Duplicate message | Check `MessageID`; deduplicate |
