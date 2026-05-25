# Handler Modules Reference

All handler directories live under `services/api-ts/src/handlers/`. 22 module directories (the folder also contains loose test files and `metrics.ts` that are not modules).

## Base (vertical-neutral, 9)

- **person** — Generic identity/PII record (pre-role). Manages `Person` entities. Endpoints: `createPerson`, `getPerson`, `listPersons`, `updatePerson`.
- **booking** — Generic time-slot scheduling engine with schedule exceptions. Manages `Booking`, `BookingEvent`, `ScheduleException`, `TimeSlot`. Endpoints: confirm/cancel/reject/no-show booking, list event slots.
- **billing** — Generic invoicing + Stripe Connect onboarding and webhooks. Manages `Invoice`, `MerchantAccount`. Endpoints: `payInvoice`, `handleStripeWebhook`, `onboardMerchantAccount`, `refundInvoicePayment`.
- **audit** — Read-only audit log surface. Manages `AuditLog` entries. Endpoint: `listAuditLogs`.
- **notifs** — In-app notification inbox. Manages `Notification` items. Endpoints: `listNotifications`, `markNotificationAsRead`, `markAllNotificationsAsRead`.
- **comms** — Chat rooms, messages, and WebRTC video calls including WS handler. Manages `ChatRoom`, `ChatMessage`, `VideoCall`. Endpoints: `sendChatMessage`, `joinVideoCall`, `getIceServers`.
- **storage** — File uploads with S3 multipart flow. Manages `File` records. Endpoints: `initiateMultipartUpload`, `completeMultipartUpload`, `getFileDownload`.
- **email** — Outbound email queue and templated emails. Manages `EmailTemplate`, `EmailQueueItem`. Endpoints: template CRUD, `testEmailTemplate`, `retryEmailQueueItem`.
- **reviews** — Customer/practice reviews CRUD. Manages `Review`. Endpoints: `createReview`, `listReviews`, `deleteReview`.

## Healthcare core (3)

- **patient** — Generic healthcare patient lifecycle including merge/unmerge. Manages `Patient`. Endpoints: `mergePatients`, `unmergePatients`, deactivate/delete.
- **provider** — Providers, practitioners, and FHIR-style practitioner roles. Manages `Provider`, `Practitioner`, `PractitionerRole`. Endpoints: CRUD, `deactivatePractitioner`, `deactivatePractitionerRole`.
- **emr** — Consultation notes and EMR encounters with FSM finalize flow. Manages `Consultation`, EMR patient view. Endpoints: `createConsultation`, `finalizeConsultation`, `listEMRPatients`.

## Dental verticals (9)

- **dental-billing** — Dental-specific invoices, payment plans, receipts, and collections tracking. Manages `DentalInvoice`, `DentalPayment`, `PaymentPlan`. Endpoints: `recordDentalPayment`, `applyDentalDiscount`, `getCollectionsSummary`, `getPatientBalance`.
- **dental-clinical** — Clinical chart artifacts: prescriptions, lab orders, consents, medical history, attachments, amendments. Endpoints: `signConsentForm`, `createPrescription`, `createLabOrder`, `createAmendment`.
- **dental-imaging** — Imaging studies, measurements, findings, and cephalometric analysis. Manages `ImagingStudy`, `Measurement`, `Finding`, `CephLandmark`, `CephReport`. Endpoints: `recomputeCephAnalysis`, `batchUpsertCephLandmarks`, `updateImageCalibration`.
- **dental-org** — Multi-tenant org/branch/membership management with PIN-based member auth and consent templates. Manages `Organization`, `Branch`, `Membership`, working hours, consent templates. Endpoints: `setPin`/`verifyPin`/`recoverPin`, `getDashboardSummary`, `getOrgContext`, working-hours CRUD.
- **dental-patient** — Dental patient profile, dentition init, versioned treatment plans, follow-up notes, bulk import/export/archive. Manages `DentalPatient`, `TreatmentPlan`, `FollowUpNote`. Endpoints: `acceptTreatmentPlan`, `importPatients`, `bulkArchiveDentalPatients`, `getDentalPatientStatement`.
- **dental-perio** — Periodontal charting per visit and per tooth. Manages `PerioChart`, `ToothReading`. Endpoints: `createPerioChart`, `upsertToothReading`, `completePerioChart`, `getVisitPerioChart`.
- **dental-pmd** — Patient Medical Document generation, import, and export. Manages `PMD` documents. Endpoints: `generatePMD`, `importPMD`, `exportPMD`, `getPMDForVisit`.
- **dental-scheduling** — Dental appointment lifecycle FSM (check-in, cancel) and working-hours. Manages `Appointment`. Endpoints: `createAppointment`, `checkInAppointment`, `cancelAppointment`.
- **dental-visit** — Per-visit treatments, dental chart, tooth history, visit notes with addenda/signing, and treatment templates. Manages `DentalVisit`, `DentalTreatment`, `TreatmentTemplate`, `VisitNote`. Endpoints: `signVisitNotes`, `applyTemplate`, `carryOverTreatments`, `getToothHistory`.

## Infra (1)

- **shared** — Cross-handler RBAC/tenancy guards. Exports `assert-branch-access.ts` and `assert-branch-role.ts` used by other modules to enforce branch-scoped access control.

---

_Regenerate by listing `services/api-ts/src/handlers/` and re-summarizing each module's handler files and router index._
