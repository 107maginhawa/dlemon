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
import { createAppointment } from '../../handlers/dental-scheduling/createAppointment';
import { getAppointment } from '../../handlers/dental-scheduling/getAppointment';
import { listAppointments } from '../../handlers/dental-scheduling/listAppointments';
import { updateAppointment } from '../../handlers/dental-scheduling/updateAppointment';
import { applyDentalDiscount } from '../../handlers/dental-billing/applyDentalDiscount';
import { createDentalInvoice } from '../../handlers/dental-billing/createDentalInvoice';
import { createDentalPaymentPlan } from '../../handlers/dental-billing/createDentalPaymentPlan';
import { getCollectionsSummary } from '../../handlers/dental-billing/getCollectionsSummary';
import { getDentalInvoice } from '../../handlers/dental-billing/getDentalInvoice';
import { getDentalPaymentPlan } from '../../handlers/dental-billing/getDentalPaymentPlan';
import { getDentalPaymentReceipt } from '../../handlers/dental-billing/getDentalPaymentReceipt';
import { getPatientBalance } from '../../handlers/dental-billing/getPatientBalance';
import { issueDentalInvoice } from '../../handlers/dental-billing/issueDentalInvoice';
import { listDentalInvoices } from '../../handlers/dental-billing/listDentalInvoices';
import { listDentalPayments } from '../../handlers/dental-billing/listDentalPayments';
import { markUncollectible } from '../../handlers/dental-billing/markUncollectible';
import { recordDentalPayment } from '../../handlers/dental-billing/recordDentalPayment';
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
import { deleteConsentTemplate } from '../../handlers/dental-org/deleteConsentTemplate';
import { getBranchSettings } from '../../handlers/dental-org/getBranchSettings';
import { getDashboardSummary } from '../../handlers/dental-org/getDashboardSummary';
import { getOrgContext } from '../../handlers/dental-org/getOrgContext';
import { getWorkingHours } from '../../handlers/dental-org/getWorkingHours';
import { listConsentTemplates } from '../../handlers/dental-org/listConsentTemplates';
import { listMembers } from '../../handlers/dental-org/listMembers';
import { recoverPin } from '../../handlers/dental-org/recoverPin';
import { resetMemberPin } from '../../handlers/dental-org/resetMemberPin';
import { setSecurityQuestion } from '../../handlers/dental-org/setSecurityQuestion';
import { updateBranchSettings } from '../../handlers/dental-org/updateBranchSettings';
import { updateConsentTemplate } from '../../handlers/dental-org/updateConsentTemplate';
import { updateWorkingHours } from '../../handlers/dental-org/updateWorkingHours';
import { approveAmendment } from '../../handlers/dental-clinical/amendments/approveAmendment';
import { createAmendment } from '../../handlers/dental-clinical/amendments/createAmendment';
import { createAttachment } from '../../handlers/dental-clinical/attachments/createAttachment';
import { createConsentForm } from '../../handlers/dental-clinical/consent/createConsentForm';
import { createLabOrder } from '../../handlers/dental-clinical/lab-orders/createLabOrder';
import { createMedicalHistoryEntry } from '../../handlers/dental-clinical/medical-history/createMedicalHistoryEntry';
import { createPrescription } from '../../handlers/dental-clinical/prescriptions/createPrescription';
import { deleteAttachment } from '../../handlers/dental-clinical/attachments/deleteAttachment';
import { listAmendments } from '../../handlers/dental-clinical/amendments/listAmendments';
import { listAttachments } from '../../handlers/dental-clinical/attachments/listAttachments';
import { listConsentForms } from '../../handlers/dental-clinical/consent/listConsentForms';
import { listLabOrders } from '../../handlers/dental-clinical/lab-orders/listLabOrders';
import { listMedicalHistory } from '../../handlers/dental-clinical/medical-history/listMedicalHistory';
import { listPrescriptions } from '../../handlers/dental-clinical/prescriptions/listPrescriptions';
import { revokeConsentForm } from '../../handlers/dental-clinical/consent/revokeConsentForm';
import { signConsentForm } from '../../handlers/dental-clinical/consent/signConsentForm';
import { updateLabOrder } from '../../handlers/dental-clinical/lab-orders/updateLabOrder';
import { updateMedicalHistoryEntry } from '../../handlers/dental-clinical/medical-history/updateMedicalHistoryEntry';
import { updatePrescription } from '../../handlers/dental-clinical/prescriptions/updatePrescription';
import { approveErasure } from '../../handlers/dental-erasure/approveErasure';
import { getErasureRequest } from '../../handlers/dental-erasure/getErasureRequest';
import { listErasureRequests } from '../../handlers/dental-erasure/listErasureRequests';
import { rejectErasure } from '../../handlers/dental-erasure/rejectErasure';
import { requestErasure } from '../../handlers/dental-erasure/requestErasure';
import { CephMgmt_batchUpsertCephLandmarks } from '../../handlers/dental-imaging/CephMgmt_batchUpsertCephLandmarks';
import { CephMgmt_createCephReport } from '../../handlers/dental-imaging/CephMgmt_createCephReport';
import { CephMgmt_deleteCephLandmark } from '../../handlers/dental-imaging/CephMgmt_deleteCephLandmark';
import { CephMgmt_getCephAnalysis } from '../../handlers/dental-imaging/CephMgmt_getCephAnalysis';
import { CephMgmt_getCephReport } from '../../handlers/dental-imaging/CephMgmt_getCephReport';
import { CephMgmt_listCephLandmarks } from '../../handlers/dental-imaging/CephMgmt_listCephLandmarks';
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
import { ImagingMgmt_getImagingStudy } from '../../handlers/dental-imaging/ImagingMgmt_getImagingStudy';
import { ImagingMgmt_listMeasurements } from '../../handlers/dental-imaging/ImagingMgmt_listMeasurements';
import { ImagingMgmt_updateImageCalibration } from '../../handlers/dental-imaging/ImagingMgmt_updateImageCalibration';
import { ImagingMgmt_updateImageModality } from '../../handlers/dental-imaging/ImagingMgmt_updateImageModality';
import { PatientImageMgmt_listPatientImages } from '../../handlers/dental-imaging/PatientImageMgmt_listPatientImages';
import { acceptTreatmentPlan } from '../../handlers/dental-patient/treatment-plans/acceptTreatmentPlan';
import { addFollowUpNote } from '../../handlers/dental-patient/engagement/addFollowUpNote';
import { archiveDentalPatient } from '../../handlers/dental-patient/identity/archiveDentalPatient';
import { bulkArchiveDentalPatients } from '../../handlers/dental-patient/identity/bulkArchiveDentalPatients';
import { createDentalPatient } from '../../handlers/dental-patient/identity/createDentalPatient';
import { exportDentalPatients } from '../../handlers/dental-patient/identity/exportDentalPatients';
import { getDentalPatient } from '../../handlers/dental-patient/identity/getDentalPatient';
import { getDentalPatientSafetyFloor } from '../../handlers/dental-patient/identity/getDentalPatientSafetyFloor';
import { getDentalPatientStatement } from '../../handlers/dental-patient/identity/getDentalPatientStatement';
import { getTreatmentPlan } from '../../handlers/dental-patient/treatment-plans/getTreatmentPlan';
import { getTreatmentPlanVersion } from '../../handlers/dental-patient/treatment-plans/getTreatmentPlanVersion';
import { importPatients } from '../../handlers/dental-patient/identity/importPatients';
import { initializeDentition } from '../../handlers/dental-patient/identity/initializeDentition';
import { listDentalPatients } from '../../handlers/dental-patient/identity/listDentalPatients';
import { listFollowUpNotes } from '../../handlers/dental-patient/engagement/listFollowUpNotes';
import { listPatientConditions } from '../../handlers/dental-patient/identity/listPatientConditions';
import { listPatientVisits } from '../../handlers/dental-patient/identity/listPatientVisits';
import { restoreDentalPatient } from '../../handlers/dental-patient/identity/restoreDentalPatient';
import { updateDentalPatient } from '../../handlers/dental-patient/identity/updateDentalPatient';
import { completePerioChart } from '../../handlers/dental-perio/completePerioChart';
import { createPerioChart } from '../../handlers/dental-perio/createPerioChart';
import { getPerioChart } from '../../handlers/dental-perio/getPerioChart';
import { getVisitPerioChart } from '../../handlers/dental-perio/getVisitPerioChart';
import { upsertToothReading } from '../../handlers/dental-perio/upsertToothReading';
import { exportPMD } from '../../handlers/dental-pmd/exportPMD';
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
  createAppointment,
  getAppointment,
  listAppointments,
  updateAppointment,

  // Dental-billing handlers
  applyDentalDiscount,
  createDentalInvoice,
  createDentalPaymentPlan,
  getCollectionsSummary,
  getDentalInvoice,
  getDentalPaymentPlan,
  getDentalPaymentReceipt,
  getPatientBalance,
  issueDentalInvoice,
  listDentalInvoices,
  listDentalPayments,
  markUncollectible,
  recordDentalPayment,
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
  deleteConsentTemplate,
  getBranchSettings,
  getDashboardSummary,
  getOrgContext,
  getWorkingHours,
  listConsentTemplates,
  listMembers,
  recoverPin,
  resetMemberPin,
  setSecurityQuestion,
  updateBranchSettings,
  updateConsentTemplate,
  updateWorkingHours,

  // Dental-clinical handlers
  approveAmendment,
  createAmendment,
  createAttachment,
  createConsentForm,
  createLabOrder,
  createMedicalHistoryEntry,
  createPrescription,
  deleteAttachment,
  listAmendments,
  listAttachments,
  listConsentForms,
  listLabOrders,
  listMedicalHistory,
  listPrescriptions,
  revokeConsentForm,
  signConsentForm,
  updateLabOrder,
  updateMedicalHistoryEntry,
  updatePrescription,

  // Dental-erasure handlers
  approveErasure,
  getErasureRequest,
  listErasureRequests,
  rejectErasure,
  requestErasure,

  // Dental-imaging handlers
  CephMgmt_batchUpsertCephLandmarks,
  CephMgmt_createCephReport,
  CephMgmt_deleteCephLandmark,
  CephMgmt_getCephAnalysis,
  CephMgmt_getCephReport,
  CephMgmt_listCephLandmarks,
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
  ImagingMgmt_getImagingStudy,
  ImagingMgmt_listMeasurements,
  ImagingMgmt_updateImageCalibration,
  ImagingMgmt_updateImageModality,
  PatientImageMgmt_listPatientImages,

  // Dental-patient handlers
  acceptTreatmentPlan,
  addFollowUpNote,
  archiveDentalPatient,
  bulkArchiveDentalPatients,
  createDentalPatient,
  exportDentalPatients,
  getDentalPatient,
  getDentalPatientSafetyFloor,
  getDentalPatientStatement,
  getTreatmentPlan,
  getTreatmentPlanVersion,
  importPatients,
  initializeDentition,
  listDentalPatients,
  listFollowUpNotes,
  listPatientConditions,
  listPatientVisits,
  restoreDentalPatient,
  updateDentalPatient,

  // Dental-perio handlers
  completePerioChart,
  createPerioChart,
  getPerioChart,
  getVisitPerioChart,
  upsertToothReading,

  // Dental-pmd handlers
  exportPMD,
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