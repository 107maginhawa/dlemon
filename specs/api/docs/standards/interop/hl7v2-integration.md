# HL7 v2 Integration Guide

**Standard:** HL7 Version 2.x (v2.5.1, v2.7, v2.8)
**Purpose:** Mapping of HL7 v2 messages to and from our FHIR R4 resources
**Last Updated:** 2026-04-14

---

## Table of Contents

1. [Overview](#overview)
2. [Message Type Mappings](#message-type-mappings)
3. [Segment Mappings](#segment-mappings)
4. [ADT Messages — Patient Administration](#adt-messages)
5. [ORM/OML Messages — Orders](#ormoml-messages)
6. [ORU Messages — Results](#oru-messages)
7. [RGV/RAS Messages — Pharmacy](#rgvras-messages)
8. [DFT Messages — Financial](#dft-messages)
9. [SCH Messages — Scheduling](#sch-messages)
10. [Integration Patterns](#integration-patterns)

---

## Overview

HL7 v2 remains the dominant messaging standard for hospital system integration. Our platform accepts inbound HL7 v2 messages via MLLP (Minimal Lower Layer Protocol) and translates them into FHIR R4 resources. Outbound HL7 v2 messages can be generated from FHIR resources.

### Supported Transport

| Transport | Port | TLS | Usage |
|-----------|------|-----|-------|
| MLLP (TCP) | 2575 | No (internal networks only) | Traditional HIS integration |
| MLLP over TLS | 2576 | Yes | Recommended for all external connections |
| REST API (FHIR) | 443 | Yes | Preferred for new integrations |
| HL7 FHIR Messaging | 443 | Yes | For systems that support it |

### Message Acknowledgment

All messages require ACK (acknowledgment):
- `AA` — Application Accept (message processed successfully)
- `AE` — Application Error (message rejected; see ERR segment for details)
- `AR` — Application Reject (message cannot be processed)

---

## Message Type Mappings

| HL7 v2 Message | Event | Direction | FHIR Operation | Notes |
|---------------|-------|-----------|----------------|-------|
| ADT^A01 | Admit | Inbound | POST /Encounter + update Patient | Creates new Encounter (status: arrived/in-progress) |
| ADT^A02 | Transfer | Inbound | PATCH /Encounter (location change) | Updates Encounter.location |
| ADT^A03 | Discharge | Inbound | PATCH /Encounter (status → finished) | Sets Encounter.period.end; discharge disposition |
| ADT^A04 | Register | Inbound | POST /Patient (if new) + POST /Encounter | Outpatient registration |
| ADT^A05 | Pre-admit | Inbound | POST /Encounter (status: planned) | Planned future admission |
| ADT^A06 | Change outpatient to inpatient | Inbound | POST /Encounter (IMP class) | New inpatient encounter |
| ADT^A07 | Change inpatient to outpatient | Inbound | POST /Encounter (AMB class) | New outpatient encounter |
| ADT^A08 | Update patient info | Inbound | PUT /Patient | Patient demographics update |
| ADT^A11 | Cancel admit | Inbound | PATCH /Encounter (status → cancelled) | |
| ADT^A13 | Cancel discharge | Inbound | PATCH /Encounter (revert to in-progress) | |
| ADT^A28 | Add person | Inbound | POST /Patient | New patient without encounter |
| ADT^A31 | Update person | Inbound | PUT /Patient | Demographics update |
| ADT^A34 | Merge patient | Inbound | POST /Patient/$merge | Patient record merge |
| ADT^A40 | Merge patient — patient identifier list | Inbound | POST /Patient/$merge | MRN merge |
| ORM^O01 | General order | Inbound | POST /ServiceRequest | Lab, radiology, procedure orders |
| OML^O21 | Lab order | Inbound | POST /ServiceRequest + Specimen | Lab orders with specimen |
| ORU^R01 | Unsolicited observation | Inbound | POST /Observation + DiagnosticReport | Lab/radiology results |
| RGV^O15 | Pharmacy give | Inbound | POST /MedicationAdministration | Drug administered |
| RAS^O17 | Pharmacy administration | Inbound | POST /MedicationAdministration | MAR record |
| RDS^O13 | Pharmacy dispense | Inbound | POST /MedicationDispense | Pharmacy dispense record |
| DFT^P03 | Post detail financial transaction | Inbound | POST /Claim | Charge capture |
| SCH^S12 | Notification of new appointment booking | Inbound | POST /Appointment | New appointment |
| SCH^S13 | Notification of appointment rescheduling | Inbound | PATCH /Appointment | Reschedule |
| SCH^S14 | Notification of appointment modification | Inbound | PATCH /Appointment | Modify |
| SCH^S15 | Notification of appointment cancellation | Inbound | PATCH /Appointment (status → cancelled) | Cancel |
| MDM^T01 | Original document notification | Inbound | POST /DocumentReference | New clinical document |
| MDM^T02 | Original document notification + content | Inbound | POST /DocumentReference + content | |

---

## Segment Mappings

### PID (Patient Identification) → Patient

| PID Field | HL7 Element | FHIR Path | Notes |
|----------|-------------|-----------|-------|
| PID-2 | Patient ID (External) | `Patient.identifier[external]` | Deprecated in v2.7 |
| PID-3 | Patient Identifier List | `Patient.identifier[]` | Primary MRN in CX[0] |
| PID-5 | Patient Name | `Patient.name[official]` | XPN → HumanName |
| PID-6 | Mother's Maiden Name | `Patient.extension.mothersMaidenName` | |
| PID-7 | Date/Time of Birth | `Patient.birthDate` | YYYYMMDD → YYYY-MM-DD |
| PID-8 | Administrative Sex | `Patient.extension.birthSex` | M/F/O/U → SNOMED |
| PID-10 | Race | `Patient.extension.race` | HL7 race codes → US Core Race |
| PID-11 | Patient Address | `Patient.address[]` | XAD → Address |
| PID-13 | Phone Number — Home | `Patient.telecom[home/phone]` | XTN → ContactPoint |
| PID-14 | Phone Number — Business | `Patient.telecom[work/phone]` | |
| PID-15 | Primary Language | `Patient.communication[preferred].language` | ISO 639 |
| PID-16 | Marital Status | `Patient.maritalStatus` | |
| PID-17 | Religion | `Patient.extension.religion` | |
| PID-19 | SSN Number — Patient | `Patient.identifier[SSN]` | Avoid storing if possible |
| PID-22 | Ethnic Group | `Patient.extension.ethnicity` | |
| PID-29 | Patient Death Date and Time | `Patient.deceasedDateTime` | |
| PID-30 | Patient Death Indicator | `Patient.deceasedBoolean` | Y → true |
| PID-33 | Last Update Date/Time | `Patient.meta.lastUpdated` | |

### PV1 (Patient Visit) → Encounter

| PV1 Field | HL7 Element | FHIR Path | Notes |
|----------|-------------|-----------|-------|
| PV1-2 | Patient Class | `Encounter.class` | I→IMP, O→AMB, E→EMER, R→OBSENC |
| PV1-3 | Assigned Patient Location | `Encounter.location[current]` | PL → Location reference |
| PV1-4 | Admission Type | `Encounter.type[]` | HL7 admission type |
| PV1-6 | Prior Patient Location | `Encounter.location[prior]` | |
| PV1-7 | Attending Doctor | `Encounter.participant[ATND]` | XCN → Practitioner reference |
| PV1-8 | Referring Doctor | `Encounter.participant[REF]` | |
| PV1-9 | Consulting Doctor | `Encounter.participant[CON]` | |
| PV1-10 | Hospital Service | `Encounter.serviceType` | |
| PV1-14 | Admit Source | `Encounter.hospitalization.admitSource` | |
| PV1-17 | Admitting Doctor | `Encounter.participant[ADM]` | |
| PV1-18 | Patient Type | `Encounter.extension.patientType` | |
| PV1-19 | Visit Number | `Encounter.identifier[visitNumber]` | |
| PV1-36 | Discharge Disposition | `Encounter.hospitalization.dischargeDisposition` | |
| PV1-44 | Admit Date/Time | `Encounter.period.start` | |
| PV1-45 | Discharge Date/Time | `Encounter.period.end` | |

### OBR (Observation Request) → ServiceRequest

| OBR Field | HL7 Element | FHIR Path | Notes |
|----------|-------------|-----------|-------|
| OBR-2 | Placer Order Number | `ServiceRequest.identifier[placer]` | EI → Identifier |
| OBR-3 | Filler Order Number | `ServiceRequest.identifier[filler]` | |
| OBR-4 | Universal Service Identifier | `ServiceRequest.code` | CWE → CodeableConcept (LOINC) |
| OBR-7 | Observation Date/Time | `ServiceRequest.occurrenceDateTime` | |
| OBR-13 | Relevant Clinical Info | `ServiceRequest.note[]` | |
| OBR-16 | Ordering Provider | `ServiceRequest.requester` | XCN → Practitioner |
| OBR-18 | Placer Field 1 | `ServiceRequest.extension.placerField1` | |
| OBR-22 | Results Rpt/Status Chng Date/Time | `ServiceRequest.extension.resultStatusDateTime` | |
| OBR-25 | Result Status | `ServiceRequest.status` | O=active, R=preliminary, F=completed |
| OBR-27 | Quantity/Timing | `ServiceRequest.quantity` + timing | |
| OBR-31 | Reason for Study | `ServiceRequest.reasonCode[]` | |

### OBX (Observation/Result) → Observation

| OBX Field | HL7 Element | FHIR Path | Notes |
|----------|-------------|-----------|-------|
| OBX-1 | Set ID | `Observation.identifier[setId]` | |
| OBX-2 | Value Type | Determines `Observation.value[x]` type | NM→Quantity, ST→String, CWE→CodeableConcept, ED→Attachment |
| OBX-3 | Observation Identifier | `Observation.code` | CWE → CodeableConcept (LOINC) |
| OBX-4 | Observation Sub-ID | `Observation.component[]` grouping | |
| OBX-5 | Observation Value | `Observation.value[x]` | Type depends on OBX-2 |
| OBX-6 | Units | `Observation.valueQuantity.unit` | CE → UCUM |
| OBX-7 | References Range | `Observation.referenceRange[]` | |
| OBX-8 | Abnormal Flags | `Observation.interpretation[]` | H/L/N/HH/LL/A → CodeableConcept |
| OBX-11 | Observation Result Status | `Observation.status` | F=final, P=preliminary, C=corrected |
| OBX-14 | Date/Time of the Observation | `Observation.effectiveDateTime` | |
| OBX-15 | Producer's ID | `Observation.performer[]` | Lab or device |
| OBX-23 | Performing Organization Name | `Observation.performer[]` | XON |
| OBX-25 | Performing Organization Medical Director | `Observation.performer[]` | XCN |

### RXA (Pharmacy/Treatment Administration) → Immunization

| RXA Field | HL7 Element | FHIR Path | Notes |
|----------|-------------|-----------|-------|
| RXA-1 | Give Sub-ID Counter | Sequence identifier | |
| RXA-3 | Date/Time Start of Administration | `Immunization.occurrenceDateTime` | |
| RXA-5 | Administered Code | `Immunization.vaccineCode` | CVX code preferred |
| RXA-6 | Administered Amount | `Immunization.doseQuantity.value` | |
| RXA-7 | Administered Units | `Immunization.doseQuantity.unit` | UCUM |
| RXA-9 | Administration Notes | `Immunization.note[]` | |
| RXA-10 | Administering Provider | `Immunization.performer[]` | XCN |
| RXA-11 | Administered-at Location | `Immunization.location` | PL |
| RXA-15 | Substance Lot Number | `Immunization.lotNumber` | |
| RXA-16 | Substance Expiration Date | `Immunization.expirationDate` | |
| RXA-17 | Substance Manufacturer Name | `Immunization.manufacturer` | CWE → Organization |
| RXA-20 | Completion Status | `Immunization.status` | CP=completed, NA=not-done |
| RXA-27 | Administered Barcode Identifier | `Immunization.vaccineCode.coding[NDC]` | NDC |

---

## ADT Messages

### ADT^A01 — Admit/Visit Notification

```
MSH|^~\&|SENDING_APP|SENDING_FAC|RECV_APP|RECV_FAC|20260414120000||ADT^A01^ADT_A01|MSG001|P|2.5.1|||AL|AL|USA|ASCII|||
EVN|A01|20260414120000|||
PID|1||12345^^^FACILITY^MR||DOE^JOHN^A||19800115|M|||123 MAIN ST^^BOSTON^MA^02101^USA|||EN|M||||555-12-3456||||N|N|||
PV1|1|I|2E^201^01^FACILITY||||^SMITH^JOHN^^^DR|||MED|||1|||||^JONES^MARY^^^DR|||||||||||||||||||||||||20260414120000|
```

**Resulting FHIR Resources:**
1. `Patient` — created or updated from PID
2. `Encounter` — created with status `in-progress`, class `IMP`
3. `Practitioner` — created or matched from PV1-7 (attending)
4. `Location` — matched from PV1-3 (assigned location)

### ADT^A03 — Discharge/End Visit

```
MSH|^~\&|SENDING_APP|SENDING_FAC|RECV_APP|RECV_FAC|20260414180000||ADT^A03^ADT_A03|MSG002|P|2.5.1|||AL|AL|
EVN|A03|20260414180000|||
PID|1||12345^^^FACILITY^MR||DOE^JOHN^A||19800115|M|||
PV1|1|I|2E^201^01^FACILITY||||^SMITH^JOHN^^^DR|||MED|||1||||||||||||||||||||||||||||20260414120000|20260414180000|01|
```

**Resulting FHIR Update:**
- `Encounter.status` → `finished`
- `Encounter.period.end` → PV1-45 (discharge datetime)
- `Encounter.hospitalization.dischargeDisposition` → PV1-36

### ADT^A08 — Update Patient Information

```
MSH|^~\&|SENDING_APP|SENDING_FAC|RECV_APP|RECV_FAC|20260414130000||ADT^A08^ADT_A01|MSG003|P|2.5.1|||AL|AL|
EVN|A08|20260414130000|||
PID|1||12345^^^FACILITY^MR||DOE^JOHN^B||19800115|M|||456 NEW ST^^BOSTON^MA^02102^USA|||EN|M||||555-12-3456||||
```

**Resulting FHIR Update:**
- `Patient.name` updated from PID-5
- `Patient.address` updated from PID-11
- New version created: `Patient.meta.versionId` incremented

---

## ORM/OML Messages

### ORM^O01 — General Order

```
MSH|^~\&|ORDER_APP|ORDER_FAC|LAB|LAB_FAC|20260414090000||ORM^O01^ORM_O01|MSG004|P|2.5.1|||
PID|1||12345^^^FACILITY^MR||DOE^JOHN^A||19800115|M|||
ORC|NW|ORD-123456|||||^^^20260414090000^^R|||^SMITH^JOHN^^^DR|||20260414090000|
OBR|1|ORD-123456||85025^CBC W DIFF^LN|||20260414090000|||||||20260414090000|Blood^Venous|||^SMITH^JOHN^^^DR|||||||||NW|
```

**Resulting FHIR Resources:**
1. `ServiceRequest` — new order, status `active`
2. `Specimen` — if specimen details in SPM segment

### ORM^O01 Cancellation

```
ORC|CA|ORD-123456|||||...
```

**Resulting FHIR Update:**
- `ServiceRequest.status` → `revoked`
- `Provenance` recorded for cancellation

---

## ORU Messages

### ORU^R01 — Unsolicited Observation

```
MSH|^~\&|LAB|LAB_FAC|RECV_APP|RECV_FAC|20260414143000||ORU^R01^ORU_R01|MSG005|P|2.5.1|||
PID|1||12345^^^FACILITY^MR||DOE^JOHN^A||19800115|M|||
PV1|1|I|2E^201^01^FACILITY||||^SMITH^JOHN^^^DR|||
ORC|RE|ORD-123456|LAB-789|||||||^SMITH^JOHN^^^DR|||
OBR|1|ORD-123456|LAB-789|85025^CBC W DIFF^LN|||20260414143000|||||||20260414143000|Blood^Venous|||^SMITH^JOHN^^^DR|||F|
OBX|1|NM|6690-2^WBC^LN|1|7.2|10*3/uL^10 to the 3rd power per uL^UCUM|4.5-11.0|N|||F|||20260414143000|
OBX|2|NM|789-8^RBC^LN|1|4.8|10*6/uL^10 to the 6th power per uL^UCUM|4.2-5.8|N|||F|||20260414143000|
OBX|3|NM|718-7^Hgb^LN|1|14.2|g/dL^gram per deciliter^UCUM|13.5-17.5|N|||F|||20260414143000|
```

**Resulting FHIR Resources:**
1. `DiagnosticReport` — one per OBR; status `final`
2. `Observation` — one per OBX; status `final`
3. `DiagnosticReport.result` references each Observation

---

## RGV/RAS Messages

### RGV^O15 / RAS^O17 — Pharmacy Give/Administration

```
MSH|^~\&|PHARMACY|PHARM_FAC|RECV_APP|RECV_FAC|20260414100000||RGV^O15^RGV_O15|MSG006|P|2.5.1|||
PID|1||12345^^^FACILITY^MR||DOE^JOHN^A||19800115|M|||
ORC|RE|RX-654321|||||||||^SMITH^JOHN^^^DR|||
RXG|1|1|^^^20260414100000||0002-1433-60^ASPIRIN 81MG^NDC|1||TAB||ORAL|||||LOT-2025-001|20270101||BAYER HEALTHCARE|
RXA|0|1|20260414100000|20260414100000|0002-1433-60^ASPIRIN 81MG^NDC|1||TAB||ORAL|||20260414100000^NUR123^SMITH|2E^201|LOT-2025-001|20270101|BAYER|
RXR|PO^Oral^HL70162||||
```

**Resulting FHIR Resources:**
1. `MedicationAdministration` — one per RXA

### MedicationAdministration Field Mapping

| RXA Field | FHIR Path |
|----------|-----------|
| RXA-3 | `MedicationAdministration.effective[x]` |
| RXA-5 | `MedicationAdministration.medication[x]` |
| RXA-6/7 | `MedicationAdministration.dosage.dose` |
| RXA-10 | `MedicationAdministration.performer[].actor` |
| RXA-15 | `MedicationAdministration.dosage.extension.lotNumber` |
| RXA-20 | `MedicationAdministration.status` |
| RXR-1 | `MedicationAdministration.dosage.route` |

---

## DFT Messages

### DFT^P03 — Post Detail Financial Transaction

```
MSH|^~\&|BILLING|BILL_FAC|RECV_APP|RECV_FAC|20260414160000||DFT^P03^DFT_P03|MSG007|P|2.5.1|||
PID|1||12345^^^FACILITY^MR||DOE^JOHN^A||19800115|M|||
PV1|1|I|2E^201^01^FACILITY|||||||MED||||19|||||
FT1|1|CHG-001|20260414|20260414|CG|99213^OFFICE VISIT LEVEL 3^CPT||||1.00|225.00|||||^SMITH^JOHN^^^DR||||INS1|
DG1|1|ICD10|J06.9^UPPER RESPIRATORY INFECTION^ICD10CM|UPPER RESP INFECTION||F|
```

**Resulting FHIR Resources:**
1. `Claim` — one per DFT^P03
2. `Claim.item[]` — one per FT1 segment
3. `Claim.diagnosis[]` — one per DG1 segment

### FT1 to Claim.item Mapping

| FT1 Field | FHIR Claim Path |
|----------|----------------|
| FT1-3 | `Claim.item[].servicedDate` |
| FT1-5 | `Claim.item[].extension.transactionType` |
| FT1-7 | `Claim.item[].productOrService` (CPT/HCPCS) |
| FT1-10 | `Claim.item[].quantity` |
| FT1-22 | `Claim.item[].unitPrice` |
| FT1-20 | `Claim.item[].diagnosisSequence[]` |

---

## SCH Messages

### SCH^S12 — New Appointment Booking

```
MSH|^~\&|SCHED|SCHED_FAC|RECV_APP|RECV_FAC|20260414080000||SCH^S12^SCH_S12|MSG008|P|2.5.1|||
SCH|APT-9001||||||20260414090000^20260414093000|||CONSULT^Consultation^LOCAL|20260414090000|30^min^UCUM|
PID|1||12345^^^FACILITY^MR||DOE^JOHN^A||19800115|M|||
PV1|1|O|||||^SMITH^JOHN^^^DR|||MED|||
AIS|1|A|CONSULT^Consultation^LOCAL|20260414090000|30^min^UCUM|||||
AIL|1|A|CLINIC-A^Clinic A^FACILITY|||20260414090000|
AIP|1|A|^SMITH^JOHN^^^DR|DR^Doctor^HL70443||20260414090000|
```

**Resulting FHIR Resources:**
1. `Appointment` — status `booked`, start/end from SCH-11/12
2. `AppointmentResponse` — accepted response for each participant

### SCH to Appointment Mapping

| SCH Field | FHIR Appointment Path |
|----------|----------------------|
| SCH-1 | `Appointment.identifier[placer]` |
| SCH-2 | `Appointment.identifier[filler]` |
| SCH-11 | `Appointment.start` |
| SCH-12 | `Appointment.end` |
| SCH-9 | `Appointment.serviceType[]` |
| SCH-16 | `Appointment.comment` |
| AIP-3 | `Appointment.participant[practitioner]` |
| AIL-3 | `Appointment.participant[location]` |

---

## Integration Patterns

### Inbound Message Processing Pipeline

```
HL7 v2 Message (MLLP)
    ↓
Message Router (by MSH-9 event type)
    ↓
Parser → Canonical Model
    ↓
Patient Matching (MPI lookup by PID-3)
    ↓
FHIR Resource Builder
    ↓
Validation (FHIR profiles)
    ↓
Persistence (FHIR server)
    ↓
ACK response (AA/AE/AR)
```

### Error Handling

| Error Scenario | ACK Code | ERR Segment |
|---------------|----------|-------------|
| Missing required field | AE | ERR\|1\|MSH^1^3\|101\|E\|...\|Required field missing |
| Unknown patient (no MPI match) | AE | ERR\|1\|PID^1^3\|204\|E\|...\|Patient not found |
| Duplicate message ID | AR | ERR\|1\|MSH^1^10\|205\|W\|...\|Duplicate |
| Invalid code system value | AE | ERR\|1\|OBX^1^3\|103\|E\|...\|Table value not found |
| System unavailable | AR | ERR\|1\|MSH^1^1\|301\|E\|...\|System unavailable |

### Outbound Message Generation

Our system can generate HL7 v2 messages from FHIR resources for downstream systems:

| Trigger | Generated Message | Use Case |
|---------|------------------|----------|
| Encounter created | ADT^A01 | Notify downstream systems of admission |
| Encounter status → finished | ADT^A03 | Notify discharge |
| ServiceRequest created | ORM^O01 | Send order to ancillary system |
| Observation created (final) | ORU^R01 | Send results to ordering system |
| Appointment created | SIU^S12 | Notify scheduling system |
