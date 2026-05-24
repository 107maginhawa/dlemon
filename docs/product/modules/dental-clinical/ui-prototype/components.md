# Components — dental-clinical
<!-- oli: v3-dentalemon | dental-clinical | ui-prototype -->

Reusable components for the dental-clinical module. Built on Radix UI primitives from `apps/dentalemon/src/components/` (Tabs, Dialog, Select, Combobox, Accordion, Toast). Apple HIG styling; lemon `#FFE97D` primary accent; SF Pro typography; 44px minimum touch targets; `#F2F2F7` grouped background, white card surfaces with `rounded-2xl` and subtle 1px hairline borders.

---

## ClinicalTabsNav
**Props:**
- `value: 'prescriptions' | 'lab_orders' | 'consent' | 'attachments' | 'history'`
- `onChange(value)`
- `counts?: { prescriptions: number; lab_orders: number; consent: number; attachments: number }`
- `disabled?: boolean` (when visit lock + read-only mode wants to suppress write CTAs but tabs remain navigable)

**Behavior:** Radix Tabs root. Five horizontal tab triggers, scrollable on narrow viewport. Each trigger shows label + count badge when count > 0. Active tab underlined in lemon (2px). Tab content panels lazy-mounted (mount on first activation, persist after). Keyboard: Left/Right arrows move focus, Enter activates. Tab change updates URL search param `?tab=` to support deep linking from notifications.

---

## ImmutabilityBanner
**Props:**
- `visible: boolean`
- `reason?: string` (default: "Visit completed — records are read-only")
- `lockedAt?: string` (ISO timestamp)

**Behavior:** Sticky banner at top of tab content area. Lemon-tinted background (`#FFE97D` at 20% alpha) with dark text and a lock icon. When `lockedAt` provided, shows "Locked on {date}". Non-dismissible. Renders above tab content and below tabs nav. Hidden when `visible === false`.

---

## PrescriptionList
**Props:**
- `prescriptions: Prescription[]`
- `editable: boolean`
- `onAdd()` / `onEdit(id)` / `onDelete(id)` / `onPrint(id)`
- `isLoading?: boolean`

**Behavior:** Renders header row with count chip + `Add Prescription` button (hidden when `!editable`). Maps prescriptions newest-first into cards. Long instructions truncated with "Show more" disclosure. Per-row print invokes `onPrint(id)` which opens a print-friendly route in a new tab. Empty state copy + CTA when list is empty and `editable`. Skeleton state during `isLoading`.

---

## AddPrescriptionDialog
**Props:**
- `open: boolean`
- `onOpenChange(open)`
- `patientPmh: { allergies: Allergy[]; medications: Medication[] }`
- `onSubmit(payload): Promise<void>`
- `commonDrugs: DrugOption[]` (seeded list of dental drugs)

**Behavior:** Radix Dialog. Drug field uses a Combobox over `commonDrugs` with free-text fallback. On drug selection, runs a client-side contraindication check against `patientPmh.allergies` (string match against allergen list with synonyms map e.g., penicillin → amoxicillin) and surfaces the `ContraindicationCallout` block. When triggered, requires an "Override allergy warning" checkbox before Save enables. Save calls `onSubmit` with `{ drug_name, dosage, frequency, duration_value, duration_unit, instructions, override_acknowledged }`. Closes on resolved success; keeps open and shows inline errors on rejection. Focus trap; ESC closes when not submitting.

---

## LabOrderList
**Props:**
- `orders: LabOrder[]`
- `editable: boolean`
- `onAdd()` / `onEdit(id)` / `onStatusChange(id, status)` / `onUploadResult(id, file)`

**Behavior:** Cards sorted by `due_date` ascending then `created_at` descending. Status badge rendered via `LabOrderStatusBadge`. Overdue is computed client-side (`due_date < today && status !== 'received'`) and visually applies amber row tint plus red badge. `Upload Result` slot transitions to attached file pill once uploaded. When `!editable`, status toggle and upload hidden; downloads remain available.

---

