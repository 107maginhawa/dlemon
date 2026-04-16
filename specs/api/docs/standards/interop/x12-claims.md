# X12 EDI Healthcare Claims Guide

**Standard:** ASC X12 Version 5010 (TR3)
**Purpose:** Mapping of our FHIR-based clinical and financial resources to X12 EDI transaction sets
**Last Updated:** 2026-04-14

---

## Table of Contents

1. [Overview](#overview)
2. [837P — Professional Claims](#837p--professional-claims)
3. [837I — Institutional Claims](#837i--institutional-claims)
4. [837D — Dental Claims](#837d--dental-claims)
5. [270/271 — Eligibility Inquiry and Response](#270271--eligibility)
6. [278 — Prior Authorization](#278--prior-authorization)
7. [835 — Remittance Advice](#835--remittance-advice)
8. [Common Segment Mappings](#common-segment-mappings)
9. [Code System Crosswalks](#code-system-crosswalks)

---

## Overview

### Supported Transaction Sets

| Transaction Set | FHIR Resource | Direction | Use Case |
|----------------|---------------|-----------|---------|
| 837P | Claim (professional) | Outbound | Physician/professional billing |
| 837I | Claim (institutional) | Outbound | Hospital/facility billing |
| 837D | Claim (dental) | Outbound | Dental billing |
| 270 | CoverageEligibilityRequest | Outbound | Eligibility inquiry |
| 271 | CoverageEligibilityResponse | Inbound | Eligibility response |
| 278 Req | CoverageEligibilityRequest (prior auth) | Outbound | Prior authorization request |
| 278 Resp | CoverageEligibilityResponse (prior auth) | Inbound | Prior auth response |
| 835 | ClaimResponse | Inbound | Remittance/payment advice |
| 276 | Claim (status request) | Outbound | Claim status inquiry |
| 277 | ClaimResponse (status response) | Inbound | Claim status response |
| 999 | N/A | Inbound | Functional acknowledgment |

### Generation API

```http
POST /fhir/Claim/{id}/$x12-837p
Content-Type: application/fhir+json
Accept: application/edi-x12

POST /fhir/CoverageEligibilityRequest/{id}/$x12-270
```

---

## 837P — Professional Claims

### Loop Structure

```
ISA — Interchange Control Header
  GS — Functional Group Header
    ST — Transaction Set Header (837)
    BPR — Beginning of Provider Information
    NM1*41 — Submitter Name
    NM1*40 — Receiver Name

    LOOP 1000A — Billing Provider
      NM1*85 — Billing Provider Name
      N3 — Billing Provider Address
      N4 — Billing Provider City/State/ZIP
      REF*EI — Billing Provider EIN/TIN
      REF*SY — Billing Provider NPI (additional)

    LOOP 1000B — Pay-to Provider (if different)
      NM1*87 — Pay-to Provider

    LOOP 2000A — Subscriber Loop
      HL — Hierarchical Level (Subscriber)
      PRV — Provider Specialty Information
      SBR — Subscriber Information

      LOOP 2010AA — Subscriber Name
        NM1*IL — Insured Name
        N3 — Subscriber Address
        N4 — Subscriber City/State/ZIP
        DMG — Subscriber Demographics

      LOOP 2010AB — Payer Name
        NM1*PR — Payer Name

      LOOP 2000B — Patient Loop (if different from subscriber)
        HL — Hierarchical Level (Dependent)
        PAT — Patient Information

        LOOP 2010CA — Patient Name
          NM1*QC — Patient Name
          N3 — Patient Address
          N4 — Patient City/State/ZIP
          DMG — Patient Demographics

        LOOP 2300 — Claim Information
          CLM — Claim Information
          REF — Prior Authorization Number
          HI — Health Care Diagnosis Codes
          NTE — Note / Additional Information

          LOOP 2310A — Referring Provider
            NM1*DN — Referring Provider Name

          LOOP 2310B — Rendering Provider
            NM1*82 — Rendering Provider Name
            PRV — Provider Specialty

          LOOP 2310C — Service Facility Location
            NM1*77 — Service Facility Location Name
            N3 — Address
            N4 — City/State/ZIP

          LOOP 2320 — Other Subscriber Info (COB)
            SBR — Other Subscriber Information
            OI — Other Insurance Coverage Information

          LOOP 2400 — Service Line
            LX — Service Line Number
            SV1 — Professional Service
            DTP — Service Date
            REF — Procedure Code Reference
            HI — Adjudication/EPSDT Codes (if applicable)

    SE — Transaction Set Trailer
  GE — Functional Group Trailer
IEA — Interchange Control Trailer
```

### Claim → 837P Segment Mapping

| FHIR Field | X12 Segment/Element | Notes |
|------------|---------------------|-------|
| `Claim.id` | CLM01 (Patient Control Number) | Unique claim identifier |
| `Claim.total.value` | CLM02 (Total Claim Charge Amount) | Total charges |
| `Claim.facility.display` | CLM04 (Service Facility Type) | POS code |
| `Claim.priority.code` | CLM08 (Assignment or Plan Participation Code) | Y/N |
| `Claim.patient` → Patient.name | NM1*QC (Patient Name) | Last, First MI |
| `Claim.patient` → Patient.birthDate | DMG*D8 (Date of Birth) | YYYYMMDD |
| `Claim.patient` → Patient.gender | DMG*02 (Gender Code) | M/F/U |
| `Claim.insurance[].coverage.payor` | NM1*PR (Payer Name) | Payer name and ID |
| `Claim.insurance[].coverage.subscriberId` | SBR02 (Individual Relationship Code) + NM1*IL (Member ID) | |
| `Claim.diagnosis[].diagnosisCodeableConcept` | HI (Health Care Diagnosis Codes) | ICD-10-CM; HI01=ABK (principal), HI02+=ABF (secondary) |
| `Claim.item[].productOrService` | SV101 (Composite Medical Procedure) | CPT/HCPCS |
| `Claim.item[].modifier[]` | SV101-3 through SV101-6 (Modifiers) | Up to 4 modifiers |
| `Claim.item[].quantity.value` | SV104 (Service Unit Count) | |
| `Claim.item[].unitPrice.value` | SV102 (Line Item Charge Amount) | |
| `Claim.item[].servicedDate` | DTP*472 (Service Date) | YYYYMMDD |
| `Claim.item[].locationCodeableConcept` | SV105 (Facility Code Value / POS) | |
| `Claim.item[].diagnosisSequence[]` | SV107 (Diagnosis Code Pointer) | 1-based pointers to HI |
| `Claim.provider` → Practitioner.identifier[NPI] | NM1*82-09 (Rendering Provider NPI) | |
| `Claim.referral` → ServiceRequest.requester | NM1*DN (Referring Provider) | |

### Place of Service (POS) Codes — CLM04

| POS Code | Description | FHIR Encounter.class |
|----------|-------------|---------------------|
| 11 | Office | AMB |
| 21 | Inpatient Hospital | IMP |
| 22 | On Campus - Outpatient Hospital | AMB |
| 23 | Emergency Room - Hospital | EMER |
| 24 | Ambulatory Surgical Center | AMB |
| 31 | Skilled Nursing Facility | SS |
| 32 | Nursing Facility | SS |
| 81 | Independent Laboratory | N/A |
| 02 | Telehealth - Patient at Home | VR |
| 10 | Telehealth - Patient in Site | VR |

---

## 837I — Institutional Claims

### Key Differences from 837P

| Element | 837P (Professional) | 837I (Institutional) |
|---------|--------------------|--------------------|
| Service Code | CPT/HCPCS (SV1) | Revenue codes (SV2) |
| Diagnosis format | ICD-10-CM in HI segments | ICD-10-CM + POA indicator |
| Facility type | Place of Service (POS) | Type of Bill (TOB) |
| Claim type | Professional | Institutional (UB-04 based) |
| Attending physician | 2310A | 2310A — mandatory for inpatient |
| DRG | Not applicable | DRG in HI segment (if applicable) |
| Occurrence codes | Not used | OI segment |
| Condition codes | Not used | HI (BG qualifier) |
| Value codes | Not used | HI (BE qualifier) |

### Type of Bill (TOB) Codes

| TOB | Description | FHIR Encounter.type |
|-----|-------------|---------------------|
| 011X | Hospital Inpatient | `Encounter.class = IMP` |
| 013X | Hospital Outpatient | `Encounter.class = AMB` |
| 014X | Hospital - Laboratory | Observation order |
| 023X | Skilled Nursing Facility Inpatient | `Encounter.class = SS` |
| 077X | Home Health | `Encounter.class = HH` |
| 085X | Critical Access Hospital Outpatient | `Encounter.class = AMB` |

### SV2 — Institutional Service Line

| FHIR Field | SV2 Element | Notes |
|------------|-------------|-------|
| `Claim.item[].revenue` | SV201 (Revenue Code) | UB-04 revenue code |
| `Claim.item[].productOrService` | SV202 (Composite Medical Procedure) | CPT/HCPCS (optional) |
| `Claim.item[].unitPrice.value` | SV205 (Line Item Charge Amount) | |
| `Claim.item[].quantity.value` | SV204 (Service Unit Count) | |
| `Claim.item[].servicedPeriod` | DTP*435 (Admission Date), DTP*096 (Discharge Date) | |

---

## 837D — Dental Claims

### Key Differences

| Element | 837D (Dental) |
|---------|--------------|
| Service code | CDT (Current Dental Terminology) |
| Tooth surface | SV3 — tooth number and surface |
| Facility type | POS same as 837P |
| Orthodontic | Special SV3 elements |

### SV3 — Dental Service Line

| FHIR Field | SV3 Element | Notes |
|------------|-------------|-------|
| `Claim.item[].productOrService` | SV301 (CDT Code) | CDT code |
| `Claim.item[].unitPrice.value` | SV302 (Line Item Charge Amount) | |
| `Claim.item[].extension.toothNumber` | SV303-04 (Tooth Number) | |
| `Claim.item[].extension.toothSurface` | SV303-05 (Tooth Surface) | |
| `Claim.item[].bodySite` | SV303-03 (Oral Cavity Designation) | |

---

## 270/271 — Eligibility

### 270 — Eligibility Inquiry

Maps from `CoverageEligibilityRequest`:

| FHIR Field | X12 Segment | Notes |
|------------|-------------|-------|
| `CoverageEligibilityRequest.patient` → Patient | NM1*IP-03/04 | Last, First |
| `CoverageEligibilityRequest.patient` → Patient.birthDate | DMG*D8 | |
| `CoverageEligibilityRequest.patient` → Patient.gender | DMG*02 | |
| `CoverageEligibilityRequest.insurance[].coverage.subscriberId` | NM1*IP-09 (Member ID) | |
| `CoverageEligibilityRequest.insurance[].coverage.payor` | NM1*PR (Payer) | |
| `CoverageEligibilityRequest.provider` | NM1*1P (Provider) | NPI |
| `CoverageEligibilityRequest.servicedDate` | DTP*291 (Service Date) | |
| `CoverageEligibilityRequest.item[].category` | EQ01 (Service Type Code) | 30=Health Benefit Plan Coverage, 1=Medical Care |

### 271 — Eligibility Response

Maps to `CoverageEligibilityResponse`:

| X12 Segment | FHIR Field | Notes |
|-------------|------------|-------|
| EB01 (Coverage Level) | `CoverageEligibilityResponse.insurance[].item[].category` | Coverage type |
| EB02 (Coverage Information) | `CoverageEligibilityResponse.insurance[].item[].benefit[]` | In-network/out-of-network |
| EB06 (Insurance Type) | `CoverageEligibilityResponse.insurance[].coverage.type` | |
| EB07 (Plan Coverage Description) | `CoverageEligibilityResponse.insurance[].coverage.class[plan].name` | |
| DTP*291 (Plan Begin Date) | `CoverageEligibilityResponse.insurance[].coverage.period.start` | |
| DTP*292 (Plan End Date) | `CoverageEligibilityResponse.insurance[].coverage.period.end` | |
| MSG (Message Text) | `CoverageEligibilityResponse.disposition` | Free-text response |

---

## 278 — Prior Authorization

### 278 Request — Prior Authorization

Maps from `CoverageEligibilityRequest` with `purpose = auth-requirements`:

| FHIR Field | X12 Segment | Notes |
|------------|-------------|-------|
| `CoverageEligibilityRequest.patient` | NM1*QC | Patient identity |
| `CoverageEligibilityRequest.insurance` | NM1*PR | Payer |
| `CoverageEligibilityRequest.provider` | NM1*1P | Requesting provider |
| `CoverageEligibilityRequest.item[].productOrService` | SV1 or SV2 | Requested service |
| `CoverageEligibilityRequest.item[].diagnosis` | HI | Supporting diagnosis |
| `CoverageEligibilityRequest.item[].supportingInfoSequence` | PWK | Attached documentation |

### 278 Response

| X12 Segment | FHIR Field | Notes |
|-------------|------------|-------|
| HCR01 (Action Code) | `CoverageEligibilityResponse.outcome` | A1=Certified, A3=Not Certified, A4=Pended |
| REF*9F | `CoverageEligibilityResponse.preAuthRef` | Authorization number |
| DTP*472 | `CoverageEligibilityResponse.insurance[].item[].authorizedDate` | Authorized service dates |
| UM04 (Quantity) | `CoverageEligibilityResponse.insurance[].item[].benefit[].used.value` | Authorized units |

---

## 835 — Remittance Advice

Maps to `ClaimResponse` and `PaymentReconciliation`:

### Header

| X12 Segment | FHIR Field | Notes |
|-------------|------------|-------|
| BPR01 (Transaction Handling Code) | `PaymentReconciliation.outcome` | C=Credit, D=Debit, H=Hold |
| BPR02 (Total Actual Provider Payment) | `PaymentReconciliation.payment.amount` | Total payment |
| BPR16 (Payment Date) | `PaymentReconciliation.payment.date` | EFT/check date |
| TRN02 (Trace Number) | `PaymentReconciliation.identifier[trace]` | Check or EFT trace |

### Claim Payment Loop (2100)

| X12 Segment | FHIR Field | Notes |
|-------------|------------|-------|
| CLP01 (Claim Submitter's Identifier) | `ClaimResponse.request.identifier` | Our claim ID |
| CLP02 (Claim Status Code) | `ClaimResponse.outcome` | 1=Processed, 2=Processed as other, 3=Suspended, 4=Denied |
| CLP03 (Total Claim Charge Amount) | `ClaimResponse.total[submitted].amount` | Billed amount |
| CLP04 (Claim Payment Amount) | `ClaimResponse.total[benefit].amount` | Paid amount |
| CLP06 (Payer Claim Control Number) | `ClaimResponse.identifier[payer]` | Payer's reference |
| NM1*QC (Patient Name) | `ClaimResponse.patient` | |
| NM1*IL (Insured Name) | `ClaimResponse.insurer` | |

### Service Line Adjustment Loop (2110)

| X12 Segment | FHIR Field | Notes |
|-------------|------------|-------|
| SVC01 (Composite Medical Procedure) | `ClaimResponse.item[].adjudication[]` | Service code billed |
| SVC02 (Line Item Charge Amount) | `ClaimResponse.item[].adjudication[submitted].amount` | |
| SVC03 (Line Item Provider Payment Amount) | `ClaimResponse.item[].adjudication[benefit].amount` | |
| CAS01 (Claim Adjustment Group Code) | `ClaimResponse.item[].adjudication[].reason.coding[].code` | CO/OA/PI/PR |
| CAS02 (Claim Adjustment Reason Code) | `ClaimResponse.item[].adjudication[].reason.coding[].code` | CARC code |
| CAS03 (Adjustment Amount) | `ClaimResponse.item[].adjudication[].amount` | Adjustment amount |

### Claim Adjustment Reason Code (CARC) Mapping

| CARC | Description | FHIR Reason Code |
|------|-------------|-----------------|
| 1 | Deductible amount | deductible |
| 2 | Coinsurance amount | coinsurance |
| 3 | Co-payment amount | copay |
| 4 | The procedure code is inconsistent with the modifier | benefit |
| 45 | Charge exceeds fee schedule | benefit |
| 96 | Non-covered charge | benefit |
| 97 | Payment included in allowance for another service | benefit |
| 200 | Expenses incurred during lapse in coverage | benefit |

---

## Common Segment Mappings

### NM1 — Entity Name

| Element | Description | FHIR Mapping |
|---------|-------------|--------------|
| NM101 | Entity Identifier Code | 85=Billing Provider, IL=Insured, QC=Patient, 1P=Provider |
| NM102 | Entity Type Qualifier | 1=Person, 2=Non-Person |
| NM103 | Last/Organization Name | Patient.name.family / Organization.name |
| NM104 | First Name | Patient.name.given[0] |
| NM105 | Middle Name | Patient.name.given[1] |
| NM108 | Identification Code Qualifier | XX=NPI, ZZ=Mutually Defined, MI=Member ID |
| NM109 | Identification Code | NPI / Member ID value |

### REF — Reference Identification

| Qualifier | Description | FHIR Element |
|-----------|-------------|--------------|
| G1 | Prior Authorization Number | `Claim.extension.priorAuthNumber` |
| 9F | Prior Authorization Number (pay-to) | `ClaimResponse.preAuthRef` |
| EI | Employer's Identification Number | `Organization.identifier[EIN]` |
| SY | Social Security Number | (avoid — use NPI preferred) |
| 1L | Group or Policy Number | `Coverage.class[group].value` |
| 6P | Group Number | `Coverage.class[group].value` |
| Y4 | Agency Claim Number | `ClaimResponse.identifier[payer]` |

---

## Code System Crosswalks

### Diagnosis Code Format in HI

| HI Qualifier | Description | Example |
|-------------|-------------|---------|
| ABK | ICD-10-CM Principal Diagnosis | ABK:J06.9 |
| ABF | ICD-10-CM Secondary Diagnosis | ABF:E11.9 |
| ABJ | ICD-10-CM Admitting Diagnosis | ABJ:R05.9 |
| DR | DRG | DR:194 |
| BG | Condition Code | BG:01 |
| BE | Value Code | BE:A1 (Medicare Part A deductible) |

### Place of Service (837P) vs Type of Bill (837I)

Both map from `Encounter.class` and `Encounter.serviceType`:

| Encounter | POS Code | TOB Code |
|-----------|----------|---------|
| Inpatient Admit | N/A (837I only) | 011X |
| Emergency Room | 23 | 045X |
| Outpatient | 22 | 013X |
| Office Visit | 11 | N/A (837P only) |
| Home Health | 12 | 032X |
| Telehealth from home | 02 | 013X (modifier 95) |
| Telehealth at site | 10 | N/A |
