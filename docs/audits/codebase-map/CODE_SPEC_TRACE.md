# Code Spec Trace

<!-- oli:regen:code-spec-trace:begin -->
Spec: `specs/api/dist/openapi/openapi.json` · Matched: 237 · Spec-only: 0 · Code-only: 0 · Auth-drift: 2

| Operation | operationId | Roles | Backend | Status | Drift |
|---|---|---|---|---|---|
| `DELETE /billing/invoices/:invoice` | `deleteInvoice` | — | `deleteInvoice` | matched |  |
| `DELETE /booking/events/:event` | `deleteBookingEvent` | event:owner, admin | `deleteBookingEvent` | matched |  |
| `DELETE /booking/events/:event/exceptions/:exception` | `deleteScheduleException` | event:owner, admin | `deleteScheduleException` | matched |  |
| `DELETE /dental/appointments/:appointmentId` | `cancelAppointment` | user | `cancelAppointment` | matched |  |
| `DELETE /dental/branches/:branchId/consent-templates/:id` | `deleteConsentTemplate` | user | `deleteConsentTemplate` | matched |  |
| `DELETE /dental/imaging/findings/:findingId` | `ImagingFindingsMgmt_deleteFinding` | — | `ImagingFindingsMgmt_deleteFinding` | matched |  |
| `DELETE /dental/imaging/images/:imageId` | `ImagingMgmt_deleteImage` | — | `ImagingMgmt_deleteImage` | matched |  |
| `DELETE /dental/imaging/images/:imageId/ceph/landmarks/:landmarkCode` | `CephMgmt_deleteCephLandmark` | — | `CephMgmt_deleteCephLandmark` | matched |  |
| `DELETE /dental/imaging/measurements/:measurementId` | `ImagingMgmt_deleteMeasurement` | — | `ImagingMgmt_deleteMeasurement` | matched |  |
| `DELETE /dental/treatment-templates/:id` | `deleteTreatmentTemplate` | user | `deleteTreatmentTemplate` | matched |  |
| `DELETE /dental/visits/:visitId/attachments/:attachmentId` | `deleteAttachment` | user | `deleteAttachment` | matched |  |
| `DELETE /patients/:id` | `deactivatePatient` | admin, registrar, user | `deactivatePatient` | matched |  |
| `DELETE /providers/practitioner-roles/:id` | `deactivatePractitionerRole` | admin | `deactivatePractitionerRole` | matched |  |
| `DELETE /providers/practitioners/:id` | `deactivatePractitioner` | admin | `deactivatePractitioner` | matched |  |
| `DELETE /reviews/:review` | `deleteReview` | review:owner, admin | `deleteReview` | matched |  |
| `DELETE /storage/files/:file` | `deleteFile` | user:owner | `deleteFile` | matched |  |
| `DELETE /storage/multipart/:file/abort` | `abortMultipartUpload` | user:owner | `abortMultipartUpload` | matched |  |
| `GET /audit/logs` | `listAuditLogs` | admin, support | `listAuditLogs` | matched |  |
| `GET /billing/invoices` | `listInvoices` | — | `listInvoices` | matched |  |
| `GET /billing/invoices/:invoice` | `getInvoice` | — | `getInvoice` | matched |  |
| `GET /billing/merchant-accounts/:merchantAccount` | `getMerchantAccount` | — | `getMerchantAccount` | matched |  |
| `GET /booking/bookings` | `listBookings` | client:owner, host:owner, admin, support | `listBookings` | matched |  |
| `GET /booking/bookings/:booking` | `getBooking` | client:owner, host:owner, admin, support | `getBooking` | matched |  |
| `GET /booking/events` | `listBookingEvents` | — | `listBookingEvents` | matched |  |
| `GET /booking/events/:event` | `getBookingEvent` | — | `getBookingEvent` | matched |  |
| `GET /booking/events/:event/exceptions` | `listScheduleExceptions` | event:owner, admin, support | `listScheduleExceptions` | matched |  |
| `GET /booking/events/:event/exceptions/:exception` | `getScheduleException` | event:owner, admin, support | `getScheduleException` | matched |  |
| `GET /booking/events/:event/slots` | `listEventSlots` | — | `listEventSlots` | matched |  |
| `GET /booking/slots/:slotId` | `getTimeSlot` | — | `getTimeSlot` | matched |  |
| `GET /comms/chat-rooms` | `listChatRooms` | user:participant | `listChatRooms` | matched |  |
| `GET /comms/chat-rooms/:room` | `getChatRoom` | user:participant | `getChatRoom` | matched |  |
| `GET /comms/chat-rooms/:room/messages` | `getChatMessages` | user:participant | `getChatMessages` | matched |  |
| `GET /comms/ice-servers` | `getIceServers` | user | `getIceServers` | matched |  |
| `GET /dental/appointments` | `listAppointments` | user | `listAppointments` | matched |  |
| `GET /dental/appointments/:appointmentId` | `getAppointment` | user | `getAppointment` | matched |  |
| `GET /dental/billing/collections/summary` | `getCollectionsSummary` | user | `getCollectionsSummary` | matched |  |
| `GET /dental/billing/invoices` | `listDentalInvoices` | user | `listDentalInvoices` | matched |  |
| `GET /dental/billing/invoices/:invoiceId` | `getDentalInvoice` | user | `getDentalInvoice` | matched |  |
| `GET /dental/billing/invoices/:invoiceId/payments` | `listDentalPayments` | user | `listDentalPayments` | matched |  |
| `GET /dental/billing/invoices/:invoiceId/payments/:paymentId/receipt` | `getDentalPaymentReceipt` | user | `getDentalPaymentReceipt` | matched |  |
| `GET /dental/billing/invoices/:invoiceId/plan` | `getDentalPaymentPlan` | user | `getDentalPaymentPlan` | matched |  |
| `GET /dental/billing/patients/:patientId/balance` | `getPatientBalance` | user | `getPatientBalance` | matched |  |
| `GET /dental/branches/:branchId/consent-templates` | `listConsentTemplates` | user | `listConsentTemplates` | matched |  |
| `GET /dental/branches/:branchId/settings` | `getBranchSettings` | user | `getBranchSettings` | matched |  |
| `GET /dental/branches/:branchId/working-hours` | `getWorkingHours` | user | `getWorkingHours` | matched |  |
| `GET /dental/clinical/medical-history` | `listMedicalHistory` | user | `listMedicalHistory` | matched |  |
| `GET /dental/dashboard/summary` | `getDashboardSummary` | user | `getDashboardSummary` | matched |  |
| `GET /dental/imaging/images/:imageId/ceph/analysis` | `CephMgmt_getCephAnalysis` | — | `CephMgmt_getCephAnalysis` | matched |  |
| `GET /dental/imaging/images/:imageId/ceph/landmarks` | `CephMgmt_listCephLandmarks` | — | `CephMgmt_listCephLandmarks` | matched |  |
| `GET /dental/imaging/images/:imageId/ceph/reports` | `CephMgmt_getCephReport` | — | `CephMgmt_getCephReport` | matched |  |
| `GET /dental/imaging/images/:imageId/findings` | `ImagingFindingsMgmt_listFindings` | — | `ImagingFindingsMgmt_listFindings` | matched |  |
| `GET /dental/imaging/images/:imageId/measurements` | `ImagingMgmt_listMeasurements` | — | `ImagingMgmt_listMeasurements` | matched |  |
| `GET /dental/imaging/studies/:studyId` | `ImagingMgmt_getImagingStudy` | — | `ImagingMgmt_getImagingStudy` | matched |  |
| `GET /dental/org/context` | `getOrgContext` | user | `getOrgContext` | matched |  |
| `GET /dental/org/members` | `listMembers` | user | `listMembers` | matched |  |
| `GET /dental/organizations/:id` | `DentalOrganizationManagement_get` | — | `DentalOrganizationManagement_get` | matched |  |
| `GET /dental/organizations/:orgId/branches` | `DentalBranchManagement_list` | — | `DentalBranchManagement_list` | matched |  |
| `GET /dental/organizations/:orgId/branches/:branchId` | `DentalBranchManagement_get` | — | `DentalBranchManagement_get` | matched |  |
| `GET /dental/organizations/:orgId/branches/:branchId/members` | `DentalMembershipManagement_list` | — | `DentalMembershipManagement_list` | matched |  |
| `GET /dental/patients` | `listDentalPatients` | user | `listDentalPatients` | matched |  |
| `GET /dental/patients/:id` | `getDentalPatient` | user | `getDentalPatient` | matched |  |
| `GET /dental/patients/:id/follow-up-notes` | `listFollowUpNotes` | user | `listFollowUpNotes` | matched |  |
| `GET /dental/patients/:id/safety-floor` | `getDentalPatientSafetyFloor` | user | `getDentalPatientSafetyFloor` | matched |  |
| `GET /dental/patients/:id/statement` | `getDentalPatientStatement` | user | `getDentalPatientStatement` | matched |  |
| `GET /dental/patients/:patientId/images` | `PatientImageMgmt_listPatientImages` | — | `PatientImageMgmt_listPatientImages` | matched |  |
| `GET /dental/patients/:patientId/treatment-plan` | `getTreatmentPlan` | user | `getTreatmentPlan` | matched |  |
| `GET /dental/patients/:patientId/treatment-plan/versions/:versionId` | `getTreatmentPlanVersion` | user | `getTreatmentPlanVersion` | matched |  |
| `GET /dental/patients/:patientId/treatments` | `listPatientConditions` | user | `listPatientConditions` | matched |  |
| `GET /dental/patients/:patientId/visits` | `listPatientVisits` | user | `listPatientVisits` | matched |  |
| `GET /dental/patients/export` | `exportDentalPatients` | user | `exportDentalPatients` | matched |  |
| `GET /dental/perio-charts/:chartId` | `getPerioChart` | user | `getPerioChart` | matched |  |
| `GET /dental/pmd/imported` | `listImportedPMDs` | user | `listImportedPMDs` | matched |  |
| `GET /dental/pmd/imported/:id` | `getImportedPMD` | user | `getImportedPMD` | matched |  |
| `GET /dental/treatment-templates` | `listTreatmentTemplates` | user | `listTreatmentTemplates` | matched |  |
| `GET /dental/visits` | `listDentalVisits` | user | `listDentalVisits` | matched |  |
| `GET /dental/visits/:visitId` | `getDentalVisit` | user | `getDentalVisit` | matched |  |
| `GET /dental/visits/:visitId/amendments` | `listAmendments` | user | `listAmendments` | matched |  |
| `GET /dental/visits/:visitId/attachments` | `listAttachments` | user | `listAttachments` | matched |  |
| `GET /dental/visits/:visitId/chart` | `getDentalChart` | user | `getDentalChart` | matched |  |
| `GET /dental/visits/:visitId/consents` | `listConsentForms` | user | `listConsentForms` | matched |  |
| `GET /dental/visits/:visitId/lab-orders` | `listLabOrders` | user | `listLabOrders` | matched |  |
| `GET /dental/visits/:visitId/notes` | `getVisitNotes` | user | `getVisitNotes` | matched |  |
| `GET /dental/visits/:visitId/notes/history` | `getVisitNoteHistory` | user | `getVisitNoteHistory` | matched |  |
| `GET /dental/visits/:visitId/perio-chart` | `getVisitPerioChart` | user | `getVisitPerioChart` | matched |  |
| `GET /dental/visits/:visitId/pmd` | `getPMDForVisit` | user | `getPMDForVisit` | matched |  |
| `GET /dental/visits/:visitId/pmd/export` | `exportPMD` | user | `exportPMD` | matched |  |
| `GET /dental/visits/:visitId/prescriptions` | `listPrescriptions` | user | `listPrescriptions` | matched |  |
| `GET /dental/visits/:visitId/treatments` | `listDentalTreatments` | user | `listDentalTreatments` | matched |  |
| `GET /dental/visits/history/:patientId/teeth/:toothNumber` | `getToothHistory` | user | `getToothHistory` | matched |  |
| `GET /dental/visits/pmd` | `listPMDs` | user | `listPMDs` | matched |  |
| `GET /email/queue` | `listEmailQueueItems` | admin | `listEmailQueueItems` | matched |  |
| `GET /email/queue/:queue` | `getEmailQueueItem` | admin | `getEmailQueueItem` | matched |  |
| `GET /email/templates` | `listEmailTemplates` | admin | `listEmailTemplates` | matched |  |
| `GET /email/templates/:template` | `getEmailTemplate` | admin | `getEmailTemplate` | matched |  |
| `GET /emr/consultations` | `listConsultations` | provider, admin, patient | `listConsultations` | matched |  |
| `GET /emr/consultations/:consultation` | `getConsultation` | admin, provider:owner, patient:owner | `getConsultation` | matched |  |
| `GET /emr/patients` | `listEMRPatients` | provider, admin | `listEMRPatients` | matched |  |
| `GET /notifs` | `listNotifications` | user, admin | `listNotifications` | matched |  |
| `GET /notifs/:notif` | `getNotification` | user, admin | `getNotification` | matched |  |
| `GET /patients` | `listPatients` | admin, clinician, support, user | `listPatients` | matched |  |
| `GET /patients/:id` | `getPatient` | admin, clinician, support, user, patient:owner | `getPatient` | matched |  |
| `GET /persons` | `listPersons` | admin, support | `listPersons` | matched |  |
| `GET /persons/:person` | `getPerson` | admin, support, user:owner | `getPerson` | matched |  |
| `GET /providers/practitioner-roles` | `listPractitionerRoles` | admin, clinician, support | `listPractitionerRoles` | matched |  |
| `GET /providers/practitioner-roles/:id` | `getPractitionerRole` | admin, clinician, support, practitioner:owner | `getPractitionerRole` | matched |  |
| `GET /providers/practitioners` | `listPractitioners` | admin, clinician, support | `listPractitioners` | matched |  |
| `GET /providers/practitioners/:id` | `getPractitioner` | admin, clinician, support, practitioner:owner | `getPractitioner` | matched |  |
| `GET /reviews/` | `listReviews` | user | `listReviews` | matched |  |
| `GET /reviews/:review` | `getReview` | user | `getReview` | matched |  |
| `GET /storage/files` | `listFiles` | — | `listFiles` | matched |  |
| `GET /storage/files/:file` | `getFile` | admin, user:owner | `getFile` | matched |  |
| `GET /storage/files/:file/download` | `getFileDownload` | admin, user:owner | `getFileDownload` | matched |  |
| `GET /storage/multipart/:file/part-url` | `generateMultipartPartUrl` | user:owner | `generateMultipartPartUrl` | matched |  |
| `PATCH /billing/invoices/:invoice` | `updateInvoice` | — | `updateInvoice` | matched |  |
| `PATCH /booking/events/:event` | `updateBookingEvent` | event:owner, admin | `updateBookingEvent` | matched |  |
| `PATCH /comms/chat-rooms/:room/video-call/participant` | `updateVideoCallParticipant` | user:participant | `updateVideoCallParticipant` | matched |  |
| `PATCH /dental/appointments/:appointmentId` | `updateAppointment` | user | `updateAppointment` | matched |  |
| `PATCH /dental/billing/invoices/:invoiceId/issue` | `issueDentalInvoice` | user | `issueDentalInvoice` | matched |  |
| `PATCH /dental/branches/:branchId/consent-templates/:id` | `updateConsentTemplate` | user | `updateConsentTemplate` | matched |  |
| `PATCH /dental/clinical/medical-history/:entryId` | `updateMedicalHistoryEntry` | user | `updateMedicalHistoryEntry` | matched |  |
| `PATCH /dental/imaging/findings/:findingId` | `ImagingFindingsMgmt_updateFinding` | — | `ImagingFindingsMgmt_updateFinding` | matched |  |
| `PATCH /dental/imaging/images/:imageId/calibration` | `ImagingMgmt_updateImageCalibration` | — | `ImagingMgmt_updateImageCalibration` | matched |  |
| `PATCH /dental/imaging/images/:imageId/ceph/landmarks/:landmarkCode` | `CephMgmt_updateCephLandmark` | — | `CephMgmt_updateCephLandmark` | matched |  |
| `PATCH /dental/imaging/images/:imageId/modality` | `ImagingMgmt_updateImageModality` | — | `ImagingMgmt_updateImageModality` | matched |  |
| `PATCH /dental/organizations/:id` | `DentalOrganizationManagement_update` | — | `DentalOrganizationManagement_update` | matched |  |
| `PATCH /dental/patients/:id` | `updateDentalPatient` | user | `updateDentalPatient` | matched |  |
| `PATCH /dental/treatment-templates/:id` | `updateTreatmentTemplate` | user | `updateTreatmentTemplate` | matched |  |
| `PATCH /dental/visits/:visitId` | `updateDentalVisit` | user | `updateDentalVisit` | matched |  |
| `PATCH /dental/visits/:visitId/chart/teeth/:toothNumber` | `updateTooth` | user | `updateTooth` | matched |  |
| `PATCH /dental/visits/:visitId/lab-orders/:orderId` | `updateLabOrder` | user | `updateLabOrder` | matched |  |
| `PATCH /dental/visits/:visitId/prescriptions/:prescriptionId` | `updatePrescription` | user | `updatePrescription` | matched |  |
| `PATCH /dental/visits/:visitId/treatments/:treatmentId` | `updateDentalTreatment` | user | `updateDentalTreatment` | matched |  |
| `PATCH /email/templates/:template` | `updateEmailTemplate` | admin | `updateEmailTemplate` | matched |  |
| `PATCH /emr/consultations/:consultation` | `updateConsultation` | provider:owner | `updateConsultation` | matched |  |
| `PATCH /patients/:id` | `updatePatient` | admin, clinician, registrar, user, patient:owner | `updatePatient` | matched |  |
| `PATCH /persons/:person` | `updatePerson` | user:owner | `updatePerson` | matched |  |
| `PATCH /providers/practitioner-roles/:id` | `updatePractitionerRole` | admin, credentialing, practitioner:owner | `updatePractitionerRole` | matched |  |
| `PATCH /providers/practitioners/:id` | `updatePractitioner` | admin, credentialing, practitioner:owner | `updatePractitioner` | matched |  |
| `POST /billing/invoices` | `createInvoice` | — | `createInvoice` | matched |  |
| `POST /billing/invoices/:invoice/capture` | `captureInvoicePayment` | — | `captureInvoicePayment` | matched |  |
| `POST /billing/invoices/:invoice/finalize` | `finalizeInvoice` | — | `finalizeInvoice` | matched |  |
| `POST /billing/invoices/:invoice/mark-uncollectible` | `markInvoiceUncollectible` | — | `markInvoiceUncollectible` | matched |  |
| `POST /billing/invoices/:invoice/pay` | `payInvoice` | — | `payInvoice` | matched |  |
| `POST /billing/invoices/:invoice/refund` | `refundInvoicePayment` | — | `refundInvoicePayment` | matched |  |
| `POST /billing/invoices/:invoice/void` | `voidInvoice` | — | `voidInvoice` | matched |  |
| `POST /billing/merchant-accounts` | `createMerchantAccount` | — | `createMerchantAccount` | matched |  |
| `POST /billing/merchant-accounts/:merchantAccount/dashboard` | `getMerchantDashboard` | — | `getMerchantDashboard` | matched |  |
| `POST /billing/merchant-accounts/:merchantAccount/onboard` | `onboardMerchantAccount` | — | `onboardMerchantAccount` | matched |  |
| `POST /billing/webhooks/stripe` | `handleStripeWebhook` | — | `handleStripeWebhook` | matched |  |
| `POST /booking/bookings` | `createBooking` | user | `createBooking` | matched |  |
| `POST /booking/bookings/:booking/cancel` | `cancelBooking` | client:owner, host:owner, admin | `cancelBooking` | matched |  |
| `POST /booking/bookings/:booking/confirm` | `confirmBooking` | host:owner, admin | `confirmBooking` | matched |  |
| `POST /booking/bookings/:booking/no-show` | `markNoShowBooking` | client:owner, host:owner, admin | `markNoShowBooking` | matched |  |
| `POST /booking/bookings/:booking/reject` | `rejectBooking` | host:owner, admin | `rejectBooking` | matched |  |
| `POST /booking/events` | `createBookingEvent` | user | `createBookingEvent` | matched |  |
| `POST /booking/events/:event/exceptions` | `createScheduleException` | event:owner, admin | `createScheduleException` | matched |  |
| `POST /comms/chat-rooms` | `createChatRoom` | user | `createChatRoom` | matched |  |
| `POST /comms/chat-rooms/:room/messages` | `sendChatMessage` | user:participant | `sendChatMessage` | matched |  |
| `POST /comms/chat-rooms/:room/video-call/end` | `endVideoCall` | user:admin | `endVideoCall` | matched |  |
| `POST /comms/chat-rooms/:room/video-call/join` | `joinVideoCall` | user:participant | `joinVideoCall` | matched |  |
| `POST /comms/chat-rooms/:room/video-call/leave` | `leaveVideoCall` | user:participant | `leaveVideoCall` | matched |  |
| `POST /dental/appointments` | `createAppointment` | user | `createAppointment` | matched |  |
| `POST /dental/appointments/:appointmentId/check-in` | `checkInAppointment` | user | `checkInAppointment` | matched |  |
| `POST /dental/billing/invoices` | `createDentalInvoice` | user | `createDentalInvoice` | matched |  |
| `POST /dental/billing/invoices/:invoiceId/discount` | `applyDentalDiscount` | user | `applyDentalDiscount` | matched |  |
| `POST /dental/billing/invoices/:invoiceId/payments` | `recordDentalPayment` | user | `recordDentalPayment` | matched |  |
| `POST /dental/billing/invoices/:invoiceId/payments/:paymentId/void` | `voidDentalPayment` | user | `voidDentalPayment` | matched |  |
| `POST /dental/billing/invoices/:invoiceId/plan` | `createDentalPaymentPlan` | user | `createDentalPaymentPlan` | matched |  |
| `POST /dental/billing/invoices/:invoiceId/uncollectible` | `markUncollectible` | user | `markUncollectible` | matched |  |
| `POST /dental/billing/invoices/:invoiceId/void` | `voidDentalInvoice` | user | `voidDentalInvoice` | matched |  |
| `POST /dental/branches/:branchId/consent-templates` | `createConsentTemplate` | user | `createConsentTemplate` | matched |  |
| `POST /dental/clinical/medical-history` | `createMedicalHistoryEntry` | user | `createMedicalHistoryEntry` | matched |  |
| `POST /dental/imaging/images/:imageId/ceph/analysis/recompute` | `CephMgmt_recomputeCephAnalysis` | — | `CephMgmt_recomputeCephAnalysis` | matched |  |
| `POST /dental/imaging/images/:imageId/ceph/landmarks` | `CephMgmt_batchUpsertCephLandmarks` | — | `CephMgmt_batchUpsertCephLandmarks` | matched |  |
| `POST /dental/imaging/images/:imageId/ceph/reports` | `CephMgmt_createCephReport` | — | `CephMgmt_createCephReport` | matched |  |
| `POST /dental/imaging/images/:imageId/findings` | `ImagingFindingsMgmt_createFinding` | — | `ImagingFindingsMgmt_createFinding` | matched |  |
| `POST /dental/imaging/images/:imageId/measurements` | `ImagingMgmt_createMeasurement` | — | `ImagingMgmt_createMeasurement` | matched |  |
| `POST /dental/imaging/studies` | `ImagingMgmt_createImagingStudy` | — | `ImagingMgmt_createImagingStudy` | matched |  |
| `POST /dental/org/members` | `createMember` | user | `createMember` | matched |  |
| `POST /dental/org/members/:memberId/recover-pin` | `recoverPin` | — | `recoverPin` | matched |  |
| `POST /dental/org/members/:memberId/reset-pin` | `resetMemberPin` | user | `resetMemberPin` | matched |  |
| `POST /dental/org/members/:memberId/security-question` | `setSecurityQuestion` | user | `setSecurityQuestion` | matched |  |
| `POST /dental/organizations` | `DentalOrganizationManagement_create` | — | `DentalOrganizationManagement_create` | matched |  |
| `POST /dental/organizations/:orgId/branches` | `DentalBranchManagement_create` | — | `DentalBranchManagement_create` | matched |  |
| `POST /dental/organizations/:orgId/branches/:branchId/members` | `DentalMembershipManagement_create` | — | `DentalMembershipManagement_create` | matched |  |
| `POST /dental/organizations/:orgId/branches/:branchId/members/:membershipId/deactivate` | `DentalMembershipManagement_deactivate` | — | `DentalMembershipManagement_deactivate` | matched |  |
| `POST /dental/organizations/:orgId/branches/:branchId/members/:membershipId/set-pin` | `DentalMembershipManagement_setPin` | — | `DentalMembershipManagement_setPin` | matched |  |
| `POST /dental/organizations/:orgId/branches/:branchId/members/:membershipId/verify-pin` | `DentalMembershipManagement_verifyPin` | — | `DentalMembershipManagement_verifyPin` | matched |  |
| `POST /dental/patients` | `createDentalPatient` | user | `createDentalPatient` | matched |  |
| `POST /dental/patients/:id/archive` | `archiveDentalPatient` | user | `archiveDentalPatient` | matched |  |
| `POST /dental/patients/:id/follow-up-notes` | `addFollowUpNote` | user | `addFollowUpNote` | matched |  |
| `POST /dental/patients/:id/restore` | `restoreDentalPatient` | user | `restoreDentalPatient` | matched |  |
| `POST /dental/patients/:patientId/dentition` | `initializeDentition` | user | `initializeDentition` | matched |  |
| `POST /dental/patients/:patientId/treatment-plan/accept` | `acceptTreatmentPlan` | user | `acceptTreatmentPlan` | matched |  |
| `POST /dental/patients/bulk-archive` | `bulkArchiveDentalPatients` | user | `bulkArchiveDentalPatients` | matched |  |
| `POST /dental/patients/import` | `importPatients` | user | `importPatients` | matched |  |
| `POST /dental/perio-charts` | `createPerioChart` | user | `createPerioChart` | matched |  |
| `POST /dental/perio-charts/:chartId/complete` | `completePerioChart` | user | `completePerioChart` | matched |  |
| `POST /dental/pmd/import` | `importPMD` | user | `importPMD` | matched |  |
| `POST /dental/treatment-templates` | `createTreatmentTemplate` | user | `createTreatmentTemplate` | matched |  |
| `POST /dental/visits` | `createDentalVisit` | user | `createDentalVisit` | matched |  |
| `POST /dental/visits/:visitId/amendments` | `createAmendment` | user | `createAmendment` | matched |  |
| `POST /dental/visits/:visitId/apply-template/:templateId` | `applyTemplate` | user | `applyTemplate` | matched |  |
| `POST /dental/visits/:visitId/attachments` | `createAttachment` | user | `createAttachment` | matched |  |
| `POST /dental/visits/:visitId/carry-over` | `carryOverTreatments` | user | `carryOverTreatments` | matched |  |
| `POST /dental/visits/:visitId/chart` | `upsertDentalChart` | user | `upsertDentalChart` | matched |  |
| `POST /dental/visits/:visitId/consents` | `createConsentForm` | user | `createConsentForm` | matched |  |
| `POST /dental/visits/:visitId/consents/:consentId/sign` | `signConsentForm` | user | `signConsentForm` | matched |  |
| `POST /dental/visits/:visitId/lab-orders` | `createLabOrder` | user | `createLabOrder` | matched |  |
| `POST /dental/visits/:visitId/notes` | `upsertVisitNotes` | user | `upsertVisitNotes` | matched |  |
| `POST /dental/visits/:visitId/notes/addendum` | `createVisitNoteAddendum` | user | `createVisitNoteAddendum` | matched |  |
| `POST /dental/visits/:visitId/notes/sign` | `signVisitNotes` | user | `signVisitNotes` | matched |  |
| `POST /dental/visits/:visitId/pmd` | `generatePMD` | user | `generatePMD` | matched |  |
| `POST /dental/visits/:visitId/prescriptions` | `createPrescription` | user | `createPrescription` | matched |  |
| `POST /dental/visits/:visitId/treatments` | `createDentalTreatment` | user | `createDentalTreatment` | matched |  |
| `POST /email/queue/:queue/cancel` | `cancelEmailQueueItem` | admin | `cancelEmailQueueItem` | matched |  |
| `POST /email/queue/:queue/retry` | `retryEmailQueueItem` | admin | `retryEmailQueueItem` | matched |  |
| `POST /email/templates` | `createEmailTemplate` | admin | `createEmailTemplate` | matched |  |
| `POST /email/templates/:template/test` | `testEmailTemplate` | admin | `testEmailTemplate` | matched |  |
| `POST /emr/consultations` | `createConsultation` | provider | `createConsultation` | matched |  |
| `POST /emr/consultations/:consultation/finalize` | `finalizeConsultation` | provider:owner | `finalizeConsultation` | matched |  |
| `POST /notifs/:notif/read` | `markNotificationAsRead` | user | `markNotificationAsRead` | matched |  |
| `POST /notifs/read-all` | `markAllNotificationsAsRead` | user | `markAllNotificationsAsRead` | matched |  |
| `POST /patients` | `createPatient` | admin, clinician, registrar, user | `createPatient` | matched |  |
| `POST /patients/merge` | `mergePatients` | admin | `mergePatients` | matched | ⚠️ |
| `POST /patients/unmerge` | `unmergePatients` | admin | `unmergePatients` | matched | ⚠️ |
| `POST /persons` | `createPerson` | user | `createPerson` | matched |  |
| `POST /providers/practitioner-roles` | `createPractitionerRole` | admin, credentialing | `createPractitionerRole` | matched |  |
| `POST /providers/practitioners` | `createPractitioner` | admin, credentialing | `createPractitioner` | matched |  |
| `POST /reviews/` | `createReview` | user | `createReview` | matched |  |
| `POST /storage/files/:file/complete` | `completeFileUpload` | user:owner | `completeFileUpload` | matched |  |
| `POST /storage/files/upload` | `uploadFile` | user | `uploadFile` | matched |  |
| `POST /storage/multipart/:file/complete` | `completeMultipartUpload` | user:owner | `completeMultipartUpload` | matched |  |
| `POST /storage/multipart/initiate` | `initiateMultipartUpload` | user | `initiateMultipartUpload` | matched |  |
| `PUT /dental/branches/:branchId/settings` | `updateBranchSettings` | user | `updateBranchSettings` | matched |  |
| `PUT /dental/branches/:branchId/working-hours` | `updateWorkingHours` | user | `updateWorkingHours` | matched |  |
| `PUT /dental/perio-charts/:chartId/readings/:toothNumber` | `upsertToothReading` | user | `upsertToothReading` | matched |  |
<!-- oli:regen:code-spec-trace:end -->
