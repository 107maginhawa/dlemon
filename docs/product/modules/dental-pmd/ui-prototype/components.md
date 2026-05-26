# Components — dental-pmd
<!-- oli: v3-dentalemon | dental-pmd | ui-prototype -->

All components live in `apps/dentalemon/src/components/pmd/` and consume Radix primitives from `apps/dentalemon/src/components/ui/`. SF Pro font; surfaces white on `#F2F2F7`; lemon `#FFE97D` for emphasis accents only (never as a background for content). 44px minimum touch targets on actionable elements.

---

## PMDListTable

**Props:**
- `pmds: PMD[]` — rows to render
- `variant: 'generated' | 'imported'` — controls column set
- `onDownload(pmdId: string): void`
- `onRowClick(pmdId: string): void`
- `loading?: boolean`
- `emptyState?: ReactNode`

**Behavior:**
- Renders a Radix Table; columns differ by `variant` (generated shows `visit_date, generated_at, generated_by`; imported shows `source_system, record_date, imported_at, imported_by`)
- Row click navigates to PMD Detail; row-level `Download` button stops propagation
- Sortable by date columns (default: date desc)
- Shows `ChecksumBadge` and `ImportedPMDBadge` inline per row
- Patient role: column `generated_by` / `imported_by` hidden via prop `hideActorColumn`
- Skeleton state when `loading`; renders `emptyState` if `pmds.length === 0`

---

## ChecksumBadge

**Props:**
- `status: 'verified' | 'unverified' | 'failed'`
- `lastVerifiedAt?: string`
- `size?: 'sm' | 'md'` (default `sm`)

**Behavior:**
- Visual mapping: verified = green (`#34C759` text on light green tint), unverified = orange (`#FF9F0A`), failed = red (`#FF3B30`)
- Tooltip on hover shows `lastVerifiedAt` formatted relative ("Verified 3 minutes ago") and the full status reason
- Inline-flex with leading icon (Radix `CheckIcon` / `ExclamationTriangleIcon` / `CrossCircledIcon`)
- Read-only visual; no click handler

---

## ImportedPMDBadge

**Props:**
- `sourceSystem: string`
- `recordDate?: string`

**Behavior:**
- Pill chip with neutral gray surface and "Imported" prefix, then `sourceSystem`
- Tooltip exposes `recordDate` when provided
- Always paired with `ChecksumBadge` to communicate verification status

---

## PMDPreviewDocument

**Props:**
- `pmd: PMDFull` (patient header, visit summary, treatments, soap, attachments, medications, checksum)
- `mode: 'screen' | 'print'`
- `actorVisibility: 'full' | 'redacted'` — `redacted` is used for the patient role

**Behavior:**
- Renders a structured, read-only document with these sections in order: Patient Header (name, DOB, patient ID), Visit Summary (date, branch, treating dentist when `actorVisibility=full`), Treatments Performed (table of code, tooth, surface, status, fee), SOAP (Subjective, Objective, Assessment, Plan; signed timestamp), Clinical Attachments (filename, type, captured-at; no inline previews), Medications (drug, dose, route, prescriber when full), Checksum Footer (hash, generated_at, generated_by when full)
- Uses semantic headings (`h2`/`h3`) for screen readers
- `mode='print'` applies print stylesheet (no toolbar, page breaks before each major section)
- Never exposes edit affordances

---

## ImportPMDDialog

**Props:**
- `patientId: string`
- `open: boolean`
- `onOpenChange(open: boolean): void`
- `onImported(pmdId: string): void`

**Behavior:**
- Stepper: Upload → Verify → Preview → Confirm
- Validates file: extension `.json` or `.pdf`, size <= 25 MB; rejects otherwise with inline error
- Computes/parses checksum on upload; sets internal `verificationStatus`
- If `verificationStatus = 'mismatch'`, primary CTA mutates to `Import as Unverified` and shows persistent warning callout
- Calls `POST /api/dental-pmd/imports` on confirm; on success closes dialog, fires `onImported`, toasts result
- Cancel at any step closes the dialog and discards in-memory state

---

## GeneratePMDDialog

**Props:**
- `visitId: string`
- `open: boolean`
- `onOpenChange(open: boolean): void`
- `onGenerated(pmdId: string): void`

**Behavior:**
- Loads visit summary when opened
- Disables primary CTA when `visit.soap_signed === false` or `visit.status !== 'completed'`; surfaces precise reason text
- On confirm: POST `/api/dental-pmd/generate`, shows in-dialog spinner overlay, then success state with `Download Now` and `View PMD`
- If a PMD already exists for the visit, shows the "Already exists" state with a link instead of the confirm CTA

---

## PMDDownloadButton

**Props:**
- `pmdId: string`
- `filename?: string`
- `variant?: 'primary' | 'ghost'`
- `onDownloaded?(): void`

**Behavior:**
- Triggers `GET /api/dental-pmd/{id}/pdf` with browser-native download
- Shows inline spinner while download is in-flight (min 250 ms to avoid flicker)
- Fires `pmd.downloaded` analytics event on success
- 44px tall to meet touch target requirement

---

## PMDVerificationPanel

**Props:**
- `checksum: string`
- `generatedAt: string`
- `generatedBy?: { id: string; name?: string }` — omitted for patient role
- `lastVerifiedAt?: string`
- `onReverify(): Promise<{ status: 'verified' | 'failed' }>`

**Behavior:**
- Displays the SHA hash in a monospace block with a Radix-styled copy button (copies hash to clipboard, toasts "Hash copied")
- `Re-verify` button calls `onReverify`; while pending shows spinner; on result updates `ChecksumBadge` and `lastVerifiedAt` in place
- All content read-only; never offers edit controls

---

## ImportedReadOnlyBanner

**Props:**
- `sourceSystem: string`
- `importedAt: string`

**Behavior:**
- Slim banner shown above the document body when viewing an imported PMD
- Neutral gray surface, leading info icon, copy: "Imported from {sourceSystem} on {importedAt}. Read-only."
- Non-dismissible

---

## EmptyStatePanel (shared inside module)

**Props:**
- `title: string`
- `body: string`
- `cta?: { label: string; onClick(): void }`

**Behavior:**
- Centered card content with icon, title, body, optional CTA
- Used by PMD List when no PMDs exist
