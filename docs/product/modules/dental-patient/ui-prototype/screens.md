<!-- oli-version: 1.0 | generated: 2026-05-24 | skill: oli-ui-blueprint --blueprint --all -->

# Screens — dental-patient

## Screen: Patient List (/patients)

**Roles:** staff_full, dentist_associate, dentist_owner
**ARIA:** <main>, <form aria-label="Patient search">, <table aria-label="Patients">

**Layout:** Search bar (top) + filter chips + data table + "New Patient" button
**Components:** Input (search), Select (status filter), Table, Badge, Pagination, EmptyState, Button

**States:** Loading (skeleton rows), Empty ("No patients found"), Results, Error (alert + retry)
**Responsive:** Mobile = card list; Tablet/Desktop = table

---

## Screen: New Patient Form (/patients/new)

**Roles:** staff_full, dentist_associate, dentist_owner
**ARIA:** <main>, <form aria-label="Register patient">

**Layout:** Multi-section form card — Personal Info | Contact | Consent
**Sections:**
1. Personal: first_name, last_name, date_of_birth, gender
2. Contact: email, phone, address
3. Consent: marketing_consent (required), data_sharing_consent (required), sms_consent, email_consent
4. Emergency contact (optional)

**States:** Idle, Submitting (button spinner), Success (redirect to profile), Error (field errors)

---

## Screen: Patient Profile (/patients/:id)

**Roles:** staff_full+
**ARIA:** <main>, <nav aria-label="Patient tabs">

**Layout:** PatientHeader (sticky) + SafetyFloor banner (if allergies) + Tab navigation
**Tabs:** Profile | Treatment Plan | Imaging | Documents | Billing
**Components:** PatientHeader, SafetyFloor, Tabs, Card, ConfirmDialog

**Active tab: Profile**
- Demographics card (editable inline for staff_full+)
- Follow-up notes (append-only, staff_full+)
- Consent summary
- Recall section

**States per tab:** Loading, Loaded, Empty, Error

---

## Screen: Patient Import (/patients/import)

**Roles:** dentist_owner
**Layout:** File upload area + format instructions + preview table

**Components:** FileUpload dropzone, Table (preview), Alert (errors), Button
**States:** Idle (drag-drop), Uploading, Preview (validation results), Success, Error