## LabOrderStatusBadge
**Props:**
- `status: 'pending' | 'sent' | 'received' | 'overdue'`

**Behavior:** Pill component. Colors: pending = neutral gray, sent = blue `#0A84FF`, received = green `#30D158`, overdue = red `#FF453A`. Icon prefix per status (dot / paper-plane / check / alert). 12px text, 24px height. No interaction.

---

## ConsentDocumentList
**Props:**
- `documents: ConsentDocument[]`
- `editable: boolean`
- `onRequest()` / `onSignInChair(id)` / `onSendLink(id)` / `onUploadSigned(id, file)` / `onView(id)`

**Behavior:** Rows render document title, version, status. CTAs visible by state per the screens spec. `Send for signature` triggers parent to generate a tokenized patient-facing link and surfaces a copy-link affordance inline (text input pre-filled + copy icon). `View PDF` opens the document in a new tab. Read-only mode collapses to only `View PDF`.

---

## ConsentSignModal
**Props:**
- `open: boolean`
- `onOpenChange(open)`
- `documentId: string`
- `termsHtml: string` (sanitized)
- `onSign(signaturePngDataUrl, signerName)`

**Behavior:** Full-height modal optimized for iPad in chair. Top: scrollable terms (`termsHtml`). Bottom: signer name input + digital signature pad (HTML5 canvas; touch-optimized; supports stylus). Footer: Clear, Cancel, Sign. Sign disabled until signature pad has strokes and signer name is non-empty. On Sign, exports PNG data URL and calls `onSign`. Modal shows submitting state during upload; surfaces error inline on failure.

---

## MedicalHistoryForm
**Props:**
- `value: MedicalHistory`
- `editable: boolean`
- `onChange(value)` (controlled)
- `onSave(): Promise<void>`
- `activeVisitId?: string` (when present, disables edit mode)

**Behavior:** Accordion or stacked sections (Allergies / Medications / Systemic Conditions). Read-only by default; pencil icon enters edit mode (disabled when `activeVisitId`). Sticky footer Save/Cancel during edit. Computes a derived `safety_floor` (low / medium / high) via simple heuristic on severity counts and severe-allergy presence and surfaces it in the parent `SafetyFloorComputedBadge`. Emits `onChange` on every edit; persists only on `onSave`.

---

## AllergyTag
**Props:**
- `allergen: string`
- `severity: 'mild' | 'moderate' | 'severe'`
- `onRemove?()` (edit mode only)

**Behavior:** Pill chip. Severity colors: mild = neutral, moderate = amber, severe = red. Removable in edit mode (X affordance). Tooltip on hover shows full allergen name when truncated.

---

## SafetyFloorComputedBadge
**Props:**
- `level: 'low' | 'medium' | 'high'`
- `derivedFrom?: string[]` (reason chips: e.g. ["severe penicillin allergy", "ASA III"])

**Behavior:** Read-only badge anchored top-right of Medical History header. Color: low = green, medium = amber, high = red. Tooltip / popover lists `derivedFrom` reasons. Auto-recomputed whenever PMH value changes; debounced to avoid flicker.

---

## FileAttachmentUploader
**Props:**
- `files: Attachment[]`
- `editable: boolean`
- `accept: string[]` (mime types)
- `onUpload(file): Promise<Attachment>`
- `onDelete(id): Promise<void>`
- `onDownload(id)`

**Behavior:** Drag-drop zone hides when `!editable`. Multi-file selection allowed. Per-file upload kicks off immediately, rendered as a pending tile with progress bar; tile replaces with final attachment on success or red retry tile on failure. File list grid responsive (2 cols on iPad, 1 on phone). Delete button only visible when editable.

---

## ClinicalAmendmentLog
**Props:**
- `amendments: Amendment[]`
- `canAppend: boolean` (post-completion + correct role)
- `onAppend(text): Promise<void>`

**Behavior:** Renders append-only log (newest first), each entry timestamp + author + text. When `canAppend`, shows a textarea + button at the bottom of the section. Submit disables button + shows spinner; on success, prepends new entry and clears textarea. Never mutates prior entries.
