# Code Spec Trace

<!-- oli:regen:code-spec-trace:begin -->
Spec: `specs/api/dist/openapi/openapi.json` · Matched: 352 · Spec-only: 0 · Code-only: 0 · Auth-drift: 2

| Operation | operationId | Roles | Backend | Status | Drift |
|---|---|---|---|---|---|
| `DELETE /billing/invoices/:invoice` | `deleteInvoice` | — | `deleteInvoice` | matched |  |
| `DELETE /booking/events/:event` | `deleteBookingEvent` | event:owner, admin | `deleteBookingEvent` | matched |  |
| `DELETE /booking/events/:event/exceptions/:exception` | `deleteScheduleException` | event:owner, admin | `deleteScheduleException` | matched |  |
| `DELETE /dental/appointments/:appointmentId` | `cancelAppointment` | user | `cancelAppointment` | matched |  |
| `DELETE /dental/branches/:branchId/consent-templates/:id` | `deleteConsentTemplate` | user | `deleteConsentTemplate` | matched |  |
| `DELETE /dental/households/:householdId/members/:patientId` | `removeHouseholdMember` | user | `removeHouseholdMember` | matched |  |
| `DELETE /dental/imaging/findings/:findingId` | `ImagingFindingsMgmt_deleteFinding` | — | `ImagingFindingsMgmt_deleteFinding` | matched |  |
| `DELETE /dental/imaging/images/:imageId` | `ImagingMgmt_deleteImage` | — | `ImagingMgmt_deleteImage` | matched |  |
| `DELETE /dental/imaging/images/:imageId/ceph/landmarks/:landmarkCode` | `CephMgmt_deleteCephLandmark` | — | `CephMgmt_deleteCephLandmark` | matched |  |
| `DELETE /dental/imaging/measurements/:measurementId` | `ImagingMgmt_deleteMeasurement` | — | `ImagingMgmt_deleteMeasurement` | matched |  |
| `DELETE /dental/org/members/:memberId` | `deactivateMember` | user | `deactivateMember` | matched |  |
| `DELETE /dental/patients/:patientId/contacts/:contactId` | `deletePatientContact` | user | `deletePatientContact` | matched |  |
| `DELETE /dental/patients/:patientId/treatments/:treatmentId/appointment` | `detachTreatmentAppointment` | user | `detachTreatmentAppointment` | matched |  |
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
| `GET /dental/audit-events` | `getAuditEvents` | user | `getAuditEvents` | matched |  |
| `GET /dental/billing/claims` | `listInsuranceClaims` | user | `listInsuranceClaims` | matched |  |
| `GET /dental/billing/claims/:claimId` | `getInsuranceClaim` | user | `getInsuranceClaim` | matched |  |
| `GET /dental/billing/claims/aging` | `getPayerArAging` | user | `getPayerArAging` | matched |  |
| `GET /dental/billing/collections/aging` | `getArAging` | user | `getArAging` | matched |  |
| `GET /dental/billing/collections/summary` | `getCollectionsSummary` | user | `getCollectionsSummary` | matched |  |
| `GET /dental/billing/invoices` | `listDentalInvoices` | user | `listDentalInvoices` | matched |  |
| `GET /dental/billing/invoices/:invoiceId` | `getDentalInvoice` | user | `getDentalInvoice` | matched |  |
| `GET /dental/billing/invoices/:invoiceId/payments` | `listDentalPayments` | user | `listDentalPayments` | matched |  |
| `GET /dental/billing/invoices/:invoiceId/payments/:paymentId/receipt` | `getDentalPaymentReceipt` | user | `getDentalPaymentReceipt` | matched |  |
| `GET /dental/billing/invoices/:invoiceId/plan` | `getDentalPaymentPlan` | user | `getDentalPaymentPlan` | matched |  |
| `GET /dental/billing/patients/:patientId/balance` | `getPatientBalance` | user | `getPatientBalance` | matched |  |
| `GET /dental/branches` | `getBranchesByUser` | user | `getBranchesByUser` | matched |  |
| `GET /dental/branches/:branchId/consent-templates` | `listConsentTemplates` | user | `listConsentTemplates` | matched |  |
| `GET /dental/branches/:branchId/inventory` | `listInventoryItems` | user | `listInventoryItems` | matched |  |
| `GET /dental/branches/:branchId/inventory/:itemId/adjustments` | `listInventoryAdjustments` | user | `listInventoryAdjustments` | matched |  |
| `GET /dental/branches/:branchId/postop-templates` | `listPostopTemplates` | user | `listPostopTemplates` | matched |  |
| `GET /dental/branches/:branchId/queue-board` | `listQueueBoard` | user | `listQueueBoard` | matched |  |
| `GET /dental/branches/:branchId/settings` | `getBranchSettings` | user | `getBranchSettings` | matched |  |
| `GET /dental/branches/:branchId/waitlist` | `listWaitlist` | user | `listWaitlist` | matched |  |
| `GET /dental/branches/:branchId/working-hours` | `getWorkingHours` | user | `getWorkingHours` | matched |  |
| `GET /dental/clinical/medical-history` | `listMedicalHistory` | user | `listMedicalHistory` | matched |  |
| `GET /dental/clinical/medical-history-review` | `getMedicalHistoryReview` | user | `getMedicalHistoryReview` | matched |  |
| `GET /dental/dashboard/summary` | `getDashboardSummary` | user | `getDashboardSummary` | matched |  |
| `GET /dental/erasure-requests` | `listErasureRequests` | user | `listErasureRequests` | matched |  |
| `GET /dental/erasure-requests/:id` | `getErasureRequest` | user | `getErasureRequest` | matched |  |
| `GET /dental/fee-schedule` | `getFeeSchedule` | user | `getFeeSchedule` | matched |  |
| `GET /dental/households/:householdId` | `getHousehold` | user | `getHousehold` | matched |  |
| `GET /dental/imaging/ceph/superimpositions/:superimpositionId` | `CephMgmt_getCephSuperimposition` | — | `CephMgmt_getCephSuperimposition` | matched |  |
| `GET /dental/imaging/images/:imageId/ceph/analysis` | `CephMgmt_getCephAnalysis` | — | `CephMgmt_getCephAnalysis` | matched |  |
| `GET /dental/imaging/images/:imageId/ceph/landmarks` | `CephMgmt_listCephLandmarks` | — | `CephMgmt_listCephLandmarks` | matched |  |
| `GET /dental/imaging/images/:imageId/ceph/landmarks/detect/:jobId` | `CephMgmt_getCephLandmarkDetectionJob` | — | `CephMgmt_getCephLandmarkDetectionJob` | matched |  |
| `GET /dental/imaging/images/:imageId/ceph/reports` | `CephMgmt_getCephReport` | — | `CephMgmt_getCephReport` | matched |  |
| `GET /dental/imaging/images/:imageId/findings` | `ImagingFindingsMgmt_listFindings` | — | `ImagingFindingsMgmt_listFindings` | matched |  |
| `GET /dental/imaging/images/:imageId/measurements` | `ImagingMgmt_listMeasurements` | — | `ImagingMgmt_listMeasurements` | matched |  |
| `GET /dental/imaging/patients/:patientId/ceph/superimpositions` | `CephMgmt_listCephSuperimpositions` | — | `CephMgmt_listCephSuperimpositions` | matched |  |
| `GET /dental/imaging/studies/:studyId` | `ImagingMgmt_getImagingStudy` | — | `ImagingMgmt_getImagingStudy` | matched |  |
| `GET /dental/imaging/studies/:studyId/cbct/viewer-link` | `ImagingMgmt_getCbctViewerLink` | — | `ImagingMgmt_getCbctViewerLink` | matched |  |
| `GET /dental/legal-holds` | `listLegalHolds` | user | `listLegalHolds` | matched |  |
| `GET /dental/org/context` | `getOrgContext` | user | `getOrgContext` | matched |  |
| `GET /dental/org/members` | `listMembers` | user | `listMembers` | matched |  |
| `GET /dental/org/permissions` | `getPermissionGrid` | user | `getPermissionGrid` | matched |  |
| `GET /dental/organizations/:id` | `DentalOrganizationManagement_get` | — | `DentalOrganizationManagement_get` | matched |  |
| `GET /dental/organizations/:orgId/branches` | `DentalBranchManagement_list` | — | `DentalBranchManagement_list` | matched |  |
| `GET /dental/organizations/:orgId/branches/:branchId` | `DentalBranchManagement_get` | — | `DentalBranchManagement_get` | matched |  |
| `GET /dental/organizations/:orgId/branches/:branchId/members` | `DentalMembershipManagement_list` | — | `DentalMembershipManagement_list` | matched |  |
| `GET /dental/patients` | `listDentalPatients` | user | `listDentalPatients` | matched |  |
| `GET /dental/patients/:id` | `getDentalPatient` | user | `getDentalPatient` | matched |  |
| `GET /dental/patients/:id/follow-up-notes` | `listFollowUpNotes` | user | `listFollowUpNotes` | matched |  |
| `GET /dental/patients/:id/safety-floor` | `getDentalPatientSafetyFloor` | user | `getDentalPatientSafetyFloor` | matched |  |
| `GET /dental/patients/:id/statement` | `getDentalPatientStatement` | user | `getDentalPatientStatement` | matched |  |
| `GET /dental/patients/:patientId/authorizations` | `listCoverageAuthorizations` | user | `listCoverageAuthorizations` | matched |  |
| `GET /dental/patients/:patientId/case-presentations` | `listCasePresentations` | user | `listCasePresentations` | matched |  |
| `GET /dental/patients/:patientId/case-presentations/:presentationId` | `getCasePresentation` | user | `getCasePresentation` | matched |  |
| `GET /dental/patients/:patientId/claims` | `listPatientClaims` | user | `listPatientClaims` | matched |  |
| `GET /dental/patients/:patientId/claims/:claimId/readiness` | `getClaimReadiness` | user | `getClaimReadiness` | matched |  |
| `GET /dental/patients/:patientId/communication-consent` | `getPatientCommunicationConsent` | user | `getPatientCommunicationConsent` | matched |  |
| `GET /dental/patients/:patientId/contacts` | `listPatientContacts` | user | `listPatientContacts` | matched |  |
| `GET /dental/patients/:patientId/dental-alerts` | `listDentalAlerts` | user | `listDentalAlerts` | matched |  |
| `GET /dental/patients/:patientId/household` | `getPatientHousehold` | user | `getPatientHousehold` | matched |  |
| `GET /dental/patients/:patientId/images` | `PatientImageMgmt_listPatientImages` | — | `PatientImageMgmt_listPatientImages` | matched |  |
| `GET /dental/patients/:patientId/insurance-profiles` | `listPatientInsuranceProfiles` | user | `listPatientInsuranceProfiles` | matched |  |
| `GET /dental/patients/:patientId/occlusion-screenings` | `listOcclusionScreenings` | user | `listOcclusionScreenings` | matched |  |
| `GET /dental/patients/:patientId/recalls` | `listPatientRecalls` | user | `listPatientRecalls` | matched |  |
| `GET /dental/patients/:patientId/tasks` | `listPatientTasks` | user | `listPatientTasks` | matched |  |
| `GET /dental/patients/:patientId/treatment-options/:optionGroupId` | `listTreatmentOptionGroup` | user | `listTreatmentOptionGroup` | matched |  |
| `GET /dental/patients/:patientId/treatment-plan` | `getTreatmentPlan` | user | `getTreatmentPlan` | matched |  |
| `GET /dental/patients/:patientId/treatment-plan/versions/:versionId` | `getTreatmentPlanVersion` | user | `getTreatmentPlanVersion` | matched |  |
| `GET /dental/patients/:patientId/treatment-plans` | `listPatientTreatmentPlans` | user | `listPatientTreatmentPlans` | matched |  |
| `GET /dental/patients/:patientId/treatment-plans/:planId/status-history` | `listTreatmentPlanStatusHistory` | user | `listTreatmentPlanStatusHistory` | matched |  |
| `GET /dental/patients/:patientId/treatments` | `listPatientConditions` | user | `listPatientConditions` | matched |  |
| `GET /dental/patients/:patientId/visits` | `listPatientVisits` | user | `listPatientVisits` | matched |  |
| `GET /dental/patients/duplicates` | `detectDuplicatePatients` | user | `detectDuplicatePatients` | matched |  |
| `GET /dental/patients/export` | `exportDentalPatients` | user | `exportDentalPatients` | matched |  |
| `GET /dental/perio-charts/:chartId` | `getPerioChart` | user | `getPerioChart` | matched |  |
| `GET /dental/pmd/imported` | `listImportedPMDs` | user | `listImportedPMDs` | matched |  |
| `GET /dental/pmd/imported/:id` | `getImportedPMD` | user | `getImportedPMD` | matched |  |
| `GET /dental/pmd/patient/:patientId/care-record` | `exportPatientCareRecord` | user | `exportPatientCareRecord` | matched |  |
| `GET /dental/public/bookings/:confirmationCode` | `getOnlineBooking` | — | `getOnlineBooking` | matched |  |
| `GET /dental/public/branches/:branchId/availability` | `getPublicAvailability` | — | `getPublicAvailability` | matched |  |
| `GET /dental/public/branches/:branchId/booking-config` | `getPublicBookingConfig` | — | `getPublicBookingConfig` | matched |  |
| `GET /dental/recalls/due` | `listDueRecalls` | user | `listDueRecalls` | matched |  |
| `GET /dental/sync-logs` | `listSyncLogs` | user | `listSyncLogs` | matched |  |
| `GET /dental/treatment-templates` | `listTreatmentTemplates` | user | `listTreatmentTemplates` | matched |  |
| `GET /dental/visits` | `listDentalVisits` | user | `listDentalVisits` | matched |  |
| `GET /dental/visits/:visitId` | `getDentalVisit` | user | `getDentalVisit` | matched |  |
| `GET /dental/visits/:visitId/amendments` | `listAmendments` | user | `listAmendments` | matched |  |
| `GET /dental/visits/:visitId/attachments` | `listAttachments` | user | `listAttachments` | matched |  |
| `GET /dental/visits/:visitId/chart` | `getDentalChart` | user | `getDentalChart` | matched |  |
| `GET /dental/visits/:visitId/consent-refusals` | `listConsentRefusals` | user | `listConsentRefusals` | matched |  |
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
| `PATCH /dental/billing/claims/:claimId/lines/:lineId` | `updateInsuranceClaimLine` | user | `updateInsuranceClaimLine` | matched |  |
| `PATCH /dental/billing/claims/:claimId/status` | `updateInsuranceClaimStatus` | user | `updateInsuranceClaimStatus` | matched |  |
| `PATCH /dental/billing/invoices/:invoiceId/issue` | `issueDentalInvoice` | user | `issueDentalInvoice` | matched |  |
| `PATCH /dental/branches/:branchId/consent-templates/:id` | `updateConsentTemplate` | user | `updateConsentTemplate` | matched |  |
| `PATCH /dental/branches/:branchId/inventory/:itemId` | `updateInventoryItem` | user | `updateInventoryItem` | matched |  |
| `PATCH /dental/branches/:branchId/postop-templates/:templateId` | `updatePostopTemplate` | user | `updatePostopTemplate` | matched |  |
| `PATCH /dental/clinical/medical-history/:entryId` | `updateMedicalHistoryEntry` | user | `updateMedicalHistoryEntry` | matched |  |
| `PATCH /dental/fee-schedule/:cdt` | `updateFeeScheduleEntry` | user | `updateFeeScheduleEntry` | matched |  |
| `PATCH /dental/imaging/findings/:findingId` | `ImagingFindingsMgmt_updateFinding` | — | `ImagingFindingsMgmt_updateFinding` | matched |  |
| `PATCH /dental/imaging/images/:imageId/calibration` | `ImagingMgmt_updateImageCalibration` | — | `ImagingMgmt_updateImageCalibration` | matched |  |
| `PATCH /dental/imaging/images/:imageId/ceph/landmarks/:landmarkCode` | `CephMgmt_updateCephLandmark` | — | `CephMgmt_updateCephLandmark` | matched |  |
| `PATCH /dental/imaging/images/:imageId/modality` | `ImagingMgmt_updateImageModality` | — | `ImagingMgmt_updateImageModality` | matched |  |
| `PATCH /dental/org/members/:memberId` | `updateMember` | user | `updateMember` | matched |  |
| `PATCH /dental/organizations/:id` | `DentalOrganizationManagement_update` | — | `DentalOrganizationManagement_update` | matched |  |
| `PATCH /dental/patients/:id` | `updateDentalPatient` | user | `updateDentalPatient` | matched |  |
| `PATCH /dental/patients/:patientId/authorizations/:authorizationId/status` | `updateCoverageAuthorizationStatus` | user | `updateCoverageAuthorizationStatus` | matched |  |
| `PATCH /dental/patients/:patientId/claims/:claimId/status` | `updateClaimStatus` | user | `updateClaimStatus` | matched |  |
| `PATCH /dental/patients/:patientId/communication-consent` | `updatePatientCommunicationConsent` | user | `updatePatientCommunicationConsent` | matched |  |
| `PATCH /dental/patients/:patientId/contacts/:contactId` | `updatePatientContact` | user | `updatePatientContact` | matched |  |
| `PATCH /dental/patients/:patientId/dental-alerts/:alertId` | `updateDentalAlert` | user | `updateDentalAlert` | matched |  |
| `PATCH /dental/patients/:patientId/insurance-profiles/:profileId` | `updateInsuranceProfile` | user | `updateInsuranceProfile` | matched |  |
| `PATCH /dental/patients/:patientId/recalls/:recallId` | `updateRecall` | user | `updateRecall` | matched |  |
| `PATCH /dental/patients/:patientId/tasks/:taskId` | `updateTask` | user | `updateTask` | matched |  |
| `PATCH /dental/patients/:patientId/treatment-plans/:planId` | `updateTreatmentPlan` | user | `updateTreatmentPlan` | matched |  |
| `PATCH /dental/queue-items/:itemId/status` | `updateQueueItemStatus` | user | `updateQueueItemStatus` | matched |  |
| `PATCH /dental/sync-logs/:logId` | `updateSyncLog` | user | `updateSyncLog` | matched |  |
| `PATCH /dental/treatment-templates/:id` | `updateTreatmentTemplate` | user | `updateTreatmentTemplate` | matched |  |
| `PATCH /dental/visits/:visitId` | `updateDentalVisit` | user | `updateDentalVisit` | matched |  |
| `PATCH /dental/visits/:visitId/chart/teeth/:toothNumber` | `updateTooth` | user | `updateTooth` | matched |  |
| `PATCH /dental/visits/:visitId/consents/:cid/revoke` | `revokeConsentForm` | user | `revokeConsentForm` | matched |  |
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
| `POST /dental/appointments/:appointmentId/confirm` | `confirmAppointment` | user | `confirmAppointment` | matched |  |
| `POST /dental/appointments/:appointmentId/queue-item` | `createQueueItem` | user | `createQueueItem` | matched |  |
| `POST /dental/billing/claims` | `createInsuranceClaim` | user | `createInsuranceClaim` | matched |  |
| `POST /dental/billing/claims/:claimId/lines` | `addInsuranceClaimLine` | user | `addInsuranceClaimLine` | matched |  |
| `POST /dental/billing/claims/:claimId/remittance` | `recordClaimRemittance` | user | `recordClaimRemittance` | matched |  |
| `POST /dental/billing/estimate` | `estimateClaimCoverage` | user | `estimateClaimCoverage` | matched |  |
| `POST /dental/billing/invoices` | `createDentalInvoice` | user | `createDentalInvoice` | matched |  |
| `POST /dental/billing/invoices/:invoiceId/discount` | `applyDentalDiscount` | user | `applyDentalDiscount` | matched |  |
| `POST /dental/billing/invoices/:invoiceId/payments` | `recordDentalPayment` | user | `recordDentalPayment` | matched |  |
| `POST /dental/billing/invoices/:invoiceId/payments/:paymentId/void` | `voidDentalPayment` | user | `voidDentalPayment` | matched |  |
| `POST /dental/billing/invoices/:invoiceId/plan` | `createDentalPaymentPlan` | user | `createDentalPaymentPlan` | matched |  |
| `POST /dental/billing/invoices/:invoiceId/uncollectible` | `markUncollectible` | user | `markUncollectible` | matched |  |
| `POST /dental/billing/invoices/:invoiceId/void` | `voidDentalInvoice` | user | `voidDentalInvoice` | matched |  |
| `POST /dental/billing/statements/batch` | `generateStatementBatch` | user | `generateStatementBatch` | matched |  |
| `POST /dental/branches/:branchId/consent-templates` | `createConsentTemplate` | user | `createConsentTemplate` | matched |  |
| `POST /dental/branches/:branchId/inventory` | `createInventoryItem` | user | `createInventoryItem` | matched |  |
| `POST /dental/branches/:branchId/inventory/:itemId/adjustments` | `createInventoryAdjustment` | user | `createInventoryAdjustment` | matched |  |
| `POST /dental/branches/:branchId/postop-templates` | `createPostopTemplate` | user | `createPostopTemplate` | matched |  |
| `POST /dental/branches/:branchId/waitlist` | `createWaitlistEntry` | user | `createWaitlistEntry` | matched |  |
| `POST /dental/clinical/medical-history` | `createMedicalHistoryEntry` | user | `createMedicalHistoryEntry` | matched |  |
| `POST /dental/clinical/medical-history-review` | `recordMedicalHistoryReview` | user | `recordMedicalHistoryReview` | matched |  |
| `POST /dental/erasure-requests` | `requestErasure` | user | `requestErasure` | matched |  |
| `POST /dental/erasure-requests/:id/approve` | `approveErasure` | user | `approveErasure` | matched |  |
| `POST /dental/erasure-requests/:id/reject` | `rejectErasure` | user | `rejectErasure` | matched |  |
| `POST /dental/households` | `createHousehold` | user | `createHousehold` | matched |  |
| `POST /dental/households/:householdId/members` | `addHouseholdMember` | user | `addHouseholdMember` | matched |  |
| `POST /dental/imaging/ceph/superimpositions` | `CephMgmt_createCephSuperimposition` | — | `CephMgmt_createCephSuperimposition` | matched |  |
| `POST /dental/imaging/ceph/superimpositions/preview` | `CephMgmt_previewCephSuperimposition` | — | `CephMgmt_previewCephSuperimposition` | matched |  |
| `POST /dental/imaging/images/:imageId/ceph/analysis/recompute` | `CephMgmt_recomputeCephAnalysis` | — | `CephMgmt_recomputeCephAnalysis` | matched |  |
| `POST /dental/imaging/images/:imageId/ceph/landmarks` | `CephMgmt_batchUpsertCephLandmarks` | — | `CephMgmt_batchUpsertCephLandmarks` | matched |  |
| `POST /dental/imaging/images/:imageId/ceph/landmarks/detect` | `CephMgmt_detectCephLandmarks` | — | `CephMgmt_detectCephLandmarks` | matched |  |
| `POST /dental/imaging/images/:imageId/ceph/reports` | `CephMgmt_createCephReport` | — | `CephMgmt_createCephReport` | matched |  |
| `POST /dental/imaging/images/:imageId/findings` | `ImagingFindingsMgmt_createFinding` | — | `ImagingFindingsMgmt_createFinding` | matched |  |
| `POST /dental/imaging/images/:imageId/measurements` | `ImagingMgmt_createMeasurement` | — | `ImagingMgmt_createMeasurement` | matched |  |
| `POST /dental/imaging/studies` | `ImagingMgmt_createImagingStudy` | — | `ImagingMgmt_createImagingStudy` | matched |  |
| `POST /dental/imaging/studies/:studyId/cbct/finalize` | `ImagingMgmt_finalizeCbctStudy` | — | `ImagingMgmt_finalizeCbctStudy` | matched |  |
| `POST /dental/legal-holds` | `placeLegalHold` | user | `placeLegalHold` | matched |  |
| `POST /dental/legal-holds/:id/release` | `releaseLegalHold` | user | `releaseLegalHold` | matched |  |
| `POST /dental/onboarding` | `createOnboarding` | — | `createOnboarding` | matched |  |
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
| `POST /dental/patients/:patientId/authorizations` | `createCoverageAuthorization` | user | `createCoverageAuthorization` | matched |  |
| `POST /dental/patients/:patientId/case-presentations` | `createCasePresentation` | user | `createCasePresentation` | matched |  |
| `POST /dental/patients/:patientId/case-presentations/:presentationId/accept` | `acceptCasePresentation` | user | `acceptCasePresentation` | matched |  |
| `POST /dental/patients/:patientId/case-presentations/:presentationId/reject` | `rejectCasePresentation` | user | `rejectCasePresentation` | matched |  |
| `POST /dental/patients/:patientId/claims` | `createClaimDraft` | user | `createClaimDraft` | matched |  |
| `POST /dental/patients/:patientId/contacts` | `createPatientContact` | user | `createPatientContact` | matched |  |
| `POST /dental/patients/:patientId/dental-alerts` | `createDentalAlert` | user | `createDentalAlert` | matched |  |
| `POST /dental/patients/:patientId/dentition` | `initializeDentition` | user | `initializeDentition` | matched |  |
| `POST /dental/patients/:patientId/insurance-profiles` | `createInsuranceProfile` | user | `createInsuranceProfile` | matched |  |
| `POST /dental/patients/:patientId/occlusion-screenings` | `createOcclusionScreening` | user | `createOcclusionScreening` | matched |  |
| `POST /dental/patients/:patientId/recalls` | `createRecall` | user | `createRecall` | matched |  |
| `POST /dental/patients/:patientId/tasks` | `createTask` | user | `createTask` | matched |  |
| `POST /dental/patients/:patientId/treatment-options/:optionGroupId/accept` | `acceptTreatmentOption` | user | `acceptTreatmentOption` | matched |  |
| `POST /dental/patients/:patientId/treatment-plan/accept` | `acceptTreatmentPlan` | user | `acceptTreatmentPlan` | matched |  |
| `POST /dental/patients/:patientId/treatment-plans` | `createTreatmentPlan` | user | `createTreatmentPlan` | matched |  |
| `POST /dental/patients/:patientId/treatment-plans/:planId/approval` | `approveTreatmentPlan` | user | `approveTreatmentPlan` | matched |  |
| `POST /dental/patients/:patientId/treatments/:treatmentId/appointment` | `attachTreatmentAppointment` | user | `attachTreatmentAppointment` | matched |  |
| `POST /dental/patients/bulk-archive` | `bulkArchiveDentalPatients` | user | `bulkArchiveDentalPatients` | matched |  |
| `POST /dental/patients/import` | `importPatients` | user | `importPatients` | matched |  |
| `POST /dental/perio-charts` | `createPerioChart` | user | `createPerioChart` | matched |  |
| `POST /dental/perio-charts/:chartId/complete` | `completePerioChart` | user | `completePerioChart` | matched |  |
| `POST /dental/pmd/import` | `importPMD` | user | `importPMD` | matched |  |
| `POST /dental/public/appointments/:appointmentId/confirm/:token` | `confirmAppointmentByToken` | — | `confirmAppointmentByToken` | matched |  |
| `POST /dental/public/branches/:branchId/bookings` | `createOnlineBooking` | — | `createOnlineBooking` | matched |  |
| `POST /dental/public/branches/:branchId/holds` | `createBookingHold` | — | `createBookingHold` | matched |  |
| `POST /dental/sync-logs` | `createSyncLog` | user | `createSyncLog` | matched |  |
| `POST /dental/treatment-templates` | `createTreatmentTemplate` | user | `createTreatmentTemplate` | matched |  |
| `POST /dental/visits` | `createDentalVisit` | user | `createDentalVisit` | matched |  |
| `POST /dental/visits/:visitId/amendments` | `createAmendment` | user | `createAmendment` | matched |  |
| `POST /dental/visits/:visitId/amendments/:amendmentId/approve` | `approveAmendment` | user | `approveAmendment` | matched |  |
| `POST /dental/visits/:visitId/apply-template/:templateId` | `applyTemplate` | user | `applyTemplate` | matched |  |
| `POST /dental/visits/:visitId/attachments` | `createAttachment` | user | `createAttachment` | matched |  |
| `POST /dental/visits/:visitId/carry-over` | `carryOverTreatments` | user | `carryOverTreatments` | matched |  |
| `POST /dental/visits/:visitId/chart` | `upsertDentalChart` | user | `upsertDentalChart` | matched |  |
| `POST /dental/visits/:visitId/consent-refusals` | `recordConsentRefusal` | user | `recordConsentRefusal` | matched |  |
| `POST /dental/visits/:visitId/consents` | `createConsentForm` | user | `createConsentForm` | matched |  |
| `POST /dental/visits/:visitId/consents/:consentId/sign` | `signConsentForm` | user | `signConsentForm` | matched |  |
| `POST /dental/visits/:visitId/lab-orders` | `createLabOrder` | user | `createLabOrder` | matched |  |
| `POST /dental/visits/:visitId/notes` | `upsertVisitNotes` | user | `upsertVisitNotes` | matched |  |
| `POST /dental/visits/:visitId/notes/addendum` | `createVisitNoteAddendum` | user | `createVisitNoteAddendum` | matched |  |
| `POST /dental/visits/:visitId/notes/sign` | `signVisitNotes` | user | `signVisitNotes` | matched |  |
| `POST /dental/visits/:visitId/pmd` | `generatePMD` | user | `generatePMD` | matched |  |
| `POST /dental/visits/:visitId/prescriptions` | `createPrescription` | user | `createPrescription` | matched |  |
| `POST /dental/visits/:visitId/treatments` | `createDentalTreatment` | user | `createDentalTreatment` | matched |  |
| `POST /dental/waitlist/:entryId/promote` | `promoteWaitlistEntry` | user | `promoteWaitlistEntry` | matched |  |
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
| `PUT /dental/org/permissions` | `updatePermissions` | user | `updatePermissions` | matched |  |
| `PUT /dental/perio-charts/:chartId/readings/:toothNumber` | `upsertToothReading` | user | `upsertToothReading` | matched |  |
<!-- oli:regen:code-spec-trace:end -->
