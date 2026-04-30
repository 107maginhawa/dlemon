/**
 * Handler registry - maps operationIds to handler functions
 * This file is regenerated on each run
 */

import { listAuditLogs } from '../../handlers/audit/listAuditLogs';
import { createInvoice } from '../../handlers/billing/createInvoice';
import { listInvoices } from '../../handlers/billing/listInvoices';
import { getInvoice } from '../../handlers/billing/getInvoice';
import { updateInvoice } from '../../handlers/billing/updateInvoice';
import { deleteInvoice } from '../../handlers/billing/deleteInvoice';
import { captureInvoicePayment } from '../../handlers/billing/captureInvoicePayment';
import { finalizeInvoice } from '../../handlers/billing/finalizeInvoice';
import { markInvoiceUncollectible } from '../../handlers/billing/markInvoiceUncollectible';
import { payInvoice } from '../../handlers/billing/payInvoice';
import { refundInvoicePayment } from '../../handlers/billing/refundInvoicePayment';
import { voidInvoice } from '../../handlers/billing/voidInvoice';
import { createMerchantAccount } from '../../handlers/billing/createMerchantAccount';
import { getMerchantAccount } from '../../handlers/billing/getMerchantAccount';
import { getMerchantDashboard } from '../../handlers/billing/getMerchantDashboard';
import { onboardMerchantAccount } from '../../handlers/billing/onboardMerchantAccount';
import { handleStripeWebhook } from '../../handlers/billing/handleStripeWebhook';
import { createBooking } from '../../handlers/booking/createBooking';
import { listBookings } from '../../handlers/booking/listBookings';
import { getBooking } from '../../handlers/booking/getBooking';
import { cancelBooking } from '../../handlers/booking/cancelBooking';
import { confirmBooking } from '../../handlers/booking/confirmBooking';
import { markNoShowBooking } from '../../handlers/booking/markNoShowBooking';
import { rejectBooking } from '../../handlers/booking/rejectBooking';
import { listBookingEvents } from '../../handlers/booking/listBookingEvents';
import { createBookingEvent } from '../../handlers/booking/createBookingEvent';
import { getBookingEvent } from '../../handlers/booking/getBookingEvent';
import { updateBookingEvent } from '../../handlers/booking/updateBookingEvent';
import { deleteBookingEvent } from '../../handlers/booking/deleteBookingEvent';
import { createScheduleException } from '../../handlers/booking/createScheduleException';
import { listScheduleExceptions } from '../../handlers/booking/listScheduleExceptions';
import { getScheduleException } from '../../handlers/booking/getScheduleException';
import { deleteScheduleException } from '../../handlers/booking/deleteScheduleException';
import { listEventSlots } from '../../handlers/booking/listEventSlots';
import { getTimeSlot } from '../../handlers/booking/getTimeSlot';
import { createChatRoom } from '../../handlers/comms/createChatRoom';
import { listChatRooms } from '../../handlers/comms/listChatRooms';
import { getChatRoom } from '../../handlers/comms/getChatRoom';
import { getChatMessages } from '../../handlers/comms/getChatMessages';
import { sendChatMessage } from '../../handlers/comms/sendChatMessage';
import { endVideoCall } from '../../handlers/comms/endVideoCall';
import { joinVideoCall } from '../../handlers/comms/joinVideoCall';
import { leaveVideoCall } from '../../handlers/comms/leaveVideoCall';
import { updateVideoCallParticipant } from '../../handlers/comms/updateVideoCallParticipant';
import { getIceServers } from '../../handlers/comms/getIceServers';
import { listEmailQueueItems } from '../../handlers/email/listEmailQueueItems';
import { getEmailQueueItem } from '../../handlers/email/getEmailQueueItem';
import { cancelEmailQueueItem } from '../../handlers/email/cancelEmailQueueItem';
import { retryEmailQueueItem } from '../../handlers/email/retryEmailQueueItem';
import { listEmailTemplates } from '../../handlers/email/listEmailTemplates';
import { createEmailTemplate } from '../../handlers/email/createEmailTemplate';
import { getEmailTemplate } from '../../handlers/email/getEmailTemplate';
import { updateEmailTemplate } from '../../handlers/email/updateEmailTemplate';
import { testEmailTemplate } from '../../handlers/email/testEmailTemplate';
import { createConsultation } from '../../handlers/emr/createConsultation';
import { listConsultations } from '../../handlers/emr/listConsultations';
import { getConsultation } from '../../handlers/emr/getConsultation';
import { updateConsultation } from '../../handlers/emr/updateConsultation';
import { finalizeConsultation } from '../../handlers/emr/finalizeConsultation';
import { listEMRPatients } from '../../handlers/emr/listEMRPatients';
import { getCapabilityStatement } from '../../handlers/healthcare:conformance/getCapabilityStatement';
import { kickoffSystemExport } from '../../handlers/healthcare:conformance/kickoffSystemExport';
import { getExportStatus } from '../../handlers/healthcare:conformance/getExportStatus';
import { cancelExport } from '../../handlers/healthcare:conformance/cancelExport';
import { kickoffBulkImport } from '../../handlers/healthcare:conformance/kickoffBulkImport';
import { getBulkImportStatus } from '../../handlers/healthcare:conformance/getBulkImportStatus';
import { cancelBulkImport } from '../../handlers/healthcare:conformance/cancelBulkImport';
import { validateResource } from '../../handlers/healthcare:conformance/validateResource';
import { generateDocument } from '../../handlers/healthcare:conformance/generateDocument';
import { kickoffGroupExport } from '../../handlers/healthcare:conformance/kickoffGroupExport';
import { kickoffPatientExport } from '../../handlers/healthcare:conformance/kickoffPatientExport';
import { patientMatch } from '../../handlers/healthcare:conformance/patientMatch';
import { patientEverything } from '../../handlers/healthcare:conformance/patientEverything';
import { getMetadata } from '../../handlers/healthcare:conformance/getMetadata';
import { generatePatientSummary } from '../../handlers/healthcare:conformance/generatePatientSummary';
import { getPatientSummary } from '../../handlers/healthcare:conformance/getPatientSummary';
import { createSubscription } from '../../handlers/healthcare:conformance/createSubscription';
import { getSubscription } from '../../handlers/healthcare:conformance/getSubscription';
import { updateSubscription } from '../../handlers/healthcare:conformance/updateSubscription';
import { deleteSubscription } from '../../handlers/healthcare:conformance/deleteSubscription';
import { getSubscriptionStatus } from '../../handlers/healthcare:conformance/getSubscriptionStatus';
import { listSubscriptionTopics } from '../../handlers/healthcare:conformance/listSubscriptionTopics';
import { createCodeSystem } from '../../handlers/healthcare:conformance/createCodeSystem';
import { lookupCode } from '../../handlers/healthcare:conformance/lookupCode';
import { getCodeSystem } from '../../handlers/healthcare:conformance/getCodeSystem';
import { updateCodeSystem } from '../../handlers/healthcare:conformance/updateCodeSystem';
import { deleteCodeSystem } from '../../handlers/healthcare:conformance/deleteCodeSystem';
import { createConceptMap } from '../../handlers/healthcare:conformance/createConceptMap';
import { translateCode } from '../../handlers/healthcare:conformance/translateCode';
import { getConceptMap } from '../../handlers/healthcare:conformance/getConceptMap';
import { updateConceptMap } from '../../handlers/healthcare:conformance/updateConceptMap';
import { deleteConceptMap } from '../../handlers/healthcare:conformance/deleteConceptMap';
import { createValueSet } from '../../handlers/healthcare:conformance/createValueSet';
import { expandValueSet } from '../../handlers/healthcare:conformance/expandValueSet';
import { validateCode } from '../../handlers/healthcare:conformance/validateCode';
import { getValueSet } from '../../handlers/healthcare:conformance/getValueSet';
import { updateValueSet } from '../../handlers/healthcare:conformance/updateValueSet';
import { deleteValueSet } from '../../handlers/healthcare:conformance/deleteValueSet';
import { createAIOutputMetadata } from '../../handlers/healthcare:analytics/createAIOutputMetadata';
import { searchAIOutputMetadata } from '../../handlers/healthcare:analytics/searchAIOutputMetadata';
import { getAIOutputMetadata } from '../../handlers/healthcare:analytics/getAIOutputMetadata';
import { reviewAIOutput } from '../../handlers/healthcare:analytics/reviewAIOutput';
import { createCohortDefinition } from '../../handlers/healthcare:analytics/createCohortDefinition';
import { searchCohortDefinitions } from '../../handlers/healthcare:analytics/searchCohortDefinitions';
import { getCohortDefinition } from '../../handlers/healthcare:analytics/getCohortDefinition';
import { updateCohortDefinition } from '../../handlers/healthcare:analytics/updateCohortDefinition';
import { patchCohortDefinition } from '../../handlers/healthcare:analytics/patchCohortDefinition';
import { deleteCohortDefinition } from '../../handlers/healthcare:analytics/deleteCohortDefinition';
import { evaluateCohort } from '../../handlers/healthcare:analytics/evaluateCohort';
import { createDashboard } from '../../handlers/healthcare:analytics/createDashboard';
import { searchDashboards } from '../../handlers/healthcare:analytics/searchDashboards';
import { getDashboard } from '../../handlers/healthcare:analytics/getDashboard';
import { updateDashboard } from '../../handlers/healthcare:analytics/updateDashboard';
import { patchDashboard } from '../../handlers/healthcare:analytics/patchDashboard';
import { deleteDashboard } from '../../handlers/healthcare:analytics/deleteDashboard';
import { createDataLineageRecord } from '../../handlers/healthcare:analytics/createDataLineageRecord';
import { searchDataLineageRecords } from '../../handlers/healthcare:analytics/searchDataLineageRecords';
import { getDataLineageRecord } from '../../handlers/healthcare:analytics/getDataLineageRecord';
import { createDeIdentificationProfile } from '../../handlers/healthcare:analytics/createDeIdentificationProfile';
import { executeDeIdentification } from '../../handlers/healthcare:analytics/executeDeIdentification';
import { searchDeIdentificationProfiles } from '../../handlers/healthcare:analytics/searchDeIdentificationProfiles';
import { getDeIdentificationProfile } from '../../handlers/healthcare:analytics/getDeIdentificationProfile';
import { updateDeIdentificationProfile } from '../../handlers/healthcare:analytics/updateDeIdentificationProfile';
import { patchDeIdentificationProfile } from '../../handlers/healthcare:analytics/patchDeIdentificationProfile';
import { deleteDeIdentificationProfile } from '../../handlers/healthcare:analytics/deleteDeIdentificationProfile';
import { createReportDefinition } from '../../handlers/healthcare:analytics/createReportDefinition';
import { searchReportDefinitions } from '../../handlers/healthcare:analytics/searchReportDefinitions';
import { getReportDefinition } from '../../handlers/healthcare:analytics/getReportDefinition';
import { updateReportDefinition } from '../../handlers/healthcare:analytics/updateReportDefinition';
import { patchReportDefinition } from '../../handlers/healthcare:analytics/patchReportDefinition';
import { deleteReportDefinition } from '../../handlers/healthcare:analytics/deleteReportDefinition';
import { createReportRun } from '../../handlers/healthcare:analytics/createReportRun';
import { searchReportRuns } from '../../handlers/healthcare:analytics/searchReportRuns';
import { getReportRunStatus } from '../../handlers/healthcare:analytics/getReportRunStatus';
import { cancelReportRun } from '../../handlers/healthcare:analytics/cancelReportRun';
import { downloadReportRun } from '../../handlers/healthcare:analytics/downloadReportRun';
import { createResearchExtract } from '../../handlers/healthcare:analytics/createResearchExtract';
import { searchResearchExtracts } from '../../handlers/healthcare:analytics/searchResearchExtracts';
import { getResearchExtract } from '../../handlers/healthcare:analytics/getResearchExtract';
import { downloadResearchExtract } from '../../handlers/healthcare:analytics/downloadResearchExtract';
import { createBed } from '../../handlers/healthcare:administrative/createBed';
import { listBedOccupancy } from '../../handlers/healthcare:administrative/listBedOccupancy';
import { searchBeds } from '../../handlers/healthcare:administrative/searchBeds';
import { getBed } from '../../handlers/healthcare:administrative/getBed';
import { updateBed } from '../../handlers/healthcare:administrative/updateBed';
import { patchBed } from '../../handlers/healthcare:administrative/patchBed';
import { deleteBed } from '../../handlers/healthcare:administrative/deleteBed';
import { assignBed } from '../../handlers/healthcare:administrative/assignBed';
import { releaseBed } from '../../handlers/healthcare:administrative/releaseBed';
import { createChargeDefinition } from '../../handlers/healthcare:administrative/createChargeDefinition';
import { searchChargeDefinitions } from '../../handlers/healthcare:administrative/searchChargeDefinitions';
import { getChargeDefinition } from '../../handlers/healthcare:administrative/getChargeDefinition';
import { updateChargeDefinition } from '../../handlers/healthcare:administrative/updateChargeDefinition';
import { patchChargeDefinition } from '../../handlers/healthcare:administrative/patchChargeDefinition';
import { deleteChargeDefinition } from '../../handlers/healthcare:administrative/deleteChargeDefinition';
import { createChargeItem } from '../../handlers/healthcare:administrative/createChargeItem';
import { bulkCreateChargeItems } from '../../handlers/healthcare:administrative/bulkCreateChargeItems';
import { searchChargeItems } from '../../handlers/healthcare:administrative/searchChargeItems';
import { verifyCharges } from '../../handlers/healthcare:administrative/verifyCharges';
import { getChargeItem } from '../../handlers/healthcare:administrative/getChargeItem';
import { updateChargeItem } from '../../handlers/healthcare:administrative/updateChargeItem';
import { patchChargeItem } from '../../handlers/healthcare:administrative/patchChargeItem';
import { deleteChargeItem } from '../../handlers/healthcare:administrative/deleteChargeItem';
import { createClaim } from '../../handlers/healthcare:administrative/createClaim';
import { searchClaimResponses } from '../../handlers/healthcare:administrative/searchClaimResponses';
import { getClaimResponse } from '../../handlers/healthcare:administrative/getClaimResponse';
import { searchClaims } from '../../handlers/healthcare:administrative/searchClaims';
import { submitClaim } from '../../handlers/healthcare:administrative/submitClaim';
import { getClaim } from '../../handlers/healthcare:administrative/getClaim';
import { updateClaim } from '../../handlers/healthcare:administrative/updateClaim';
import { patchClaim } from '../../handlers/healthcare:administrative/patchClaim';
import { deleteClaim } from '../../handlers/healthcare:administrative/deleteClaim';
import { createClinicalPrivilege } from '../../handlers/healthcare:administrative/createClinicalPrivilege';
import { searchClinicalPrivileges } from '../../handlers/healthcare:administrative/searchClinicalPrivileges';
import { getClinicalPrivilege } from '../../handlers/healthcare:administrative/getClinicalPrivilege';
import { updateClinicalPrivilege } from '../../handlers/healthcare:administrative/updateClinicalPrivilege';
import { deleteClinicalPrivilege } from '../../handlers/healthcare:administrative/deleteClinicalPrivilege';
import { createCredentialingRecord } from '../../handlers/healthcare:administrative/createCredentialingRecord';
import { searchCredentialingRecords } from '../../handlers/healthcare:administrative/searchCredentialingRecords';
import { getCredentialingRecord } from '../../handlers/healthcare:administrative/getCredentialingRecord';
import { updateCredentialingRecord } from '../../handlers/healthcare:administrative/updateCredentialingRecord';
import { deleteCredentialingRecord } from '../../handlers/healthcare:administrative/deleteCredentialingRecord';
import { createFeeSchedule } from '../../handlers/healthcare:administrative/createFeeSchedule';
import { createInsuranceContractRate } from '../../handlers/healthcare:administrative/createInsuranceContractRate';
import { searchInsuranceContractRates } from '../../handlers/healthcare:administrative/searchInsuranceContractRates';
import { getInsuranceContractRate } from '../../handlers/healthcare:administrative/getInsuranceContractRate';
import { updateInsuranceContractRate } from '../../handlers/healthcare:administrative/updateInsuranceContractRate';
import { deleteInsuranceContractRate } from '../../handlers/healthcare:administrative/deleteInsuranceContractRate';
import { createDiscount } from '../../handlers/healthcare:administrative/createDiscount';
import { searchDiscounts } from '../../handlers/healthcare:administrative/searchDiscounts';
import { getDiscount } from '../../handlers/healthcare:administrative/getDiscount';
import { updateDiscount } from '../../handlers/healthcare:administrative/updateDiscount';
import { patchDiscount } from '../../handlers/healthcare:administrative/patchDiscount';
import { deleteDiscount } from '../../handlers/healthcare:administrative/deleteDiscount';
import { createFeeScheduleItem } from '../../handlers/healthcare:administrative/createFeeScheduleItem';
import { bulkImportFeeScheduleItems } from '../../handlers/healthcare:administrative/bulkImportFeeScheduleItems';
import { searchFeeScheduleItems } from '../../handlers/healthcare:administrative/searchFeeScheduleItems';
import { getFeeScheduleItem } from '../../handlers/healthcare:administrative/getFeeScheduleItem';
import { updateFeeScheduleItem } from '../../handlers/healthcare:administrative/updateFeeScheduleItem';
import { patchFeeScheduleItem } from '../../handlers/healthcare:administrative/patchFeeScheduleItem';
import { deleteFeeScheduleItem } from '../../handlers/healthcare:administrative/deleteFeeScheduleItem';
import { searchFeeSchedules } from '../../handlers/healthcare:administrative/searchFeeSchedules';
import { getFeeSchedule } from '../../handlers/healthcare:administrative/getFeeSchedule';
import { updateFeeSchedule } from '../../handlers/healthcare:administrative/updateFeeSchedule';
import { patchFeeSchedule } from '../../handlers/healthcare:administrative/patchFeeSchedule';
import { deleteFeeSchedule } from '../../handlers/healthcare:administrative/deleteFeeSchedule';
import { createCaseCosting } from '../../handlers/healthcare:administrative/createCaseCosting';
import { generateCaseCosting } from '../../handlers/healthcare:administrative/generateCaseCosting';
import { searchCaseCosting } from '../../handlers/healthcare:administrative/searchCaseCosting';
import { getCaseCosting } from '../../handlers/healthcare:administrative/getCaseCosting';
import { updateCaseCosting } from '../../handlers/healthcare:administrative/updateCaseCosting';
import { deleteCaseCosting } from '../../handlers/healthcare:administrative/deleteCaseCosting';
import { createCodingReview } from '../../handlers/healthcare:administrative/createCodingReview';
import { searchCodingReviews } from '../../handlers/healthcare:administrative/searchCodingReviews';
import { getCodingReview } from '../../handlers/healthcare:administrative/getCodingReview';
import { updateCodingReview } from '../../handlers/healthcare:administrative/updateCodingReview';
import { deleteCodingReview } from '../../handlers/healthcare:administrative/deleteCodingReview';
import { finalizeCodingReview } from '../../handlers/healthcare:administrative/finalizeCodingReview';
import { createCostAllocation } from '../../handlers/healthcare:administrative/createCostAllocation';
import { searchCostAllocations } from '../../handlers/healthcare:administrative/searchCostAllocations';
import { getCostAllocation } from '../../handlers/healthcare:administrative/getCostAllocation';
import { updateCostAllocation } from '../../handlers/healthcare:administrative/updateCostAllocation';
import { deleteCostAllocation } from '../../handlers/healthcare:administrative/deleteCostAllocation';
import { createCostCenter } from '../../handlers/healthcare:administrative/createCostCenter';
import { searchCostCenters } from '../../handlers/healthcare:administrative/searchCostCenters';
import { getCostCenter } from '../../handlers/healthcare:administrative/getCostCenter';
import { updateCostCenter } from '../../handlers/healthcare:administrative/updateCostCenter';
import { deleteCostCenter } from '../../handlers/healthcare:administrative/deleteCostCenter';
import { createGLExport } from '../../handlers/healthcare:administrative/createGLExport';
import { searchGLExports } from '../../handlers/healthcare:administrative/searchGLExports';
import { getGLExport } from '../../handlers/healthcare:administrative/getGLExport';
import { createResidentEvaluation } from '../../handlers/healthcare:administrative/createResidentEvaluation';
import { searchResidentEvaluations } from '../../handlers/healthcare:administrative/searchResidentEvaluations';
import { getResidentEvaluation } from '../../handlers/healthcare:administrative/getResidentEvaluation';
import { updateResidentEvaluation } from '../../handlers/healthcare:administrative/updateResidentEvaluation';
import { deleteResidentEvaluation } from '../../handlers/healthcare:administrative/deleteResidentEvaluation';
import { submitResidentEvaluation } from '../../handlers/healthcare:administrative/submitResidentEvaluation';
import { createProcedureLog } from '../../handlers/healthcare:administrative/createProcedureLog';
import { searchProcedureLogs } from '../../handlers/healthcare:administrative/searchProcedureLogs';
import { getProcedureLog } from '../../handlers/healthcare:administrative/getProcedureLog';
import { updateProcedureLog } from '../../handlers/healthcare:administrative/updateProcedureLog';
import { deleteProcedureLog } from '../../handlers/healthcare:administrative/deleteProcedureLog';
import { verifyProcedureLog } from '../../handlers/healthcare:administrative/verifyProcedureLog';
import { createResidencyProgram } from '../../handlers/healthcare:administrative/createResidencyProgram';
import { searchResidencyPrograms } from '../../handlers/healthcare:administrative/searchResidencyPrograms';
import { getResidencyProgram } from '../../handlers/healthcare:administrative/getResidencyProgram';
import { updateResidencyProgram } from '../../handlers/healthcare:administrative/updateResidencyProgram';
import { deleteResidencyProgram } from '../../handlers/healthcare:administrative/deleteResidencyProgram';
import { createResident } from '../../handlers/healthcare:administrative/createResident';
import { searchResidents } from '../../handlers/healthcare:administrative/searchResidents';
import { getResident } from '../../handlers/healthcare:administrative/getResident';
import { updateResident } from '../../handlers/healthcare:administrative/updateResident';
import { deleteResident } from '../../handlers/healthcare:administrative/deleteResident';
import { createRotationAssignment } from '../../handlers/healthcare:administrative/createRotationAssignment';
import { searchRotationAssignments } from '../../handlers/healthcare:administrative/searchRotationAssignments';
import { getRotationAssignment } from '../../handlers/healthcare:administrative/getRotationAssignment';
import { updateRotationAssignment } from '../../handlers/healthcare:administrative/updateRotationAssignment';
import { deleteRotationAssignment } from '../../handlers/healthcare:administrative/deleteRotationAssignment';
import { createMedicalRecordRequest } from '../../handlers/healthcare:administrative/createMedicalRecordRequest';
import { searchMedicalRecordRequests } from '../../handlers/healthcare:administrative/searchMedicalRecordRequests';
import { getMedicalRecordRequest } from '../../handlers/healthcare:administrative/getMedicalRecordRequest';
import { updateMedicalRecordRequest } from '../../handlers/healthcare:administrative/updateMedicalRecordRequest';
import { deleteMedicalRecordRequest } from '../../handlers/healthcare:administrative/deleteMedicalRecordRequest';
import { createROIRequest } from '../../handlers/healthcare:administrative/createROIRequest';
import { searchROIRequests } from '../../handlers/healthcare:administrative/searchROIRequests';
import { getROIRequest } from '../../handlers/healthcare:administrative/getROIRequest';
import { updateROIRequest } from '../../handlers/healthcare:administrative/updateROIRequest';
import { deleteROIRequest } from '../../handlers/healthcare:administrative/deleteROIRequest';
import { denyROIRequest } from '../../handlers/healthcare:administrative/denyROIRequest';
import { releaseROIRequest } from '../../handlers/healthcare:administrative/releaseROIRequest';
import { createCoverage } from '../../handlers/healthcare:administrative/createCoverage';
import { searchCoverages } from '../../handlers/healthcare:administrative/searchCoverages';
import { getCoverage } from '../../handlers/healthcare:administrative/getCoverage';
import { updateCoverage } from '../../handlers/healthcare:administrative/updateCoverage';
import { patchCoverage } from '../../handlers/healthcare:administrative/patchCoverage';
import { deleteCoverage } from '../../handlers/healthcare:administrative/deleteCoverage';
import { verifyEligibility } from '../../handlers/healthcare:administrative/verifyEligibility';
import { createPaymentPlan } from '../../handlers/healthcare:administrative/createPaymentPlan';
import { searchPaymentPlans } from '../../handlers/healthcare:administrative/searchPaymentPlans';
import { getPaymentPlan } from '../../handlers/healthcare:administrative/getPaymentPlan';
import { updatePaymentPlan } from '../../handlers/healthcare:administrative/updatePaymentPlan';
import { patchPaymentPlan } from '../../handlers/healthcare:administrative/patchPaymentPlan';
import { deletePaymentPlan } from '../../handlers/healthcare:administrative/deletePaymentPlan';
import { createPayment } from '../../handlers/healthcare:administrative/createPayment';
import { searchPayments } from '../../handlers/healthcare:administrative/searchPayments';
import { getPayment } from '../../handlers/healthcare:administrative/getPayment';
import { updatePayment } from '../../handlers/healthcare:administrative/updatePayment';
import { patchPayment } from '../../handlers/healthcare:administrative/patchPayment';
import { deletePayment } from '../../handlers/healthcare:administrative/deletePayment';
import { createPromissoryNote } from '../../handlers/healthcare:administrative/createPromissoryNote';
import { searchPromissoryNotes } from '../../handlers/healthcare:administrative/searchPromissoryNotes';
import { getPromissoryNote } from '../../handlers/healthcare:administrative/getPromissoryNote';
import { patchPromissoryNote } from '../../handlers/healthcare:administrative/patchPromissoryNote';
import { deletePromissoryNote } from '../../handlers/healthcare:administrative/deletePromissoryNote';
import { createReceipt } from '../../handlers/healthcare:administrative/createReceipt';
import { searchReceipts } from '../../handlers/healthcare:administrative/searchReceipts';
import { getReceipt } from '../../handlers/healthcare:administrative/getReceipt';
import { patchReceipt } from '../../handlers/healthcare:administrative/patchReceipt';
import { createPriorAuthorization } from '../../handlers/healthcare:administrative/createPriorAuthorization';
import { searchPriorAuthorizations } from '../../handlers/healthcare:administrative/searchPriorAuthorizations';
import { submitPriorAuthorization } from '../../handlers/healthcare:administrative/submitPriorAuthorization';
import { getPriorAuthorization } from '../../handlers/healthcare:administrative/getPriorAuthorization';
import { updatePriorAuthorization } from '../../handlers/healthcare:administrative/updatePriorAuthorization';
import { patchPriorAuthorization } from '../../handlers/healthcare:administrative/patchPriorAuthorization';
import { deletePriorAuthorization } from '../../handlers/healthcare:administrative/deletePriorAuthorization';
import { transitionPriorAuthorizationStatus } from '../../handlers/healthcare:administrative/transitionPriorAuthorizationStatus';
import { createAppointment } from '../../handlers/healthcare:administrative/createAppointment';
import { searchAppointments } from '../../handlers/healthcare:administrative/searchAppointments';
import { getAppointment } from '../../handlers/healthcare:administrative/getAppointment';
import { updateAppointment } from '../../handlers/healthcare:administrative/updateAppointment';
import { patchAppointment } from '../../handlers/healthcare:administrative/patchAppointment';
import { deleteAppointment } from '../../handlers/healthcare:administrative/deleteAppointment';
import { transitionAppointmentStatus } from '../../handlers/healthcare:administrative/transitionAppointmentStatus';
import { createSchedule } from '../../handlers/healthcare:administrative/createSchedule';
import { searchSchedules } from '../../handlers/healthcare:administrative/searchSchedules';
import { getSchedule } from '../../handlers/healthcare:administrative/getSchedule';
import { updateSchedule } from '../../handlers/healthcare:administrative/updateSchedule';
import { patchSchedule } from '../../handlers/healthcare:administrative/patchSchedule';
import { deleteSchedule } from '../../handlers/healthcare:administrative/deleteSchedule';
import { createSlot } from '../../handlers/healthcare:administrative/createSlot';
import { searchSlots } from '../../handlers/healthcare:administrative/searchSlots';
import { getSlot } from '../../handlers/healthcare:administrative/getSlot';
import { updateSlot } from '../../handlers/healthcare:administrative/updateSlot';
import { patchSlot } from '../../handlers/healthcare:administrative/patchSlot';
import { deleteSlot } from '../../handlers/healthcare:administrative/deleteSlot';
import { createOnCallSchedule } from '../../handlers/healthcare:administrative/createOnCallSchedule';
import { getCurrentOnCall } from '../../handlers/healthcare:administrative/getCurrentOnCall';
import { searchOnCallSchedules } from '../../handlers/healthcare:administrative/searchOnCallSchedules';
import { getOnCallSchedule } from '../../handlers/healthcare:administrative/getOnCallSchedule';
import { updateOnCallSchedule } from '../../handlers/healthcare:administrative/updateOnCallSchedule';
import { deleteOnCallSchedule } from '../../handlers/healthcare:administrative/deleteOnCallSchedule';
import { createWorkSchedule } from '../../handlers/healthcare:administrative/createWorkSchedule';
import { getWorkSchedule } from '../../handlers/healthcare:administrative/getWorkSchedule';
import { updateWorkSchedule } from '../../handlers/healthcare:administrative/updateWorkSchedule';
import { deleteWorkSchedule } from '../../handlers/healthcare:administrative/deleteWorkSchedule';
import { createShiftAssignment } from '../../handlers/healthcare:administrative/createShiftAssignment';
import { searchShiftAssignments } from '../../handlers/healthcare:administrative/searchShiftAssignments';
import { swapShift } from '../../handlers/healthcare:administrative/swapShift';
import { getShiftAssignment } from '../../handlers/healthcare:administrative/getShiftAssignment';
import { updateShiftAssignment } from '../../handlers/healthcare:administrative/updateShiftAssignment';
import { patchShiftAssignment } from '../../handlers/healthcare:administrative/patchShiftAssignment';
import { deleteShiftAssignment } from '../../handlers/healthcare:administrative/deleteShiftAssignment';
import { createTimeOffRequest } from '../../handlers/healthcare:administrative/createTimeOffRequest';
import { searchTimeOffRequests } from '../../handlers/healthcare:administrative/searchTimeOffRequests';
import { getTimeOffRequest } from '../../handlers/healthcare:administrative/getTimeOffRequest';
import { deleteTimeOffRequest } from '../../handlers/healthcare:administrative/deleteTimeOffRequest';
import { decideTimeOffRequest } from '../../handlers/healthcare:administrative/decideTimeOffRequest';
import { createCrossmatch } from '../../handlers/healthcare:ancillary/createCrossmatch';
import { searchCrossmatches } from '../../handlers/healthcare:ancillary/searchCrossmatches';
import { getCrossmatch } from '../../handlers/healthcare:ancillary/getCrossmatch';
import { updateCrossmatch } from '../../handlers/healthcare:ancillary/updateCrossmatch';
import { deleteCrossmatch } from '../../handlers/healthcare:ancillary/deleteCrossmatch';
import { createBloodProduct } from '../../handlers/healthcare:ancillary/createBloodProduct';
import { searchBloodProducts } from '../../handlers/healthcare:ancillary/searchBloodProducts';
import { getBloodProduct } from '../../handlers/healthcare:ancillary/getBloodProduct';
import { updateBloodProduct } from '../../handlers/healthcare:ancillary/updateBloodProduct';
import { deleteBloodProduct } from '../../handlers/healthcare:ancillary/deleteBloodProduct';
import { createTransfusionRecord } from '../../handlers/healthcare:ancillary/createTransfusionRecord';
import { searchTransfusionRecords } from '../../handlers/healthcare:ancillary/searchTransfusionRecords';
import { getTransfusionRecord } from '../../handlers/healthcare:ancillary/getTransfusionRecord';
import { updateTransfusionRecord } from '../../handlers/healthcare:ancillary/updateTransfusionRecord';
import { deleteTransfusionRecord } from '../../handlers/healthcare:ancillary/deleteTransfusionRecord';
import { createCosmeticCase } from '../../handlers/healthcare:ancillary/createCosmeticCase';
import { searchCosmeticCases } from '../../handlers/healthcare:ancillary/searchCosmeticCases';
import { getCosmeticCase } from '../../handlers/healthcare:ancillary/getCosmeticCase';
import { updateCosmeticCase } from '../../handlers/healthcare:ancillary/updateCosmeticCase';
import { deleteCosmeticCase } from '../../handlers/healthcare:ancillary/deleteCosmeticCase';
import { transitionCosmeticCaseStatus } from '../../handlers/healthcare:ancillary/transitionCosmeticCaseStatus';
import { createBeforeAfterPhoto } from '../../handlers/healthcare:ancillary/createBeforeAfterPhoto';
import { searchBeforeAfterPhotos } from '../../handlers/healthcare:ancillary/searchBeforeAfterPhotos';
import { getBeforeAfterPhoto } from '../../handlers/healthcare:ancillary/getBeforeAfterPhoto';
import { updateBeforeAfterPhoto } from '../../handlers/healthcare:ancillary/updateBeforeAfterPhoto';
import { deleteBeforeAfterPhoto } from '../../handlers/healthcare:ancillary/deleteBeforeAfterPhoto';
import { createSmileDesign } from '../../handlers/healthcare:ancillary/createSmileDesign';
import { getSmileDesign } from '../../handlers/healthcare:ancillary/getSmileDesign';
import { updateSmileDesign } from '../../handlers/healthcare:ancillary/updateSmileDesign';
import { deleteSmileDesign } from '../../handlers/healthcare:ancillary/deleteSmileDesign';
import { createVeneerRecord } from '../../handlers/healthcare:ancillary/createVeneerRecord';
import { searchVeneerRecords } from '../../handlers/healthcare:ancillary/searchVeneerRecords';
import { getVeneerRecord } from '../../handlers/healthcare:ancillary/getVeneerRecord';
import { updateVeneerRecord } from '../../handlers/healthcare:ancillary/updateVeneerRecord';
import { deleteVeneerRecord } from '../../handlers/healthcare:ancillary/deleteVeneerRecord';
import { createWhiteningRecord } from '../../handlers/healthcare:ancillary/createWhiteningRecord';
import { searchWhiteningRecords } from '../../handlers/healthcare:ancillary/searchWhiteningRecords';
import { getWhiteningRecord } from '../../handlers/healthcare:ancillary/getWhiteningRecord';
import { updateWhiteningRecord } from '../../handlers/healthcare:ancillary/updateWhiteningRecord';
import { deleteWhiteningRecord } from '../../handlers/healthcare:ancillary/deleteWhiteningRecord';
import { createIrrigationRecord } from '../../handlers/healthcare:ancillary/createIrrigationRecord';
import { getIrrigationRecord } from '../../handlers/healthcare:ancillary/getIrrigationRecord';
import { updateIrrigationRecord } from '../../handlers/healthcare:ancillary/updateIrrigationRecord';
import { deleteIrrigationRecord } from '../../handlers/healthcare:ancillary/deleteIrrigationRecord';
import { createEndoRecord } from '../../handlers/healthcare:ancillary/createEndoRecord';
import { searchEndoRecords } from '../../handlers/healthcare:ancillary/searchEndoRecords';
import { getEndoRecord } from '../../handlers/healthcare:ancillary/getEndoRecord';
import { updateEndoRecord } from '../../handlers/healthcare:ancillary/updateEndoRecord';
import { deleteEndoRecord } from '../../handlers/healthcare:ancillary/deleteEndoRecord';
import { transitionEndoRecordStatus } from '../../handlers/healthcare:ancillary/transitionEndoRecordStatus';
import { createEndoRetreatment } from '../../handlers/healthcare:ancillary/createEndoRetreatment';
import { searchEndoRetreatments } from '../../handlers/healthcare:ancillary/searchEndoRetreatments';
import { getEndoRetreatment } from '../../handlers/healthcare:ancillary/getEndoRetreatment';
import { updateEndoRetreatment } from '../../handlers/healthcare:ancillary/updateEndoRetreatment';
import { deleteEndoRetreatment } from '../../handlers/healthcare:ancillary/deleteEndoRetreatment';
import { createDentalLabCase } from '../../handlers/healthcare:ancillary/createDentalLabCase';
import { searchDentalLabCases } from '../../handlers/healthcare:ancillary/searchDentalLabCases';
import { getDentalLabCase } from '../../handlers/healthcare:ancillary/getDentalLabCase';
import { updateDentalLabCase } from '../../handlers/healthcare:ancillary/updateDentalLabCase';
import { deleteDentalLabCase } from '../../handlers/healthcare:ancillary/deleteDentalLabCase';
import { receiveDentalLabCase } from '../../handlers/healthcare:ancillary/receiveDentalLabCase';
import { returnDentalLabCase } from '../../handlers/healthcare:ancillary/returnDentalLabCase';
import { createLabCommunicationNote } from '../../handlers/healthcare:ancillary/createLabCommunicationNote';
import { getLabCommunicationNote } from '../../handlers/healthcare:ancillary/getLabCommunicationNote';
import { updateLabCommunicationNote } from '../../handlers/healthcare:ancillary/updateLabCommunicationNote';
import { deleteLabCommunicationNote } from '../../handlers/healthcare:ancillary/deleteLabCommunicationNote';
import { createDentalLabProvider } from '../../handlers/healthcare:ancillary/createDentalLabProvider';
import { searchDentalLabProviders } from '../../handlers/healthcare:ancillary/searchDentalLabProviders';
import { getDentalLabProvider } from '../../handlers/healthcare:ancillary/getDentalLabProvider';
import { updateDentalLabProvider } from '../../handlers/healthcare:ancillary/updateDentalLabProvider';
import { deleteDentalLabProvider } from '../../handlers/healthcare:ancillary/deleteDentalLabProvider';
import { createOdontogram } from '../../handlers/healthcare:ancillary/createOdontogram';
import { searchOdontograms } from '../../handlers/healthcare:ancillary/searchOdontograms';
import { getOdontogram } from '../../handlers/healthcare:ancillary/getOdontogram';
import { updateOdontogram } from '../../handlers/healthcare:ancillary/updateOdontogram';
import { deleteOdontogram } from '../../handlers/healthcare:ancillary/deleteOdontogram';
import { createExtractionRecord } from '../../handlers/healthcare:ancillary/createExtractionRecord';
import { searchExtractionRecords } from '../../handlers/healthcare:ancillary/searchExtractionRecords';
import { getExtractionRecord } from '../../handlers/healthcare:ancillary/getExtractionRecord';
import { updateExtractionRecord } from '../../handlers/healthcare:ancillary/updateExtractionRecord';
import { deleteExtractionRecord } from '../../handlers/healthcare:ancillary/deleteExtractionRecord';
import { createHealingFollowUp } from '../../handlers/healthcare:ancillary/createHealingFollowUp';
import { searchHealingFollowUps } from '../../handlers/healthcare:ancillary/searchHealingFollowUps';
import { getHealingFollowUp } from '../../handlers/healthcare:ancillary/getHealingFollowUp';
import { updateHealingFollowUp } from '../../handlers/healthcare:ancillary/updateHealingFollowUp';
import { deleteHealingFollowUp } from '../../handlers/healthcare:ancillary/deleteHealingFollowUp';
import { createDentalPathologySpecimen } from '../../handlers/healthcare:ancillary/createDentalPathologySpecimen';
import { searchDentalPathologySpecimens } from '../../handlers/healthcare:ancillary/searchDentalPathologySpecimens';
import { getDentalPathologySpecimen } from '../../handlers/healthcare:ancillary/getDentalPathologySpecimen';
import { updateDentalPathologySpecimen } from '../../handlers/healthcare:ancillary/updateDentalPathologySpecimen';
import { deleteDentalPathologySpecimen } from '../../handlers/healthcare:ancillary/deleteDentalPathologySpecimen';
import { createPostOpInstruction } from '../../handlers/healthcare:ancillary/createPostOpInstruction';
import { searchPostOpInstructions } from '../../handlers/healthcare:ancillary/searchPostOpInstructions';
import { getPostOpInstruction } from '../../handlers/healthcare:ancillary/getPostOpInstruction';
import { updatePostOpInstruction } from '../../handlers/healthcare:ancillary/updatePostOpInstruction';
import { deletePostOpInstruction } from '../../handlers/healthcare:ancillary/deletePostOpInstruction';
import { createAlignerSeries } from '../../handlers/healthcare:ancillary/createAlignerSeries';
import { getAlignerSeries } from '../../handlers/healthcare:ancillary/getAlignerSeries';
import { updateAlignerSeries } from '../../handlers/healthcare:ancillary/updateAlignerSeries';
import { deleteAlignerSeries } from '../../handlers/healthcare:ancillary/deleteAlignerSeries';
import { advanceAlignerTray } from '../../handlers/healthcare:ancillary/advanceAlignerTray';
import { createOrthoCase } from '../../handlers/healthcare:ancillary/createOrthoCase';
import { searchOrthoCases } from '../../handlers/healthcare:ancillary/searchOrthoCases';
import { getOrthoCase } from '../../handlers/healthcare:ancillary/getOrthoCase';
import { updateOrthoCase } from '../../handlers/healthcare:ancillary/updateOrthoCase';
import { deleteOrthoCase } from '../../handlers/healthcare:ancillary/deleteOrthoCase';
import { transitionOrthoCaseStatus } from '../../handlers/healthcare:ancillary/transitionOrthoCaseStatus';
import { createOrthoProgressRecord } from '../../handlers/healthcare:ancillary/createOrthoProgressRecord';
import { getOrthoProgressRecord } from '../../handlers/healthcare:ancillary/getOrthoProgressRecord';
import { updateOrthoProgressRecord } from '../../handlers/healthcare:ancillary/updateOrthoProgressRecord';
import { deleteOrthoProgressRecord } from '../../handlers/healthcare:ancillary/deleteOrthoProgressRecord';
import { createOrthoStage } from '../../handlers/healthcare:ancillary/createOrthoStage';
import { getOrthoStage } from '../../handlers/healthcare:ancillary/getOrthoStage';
import { updateOrthoStage } from '../../handlers/healthcare:ancillary/updateOrthoStage';
import { deleteOrthoStage } from '../../handlers/healthcare:ancillary/deleteOrthoStage';
import { createBehaviorAssessment } from '../../handlers/healthcare:ancillary/createBehaviorAssessment';
import { searchBehaviorAssessments } from '../../handlers/healthcare:ancillary/searchBehaviorAssessments';
import { getBehaviorAssessment } from '../../handlers/healthcare:ancillary/getBehaviorAssessment';
import { updateBehaviorAssessment } from '../../handlers/healthcare:ancillary/updateBehaviorAssessment';
import { deleteBehaviorAssessment } from '../../handlers/healthcare:ancillary/deleteBehaviorAssessment';
import { createEruptionRecord } from '../../handlers/healthcare:ancillary/createEruptionRecord';
import { getEruptionRecord } from '../../handlers/healthcare:ancillary/getEruptionRecord';
import { updateEruptionRecord } from '../../handlers/healthcare:ancillary/updateEruptionRecord';
import { deleteEruptionRecord } from '../../handlers/healthcare:ancillary/deleteEruptionRecord';
import { createExfoliationRecord } from '../../handlers/healthcare:ancillary/createExfoliationRecord';
import { getExfoliationRecord } from '../../handlers/healthcare:ancillary/getExfoliationRecord';
import { updateExfoliationRecord } from '../../handlers/healthcare:ancillary/updateExfoliationRecord';
import { deleteExfoliationRecord } from '../../handlers/healthcare:ancillary/deleteExfoliationRecord';
import { createFluorideApplication } from '../../handlers/healthcare:ancillary/createFluorideApplication';
import { searchFluorideApplications } from '../../handlers/healthcare:ancillary/searchFluorideApplications';
import { getFluorideApplication } from '../../handlers/healthcare:ancillary/getFluorideApplication';
import { updateFluorideApplication } from '../../handlers/healthcare:ancillary/updateFluorideApplication';
import { deleteFluorideApplication } from '../../handlers/healthcare:ancillary/deleteFluorideApplication';
import { createSealantRecord } from '../../handlers/healthcare:ancillary/createSealantRecord';
import { searchSealantRecords } from '../../handlers/healthcare:ancillary/searchSealantRecords';
import { getSealantRecord } from '../../handlers/healthcare:ancillary/getSealantRecord';
import { updateSealantRecord } from '../../handlers/healthcare:ancillary/updateSealantRecord';
import { deleteSealantRecord } from '../../handlers/healthcare:ancillary/deleteSealantRecord';
import { createSpaceMaintainer } from '../../handlers/healthcare:ancillary/createSpaceMaintainer';
import { searchSpaceMaintainers } from '../../handlers/healthcare:ancillary/searchSpaceMaintainers';
import { getSpaceMaintainer } from '../../handlers/healthcare:ancillary/getSpaceMaintainer';
import { updateSpaceMaintainer } from '../../handlers/healthcare:ancillary/updateSpaceMaintainer';
import { deleteSpaceMaintainer } from '../../handlers/healthcare:ancillary/deleteSpaceMaintainer';
import { createPerioExam } from '../../handlers/healthcare:ancillary/createPerioExam';
import { searchPerioExams } from '../../handlers/healthcare:ancillary/searchPerioExams';
import { comparePerioExams } from '../../handlers/healthcare:ancillary/comparePerioExams';
import { getPerioExam } from '../../handlers/healthcare:ancillary/getPerioExam';
import { updatePerioExam } from '../../handlers/healthcare:ancillary/updatePerioExam';
import { deletePerioExam } from '../../handlers/healthcare:ancillary/deletePerioExam';
import { completePerioExam } from '../../handlers/healthcare:ancillary/completePerioExam';
import { createFurcationRecord } from '../../handlers/healthcare:ancillary/createFurcationRecord';
import { getFurcationRecord } from '../../handlers/healthcare:ancillary/getFurcationRecord';
import { updateFurcationRecord } from '../../handlers/healthcare:ancillary/updateFurcationRecord';
import { deleteFurcationRecord } from '../../handlers/healthcare:ancillary/deleteFurcationRecord';
import { createMobilityRecord } from '../../handlers/healthcare:ancillary/createMobilityRecord';
import { getMobilityRecord } from '../../handlers/healthcare:ancillary/getMobilityRecord';
import { updateMobilityRecord } from '../../handlers/healthcare:ancillary/updateMobilityRecord';
import { deleteMobilityRecord } from '../../handlers/healthcare:ancillary/deleteMobilityRecord';
import { createImpression } from '../../handlers/healthcare:ancillary/createImpression';
import { getImpression } from '../../handlers/healthcare:ancillary/getImpression';
import { updateImpression } from '../../handlers/healthcare:ancillary/updateImpression';
import { deleteImpression } from '../../handlers/healthcare:ancillary/deleteImpression';
import { createLabCaseLink } from '../../handlers/healthcare:ancillary/createLabCaseLink';
import { searchLabCaseLinks } from '../../handlers/healthcare:ancillary/searchLabCaseLinks';
import { getLabCaseLink } from '../../handlers/healthcare:ancillary/getLabCaseLink';
import { updateLabCaseLink } from '../../handlers/healthcare:ancillary/updateLabCaseLink';
import { deleteLabCaseLink } from '../../handlers/healthcare:ancillary/deleteLabCaseLink';
import { createProsthoRecord } from '../../handlers/healthcare:ancillary/createProsthoRecord';
import { searchProsthoRecords } from '../../handlers/healthcare:ancillary/searchProsthoRecords';
import { getProsthoRecord } from '../../handlers/healthcare:ancillary/getProsthoRecord';
import { updateProsthoRecord } from '../../handlers/healthcare:ancillary/updateProsthoRecord';
import { deleteProsthoRecord } from '../../handlers/healthcare:ancillary/deleteProsthoRecord';
import { transitionProsthoStatus } from '../../handlers/healthcare:ancillary/transitionProsthoStatus';
import { createShadeSelection } from '../../handlers/healthcare:ancillary/createShadeSelection';
import { getShadeSelection } from '../../handlers/healthcare:ancillary/getShadeSelection';
import { updateShadeSelection } from '../../handlers/healthcare:ancillary/updateShadeSelection';
import { deleteShadeSelection } from '../../handlers/healthcare:ancillary/deleteShadeSelection';
import { createDentalTreatmentPlan } from '../../handlers/healthcare:ancillary/createDentalTreatmentPlan';
import { searchDentalTreatmentPlans } from '../../handlers/healthcare:ancillary/searchDentalTreatmentPlans';
import { getDentalTreatmentPlan } from '../../handlers/healthcare:ancillary/getDentalTreatmentPlan';
import { updateDentalTreatmentPlan } from '../../handlers/healthcare:ancillary/updateDentalTreatmentPlan';
import { deleteDentalTreatmentPlan } from '../../handlers/healthcare:ancillary/deleteDentalTreatmentPlan';
import { createFormularyItem } from '../../handlers/healthcare:ancillary/createFormularyItem';
import { searchFormularyItems } from '../../handlers/healthcare:ancillary/searchFormularyItems';
import { getFormularyItem } from '../../handlers/healthcare:ancillary/getFormularyItem';
import { updateFormularyItem } from '../../handlers/healthcare:ancillary/updateFormularyItem';
import { patchFormularyItem } from '../../handlers/healthcare:ancillary/patchFormularyItem';
import { deleteFormularyItem } from '../../handlers/healthcare:ancillary/deleteFormularyItem';
import { createDiagnosticReport } from '../../handlers/healthcare:ancillary/createDiagnosticReport';
import { searchDiagnosticReports } from '../../handlers/healthcare:ancillary/searchDiagnosticReports';
import { getDiagnosticReport } from '../../handlers/healthcare:ancillary/getDiagnosticReport';
import { updateDiagnosticReport } from '../../handlers/healthcare:ancillary/updateDiagnosticReport';
import { deleteDiagnosticReport } from '../../handlers/healthcare:ancillary/deleteDiagnosticReport';
import { createResultPanel } from '../../handlers/healthcare:ancillary/createResultPanel';
import { searchResultPanels } from '../../handlers/healthcare:ancillary/searchResultPanels';
import { getResultPanel } from '../../handlers/healthcare:ancillary/getResultPanel';
import { createSpecimen } from '../../handlers/healthcare:ancillary/createSpecimen';
import { searchSpecimens } from '../../handlers/healthcare:ancillary/searchSpecimens';
import { getSpecimen } from '../../handlers/healthcare:ancillary/getSpecimen';
import { updateSpecimen } from '../../handlers/healthcare:ancillary/updateSpecimen';
import { deleteSpecimen } from '../../handlers/healthcare:ancillary/deleteSpecimen';
import { verifyLabResult } from '../../handlers/healthcare:ancillary/verifyLabResult';
import { searchLabVerifications } from '../../handlers/healthcare:ancillary/searchLabVerifications';
import { getLabResultVerification } from '../../handlers/healthcare:ancillary/getLabResultVerification';
import { createMedicationAdministration } from '../../handlers/healthcare:ancillary/createMedicationAdministration';
import { searchMedicationAdministrations } from '../../handlers/healthcare:ancillary/searchMedicationAdministrations';
import { getMedicationAdministration } from '../../handlers/healthcare:ancillary/getMedicationAdministration';
import { updateMedicationAdministration } from '../../handlers/healthcare:ancillary/updateMedicationAdministration';
import { patchMedicationAdministration } from '../../handlers/healthcare:ancillary/patchMedicationAdministration';
import { deleteMedicationAdministration } from '../../handlers/healthcare:ancillary/deleteMedicationAdministration';
import { createMedication } from '../../handlers/healthcare:ancillary/createMedication';
import { searchMedications } from '../../handlers/healthcare:ancillary/searchMedications';
import { getMedication } from '../../handlers/healthcare:ancillary/getMedication';
import { updateMedication } from '../../handlers/healthcare:ancillary/updateMedication';
import { patchMedication } from '../../handlers/healthcare:ancillary/patchMedication';
import { deleteMedication } from '../../handlers/healthcare:ancillary/deleteMedication';
import { createAdherenceRecord } from '../../handlers/healthcare:ancillary/createAdherenceRecord';
import { searchAdherenceRecords } from '../../handlers/healthcare:ancillary/searchAdherenceRecords';
import { getAdherenceRecord } from '../../handlers/healthcare:ancillary/getAdherenceRecord';
import { createMedicationDispense } from '../../handlers/healthcare:ancillary/createMedicationDispense';
import { searchMedicationDispenses } from '../../handlers/healthcare:ancillary/searchMedicationDispenses';
import { getMedicationDispense } from '../../handlers/healthcare:ancillary/getMedicationDispense';
import { updateMedicationDispense } from '../../handlers/healthcare:ancillary/updateMedicationDispense';
import { deleteMedicationDispense } from '../../handlers/healthcare:ancillary/deleteMedicationDispense';
import { checkDrugInteractions } from '../../handlers/healthcare:ancillary/checkDrugInteractions';
import { createMedicationReconciliation } from '../../handlers/healthcare:ancillary/createMedicationReconciliation';
import { searchMedicationReconciliations } from '../../handlers/healthcare:ancillary/searchMedicationReconciliations';
import { getMedicationReconciliation } from '../../handlers/healthcare:ancillary/getMedicationReconciliation';
import { updateMedicationReconciliation } from '../../handlers/healthcare:ancillary/updateMedicationReconciliation';
import { patchMedicationReconciliation } from '../../handlers/healthcare:ancillary/patchMedicationReconciliation';
import { deleteMedicationReconciliation } from '../../handlers/healthcare:ancillary/deleteMedicationReconciliation';
import { createImagingStudy } from '../../handlers/healthcare:ancillary/createImagingStudy';
import { searchImagingStudies } from '../../handlers/healthcare:ancillary/searchImagingStudies';
import { getImagingStudy } from '../../handlers/healthcare:ancillary/getImagingStudy';
import { updateImagingStudy } from '../../handlers/healthcare:ancillary/updateImagingStudy';
import { deleteImagingStudy } from '../../handlers/healthcare:ancillary/deleteImagingStudy';
import { createRadiologyReport } from '../../handlers/healthcare:ancillary/createRadiologyReport';
import { searchRadiologyReports } from '../../handlers/healthcare:ancillary/searchRadiologyReports';
import { getRadiologyReport } from '../../handlers/healthcare:ancillary/getRadiologyReport';
import { updateRadiologyReport } from '../../handlers/healthcare:ancillary/updateRadiologyReport';
import { patchRadiologyReport } from '../../handlers/healthcare:ancillary/patchRadiologyReport';
import { deleteRadiologyReport } from '../../handlers/healthcare:ancillary/deleteRadiologyReport';
import { activateBreakGlass } from '../../handlers/healthcare:support/activateBreakGlass';
import { searchBreakGlassOverrides } from '../../handlers/healthcare:support/searchBreakGlassOverrides';
import { getBreakGlassOverride } from '../../handlers/healthcare:support/getBreakGlassOverride';
import { reviewBreakGlassOverride } from '../../handlers/healthcare:support/reviewBreakGlassOverride';
import { createCarePlan } from '../../handlers/healthcare:support/createCarePlan';
import { searchCarePlans } from '../../handlers/healthcare:support/searchCarePlans';
import { getCarePlan } from '../../handlers/healthcare:support/getCarePlan';
import { updateCarePlan } from '../../handlers/healthcare:support/updateCarePlan';
import { patchCarePlan } from '../../handlers/healthcare:support/patchCarePlan';
import { deleteCarePlan } from '../../handlers/healthcare:support/deleteCarePlan';
import { createCareTeam } from '../../handlers/healthcare:support/createCareTeam';
import { searchCareTeams } from '../../handlers/healthcare:support/searchCareTeams';
import { getCareTeam } from '../../handlers/healthcare:support/getCareTeam';
import { updateCareTeam } from '../../handlers/healthcare:support/updateCareTeam';
import { patchCareTeam } from '../../handlers/healthcare:support/patchCareTeam';
import { deleteCareTeam } from '../../handlers/healthcare:support/deleteCareTeam';
import { createGoal } from '../../handlers/healthcare:support/createGoal';
import { searchGoals } from '../../handlers/healthcare:support/searchGoals';
import { getGoal } from '../../handlers/healthcare:support/getGoal';
import { updateGoal } from '../../handlers/healthcare:support/updateGoal';
import { patchGoal } from '../../handlers/healthcare:support/patchGoal';
import { deleteGoal } from '../../handlers/healthcare:support/deleteGoal';
import { cdsEncounterStart } from '../../handlers/healthcare:support/cdsEncounterStart';
import { cdsOrderSelect } from '../../handlers/healthcare:support/cdsOrderSelect';
import { cdsOrderSign } from '../../handlers/healthcare:support/cdsOrderSign';
import { cdsPatientView } from '../../handlers/healthcare:support/cdsPatientView';
import { discoverCDSServices } from '../../handlers/healthcare:support/discoverCDSServices';
import { createClinicalBenchmark } from '../../handlers/healthcare:support/createClinicalBenchmark';
import { searchClinicalBenchmarks } from '../../handlers/healthcare:support/searchClinicalBenchmarks';
import { getClinicalBenchmark } from '../../handlers/healthcare:support/getClinicalBenchmark';
import { updateClinicalBenchmark } from '../../handlers/healthcare:support/updateClinicalBenchmark';
import { patchClinicalBenchmark } from '../../handlers/healthcare:support/patchClinicalBenchmark';
import { deleteClinicalBenchmark } from '../../handlers/healthcare:support/deleteClinicalBenchmark';
import { createOutcomeRecord } from '../../handlers/healthcare:support/createOutcomeRecord';
import { searchOutcomeRecords } from '../../handlers/healthcare:support/searchOutcomeRecords';
import { getOutcomeRecord } from '../../handlers/healthcare:support/getOutcomeRecord';
import { updateOutcomeRecord } from '../../handlers/healthcare:support/updateOutcomeRecord';
import { patchOutcomeRecord } from '../../handlers/healthcare:support/patchOutcomeRecord';
import { deleteOutcomeRecord } from '../../handlers/healthcare:support/deleteOutcomeRecord';
import { generateOutcomeReport } from '../../handlers/healthcare:support/generateOutcomeReport';
import { searchOutcomeReports } from '../../handlers/healthcare:support/searchOutcomeReports';
import { getOutcomeReport } from '../../handlers/healthcare:support/getOutcomeReport';
import { createConsent } from '../../handlers/healthcare:support/createConsent';
import { searchConsents } from '../../handlers/healthcare:support/searchConsents';
import { getConsent } from '../../handlers/healthcare:support/getConsent';
import { updateConsent } from '../../handlers/healthcare:support/updateConsent';
import { patchConsent } from '../../handlers/healthcare:support/patchConsent';
import { deleteConsent } from '../../handlers/healthcare:support/deleteConsent';
import { createImportJob } from '../../handlers/healthcare:support/createImportJob';
import { getImportJobStatus } from '../../handlers/healthcare:support/getImportJobStatus';
import { cancelImportJob } from '../../handlers/healthcare:support/cancelImportJob';
import { getImportJobErrors } from '../../handlers/healthcare:support/getImportJobErrors';
import { executeImportJob } from '../../handlers/healthcare:support/executeImportJob';
import { uploadImportFile } from '../../handlers/healthcare:support/uploadImportFile';
import { validateImportJob } from '../../handlers/healthcare:support/validateImportJob';
import { createImportMapping } from '../../handlers/healthcare:support/createImportMapping';
import { searchImportMappings } from '../../handlers/healthcare:support/searchImportMappings';
import { getImportMapping } from '../../handlers/healthcare:support/getImportMapping';
import { updateImportMapping } from '../../handlers/healthcare:support/updateImportMapping';
import { patchImportMapping } from '../../handlers/healthcare:support/patchImportMapping';
import { deleteImportMapping } from '../../handlers/healthcare:support/deleteImportMapping';
import { createAntibiogram } from '../../handlers/healthcare:support/createAntibiogram';
import { searchAntibiograms } from '../../handlers/healthcare:support/searchAntibiograms';
import { getAntibiogram } from '../../handlers/healthcare:support/getAntibiogram';
import { updateAntibiogram } from '../../handlers/healthcare:support/updateAntibiogram';
import { deleteAntibiogram } from '../../handlers/healthcare:support/deleteAntibiogram';
import { createInfectionSurveillance } from '../../handlers/healthcare:support/createInfectionSurveillance';
import { searchInfectionSurveillance } from '../../handlers/healthcare:support/searchInfectionSurveillance';
import { getInfectionSurveillance } from '../../handlers/healthcare:support/getInfectionSurveillance';
import { updateInfectionSurveillance } from '../../handlers/healthcare:support/updateInfectionSurveillance';
import { deleteInfectionSurveillance } from '../../handlers/healthcare:support/deleteInfectionSurveillance';
import { createMandatoryReport } from '../../handlers/healthcare:support/createMandatoryReport';
import { searchMandatoryReports } from '../../handlers/healthcare:support/searchMandatoryReports';
import { getMandatoryReport } from '../../handlers/healthcare:support/getMandatoryReport';
import { updateMandatoryReport } from '../../handlers/healthcare:support/updateMandatoryReport';
import { deleteMandatoryReport } from '../../handlers/healthcare:support/deleteMandatoryReport';
import { createProvenance } from '../../handlers/healthcare:support/createProvenance';
import { searchProvenance } from '../../handlers/healthcare:support/searchProvenance';
import { getProvenance } from '../../handlers/healthcare:support/getProvenance';
import { createProxyAccessGrant } from '../../handlers/healthcare:support/createProxyAccessGrant';
import { searchProxyAccessGrants } from '../../handlers/healthcare:support/searchProxyAccessGrants';
import { getProxyAccessGrant } from '../../handlers/healthcare:support/getProxyAccessGrant';
import { updateProxyAccessGrant } from '../../handlers/healthcare:support/updateProxyAccessGrant';
import { deleteProxyAccessGrant } from '../../handlers/healthcare:support/deleteProxyAccessGrant';
import { revokeProxyAccessGrant } from '../../handlers/healthcare:support/revokeProxyAccessGrant';
import { createIncidentReport } from '../../handlers/healthcare:support/createIncidentReport';
import { searchIncidentReports } from '../../handlers/healthcare:support/searchIncidentReports';
import { getIncidentReport } from '../../handlers/healthcare:support/getIncidentReport';
import { updateIncidentReport } from '../../handlers/healthcare:support/updateIncidentReport';
import { deleteIncidentReport } from '../../handlers/healthcare:support/deleteIncidentReport';
import { transitionIncidentStatus } from '../../handlers/healthcare:support/transitionIncidentStatus';
import { createQualityMeasure } from '../../handlers/healthcare:support/createQualityMeasure';
import { searchQualityMeasures } from '../../handlers/healthcare:support/searchQualityMeasures';
import { getQualityMeasure } from '../../handlers/healthcare:support/getQualityMeasure';
import { updateQualityMeasure } from '../../handlers/healthcare:support/updateQualityMeasure';
import { deleteQualityMeasure } from '../../handlers/healthcare:support/deleteQualityMeasure';
import { createQuestionnaireResponse } from '../../handlers/healthcare:support/createQuestionnaireResponse';
import { searchQuestionnaireResponses } from '../../handlers/healthcare:support/searchQuestionnaireResponses';
import { getQuestionnaireResponse } from '../../handlers/healthcare:support/getQuestionnaireResponse';
import { updateQuestionnaireResponse } from '../../handlers/healthcare:support/updateQuestionnaireResponse';
import { patchQuestionnaireResponse } from '../../handlers/healthcare:support/patchQuestionnaireResponse';
import { deleteQuestionnaireResponse } from '../../handlers/healthcare:support/deleteQuestionnaireResponse';
import { createQuestionnaire } from '../../handlers/healthcare:support/createQuestionnaire';
import { searchQuestionnaires } from '../../handlers/healthcare:support/searchQuestionnaires';
import { getQuestionnaire } from '../../handlers/healthcare:support/getQuestionnaire';
import { updateQuestionnaire } from '../../handlers/healthcare:support/updateQuestionnaire';
import { patchQuestionnaire } from '../../handlers/healthcare:support/patchQuestionnaire';
import { deleteQuestionnaire } from '../../handlers/healthcare:support/deleteQuestionnaire';
import { createSDOHReferral } from '../../handlers/healthcare:support/createSDOHReferral';
import { searchSDOHReferrals } from '../../handlers/healthcare:support/searchSDOHReferrals';
import { getSDOHReferral } from '../../handlers/healthcare:support/getSDOHReferral';
import { updateSDOHReferral } from '../../handlers/healthcare:support/updateSDOHReferral';
import { patchSDOHReferral } from '../../handlers/healthcare:support/patchSDOHReferral';
import { deleteSDOHReferral } from '../../handlers/healthcare:support/deleteSDOHReferral';
import { createSDOHScreening } from '../../handlers/healthcare:support/createSDOHScreening';
import { searchSDOHScreenings } from '../../handlers/healthcare:support/searchSDOHScreenings';
import { getSDOHScreening } from '../../handlers/healthcare:support/getSDOHScreening';
import { updateSDOHScreening } from '../../handlers/healthcare:support/updateSDOHScreening';
import { patchSDOHScreening } from '../../handlers/healthcare:support/patchSDOHScreening';
import { deleteSDOHScreening } from '../../handlers/healthcare:support/deleteSDOHScreening';
import { createSignature } from '../../handlers/healthcare:support/createSignature';
import { searchSignatures } from '../../handlers/healthcare:support/searchSignatures';
import { getSignature } from '../../handlers/healthcare:support/getSignature';
import { revokeSignature } from '../../handlers/healthcare:support/revokeSignature';
import { verifySignature } from '../../handlers/healthcare:support/verifySignature';
import { createTask } from '../../handlers/healthcare:support/createTask';
import { searchTasks } from '../../handlers/healthcare:support/searchTasks';
import { getTask } from '../../handlers/healthcare:support/getTask';
import { updateTask } from '../../handlers/healthcare:support/updateTask';
import { patchTask } from '../../handlers/healthcare:support/patchTask';
import { deleteTask } from '../../handlers/healthcare:support/deleteTask';
import { transitionTaskStatus } from '../../handlers/healthcare:support/transitionTaskStatus';
import { createAsyncConsultation } from '../../handlers/healthcare:support/createAsyncConsultation';
import { searchAsyncConsultations } from '../../handlers/healthcare:support/searchAsyncConsultations';
import { getAsyncConsultation } from '../../handlers/healthcare:support/getAsyncConsultation';
import { updateAsyncConsultation } from '../../handlers/healthcare:support/updateAsyncConsultation';
import { deleteAsyncConsultation } from '../../handlers/healthcare:support/deleteAsyncConsultation';
import { escalateAsyncConsultation } from '../../handlers/healthcare:support/escalateAsyncConsultation';
import { respondToAsyncConsultation } from '../../handlers/healthcare:support/respondToAsyncConsultation';
import { createRemoteMonitoringEnrollment } from '../../handlers/healthcare:support/createRemoteMonitoringEnrollment';
import { searchRemoteMonitoringEnrollments } from '../../handlers/healthcare:support/searchRemoteMonitoringEnrollments';
import { getRemoteMonitoringEnrollment } from '../../handlers/healthcare:support/getRemoteMonitoringEnrollment';
import { updateRemoteMonitoringEnrollment } from '../../handlers/healthcare:support/updateRemoteMonitoringEnrollment';
import { patchRemoteMonitoringEnrollment } from '../../handlers/healthcare:support/patchRemoteMonitoringEnrollment';
import { deleteRemoteMonitoringEnrollment } from '../../handlers/healthcare:support/deleteRemoteMonitoringEnrollment';
import { createTelehealthSession } from '../../handlers/healthcare:support/createTelehealthSession';
import { searchTelehealthSessions } from '../../handlers/healthcare:support/searchTelehealthSessions';
import { getTelehealthSession } from '../../handlers/healthcare:support/getTelehealthSession';
import { updateTelehealthSession } from '../../handlers/healthcare:support/updateTelehealthSession';
import { patchTelehealthSession } from '../../handlers/healthcare:support/patchTelehealthSession';
import { deleteTelehealthSession } from '../../handlers/healthcare:support/deleteTelehealthSession';
import { endTelehealthSession } from '../../handlers/healthcare:support/endTelehealthSession';
import { startTelehealthSession } from '../../handlers/healthcare:support/startTelehealthSession';
import { getExecutionsByRule } from '../../handlers/healthcare:support/getExecutionsByRule';
import { searchWorkflowExecutions } from '../../handlers/healthcare:support/searchWorkflowExecutions';
import { searchTaskQueueItems } from '../../handlers/healthcare:support/searchTaskQueueItems';
import { claimTaskQueueItem } from '../../handlers/healthcare:support/claimTaskQueueItem';
import { completeTaskQueueItem } from '../../handlers/healthcare:support/completeTaskQueueItem';
import { returnTaskQueueItem } from '../../handlers/healthcare:support/returnTaskQueueItem';
import { createTaskQueue } from '../../handlers/healthcare:support/createTaskQueue';
import { searchTaskQueues } from '../../handlers/healthcare:support/searchTaskQueues';
import { getTaskQueue } from '../../handlers/healthcare:support/getTaskQueue';
import { updateTaskQueue } from '../../handlers/healthcare:support/updateTaskQueue';
import { deleteTaskQueue } from '../../handlers/healthcare:support/deleteTaskQueue';
import { createWorkflowRule } from '../../handlers/healthcare:support/createWorkflowRule';
import { searchWorkflowRules } from '../../handlers/healthcare:support/searchWorkflowRules';
import { getWorkflowRule } from '../../handlers/healthcare:support/getWorkflowRule';
import { updateWorkflowRule } from '../../handlers/healthcare:support/updateWorkflowRule';
import { deleteWorkflowRule } from '../../handlers/healthcare:support/deleteWorkflowRule';
import { disableWorkflowRule } from '../../handlers/healthcare:support/disableWorkflowRule';
import { enableWorkflowRule } from '../../handlers/healthcare:support/enableWorkflowRule';
import { testWorkflowRule } from '../../handlers/healthcare:support/testWorkflowRule';
import { createADTEvent } from '../../handlers/healthcare:clinical/createADTEvent';
import { getPatientADTTimeline } from '../../handlers/healthcare:clinical/getPatientADTTimeline';
import { searchADTEvents } from '../../handlers/healthcare:clinical/searchADTEvents';
import { getADTEvent } from '../../handlers/healthcare:clinical/getADTEvent';
import { createAllergyIntolerance } from '../../handlers/healthcare:clinical/createAllergyIntolerance';
import { searchAllergyIntolerances } from '../../handlers/healthcare:clinical/searchAllergyIntolerances';
import { getAllergyIntolerance } from '../../handlers/healthcare:clinical/getAllergyIntolerance';
import { updateAllergyIntolerance } from '../../handlers/healthcare:clinical/updateAllergyIntolerance';
import { patchAllergyIntolerance } from '../../handlers/healthcare:clinical/patchAllergyIntolerance';
import { deleteAllergyIntolerance } from '../../handlers/healthcare:clinical/deleteAllergyIntolerance';
import { createAnesthesiaRecord } from '../../handlers/healthcare:clinical/createAnesthesiaRecord';
import { searchAnesthesiaRecords } from '../../handlers/healthcare:clinical/searchAnesthesiaRecords';
import { getAnesthesiaRecord } from '../../handlers/healthcare:clinical/getAnesthesiaRecord';
import { updateAnesthesiaRecord } from '../../handlers/healthcare:clinical/updateAnesthesiaRecord';
import { deleteAnesthesiaRecord } from '../../handlers/healthcare:clinical/deleteAnesthesiaRecord';
import { createComposition } from '../../handlers/healthcare:clinical/createComposition';
import { searchCompositions } from '../../handlers/healthcare:clinical/searchCompositions';
import { getComposition } from '../../handlers/healthcare:clinical/getComposition';
import { updateComposition } from '../../handlers/healthcare:clinical/updateComposition';
import { patchComposition } from '../../handlers/healthcare:clinical/patchComposition';
import { deleteComposition } from '../../handlers/healthcare:clinical/deleteComposition';
import { createCondition } from '../../handlers/healthcare:clinical/createCondition';
import { searchConditions } from '../../handlers/healthcare:clinical/searchConditions';
import { getCondition } from '../../handlers/healthcare:clinical/getCondition';
import { updateCondition } from '../../handlers/healthcare:clinical/updateCondition';
import { patchCondition } from '../../handlers/healthcare:clinical/patchCondition';
import { deleteCondition } from '../../handlers/healthcare:clinical/deleteCondition';
import { createDocumentReference } from '../../handlers/healthcare:clinical/createDocumentReference';
import { searchDocumentReferences } from '../../handlers/healthcare:clinical/searchDocumentReferences';
import { getDocumentReference } from '../../handlers/healthcare:clinical/getDocumentReference';
import { updateDocumentReference } from '../../handlers/healthcare:clinical/updateDocumentReference';
import { patchDocumentReference } from '../../handlers/healthcare:clinical/patchDocumentReference';
import { deleteDocumentReference } from '../../handlers/healthcare:clinical/deleteDocumentReference';
import { createEncounter } from '../../handlers/healthcare:clinical/createEncounter';
import { searchEncounters } from '../../handlers/healthcare:clinical/searchEncounters';
import { getEncounter } from '../../handlers/healthcare:clinical/getEncounter';
import { updateEncounter } from '../../handlers/healthcare:clinical/updateEncounter';
import { patchEncounter } from '../../handlers/healthcare:clinical/patchEncounter';
import { deleteEncounter } from '../../handlers/healthcare:clinical/deleteEncounter';
import { transitionEncounterStatus } from '../../handlers/healthcare:clinical/transitionEncounterStatus';
import { createEpisodeOfCare } from '../../handlers/healthcare:clinical/createEpisodeOfCare';
import { searchEpisodesOfCare } from '../../handlers/healthcare:clinical/searchEpisodesOfCare';
import { getEpisodeOfCare } from '../../handlers/healthcare:clinical/getEpisodeOfCare';
import { updateEpisodeOfCare } from '../../handlers/healthcare:clinical/updateEpisodeOfCare';
import { patchEpisodeOfCare } from '../../handlers/healthcare:clinical/patchEpisodeOfCare';
import { deleteEpisodeOfCare } from '../../handlers/healthcare:clinical/deleteEpisodeOfCare';
import { transitionEpisodeOfCareStatus } from '../../handlers/healthcare:clinical/transitionEpisodeOfCareStatus';
import { createFamilyMemberHistory } from '../../handlers/healthcare:clinical/createFamilyMemberHistory';
import { searchFamilyMemberHistories } from '../../handlers/healthcare:clinical/searchFamilyMemberHistories';
import { getFamilyMemberHistory } from '../../handlers/healthcare:clinical/getFamilyMemberHistory';
import { updateFamilyMemberHistory } from '../../handlers/healthcare:clinical/updateFamilyMemberHistory';
import { patchFamilyMemberHistory } from '../../handlers/healthcare:clinical/patchFamilyMemberHistory';
import { deleteFamilyMemberHistory } from '../../handlers/healthcare:clinical/deleteFamilyMemberHistory';
import { createFlag } from '../../handlers/healthcare:clinical/createFlag';
import { searchFlags } from '../../handlers/healthcare:clinical/searchFlags';
import { getFlag } from '../../handlers/healthcare:clinical/getFlag';
import { updateFlag } from '../../handlers/healthcare:clinical/updateFlag';
import { patchFlag } from '../../handlers/healthcare:clinical/patchFlag';
import { deleteFlag } from '../../handlers/healthcare:clinical/deleteFlag';
import { createClinicalHandoff } from '../../handlers/healthcare:clinical/createClinicalHandoff';
import { searchClinicalHandoffs } from '../../handlers/healthcare:clinical/searchClinicalHandoffs';
import { getClinicalHandoff } from '../../handlers/healthcare:clinical/getClinicalHandoff';
import { updateClinicalHandoff } from '../../handlers/healthcare:clinical/updateClinicalHandoff';
import { deleteClinicalHandoff } from '../../handlers/healthcare:clinical/deleteClinicalHandoff';
import { createBehavioralHealthPlan } from '../../handlers/healthcare:clinical/createBehavioralHealthPlan';
import { searchBehavioralHealthPlans } from '../../handlers/healthcare:clinical/searchBehavioralHealthPlans';
import { getBehavioralHealthPlan } from '../../handlers/healthcare:clinical/getBehavioralHealthPlan';
import { updateBehavioralHealthPlan } from '../../handlers/healthcare:clinical/updateBehavioralHealthPlan';
import { deleteBehavioralHealthPlan } from '../../handlers/healthcare:clinical/deleteBehavioralHealthPlan';
import { createCancerDiagnosis } from '../../handlers/healthcare:clinical/createCancerDiagnosis';
import { searchCancerDiagnoses } from '../../handlers/healthcare:clinical/searchCancerDiagnoses';
import { getCancerDiagnosis } from '../../handlers/healthcare:clinical/getCancerDiagnosis';
import { updateCancerDiagnosis } from '../../handlers/healthcare:clinical/updateCancerDiagnosis';
import { deleteCancerDiagnosis } from '../../handlers/healthcare:clinical/deleteCancerDiagnosis';
import { createCardiacRehab } from '../../handlers/healthcare:clinical/createCardiacRehab';
import { searchCardiacRehabs } from '../../handlers/healthcare:clinical/searchCardiacRehabs';
import { getCardiacRehab } from '../../handlers/healthcare:clinical/getCardiacRehab';
import { updateCardiacRehab } from '../../handlers/healthcare:clinical/updateCardiacRehab';
import { deleteCardiacRehab } from '../../handlers/healthcare:clinical/deleteCardiacRehab';
import { createCardiacCathRecord } from '../../handlers/healthcare:clinical/createCardiacCathRecord';
import { searchCardiacCathRecords } from '../../handlers/healthcare:clinical/searchCardiacCathRecords';
import { getCardiacCathRecord } from '../../handlers/healthcare:clinical/getCardiacCathRecord';
import { updateCardiacCathRecord } from '../../handlers/healthcare:clinical/updateCardiacCathRecord';
import { deleteCardiacCathRecord } from '../../handlers/healthcare:clinical/deleteCardiacCathRecord';
import { createEchoReport } from '../../handlers/healthcare:clinical/createEchoReport';
import { searchEchoReports } from '../../handlers/healthcare:clinical/searchEchoReports';
import { getEchoReport } from '../../handlers/healthcare:clinical/getEchoReport';
import { updateEchoReport } from '../../handlers/healthcare:clinical/updateEchoReport';
import { deleteEchoReport } from '../../handlers/healthcare:clinical/deleteEchoReport';
import { createEPStudy } from '../../handlers/healthcare:clinical/createEPStudy';
import { searchEPStudies } from '../../handlers/healthcare:clinical/searchEPStudies';
import { getEPStudy } from '../../handlers/healthcare:clinical/getEPStudy';
import { updateEPStudy } from '../../handlers/healthcare:clinical/updateEPStudy';
import { deleteEPStudy } from '../../handlers/healthcare:clinical/deleteEPStudy';
import { createChemotherapyCycle } from '../../handlers/healthcare:clinical/createChemotherapyCycle';
import { searchChemotherapyCycles } from '../../handlers/healthcare:clinical/searchChemotherapyCycles';
import { getChemotherapyCycle } from '../../handlers/healthcare:clinical/getChemotherapyCycle';
import { updateChemotherapyCycle } from '../../handlers/healthcare:clinical/updateChemotherapyCycle';
import { deleteChemotherapyCycle } from '../../handlers/healthcare:clinical/deleteChemotherapyCycle';
import { createChemotherapyProtocol } from '../../handlers/healthcare:clinical/createChemotherapyProtocol';
import { searchChemotherapyProtocols } from '../../handlers/healthcare:clinical/searchChemotherapyProtocols';
import { getChemotherapyProtocol } from '../../handlers/healthcare:clinical/getChemotherapyProtocol';
import { updateChemotherapyProtocol } from '../../handlers/healthcare:clinical/updateChemotherapyProtocol';
import { deleteChemotherapyProtocol } from '../../handlers/healthcare:clinical/deleteChemotherapyProtocol';
import { createCodeBlueDebrief } from '../../handlers/healthcare:clinical/createCodeBlueDebrief';
import { searchCodeBlueDebriefs } from '../../handlers/healthcare:clinical/searchCodeBlueDebriefs';
import { getCodeBlueDebrief } from '../../handlers/healthcare:clinical/getCodeBlueDebrief';
import { updateCodeBlueDebrief } from '../../handlers/healthcare:clinical/updateCodeBlueDebrief';
import { deleteCodeBlueDebrief } from '../../handlers/healthcare:clinical/deleteCodeBlueDebrief';
import { createCodeBlueEvent } from '../../handlers/healthcare:clinical/createCodeBlueEvent';
import { getActiveCodeBlueEvents } from '../../handlers/healthcare:clinical/getActiveCodeBlueEvents';
import { searchCodeBlueEvents } from '../../handlers/healthcare:clinical/searchCodeBlueEvents';
import { getCodeBlueEvent } from '../../handlers/healthcare:clinical/getCodeBlueEvent';
import { updateCodeBlueEvent } from '../../handlers/healthcare:clinical/updateCodeBlueEvent';
import { patchCodeBlueEvent } from '../../handlers/healthcare:clinical/patchCodeBlueEvent';
import { deleteCodeBlueEvent } from '../../handlers/healthcare:clinical/deleteCodeBlueEvent';
import { createCodeBlueTeamRoster } from '../../handlers/healthcare:clinical/createCodeBlueTeamRoster';
import { getCodeBlueTeamRoster } from '../../handlers/healthcare:clinical/getCodeBlueTeamRoster';
import { updateCodeBlueTeamRoster } from '../../handlers/healthcare:clinical/updateCodeBlueTeamRoster';
import { patchCodeBlueTeamRoster } from '../../handlers/healthcare:clinical/patchCodeBlueTeamRoster';
import { deleteCodeBlueTeamRoster } from '../../handlers/healthcare:clinical/deleteCodeBlueTeamRoster';
import { createDialysisAccessRecord } from '../../handlers/healthcare:clinical/createDialysisAccessRecord';
import { searchDialysisAccessRecords } from '../../handlers/healthcare:clinical/searchDialysisAccessRecords';
import { getDialysisAccessRecord } from '../../handlers/healthcare:clinical/getDialysisAccessRecord';
import { updateDialysisAccessRecord } from '../../handlers/healthcare:clinical/updateDialysisAccessRecord';
import { deleteDialysisAccessRecord } from '../../handlers/healthcare:clinical/deleteDialysisAccessRecord';
import { createDialysisOrder } from '../../handlers/healthcare:clinical/createDialysisOrder';
import { searchDialysisOrders } from '../../handlers/healthcare:clinical/searchDialysisOrders';
import { getDialysisOrder } from '../../handlers/healthcare:clinical/getDialysisOrder';
import { updateDialysisOrder } from '../../handlers/healthcare:clinical/updateDialysisOrder';
import { deleteDialysisOrder } from '../../handlers/healthcare:clinical/deleteDialysisOrder';
import { createDialysisSession } from '../../handlers/healthcare:clinical/createDialysisSession';
import { searchDialysisSessions } from '../../handlers/healthcare:clinical/searchDialysisSessions';
import { getDialysisSession } from '../../handlers/healthcare:clinical/getDialysisSession';
import { updateDialysisSession } from '../../handlers/healthcare:clinical/updateDialysisSession';
import { deleteDialysisSession } from '../../handlers/healthcare:clinical/deleteDialysisSession';
import { getEDBoard } from '../../handlers/healthcare:clinical/getEDBoard';
import { createEDVisit } from '../../handlers/healthcare:clinical/createEDVisit';
import { searchEDVisits } from '../../handlers/healthcare:clinical/searchEDVisits';
import { getEDVisit } from '../../handlers/healthcare:clinical/getEDVisit';
import { updateEDVisit } from '../../handlers/healthcare:clinical/updateEDVisit';
import { patchEDVisit } from '../../handlers/healthcare:clinical/patchEDVisit';
import { deleteEDVisit } from '../../handlers/healthcare:clinical/deleteEDVisit';
import { createFallRiskAssessment } from '../../handlers/healthcare:clinical/createFallRiskAssessment';
import { searchFallRiskAssessments } from '../../handlers/healthcare:clinical/searchFallRiskAssessments';
import { getFallRiskAssessment } from '../../handlers/healthcare:clinical/getFallRiskAssessment';
import { updateFallRiskAssessment } from '../../handlers/healthcare:clinical/updateFallRiskAssessment';
import { deleteFallRiskAssessment } from '../../handlers/healthcare:clinical/deleteFallRiskAssessment';
import { createFlowsheetEntry } from '../../handlers/healthcare:clinical/createFlowsheetEntry';
import { searchFlowsheetEntries } from '../../handlers/healthcare:clinical/searchFlowsheetEntries';
import { getFlowsheetEntry } from '../../handlers/healthcare:clinical/getFlowsheetEntry';
import { updateFlowsheetEntry } from '../../handlers/healthcare:clinical/updateFlowsheetEntry';
import { deleteFlowsheetEntry } from '../../handlers/healthcare:clinical/deleteFlowsheetEntry';
import { createICUAdmission } from '../../handlers/healthcare:clinical/createICUAdmission';
import { searchICUAdmissions } from '../../handlers/healthcare:clinical/searchICUAdmissions';
import { getICUAdmission } from '../../handlers/healthcare:clinical/getICUAdmission';
import { updateICUAdmission } from '../../handlers/healthcare:clinical/updateICUAdmission';
import { deleteICUAdmission } from '../../handlers/healthcare:clinical/deleteICUAdmission';
import { transitionICUAdmissionStatus } from '../../handlers/healthcare:clinical/transitionICUAdmissionStatus';
import { createInvoluntaryHold } from '../../handlers/healthcare:clinical/createInvoluntaryHold';
import { searchInvoluntaryHolds } from '../../handlers/healthcare:clinical/searchInvoluntaryHolds';
import { getInvoluntaryHold } from '../../handlers/healthcare:clinical/getInvoluntaryHold';
import { updateInvoluntaryHold } from '../../handlers/healthcare:clinical/updateInvoluntaryHold';
import { deleteInvoluntaryHold } from '../../handlers/healthcare:clinical/deleteInvoluntaryHold';
import { createLaborRecord } from '../../handlers/healthcare:clinical/createLaborRecord';
import { searchLaborRecords } from '../../handlers/healthcare:clinical/searchLaborRecords';
import { getLaborRecord } from '../../handlers/healthcare:clinical/getLaborRecord';
import { updateLaborRecord } from '../../handlers/healthcare:clinical/updateLaborRecord';
import { deleteLaborRecord } from '../../handlers/healthcare:clinical/deleteLaborRecord';
import { createNICUAdmission } from '../../handlers/healthcare:clinical/createNICUAdmission';
import { searchNICUAdmissions } from '../../handlers/healthcare:clinical/searchNICUAdmissions';
import { getNICUAdmission } from '../../handlers/healthcare:clinical/getNICUAdmission';
import { updateNICUAdmission } from '../../handlers/healthcare:clinical/updateNICUAdmission';
import { deleteNICUAdmission } from '../../handlers/healthcare:clinical/deleteNICUAdmission';
import { createFeedingRecord } from '../../handlers/healthcare:clinical/createFeedingRecord';
import { searchFeedingRecords } from '../../handlers/healthcare:clinical/searchFeedingRecords';
import { getFeedingRecord } from '../../handlers/healthcare:clinical/getFeedingRecord';
import { updateFeedingRecord } from '../../handlers/healthcare:clinical/updateFeedingRecord';
import { deleteFeedingRecord } from '../../handlers/healthcare:clinical/deleteFeedingRecord';
import { createNewbornScreening } from '../../handlers/healthcare:clinical/createNewbornScreening';
import { searchNewbornScreenings } from '../../handlers/healthcare:clinical/searchNewbornScreenings';
import { getNewbornScreening } from '../../handlers/healthcare:clinical/getNewbornScreening';
import { updateNewbornScreening } from '../../handlers/healthcare:clinical/updateNewbornScreening';
import { deleteNewbornScreening } from '../../handlers/healthcare:clinical/deleteNewbornScreening';
import { createNeonatalVitals } from '../../handlers/healthcare:clinical/createNeonatalVitals';
import { searchNeonatalVitals } from '../../handlers/healthcare:clinical/searchNeonatalVitals';
import { getNeonatalVitals } from '../../handlers/healthcare:clinical/getNeonatalVitals';
import { updateNeonatalVitals } from '../../handlers/healthcare:clinical/updateNeonatalVitals';
import { deleteNeonatalVitals } from '../../handlers/healthcare:clinical/deleteNeonatalVitals';
import { createNewbornRecord } from '../../handlers/healthcare:clinical/createNewbornRecord';
import { searchNewbornRecords } from '../../handlers/healthcare:clinical/searchNewbornRecords';
import { getNewbornRecord } from '../../handlers/healthcare:clinical/getNewbornRecord';
import { updateNewbornRecord } from '../../handlers/healthcare:clinical/updateNewbornRecord';
import { deleteNewbornRecord } from '../../handlers/healthcare:clinical/deleteNewbornRecord';
import { createNursingAssessment } from '../../handlers/healthcare:clinical/createNursingAssessment';
import { searchNursingAssessments } from '../../handlers/healthcare:clinical/searchNursingAssessments';
import { getNursingAssessment } from '../../handlers/healthcare:clinical/getNursingAssessment';
import { updateNursingAssessment } from '../../handlers/healthcare:clinical/updateNursingAssessment';
import { patchNursingAssessment } from '../../handlers/healthcare:clinical/patchNursingAssessment';
import { deleteNursingAssessment } from '../../handlers/healthcare:clinical/deleteNursingAssessment';
import { createOrderSet } from '../../handlers/healthcare:clinical/createOrderSet';
import { applyOrderSet } from '../../handlers/healthcare:clinical/applyOrderSet';
import { searchOrderSets } from '../../handlers/healthcare:clinical/searchOrderSets';
import { getOrderSet } from '../../handlers/healthcare:clinical/getOrderSet';
import { updateOrderSet } from '../../handlers/healthcare:clinical/updateOrderSet';
import { deleteOrderSet } from '../../handlers/healthcare:clinical/deleteOrderSet';
import { createOrderVerification } from '../../handlers/healthcare:clinical/createOrderVerification';
import { searchOrderVerifications } from '../../handlers/healthcare:clinical/searchOrderVerifications';
import { createClinicalOrder } from '../../handlers/healthcare:clinical/createClinicalOrder';
import { searchClinicalOrders } from '../../handlers/healthcare:clinical/searchClinicalOrders';
import { getClinicalOrder } from '../../handlers/healthcare:clinical/getClinicalOrder';
import { updateClinicalOrder } from '../../handlers/healthcare:clinical/updateClinicalOrder';
import { patchClinicalOrder } from '../../handlers/healthcare:clinical/patchClinicalOrder';
import { deleteClinicalOrder } from '../../handlers/healthcare:clinical/deleteClinicalOrder';
import { coSignClinicalOrder } from '../../handlers/healthcare:clinical/coSignClinicalOrder';
import { createPainAssessment } from '../../handlers/healthcare:clinical/createPainAssessment';
import { searchPainAssessments } from '../../handlers/healthcare:clinical/searchPainAssessments';
import { getPainAssessment } from '../../handlers/healthcare:clinical/getPainAssessment';
import { updatePainAssessment } from '../../handlers/healthcare:clinical/updatePainAssessment';
import { deletePainAssessment } from '../../handlers/healthcare:clinical/deletePainAssessment';
import { createGoalsOfCareDiscussion } from '../../handlers/healthcare:clinical/createGoalsOfCareDiscussion';
import { searchGoalsOfCareDiscussions } from '../../handlers/healthcare:clinical/searchGoalsOfCareDiscussions';
import { getGoalsOfCareDiscussion } from '../../handlers/healthcare:clinical/getGoalsOfCareDiscussion';
import { updateGoalsOfCareDiscussion } from '../../handlers/healthcare:clinical/updateGoalsOfCareDiscussion';
import { deleteGoalsOfCareDiscussion } from '../../handlers/healthcare:clinical/deleteGoalsOfCareDiscussion';
import { createHospiceEligibility } from '../../handlers/healthcare:clinical/createHospiceEligibility';
import { searchHospiceEligibilities } from '../../handlers/healthcare:clinical/searchHospiceEligibilities';
import { getHospiceEligibility } from '../../handlers/healthcare:clinical/getHospiceEligibility';
import { updateHospiceEligibility } from '../../handlers/healthcare:clinical/updateHospiceEligibility';
import { deleteHospiceEligibility } from '../../handlers/healthcare:clinical/deleteHospiceEligibility';
import { createHospiceIDTMeeting } from '../../handlers/healthcare:clinical/createHospiceIDTMeeting';
import { searchHospiceIDTMeetings } from '../../handlers/healthcare:clinical/searchHospiceIDTMeetings';
import { getHospiceIDTMeeting } from '../../handlers/healthcare:clinical/getHospiceIDTMeeting';
import { updateHospiceIDTMeeting } from '../../handlers/healthcare:clinical/updateHospiceIDTMeeting';
import { deleteHospiceIDTMeeting } from '../../handlers/healthcare:clinical/deleteHospiceIDTMeeting';
import { createSymptomAssessment } from '../../handlers/healthcare:clinical/createSymptomAssessment';
import { searchSymptomAssessments } from '../../handlers/healthcare:clinical/searchSymptomAssessments';
import { getSymptomAssessment } from '../../handlers/healthcare:clinical/getSymptomAssessment';
import { updateSymptomAssessment } from '../../handlers/healthcare:clinical/updateSymptomAssessment';
import { deleteSymptomAssessment } from '../../handlers/healthcare:clinical/deleteSymptomAssessment';
import { createADLAssessment } from '../../handlers/healthcare:clinical/createADLAssessment';
import { searchADLAssessments } from '../../handlers/healthcare:clinical/searchADLAssessments';
import { getADLAssessment } from '../../handlers/healthcare:clinical/getADLAssessment';
import { updateADLAssessment } from '../../handlers/healthcare:clinical/updateADLAssessment';
import { deleteADLAssessment } from '../../handlers/healthcare:clinical/deleteADLAssessment';
import { createPostAcuteAdmission } from '../../handlers/healthcare:clinical/createPostAcuteAdmission';
import { searchPostAcuteAdmissions } from '../../handlers/healthcare:clinical/searchPostAcuteAdmissions';
import { getPostAcuteAdmission } from '../../handlers/healthcare:clinical/getPostAcuteAdmission';
import { updatePostAcuteAdmission } from '../../handlers/healthcare:clinical/updatePostAcuteAdmission';
import { deletePostAcuteAdmission } from '../../handlers/healthcare:clinical/deletePostAcuteAdmission';
import { createHomeHealthCertification } from '../../handlers/healthcare:clinical/createHomeHealthCertification';
import { searchHomeHealthCertifications } from '../../handlers/healthcare:clinical/searchHomeHealthCertifications';
import { getHomeHealthCertification } from '../../handlers/healthcare:clinical/getHomeHealthCertification';
import { updateHomeHealthCertification } from '../../handlers/healthcare:clinical/updateHomeHealthCertification';
import { deleteHomeHealthCertification } from '../../handlers/healthcare:clinical/deleteHomeHealthCertification';
import { createMDSAssessment } from '../../handlers/healthcare:clinical/createMDSAssessment';
import { searchMDSAssessments } from '../../handlers/healthcare:clinical/searchMDSAssessments';
import { getMDSAssessment } from '../../handlers/healthcare:clinical/getMDSAssessment';
import { updateMDSAssessment } from '../../handlers/healthcare:clinical/updateMDSAssessment';
import { deleteMDSAssessment } from '../../handlers/healthcare:clinical/deleteMDSAssessment';
import { createOASISAssessment } from '../../handlers/healthcare:clinical/createOASISAssessment';
import { searchOASISAssessments } from '../../handlers/healthcare:clinical/searchOASISAssessments';
import { getOASISAssessment } from '../../handlers/healthcare:clinical/getOASISAssessment';
import { updateOASISAssessment } from '../../handlers/healthcare:clinical/updateOASISAssessment';
import { deleteOASISAssessment } from '../../handlers/healthcare:clinical/deleteOASISAssessment';
import { createPostpartumAssessment } from '../../handlers/healthcare:clinical/createPostpartumAssessment';
import { searchPostpartumAssessments } from '../../handlers/healthcare:clinical/searchPostpartumAssessments';
import { getPostpartumAssessment } from '../../handlers/healthcare:clinical/getPostpartumAssessment';
import { updatePostpartumAssessment } from '../../handlers/healthcare:clinical/updatePostpartumAssessment';
import { deletePostpartumAssessment } from '../../handlers/healthcare:clinical/deletePostpartumAssessment';
import { createPregnancyRecord } from '../../handlers/healthcare:clinical/createPregnancyRecord';
import { searchPregnancyRecords } from '../../handlers/healthcare:clinical/searchPregnancyRecords';
import { getPregnancyRecord } from '../../handlers/healthcare:clinical/getPregnancyRecord';
import { updatePregnancyRecord } from '../../handlers/healthcare:clinical/updatePregnancyRecord';
import { deletePregnancyRecord } from '../../handlers/healthcare:clinical/deletePregnancyRecord';
import { createPressureInjuryRisk } from '../../handlers/healthcare:clinical/createPressureInjuryRisk';
import { searchPressureInjuryRisks } from '../../handlers/healthcare:clinical/searchPressureInjuryRisks';
import { getPressureInjuryRisk } from '../../handlers/healthcare:clinical/getPressureInjuryRisk';
import { updatePressureInjuryRisk } from '../../handlers/healthcare:clinical/updatePressureInjuryRisk';
import { deletePressureInjuryRisk } from '../../handlers/healthcare:clinical/deletePressureInjuryRisk';
import { createPsychiatricAssessment } from '../../handlers/healthcare:clinical/createPsychiatricAssessment';
import { searchPsychiatricAssessments } from '../../handlers/healthcare:clinical/searchPsychiatricAssessments';
import { getPsychiatricAssessment } from '../../handlers/healthcare:clinical/getPsychiatricAssessment';
import { updatePsychiatricAssessment } from '../../handlers/healthcare:clinical/updatePsychiatricAssessment';
import { deletePsychiatricAssessment } from '../../handlers/healthcare:clinical/deletePsychiatricAssessment';
import { createRadiationTherapy } from '../../handlers/healthcare:clinical/createRadiationTherapy';
import { searchRadiationTherapy } from '../../handlers/healthcare:clinical/searchRadiationTherapy';
import { getRadiationTherapy } from '../../handlers/healthcare:clinical/getRadiationTherapy';
import { updateRadiationTherapy } from '../../handlers/healthcare:clinical/updateRadiationTherapy';
import { deleteRadiationTherapy } from '../../handlers/healthcare:clinical/deleteRadiationTherapy';
import { createRehabEvaluation } from '../../handlers/healthcare:clinical/createRehabEvaluation';
import { searchRehabEvaluations } from '../../handlers/healthcare:clinical/searchRehabEvaluations';
import { getRehabEvaluation } from '../../handlers/healthcare:clinical/getRehabEvaluation';
import { updateRehabEvaluation } from '../../handlers/healthcare:clinical/updateRehabEvaluation';
import { deleteRehabEvaluation } from '../../handlers/healthcare:clinical/deleteRehabEvaluation';
import { createFunctionalOutcome } from '../../handlers/healthcare:clinical/createFunctionalOutcome';
import { searchFunctionalOutcomes } from '../../handlers/healthcare:clinical/searchFunctionalOutcomes';
import { getFunctionalOutcome } from '../../handlers/healthcare:clinical/getFunctionalOutcome';
import { updateFunctionalOutcome } from '../../handlers/healthcare:clinical/updateFunctionalOutcome';
import { deleteFunctionalOutcome } from '../../handlers/healthcare:clinical/deleteFunctionalOutcome';
import { createRehabReferral } from '../../handlers/healthcare:clinical/createRehabReferral';
import { searchRehabReferrals } from '../../handlers/healthcare:clinical/searchRehabReferrals';
import { getRehabReferral } from '../../handlers/healthcare:clinical/getRehabReferral';
import { updateRehabReferral } from '../../handlers/healthcare:clinical/updateRehabReferral';
import { deleteRehabReferral } from '../../handlers/healthcare:clinical/deleteRehabReferral';
import { createRehabSession } from '../../handlers/healthcare:clinical/createRehabSession';
import { searchRehabSessions } from '../../handlers/healthcare:clinical/searchRehabSessions';
import { getRehabSession } from '../../handlers/healthcare:clinical/getRehabSession';
import { updateRehabSession } from '../../handlers/healthcare:clinical/updateRehabSession';
import { deleteRehabSession } from '../../handlers/healthcare:clinical/deleteRehabSession';
import { createABGResult } from '../../handlers/healthcare:clinical/createABGResult';
import { searchABGResults } from '../../handlers/healthcare:clinical/searchABGResults';
import { getABGResult } from '../../handlers/healthcare:clinical/getABGResult';
import { updateABGResult } from '../../handlers/healthcare:clinical/updateABGResult';
import { deleteABGResult } from '../../handlers/healthcare:clinical/deleteABGResult';
import { createRespiratoryOrder } from '../../handlers/healthcare:clinical/createRespiratoryOrder';
import { searchRespiratoryOrders } from '../../handlers/healthcare:clinical/searchRespiratoryOrders';
import { getRespiratoryOrder } from '../../handlers/healthcare:clinical/getRespiratoryOrder';
import { updateRespiratoryOrder } from '../../handlers/healthcare:clinical/updateRespiratoryOrder';
import { deleteRespiratoryOrder } from '../../handlers/healthcare:clinical/deleteRespiratoryOrder';
import { createPFT } from '../../handlers/healthcare:clinical/createPFT';
import { searchPFTs } from '../../handlers/healthcare:clinical/searchPFTs';
import { getPFT } from '../../handlers/healthcare:clinical/getPFT';
import { updatePFT } from '../../handlers/healthcare:clinical/updatePFT';
import { deletePFT } from '../../handlers/healthcare:clinical/deletePFT';
import { createRespiratoryTreatment } from '../../handlers/healthcare:clinical/createRespiratoryTreatment';
import { searchRespiratoryTreatments } from '../../handlers/healthcare:clinical/searchRespiratoryTreatments';
import { getRespiratoryTreatment } from '../../handlers/healthcare:clinical/getRespiratoryTreatment';
import { updateRespiratoryTreatment } from '../../handlers/healthcare:clinical/updateRespiratoryTreatment';
import { deleteRespiratoryTreatment } from '../../handlers/healthcare:clinical/deleteRespiratoryTreatment';
import { createSeverityScore } from '../../handlers/healthcare:clinical/createSeverityScore';
import { searchSeverityScores } from '../../handlers/healthcare:clinical/searchSeverityScores';
import { getSeverityScore } from '../../handlers/healthcare:clinical/getSeverityScore';
import { updateSeverityScore } from '../../handlers/healthcare:clinical/updateSeverityScore';
import { deleteSeverityScore } from '../../handlers/healthcare:clinical/deleteSeverityScore';
import { createSubstanceUseAssessment } from '../../handlers/healthcare:clinical/createSubstanceUseAssessment';
import { searchSubstanceUseAssessments } from '../../handlers/healthcare:clinical/searchSubstanceUseAssessments';
import { getSubstanceUseAssessment } from '../../handlers/healthcare:clinical/getSubstanceUseAssessment';
import { updateSubstanceUseAssessment } from '../../handlers/healthcare:clinical/updateSubstanceUseAssessment';
import { deleteSubstanceUseAssessment } from '../../handlers/healthcare:clinical/deleteSubstanceUseAssessment';
import { createTriageAssessment } from '../../handlers/healthcare:clinical/createTriageAssessment';
import { searchTriageAssessments } from '../../handlers/healthcare:clinical/searchTriageAssessments';
import { getTriageAssessment } from '../../handlers/healthcare:clinical/getTriageAssessment';
import { updateTriageAssessment } from '../../handlers/healthcare:clinical/updateTriageAssessment';
import { deleteTriageAssessment } from '../../handlers/healthcare:clinical/deleteTriageAssessment';
import { createVentilatorRecord } from '../../handlers/healthcare:clinical/createVentilatorRecord';
import { searchVentilatorRecords } from '../../handlers/healthcare:clinical/searchVentilatorRecords';
import { getVentilatorRecord } from '../../handlers/healthcare:clinical/getVentilatorRecord';
import { updateVentilatorRecord } from '../../handlers/healthcare:clinical/updateVentilatorRecord';
import { deleteVentilatorRecord } from '../../handlers/healthcare:clinical/deleteVentilatorRecord';
import { createWoundAssessment } from '../../handlers/healthcare:clinical/createWoundAssessment';
import { searchWoundAssessments } from '../../handlers/healthcare:clinical/searchWoundAssessments';
import { getWoundAssessment } from '../../handlers/healthcare:clinical/getWoundAssessment';
import { updateWoundAssessment } from '../../handlers/healthcare:clinical/updateWoundAssessment';
import { patchWoundAssessment } from '../../handlers/healthcare:clinical/patchWoundAssessment';
import { deleteWoundAssessment } from '../../handlers/healthcare:clinical/deleteWoundAssessment';
import { createWoundCareOrder } from '../../handlers/healthcare:clinical/createWoundCareOrder';
import { searchWoundCareOrders } from '../../handlers/healthcare:clinical/searchWoundCareOrders';
import { getWoundCareOrder } from '../../handlers/healthcare:clinical/getWoundCareOrder';
import { updateWoundCareOrder } from '../../handlers/healthcare:clinical/updateWoundCareOrder';
import { patchWoundCareOrder } from '../../handlers/healthcare:clinical/patchWoundCareOrder';
import { deleteWoundCareOrder } from '../../handlers/healthcare:clinical/deleteWoundCareOrder';
import { createWoundTreatment } from '../../handlers/healthcare:clinical/createWoundTreatment';
import { searchWoundTreatments } from '../../handlers/healthcare:clinical/searchWoundTreatments';
import { getWoundTreatment } from '../../handlers/healthcare:clinical/getWoundTreatment';
import { updateWoundTreatment } from '../../handlers/healthcare:clinical/updateWoundTreatment';
import { deleteWoundTreatment } from '../../handlers/healthcare:clinical/deleteWoundTreatment';
import { createImmunization } from '../../handlers/healthcare:clinical/createImmunization';
import { searchImmunizations } from '../../handlers/healthcare:clinical/searchImmunizations';
import { getImmunization } from '../../handlers/healthcare:clinical/getImmunization';
import { updateImmunization } from '../../handlers/healthcare:clinical/updateImmunization';
import { patchImmunization } from '../../handlers/healthcare:clinical/patchImmunization';
import { deleteImmunization } from '../../handlers/healthcare:clinical/deleteImmunization';
import { createMedicationRequest } from '../../handlers/healthcare:clinical/createMedicationRequest';
import { searchMedicationRequests } from '../../handlers/healthcare:clinical/searchMedicationRequests';
import { getMedicationRequest } from '../../handlers/healthcare:clinical/getMedicationRequest';
import { updateMedicationRequest } from '../../handlers/healthcare:clinical/updateMedicationRequest';
import { patchMedicationRequest } from '../../handlers/healthcare:clinical/patchMedicationRequest';
import { deleteMedicationRequest } from '../../handlers/healthcare:clinical/deleteMedicationRequest';
import { transitionMedicationRequestStatus } from '../../handlers/healthcare:clinical/transitionMedicationRequestStatus';
import { sendClinicalMessage } from '../../handlers/healthcare:clinical/sendClinicalMessage';
import { searchClinicalMessages } from '../../handlers/healthcare:clinical/searchClinicalMessages';
import { getClinicalMessage } from '../../handlers/healthcare:clinical/getClinicalMessage';
import { updateClinicalMessage } from '../../handlers/healthcare:clinical/updateClinicalMessage';
import { deleteClinicalMessage } from '../../handlers/healthcare:clinical/deleteClinicalMessage';
import { acknowledgeClinicalMessage } from '../../handlers/healthcare:clinical/acknowledgeClinicalMessage';
import { createObservation } from '../../handlers/healthcare:clinical/createObservation';
import { bulkCreateObservations } from '../../handlers/healthcare:clinical/bulkCreateObservations';
import { searchObservations } from '../../handlers/healthcare:clinical/searchObservations';
import { getObservation } from '../../handlers/healthcare:clinical/getObservation';
import { updateObservation } from '../../handlers/healthcare:clinical/updateObservation';
import { patchObservation } from '../../handlers/healthcare:clinical/patchObservation';
import { deleteObservation } from '../../handlers/healthcare:clinical/deleteObservation';
import { createOperatingRoom } from '../../handlers/healthcare:clinical/createOperatingRoom';
import { searchOperatingRooms } from '../../handlers/healthcare:clinical/searchOperatingRooms';
import { getOperatingRoom } from '../../handlers/healthcare:clinical/getOperatingRoom';
import { updateOperatingRoom } from '../../handlers/healthcare:clinical/updateOperatingRoom';
import { deleteOperatingRoom } from '../../handlers/healthcare:clinical/deleteOperatingRoom';
import { createProcedure } from '../../handlers/healthcare:clinical/createProcedure';
import { searchProcedures } from '../../handlers/healthcare:clinical/searchProcedures';
import { getProcedure } from '../../handlers/healthcare:clinical/getProcedure';
import { updateProcedure } from '../../handlers/healthcare:clinical/updateProcedure';
import { patchProcedure } from '../../handlers/healthcare:clinical/patchProcedure';
import { deleteProcedure } from '../../handlers/healthcare:clinical/deleteProcedure';
import { createRelatedPerson } from '../../handlers/healthcare:clinical/createRelatedPerson';
import { searchRelatedPersons } from '../../handlers/healthcare:clinical/searchRelatedPersons';
import { getRelatedPerson } from '../../handlers/healthcare:clinical/getRelatedPerson';
import { updateRelatedPerson } from '../../handlers/healthcare:clinical/updateRelatedPerson';
import { patchRelatedPerson } from '../../handlers/healthcare:clinical/patchRelatedPerson';
import { deleteRelatedPerson } from '../../handlers/healthcare:clinical/deleteRelatedPerson';
import { createServiceRequest } from '../../handlers/healthcare:clinical/createServiceRequest';
import { searchServiceRequests } from '../../handlers/healthcare:clinical/searchServiceRequests';
import { getServiceRequest } from '../../handlers/healthcare:clinical/getServiceRequest';
import { updateServiceRequest } from '../../handlers/healthcare:clinical/updateServiceRequest';
import { patchServiceRequest } from '../../handlers/healthcare:clinical/patchServiceRequest';
import { deleteServiceRequest } from '../../handlers/healthcare:clinical/deleteServiceRequest';
import { transitionServiceRequestStatus } from '../../handlers/healthcare:clinical/transitionServiceRequestStatus';
import { createSurgicalCase } from '../../handlers/healthcare:clinical/createSurgicalCase';
import { searchSurgicalCases } from '../../handlers/healthcare:clinical/searchSurgicalCases';
import { getSurgicalCase } from '../../handlers/healthcare:clinical/getSurgicalCase';
import { updateSurgicalCase } from '../../handlers/healthcare:clinical/updateSurgicalCase';
import { deleteSurgicalCase } from '../../handlers/healthcare:clinical/deleteSurgicalCase';
import { transitionSurgicalCaseStatus } from '../../handlers/healthcare:clinical/transitionSurgicalCaseStatus';
import { createPolicyAttestation } from '../../handlers/healthcare:compliance/createPolicyAttestation';
import { searchPolicyAttestations } from '../../handlers/healthcare:compliance/searchPolicyAttestations';
import { getPolicyAttestation } from '../../handlers/healthcare:compliance/getPolicyAttestation';
import { updatePolicyAttestation } from '../../handlers/healthcare:compliance/updatePolicyAttestation';
import { deletePolicyAttestation } from '../../handlers/healthcare:compliance/deletePolicyAttestation';
import { createBAARecord } from '../../handlers/healthcare:compliance/createBAARecord';
import { searchBAARecords } from '../../handlers/healthcare:compliance/searchBAARecords';
import { getBAARecord } from '../../handlers/healthcare:compliance/getBAARecord';
import { updateBAARecord } from '../../handlers/healthcare:compliance/updateBAARecord';
import { deleteBAARecord } from '../../handlers/healthcare:compliance/deleteBAARecord';
import { createCAPARecord } from '../../handlers/healthcare:compliance/createCAPARecord';
import { searchCAPARecords } from '../../handlers/healthcare:compliance/searchCAPARecords';
import { getCAPARecord } from '../../handlers/healthcare:compliance/getCAPARecord';
import { updateCAPARecord } from '../../handlers/healthcare:compliance/updateCAPARecord';
import { deleteCAPARecord } from '../../handlers/healthcare:compliance/deleteCAPARecord';
import { transitionCAPAStatus } from '../../handlers/healthcare:compliance/transitionCAPAStatus';
import { createRetentionSchedule } from '../../handlers/healthcare:compliance/createRetentionSchedule';
import { searchRetentionSchedules } from '../../handlers/healthcare:compliance/searchRetentionSchedules';
import { getRetentionSchedule } from '../../handlers/healthcare:compliance/getRetentionSchedule';
import { updateRetentionSchedule } from '../../handlers/healthcare:compliance/updateRetentionSchedule';
import { deleteRetentionSchedule } from '../../handlers/healthcare:compliance/deleteRetentionSchedule';
import { createLegalHold } from '../../handlers/healthcare:compliance/createLegalHold';
import { searchLegalHolds } from '../../handlers/healthcare:compliance/searchLegalHolds';
import { getLegalHold } from '../../handlers/healthcare:compliance/getLegalHold';
import { updateLegalHold } from '../../handlers/healthcare:compliance/updateLegalHold';
import { deleteLegalHold } from '../../handlers/healthcare:compliance/deleteLegalHold';
import { releaseLegalHold } from '../../handlers/healthcare:compliance/releaseLegalHold';
import { createCompliancePolicy } from '../../handlers/healthcare:compliance/createCompliancePolicy';
import { searchCompliancePolicies } from '../../handlers/healthcare:compliance/searchCompliancePolicies';
import { getCompliancePolicy } from '../../handlers/healthcare:compliance/getCompliancePolicy';
import { updateCompliancePolicy } from '../../handlers/healthcare:compliance/updateCompliancePolicy';
import { deleteCompliancePolicy } from '../../handlers/healthcare:compliance/deleteCompliancePolicy';
import { createAmendmentRequest } from '../../handlers/healthcare:compliance/createAmendmentRequest';
import { searchAmendmentRequests } from '../../handlers/healthcare:compliance/searchAmendmentRequests';
import { getAmendmentRequest } from '../../handlers/healthcare:compliance/getAmendmentRequest';
import { updateAmendmentRequest } from '../../handlers/healthcare:compliance/updateAmendmentRequest';
import { deleteAmendmentRequest } from '../../handlers/healthcare:compliance/deleteAmendmentRequest';
import { approveAmendmentRequest } from '../../handlers/healthcare:compliance/approveAmendmentRequest';
import { denyAmendmentRequest } from '../../handlers/healthcare:compliance/denyAmendmentRequest';
import { createBreachAssessment } from '../../handlers/healthcare:compliance/createBreachAssessment';
import { searchBreachAssessments } from '../../handlers/healthcare:compliance/searchBreachAssessments';
import { getBreachAssessment } from '../../handlers/healthcare:compliance/getBreachAssessment';
import { updateBreachAssessment } from '../../handlers/healthcare:compliance/updateBreachAssessment';
import { deleteBreachAssessment } from '../../handlers/healthcare:compliance/deleteBreachAssessment';
import { createBreachNotification } from '../../handlers/healthcare:compliance/createBreachNotification';
import { searchBreachNotifications } from '../../handlers/healthcare:compliance/searchBreachNotifications';
import { getBreachNotification } from '../../handlers/healthcare:compliance/getBreachNotification';
import { updateBreachNotification } from '../../handlers/healthcare:compliance/updateBreachNotification';
import { deleteBreachNotification } from '../../handlers/healthcare:compliance/deleteBreachNotification';
import { createPrivacyComplaint } from '../../handlers/healthcare:compliance/createPrivacyComplaint';
import { searchPrivacyComplaints } from '../../handlers/healthcare:compliance/searchPrivacyComplaints';
import { getPrivacyComplaint } from '../../handlers/healthcare:compliance/getPrivacyComplaint';
import { updatePrivacyComplaint } from '../../handlers/healthcare:compliance/updatePrivacyComplaint';
import { deletePrivacyComplaint } from '../../handlers/healthcare:compliance/deletePrivacyComplaint';
import { transitionPrivacyComplaintStatus } from '../../handlers/healthcare:compliance/transitionPrivacyComplaintStatus';
import { createDisclosureRecord } from '../../handlers/healthcare:compliance/createDisclosureRecord';
import { searchDisclosureRecords } from '../../handlers/healthcare:compliance/searchDisclosureRecords';
import { getDisclosureRecord } from '../../handlers/healthcare:compliance/getDisclosureRecord';
import { createConnector } from '../../handlers/healthcare:operational/createConnector';
import { createConnectorCredential } from '../../handlers/healthcare:operational/createConnectorCredential';
import { rotateConnectorCredential } from '../../handlers/healthcare:operational/rotateConnectorCredential';
import { searchConnectors } from '../../handlers/healthcare:operational/searchConnectors';
import { getLatestConnectorSyncLog } from '../../handlers/healthcare:operational/getLatestConnectorSyncLog';
import { searchConnectorSyncLogs } from '../../handlers/healthcare:operational/searchConnectorSyncLogs';
import { getConnector } from '../../handlers/healthcare:operational/getConnector';
import { updateConnector } from '../../handlers/healthcare:operational/updateConnector';
import { patchConnector } from '../../handlers/healthcare:operational/patchConnector';
import { deleteConnector } from '../../handlers/healthcare:operational/deleteConnector';
import { getConnectorHealth } from '../../handlers/healthcare:operational/getConnectorHealth';
import { testConnector } from '../../handlers/healthcare:operational/testConnector';
import { createDeviceAssignment } from '../../handlers/healthcare:operational/createDeviceAssignment';
import { searchDeviceAssignments } from '../../handlers/healthcare:operational/searchDeviceAssignments';
import { getDeviceAssignment } from '../../handlers/healthcare:operational/getDeviceAssignment';
import { updateDeviceAssignment } from '../../handlers/healthcare:operational/updateDeviceAssignment';
import { patchDeviceAssignment } from '../../handlers/healthcare:operational/patchDeviceAssignment';
import { deleteDeviceAssignment } from '../../handlers/healthcare:operational/deleteDeviceAssignment';
import { createDeviceMetric } from '../../handlers/healthcare:operational/createDeviceMetric';
import { searchDeviceMetrics } from '../../handlers/healthcare:operational/searchDeviceMetrics';
import { getDeviceMetric } from '../../handlers/healthcare:operational/getDeviceMetric';
import { updateDeviceMetric } from '../../handlers/healthcare:operational/updateDeviceMetric';
import { patchDeviceMetric } from '../../handlers/healthcare:operational/patchDeviceMetric';
import { deleteDeviceMetric } from '../../handlers/healthcare:operational/deleteDeviceMetric';
import { createDevice } from '../../handlers/healthcare:operational/createDevice';
import { searchDevices } from '../../handlers/healthcare:operational/searchDevices';
import { getDevice } from '../../handlers/healthcare:operational/getDevice';
import { updateDevice } from '../../handlers/healthcare:operational/updateDevice';
import { patchDevice } from '../../handlers/healthcare:operational/patchDevice';
import { deleteDevice } from '../../handlers/healthcare:operational/deleteDevice';
import { createBiologicalIndicator } from '../../handlers/healthcare:operational/createBiologicalIndicator';
import { searchBiologicalIndicators } from '../../handlers/healthcare:operational/searchBiologicalIndicators';
import { getBiologicalIndicator } from '../../handlers/healthcare:operational/getBiologicalIndicator';
import { updateBiologicalIndicator } from '../../handlers/healthcare:operational/updateBiologicalIndicator';
import { deleteBiologicalIndicator } from '../../handlers/healthcare:operational/deleteBiologicalIndicator';
import { createBodyRelease } from '../../handlers/healthcare:operational/createBodyRelease';
import { searchBodyReleases } from '../../handlers/healthcare:operational/searchBodyReleases';
import { getBodyRelease } from '../../handlers/healthcare:operational/getBodyRelease';
import { updateBodyRelease } from '../../handlers/healthcare:operational/updateBodyRelease';
import { deleteBodyRelease } from '../../handlers/healthcare:operational/deleteBodyRelease';
import { createCleaningSchedule } from '../../handlers/healthcare:operational/createCleaningSchedule';
import { searchCleaningSchedules } from '../../handlers/healthcare:operational/searchCleaningSchedules';
import { getCleaningSchedule } from '../../handlers/healthcare:operational/getCleaningSchedule';
import { updateCleaningSchedule } from '../../handlers/healthcare:operational/updateCleaningSchedule';
import { deleteCleaningSchedule } from '../../handlers/healthcare:operational/deleteCleaningSchedule';
import { createCleaningTask } from '../../handlers/healthcare:operational/createCleaningTask';
import { searchCleaningTasks } from '../../handlers/healthcare:operational/searchCleaningTasks';
import { getCleaningTask } from '../../handlers/healthcare:operational/getCleaningTask';
import { updateCleaningTask } from '../../handlers/healthcare:operational/updateCleaningTask';
import { deleteCleaningTask } from '../../handlers/healthcare:operational/deleteCleaningTask';
import { assignCleaningTask } from '../../handlers/healthcare:operational/assignCleaningTask';
import { completeCleaningTask } from '../../handlers/healthcare:operational/completeCleaningTask';
import { verifyCleaningTask } from '../../handlers/healthcare:operational/verifyCleaningTask';
import { createDeceasedRecord } from '../../handlers/healthcare:operational/createDeceasedRecord';
import { searchDeceasedRecords } from '../../handlers/healthcare:operational/searchDeceasedRecords';
import { getDeceasedRecord } from '../../handlers/healthcare:operational/getDeceasedRecord';
import { updateDeceasedRecord } from '../../handlers/healthcare:operational/updateDeceasedRecord';
import { deleteDeceasedRecord } from '../../handlers/healthcare:operational/deleteDeceasedRecord';
import { createDietOrder } from '../../handlers/healthcare:operational/createDietOrder';
import { searchDietOrders } from '../../handlers/healthcare:operational/searchDietOrders';
import { getDietOrder } from '../../handlers/healthcare:operational/getDietOrder';
import { updateDietOrder } from '../../handlers/healthcare:operational/updateDietOrder';
import { deleteDietOrder } from '../../handlers/healthcare:operational/deleteDietOrder';
import { createEmergencyActivation } from '../../handlers/healthcare:operational/createEmergencyActivation';
import { activateEmergencyPlan } from '../../handlers/healthcare:operational/activateEmergencyPlan';
import { searchEmergencyActivations } from '../../handlers/healthcare:operational/searchEmergencyActivations';
import { getEmergencyActivation } from '../../handlers/healthcare:operational/getEmergencyActivation';
import { updateEmergencyActivation } from '../../handlers/healthcare:operational/updateEmergencyActivation';
import { deleteEmergencyActivation } from '../../handlers/healthcare:operational/deleteEmergencyActivation';
import { deactivateEmergency } from '../../handlers/healthcare:operational/deactivateEmergency';
import { createEmergencyDrill } from '../../handlers/healthcare:operational/createEmergencyDrill';
import { searchEmergencyDrills } from '../../handlers/healthcare:operational/searchEmergencyDrills';
import { getEmergencyDrill } from '../../handlers/healthcare:operational/getEmergencyDrill';
import { updateEmergencyDrill } from '../../handlers/healthcare:operational/updateEmergencyDrill';
import { deleteEmergencyDrill } from '../../handlers/healthcare:operational/deleteEmergencyDrill';
import { createEmergencyPlan } from '../../handlers/healthcare:operational/createEmergencyPlan';
import { searchEmergencyPlans } from '../../handlers/healthcare:operational/searchEmergencyPlans';
import { getEmergencyPlan } from '../../handlers/healthcare:operational/getEmergencyPlan';
import { updateEmergencyPlan } from '../../handlers/healthcare:operational/updateEmergencyPlan';
import { deleteEmergencyPlan } from '../../handlers/healthcare:operational/deleteEmergencyPlan';
import { createSurgeCapacity } from '../../handlers/healthcare:operational/createSurgeCapacity';
import { getCurrentSurgeCapacity } from '../../handlers/healthcare:operational/getCurrentSurgeCapacity';
import { searchSurgeCapacity } from '../../handlers/healthcare:operational/searchSurgeCapacity';
import { createInstrumentSet } from '../../handlers/healthcare:operational/createInstrumentSet';
import { searchInstrumentSets } from '../../handlers/healthcare:operational/searchInstrumentSets';
import { getInstrumentSet } from '../../handlers/healthcare:operational/getInstrumentSet';
import { updateInstrumentSet } from '../../handlers/healthcare:operational/updateInstrumentSet';
import { deleteInstrumentSet } from '../../handlers/healthcare:operational/deleteInstrumentSet';
import { createMealService } from '../../handlers/healthcare:operational/createMealService';
import { searchMealServices } from '../../handlers/healthcare:operational/searchMealServices';
import { getMealService } from '../../handlers/healthcare:operational/getMealService';
import { updateMealService } from '../../handlers/healthcare:operational/updateMealService';
import { deleteMealService } from '../../handlers/healthcare:operational/deleteMealService';
import { createMortuaryStorage } from '../../handlers/healthcare:operational/createMortuaryStorage';
import { searchMortuaryStorage } from '../../handlers/healthcare:operational/searchMortuaryStorage';
import { getMortuaryStorage } from '../../handlers/healthcare:operational/getMortuaryStorage';
import { updateMortuaryStorage } from '../../handlers/healthcare:operational/updateMortuaryStorage';
import { deleteMortuaryStorage } from '../../handlers/healthcare:operational/deleteMortuaryStorage';
import { createNutritionScreening } from '../../handlers/healthcare:operational/createNutritionScreening';
import { searchNutritionScreenings } from '../../handlers/healthcare:operational/searchNutritionScreenings';
import { getNutritionScreening } from '../../handlers/healthcare:operational/getNutritionScreening';
import { updateNutritionScreening } from '../../handlers/healthcare:operational/updateNutritionScreening';
import { deleteNutritionScreening } from '../../handlers/healthcare:operational/deleteNutritionScreening';
import { createPeerReviewAction } from '../../handlers/healthcare:operational/createPeerReviewAction';
import { searchPeerReviewActions } from '../../handlers/healthcare:operational/searchPeerReviewActions';
import { getPeerReviewAction } from '../../handlers/healthcare:operational/getPeerReviewAction';
import { updatePeerReviewAction } from '../../handlers/healthcare:operational/updatePeerReviewAction';
import { deletePeerReviewAction } from '../../handlers/healthcare:operational/deletePeerReviewAction';
import { createPeerReviewCase } from '../../handlers/healthcare:operational/createPeerReviewCase';
import { searchPeerReviewCases } from '../../handlers/healthcare:operational/searchPeerReviewCases';
import { getPeerReviewCase } from '../../handlers/healthcare:operational/getPeerReviewCase';
import { updatePeerReviewCase } from '../../handlers/healthcare:operational/updatePeerReviewCase';
import { deletePeerReviewCase } from '../../handlers/healthcare:operational/deletePeerReviewCase';
import { transitionPeerReviewCaseStatus } from '../../handlers/healthcare:operational/transitionPeerReviewCaseStatus';
import { createPeerReviewPanel } from '../../handlers/healthcare:operational/createPeerReviewPanel';
import { searchPeerReviewPanels } from '../../handlers/healthcare:operational/searchPeerReviewPanels';
import { getPeerReviewPanel } from '../../handlers/healthcare:operational/getPeerReviewPanel';
import { updatePeerReviewPanel } from '../../handlers/healthcare:operational/updatePeerReviewPanel';
import { deletePeerReviewPanel } from '../../handlers/healthcare:operational/deletePeerReviewPanel';
import { createSterilizationCycle } from '../../handlers/healthcare:operational/createSterilizationCycle';
import { searchSterilizationCycles } from '../../handlers/healthcare:operational/searchSterilizationCycles';
import { getSterilizationCycle } from '../../handlers/healthcare:operational/getSterilizationCycle';
import { updateSterilizationCycle } from '../../handlers/healthcare:operational/updateSterilizationCycle';
import { deleteSterilizationCycle } from '../../handlers/healthcare:operational/deleteSterilizationCycle';
import { createSterilizationLog } from '../../handlers/healthcare:operational/createSterilizationLog';
import { searchSterilizationLogs } from '../../handlers/healthcare:operational/searchSterilizationLogs';
import { getSterilizationLog } from '../../handlers/healthcare:operational/getSterilizationLog';
import { updateSterilizationLog } from '../../handlers/healthcare:operational/updateSterilizationLog';
import { deleteSterilizationLog } from '../../handlers/healthcare:operational/deleteSterilizationLog';
import { createTransportRequest } from '../../handlers/healthcare:operational/createTransportRequest';
import { searchTransportRequests } from '../../handlers/healthcare:operational/searchTransportRequests';
import { getTransportRequest } from '../../handlers/healthcare:operational/getTransportRequest';
import { updateTransportRequest } from '../../handlers/healthcare:operational/updateTransportRequest';
import { deleteTransportRequest } from '../../handlers/healthcare:operational/deleteTransportRequest';
import { assignTransportRequest } from '../../handlers/healthcare:operational/assignTransportRequest';
import { completeTransportRequest } from '../../handlers/healthcare:operational/completeTransportRequest';
import { dispatchTransportRequest } from '../../handlers/healthcare:operational/dispatchTransportRequest';
import { createTransportTeam } from '../../handlers/healthcare:operational/createTransportTeam';
import { searchTransportTeams } from '../../handlers/healthcare:operational/searchTransportTeams';
import { getTransportTeam } from '../../handlers/healthcare:operational/getTransportTeam';
import { updateTransportTeam } from '../../handlers/healthcare:operational/updateTransportTeam';
import { deleteTransportTeam } from '../../handlers/healthcare:operational/deleteTransportTeam';
import { createImplant } from '../../handlers/healthcare:operational/createImplant';
import { searchImplants } from '../../handlers/healthcare:operational/searchImplants';
import { getImplantsByLotNumber } from '../../handlers/healthcare:operational/getImplantsByLotNumber';
import { getImplant } from '../../handlers/healthcare:operational/getImplant';
import { updateImplant } from '../../handlers/healthcare:operational/updateImplant';
import { deleteImplant } from '../../handlers/healthcare:operational/deleteImplant';
import { createOsseointegrationCheck } from '../../handlers/healthcare:operational/createOsseointegrationCheck';
import { searchOsseointegrationChecks } from '../../handlers/healthcare:operational/searchOsseointegrationChecks';
import { getOsseointegrationCheck } from '../../handlers/healthcare:operational/getOsseointegrationCheck';
import { updateOsseointegrationCheck } from '../../handlers/healthcare:operational/updateOsseointegrationCheck';
import { deleteOsseointegrationCheck } from '../../handlers/healthcare:operational/deleteOsseointegrationCheck';
import { createImplantRecall } from '../../handlers/healthcare:operational/createImplantRecall';
import { searchImplantRecalls } from '../../handlers/healthcare:operational/searchImplantRecalls';
import { getImplantRecallAffectedPatients } from '../../handlers/healthcare:operational/getImplantRecallAffectedPatients';
import { createInventoryBatch } from '../../handlers/healthcare:operational/createInventoryBatch';
import { searchInventoryBatches } from '../../handlers/healthcare:operational/searchInventoryBatches';
import { getInventoryBatch } from '../../handlers/healthcare:operational/getInventoryBatch';
import { updateInventoryBatch } from '../../handlers/healthcare:operational/updateInventoryBatch';
import { patchInventoryBatch } from '../../handlers/healthcare:operational/patchInventoryBatch';
import { deleteInventoryBatch } from '../../handlers/healthcare:operational/deleteInventoryBatch';
import { createSupplyConsumption } from '../../handlers/healthcare:operational/createSupplyConsumption';
import { searchSupplyConsumptions } from '../../handlers/healthcare:operational/searchSupplyConsumptions';
import { getSupplyConsumption } from '../../handlers/healthcare:operational/getSupplyConsumption';
import { createInventoryItem } from '../../handlers/healthcare:operational/createInventoryItem';
import { searchInventoryItems } from '../../handlers/healthcare:operational/searchInventoryItems';
import { getInventoryItem } from '../../handlers/healthcare:operational/getInventoryItem';
import { updateInventoryItem } from '../../handlers/healthcare:operational/updateInventoryItem';
import { patchInventoryItem } from '../../handlers/healthcare:operational/patchInventoryItem';
import { deleteInventoryItem } from '../../handlers/healthcare:operational/deleteInventoryItem';
import { createOperatoryAssignment } from '../../handlers/healthcare:operational/createOperatoryAssignment';
import { searchOperatoryAssignments } from '../../handlers/healthcare:operational/searchOperatoryAssignments';
import { getOperatoryAssignment } from '../../handlers/healthcare:operational/getOperatoryAssignment';
import { updateOperatoryAssignment } from '../../handlers/healthcare:operational/updateOperatoryAssignment';
import { deleteOperatoryAssignment } from '../../handlers/healthcare:operational/deleteOperatoryAssignment';
import { createChairTimeBlock } from '../../handlers/healthcare:operational/createChairTimeBlock';
import { searchChairTimeBlocks } from '../../handlers/healthcare:operational/searchChairTimeBlocks';
import { getChairTimeBlock } from '../../handlers/healthcare:operational/getChairTimeBlock';
import { updateChairTimeBlock } from '../../handlers/healthcare:operational/updateChairTimeBlock';
import { deleteChairTimeBlock } from '../../handlers/healthcare:operational/deleteChairTimeBlock';
import { getOperatoryMetrics } from '../../handlers/healthcare:operational/getOperatoryMetrics';
import { createOperatory } from '../../handlers/healthcare:operational/createOperatory';
import { searchOperatories } from '../../handlers/healthcare:operational/searchOperatories';
import { getOperatoryStatusBoard } from '../../handlers/healthcare:operational/getOperatoryStatusBoard';
import { getOperatory } from '../../handlers/healthcare:operational/getOperatory';
import { updateOperatory } from '../../handlers/healthcare:operational/updateOperatory';
import { deleteOperatory } from '../../handlers/healthcare:operational/deleteOperatory';
import { createTurnoverEvent } from '../../handlers/healthcare:operational/createTurnoverEvent';
import { searchTurnoverEvents } from '../../handlers/healthcare:operational/searchTurnoverEvents';
import { createPortalAccount } from '../../handlers/healthcare:operational/createPortalAccount';
import { searchPortalAccounts } from '../../handlers/healthcare:operational/searchPortalAccounts';
import { getPortalAccount } from '../../handlers/healthcare:operational/getPortalAccount';
import { updatePortalAccount } from '../../handlers/healthcare:operational/updatePortalAccount';
import { patchPortalAccount } from '../../handlers/healthcare:operational/patchPortalAccount';
import { deletePortalAccount } from '../../handlers/healthcare:operational/deletePortalAccount';
import { createOnlineBookingRequest } from '../../handlers/healthcare:operational/createOnlineBookingRequest';
import { getOnlineBookingRequest } from '../../handlers/healthcare:operational/getOnlineBookingRequest';
import { updateOnlineBookingRequest } from '../../handlers/healthcare:operational/updateOnlineBookingRequest';
import { deleteOnlineBookingRequest } from '../../handlers/healthcare:operational/deleteOnlineBookingRequest';
import { confirmOnlineBookingRequest } from '../../handlers/healthcare:operational/confirmOnlineBookingRequest';
import { declineOnlineBookingRequest } from '../../handlers/healthcare:operational/declineOnlineBookingRequest';
import { createPatientIntakeForm } from '../../handlers/healthcare:operational/createPatientIntakeForm';
import { searchPatientIntakeForms } from '../../handlers/healthcare:operational/searchPatientIntakeForms';
import { getPatientIntakeForm } from '../../handlers/healthcare:operational/getPatientIntakeForm';
import { updatePatientIntakeForm } from '../../handlers/healthcare:operational/updatePatientIntakeForm';
import { deletePatientIntakeForm } from '../../handlers/healthcare:operational/deletePatientIntakeForm';
import { sendPatientIntakeForm } from '../../handlers/healthcare:operational/sendPatientIntakeForm';
import { createPortalMessage } from '../../handlers/healthcare:operational/createPortalMessage';
import { searchPortalMessages } from '../../handlers/healthcare:operational/searchPortalMessages';
import { getPortalMessage } from '../../handlers/healthcare:operational/getPortalMessage';
import { deletePortalMessage } from '../../handlers/healthcare:operational/deletePortalMessage';
import { createPortalPayment } from '../../handlers/healthcare:operational/createPortalPayment';
import { searchPortalPayments } from '../../handlers/healthcare:operational/searchPortalPayments';
import { getPortalPayment } from '../../handlers/healthcare:operational/getPortalPayment';
import { createRecallCampaign } from '../../handlers/healthcare:operational/createRecallCampaign';
import { searchRecallCampaigns } from '../../handlers/healthcare:operational/searchRecallCampaigns';
import { getRecallCampaign } from '../../handlers/healthcare:operational/getRecallCampaign';
import { updateRecallCampaign } from '../../handlers/healthcare:operational/updateRecallCampaign';
import { deleteRecallCampaign } from '../../handlers/healthcare:operational/deleteRecallCampaign';
import { getRecallCampaignReport } from '../../handlers/healthcare:operational/getRecallCampaignReport';
import { runRecallCampaign } from '../../handlers/healthcare:operational/runRecallCampaign';
import { createRecallRule } from '../../handlers/healthcare:operational/createRecallRule';
import { getRecallRule } from '../../handlers/healthcare:operational/getRecallRule';
import { updateRecallRule } from '../../handlers/healthcare:operational/updateRecallRule';
import { patchRecallRule } from '../../handlers/healthcare:operational/patchRecallRule';
import { deleteRecallRule } from '../../handlers/healthcare:operational/deleteRecallRule';
import { createRecallSchedule } from '../../handlers/healthcare:operational/createRecallSchedule';
import { searchRecallSchedules } from '../../handlers/healthcare:operational/searchRecallSchedules';
import { getRecallSchedule } from '../../handlers/healthcare:operational/getRecallSchedule';
import { updateRecallSchedule } from '../../handlers/healthcare:operational/updateRecallSchedule';
import { deleteRecallSchedule } from '../../handlers/healthcare:operational/deleteRecallSchedule';
import { recordRecallContact } from '../../handlers/healthcare:operational/recordRecallContact';
import { dismissRecall } from '../../handlers/healthcare:operational/dismissRecall';
import { createDepartment } from '../../handlers/healthcare:foundation/createDepartment';
import { listDepartments } from '../../handlers/healthcare:foundation/listDepartments';
import { getDepartment } from '../../handlers/healthcare:foundation/getDepartment';
import { updateDepartment } from '../../handlers/healthcare:foundation/updateDepartment';
import { deactivateDepartment } from '../../handlers/healthcare:foundation/deactivateDepartment';
import { createLocation } from '../../handlers/healthcare:foundation/createLocation';
import { listLocations } from '../../handlers/healthcare:foundation/listLocations';
import { getLocation } from '../../handlers/healthcare:foundation/getLocation';
import { updateLocation } from '../../handlers/healthcare:foundation/updateLocation';
import { deactivateLocation } from '../../handlers/healthcare:foundation/deactivateLocation';
import { createOrganization } from '../../handlers/healthcare:foundation/createOrganization';
import { listOrganizations } from '../../handlers/healthcare:foundation/listOrganizations';
import { getOrganization } from '../../handlers/healthcare:foundation/getOrganization';
import { updateOrganization } from '../../handlers/healthcare:foundation/updateOrganization';
import { deactivateOrganization } from '../../handlers/healthcare:foundation/deactivateOrganization';
import { createCancerAbstract } from '../../handlers/healthcare:publichealth/createCancerAbstract';
import { searchCancerAbstracts } from '../../handlers/healthcare:publichealth/searchCancerAbstracts';
import { getCancerAbstract } from '../../handlers/healthcare:publichealth/getCancerAbstract';
import { updateCancerAbstract } from '../../handlers/healthcare:publichealth/updateCancerAbstract';
import { deleteCancerAbstract } from '../../handlers/healthcare:publichealth/deleteCancerAbstract';
import { createCancerRegistryCase } from '../../handlers/healthcare:publichealth/createCancerRegistryCase';
import { searchCancerRegistryCases } from '../../handlers/healthcare:publichealth/searchCancerRegistryCases';
import { getCancerRegistryCase } from '../../handlers/healthcare:publichealth/getCancerRegistryCase';
import { updateCancerRegistryCase } from '../../handlers/healthcare:publichealth/updateCancerRegistryCase';
import { deleteCancerRegistryCase } from '../../handlers/healthcare:publichealth/deleteCancerRegistryCase';
import { submitCancerRegistryCase } from '../../handlers/healthcare:publichealth/submitCancerRegistryCase';
import { createElectronicCaseReport } from '../../handlers/healthcare:publichealth/createElectronicCaseReport';
import { searchElectronicCaseReports } from '../../handlers/healthcare:publichealth/searchElectronicCaseReports';
import { getElectronicCaseReport } from '../../handlers/healthcare:publichealth/getElectronicCaseReport';
import { updateElectronicCaseReport } from '../../handlers/healthcare:publichealth/updateElectronicCaseReport';
import { deleteElectronicCaseReport } from '../../handlers/healthcare:publichealth/deleteElectronicCaseReport';
import { submitElectronicCaseReport } from '../../handlers/healthcare:publichealth/submitElectronicCaseReport';
import { createIISQuery } from '../../handlers/healthcare:publichealth/createIISQuery';
import { getImmunizationForecast } from '../../handlers/healthcare:publichealth/getImmunizationForecast';
import { searchIISQueries } from '../../handlers/healthcare:publichealth/searchIISQueries';
import { getIISQuery } from '../../handlers/healthcare:publichealth/getIISQuery';
import { createIISSubmission } from '../../handlers/healthcare:publichealth/createIISSubmission';
import { searchIISSubmissions } from '../../handlers/healthcare:publichealth/searchIISSubmissions';
import { getIISSubmission } from '../../handlers/healthcare:publichealth/getIISSubmission';
import { createElectronicLabReport } from '../../handlers/healthcare:publichealth/createElectronicLabReport';
import { searchElectronicLabReports } from '../../handlers/healthcare:publichealth/searchElectronicLabReports';
import { getElectronicLabReport } from '../../handlers/healthcare:publichealth/getElectronicLabReport';
import { submitElectronicLabReport } from '../../handlers/healthcare:publichealth/submitElectronicLabReport';
import { createSyndromicSurveillanceReport } from '../../handlers/healthcare:publichealth/createSyndromicSurveillanceReport';
import { searchSyndromicSurveillanceReports } from '../../handlers/healthcare:publichealth/searchSyndromicSurveillanceReports';
import { getSyndromicSurveillanceReport } from '../../handlers/healthcare:publichealth/getSyndromicSurveillanceReport';
import { submitSyndromicSurveillanceReport } from '../../handlers/healthcare:publichealth/submitSyndromicSurveillanceReport';
import { createTraumaRegistryCase } from '../../handlers/healthcare:publichealth/createTraumaRegistryCase';
import { searchTraumaRegistryCases } from '../../handlers/healthcare:publichealth/searchTraumaRegistryCases';
import { getTraumaRegistryCase } from '../../handlers/healthcare:publichealth/getTraumaRegistryCase';
import { updateTraumaRegistryCase } from '../../handlers/healthcare:publichealth/updateTraumaRegistryCase';
import { deleteTraumaRegistryCase } from '../../handlers/healthcare:publichealth/deleteTraumaRegistryCase';
import { submitTraumaRegistryCase } from '../../handlers/healthcare:publichealth/submitTraumaRegistryCase';
import { createBirthCertificate } from '../../handlers/healthcare:publichealth/createBirthCertificate';
import { searchBirthCertificates } from '../../handlers/healthcare:publichealth/searchBirthCertificates';
import { getBirthCertificate } from '../../handlers/healthcare:publichealth/getBirthCertificate';
import { updateBirthCertificate } from '../../handlers/healthcare:publichealth/updateBirthCertificate';
import { deleteBirthCertificate } from '../../handlers/healthcare:publichealth/deleteBirthCertificate';
import { submitBirthCertificate } from '../../handlers/healthcare:publichealth/submitBirthCertificate';
import { createDeathCertificate } from '../../handlers/healthcare:publichealth/createDeathCertificate';
import { searchDeathCertificates } from '../../handlers/healthcare:publichealth/searchDeathCertificates';
import { getDeathCertificate } from '../../handlers/healthcare:publichealth/getDeathCertificate';
import { updateDeathCertificate } from '../../handlers/healthcare:publichealth/updateDeathCertificate';
import { deleteDeathCertificate } from '../../handlers/healthcare:publichealth/deleteDeathCertificate';
import { submitDeathCertificate } from '../../handlers/healthcare:publichealth/submitDeathCertificate';
import { createFetalDeathReport } from '../../handlers/healthcare:publichealth/createFetalDeathReport';
import { searchFetalDeathReports } from '../../handlers/healthcare:publichealth/searchFetalDeathReports';
import { getFetalDeathReport } from '../../handlers/healthcare:publichealth/getFetalDeathReport';
import { updateFetalDeathReport } from '../../handlers/healthcare:publichealth/updateFetalDeathReport';
import { deleteFetalDeathReport } from '../../handlers/healthcare:publichealth/deleteFetalDeathReport';
import { submitFetalDeathReport } from '../../handlers/healthcare:publichealth/submitFetalDeathReport';
import { listNotifications } from '../../handlers/notifs/listNotifications';
import { markAllNotificationsAsRead } from '../../handlers/notifs/markAllNotificationsAsRead';
import { getNotification } from '../../handlers/notifs/getNotification';
import { markNotificationAsRead } from '../../handlers/notifs/markNotificationAsRead';
import { createPatient } from '../../handlers/patient/createPatient';
import { listPatients } from '../../handlers/patient/listPatients';
import { mergePatients } from '../../handlers/patient/mergePatients';
import { unmergePatients } from '../../handlers/patient/unmergePatients';
import { getPatient } from '../../handlers/patient/getPatient';
import { updatePatient } from '../../handlers/patient/updatePatient';
import { deactivatePatient } from '../../handlers/patient/deactivatePatient';
import { createPerson } from '../../handlers/person/createPerson';
import { listPersons } from '../../handlers/person/listPersons';
import { getPerson } from '../../handlers/person/getPerson';
import { updatePerson } from '../../handlers/person/updatePerson';
import { createPractitionerRole } from '../../handlers/provider/createPractitionerRole';
import { listPractitionerRoles } from '../../handlers/provider/listPractitionerRoles';
import { getPractitionerRole } from '../../handlers/provider/getPractitionerRole';
import { updatePractitionerRole } from '../../handlers/provider/updatePractitionerRole';
import { deactivatePractitionerRole } from '../../handlers/provider/deactivatePractitionerRole';
import { createPractitioner } from '../../handlers/provider/createPractitioner';
import { listPractitioners } from '../../handlers/provider/listPractitioners';
import { getPractitioner } from '../../handlers/provider/getPractitioner';
import { updatePractitioner } from '../../handlers/provider/updatePractitioner';
import { deactivatePractitioner } from '../../handlers/provider/deactivatePractitioner';
import { createReview } from '../../handlers/reviews/createReview';
import { listReviews } from '../../handlers/reviews/listReviews';
import { getReview } from '../../handlers/reviews/getReview';
import { deleteReview } from '../../handlers/reviews/deleteReview';
import { listFiles } from '../../handlers/storage/listFiles';
import { uploadFile } from '../../handlers/storage/uploadFile';
import { getFile } from '../../handlers/storage/getFile';
import { deleteFile } from '../../handlers/storage/deleteFile';
import { completeFileUpload } from '../../handlers/storage/completeFileUpload';
import { getFileDownload } from '../../handlers/storage/getFileDownload';

