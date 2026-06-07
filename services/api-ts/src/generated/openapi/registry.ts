/**
 * Handler registry - maps operationIds to handler functions
 * This file is regenerated on each run
 */

import { listAuditLogs } from '../../handlers/audit/listAuditLogs';
import { captureInvoicePayment } from '../../handlers/billing/captureInvoicePayment';
import { createInvoice } from '../../handlers/billing/createInvoice';
import { createMerchantAccount } from '../../handlers/billing/createMerchantAccount';
import { deleteInvoice } from '../../handlers/billing/deleteInvoice';
import { finalizeInvoice } from '../../handlers/billing/finalizeInvoice';
import { getInvoice } from '../../handlers/billing/getInvoice';
import { getMerchantAccount } from '../../handlers/billing/getMerchantAccount';
import { getMerchantDashboard } from '../../handlers/billing/getMerchantDashboard';
import { handleStripeWebhook } from '../../handlers/billing/handleStripeWebhook';
import { listInvoices } from '../../handlers/billing/listInvoices';
import { markInvoiceUncollectible } from '../../handlers/billing/markInvoiceUncollectible';
import { onboardMerchantAccount } from '../../handlers/billing/onboardMerchantAccount';
import { payInvoice } from '../../handlers/billing/payInvoice';
import { refundInvoicePayment } from '../../handlers/billing/refundInvoicePayment';
import { updateInvoice } from '../../handlers/billing/updateInvoice';
import { voidInvoice } from '../../handlers/billing/voidInvoice';
import { cancelBooking } from '../../handlers/booking/cancelBooking';
import { confirmBooking } from '../../handlers/booking/confirmBooking';
import { createBooking } from '../../handlers/booking/createBooking';
import { createBookingEvent } from '../../handlers/booking/createBookingEvent';
import { createScheduleException } from '../../handlers/booking/createScheduleException';
import { deleteBookingEvent } from '../../handlers/booking/deleteBookingEvent';
import { deleteScheduleException } from '../../handlers/booking/deleteScheduleException';
import { getBooking } from '../../handlers/booking/getBooking';
import { getBookingEvent } from '../../handlers/booking/getBookingEvent';
import { getScheduleException } from '../../handlers/booking/getScheduleException';
import { getTimeSlot } from '../../handlers/booking/getTimeSlot';
import { listBookingEvents } from '../../handlers/booking/listBookingEvents';
import { listBookings } from '../../handlers/booking/listBookings';
import { listEventSlots } from '../../handlers/booking/listEventSlots';
import { listScheduleExceptions } from '../../handlers/booking/listScheduleExceptions';
import { markNoShowBooking } from '../../handlers/booking/markNoShowBooking';
import { rejectBooking } from '../../handlers/booking/rejectBooking';
import { updateBookingEvent } from '../../handlers/booking/updateBookingEvent';
import { createChatRoom } from '../../handlers/comms/createChatRoom';
import { endVideoCall } from '../../handlers/comms/endVideoCall';
import { getChatMessages } from '../../handlers/comms/getChatMessages';
import { getChatRoom } from '../../handlers/comms/getChatRoom';
import { getIceServers } from '../../handlers/comms/getIceServers';
import { joinVideoCall } from '../../handlers/comms/joinVideoCall';
import { leaveVideoCall } from '../../handlers/comms/leaveVideoCall';
import { listChatRooms } from '../../handlers/comms/listChatRooms';
import { sendChatMessage } from '../../handlers/comms/sendChatMessage';
import { updateVideoCallParticipant } from '../../handlers/comms/updateVideoCallParticipant';
import { cancelAppointment } from '../../handlers/dental-scheduling/cancelAppointment';
import { checkInAppointment } from '../../handlers/dental-scheduling/checkInAppointment';
import { confirmAppointment } from '../../handlers/dental-scheduling/confirmAppointment';
import { confirmAppointmentByToken } from '../../handlers/dental-scheduling/confirmAppointmentByToken';
import { createAppointment } from '../../handlers/dental-scheduling/createAppointment';
import { createBookingHold } from '../../handlers/dental-scheduling/createBookingHold';
import { createOnlineBooking } from '../../handlers/dental-scheduling/createOnlineBooking';
import { createQueueItem } from '../../handlers/dental-scheduling/createQueueItem';
import { createWaitlistEntry } from '../../handlers/dental-scheduling/createWaitlistEntry';
import { getAppointment } from '../../handlers/dental-scheduling/getAppointment';
import { getOnlineBooking } from '../../handlers/dental-scheduling/getOnlineBooking';
import { getPublicAvailability } from '../../handlers/dental-scheduling/getPublicAvailability';
import { getPublicBookingConfig } from '../../handlers/dental-scheduling/getPublicBookingConfig';
import { listAppointments } from '../../handlers/dental-scheduling/listAppointments';
import { listQueueBoard } from '../../handlers/dental-scheduling/listQueueBoard';
import { listWaitlist } from '../../handlers/dental-scheduling/listWaitlist';
import { promoteWaitlistEntry } from '../../handlers/dental-scheduling/promoteWaitlistEntry';
import { updateAppointment } from '../../handlers/dental-scheduling/updateAppointment';
import { updateQueueItemStatus } from '../../handlers/dental-scheduling/updateQueueItemStatus';
import { getAuditEvents } from '../../handlers/dental-audit/getAuditEvents';
import { addInsuranceClaimLine } from '../../handlers/dental-billing/addInsuranceClaimLine';
import { applyDentalDiscount } from '../../handlers/dental-billing/applyDentalDiscount';
import { createDentalInvoice } from '../../handlers/dental-billing/createDentalInvoice';
import { createDentalPaymentPlan } from '../../handlers/dental-billing/createDentalPaymentPlan';
import { createInsuranceClaim } from '../../handlers/dental-billing/createInsuranceClaim';
import { estimateClaimCoverage } from '../../handlers/dental-billing/estimateClaimCoverage';
import { generateStatementBatch } from '../../handlers/dental-billing/generateStatementBatch';
import { getArAging } from '../../handlers/dental-billing/getArAging';
import { getCollectionsSummary } from '../../handlers/dental-billing/getCollectionsSummary';
import { getDentalInvoice } from '../../handlers/dental-billing/getDentalInvoice';
import { getDentalPaymentPlan } from '../../handlers/dental-billing/getDentalPaymentPlan';
import { getDentalPaymentReceipt } from '../../handlers/dental-billing/getDentalPaymentReceipt';
import { getInsuranceClaim } from '../../handlers/dental-billing/getInsuranceClaim';
import { getPatientBalance } from '../../handlers/dental-billing/getPatientBalance';
import { getPayerArAging } from '../../handlers/dental-billing/getPayerArAging';
import { issueDentalInvoice } from '../../handlers/dental-billing/issueDentalInvoice';
import { listDentalInvoices } from '../../handlers/dental-billing/listDentalInvoices';
import { listDentalPayments } from '../../handlers/dental-billing/listDentalPayments';
import { listInsuranceClaims } from '../../handlers/dental-billing/listInsuranceClaims';
import { markUncollectible } from '../../handlers/dental-billing/markUncollectible';
import { recordClaimRemittance } from '../../handlers/dental-billing/recordClaimRemittance';
import { recordDentalPayment } from '../../handlers/dental-billing/recordDentalPayment';
import { updateInsuranceClaimLine } from '../../handlers/dental-billing/updateInsuranceClaimLine';
import { updateInsuranceClaimStatus } from '../../handlers/dental-billing/updateInsuranceClaimStatus';
import { voidDentalInvoice } from '../../handlers/dental-billing/voidDentalInvoice';
import { voidDentalPayment } from '../../handlers/dental-billing/voidDentalPayment';
import { DentalBranchManagement_create } from '../../handlers/dental-org/DentalBranchManagement_create';
import { DentalBranchManagement_get } from '../../handlers/dental-org/DentalBranchManagement_get';
import { DentalBranchManagement_list } from '../../handlers/dental-org/DentalBranchManagement_list';
import { DentalMembershipManagement_create } from '../../handlers/dental-org/DentalMembershipManagement_create';
import { DentalMembershipManagement_deactivate } from '../../handlers/dental-org/DentalMembershipManagement_deactivate';
import { DentalMembershipManagement_list } from '../../handlers/dental-org/DentalMembershipManagement_list';
import { DentalMembershipManagement_setPin } from '../../handlers/dental-org/DentalMembershipManagement_setPin';
import { DentalMembershipManagement_verifyPin } from '../../handlers/dental-org/DentalMembershipManagement_verifyPin';
import { DentalOrganizationManagement_create } from '../../handlers/dental-org/DentalOrganizationManagement_create';
import { DentalOrganizationManagement_get } from '../../handlers/dental-org/DentalOrganizationManagement_get';
import { DentalOrganizationManagement_update } from '../../handlers/dental-org/DentalOrganizationManagement_update';
import { createConsentTemplate } from '../../handlers/dental-org/createConsentTemplate';
import { createMember } from '../../handlers/dental-org/createMember';
import { createOnboarding } from '../../handlers/dental-org/createOnboarding';
import { deactivateMember } from '../../handlers/dental-org/deactivateMember';
import { deleteConsentTemplate } from '../../handlers/dental-org/deleteConsentTemplate';
import { getBranchSettings } from '../../handlers/dental-org/getBranchSettings';
import { getBranchesByUser } from '../../handlers/dental-org/getBranchesByUser';
import { getDashboardSummary } from '../../handlers/dental-org/getDashboardSummary';
import { getFeeSchedule } from '../../handlers/dental-org/getFeeSchedule';
import { getOrgContext } from '../../handlers/dental-org/getOrgContext';
import { getPermissionGrid } from '../../handlers/dental-org/getPermissionGrid';
import { getWorkingHours } from '../../handlers/dental-org/getWorkingHours';
import { listConsentTemplates } from '../../handlers/dental-org/listConsentTemplates';
import { listMembers } from '../../handlers/dental-org/listMembers';
import { recoverPin } from '../../handlers/dental-org/recoverPin';
import { resetMemberPin } from '../../handlers/dental-org/resetMemberPin';
import { setSecurityQuestion } from '../../handlers/dental-org/setSecurityQuestion';
import { updateBranchSettings } from '../../handlers/dental-org/updateBranchSettings';
import { updateConsentTemplate } from '../../handlers/dental-org/updateConsentTemplate';
import { updateFeeScheduleEntry } from '../../handlers/dental-org/updateFeeScheduleEntry';
import { updateMember } from '../../handlers/dental-org/updateMember';
import { updatePermissions } from '../../handlers/dental-org/updatePermissions';
import { updateWorkingHours } from '../../handlers/dental-org/updateWorkingHours';
import { approveAmendment } from '../../handlers/dental-clinical/amendments/approveAmendment';
import { createAmendment } from '../../handlers/dental-clinical/amendments/createAmendment';
import { createAttachment } from '../../handlers/dental-clinical/attachments/createAttachment';
import { createConsentForm } from '../../handlers/dental-clinical/consent/createConsentForm';
import { createInventoryAdjustment } from '../../handlers/dental-clinical/inventory/createInventoryAdjustment';
import { createInventoryItem } from '../../handlers/dental-clinical/inventory/createInventoryItem';
import { createLabOrder } from '../../handlers/dental-clinical/lab-orders/createLabOrder';
import { createMedicalHistoryEntry } from '../../handlers/dental-clinical/medical-history/createMedicalHistoryEntry';
import { createOcclusionScreening } from '../../handlers/dental-clinical/occlusion/createOcclusionScreening';
import { createPostopTemplate } from '../../handlers/dental-clinical/postop/createPostopTemplate';
import { createPrescription } from '../../handlers/dental-clinical/prescriptions/createPrescription';
import { deleteAttachment } from '../../handlers/dental-clinical/attachments/deleteAttachment';
import { getMedicalHistoryReview } from '../../handlers/dental-clinical/medical-history/getMedicalHistoryReview';
import { listAmendments } from '../../handlers/dental-clinical/amendments/listAmendments';
import { listAttachments } from '../../handlers/dental-clinical/attachments/listAttachments';
import { listConsentForms } from '../../handlers/dental-clinical/consent/listConsentForms';
import { listConsentRefusals } from '../../handlers/dental-clinical/consent/listConsentRefusals';
import { listInventoryAdjustments } from '../../handlers/dental-clinical/inventory/listInventoryAdjustments';
import { listInventoryItems } from '../../handlers/dental-clinical/inventory/listInventoryItems';
import { listLabOrders } from '../../handlers/dental-clinical/lab-orders/listLabOrders';
import { listMedicalHistory } from '../../handlers/dental-clinical/medical-history/listMedicalHistory';
import { listOcclusionScreenings } from '../../handlers/dental-clinical/occlusion/listOcclusionScreenings';
import { listPostopTemplates } from '../../handlers/dental-clinical/postop/listPostopTemplates';
import { listPrescriptions } from '../../handlers/dental-clinical/prescriptions/listPrescriptions';
import { recordConsentRefusal } from '../../handlers/dental-clinical/consent/recordConsentRefusal';
import { recordMedicalHistoryReview } from '../../handlers/dental-clinical/medical-history/recordMedicalHistoryReview';
import { revokeConsentForm } from '../../handlers/dental-clinical/consent/revokeConsentForm';
import { signConsentForm } from '../../handlers/dental-clinical/consent/signConsentForm';
import { updateInventoryItem } from '../../handlers/dental-clinical/inventory/updateInventoryItem';
import { updateLabOrder } from '../../handlers/dental-clinical/lab-orders/updateLabOrder';
import { updateMedicalHistoryEntry } from '../../handlers/dental-clinical/medical-history/updateMedicalHistoryEntry';
import { updatePostopTemplate } from '../../handlers/dental-clinical/postop/updatePostopTemplate';
import { updatePrescription } from '../../handlers/dental-clinical/prescriptions/updatePrescription';
import { approveErasure } from '../../handlers/dental-erasure/approveErasure';
import { getErasureRequest } from '../../handlers/dental-erasure/getErasureRequest';
import { listErasureRequests } from '../../handlers/dental-erasure/listErasureRequests';
import { rejectErasure } from '../../handlers/dental-erasure/rejectErasure';
import { requestErasure } from '../../handlers/dental-erasure/requestErasure';
import { acceptCasePresentation } from '../../handlers/dental-patient/case-presentation/acceptCasePresentation';
import { acceptTreatmentOption } from '../../handlers/dental-patient/treatment-plans/acceptTreatmentOption';
import { acceptTreatmentPlan } from '../../handlers/dental-patient/treatment-plans/acceptTreatmentPlan';
import { addFollowUpNote } from '../../handlers/dental-patient/engagement/addFollowUpNote';
import { addHouseholdMember } from '../../handlers/dental-patient/household/addHouseholdMember';
import { approveTreatmentPlan } from '../../handlers/dental-patient/treatment-plans/approveTreatmentPlan';
import { archiveDentalPatient } from '../../handlers/dental-patient/identity/archiveDentalPatient';
import { attachTreatmentAppointment } from '../../handlers/dental-patient/treatment-plans/attachTreatmentAppointment';
import { bulkArchiveDentalPatients } from '../../handlers/dental-patient/identity/bulkArchiveDentalPatients';
import { createCasePresentation } from '../../handlers/dental-patient/case-presentation/createCasePresentation';
import { createClaimDraft } from '../../handlers/dental-patient/insurance/createClaimDraft';
import { createCoverageAuthorization } from '../../handlers/dental-patient/insurance/createCoverageAuthorization';
import { createDentalAlert } from '../../handlers/dental-patient/alerts/createDentalAlert';
import { createDentalPatient } from '../../handlers/dental-patient/identity/createDentalPatient';
import { createHousehold } from '../../handlers/dental-patient/household/createHousehold';
import { createInsuranceProfile } from '../../handlers/dental-patient/insurance/createInsuranceProfile';
import { createPatientContact } from '../../handlers/dental-patient/contacts/createPatientContact';
import { createRecall } from '../../handlers/dental-patient/recalls/createRecall';
import { createSyncLog } from '../../handlers/dental-patient/sync/createSyncLog';
import { createTask } from '../../handlers/dental-patient/engagement/createTask';
import { createTreatmentPlan } from '../../handlers/dental-patient/treatment-plans/createTreatmentPlan';
import { deletePatientContact } from '../../handlers/dental-patient/contacts/deletePatientContact';
import { detachTreatmentAppointment } from '../../handlers/dental-patient/treatment-plans/detachTreatmentAppointment';
import { detectDuplicatePatients } from '../../handlers/dental-patient/identity/detectDuplicatePatients';
import { exportDentalPatients } from '../../handlers/dental-patient/identity/exportDentalPatients';
import { getCasePresentation } from '../../handlers/dental-patient/case-presentation/getCasePresentation';
import { getClaimReadiness } from '../../handlers/dental-patient/insurance/getClaimReadiness';
import { getDentalPatient } from '../../handlers/dental-patient/identity/getDentalPatient';
import { getDentalPatientSafetyFloor } from '../../handlers/dental-patient/identity/getDentalPatientSafetyFloor';
import { getDentalPatientStatement } from '../../handlers/dental-patient/identity/getDentalPatientStatement';
import { getHousehold } from '../../handlers/dental-patient/household/getHousehold';
import { getPatientCommunicationConsent } from '../../handlers/dental-patient/consent/getPatientCommunicationConsent';
import { getPatientHousehold } from '../../handlers/dental-patient/household/getPatientHousehold';
import { getTreatmentPlan } from '../../handlers/dental-patient/treatment-plans/getTreatmentPlan';
import { getTreatmentPlanVersion } from '../../handlers/dental-patient/treatment-plans/getTreatmentPlanVersion';
import { importPatients } from '../../handlers/dental-patient/identity/importPatients';
import { initializeDentition } from '../../handlers/dental-patient/identity/initializeDentition';
import { listCasePresentations } from '../../handlers/dental-patient/case-presentation/listCasePresentations';
import { listCoverageAuthorizations } from '../../handlers/dental-patient/insurance/listCoverageAuthorizations';
import { listDentalAlerts } from '../../handlers/dental-patient/alerts/listDentalAlerts';
import { listDentalPatients } from '../../handlers/dental-patient/identity/listDentalPatients';
import { listDueRecalls } from '../../handlers/dental-patient/recalls/listDueRecalls';
import { listFollowUpNotes } from '../../handlers/dental-patient/engagement/listFollowUpNotes';
import { listPatientClaims } from '../../handlers/dental-patient/insurance/listPatientClaims';
import { listPatientConditions } from '../../handlers/dental-patient/identity/listPatientConditions';
import { listPatientContacts } from '../../handlers/dental-patient/contacts/listPatientContacts';
import { listPatientInsuranceProfiles } from '../../handlers/dental-patient/insurance/listPatientInsuranceProfiles';
import { listPatientRecalls } from '../../handlers/dental-patient/recalls/listPatientRecalls';
import { listPatientTasks } from '../../handlers/dental-patient/engagement/listPatientTasks';
import { listPatientTreatmentPlans } from '../../handlers/dental-patient/treatment-plans/listPatientTreatmentPlans';
import { listPatientVisits } from '../../handlers/dental-patient/identity/listPatientVisits';
import { listSyncLogs } from '../../handlers/dental-patient/sync/listSyncLogs';
import { listTreatmentOptionGroup } from '../../handlers/dental-patient/treatment-plans/listTreatmentOptionGroup';
import { listTreatmentPlanStatusHistory } from '../../handlers/dental-patient/treatment-plans/listTreatmentPlanStatusHistory';
import { rejectCasePresentation } from '../../handlers/dental-patient/case-presentation/rejectCasePresentation';
import { removeHouseholdMember } from '../../handlers/dental-patient/household/removeHouseholdMember';
import { restoreDentalPatient } from '../../handlers/dental-patient/identity/restoreDentalPatient';
import { updateClaimStatus } from '../../handlers/dental-patient/insurance/updateClaimStatus';
import { updateCoverageAuthorizationStatus } from '../../handlers/dental-patient/insurance/updateCoverageAuthorizationStatus';
import { updateDentalAlert } from '../../handlers/dental-patient/alerts/updateDentalAlert';
import { updateDentalPatient } from '../../handlers/dental-patient/identity/updateDentalPatient';
import { updateInsuranceProfile } from '../../handlers/dental-patient/insurance/updateInsuranceProfile';
import { updatePatientCommunicationConsent } from '../../handlers/dental-patient/consent/updatePatientCommunicationConsent';
import { updatePatientContact } from '../../handlers/dental-patient/contacts/updatePatientContact';
import { updateRecall } from '../../handlers/dental-patient/recalls/updateRecall';
import { updateSyncLog } from '../../handlers/dental-patient/sync/updateSyncLog';
import { updateTask } from '../../handlers/dental-patient/engagement/updateTask';
import { updateTreatmentPlan } from '../../handlers/dental-patient/treatment-plans/updateTreatmentPlan';
import { CephMgmt_batchUpsertCephLandmarks } from '../../handlers/dental-imaging/CephMgmt_batchUpsertCephLandmarks';
import { CephMgmt_createCephReport } from '../../handlers/dental-imaging/CephMgmt_createCephReport';
import { CephMgmt_createCephSuperimposition } from '../../handlers/dental-imaging/CephMgmt_createCephSuperimposition';
import { CephMgmt_deleteCephLandmark } from '../../handlers/dental-imaging/CephMgmt_deleteCephLandmark';
import { CephMgmt_detectCephLandmarks } from '../../handlers/dental-imaging/CephMgmt_detectCephLandmarks';
import { CephMgmt_getCephAnalysis } from '../../handlers/dental-imaging/CephMgmt_getCephAnalysis';
import { CephMgmt_getCephLandmarkDetectionJob } from '../../handlers/dental-imaging/CephMgmt_getCephLandmarkDetectionJob';
import { CephMgmt_getCephReport } from '../../handlers/dental-imaging/CephMgmt_getCephReport';
import { CephMgmt_getCephSuperimposition } from '../../handlers/dental-imaging/CephMgmt_getCephSuperimposition';
import { CephMgmt_listCephLandmarks } from '../../handlers/dental-imaging/CephMgmt_listCephLandmarks';
import { CephMgmt_listCephSuperimpositions } from '../../handlers/dental-imaging/CephMgmt_listCephSuperimpositions';
import { CephMgmt_previewCephSuperimposition } from '../../handlers/dental-imaging/CephMgmt_previewCephSuperimposition';
import { CephMgmt_recomputeCephAnalysis } from '../../handlers/dental-imaging/CephMgmt_recomputeCephAnalysis';
import { CephMgmt_updateCephLandmark } from '../../handlers/dental-imaging/CephMgmt_updateCephLandmark';
import { ImagingFindingsMgmt_createFinding } from '../../handlers/dental-imaging/ImagingFindingsMgmt_createFinding';
import { ImagingFindingsMgmt_deleteFinding } from '../../handlers/dental-imaging/ImagingFindingsMgmt_deleteFinding';
import { ImagingFindingsMgmt_listFindings } from '../../handlers/dental-imaging/ImagingFindingsMgmt_listFindings';
import { ImagingFindingsMgmt_updateFinding } from '../../handlers/dental-imaging/ImagingFindingsMgmt_updateFinding';
import { ImagingMgmt_createImagingStudy } from '../../handlers/dental-imaging/ImagingMgmt_createImagingStudy';
import { ImagingMgmt_createMeasurement } from '../../handlers/dental-imaging/ImagingMgmt_createMeasurement';
import { ImagingMgmt_deleteImage } from '../../handlers/dental-imaging/ImagingMgmt_deleteImage';
import { ImagingMgmt_deleteMeasurement } from '../../handlers/dental-imaging/ImagingMgmt_deleteMeasurement';
import { ImagingMgmt_finalizeCbctStudy } from '../../handlers/dental-imaging/ImagingMgmt_finalizeCbctStudy';
import { ImagingMgmt_getCbctViewerLink } from '../../handlers/dental-imaging/ImagingMgmt_getCbctViewerLink';
import { ImagingMgmt_getImagingStudy } from '../../handlers/dental-imaging/ImagingMgmt_getImagingStudy';
import { ImagingMgmt_listMeasurements } from '../../handlers/dental-imaging/ImagingMgmt_listMeasurements';
import { ImagingMgmt_updateImageCalibration } from '../../handlers/dental-imaging/ImagingMgmt_updateImageCalibration';
import { ImagingMgmt_updateImageModality } from '../../handlers/dental-imaging/ImagingMgmt_updateImageModality';
import { PatientImageMgmt_listPatientImages } from '../../handlers/dental-imaging/PatientImageMgmt_listPatientImages';
import { listLegalHolds } from '../../handlers/dental-legalhold/listLegalHolds';
import { placeLegalHold } from '../../handlers/dental-legalhold/placeLegalHold';
import { releaseLegalHold } from '../../handlers/dental-legalhold/releaseLegalHold';
import { completePerioChart } from '../../handlers/dental-perio/completePerioChart';
import { createPerioChart } from '../../handlers/dental-perio/createPerioChart';
import { getPerioChart } from '../../handlers/dental-perio/getPerioChart';
import { getVisitPerioChart } from '../../handlers/dental-perio/getVisitPerioChart';
import { listPerioChartsForPatient } from '../../handlers/dental-perio/listPerioChartsForPatient';
import { upsertToothReading } from '../../handlers/dental-perio/upsertToothReading';
import { exportPMD } from '../../handlers/dental-pmd/exportPMD';
import { exportPatientCareRecord } from '../../handlers/dental-pmd/exportPatientCareRecord';
import { generatePMD } from '../../handlers/dental-pmd/generatePMD';
import { getImportedPMD } from '../../handlers/dental-pmd/getImportedPMD';
import { getPMDForVisit } from '../../handlers/dental-pmd/getPMDForVisit';
import { importPMD } from '../../handlers/dental-pmd/importPMD';
import { listImportedPMDs } from '../../handlers/dental-pmd/listImportedPMDs';
import { listPMDs } from '../../handlers/dental-pmd/listPMDs';
import { applyTemplate } from '../../handlers/dental-visit/templates/applyTemplate';
import { carryOverTreatments } from '../../handlers/dental-visit/treatments/carryOverTreatments';
import { createDentalTreatment } from '../../handlers/dental-visit/treatments/createDentalTreatment';
import { createDentalVisit } from '../../handlers/dental-visit/visits/createDentalVisit';
import { createTreatmentTemplate } from '../../handlers/dental-visit/templates/createTreatmentTemplate';
import { createVisitNoteAddendum } from '../../handlers/dental-visit/notes/createVisitNoteAddendum';
import { deleteTreatmentTemplate } from '../../handlers/dental-visit/templates/deleteTreatmentTemplate';
import { getDentalChart } from '../../handlers/dental-visit/chart/getDentalChart';
import { getDentalVisit } from '../../handlers/dental-visit/visits/getDentalVisit';
import { getToothHistory } from '../../handlers/dental-visit/chart/getToothHistory';
import { getVisitNoteHistory } from '../../handlers/dental-visit/notes/getVisitNoteHistory';
import { getVisitNotes } from '../../handlers/dental-visit/notes/getVisitNotes';
import { listDentalTreatments } from '../../handlers/dental-visit/treatments/listDentalTreatments';
import { listDentalVisits } from '../../handlers/dental-visit/visits/listDentalVisits';
import { listTreatmentTemplates } from '../../handlers/dental-visit/templates/listTreatmentTemplates';
import { signVisitNotes } from '../../handlers/dental-visit/notes/signVisitNotes';
import { updateDentalTreatment } from '../../handlers/dental-visit/treatments/updateDentalTreatment';
import { updateDentalVisit } from '../../handlers/dental-visit/visits/updateDentalVisit';
import { updateTooth } from '../../handlers/dental-visit/chart/updateTooth';
import { updateTreatmentTemplate } from '../../handlers/dental-visit/templates/updateTreatmentTemplate';
import { upsertDentalChart } from '../../handlers/dental-visit/chart/upsertDentalChart';
import { upsertVisitNotes } from '../../handlers/dental-visit/notes/upsertVisitNotes';
import { cancelEmailQueueItem } from '../../handlers/email/cancelEmailQueueItem';
import { createEmailTemplate } from '../../handlers/email/createEmailTemplate';
import { getEmailQueueItem } from '../../handlers/email/getEmailQueueItem';
import { getEmailTemplate } from '../../handlers/email/getEmailTemplate';
import { listEmailQueueItems } from '../../handlers/email/listEmailQueueItems';
import { listEmailTemplates } from '../../handlers/email/listEmailTemplates';
import { retryEmailQueueItem } from '../../handlers/email/retryEmailQueueItem';
import { testEmailTemplate } from '../../handlers/email/testEmailTemplate';
import { updateEmailTemplate } from '../../handlers/email/updateEmailTemplate';
import { createConsultation } from '../../handlers/emr/createConsultation';
import { finalizeConsultation } from '../../handlers/emr/finalizeConsultation';
import { getConsultation } from '../../handlers/emr/getConsultation';
import { listConsultations } from '../../handlers/emr/listConsultations';
import { listEMRPatients } from '../../handlers/emr/listEMRPatients';
import { updateConsultation } from '../../handlers/emr/updateConsultation';
import { getMyBalance } from '../../handlers/dental-portal/getMyBalance';
import { listMyAppointments } from '../../handlers/dental-portal/listMyAppointments';
import { listMyInvoices } from '../../handlers/dental-portal/listMyInvoices';
import { getNotification } from '../../handlers/notifs/getNotification';
import { listNotifications } from '../../handlers/notifs/listNotifications';
import { markAllNotificationsAsRead } from '../../handlers/notifs/markAllNotificationsAsRead';
import { markNotificationAsRead } from '../../handlers/notifs/markNotificationAsRead';
import { createPatient } from '../../handlers/patient/createPatient';
import { deactivatePatient } from '../../handlers/patient/deactivatePatient';
import { getPatient } from '../../handlers/patient/getPatient';
import { listPatients } from '../../handlers/patient/listPatients';
import { mergePatients } from '../../handlers/patient/mergePatients';
import { unmergePatients } from '../../handlers/patient/unmergePatients';
import { updatePatient } from '../../handlers/patient/updatePatient';
import { createPerson } from '../../handlers/person/createPerson';
import { getPerson } from '../../handlers/person/getPerson';
import { listPersons } from '../../handlers/person/listPersons';
import { updatePerson } from '../../handlers/person/updatePerson';
import { createPractitioner } from '../../handlers/provider/createPractitioner';
import { createPractitionerRole } from '../../handlers/provider/createPractitionerRole';
import { createProvider } from '../../handlers/provider/createProvider';
import { deactivatePractitioner } from '../../handlers/provider/deactivatePractitioner';
import { deactivatePractitionerRole } from '../../handlers/provider/deactivatePractitionerRole';
import { getPractitioner } from '../../handlers/provider/getPractitioner';
import { getPractitionerRole } from '../../handlers/provider/getPractitionerRole';
import { listPractitionerRoles } from '../../handlers/provider/listPractitionerRoles';
import { listPractitioners } from '../../handlers/provider/listPractitioners';
import { updatePractitioner } from '../../handlers/provider/updatePractitioner';
import { updatePractitionerRole } from '../../handlers/provider/updatePractitionerRole';
import { createReview } from '../../handlers/reviews/createReview';
import { deleteReview } from '../../handlers/reviews/deleteReview';
import { getReview } from '../../handlers/reviews/getReview';
import { listReviews } from '../../handlers/reviews/listReviews';
import { abortMultipartUpload } from '../../handlers/storage/abortMultipartUpload';
import { completeFileUpload } from '../../handlers/storage/completeFileUpload';
import { completeMultipartUpload } from '../../handlers/storage/completeMultipartUpload';
import { deleteFile } from '../../handlers/storage/deleteFile';
import { generateMultipartPartUrl } from '../../handlers/storage/generateMultipartPartUrl';
import { getFile } from '../../handlers/storage/getFile';
import { getFileDownload } from '../../handlers/storage/getFileDownload';
import { initiateMultipartUpload } from '../../handlers/storage/initiateMultipartUpload';
import { listFiles } from '../../handlers/storage/listFiles';
import { uploadFile } from '../../handlers/storage/uploadFile';

