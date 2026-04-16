# DICOM/DICOMweb Integration Guide

**Standard:** DICOM (Digital Imaging and Communications in Medicine) PS3.18 — Web Services
**DICOMweb Version:** DICOM PS3.18-2024a
**Purpose:** Imaging study management, PACS integration, and medical image access
**Last Updated:** 2026-04-14

---

## Table of Contents

1. [DICOM Hierarchy Mapping](#dicom-hierarchy-mapping)
2. [DICOMweb APIs](#dicomweb-apis)
3. [QIDO-RS — Query](#qido-rs--query)
4. [WADO-RS — Retrieve](#wado-rs--retrieve)
5. [STOW-RS — Store](#stow-rs--store)
6. [WADO-URI — Legacy Retrieval](#wado-uri--legacy-retrieval)
7. [PACS Integration Patterns](#pacs-integration-patterns)
8. [Presigned URL Pattern](#presigned-url-pattern)
9. [ImagingStudy → DICOM Mapping](#imagingstudy--dicom-mapping)

---

## DICOM Hierarchy Mapping

### DICOM to FHIR Hierarchy

| DICOM Level | DICOM Attribute | FHIR Resource | FHIR Element |
|------------|----------------|---------------|--------------|
| Study | StudyInstanceUID (0020,000D) | ImagingStudy | `ImagingStudy.identifier[studyInstanceUid]` |
| Study | PatientID (0010,0020) | ImagingStudy | `ImagingStudy.subject` → Patient |
| Study | StudyDate (0008,0020) | ImagingStudy | `ImagingStudy.started` |
| Study | StudyTime (0008,0030) | ImagingStudy | `ImagingStudy.started` (combined) |
| Study | AccessionNumber (0008,0050) | ImagingStudy | `ImagingStudy.identifier[accession]` |
| Study | ReferringPhysician (0008,0090) | ImagingStudy | `ImagingStudy.referrer` → Practitioner |
| Study | StudyDescription (0008,1030) | ImagingStudy | `ImagingStudy.description` |
| Study | NumberOfStudyRelatedSeries (0020,1206) | ImagingStudy | `ImagingStudy.numberOfSeries` |
| Study | NumberOfStudyRelatedInstances (0020,1208) | ImagingStudy | `ImagingStudy.numberOfInstances` |
| Series | SeriesInstanceUID (0020,000E) | ImagingStudy.series | `ImagingStudy.series[].uid` |
| Series | Modality (0008,0060) | ImagingStudy.series | `ImagingStudy.series[].modality` |
| Series | SeriesNumber (0020,0011) | ImagingStudy.series | `ImagingStudy.series[].number` |
| Series | SeriesDescription (0008,103E) | ImagingStudy.series | `ImagingStudy.series[].description` |
| Series | BodyPartExamined (0018,0015) | ImagingStudy.series | `ImagingStudy.series[].bodySite` |
| Series | Laterality (0020,0060) | ImagingStudy.series | `ImagingStudy.series[].laterality` |
| Series | NumberOfSeriesRelatedInstances (0020,1209) | ImagingStudy.series | `ImagingStudy.series[].numberOfInstances` |
| Series | PerformingPhysician (0008,1050) | ImagingStudy.series | `ImagingStudy.series[].performer[]` |
| Instance | SOPInstanceUID (0008,0018) | ImagingStudy.series.instance | `ImagingStudy.series[].instance[].uid` |
| Instance | SOPClassUID (0008,0016) | ImagingStudy.series.instance | `ImagingStudy.series[].instance[].sopClass` |
| Instance | InstanceNumber (0020,0013) | ImagingStudy.series.instance | `ImagingStudy.series[].instance[].number` |
| Instance | ImageComments (0020,4000) | ImagingStudy.series.instance | `ImagingStudy.series[].instance[].title` |

### Modality Codes (DICOM → FHIR)

| DICOM Code | Description | SNOMED CT |
|-----------|-------------|----------|
| CR | Computed Radiography | 363680008 |
| CT | Computed Tomography | 77477000 |
| MR | Magnetic Resonance | 113091000 |
| US | Ultrasound | 16310003 |
| PT | Positron Emission Tomography | 82918005 |
| NM | Nuclear Medicine | 363680008 |
| MG | Mammography | 71651007 |
| DX | Digital Radiography | 363680008 |
| XA | X-Ray Angiography | 77343006 |
| OT | Other | 363680008 |
| ECG | Electrocardiography | 29303009 |
| ES | Endoscopy | 73761001 |
| SM | Slide Microscopy | 104157003 |

---

## DICOMweb APIs

### Base URL

```
https://api.monobase.health/dicom/wado
```

### Authentication

All DICOMweb endpoints require a Bearer token (SMART on FHIR):
```http
Authorization: Bearer {access_token}
```

Scopes required:
- Read imaging: `patient/ImagingStudy.read` or `user/ImagingStudy.read`
- Store imaging: `user/ImagingStudy.write` or `system/ImagingStudy.write`

---

## QIDO-RS — Query

**QIDO-RS:** Query based on ID for DICOM Objects — RESTful Services

### Study-Level Query

```http
GET /dicom/wado/studies
    ?PatientID={patientId}
    &StudyDate={date}
    &Modality={modality}
    &AccessionNumber={accessionNumber}
    &includefield=StudyDescription,NumberOfStudyRelatedSeries
    &limit=25
    &offset=0
Accept: application/dicom+json
```

### Series-Level Query

```http
GET /dicom/wado/studies/{StudyInstanceUID}/series
    ?Modality={modality}
    &SeriesNumber={seriesNumber}
    &includefield=all
Accept: application/dicom+json
```

### Instance-Level Query

```http
GET /dicom/wado/studies/{StudyInstanceUID}/series/{SeriesInstanceUID}/instances
    ?SOPClassUID={sopClassUID}
    &InstanceNumber={instanceNumber}
Accept: application/dicom+json
```

### Supported Query Parameters

| Parameter | DICOM Tag | Level | Description |
|-----------|----------|-------|-------------|
| `PatientID` | 0010,0020 | Study | Filter by patient ID |
| `PatientName` | 0010,0010 | Study | Filter by patient name (wildcard supported) |
| `StudyDate` | 0008,0020 | Study | Single date or range (YYYYMMDD-YYYYMMDD) |
| `StudyTime` | 0008,0030 | Study | Study time |
| `AccessionNumber` | 0008,0050 | Study | Accession number |
| `Modality` | 0008,0060 | Series | Modality filter |
| `StudyInstanceUID` | 0020,000D | Study | Specific study UID |
| `SeriesInstanceUID` | 0020,000E | Series | Specific series UID |
| `SOPInstanceUID` | 0008,0018 | Instance | Specific instance UID |
| `SOPClassUID` | 0008,0016 | Instance | SOP class filter |
| `limit` | N/A | All | Max results (default 25, max 200) |
| `offset` | N/A | All | Pagination offset |
| `includefield` | N/A | All | Additional attributes to include |
| `fuzzymatching` | N/A | All | Enable fuzzy name matching |

### QIDO-RS Response Format

```json
[
  {
    "00080020": { "vr": "DA", "Value": ["20260414"] },
    "00080030": { "vr": "TM", "Value": ["120000"] },
    "00080050": { "vr": "SH", "Value": ["ACC-001234"] },
    "00080060": { "vr": "CS", "Value": ["CT"] },
    "0020000D": { "vr": "UI", "Value": ["1.2.3.4.5.6.7.8.9"] },
    "00201206": { "vr": "IS", "Value": [4] },
    "00201208": { "vr": "IS", "Value": [512] },
    "00081030": { "vr": "LO", "Value": ["CT Chest with contrast"] }
  }
]
```

---

## WADO-RS — Retrieve

**WADO-RS:** Web Access to DICOM Objects — RESTful Services

### Retrieve Study (all instances)

```http
GET /dicom/wado/studies/{StudyInstanceUID}
Accept: multipart/related; type="application/dicom"
```

### Retrieve Series

```http
GET /dicom/wado/studies/{StudyInstanceUID}/series/{SeriesInstanceUID}
Accept: multipart/related; type="application/dicom"
```

### Retrieve Instance

```http
GET /dicom/wado/studies/{StudyInstanceUID}/series/{SeriesInstanceUID}/instances/{SOPInstanceUID}
Accept: application/dicom
```

### Retrieve Rendered Images

Returns rendered JPEG/PNG without DICOM tooling needed:

```http
GET /dicom/wado/studies/{StudyInstanceUID}/series/{SeriesInstanceUID}/instances/{SOPInstanceUID}/rendered
Accept: image/jpeg

GET /dicom/wado/studies/{StudyInstanceUID}/series/{SeriesInstanceUID}/instances/{SOPInstanceUID}/rendered?viewport=512,512&quality=80
Accept: image/jpeg
```

### Retrieve Metadata (without pixel data)

```http
GET /dicom/wado/studies/{StudyInstanceUID}/metadata
Accept: application/dicom+json

GET /dicom/wado/studies/{StudyInstanceUID}/series/{SeriesInstanceUID}/instances/{SOPInstanceUID}/metadata
Accept: application/dicom+json
```

### Retrieve Thumbnail

```http
GET /dicom/wado/studies/{StudyInstanceUID}/series/{SeriesInstanceUID}/instances/{SOPInstanceUID}/thumbnail
Accept: image/jpeg
```

### Supported Accept Types

| Accept | Content | Use Case |
|--------|---------|---------|
| `application/dicom` | DICOM Part 10 file | DICOM viewers, PACS |
| `application/dicom+json` | DICOM JSON encoding | Web applications |
| `multipart/related; type="application/dicom"` | Multiple DICOM files | Bulk retrieval |
| `multipart/related; type="application/octet-stream"` | Raw pixel data | Custom processing |
| `image/jpeg` | JPEG rendered | Web display |
| `image/png` | PNG rendered | Web display |
| `image/gif` | Animated GIF (for cine) | Multi-frame preview |
| `video/mpeg` | MPEG video | Cine/video |

---

## STOW-RS — Store

**STOW-RS:** Store Over the Web — RESTful Services

### Store DICOM Instances

```http
POST /dicom/wado/studies
Content-Type: multipart/related; type="application/dicom"; boundary=DICOM_BOUNDARY
Accept: application/dicom+json

--DICOM_BOUNDARY
Content-Type: application/dicom

{binary DICOM file content}
--DICOM_BOUNDARY
Content-Type: application/dicom

{binary DICOM file content}
--DICOM_BOUNDARY--
```

### Store in Specific Study

```http
POST /dicom/wado/studies/{StudyInstanceUID}
Content-Type: multipart/related; type="application/dicom"; boundary=DICOM_BOUNDARY
```

### STOW-RS Response

```json
{
  "00081190": {
    "vr": "UR",
    "Value": ["https://api.monobase.health/dicom/wado/studies/1.2.3.4.5"]
  },
  "00081198": {
    "vr": "SQ",
    "Value": []
  },
  "00081199": {
    "vr": "SQ",
    "Value": [
      {
        "00081150": { "vr": "UI", "Value": ["1.2.840.10008.5.1.4.1.1.2"] },
        "00081155": { "vr": "UI", "Value": ["1.2.3.4.5.6.7"] },
        "00081190": { "vr": "UR", "Value": ["https://api.monobase.health/dicom/wado/studies/1.2.3.4.5/series/1.2.3.4.5.6/instances/1.2.3.4.5.6.7"] }
      }
    ]
  }
}
```

---

## WADO-URI — Legacy Retrieval

**WADO-URI:** Web Access to DICOM Objects — URI-based (PS3.18 Section 6.2)

Still required for many legacy PACS and DICOM viewers.

### WADO-URI Endpoint

```http
GET /dicom/wado?
    requestType=WADO
    &studyUID={StudyInstanceUID}
    &seriesUID={SeriesInstanceUID}
    &objectUID={SOPInstanceUID}
    &contentType=application/dicom
    &transferSyntax=1.2.840.10008.1.2.4.70
```

### Common Transfer Syntaxes

| Transfer Syntax UID | Name | Use Case |
|--------------------|----- |---------|
| 1.2.840.10008.1.2 | Implicit VR Little Endian | Legacy default |
| 1.2.840.10008.1.2.1 | Explicit VR Little Endian | Common |
| 1.2.840.10008.1.2.4.70 | JPEG Lossless | Diagnostic quality |
| 1.2.840.10008.1.2.4.90 | JPEG 2000 Lossless | High quality |
| 1.2.840.10008.1.2.4.91 | JPEG 2000 Lossy | Compressed |
| 1.2.840.10008.1.2.5 | RLE Lossless | Lossless compressed |

---

## PACS Integration Patterns

### Pattern 1: Monobase as DICOM Archive

```
Imaging Modality (CT, MRI, etc.)
    ↓ DICOM C-STORE (via DICOM Gateway)
DICOM Gateway (converts to STOW-RS)
    ↓ STOW-RS
Monobase DICOM Archive (cloud-based)
    ↓
ImagingStudy created in FHIR
    ↓
DiagnosticReport linked to ImagingStudy
```

### Pattern 2: Monobase as DICOM Broker

```
External PACS (primary archive)
    ↓ DICOM C-FIND/C-MOVE
DICOM Broker
    ↓ Index metadata only via STOW-RS (metadata)
Monobase FHIR Server (ImagingStudy metadata)
    ↓ WADO-RS redirect
External PACS for image retrieval
```

### Pattern 3: Hybrid with Presigned URLs

```
Images stored in cloud object storage (S3/Azure Blob)
Metadata indexed in Monobase FHIR (ImagingStudy)
Client requests presigned URL via FHIR
Client retrieves image directly from object storage
```

### DICOM Gateway Configuration

For sites with existing PACS using traditional DICOM:

| Gateway Feature | Configuration |
|----------------|--------------|
| AE Title | MONOBASE_AE |
| DICOM Port | 11112 (standard) |
| TLS Port | 2762 (DICOM TLS) |
| Supported SOP Classes | Storage SOP classes (all standard modalities) |
| Transfer Syntaxes | Explicit VR Little Endian (preferred), implicit (fallback) |
| C-FIND support | Study Root, Patient Root Query |
| C-MOVE support | Study level, Series level |
| C-ECHO support | Connectivity testing |

---

## Presigned URL Pattern

Enables secure, time-limited direct access to DICOM instances stored in cloud object storage without routing through the application server.

### Request Presigned URL

```http
POST /fhir/ImagingStudy/{studyId}/$presigned-url
Content-Type: application/fhir+json

{
  "resourceType": "Parameters",
  "parameter": [
    { "name": "seriesInstanceUID", "valueString": "1.2.3.4.5.6" },
    { "name": "sopInstanceUID", "valueString": "1.2.3.4.5.6.7" },
    { "name": "contentType", "valueCode": "image/jpeg" },
    { "name": "expiresInSeconds", "valueInteger": 3600 }
  ]
}
```

### Response

```json
{
  "resourceType": "Parameters",
  "parameter": [
    {
      "name": "url",
      "valueUrl": "https://storage.monobase.health/images/study-abc/series-def/instance-ghi.jpg?X-Amz-Signature=..."
    },
    {
      "name": "expires",
      "valueDateTime": "2026-04-14T13:00:00Z"
    }
  ]
}
```

### Presigned URL Security

| Control | Implementation |
|---------|---------------|
| Time-limited | URL expires after configured TTL (default 1 hour) |
| Patient-scoped | URL is specific to one instance; cannot access other patients |
| Audit logged | `AuditEvent` created when presigned URL is generated |
| CORS restricted | Cross-origin access limited to registered viewer domains |
| IP binding (optional) | URL can be bound to specific IP for high-security environments |

---

## ImagingStudy → DICOM Mapping

### Full ImagingStudy Example

```json
{
  "resourceType": "ImagingStudy",
  "id": "study-abc123",
  "identifier": [
    {
      "system": "urn:dicom:uid",
      "value": "urn:oid:1.2.840.10008.5.1.4.1.1.2"
    },
    {
      "type": { "coding": [{ "system": "http://terminology.hl7.org/CodeSystem/v2-0203", "code": "ACSN" }] },
      "value": "ACC-001234"
    }
  ],
  "status": "available",
  "modality": [
    { "system": "http://dicom.nema.org/resources/ontology/DCM", "code": "CT" }
  ],
  "subject": { "reference": "Patient/patient-123" },
  "encounter": { "reference": "Encounter/encounter-456" },
  "started": "2026-04-14T08:30:00Z",
  "basedOn": [{ "reference": "ServiceRequest/order-789" }],
  "referrer": { "reference": "Practitioner/dr-smith" },
  "numberOfSeries": 4,
  "numberOfInstances": 512,
  "procedureCode": [{
    "coding": [{ "system": "http://www.radlex.org", "code": "RID10357", "display": "CT chest" }]
  }],
  "reasonCode": [{
    "coding": [{ "system": "http://snomed.info/sct", "code": "267036007", "display": "Dyspnea" }]
  }],
  "description": "CT Chest with contrast",
  "series": [
    {
      "uid": "1.2.3.4.5.6",
      "number": 1,
      "modality": { "system": "http://dicom.nema.org/resources/ontology/DCM", "code": "CT" },
      "description": "Axial lung windows",
      "numberOfInstances": 128,
      "started": "2026-04-14T08:32:00Z",
      "bodySite": { "system": "http://snomed.info/sct", "code": "51185008", "display": "Thoracic structure" },
      "performer": [{ "actor": { "reference": "Practitioner/radiologist-jones" } }],
      "endpoint": [{
        "reference": "Endpoint/dicomweb-endpoint"
      }],
      "instance": [
        {
          "uid": "1.2.3.4.5.6.7",
          "sopClass": { "system": "urn:ietf:rfc:3986", "code": "urn:oid:1.2.840.10008.5.1.4.1.1.2" },
          "number": 1,
          "title": "Slice 1"
        }
      ]
    }
  ]
}
```

### Endpoint Resource for DICOMweb

```json
{
  "resourceType": "Endpoint",
  "id": "dicomweb-endpoint",
  "status": "active",
  "connectionType": {
    "system": "http://terminology.hl7.org/CodeSystem/endpoint-connection-type",
    "code": "dicom-wado-rs"
  },
  "name": "Monobase DICOMweb WADO-RS",
  "address": "https://api.monobase.health/dicom/wado",
  "payloadType": [{
    "coding": [{ "system": "http://terminology.hl7.org/CodeSystem/endpoint-payload-type", "code": "any" }]
  }]
}
```
