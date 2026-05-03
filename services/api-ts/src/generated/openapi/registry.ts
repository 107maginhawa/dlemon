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
import { createAppointment } from '../../handlers/dental-scheduling/createAppointment';
import { listAppointments } from '../../handlers/dental-scheduling/listAppointments';
import { getAppointment } from '../../handlers/dental-scheduling/getAppointment';
import { updateAppointment } from '../../handlers/dental-scheduling/updateAppointment';
import { cancelAppointment } from '../../handlers/dental-scheduling/cancelAppointment';
import { checkInAppointment } from '../../handlers/dental-scheduling/checkInAppointment';
import { createDentalInvoice } from '../../handlers/dental-billing/createDentalInvoice';
import { listDentalInvoices } from '../../handlers/dental-billing/listDentalInvoices';
import { getDentalInvoice } from '../../handlers/dental-billing/getDentalInvoice';
import { applyDentalDiscount } from '../../handlers/dental-billing/applyDentalDiscount';
import { issueDentalInvoice } from '../../handlers/dental-billing/issueDentalInvoice';
import { recordDentalPayment } from '../../handlers/dental-billing/recordDentalPayment';
import { listDentalPayments } from '../../handlers/dental-billing/listDentalPayments';
import { voidDentalPayment } from '../../handlers/dental-billing/voidDentalPayment';
import { createDentalPaymentPlan } from '../../handlers/dental-billing/createDentalPaymentPlan';
import { getDentalPaymentPlan } from '../../handlers/dental-billing/getDentalPaymentPlan';
import { voidDentalInvoice } from '../../handlers/dental-billing/voidDentalInvoice';
import { createMedicalHistoryEntry } from '../../handlers/dental-clinical/createMedicalHistoryEntry';
import { listMedicalHistory } from '../../handlers/dental-clinical/listMedicalHistory';
import { updateMedicalHistoryEntry } from '../../handlers/dental-clinical/updateMedicalHistoryEntry';
import { createAmendment } from '../../handlers/dental-clinical/createAmendment';
import { listAmendments } from '../../handlers/dental-clinical/listAmendments';
import { createAttachment } from '../../handlers/dental-clinical/createAttachment';
import { listAttachments } from '../../handlers/dental-clinical/listAttachments';
import { deleteAttachment } from '../../handlers/dental-clinical/deleteAttachment';
import { createConsentForm } from '../../handlers/dental-clinical/createConsentForm';
import { listConsentForms } from '../../handlers/dental-clinical/listConsentForms';
import { signConsentForm } from '../../handlers/dental-clinical/signConsentForm';
import { createLabOrder } from '../../handlers/dental-clinical/createLabOrder';
import { listLabOrders } from '../../handlers/dental-clinical/listLabOrders';
import { updateLabOrder } from '../../handlers/dental-clinical/updateLabOrder';
import { createPrescription } from '../../handlers/dental-clinical/createPrescription';
import { listPrescriptions } from '../../handlers/dental-clinical/listPrescriptions';
import { updatePrescription } from '../../handlers/dental-clinical/updatePrescription';
import { DentalOrganizationManagement_create } from '../../handlers/dental-org/DentalOrganizationManagement_create';
import { DentalOrganizationManagement_get } from '../../handlers/dental-org/DentalOrganizationManagement_get';
import { DentalOrganizationManagement_update } from '../../handlers/dental-org/DentalOrganizationManagement_update';
import { DentalBranchManagement_create } from '../../handlers/dental-org/DentalBranchManagement_create';
import { DentalBranchManagement_list } from '../../handlers/dental-org/DentalBranchManagement_list';
import { DentalBranchManagement_get } from '../../handlers/dental-org/DentalBranchManagement_get';
import { DentalMembershipManagement_create } from '../../handlers/dental-org/DentalMembershipManagement_create';
import { DentalMembershipManagement_list } from '../../handlers/dental-org/DentalMembershipManagement_list';
import { DentalMembershipManagement_deactivate } from '../../handlers/dental-org/DentalMembershipManagement_deactivate';
import { DentalMembershipManagement_setPin } from '../../handlers/dental-org/DentalMembershipManagement_setPin';
import { DentalMembershipManagement_verifyPin } from '../../handlers/dental-org/DentalMembershipManagement_verifyPin';
import { importPMD } from '../../handlers/dental-pmd/importPMD';
import { listImportedPMDs } from '../../handlers/dental-pmd/listImportedPMDs';
import { listPMDs } from '../../handlers/dental-pmd/listPMDs';
import { generatePMD } from '../../handlers/dental-pmd/generatePMD';
import { getPMDForVisit } from '../../handlers/dental-pmd/getPMDForVisit';
import { createDentalVisit } from '../../handlers/dental-visit/createDentalVisit';
import { listDentalVisits } from '../../handlers/dental-visit/listDentalVisits';
import { getToothHistory } from '../../handlers/dental-visit/getToothHistory';
import { getDentalVisit } from '../../handlers/dental-visit/getDentalVisit';
import { updateDentalVisit } from '../../handlers/dental-visit/updateDentalVisit';
import { upsertDentalChart } from '../../handlers/dental-visit/upsertDentalChart';
import { getDentalChart } from '../../handlers/dental-visit/getDentalChart';
import { updateTooth } from '../../handlers/dental-visit/updateTooth';
import { upsertVisitNotes } from '../../handlers/dental-visit/upsertVisitNotes';
import { getVisitNotes } from '../../handlers/dental-visit/getVisitNotes';
import { createDentalTreatment } from '../../handlers/dental-visit/createDentalTreatment';
import { listDentalTreatments } from '../../handlers/dental-visit/listDentalTreatments';
import { updateDentalTreatment } from '../../handlers/dental-visit/updateDentalTreatment';
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

  // Dental-scheduling handlers
  createAppointment,
  listAppointments,
  getAppointment,
  updateAppointment,
  cancelAppointment,
  checkInAppointment,

  // Dental-billing handlers
  createDentalInvoice,
  listDentalInvoices,
  getDentalInvoice,
  applyDentalDiscount,
  issueDentalInvoice,
  recordDentalPayment,
  listDentalPayments,
  voidDentalPayment,
  createDentalPaymentPlan,
  getDentalPaymentPlan,
  voidDentalInvoice,

  // Dental-clinical handlers
  createMedicalHistoryEntry,
  listMedicalHistory,
  updateMedicalHistoryEntry,
  createAmendment,
  listAmendments,
  createAttachment,
  listAttachments,
  deleteAttachment,
  createConsentForm,
  listConsentForms,
  signConsentForm,
  createLabOrder,
  listLabOrders,
  updateLabOrder,
  createPrescription,
  listPrescriptions,
  updatePrescription,

  // Dental-org handlers
  DentalOrganizationManagement_create,
  DentalOrganizationManagement_get,
  DentalOrganizationManagement_update,
  DentalBranchManagement_create,
  DentalBranchManagement_list,
  DentalBranchManagement_get,
  DentalMembershipManagement_create,
  DentalMembershipManagement_list,
  DentalMembershipManagement_deactivate,
  DentalMembershipManagement_setPin,
  DentalMembershipManagement_verifyPin,

  // Dental-pmd handlers
  importPMD,
  listImportedPMDs,
  listPMDs,
  generatePMD,
  getPMDForVisit,

  // Dental-visit handlers
  createDentalVisit,
  listDentalVisits,
  getToothHistory,
  getDentalVisit,
  updateDentalVisit,
  upsertDentalChart,
  getDentalChart,
  updateTooth,
  upsertVisitNotes,
  getVisitNotes,
  createDentalTreatment,
  listDentalTreatments,
  updateDentalTreatment,

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