export const registry = {
  // Audit handlers
  listAuditLogs,

  // Billing handlers
  createInvoice,
  listInvoices,
  getInvoice,
  updateInvoice,
  deleteInvoice,
  captureInvoicePayment,
  finalizeInvoice,
  markInvoiceUncollectible,
  payInvoice,
  refundInvoicePayment,
  voidInvoice,
  createMerchantAccount,
  getMerchantAccount,
  getMerchantDashboard,
  onboardMerchantAccount,
  handleStripeWebhook,

  // Booking handlers
  createBooking,
  listBookings,
  getBooking,
  cancelBooking,
  confirmBooking,
  markNoShowBooking,
  rejectBooking,
  listBookingEvents,
  createBookingEvent,
  getBookingEvent,
  updateBookingEvent,
  deleteBookingEvent,
  createScheduleException,
  listScheduleExceptions,
  getScheduleException,
  deleteScheduleException,
  listEventSlots,
  getTimeSlot,

  // Comms handlers
  createChatRoom,
  listChatRooms,
  getChatRoom,
  getChatMessages,
  sendChatMessage,
  endVideoCall,
  joinVideoCall,
  leaveVideoCall,
  updateVideoCallParticipant,
  getIceServers,

  // Email handlers
  listEmailQueueItems,
  getEmailQueueItem,
  cancelEmailQueueItem,
  retryEmailQueueItem,
  listEmailTemplates,
  createEmailTemplate,
  getEmailTemplate,
  updateEmailTemplate,
  testEmailTemplate,

  // Emr handlers
  createConsultation,
  listConsultations,
  getConsultation,
  updateConsultation,
  finalizeConsultation,
  listEMRPatients,

  // Healthcare:conformance handlers
  getCapabilityStatement,
  kickoffSystemExport,
  getExportStatus,
  cancelExport,
  kickoffBulkImport,
  getBulkImportStatus,
  cancelBulkImport,
  validateResource,
  generateDocument,
  kickoffGroupExport,
  kickoffPatientExport,
  patientMatch,
  patientEverything,
  getMetadata,
  generatePatientSummary,
  getPatientSummary,
  createSubscription,
  getSubscription,
  updateSubscription,
  deleteSubscription,
  getSubscriptionStatus,
  listSubscriptionTopics,
  createCodeSystem,
  lookupCode,
  getCodeSystem,
  updateCodeSystem,
  deleteCodeSystem,
  createConceptMap,
  translateCode,
  getConceptMap,
  updateConceptMap,
  deleteConceptMap,
  createValueSet,
  expandValueSet,
  validateCode,
  getValueSet,
  updateValueSet,
  deleteValueSet,

  // Healthcare:analytics handlers
  createAIOutputMetadata,
  searchAIOutputMetadata,
  getAIOutputMetadata,
  reviewAIOutput,
  createCohortDefinition,
  searchCohortDefinitions,
  getCohortDefinition,
  updateCohortDefinition,
  patchCohortDefinition,
  deleteCohortDefinition,
  evaluateCohort,
  createDashboard,
  searchDashboards,
  getDashboard,
  updateDashboard,
  patchDashboard,
  deleteDashboard,
  createDataLineageRecord,
  searchDataLineageRecords,
  getDataLineageRecord,
  createDeIdentificationProfile,
  executeDeIdentification,
  searchDeIdentificationProfiles,
  getDeIdentificationProfile,
  updateDeIdentificationProfile,
  patchDeIdentificationProfile,
  deleteDeIdentificationProfile,
  createReportDefinition,
  searchReportDefinitions,
  getReportDefinition,
  updateReportDefinition,
  patchReportDefinition,
  deleteReportDefinition,
  createReportRun,
  searchReportRuns,
  getReportRunStatus,
  cancelReportRun,
  downloadReportRun,
  createResearchExtract,
  searchResearchExtracts,
  getResearchExtract,
  downloadResearchExtract,

  // Healthcare:administrative handlers
  createBed,
  listBedOccupancy,
  searchBeds,
  getBed,
  updateBed,
  patchBed,
  deleteBed,
  assignBed,
  releaseBed,
  createChargeDefinition,
  searchChargeDefinitions,
  getChargeDefinition,
  updateChargeDefinition,
  patchChargeDefinition,
  deleteChargeDefinition,
  createChargeItem,
  bulkCreateChargeItems,
  searchChargeItems,
  verifyCharges,
  getChargeItem,
  updateChargeItem,
  patchChargeItem,
  deleteChargeItem,
  createClaim,
  searchClaimResponses,
  getClaimResponse,
  searchClaims,
  submitClaim,
  getClaim,
  updateClaim,
  patchClaim,
  deleteClaim,
  createClinicalPrivilege,
  searchClinicalPrivileges,
  getClinicalPrivilege,
  updateClinicalPrivilege,
  deleteClinicalPrivilege,
  createCredentialingRecord,
  searchCredentialingRecords,
  getCredentialingRecord,
  updateCredentialingRecord,
  deleteCredentialingRecord,
  createFeeSchedule,
  createInsuranceContractRate,
  searchInsuranceContractRates,
  getInsuranceContractRate,
  updateInsuranceContractRate,
  deleteInsuranceContractRate,
  createDiscount,
  searchDiscounts,
  getDiscount,
  updateDiscount,
  patchDiscount,
  deleteDiscount,
  createFeeScheduleItem,
  bulkImportFeeScheduleItems,
  searchFeeScheduleItems,
  getFeeScheduleItem,
  updateFeeScheduleItem,
  patchFeeScheduleItem,
  deleteFeeScheduleItem,
  searchFeeSchedules,
  getFeeSchedule,
  updateFeeSchedule,
  patchFeeSchedule,
  deleteFeeSchedule,
  createCaseCosting,
  generateCaseCosting,
  searchCaseCosting,
  getCaseCosting,
  updateCaseCosting,
  deleteCaseCosting,
  createCodingReview,
  searchCodingReviews,
  getCodingReview,
  updateCodingReview,
  deleteCodingReview,
  finalizeCodingReview,
  createCostAllocation,
  searchCostAllocations,
  getCostAllocation,
  updateCostAllocation,
  deleteCostAllocation,
  createCostCenter,
  searchCostCenters,
  getCostCenter,
  updateCostCenter,
  deleteCostCenter,
  createGLExport,
  searchGLExports,
  getGLExport,
  createResidentEvaluation,
  searchResidentEvaluations,
  getResidentEvaluation,
  updateResidentEvaluation,
  deleteResidentEvaluation,
  submitResidentEvaluation,
  createProcedureLog,
  searchProcedureLogs,
  getProcedureLog,
  updateProcedureLog,
  deleteProcedureLog,
  verifyProcedureLog,
  createResidencyProgram,
  searchResidencyPrograms,
  getResidencyProgram,
  updateResidencyProgram,
  deleteResidencyProgram,
  createResident,
  searchResidents,
  getResident,
  updateResident,
  deleteResident,
  createRotationAssignment,
  searchRotationAssignments,
  getRotationAssignment,
  updateRotationAssignment,
  deleteRotationAssignment,
  createMedicalRecordRequest,
  searchMedicalRecordRequests,
  getMedicalRecordRequest,
  updateMedicalRecordRequest,
  deleteMedicalRecordRequest,
  createROIRequest,
  searchROIRequests,
  getROIRequest,
  updateROIRequest,
  deleteROIRequest,
  denyROIRequest,
  releaseROIRequest,
  createCoverage,
  searchCoverages,
  getCoverage,
  updateCoverage,
  patchCoverage,
  deleteCoverage,
  verifyEligibility,
  createPaymentPlan,
  searchPaymentPlans,
  getPaymentPlan,
  updatePaymentPlan,
  patchPaymentPlan,
  deletePaymentPlan,
  createPayment,
  searchPayments,
  getPayment,
  updatePayment,
  patchPayment,
  deletePayment,
  createPromissoryNote,
  searchPromissoryNotes,
  getPromissoryNote,
  patchPromissoryNote,
  deletePromissoryNote,
  createReceipt,
  searchReceipts,
  getReceipt,
  patchReceipt,
  createPriorAuthorization,
  searchPriorAuthorizations,
  submitPriorAuthorization,
  getPriorAuthorization,
  updatePriorAuthorization,
  patchPriorAuthorization,
  deletePriorAuthorization,
  transitionPriorAuthorizationStatus,
  createAppointment,
  searchAppointments,
  getAppointment,
  updateAppointment,
  patchAppointment,
  deleteAppointment,
  transitionAppointmentStatus,
  createSchedule,
  searchSchedules,
  getSchedule,
  updateSchedule,
  patchSchedule,
  deleteSchedule,
  createSlot,
  searchSlots,
  getSlot,
  updateSlot,
  patchSlot,
  deleteSlot,
  createOnCallSchedule,
  getCurrentOnCall,
  searchOnCallSchedules,
  getOnCallSchedule,
  updateOnCallSchedule,
  deleteOnCallSchedule,
  createWorkSchedule,
  getWorkSchedule,
  updateWorkSchedule,
  deleteWorkSchedule,
  createShiftAssignment,
  searchShiftAssignments,
  swapShift,
  getShiftAssignment,
  updateShiftAssignment,
  patchShiftAssignment,
  deleteShiftAssignment,
  createTimeOffRequest,
  searchTimeOffRequests,
  getTimeOffRequest,
  deleteTimeOffRequest,
  decideTimeOffRequest,

  // Healthcare:ancillary handlers
  createCrossmatch,
  searchCrossmatches,
  getCrossmatch,
  updateCrossmatch,
  deleteCrossmatch,
  createBloodProduct,
  searchBloodProducts,
  getBloodProduct,
  updateBloodProduct,
  deleteBloodProduct,
  createTransfusionRecord,
  searchTransfusionRecords,
  getTransfusionRecord,
  updateTransfusionRecord,
  deleteTransfusionRecord,
  createCosmeticCase,
  searchCosmeticCases,
  getCosmeticCase,
  updateCosmeticCase,
  deleteCosmeticCase,
  transitionCosmeticCaseStatus,
  createBeforeAfterPhoto,
  searchBeforeAfterPhotos,
  getBeforeAfterPhoto,
  updateBeforeAfterPhoto,
  deleteBeforeAfterPhoto,
  createSmileDesign,
  getSmileDesign,
  updateSmileDesign,
  deleteSmileDesign,
  createVeneerRecord,
  searchVeneerRecords,
  getVeneerRecord,
  updateVeneerRecord,
  deleteVeneerRecord,
  createWhiteningRecord,
  searchWhiteningRecords,
  getWhiteningRecord,
  updateWhiteningRecord,
  deleteWhiteningRecord,
  createIrrigationRecord,
  getIrrigationRecord,
  updateIrrigationRecord,
  deleteIrrigationRecord,
  createEndoRecord,
  searchEndoRecords,
  getEndoRecord,
  updateEndoRecord,
  deleteEndoRecord,
  transitionEndoRecordStatus,
  createEndoRetreatment,
  searchEndoRetreatments,
  getEndoRetreatment,
  updateEndoRetreatment,
  deleteEndoRetreatment,
  createDentalLabCase,
  searchDentalLabCases,
  getDentalLabCase,
  updateDentalLabCase,
  deleteDentalLabCase,
  receiveDentalLabCase,
  returnDentalLabCase,
  createLabCommunicationNote,
  getLabCommunicationNote,
  updateLabCommunicationNote,
  deleteLabCommunicationNote,
  createDentalLabProvider,
  searchDentalLabProviders,
  getDentalLabProvider,
  updateDentalLabProvider,
  deleteDentalLabProvider,
  createOdontogram,
  searchOdontograms,
  getOdontogram,
  updateOdontogram,
  deleteOdontogram,
  createExtractionRecord,
  searchExtractionRecords,
  getExtractionRecord,
  updateExtractionRecord,
  deleteExtractionRecord,
  createHealingFollowUp,
  searchHealingFollowUps,
  getHealingFollowUp,
  updateHealingFollowUp,
  deleteHealingFollowUp,
  createDentalPathologySpecimen,
  searchDentalPathologySpecimens,
  getDentalPathologySpecimen,
  updateDentalPathologySpecimen,
  deleteDentalPathologySpecimen,
  createPostOpInstruction,
  searchPostOpInstructions,
  getPostOpInstruction,
  updatePostOpInstruction,
  deletePostOpInstruction,
  createAlignerSeries,
  getAlignerSeries,
  updateAlignerSeries,
  deleteAlignerSeries,
  advanceAlignerTray,
  createOrthoCase,
  searchOrthoCases,
  getOrthoCase,
  updateOrthoCase,
  deleteOrthoCase,
  transitionOrthoCaseStatus,
  createOrthoProgressRecord,
  getOrthoProgressRecord,
  updateOrthoProgressRecord,
  deleteOrthoProgressRecord,
  createOrthoStage,
  getOrthoStage,
  updateOrthoStage,
  deleteOrthoStage,
  createBehaviorAssessment,
  searchBehaviorAssessments,
  getBehaviorAssessment,
  updateBehaviorAssessment,
  deleteBehaviorAssessment,
  createEruptionRecord,
  getEruptionRecord,
  updateEruptionRecord,
  deleteEruptionRecord,
  createExfoliationRecord,
  getExfoliationRecord,
  updateExfoliationRecord,
  deleteExfoliationRecord,
  createFluorideApplication,
  searchFluorideApplications,
  getFluorideApplication,
  updateFluorideApplication,
  deleteFluorideApplication,
  createSealantRecord,
  searchSealantRecords,
  getSealantRecord,
  updateSealantRecord,
  deleteSealantRecord,
  createSpaceMaintainer,
  searchSpaceMaintainers,
  getSpaceMaintainer,
  updateSpaceMaintainer,
  deleteSpaceMaintainer,
  createPerioExam,
  searchPerioExams,
  comparePerioExams,
  getPerioExam,
  updatePerioExam,
  deletePerioExam,
  completePerioExam,
  createFurcationRecord,
  getFurcationRecord,
  updateFurcationRecord,
  deleteFurcationRecord,
  createMobilityRecord,
  getMobilityRecord,
  updateMobilityRecord,
  deleteMobilityRecord,
  createImpression,
  getImpression,
  updateImpression,
  deleteImpression,
  createLabCaseLink,
  searchLabCaseLinks,
  getLabCaseLink,
  updateLabCaseLink,
  deleteLabCaseLink,
  createProsthoRecord,
  searchProsthoRecords,
  getProsthoRecord,
  updateProsthoRecord,
  deleteProsthoRecord,
  transitionProsthoStatus,
  createShadeSelection,
  getShadeSelection,
  updateShadeSelection,
  deleteShadeSelection,
  createDentalTreatmentPlan,
  searchDentalTreatmentPlans,
  getDentalTreatmentPlan,
  updateDentalTreatmentPlan,
  deleteDentalTreatmentPlan,
  createFormularyItem,
  searchFormularyItems,
  getFormularyItem,
  updateFormularyItem,
  patchFormularyItem,
  deleteFormularyItem,
  createDiagnosticReport,
  searchDiagnosticReports,
  getDiagnosticReport,
  updateDiagnosticReport,
  deleteDiagnosticReport,
  createResultPanel,
  searchResultPanels,
  getResultPanel,
  createSpecimen,
  searchSpecimens,
  getSpecimen,
  updateSpecimen,
  deleteSpecimen,
  verifyLabResult,
  searchLabVerifications,
  getLabResultVerification,
  createMedicationAdministration,
  searchMedicationAdministrations,
  getMedicationAdministration,
  updateMedicationAdministration,
  patchMedicationAdministration,
  deleteMedicationAdministration,
  createMedication,
  searchMedications,
  getMedication,
  updateMedication,
  patchMedication,
  deleteMedication,
  createAdherenceRecord,
  searchAdherenceRecords,
  getAdherenceRecord,
  createMedicationDispense,
  searchMedicationDispenses,
  getMedicationDispense,
  updateMedicationDispense,
  deleteMedicationDispense,
  checkDrugInteractions,
  createMedicationReconciliation,
  searchMedicationReconciliations,
  getMedicationReconciliation,
  updateMedicationReconciliation,
  patchMedicationReconciliation,
  deleteMedicationReconciliation,
  createImagingStudy,
  searchImagingStudies,
  getImagingStudy,
  updateImagingStudy,
  deleteImagingStudy,
  createRadiologyReport,
  searchRadiologyReports,
  getRadiologyReport,
  updateRadiologyReport,
  patchRadiologyReport,
  deleteRadiologyReport,

  // Healthcare:support handlers
  activateBreakGlass,
  searchBreakGlassOverrides,
  getBreakGlassOverride,
  reviewBreakGlassOverride,
  createCarePlan,
  searchCarePlans,
  getCarePlan,
  updateCarePlan,
  patchCarePlan,
  deleteCarePlan,
  createCareTeam,
  searchCareTeams,
  getCareTeam,
  updateCareTeam,
  patchCareTeam,
  deleteCareTeam,
  createGoal,
  searchGoals,
  getGoal,
  updateGoal,
  patchGoal,
  deleteGoal,
  cdsEncounterStart,
  cdsOrderSelect,
  cdsOrderSign,
  cdsPatientView,
  discoverCDSServices,
  createClinicalBenchmark,
  searchClinicalBenchmarks,
  getClinicalBenchmark,
  updateClinicalBenchmark,
  patchClinicalBenchmark,
  deleteClinicalBenchmark,
  createOutcomeRecord,
  searchOutcomeRecords,
  getOutcomeRecord,
  updateOutcomeRecord,
  patchOutcomeRecord,
  deleteOutcomeRecord,
  generateOutcomeReport,
  searchOutcomeReports,
  getOutcomeReport,
  createConsent,
  searchConsents,
  getConsent,
  updateConsent,
  patchConsent,
  deleteConsent,
  createImportJob,
  getImportJobStatus,
  cancelImportJob,
  getImportJobErrors,
  executeImportJob,
  uploadImportFile,
  validateImportJob,
  createImportMapping,
  searchImportMappings,
  getImportMapping,
  updateImportMapping,
  patchImportMapping,
  deleteImportMapping,
  createAntibiogram,
  searchAntibiograms,
  getAntibiogram,
  updateAntibiogram,
  deleteAntibiogram,
  createInfectionSurveillance,
  searchInfectionSurveillance,
  getInfectionSurveillance,
  updateInfectionSurveillance,
  deleteInfectionSurveillance,
  createMandatoryReport,
  searchMandatoryReports,
  getMandatoryReport,
  updateMandatoryReport,
  deleteMandatoryReport,
  createProvenance,
  searchProvenance,
  getProvenance,
  createProxyAccessGrant,
  searchProxyAccessGrants,
  getProxyAccessGrant,
  updateProxyAccessGrant,
  deleteProxyAccessGrant,
  revokeProxyAccessGrant,
  createIncidentReport,
  searchIncidentReports,
  getIncidentReport,
  updateIncidentReport,
  deleteIncidentReport,
  transitionIncidentStatus,
  createQualityMeasure,
  searchQualityMeasures,
  getQualityMeasure,
  updateQualityMeasure,
  deleteQualityMeasure,
  createQuestionnaireResponse,
  searchQuestionnaireResponses,
  getQuestionnaireResponse,
  updateQuestionnaireResponse,
  patchQuestionnaireResponse,
  deleteQuestionnaireResponse,
  createQuestionnaire,
  searchQuestionnaires,
  getQuestionnaire,
  updateQuestionnaire,
  patchQuestionnaire,
  deleteQuestionnaire,
  createSDOHReferral,
  searchSDOHReferrals,
  getSDOHReferral,
  updateSDOHReferral,
  patchSDOHReferral,
  deleteSDOHReferral,
  createSDOHScreening,
  searchSDOHScreenings,
  getSDOHScreening,
  updateSDOHScreening,
  patchSDOHScreening,
  deleteSDOHScreening,
  createSignature,
  searchSignatures,
  getSignature,
  revokeSignature,
  verifySignature,
  createTask,
  searchTasks,
  getTask,
  updateTask,
  patchTask,
  deleteTask,
  transitionTaskStatus,
  createAsyncConsultation,
  searchAsyncConsultations,
  getAsyncConsultation,
  updateAsyncConsultation,
  deleteAsyncConsultation,
  escalateAsyncConsultation,
  respondToAsyncConsultation,
  createRemoteMonitoringEnrollment,
  searchRemoteMonitoringEnrollments,
  getRemoteMonitoringEnrollment,
  updateRemoteMonitoringEnrollment,
  patchRemoteMonitoringEnrollment,
  deleteRemoteMonitoringEnrollment,
  createTelehealthSession,
  searchTelehealthSessions,
  getTelehealthSession,
  updateTelehealthSession,
  patchTelehealthSession,
  deleteTelehealthSession,
  endTelehealthSession,
  startTelehealthSession,
  getExecutionsByRule,
  searchWorkflowExecutions,
  searchTaskQueueItems,
  claimTaskQueueItem,
  completeTaskQueueItem,
  returnTaskQueueItem,
  createTaskQueue,
  searchTaskQueues,
  getTaskQueue,
  updateTaskQueue,
  deleteTaskQueue,
  createWorkflowRule,
  searchWorkflowRules,
  getWorkflowRule,
  updateWorkflowRule,
  deleteWorkflowRule,
  disableWorkflowRule,
  enableWorkflowRule,
  testWorkflowRule,

  // Healthcare:clinical handlers
  createADTEvent,
  getPatientADTTimeline,
  searchADTEvents,
  getADTEvent,
  createAllergyIntolerance,
  searchAllergyIntolerances,
  getAllergyIntolerance,
  updateAllergyIntolerance,
  patchAllergyIntolerance,
  deleteAllergyIntolerance,
  createAnesthesiaRecord,
  searchAnesthesiaRecords,
  getAnesthesiaRecord,
  updateAnesthesiaRecord,
  deleteAnesthesiaRecord,
  createComposition,
  searchCompositions,
  getComposition,
  updateComposition,
  patchComposition,
  deleteComposition,
  createCondition,
  searchConditions,
  getCondition,
  updateCondition,
  patchCondition,
  deleteCondition,
  createDocumentReference,
  searchDocumentReferences,
  getDocumentReference,
  updateDocumentReference,
  patchDocumentReference,
  deleteDocumentReference,
  createEncounter,
  searchEncounters,
  getEncounter,
  updateEncounter,
  patchEncounter,
  deleteEncounter,
  transitionEncounterStatus,
  createEpisodeOfCare,
  searchEpisodesOfCare,
  getEpisodeOfCare,
  updateEpisodeOfCare,
  patchEpisodeOfCare,
  deleteEpisodeOfCare,
  transitionEpisodeOfCareStatus,
  createFamilyMemberHistory,
  searchFamilyMemberHistories,
  getFamilyMemberHistory,
  updateFamilyMemberHistory,
  patchFamilyMemberHistory,
  deleteFamilyMemberHistory,
  createFlag,
  searchFlags,
  getFlag,
  updateFlag,
  patchFlag,
  deleteFlag,
  createClinicalHandoff,
  searchClinicalHandoffs,
  getClinicalHandoff,
  updateClinicalHandoff,
  deleteClinicalHandoff,
  createBehavioralHealthPlan,
  searchBehavioralHealthPlans,
  getBehavioralHealthPlan,
  updateBehavioralHealthPlan,
  deleteBehavioralHealthPlan,
  createCancerDiagnosis,
  searchCancerDiagnoses,
  getCancerDiagnosis,
  updateCancerDiagnosis,
  deleteCancerDiagnosis,
  createCardiacRehab,
  searchCardiacRehabs,
  getCardiacRehab,
  updateCardiacRehab,
  deleteCardiacRehab,
  createCardiacCathRecord,
  searchCardiacCathRecords,
  getCardiacCathRecord,
  updateCardiacCathRecord,
  deleteCardiacCathRecord,
  createEchoReport,
  searchEchoReports,
  getEchoReport,
  updateEchoReport,
  deleteEchoReport,
  createEPStudy,
  searchEPStudies,
  getEPStudy,
  updateEPStudy,
  deleteEPStudy,
  createChemotherapyCycle,
  searchChemotherapyCycles,
  getChemotherapyCycle,
  updateChemotherapyCycle,
  deleteChemotherapyCycle,
  createChemotherapyProtocol,
  searchChemotherapyProtocols,
  getChemotherapyProtocol,
  updateChemotherapyProtocol,
  deleteChemotherapyProtocol,
  createCodeBlueDebrief,
  searchCodeBlueDebriefs,
  getCodeBlueDebrief,
  updateCodeBlueDebrief,
  deleteCodeBlueDebrief,
  createCodeBlueEvent,
  getActiveCodeBlueEvents,
  searchCodeBlueEvents,
  getCodeBlueEvent,
  updateCodeBlueEvent,
  patchCodeBlueEvent,
  deleteCodeBlueEvent,
  createCodeBlueTeamRoster,
  getCodeBlueTeamRoster,
  updateCodeBlueTeamRoster,
  patchCodeBlueTeamRoster,
  deleteCodeBlueTeamRoster,
  createDialysisAccessRecord,
  searchDialysisAccessRecords,
  getDialysisAccessRecord,
  updateDialysisAccessRecord,
  deleteDialysisAccessRecord,
  createDialysisOrder,
  searchDialysisOrders,
  getDialysisOrder,
  updateDialysisOrder,
  deleteDialysisOrder,
  createDialysisSession,
  searchDialysisSessions,
  getDialysisSession,
  updateDialysisSession,
  deleteDialysisSession,
  getEDBoard,
  createEDVisit,
  searchEDVisits,
  getEDVisit,
  updateEDVisit,
  patchEDVisit,
  deleteEDVisit,
  createFallRiskAssessment,
  searchFallRiskAssessments,
  getFallRiskAssessment,
  updateFallRiskAssessment,
  deleteFallRiskAssessment,
  createFlowsheetEntry,
  searchFlowsheetEntries,
  getFlowsheetEntry,
  updateFlowsheetEntry,
  deleteFlowsheetEntry,
  createICUAdmission,
  searchICUAdmissions,
  getICUAdmission,
  updateICUAdmission,
  deleteICUAdmission,
  transitionICUAdmissionStatus,
  createInvoluntaryHold,
  searchInvoluntaryHolds,
  getInvoluntaryHold,
  updateInvoluntaryHold,
  deleteInvoluntaryHold,
  createLaborRecord,
  searchLaborRecords,
  getLaborRecord,
  updateLaborRecord,
  deleteLaborRecord,
  createNICUAdmission,
  searchNICUAdmissions,
  getNICUAdmission,
  updateNICUAdmission,
  deleteNICUAdmission,
  createFeedingRecord,
  searchFeedingRecords,
  getFeedingRecord,
  updateFeedingRecord,
  deleteFeedingRecord,
  createNewbornScreening,
  searchNewbornScreenings,
  getNewbornScreening,
  updateNewbornScreening,
  deleteNewbornScreening,
  createNeonatalVitals,
  searchNeonatalVitals,
  getNeonatalVitals,
  updateNeonatalVitals,
  deleteNeonatalVitals,
  createNewbornRecord,
  searchNewbornRecords,
  getNewbornRecord,
  updateNewbornRecord,
  deleteNewbornRecord,
  createNursingAssessment,
  searchNursingAssessments,
  getNursingAssessment,
  updateNursingAssessment,
  patchNursingAssessment,
  deleteNursingAssessment,
  createOrderSet,
  applyOrderSet,
  searchOrderSets,
  getOrderSet,
  updateOrderSet,
  deleteOrderSet,
  createOrderVerification,
  searchOrderVerifications,
  createClinicalOrder,
  searchClinicalOrders,
  getClinicalOrder,
  updateClinicalOrder,
  patchClinicalOrder,
  deleteClinicalOrder,
  coSignClinicalOrder,
  createPainAssessment,
  searchPainAssessments,
  getPainAssessment,
  updatePainAssessment,
  deletePainAssessment,
  createGoalsOfCareDiscussion,
  searchGoalsOfCareDiscussions,
  getGoalsOfCareDiscussion,
  updateGoalsOfCareDiscussion,
  deleteGoalsOfCareDiscussion,
  createHospiceEligibility,
  searchHospiceEligibilities,
  getHospiceEligibility,
  updateHospiceEligibility,
  deleteHospiceEligibility,
  createHospiceIDTMeeting,
  searchHospiceIDTMeetings,
  getHospiceIDTMeeting,
  updateHospiceIDTMeeting,
  deleteHospiceIDTMeeting,
  createSymptomAssessment,
  searchSymptomAssessments,
  getSymptomAssessment,
  updateSymptomAssessment,
  deleteSymptomAssessment,
  createADLAssessment,
  searchADLAssessments,
  getADLAssessment,
  updateADLAssessment,
  deleteADLAssessment,
  createPostAcuteAdmission,
  searchPostAcuteAdmissions,
  getPostAcuteAdmission,
  updatePostAcuteAdmission,
  deletePostAcuteAdmission,
  createHomeHealthCertification,
  searchHomeHealthCertifications,
  getHomeHealthCertification,
  updateHomeHealthCertification,
  deleteHomeHealthCertification,
  createMDSAssessment,
  searchMDSAssessments,
  getMDSAssessment,
  updateMDSAssessment,
  deleteMDSAssessment,
  createOASISAssessment,
  searchOASISAssessments,
  getOASISAssessment,
  updateOASISAssessment,
  deleteOASISAssessment,
  createPostpartumAssessment,
  searchPostpartumAssessments,
  getPostpartumAssessment,
  updatePostpartumAssessment,
  deletePostpartumAssessment,
  createPregnancyRecord,
  searchPregnancyRecords,
  getPregnancyRecord,
  updatePregnancyRecord,
  deletePregnancyRecord,
  createPressureInjuryRisk,
  searchPressureInjuryRisks,
  getPressureInjuryRisk,
  updatePressureInjuryRisk,
  deletePressureInjuryRisk,
  createPsychiatricAssessment,
  searchPsychiatricAssessments,
  getPsychiatricAssessment,
  updatePsychiatricAssessment,
  deletePsychiatricAssessment,
  createRadiationTherapy,
  searchRadiationTherapy,
  getRadiationTherapy,
  updateRadiationTherapy,
  deleteRadiationTherapy,
  createRehabEvaluation,
  searchRehabEvaluations,
  getRehabEvaluation,
  updateRehabEvaluation,
  deleteRehabEvaluation,
  createFunctionalOutcome,
  searchFunctionalOutcomes,
  getFunctionalOutcome,
  updateFunctionalOutcome,
  deleteFunctionalOutcome,
  createRehabReferral,
  searchRehabReferrals,
  getRehabReferral,
  updateRehabReferral,
  deleteRehabReferral,
  createRehabSession,
  searchRehabSessions,
  getRehabSession,
  updateRehabSession,
  deleteRehabSession,
  createABGResult,
  searchABGResults,
  getABGResult,
  updateABGResult,
  deleteABGResult,
  createRespiratoryOrder,
  searchRespiratoryOrders,
  getRespiratoryOrder,
  updateRespiratoryOrder,
  deleteRespiratoryOrder,
  createPFT,
  searchPFTs,
  getPFT,
  updatePFT,
  deletePFT,
  createRespiratoryTreatment,
  searchRespiratoryTreatments,
  getRespiratoryTreatment,
  updateRespiratoryTreatment,
  deleteRespiratoryTreatment,
  createSeverityScore,
  searchSeverityScores,
  getSeverityScore,
  updateSeverityScore,
  deleteSeverityScore,
  createSubstanceUseAssessment,
  searchSubstanceUseAssessments,
  getSubstanceUseAssessment,
  updateSubstanceUseAssessment,
  deleteSubstanceUseAssessment,
  createTriageAssessment,
  searchTriageAssessments,
  getTriageAssessment,
  updateTriageAssessment,
  deleteTriageAssessment,
  createVentilatorRecord,
  searchVentilatorRecords,
  getVentilatorRecord,
  updateVentilatorRecord,
  deleteVentilatorRecord,
  createWoundAssessment,
  searchWoundAssessments,
  getWoundAssessment,
  updateWoundAssessment,
  patchWoundAssessment,
  deleteWoundAssessment,
  createWoundCareOrder,
  searchWoundCareOrders,
  getWoundCareOrder,
  updateWoundCareOrder,
  patchWoundCareOrder,
  deleteWoundCareOrder,
  createWoundTreatment,
  searchWoundTreatments,
  getWoundTreatment,
  updateWoundTreatment,
  deleteWoundTreatment,
  createImmunization,
  searchImmunizations,
  getImmunization,
  updateImmunization,
  patchImmunization,
  deleteImmunization,
  createMedicationRequest,
  searchMedicationRequests,
  getMedicationRequest,
  updateMedicationRequest,
  patchMedicationRequest,
  deleteMedicationRequest,
  transitionMedicationRequestStatus,
  sendClinicalMessage,
  searchClinicalMessages,
  getClinicalMessage,
  updateClinicalMessage,
  deleteClinicalMessage,
  acknowledgeClinicalMessage,
  createObservation,
  bulkCreateObservations,
  searchObservations,
  getObservation,
  updateObservation,
  patchObservation,
  deleteObservation,
  createOperatingRoom,
  searchOperatingRooms,
  getOperatingRoom,
  updateOperatingRoom,
  deleteOperatingRoom,
  createProcedure,
  searchProcedures,
  getProcedure,
  updateProcedure,
  patchProcedure,
  deleteProcedure,
  createRelatedPerson,
  searchRelatedPersons,
  getRelatedPerson,
  updateRelatedPerson,
  patchRelatedPerson,
  deleteRelatedPerson,
  createServiceRequest,
  searchServiceRequests,
  getServiceRequest,
  updateServiceRequest,
  patchServiceRequest,
  deleteServiceRequest,
  transitionServiceRequestStatus,
  createSurgicalCase,
  searchSurgicalCases,
  getSurgicalCase,
  updateSurgicalCase,
  deleteSurgicalCase,
  transitionSurgicalCaseStatus,

  // Healthcare:compliance handlers
  createPolicyAttestation,
  searchPolicyAttestations,
  getPolicyAttestation,
  updatePolicyAttestation,
  deletePolicyAttestation,
  createBAARecord,
  searchBAARecords,
  getBAARecord,
  updateBAARecord,
  deleteBAARecord,
  createCAPARecord,
  searchCAPARecords,
  getCAPARecord,
  updateCAPARecord,
  deleteCAPARecord,
  transitionCAPAStatus,
  createRetentionSchedule,
  searchRetentionSchedules,
  getRetentionSchedule,
  updateRetentionSchedule,
  deleteRetentionSchedule,
  createLegalHold,
  searchLegalHolds,
  getLegalHold,
  updateLegalHold,
  deleteLegalHold,
  releaseLegalHold,
  createCompliancePolicy,
  searchCompliancePolicies,
  getCompliancePolicy,
  updateCompliancePolicy,
  deleteCompliancePolicy,
  createAmendmentRequest,
  searchAmendmentRequests,
  getAmendmentRequest,
  updateAmendmentRequest,
  deleteAmendmentRequest,
  approveAmendmentRequest,
  denyAmendmentRequest,
  createBreachAssessment,
  searchBreachAssessments,
  getBreachAssessment,
  updateBreachAssessment,
  deleteBreachAssessment,
  createBreachNotification,
  searchBreachNotifications,
  getBreachNotification,
  updateBreachNotification,
  deleteBreachNotification,
  createPrivacyComplaint,
  searchPrivacyComplaints,
  getPrivacyComplaint,
  updatePrivacyComplaint,
  deletePrivacyComplaint,
  transitionPrivacyComplaintStatus,
  createDisclosureRecord,
  searchDisclosureRecords,
  getDisclosureRecord,

  // Healthcare:operational handlers
  createConnector,
  createConnectorCredential,
  rotateConnectorCredential,
  searchConnectors,
  getLatestConnectorSyncLog,
  searchConnectorSyncLogs,
  getConnector,
  updateConnector,
  patchConnector,
  deleteConnector,
  getConnectorHealth,
  testConnector,
  createDeviceAssignment,
  searchDeviceAssignments,
  getDeviceAssignment,
  updateDeviceAssignment,
  patchDeviceAssignment,
  deleteDeviceAssignment,
  createDeviceMetric,
  searchDeviceMetrics,
  getDeviceMetric,
  updateDeviceMetric,
  patchDeviceMetric,
  deleteDeviceMetric,
  createDevice,
  searchDevices,
  getDevice,
  updateDevice,
  patchDevice,
  deleteDevice,
  createBiologicalIndicator,
  searchBiologicalIndicators,
  getBiologicalIndicator,
  updateBiologicalIndicator,
  deleteBiologicalIndicator,
  createBodyRelease,
  searchBodyReleases,
  getBodyRelease,
  updateBodyRelease,
  deleteBodyRelease,
  createCleaningSchedule,
  searchCleaningSchedules,
  getCleaningSchedule,
  updateCleaningSchedule,
  deleteCleaningSchedule,
  createCleaningTask,
  searchCleaningTasks,
  getCleaningTask,
  updateCleaningTask,
  deleteCleaningTask,
  assignCleaningTask,
  completeCleaningTask,
  verifyCleaningTask,
  createDeceasedRecord,
  searchDeceasedRecords,
  getDeceasedRecord,
  updateDeceasedRecord,
  deleteDeceasedRecord,
  createDietOrder,
  searchDietOrders,
  getDietOrder,
  updateDietOrder,
  deleteDietOrder,
  createEmergencyActivation,
  activateEmergencyPlan,
  searchEmergencyActivations,
  getEmergencyActivation,
  updateEmergencyActivation,
  deleteEmergencyActivation,
  deactivateEmergency,
  createEmergencyDrill,
  searchEmergencyDrills,
  getEmergencyDrill,
  updateEmergencyDrill,
  deleteEmergencyDrill,
  createEmergencyPlan,
  searchEmergencyPlans,
  getEmergencyPlan,
  updateEmergencyPlan,
  deleteEmergencyPlan,
  createSurgeCapacity,
  getCurrentSurgeCapacity,
  searchSurgeCapacity,
  createInstrumentSet,
  searchInstrumentSets,
  getInstrumentSet,
  updateInstrumentSet,
  deleteInstrumentSet,
  createMealService,
  searchMealServices,
  getMealService,
  updateMealService,
  deleteMealService,
  createMortuaryStorage,
  searchMortuaryStorage,
  getMortuaryStorage,
  updateMortuaryStorage,
  deleteMortuaryStorage,
  createNutritionScreening,
  searchNutritionScreenings,
  getNutritionScreening,
  updateNutritionScreening,
  deleteNutritionScreening,
  createPeerReviewAction,
  searchPeerReviewActions,
  getPeerReviewAction,
  updatePeerReviewAction,
  deletePeerReviewAction,
  createPeerReviewCase,
  searchPeerReviewCases,
  getPeerReviewCase,
  updatePeerReviewCase,
  deletePeerReviewCase,
  transitionPeerReviewCaseStatus,
  createPeerReviewPanel,
  searchPeerReviewPanels,
  getPeerReviewPanel,
  updatePeerReviewPanel,
  deletePeerReviewPanel,
  createSterilizationCycle,
  searchSterilizationCycles,
  getSterilizationCycle,
  updateSterilizationCycle,
  deleteSterilizationCycle,
  createSterilizationLog,
  searchSterilizationLogs,
  getSterilizationLog,
  updateSterilizationLog,
  deleteSterilizationLog,
  createTransportRequest,
  searchTransportRequests,
  getTransportRequest,
  updateTransportRequest,
  deleteTransportRequest,
  assignTransportRequest,
  completeTransportRequest,
  dispatchTransportRequest,
  createTransportTeam,
  searchTransportTeams,
  getTransportTeam,
  updateTransportTeam,
  deleteTransportTeam,
  createImplant,
  searchImplants,
  getImplantsByLotNumber,
  getImplant,
  updateImplant,
  deleteImplant,
  createOsseointegrationCheck,
  searchOsseointegrationChecks,
  getOsseointegrationCheck,
  updateOsseointegrationCheck,
  deleteOsseointegrationCheck,
  createImplantRecall,
  searchImplantRecalls,
  getImplantRecallAffectedPatients,
  createInventoryBatch,
  searchInventoryBatches,
  getInventoryBatch,
  updateInventoryBatch,
  patchInventoryBatch,
  deleteInventoryBatch,
  createSupplyConsumption,
  searchSupplyConsumptions,
  getSupplyConsumption,
  createInventoryItem,
  searchInventoryItems,
  getInventoryItem,
  updateInventoryItem,
  patchInventoryItem,
  deleteInventoryItem,
  createOperatoryAssignment,
  searchOperatoryAssignments,
  getOperatoryAssignment,
  updateOperatoryAssignment,
  deleteOperatoryAssignment,
  createChairTimeBlock,
  searchChairTimeBlocks,
  getChairTimeBlock,
  updateChairTimeBlock,
  deleteChairTimeBlock,
  getOperatoryMetrics,
  createOperatory,
  searchOperatories,
  getOperatoryStatusBoard,
  getOperatory,
  updateOperatory,
  deleteOperatory,
  createTurnoverEvent,
  searchTurnoverEvents,
  createPortalAccount,
  searchPortalAccounts,
  getPortalAccount,
  updatePortalAccount,
  patchPortalAccount,
  deletePortalAccount,
  createOnlineBookingRequest,
  getOnlineBookingRequest,
  updateOnlineBookingRequest,
  deleteOnlineBookingRequest,
  confirmOnlineBookingRequest,
  declineOnlineBookingRequest,
  createPatientIntakeForm,
  searchPatientIntakeForms,
  getPatientIntakeForm,
  updatePatientIntakeForm,
  deletePatientIntakeForm,
  sendPatientIntakeForm,
  createPortalMessage,
  searchPortalMessages,
  getPortalMessage,
  deletePortalMessage,
  createPortalPayment,
  searchPortalPayments,
  getPortalPayment,
  createRecallCampaign,
  searchRecallCampaigns,
  getRecallCampaign,
  updateRecallCampaign,
  deleteRecallCampaign,
  getRecallCampaignReport,
  runRecallCampaign,
  createRecallRule,
  getRecallRule,
  updateRecallRule,
  patchRecallRule,
  deleteRecallRule,
  createRecallSchedule,
  searchRecallSchedules,
  getRecallSchedule,
  updateRecallSchedule,
  deleteRecallSchedule,
  recordRecallContact,
  dismissRecall,

  // Healthcare:foundation handlers
  createDepartment,
  listDepartments,
  getDepartment,
  updateDepartment,
  deactivateDepartment,
  createLocation,
  listLocations,
  getLocation,
  updateLocation,
  deactivateLocation,
  createOrganization,
  listOrganizations,
  getOrganization,
  updateOrganization,
  deactivateOrganization,

  // Healthcare:publichealth handlers
  createCancerAbstract,
  searchCancerAbstracts,
  getCancerAbstract,
  updateCancerAbstract,
  deleteCancerAbstract,
  createCancerRegistryCase,
  searchCancerRegistryCases,
  getCancerRegistryCase,
  updateCancerRegistryCase,
  deleteCancerRegistryCase,
  submitCancerRegistryCase,
  createElectronicCaseReport,
  searchElectronicCaseReports,
  getElectronicCaseReport,
  updateElectronicCaseReport,
  deleteElectronicCaseReport,
  submitElectronicCaseReport,
  createIISQuery,
  getImmunizationForecast,
  searchIISQueries,
  getIISQuery,
  createIISSubmission,
  searchIISSubmissions,
  getIISSubmission,
  createElectronicLabReport,
  searchElectronicLabReports,
  getElectronicLabReport,
  submitElectronicLabReport,
  createSyndromicSurveillanceReport,
  searchSyndromicSurveillanceReports,
  getSyndromicSurveillanceReport,
  submitSyndromicSurveillanceReport,
  createTraumaRegistryCase,
  searchTraumaRegistryCases,
  getTraumaRegistryCase,
  updateTraumaRegistryCase,
  deleteTraumaRegistryCase,
  submitTraumaRegistryCase,
  createBirthCertificate,
  searchBirthCertificates,
  getBirthCertificate,
  updateBirthCertificate,
  deleteBirthCertificate,
  submitBirthCertificate,
  createDeathCertificate,
  searchDeathCertificates,
  getDeathCertificate,
  updateDeathCertificate,
  deleteDeathCertificate,
  submitDeathCertificate,
  createFetalDeathReport,
  searchFetalDeathReports,
  getFetalDeathReport,
  updateFetalDeathReport,
  deleteFetalDeathReport,
  submitFetalDeathReport,

  // Notifs handlers
  listNotifications,
  markAllNotificationsAsRead,
  getNotification,
  markNotificationAsRead,

  // Patient handlers
  createPatient,
  listPatients,
  mergePatients,
  unmergePatients,
  getPatient,
  updatePatient,
  deactivatePatient,

  // Person handlers
  createPerson,
  listPersons,
  getPerson,
  updatePerson,

  // Provider handlers
  createPractitionerRole,
  listPractitionerRoles,
  getPractitionerRole,
  updatePractitionerRole,
  deactivatePractitionerRole,
  createPractitioner,
  listPractitioners,
  getPractitioner,
  updatePractitioner,
  deactivatePractitioner,

  // Reviews handlers
  createReview,
  listReviews,
  getReview,
  deleteReview,

  // Storage handlers
  listFiles,
  uploadFile,
  getFile,
  deleteFile,
  completeFileUpload,
  getFileDownload,

};