export const registry = {
  // Audit handlers
  listAuditLogs,

  // Billing handlers
  captureInvoicePayment,
  createInvoice,
  createMerchantAccount,
  deleteInvoice,
  finalizeInvoice,
  getInvoice,
  getMerchantAccount,
  getMerchantDashboard,
  handleStripeWebhook,
  listInvoices,
  markInvoiceUncollectible,
  onboardMerchantAccount,
  payInvoice,
  refundInvoicePayment,
  updateInvoice,
  voidInvoice,

  // Booking handlers
  cancelBooking,
  confirmBooking,
  createBooking,
  createBookingEvent,
  createScheduleException,
  deleteBookingEvent,
  deleteScheduleException,
  getBooking,
  getBookingEvent,
  getScheduleException,
  getTimeSlot,
  listBookingEvents,
  listBookings,
  listEventSlots,
  listScheduleExceptions,
  markNoShowBooking,
  rejectBooking,
  updateBookingEvent,

  // Comms handlers
  createChatRoom,
  endVideoCall,
  getChatMessages,
  getChatRoom,
  getIceServers,
  joinVideoCall,
  leaveVideoCall,
  listChatRooms,
  sendChatMessage,
  updateVideoCallParticipant,

  // Dental-scheduling handlers
  cancelAppointment,
  checkInAppointment,
  confirmAppointment,
  confirmAppointmentByToken,
  createAppointment,
  createBookingHold,
  createOnlineBooking,
  createQueueItem,
  createWaitlistEntry,
  getAppointment,
  getOnlineBooking,
  getPublicAvailability,
  getPublicBookingConfig,
  listAppointments,
  listQueueBoard,
  listWaitlist,
  promoteWaitlistEntry,
  updateAppointment,
  updateQueueItemStatus,

  // Dental-audit handlers
  getAuditEvents,

  // Dental-billing handlers
  addInsuranceClaimLine,
  applyDentalDiscount,
  createDentalInvoice,
  createDentalPaymentPlan,
  createInsuranceClaim,
  estimateClaimCoverage,
  generateStatementBatch,
  getArAging,
  getCollectionsSummary,
  getDentalInvoice,
  getDentalPaymentPlan,
  getDentalPaymentReceipt,
  getInsuranceClaim,
  getPatientBalance,
  getPayerArAging,
  issueDentalInvoice,
  listDentalInvoices,
  listDentalPayments,
  listInsuranceClaims,
  markUncollectible,
  recordClaimRemittance,
  recordDentalPayment,
  updateInsuranceClaimLine,
  updateInsuranceClaimStatus,
  voidDentalInvoice,
  voidDentalPayment,

  // Dental-org handlers
  DentalBranchManagement_create,
  DentalBranchManagement_get,
  DentalBranchManagement_list,
  DentalMembershipManagement_create,
  DentalMembershipManagement_deactivate,
  DentalMembershipManagement_list,
  DentalMembershipManagement_setPin,
  DentalMembershipManagement_verifyPin,
  DentalOrganizationManagement_create,
  DentalOrganizationManagement_get,
  DentalOrganizationManagement_update,
  createConsentTemplate,
  createMember,
  createOnboarding,
  deactivateMember,
  deleteConsentTemplate,
  getBranchSettings,
  getBranchesByUser,
  getDashboardSummary,
  getFeeSchedule,
  getOrgContext,
  getPermissionGrid,
  getWorkingHours,
  listConsentTemplates,
  listMembers,
  recoverPin,
  resetMemberPin,
  setSecurityQuestion,
  updateBranchSettings,
  updateConsentTemplate,
  updateFeeScheduleEntry,
  updateMember,
  updatePermissions,
  updateWorkingHours,

  // Dental-clinical handlers
  approveAmendment,
  createAmendment,
  createAttachment,
  createConsentForm,
  createInventoryAdjustment,
  createInventoryItem,
  createLabOrder,
  createMedicalHistoryEntry,
  createOcclusionScreening,
  createPostopTemplate,
  createPrescription,
  deleteAttachment,
  getMedicalHistoryReview,
  listAmendments,
  listAttachments,
  listConsentForms,
  listConsentRefusals,
  listInventoryAdjustments,
  listInventoryItems,
  listLabOrders,
  listMedicalHistory,
  listOcclusionScreenings,
  listPostopTemplates,
  listPrescriptions,
  recordConsentRefusal,
  recordMedicalHistoryReview,
  revokeConsentForm,
  signConsentForm,
  updateInventoryItem,
  updateLabOrder,
  updateMedicalHistoryEntry,
  updatePostopTemplate,
  updatePrescription,

  // Dental-erasure handlers
  approveErasure,
  getErasureRequest,
  listErasureRequests,
  rejectErasure,
  requestErasure,

  // Dental-patient handlers
  acceptCasePresentation,
  acceptTreatmentOption,
  acceptTreatmentPlan,
  addFollowUpNote,
  addHouseholdMember,
  approveTreatmentPlan,
  archiveDentalPatient,
  attachTreatmentAppointment,
  bulkArchiveDentalPatients,
  createCasePresentation,
  createClaimDraft,
  createCoverageAuthorization,
  createDentalAlert,
  createDentalPatient,
  createHousehold,
  createInsuranceProfile,
  createPatientContact,
  createRecall,
  createSyncLog,
  createTask,
  createTreatmentPlan,
  deletePatientContact,
  detachTreatmentAppointment,
  detectDuplicatePatients,
  exportDentalPatients,
  getCasePresentation,
  getClaimReadiness,
  getDentalPatient,
  getDentalPatientSafetyFloor,
  getDentalPatientStatement,
  getHousehold,
  getPatientCommunicationConsent,
  getPatientHousehold,
  getTreatmentPlan,
  getTreatmentPlanVersion,
  importPatients,
  initializeDentition,
  listCasePresentations,
  listCoverageAuthorizations,
  listDentalAlerts,
  listDentalPatients,
  listDueRecalls,
  listFollowUpNotes,
  listPatientClaims,
  listPatientConditions,
  listPatientContacts,
  listPatientInsuranceProfiles,
  listPatientRecalls,
  listPatientTasks,
  listPatientTreatmentPlans,
  listPatientVisits,
  listSyncLogs,
  listTreatmentOptionGroup,
  listTreatmentPlanStatusHistory,
  rejectCasePresentation,
  removeHouseholdMember,
  restoreDentalPatient,
  updateClaimStatus,
  updateCoverageAuthorizationStatus,
  updateDentalAlert,
  updateDentalPatient,
  updateInsuranceProfile,
  updatePatientCommunicationConsent,
  updatePatientContact,
  updateRecall,
  updateSyncLog,
  updateTask,
  updateTreatmentPlan,

  // Dental-imaging handlers
  CephMgmt_batchUpsertCephLandmarks,
  CephMgmt_createCephReport,
  CephMgmt_createCephSuperimposition,
  CephMgmt_deleteCephLandmark,
  CephMgmt_detectCephLandmarks,
  CephMgmt_getCephAnalysis,
  CephMgmt_getCephLandmarkDetectionJob,
  CephMgmt_getCephReport,
  CephMgmt_getCephSuperimposition,
  CephMgmt_listCephLandmarks,
  CephMgmt_listCephSuperimpositions,
  CephMgmt_previewCephSuperimposition,
  CephMgmt_recomputeCephAnalysis,
  CephMgmt_updateCephLandmark,
  ImagingFindingsMgmt_createFinding,
  ImagingFindingsMgmt_deleteFinding,
  ImagingFindingsMgmt_listFindings,
  ImagingFindingsMgmt_updateFinding,
  ImagingMgmt_createImagingStudy,
  ImagingMgmt_createMeasurement,
  ImagingMgmt_deleteImage,
  ImagingMgmt_deleteMeasurement,
  ImagingMgmt_finalizeCbctStudy,
  ImagingMgmt_getCbctViewerLink,
  ImagingMgmt_getImagingStudy,
  ImagingMgmt_listMeasurements,
  ImagingMgmt_updateImageCalibration,
  ImagingMgmt_updateImageModality,
  PatientImageMgmt_listPatientImages,

  // Dental-legalhold handlers
  listLegalHolds,
  placeLegalHold,
  releaseLegalHold,

  // Dental-perio handlers
  completePerioChart,
  createPerioChart,
  getPerioChart,
  getVisitPerioChart,
  listPerioChartsForPatient,
  upsertToothReading,

  // Dental-pmd handlers
  exportPMD,
  exportPatientCareRecord,
  generatePMD,
  getImportedPMD,
  getPMDForVisit,
  importPMD,
  listImportedPMDs,
  listPMDs,

  // Dental-visit handlers
  applyTemplate,
  carryOverTreatments,
  createDentalTreatment,
  createDentalVisit,
  createTreatmentTemplate,
  createVisitNoteAddendum,
  deleteTreatmentTemplate,
  getDentalChart,
  getDentalVisit,
  getToothHistory,
  getVisitNoteHistory,
  getVisitNotes,
  listDentalTreatments,
  listDentalVisits,
  listTreatmentTemplates,
  signVisitNotes,
  updateDentalTreatment,
  updateDentalVisit,
  updateTooth,
  updateTreatmentTemplate,
  upsertDentalChart,
  upsertVisitNotes,

  // Email handlers
  cancelEmailQueueItem,
  createEmailTemplate,
  getEmailQueueItem,
  getEmailTemplate,
  listEmailQueueItems,
  listEmailTemplates,
  retryEmailQueueItem,
  testEmailTemplate,
  updateEmailTemplate,

  // Emr handlers
  createConsultation,
  finalizeConsultation,
  getConsultation,
  listConsultations,
  listEMRPatients,
  updateConsultation,

  // Dental-portal handlers
  getMyBalance,
  listMyAppointments,
  listMyInvoices,

  // Notifs handlers
  getNotification,
  listNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,

  // Patient handlers
  createPatient,
  deactivatePatient,
  getPatient,
  listPatients,
  mergePatients,
  unmergePatients,
  updatePatient,

  // Person handlers
  createPerson,
  getPerson,
  listPersons,
  updatePerson,

  // Provider handlers
  createPractitioner,
  createPractitionerRole,
  createProvider,
  deactivatePractitioner,
  deactivatePractitionerRole,
  getPractitioner,
  getPractitionerRole,
  listPractitionerRoles,
  listPractitioners,
  updatePractitioner,
  updatePractitionerRole,

  // Reviews handlers
  createReview,
  deleteReview,
  getReview,
  listReviews,

  // Storage handlers
  abortMultipartUpload,
  completeFileUpload,
  completeMultipartUpload,
  deleteFile,
  generateMultipartPartUrl,
  getFile,
  getFileDownload,
  initiateMultipartUpload,
  listFiles,
  uploadFile,

};