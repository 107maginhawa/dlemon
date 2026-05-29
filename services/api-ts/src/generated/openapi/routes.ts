import type { Hono, Handler } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { Variables } from '@/types/app';
import * as validators from './validators';
import { registry } from './registry';
import { authMiddleware } from '@/middleware/auth';
import { validationErrorHandler } from '@/middleware/validation';
import { createExpandMiddleware } from '@/middleware/expand';

export function registerRoutes(app: Hono<{ Variables: Variables }>) {
  // listAuditLogs
  app.get('/audit/logs',
    authMiddleware({ roles: ["admin", "support"] }),
    zValidator('query', validators.ListAuditLogsQuery, validationErrorHandler),
    registry.listAuditLogs as unknown as Handler
  );

  // createInvoice
  app.post('/billing/invoices',
    authMiddleware(),
    zValidator('json', validators.CreateInvoiceBody, validationErrorHandler),
    createExpandMiddleware("Invoice"),
    registry.createInvoice as unknown as Handler
  );

  // listInvoices
  app.get('/billing/invoices',
    authMiddleware(),
    zValidator('query', validators.ListInvoicesQuery, validationErrorHandler),
    registry.listInvoices as unknown as Handler
  );

  // getInvoice
  app.get('/billing/invoices/:invoice',
    authMiddleware(),
    zValidator('param', validators.GetInvoiceParams, validationErrorHandler),
    zValidator('query', validators.GetInvoiceQuery, validationErrorHandler),
    createExpandMiddleware("Invoice"),
    registry.getInvoice as unknown as Handler
  );

  // updateInvoice
  app.patch('/billing/invoices/:invoice',
    authMiddleware(),
    zValidator('param', validators.UpdateInvoiceParams, validationErrorHandler),
    zValidator('json', validators.UpdateInvoiceBody, validationErrorHandler),
    createExpandMiddleware("Invoice"),
    registry.updateInvoice as unknown as Handler
  );

  // deleteInvoice
  app.delete('/billing/invoices/:invoice',
    authMiddleware(),
    zValidator('param', validators.DeleteInvoiceParams, validationErrorHandler),
    registry.deleteInvoice as unknown as Handler
  );

  // captureInvoicePayment
  app.post('/billing/invoices/:invoice/capture',
    authMiddleware(),
    zValidator('param', validators.CaptureInvoicePaymentParams, validationErrorHandler),
    createExpandMiddleware("Invoice"),
    registry.captureInvoicePayment as unknown as Handler
  );

  // finalizeInvoice
  app.post('/billing/invoices/:invoice/finalize',
    authMiddleware(),
    zValidator('param', validators.FinalizeInvoiceParams, validationErrorHandler),
    createExpandMiddleware("Invoice"),
    registry.finalizeInvoice as unknown as Handler
  );

  // markInvoiceUncollectible
  app.post('/billing/invoices/:invoice/mark-uncollectible',
    authMiddleware(),
    zValidator('param', validators.MarkInvoiceUncollectibleParams, validationErrorHandler),
    createExpandMiddleware("Invoice"),
    registry.markInvoiceUncollectible as unknown as Handler
  );

  // payInvoice
  app.post('/billing/invoices/:invoice/pay',
    authMiddleware(),
    zValidator('param', validators.PayInvoiceParams, validationErrorHandler),
    zValidator('json', validators.PayInvoiceBody, validationErrorHandler),
    registry.payInvoice as unknown as Handler
  );

  // refundInvoicePayment
  app.post('/billing/invoices/:invoice/refund',
    authMiddleware(),
    zValidator('param', validators.RefundInvoicePaymentParams, validationErrorHandler),
    zValidator('json', validators.RefundInvoicePaymentBody, validationErrorHandler),
    registry.refundInvoicePayment as unknown as Handler
  );

  // voidInvoice
  app.post('/billing/invoices/:invoice/void',
    authMiddleware(),
    zValidator('param', validators.VoidInvoiceParams, validationErrorHandler),
    createExpandMiddleware("Invoice"),
    registry.voidInvoice as unknown as Handler
  );

  // createMerchantAccount
  app.post('/billing/merchant-accounts',
    authMiddleware(),
    zValidator('json', validators.CreateMerchantAccountBody, validationErrorHandler),
    createExpandMiddleware("MerchantAccount"),
    registry.createMerchantAccount as unknown as Handler
  );

  // getMerchantAccount
  app.get('/billing/merchant-accounts/:merchantAccount',
    authMiddleware(),
    zValidator('param', validators.GetMerchantAccountParams, validationErrorHandler),
    zValidator('query', validators.GetMerchantAccountQuery, validationErrorHandler),
    createExpandMiddleware("MerchantAccount"),
    registry.getMerchantAccount as unknown as Handler
  );

  // getMerchantDashboard
  app.post('/billing/merchant-accounts/:merchantAccount/dashboard',
    authMiddleware(),
    zValidator('param', validators.GetMerchantDashboardParams, validationErrorHandler),
    registry.getMerchantDashboard as unknown as Handler
  );

  // onboardMerchantAccount
  app.post('/billing/merchant-accounts/:merchantAccount/onboard',
    authMiddleware(),
    zValidator('param', validators.OnboardMerchantAccountParams, validationErrorHandler),
    zValidator('json', validators.OnboardMerchantAccountBody, validationErrorHandler),
    registry.onboardMerchantAccount as unknown as Handler
  );

  // handleStripeWebhook
  app.post('/billing/webhooks/stripe',
    zValidator('json', validators.HandleStripeWebhookBody, validationErrorHandler),
    registry.handleStripeWebhook as unknown as Handler
  );

  // createBooking
  app.post('/booking/bookings',
    authMiddleware({ roles: ["user"] }),
    zValidator('json', validators.CreateBookingBody, validationErrorHandler),
    createExpandMiddleware("Booking"),
    registry.createBooking as unknown as Handler
  );

  // listBookings
  app.get('/booking/bookings',
    authMiddleware({ roles: ["client:owner", "host:owner", "admin", "support"] }),
    zValidator('query', validators.ListBookingsQuery, validationErrorHandler),
    registry.listBookings as unknown as Handler
  );

  // getBooking
  app.get('/booking/bookings/:booking',
    authMiddleware({ roles: ["client:owner", "host:owner", "admin", "support"] }),
    zValidator('param', validators.GetBookingParams, validationErrorHandler),
    zValidator('query', validators.GetBookingQuery, validationErrorHandler),
    createExpandMiddleware("Booking"),
    registry.getBooking as unknown as Handler
  );

  // cancelBooking
  app.post('/booking/bookings/:booking/cancel',
    authMiddleware({ roles: ["client:owner", "host:owner", "admin"] }),
    zValidator('param', validators.CancelBookingParams, validationErrorHandler),
    zValidator('json', validators.CancelBookingBody, validationErrorHandler),
    createExpandMiddleware("Booking"),
    registry.cancelBooking as unknown as Handler
  );

  // confirmBooking
  app.post('/booking/bookings/:booking/confirm',
    authMiddleware({ roles: ["host:owner", "admin"] }),
    zValidator('param', validators.ConfirmBookingParams, validationErrorHandler),
    zValidator('json', validators.ConfirmBookingBody, validationErrorHandler),
    createExpandMiddleware("Booking"),
    registry.confirmBooking as unknown as Handler
  );

  // markNoShowBooking
  app.post('/booking/bookings/:booking/no-show',
    authMiddleware({ roles: ["client:owner", "host:owner", "admin"] }),
    zValidator('param', validators.MarkNoShowBookingParams, validationErrorHandler),
    zValidator('json', validators.MarkNoShowBookingBody, validationErrorHandler),
    createExpandMiddleware("Booking"),
    registry.markNoShowBooking as unknown as Handler
  );

  // rejectBooking
  app.post('/booking/bookings/:booking/reject',
    authMiddleware({ roles: ["host:owner", "admin"] }),
    zValidator('param', validators.RejectBookingParams, validationErrorHandler),
    zValidator('json', validators.RejectBookingBody, validationErrorHandler),
    createExpandMiddleware("Booking"),
    registry.rejectBooking as unknown as Handler
  );

  // listBookingEvents
  app.get('/booking/events',
    authMiddleware({ required: false }),
    zValidator('query', validators.ListBookingEventsQuery, validationErrorHandler),
    registry.listBookingEvents as unknown as Handler
  );

  // createBookingEvent
  app.post('/booking/events',
    authMiddleware({ roles: ["user"] }),
    zValidator('json', validators.CreateBookingEventBody, validationErrorHandler),
    createExpandMiddleware("BookingEvent"),
    registry.createBookingEvent as unknown as Handler
  );

  // getBookingEvent
  app.get('/booking/events/:event',
    authMiddleware({ required: false }),
    zValidator('param', validators.GetBookingEventParams, validationErrorHandler),
    zValidator('query', validators.GetBookingEventQuery, validationErrorHandler),
    createExpandMiddleware("BookingEvent"),
    registry.getBookingEvent as unknown as Handler
  );

  // updateBookingEvent
  app.patch('/booking/events/:event',
    authMiddleware({ roles: ["event:owner", "admin"] }),
    zValidator('param', validators.UpdateBookingEventParams, validationErrorHandler),
    zValidator('json', validators.UpdateBookingEventBody, validationErrorHandler),
    createExpandMiddleware("BookingEvent"),
    registry.updateBookingEvent as unknown as Handler
  );

  // deleteBookingEvent
  app.delete('/booking/events/:event',
    authMiddleware({ roles: ["event:owner", "admin"] }),
    zValidator('param', validators.DeleteBookingEventParams, validationErrorHandler),
    registry.deleteBookingEvent as unknown as Handler
  );

  // createScheduleException
  app.post('/booking/events/:event/exceptions',
    authMiddleware({ roles: ["event:owner", "admin"] }),
    zValidator('param', validators.CreateScheduleExceptionParams, validationErrorHandler),
    zValidator('json', validators.CreateScheduleExceptionBody, validationErrorHandler),
    registry.createScheduleException as unknown as Handler
  );

  // listScheduleExceptions
  app.get('/booking/events/:event/exceptions',
    authMiddleware({ roles: ["event:owner", "admin", "support"] }),
    zValidator('param', validators.ListScheduleExceptionsParams, validationErrorHandler),
    zValidator('query', validators.ListScheduleExceptionsQuery, validationErrorHandler),
    registry.listScheduleExceptions as unknown as Handler
  );

  // getScheduleException
  app.get('/booking/events/:event/exceptions/:exception',
    authMiddleware({ roles: ["event:owner", "admin", "support"] }),
    zValidator('param', validators.GetScheduleExceptionParams, validationErrorHandler),
    registry.getScheduleException as unknown as Handler
  );

  // deleteScheduleException
  app.delete('/booking/events/:event/exceptions/:exception',
    authMiddleware({ roles: ["event:owner", "admin"] }),
    zValidator('param', validators.DeleteScheduleExceptionParams, validationErrorHandler),
    registry.deleteScheduleException as unknown as Handler
  );

  // listEventSlots
  app.get('/booking/events/:event/slots',
    authMiddleware({ required: false }),
    zValidator('param', validators.ListEventSlotsParams, validationErrorHandler),
    zValidator('query', validators.ListEventSlotsQuery, validationErrorHandler),
    registry.listEventSlots as unknown as Handler
  );

  // getTimeSlot
  app.get('/booking/slots/:slotId',
    authMiddleware(),
    zValidator('param', validators.GetTimeSlotParams, validationErrorHandler),
    zValidator('query', validators.GetTimeSlotQuery, validationErrorHandler),
    createExpandMiddleware("TimeSlot"),
    registry.getTimeSlot as unknown as Handler
  );

  // createChatRoom
  app.post('/comms/chat-rooms',
    authMiddleware({ roles: ["user"] }),
    zValidator('json', validators.CreateChatRoomBody, validationErrorHandler),
    registry.createChatRoom as unknown as Handler
  );

  // listChatRooms
  app.get('/comms/chat-rooms',
    authMiddleware({ roles: ["user:participant"] }),
    zValidator('query', validators.ListChatRoomsQuery, validationErrorHandler),
    registry.listChatRooms as unknown as Handler
  );

  // getChatRoom
  app.get('/comms/chat-rooms/:room',
    authMiddleware({ roles: ["user:participant"] }),
    zValidator('param', validators.GetChatRoomParams, validationErrorHandler),
    registry.getChatRoom as unknown as Handler
  );

  // getChatMessages
  app.get('/comms/chat-rooms/:room/messages',
    authMiddleware({ roles: ["user:participant"] }),
    zValidator('param', validators.GetChatMessagesParams, validationErrorHandler),
    zValidator('query', validators.GetChatMessagesQuery, validationErrorHandler),
    registry.getChatMessages as unknown as Handler
  );

  // sendChatMessage
  app.post('/comms/chat-rooms/:room/messages',
    authMiddleware({ roles: ["user:participant"] }),
    zValidator('param', validators.SendChatMessageParams, validationErrorHandler),
    zValidator('json', validators.SendChatMessageBody, validationErrorHandler),
    registry.sendChatMessage as unknown as Handler
  );

  // endVideoCall
  app.post('/comms/chat-rooms/:room/video-call/end',
    authMiddleware({ roles: ["user:admin"] }),
    zValidator('param', validators.EndVideoCallParams, validationErrorHandler),
    registry.endVideoCall as unknown as Handler
  );

  // joinVideoCall
  app.post('/comms/chat-rooms/:room/video-call/join',
    authMiddleware({ roles: ["user:participant"] }),
    zValidator('param', validators.JoinVideoCallParams, validationErrorHandler),
    zValidator('json', validators.JoinVideoCallBody, validationErrorHandler),
    registry.joinVideoCall as unknown as Handler
  );

  // leaveVideoCall
  app.post('/comms/chat-rooms/:room/video-call/leave',
    authMiddleware({ roles: ["user:participant"] }),
    zValidator('param', validators.LeaveVideoCallParams, validationErrorHandler),
    registry.leaveVideoCall as unknown as Handler
  );

  // updateVideoCallParticipant
  app.patch('/comms/chat-rooms/:room/video-call/participant',
    authMiddleware({ roles: ["user:participant"] }),
    zValidator('param', validators.UpdateVideoCallParticipantParams, validationErrorHandler),
    zValidator('json', validators.UpdateVideoCallParticipantBody, validationErrorHandler),
    registry.updateVideoCallParticipant as unknown as Handler
  );

  // getIceServers
  app.get('/comms/ice-servers',
    authMiddleware({ roles: ["user"] }),
    registry.getIceServers as unknown as Handler
  );

  // createAppointment
  app.post('/dental/appointments',
    authMiddleware({ roles: ["user"] }),
    zValidator('json', validators.CreateAppointmentBody, validationErrorHandler),
    registry.createAppointment as unknown as Handler
  );

  // listAppointments
  app.get('/dental/appointments',
    authMiddleware({ roles: ["user"] }),
    zValidator('query', validators.ListAppointmentsQuery, validationErrorHandler),
    registry.listAppointments as unknown as Handler
  );

  // getAppointment
  app.get('/dental/appointments/:appointmentId',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.GetAppointmentParams, validationErrorHandler),
    registry.getAppointment as unknown as Handler
  );

  // updateAppointment
  app.patch('/dental/appointments/:appointmentId',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.UpdateAppointmentParams, validationErrorHandler),
    zValidator('json', validators.UpdateAppointmentBody, validationErrorHandler),
    registry.updateAppointment as unknown as Handler
  );

  // cancelAppointment
  app.delete('/dental/appointments/:appointmentId',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.CancelAppointmentParams, validationErrorHandler),
    zValidator('query', validators.CancelAppointmentQuery, validationErrorHandler),
    registry.cancelAppointment as unknown as Handler
  );

  // checkInAppointment
  app.post('/dental/appointments/:appointmentId/check-in',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.CheckInAppointmentParams, validationErrorHandler),
    registry.checkInAppointment as unknown as Handler
  );

  // getCollectionsSummary
  app.get('/dental/billing/collections/summary',
    authMiddleware({ roles: ["user"] }),
    zValidator('query', validators.GetCollectionsSummaryQuery, validationErrorHandler),
    registry.getCollectionsSummary as unknown as Handler
  );

  // createDentalInvoice
  app.post('/dental/billing/invoices',
    authMiddleware({ roles: ["user"] }),
    zValidator('json', validators.CreateDentalInvoiceBody, validationErrorHandler),
    registry.createDentalInvoice as unknown as Handler
  );

  // listDentalInvoices
  app.get('/dental/billing/invoices',
    authMiddleware({ roles: ["user"] }),
    zValidator('query', validators.ListDentalInvoicesQuery, validationErrorHandler),
    registry.listDentalInvoices as unknown as Handler
  );

  // getDentalInvoice
  app.get('/dental/billing/invoices/:invoiceId',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.GetDentalInvoiceParams, validationErrorHandler),
    registry.getDentalInvoice as unknown as Handler
  );

  // applyDentalDiscount
  app.post('/dental/billing/invoices/:invoiceId/discount',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.ApplyDentalDiscountParams, validationErrorHandler),
    zValidator('json', validators.ApplyDentalDiscountBody, validationErrorHandler),
    registry.applyDentalDiscount as unknown as Handler
  );

  // issueDentalInvoice
  app.patch('/dental/billing/invoices/:invoiceId/issue',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.IssueDentalInvoiceParams, validationErrorHandler),
    registry.issueDentalInvoice as unknown as Handler
  );

  // recordDentalPayment
  app.post('/dental/billing/invoices/:invoiceId/payments',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.RecordDentalPaymentParams, validationErrorHandler),
    zValidator('json', validators.RecordDentalPaymentBody, validationErrorHandler),
    registry.recordDentalPayment as unknown as Handler
  );

  // listDentalPayments
  app.get('/dental/billing/invoices/:invoiceId/payments',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.ListDentalPaymentsParams, validationErrorHandler),
    registry.listDentalPayments as unknown as Handler
  );

  // getDentalPaymentReceipt
  app.get('/dental/billing/invoices/:invoiceId/payments/:paymentId/receipt',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.GetDentalPaymentReceiptParams, validationErrorHandler),
    registry.getDentalPaymentReceipt as unknown as Handler
  );

  // voidDentalPayment
  app.post('/dental/billing/invoices/:invoiceId/payments/:paymentId/void',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.VoidDentalPaymentParams, validationErrorHandler),
    zValidator('json', validators.VoidDentalPaymentBody, validationErrorHandler),
    registry.voidDentalPayment as unknown as Handler
  );

  // createDentalPaymentPlan
  app.post('/dental/billing/invoices/:invoiceId/plan',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.CreateDentalPaymentPlanParams, validationErrorHandler),
    zValidator('json', validators.CreateDentalPaymentPlanBody, validationErrorHandler),
    registry.createDentalPaymentPlan as unknown as Handler
  );

  // getDentalPaymentPlan
  app.get('/dental/billing/invoices/:invoiceId/plan',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.GetDentalPaymentPlanParams, validationErrorHandler),
    registry.getDentalPaymentPlan as unknown as Handler
  );

  // markUncollectible
  app.post('/dental/billing/invoices/:invoiceId/uncollectible',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.MarkUncollectibleParams, validationErrorHandler),
    registry.markUncollectible as unknown as Handler
  );

  // voidDentalInvoice
  app.post('/dental/billing/invoices/:invoiceId/void',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.VoidDentalInvoiceParams, validationErrorHandler),
    registry.voidDentalInvoice as unknown as Handler
  );

  // getPatientBalance
  app.get('/dental/billing/patients/:patientId/balance',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.GetPatientBalanceParams, validationErrorHandler),
    registry.getPatientBalance as unknown as Handler
  );

  // listConsentTemplates
  app.get('/dental/branches/:branchId/consent-templates',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.ListConsentTemplatesParams, validationErrorHandler),
    registry.listConsentTemplates as unknown as Handler
  );

  // createConsentTemplate
  app.post('/dental/branches/:branchId/consent-templates',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.CreateConsentTemplateParams, validationErrorHandler),
    zValidator('json', validators.CreateConsentTemplateBody, validationErrorHandler),
    registry.createConsentTemplate as unknown as Handler
  );

  // updateConsentTemplate
  app.patch('/dental/branches/:branchId/consent-templates/:id',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.UpdateConsentTemplateParams, validationErrorHandler),
    zValidator('json', validators.UpdateConsentTemplateBody, validationErrorHandler),
    registry.updateConsentTemplate as unknown as Handler
  );

  // deleteConsentTemplate
  app.delete('/dental/branches/:branchId/consent-templates/:id',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.DeleteConsentTemplateParams, validationErrorHandler),
    registry.deleteConsentTemplate as unknown as Handler
  );

  // getBranchSettings
  app.get('/dental/branches/:branchId/settings',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.GetBranchSettingsParams, validationErrorHandler),
    registry.getBranchSettings as unknown as Handler
  );

  // updateBranchSettings
  app.put('/dental/branches/:branchId/settings',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.UpdateBranchSettingsParams, validationErrorHandler),
    zValidator('json', validators.UpdateBranchSettingsBody, validationErrorHandler),
    registry.updateBranchSettings as unknown as Handler
  );

  // getWorkingHours
  app.get('/dental/branches/:branchId/working-hours',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.GetWorkingHoursParams, validationErrorHandler),
    registry.getWorkingHours as unknown as Handler
  );

  // updateWorkingHours
  app.put('/dental/branches/:branchId/working-hours',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.UpdateWorkingHoursParams, validationErrorHandler),
    zValidator('json', validators.UpdateWorkingHoursBody, validationErrorHandler),
    registry.updateWorkingHours as unknown as Handler
  );

  // createMedicalHistoryEntry
  app.post('/dental/clinical/medical-history',
    authMiddleware({ roles: ["user"] }),
    zValidator('json', validators.CreateMedicalHistoryEntryBody, validationErrorHandler),
    registry.createMedicalHistoryEntry as unknown as Handler
  );

  // listMedicalHistory
  app.get('/dental/clinical/medical-history',
    authMiddleware({ roles: ["user"] }),
    zValidator('query', validators.ListMedicalHistoryQuery, validationErrorHandler),
    registry.listMedicalHistory as unknown as Handler
  );

  // updateMedicalHistoryEntry
  app.patch('/dental/clinical/medical-history/:entryId',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.UpdateMedicalHistoryEntryParams, validationErrorHandler),
    zValidator('json', validators.UpdateMedicalHistoryEntryBody, validationErrorHandler),
    registry.updateMedicalHistoryEntry as unknown as Handler
  );

  // getDashboardSummary
  app.get('/dental/dashboard/summary',
    authMiddleware({ roles: ["user"] }),
    zValidator('query', validators.GetDashboardSummaryQuery, validationErrorHandler),
    registry.getDashboardSummary as unknown as Handler
  );

  // ImagingFindingsMgmt_updateFinding
  app.patch('/dental/imaging/findings/:findingId',
    authMiddleware(),
    zValidator('param', validators.ImagingFindingsMgmt_updateFindingParams, validationErrorHandler),
    zValidator('json', validators.ImagingFindingsMgmt_updateFindingBody, validationErrorHandler),
    registry.ImagingFindingsMgmt_updateFinding as unknown as Handler
  );

  // ImagingFindingsMgmt_deleteFinding
  app.delete('/dental/imaging/findings/:findingId',
    authMiddleware(),
    zValidator('param', validators.ImagingFindingsMgmt_deleteFindingParams, validationErrorHandler),
    registry.ImagingFindingsMgmt_deleteFinding as unknown as Handler
  );

  // ImagingMgmt_deleteImage
  app.delete('/dental/imaging/images/:imageId',
    authMiddleware(),
    zValidator('param', validators.ImagingMgmt_deleteImageParams, validationErrorHandler),
    registry.ImagingMgmt_deleteImage as unknown as Handler
  );

  // ImagingMgmt_updateImageCalibration
  app.patch('/dental/imaging/images/:imageId/calibration',
    authMiddleware(),
    zValidator('param', validators.ImagingMgmt_updateImageCalibrationParams, validationErrorHandler),
    zValidator('json', validators.ImagingMgmt_updateImageCalibrationBody, validationErrorHandler),
    registry.ImagingMgmt_updateImageCalibration as unknown as Handler
  );

  // CephMgmt_getCephAnalysis
  app.get('/dental/imaging/images/:imageId/ceph/analysis',
    authMiddleware(),
    zValidator('param', validators.CephMgmt_getCephAnalysisParams, validationErrorHandler),
    registry.CephMgmt_getCephAnalysis as unknown as Handler
  );

  // CephMgmt_recomputeCephAnalysis
  app.post('/dental/imaging/images/:imageId/ceph/analysis/recompute',
    authMiddleware(),
    zValidator('param', validators.CephMgmt_recomputeCephAnalysisParams, validationErrorHandler),
    registry.CephMgmt_recomputeCephAnalysis as unknown as Handler
  );

  // CephMgmt_batchUpsertCephLandmarks
  app.post('/dental/imaging/images/:imageId/ceph/landmarks',
    authMiddleware(),
    zValidator('param', validators.CephMgmt_batchUpsertCephLandmarksParams, validationErrorHandler),
    zValidator('json', validators.CephMgmt_batchUpsertCephLandmarksBody, validationErrorHandler),
    registry.CephMgmt_batchUpsertCephLandmarks as unknown as Handler
  );

  // CephMgmt_listCephLandmarks
  app.get('/dental/imaging/images/:imageId/ceph/landmarks',
    authMiddleware(),
    zValidator('param', validators.CephMgmt_listCephLandmarksParams, validationErrorHandler),
    registry.CephMgmt_listCephLandmarks as unknown as Handler
  );

  // CephMgmt_updateCephLandmark
  app.patch('/dental/imaging/images/:imageId/ceph/landmarks/:landmarkCode',
    authMiddleware(),
    zValidator('param', validators.CephMgmt_updateCephLandmarkParams, validationErrorHandler),
    zValidator('json', validators.CephMgmt_updateCephLandmarkBody, validationErrorHandler),
    registry.CephMgmt_updateCephLandmark as unknown as Handler
  );

  // CephMgmt_deleteCephLandmark
  app.delete('/dental/imaging/images/:imageId/ceph/landmarks/:landmarkCode',
    authMiddleware(),
    zValidator('param', validators.CephMgmt_deleteCephLandmarkParams, validationErrorHandler),
    registry.CephMgmt_deleteCephLandmark as unknown as Handler
  );

  // CephMgmt_createCephReport
  app.post('/dental/imaging/images/:imageId/ceph/reports',
    authMiddleware(),
    zValidator('param', validators.CephMgmt_createCephReportParams, validationErrorHandler),
    registry.CephMgmt_createCephReport as unknown as Handler
  );

  // CephMgmt_getCephReport
  app.get('/dental/imaging/images/:imageId/ceph/reports',
    authMiddleware(),
    zValidator('param', validators.CephMgmt_getCephReportParams, validationErrorHandler),
    zValidator('query', validators.CephMgmt_getCephReportQuery, validationErrorHandler),
    registry.CephMgmt_getCephReport as unknown as Handler
  );

  // ImagingFindingsMgmt_createFinding
  app.post('/dental/imaging/images/:imageId/findings',
    authMiddleware(),
    zValidator('param', validators.ImagingFindingsMgmt_createFindingParams, validationErrorHandler),
    zValidator('json', validators.ImagingFindingsMgmt_createFindingBody, validationErrorHandler),
    registry.ImagingFindingsMgmt_createFinding as unknown as Handler
  );

  // ImagingFindingsMgmt_listFindings
  app.get('/dental/imaging/images/:imageId/findings',
    authMiddleware(),
    zValidator('param', validators.ImagingFindingsMgmt_listFindingsParams, validationErrorHandler),
    registry.ImagingFindingsMgmt_listFindings as unknown as Handler
  );

  // ImagingMgmt_createMeasurement
  app.post('/dental/imaging/images/:imageId/measurements',
    authMiddleware(),
    zValidator('param', validators.ImagingMgmt_createMeasurementParams, validationErrorHandler),
    zValidator('json', validators.ImagingMgmt_createMeasurementBody, validationErrorHandler),
    registry.ImagingMgmt_createMeasurement as unknown as Handler
  );

  // ImagingMgmt_listMeasurements
  app.get('/dental/imaging/images/:imageId/measurements',
    authMiddleware(),
    zValidator('param', validators.ImagingMgmt_listMeasurementsParams, validationErrorHandler),
    registry.ImagingMgmt_listMeasurements as unknown as Handler
  );

  // ImagingMgmt_updateImageModality
  app.patch('/dental/imaging/images/:imageId/modality',
    authMiddleware(),
    zValidator('param', validators.ImagingMgmt_updateImageModalityParams, validationErrorHandler),
    zValidator('json', validators.ImagingMgmt_updateImageModalityBody, validationErrorHandler),
    registry.ImagingMgmt_updateImageModality as unknown as Handler
  );

  // ImagingMgmt_deleteMeasurement
  app.delete('/dental/imaging/measurements/:measurementId',
    authMiddleware(),
    zValidator('param', validators.ImagingMgmt_deleteMeasurementParams, validationErrorHandler),
    registry.ImagingMgmt_deleteMeasurement as unknown as Handler
  );

  // ImagingMgmt_createImagingStudy
  app.post('/dental/imaging/studies',
    authMiddleware(),
    zValidator('json', validators.ImagingMgmt_createImagingStudyBody, validationErrorHandler),
    registry.ImagingMgmt_createImagingStudy as unknown as Handler
  );

  // ImagingMgmt_getImagingStudy
  app.get('/dental/imaging/studies/:studyId',
    authMiddleware(),
    zValidator('param', validators.ImagingMgmt_getImagingStudyParams, validationErrorHandler),
    registry.ImagingMgmt_getImagingStudy as unknown as Handler
  );

  // getOrgContext
  app.get('/dental/org/context',
    authMiddleware({ roles: ["user"] }),
    registry.getOrgContext as unknown as Handler
  );

  // listMembers
  app.get('/dental/org/members',
    authMiddleware({ roles: ["user"] }),
    zValidator('query', validators.ListMembersQuery, validationErrorHandler),
    registry.listMembers as unknown as Handler
  );

  // createMember
  app.post('/dental/org/members',
    authMiddleware({ roles: ["user"] }),
    zValidator('json', validators.CreateMemberBody, validationErrorHandler),
    registry.createMember as unknown as Handler
  );

  // recoverPin
  app.post('/dental/org/members/:memberId/recover-pin',
    zValidator('param', validators.RecoverPinParams, validationErrorHandler),
    zValidator('json', validators.RecoverPinBody, validationErrorHandler),
    registry.recoverPin as unknown as Handler
  );

  // resetMemberPin
  app.post('/dental/org/members/:memberId/reset-pin',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.ResetMemberPinParams, validationErrorHandler),
    zValidator('json', validators.ResetMemberPinBody, validationErrorHandler),
    registry.resetMemberPin as unknown as Handler
  );

  // setSecurityQuestion
  app.post('/dental/org/members/:memberId/security-question',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.SetSecurityQuestionParams, validationErrorHandler),
    zValidator('json', validators.SetSecurityQuestionBody, validationErrorHandler),
    registry.setSecurityQuestion as unknown as Handler
  );

  // DentalOrganizationManagement_create
  app.post('/dental/organizations',
    authMiddleware(),
    zValidator('json', validators.DentalOrganizationManagement_createBody, validationErrorHandler),
    registry.DentalOrganizationManagement_create as unknown as Handler
  );

  // DentalOrganizationManagement_get
  app.get('/dental/organizations/:id',
    authMiddleware(),
    zValidator('param', validators.DentalOrganizationManagement_getParams, validationErrorHandler),
    registry.DentalOrganizationManagement_get as unknown as Handler
  );

  // DentalOrganizationManagement_update
  app.patch('/dental/organizations/:id',
    authMiddleware(),
    zValidator('param', validators.DentalOrganizationManagement_updateParams, validationErrorHandler),
    zValidator('json', validators.DentalOrganizationManagement_updateBody, validationErrorHandler),
    registry.DentalOrganizationManagement_update as unknown as Handler
  );

  // DentalBranchManagement_create
  app.post('/dental/organizations/:orgId/branches',
    authMiddleware(),
    zValidator('param', validators.DentalBranchManagement_createParams, validationErrorHandler),
    zValidator('json', validators.DentalBranchManagement_createBody, validationErrorHandler),
    registry.DentalBranchManagement_create as unknown as Handler
  );

  // DentalBranchManagement_list
  app.get('/dental/organizations/:orgId/branches',
    authMiddleware(),
    zValidator('param', validators.DentalBranchManagement_listParams, validationErrorHandler),
    registry.DentalBranchManagement_list as unknown as Handler
  );

  // DentalBranchManagement_get
  app.get('/dental/organizations/:orgId/branches/:branchId',
    authMiddleware(),
    zValidator('param', validators.DentalBranchManagement_getParams, validationErrorHandler),
    registry.DentalBranchManagement_get as unknown as Handler
  );

  // DentalMembershipManagement_create
  app.post('/dental/organizations/:orgId/branches/:branchId/members',
    authMiddleware(),
    zValidator('param', validators.DentalMembershipManagement_createParams, validationErrorHandler),
    zValidator('json', validators.DentalMembershipManagement_createBody, validationErrorHandler),
    registry.DentalMembershipManagement_create as unknown as Handler
  );

  // DentalMembershipManagement_list
  app.get('/dental/organizations/:orgId/branches/:branchId/members',
    authMiddleware(),
    zValidator('param', validators.DentalMembershipManagement_listParams, validationErrorHandler),
    registry.DentalMembershipManagement_list as unknown as Handler
  );

  // DentalMembershipManagement_deactivate
  app.post('/dental/organizations/:orgId/branches/:branchId/members/:membershipId/deactivate',
    authMiddleware(),
    zValidator('param', validators.DentalMembershipManagement_deactivateParams, validationErrorHandler),
    zValidator('json', validators.DentalMembershipManagement_deactivateBody, validationErrorHandler),
    registry.DentalMembershipManagement_deactivate as unknown as Handler
  );

  // DentalMembershipManagement_setPin
  app.post('/dental/organizations/:orgId/branches/:branchId/members/:membershipId/set-pin',
    authMiddleware(),
    zValidator('param', validators.DentalMembershipManagement_setPinParams, validationErrorHandler),
    zValidator('json', validators.DentalMembershipManagement_setPinBody, validationErrorHandler),
    registry.DentalMembershipManagement_setPin as unknown as Handler
  );

  // DentalMembershipManagement_verifyPin
  app.post('/dental/organizations/:orgId/branches/:branchId/members/:membershipId/verify-pin',
    authMiddleware(),
    zValidator('param', validators.DentalMembershipManagement_verifyPinParams, validationErrorHandler),
    zValidator('json', validators.DentalMembershipManagement_verifyPinBody, validationErrorHandler),
    registry.DentalMembershipManagement_verifyPin as unknown as Handler
  );

  // createDentalPatient
  app.post('/dental/patients',
    authMiddleware({ roles: ["user"] }),
    zValidator('json', validators.CreateDentalPatientBody, validationErrorHandler),
    registry.createDentalPatient as unknown as Handler
  );

  // listDentalPatients
  app.get('/dental/patients',
    authMiddleware({ roles: ["user"] }),
    zValidator('query', validators.ListDentalPatientsQuery, validationErrorHandler),
    registry.listDentalPatients as unknown as Handler
  );

  // bulkArchiveDentalPatients
  app.post('/dental/patients/bulk-archive',
    authMiddleware({ roles: ["user"] }),
    zValidator('json', validators.BulkArchiveDentalPatientsBody, validationErrorHandler),
    registry.bulkArchiveDentalPatients as unknown as Handler
  );

  // exportDentalPatients
  app.get('/dental/patients/export',
    authMiddleware({ roles: ["user"] }),
    zValidator('query', validators.ExportDentalPatientsQuery, validationErrorHandler),
    registry.exportDentalPatients as unknown as Handler
  );

  // importPatients
  app.post('/dental/patients/import',
    authMiddleware({ roles: ["user"] }),
    zValidator('json', validators.ImportPatientsBody, validationErrorHandler),
    registry.importPatients as unknown as Handler
  );

  // getDentalPatient
  app.get('/dental/patients/:id',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.GetDentalPatientParams, validationErrorHandler),
    registry.getDentalPatient as unknown as Handler
  );

  // updateDentalPatient
  app.patch('/dental/patients/:id',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.UpdateDentalPatientParams, validationErrorHandler),
    zValidator('json', validators.UpdateDentalPatientBody, validationErrorHandler),
    registry.updateDentalPatient as unknown as Handler
  );

  // archiveDentalPatient
  app.post('/dental/patients/:id/archive',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.ArchiveDentalPatientParams, validationErrorHandler),
    registry.archiveDentalPatient as unknown as Handler
  );

  // listFollowUpNotes
  app.get('/dental/patients/:id/follow-up-notes',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.ListFollowUpNotesParams, validationErrorHandler),
    registry.listFollowUpNotes as unknown as Handler
  );

  // addFollowUpNote
  app.post('/dental/patients/:id/follow-up-notes',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.AddFollowUpNoteParams, validationErrorHandler),
    zValidator('json', validators.AddFollowUpNoteBody, validationErrorHandler),
    registry.addFollowUpNote as unknown as Handler
  );

  // restoreDentalPatient
  app.post('/dental/patients/:id/restore',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.RestoreDentalPatientParams, validationErrorHandler),
    registry.restoreDentalPatient as unknown as Handler
  );

  // getDentalPatientSafetyFloor
  app.get('/dental/patients/:id/safety-floor',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.GetDentalPatientSafetyFloorParams, validationErrorHandler),
    registry.getDentalPatientSafetyFloor as unknown as Handler
  );

  // getDentalPatientStatement
  app.get('/dental/patients/:id/statement',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.GetDentalPatientStatementParams, validationErrorHandler),
    registry.getDentalPatientStatement as unknown as Handler
  );

  // initializeDentition
  app.post('/dental/patients/:patientId/dentition',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.InitializeDentitionParams, validationErrorHandler),
    zValidator('json', validators.InitializeDentitionBody, validationErrorHandler),
    registry.initializeDentition as unknown as Handler
  );

  // PatientImageMgmt_listPatientImages
  app.get('/dental/patients/:patientId/images',
    authMiddleware(),
    zValidator('param', validators.PatientImageMgmt_listPatientImagesParams, validationErrorHandler),
    zValidator('query', validators.PatientImageMgmt_listPatientImagesQuery, validationErrorHandler),
    registry.PatientImageMgmt_listPatientImages as unknown as Handler
  );

  // getTreatmentPlan
  app.get('/dental/patients/:patientId/treatment-plan',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.GetTreatmentPlanParams, validationErrorHandler),
    registry.getTreatmentPlan as unknown as Handler
  );

  // acceptTreatmentPlan
  app.post('/dental/patients/:patientId/treatment-plan/accept',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.AcceptTreatmentPlanParams, validationErrorHandler),
    zValidator('json', validators.AcceptTreatmentPlanBody, validationErrorHandler),
    registry.acceptTreatmentPlan as unknown as Handler
  );

  // getTreatmentPlanVersion
  app.get('/dental/patients/:patientId/treatment-plan/versions/:versionId',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.GetTreatmentPlanVersionParams, validationErrorHandler),
    registry.getTreatmentPlanVersion as unknown as Handler
  );

  // listPatientConditions
  app.get('/dental/patients/:patientId/treatments',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.ListPatientConditionsParams, validationErrorHandler),
    zValidator('query', validators.ListPatientConditionsQuery, validationErrorHandler),
    registry.listPatientConditions as unknown as Handler
  );

  // listPatientVisits
  app.get('/dental/patients/:patientId/visits',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.ListPatientVisitsParams, validationErrorHandler),
    zValidator('query', validators.ListPatientVisitsQuery, validationErrorHandler),
    registry.listPatientVisits as unknown as Handler
  );

  // createPerioChart
  app.post('/dental/perio-charts',
    authMiddleware({ roles: ["user"] }),
    zValidator('json', validators.CreatePerioChartBody, validationErrorHandler),
    registry.createPerioChart as unknown as Handler
  );

  // getPerioChart
  app.get('/dental/perio-charts/:chartId',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.GetPerioChartParams, validationErrorHandler),
    registry.getPerioChart as unknown as Handler
  );

  // completePerioChart
  app.post('/dental/perio-charts/:chartId/complete',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.CompletePerioChartParams, validationErrorHandler),
    registry.completePerioChart as unknown as Handler
  );

  // upsertToothReading
  app.put('/dental/perio-charts/:chartId/readings/:toothNumber',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.UpsertToothReadingParams, validationErrorHandler),
    zValidator('json', validators.UpsertToothReadingBody, validationErrorHandler),
    registry.upsertToothReading as unknown as Handler
  );

  // importPMD
  app.post('/dental/pmd/import',
    authMiddleware({ roles: ["user"] }),
    zValidator('json', validators.ImportPMDBody, validationErrorHandler),
    registry.importPMD as unknown as Handler
  );

  // listImportedPMDs
  app.get('/dental/pmd/imported',
    authMiddleware({ roles: ["user"] }),
    zValidator('query', validators.ListImportedPMDsQuery, validationErrorHandler),
    registry.listImportedPMDs as unknown as Handler
  );

  // getImportedPMD
  app.get('/dental/pmd/imported/:id',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.GetImportedPMDParams, validationErrorHandler),
    registry.getImportedPMD as unknown as Handler
  );

  // listTreatmentTemplates
  app.get('/dental/treatment-templates',
    authMiddleware({ roles: ["user"] }),
    registry.listTreatmentTemplates as unknown as Handler
  );

  // createTreatmentTemplate
  app.post('/dental/treatment-templates',
    authMiddleware({ roles: ["user"] }),
    zValidator('json', validators.CreateTreatmentTemplateBody, validationErrorHandler),
    registry.createTreatmentTemplate as unknown as Handler
  );

  // updateTreatmentTemplate
  app.patch('/dental/treatment-templates/:id',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.UpdateTreatmentTemplateParams, validationErrorHandler),
    zValidator('json', validators.UpdateTreatmentTemplateBody, validationErrorHandler),
    registry.updateTreatmentTemplate as unknown as Handler
  );

  // deleteTreatmentTemplate
  app.delete('/dental/treatment-templates/:id',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.DeleteTreatmentTemplateParams, validationErrorHandler),
    registry.deleteTreatmentTemplate as unknown as Handler
  );

  // createDentalVisit
  app.post('/dental/visits',
    authMiddleware({ roles: ["user"] }),
    zValidator('json', validators.CreateDentalVisitBody, validationErrorHandler),
    registry.createDentalVisit as unknown as Handler
  );

  // listDentalVisits
  app.get('/dental/visits',
    authMiddleware({ roles: ["user"] }),
    zValidator('query', validators.ListDentalVisitsQuery, validationErrorHandler),
    registry.listDentalVisits as unknown as Handler
  );

  // getToothHistory
  app.get('/dental/visits/history/:patientId/teeth/:toothNumber',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.GetToothHistoryParams, validationErrorHandler),
    registry.getToothHistory as unknown as Handler
  );

  // listPMDs
  app.get('/dental/visits/pmd',
    authMiddleware({ roles: ["user"] }),
    zValidator('query', validators.ListPMDsQuery, validationErrorHandler),
    registry.listPMDs as unknown as Handler
  );

  // getDentalVisit
  app.get('/dental/visits/:visitId',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.GetDentalVisitParams, validationErrorHandler),
    registry.getDentalVisit as unknown as Handler
  );

  // updateDentalVisit
  app.patch('/dental/visits/:visitId',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.UpdateDentalVisitParams, validationErrorHandler),
    zValidator('json', validators.UpdateDentalVisitBody, validationErrorHandler),
    registry.updateDentalVisit as unknown as Handler
  );

  // createAmendment
  app.post('/dental/visits/:visitId/amendments',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.CreateAmendmentParams, validationErrorHandler),
    zValidator('json', validators.CreateAmendmentBody, validationErrorHandler),
    registry.createAmendment as unknown as Handler
  );

  // listAmendments
  app.get('/dental/visits/:visitId/amendments',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.ListAmendmentsParams, validationErrorHandler),
    registry.listAmendments as unknown as Handler
  );

  // applyTemplate
  app.post('/dental/visits/:visitId/apply-template/:templateId',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.ApplyTemplateParams, validationErrorHandler),
    registry.applyTemplate as unknown as Handler
  );

  // createAttachment
  app.post('/dental/visits/:visitId/attachments',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.CreateAttachmentParams, validationErrorHandler),
    zValidator('json', validators.CreateAttachmentBody, validationErrorHandler),
    registry.createAttachment as unknown as Handler
  );

  // listAttachments
  app.get('/dental/visits/:visitId/attachments',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.ListAttachmentsParams, validationErrorHandler),
    registry.listAttachments as unknown as Handler
  );

  // deleteAttachment
  app.delete('/dental/visits/:visitId/attachments/:attachmentId',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.DeleteAttachmentParams, validationErrorHandler),
    registry.deleteAttachment as unknown as Handler
  );

  // carryOverTreatments
  app.post('/dental/visits/:visitId/carry-over',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.CarryOverTreatmentsParams, validationErrorHandler),
    zValidator('json', validators.CarryOverTreatmentsBody, validationErrorHandler),
    registry.carryOverTreatments as unknown as Handler
  );

  // upsertDentalChart
  app.post('/dental/visits/:visitId/chart',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.UpsertDentalChartParams, validationErrorHandler),
    zValidator('json', validators.UpsertDentalChartBody, validationErrorHandler),
    registry.upsertDentalChart as unknown as Handler
  );

  // getDentalChart
  app.get('/dental/visits/:visitId/chart',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.GetDentalChartParams, validationErrorHandler),
    registry.getDentalChart as unknown as Handler
  );

  // updateTooth
  app.patch('/dental/visits/:visitId/chart/teeth/:toothNumber',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.UpdateToothParams, validationErrorHandler),
    zValidator('json', validators.UpdateToothBody, validationErrorHandler),
    registry.updateTooth as unknown as Handler
  );

  // createConsentForm
  app.post('/dental/visits/:visitId/consents',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.CreateConsentFormParams, validationErrorHandler),
    zValidator('json', validators.CreateConsentFormBody, validationErrorHandler),
    registry.createConsentForm as unknown as Handler
  );

  // listConsentForms
  app.get('/dental/visits/:visitId/consents',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.ListConsentFormsParams, validationErrorHandler),
    registry.listConsentForms as unknown as Handler
  );

  // signConsentForm
  app.post('/dental/visits/:visitId/consents/:consentId/sign',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.SignConsentFormParams, validationErrorHandler),
    zValidator('json', validators.SignConsentFormBody, validationErrorHandler),
    registry.signConsentForm as unknown as Handler
  );

  // createLabOrder
  app.post('/dental/visits/:visitId/lab-orders',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.CreateLabOrderParams, validationErrorHandler),
    zValidator('json', validators.CreateLabOrderBody, validationErrorHandler),
    registry.createLabOrder as unknown as Handler
  );

  // listLabOrders
  app.get('/dental/visits/:visitId/lab-orders',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.ListLabOrdersParams, validationErrorHandler),
    registry.listLabOrders as unknown as Handler
  );

  // updateLabOrder
  app.patch('/dental/visits/:visitId/lab-orders/:orderId',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.UpdateLabOrderParams, validationErrorHandler),
    zValidator('json', validators.UpdateLabOrderBody, validationErrorHandler),
    registry.updateLabOrder as unknown as Handler
  );

  // upsertVisitNotes
  app.post('/dental/visits/:visitId/notes',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.UpsertVisitNotesParams, validationErrorHandler),
    zValidator('json', validators.UpsertVisitNotesBody, validationErrorHandler),
    registry.upsertVisitNotes as unknown as Handler
  );

  // getVisitNotes
  app.get('/dental/visits/:visitId/notes',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.GetVisitNotesParams, validationErrorHandler),
    registry.getVisitNotes as unknown as Handler
  );

  // createVisitNoteAddendum
  app.post('/dental/visits/:visitId/notes/addendum',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.CreateVisitNoteAddendumParams, validationErrorHandler),
    zValidator('json', validators.CreateVisitNoteAddendumBody, validationErrorHandler),
    registry.createVisitNoteAddendum as unknown as Handler
  );

  // getVisitNoteHistory
  app.get('/dental/visits/:visitId/notes/history',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.GetVisitNoteHistoryParams, validationErrorHandler),
    registry.getVisitNoteHistory as unknown as Handler
  );

  // signVisitNotes
  app.post('/dental/visits/:visitId/notes/sign',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.SignVisitNotesParams, validationErrorHandler),
    zValidator('json', validators.SignVisitNotesBody, validationErrorHandler),
    registry.signVisitNotes as unknown as Handler
  );

  // getVisitPerioChart
  app.get('/dental/visits/:visitId/perio-chart',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.GetVisitPerioChartParams, validationErrorHandler),
    registry.getVisitPerioChart as unknown as Handler
  );

  // generatePMD
  app.post('/dental/visits/:visitId/pmd',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.GeneratePMDParams, validationErrorHandler),
    zValidator('json', validators.GeneratePMDBody, validationErrorHandler),
    registry.generatePMD as unknown as Handler
  );

  // getPMDForVisit
  app.get('/dental/visits/:visitId/pmd',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.GetPMDForVisitParams, validationErrorHandler),
    registry.getPMDForVisit as unknown as Handler
  );

  // exportPMD
  app.get('/dental/visits/:visitId/pmd/export',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.ExportPMDParams, validationErrorHandler),
    registry.exportPMD as unknown as Handler
  );

  // createPrescription
  app.post('/dental/visits/:visitId/prescriptions',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.CreatePrescriptionParams, validationErrorHandler),
    zValidator('json', validators.CreatePrescriptionBody, validationErrorHandler),
    registry.createPrescription as unknown as Handler
  );

  // listPrescriptions
  app.get('/dental/visits/:visitId/prescriptions',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.ListPrescriptionsParams, validationErrorHandler),
    registry.listPrescriptions as unknown as Handler
  );

  // updatePrescription
  app.patch('/dental/visits/:visitId/prescriptions/:prescriptionId',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.UpdatePrescriptionParams, validationErrorHandler),
    zValidator('json', validators.UpdatePrescriptionBody, validationErrorHandler),
    registry.updatePrescription as unknown as Handler
  );

  // createDentalTreatment
  app.post('/dental/visits/:visitId/treatments',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.CreateDentalTreatmentParams, validationErrorHandler),
    zValidator('json', validators.CreateDentalTreatmentBody, validationErrorHandler),
    registry.createDentalTreatment as unknown as Handler
  );

  // listDentalTreatments
  app.get('/dental/visits/:visitId/treatments',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.ListDentalTreatmentsParams, validationErrorHandler),
    registry.listDentalTreatments as unknown as Handler
  );

  // updateDentalTreatment
  app.patch('/dental/visits/:visitId/treatments/:treatmentId',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.UpdateDentalTreatmentParams, validationErrorHandler),
    zValidator('json', validators.UpdateDentalTreatmentBody, validationErrorHandler),
    registry.updateDentalTreatment as unknown as Handler
  );

  // listEmailQueueItems
  app.get('/email/queue',
    authMiddleware({ roles: ["admin"] }),
    zValidator('query', validators.ListEmailQueueItemsQuery, validationErrorHandler),
    registry.listEmailQueueItems as unknown as Handler
  );

  // getEmailQueueItem
  app.get('/email/queue/:queue',
    authMiddleware({ roles: ["admin"] }),
    zValidator('param', validators.GetEmailQueueItemParams, validationErrorHandler),
    registry.getEmailQueueItem as unknown as Handler
  );

  // cancelEmailQueueItem
  app.post('/email/queue/:queue/cancel',
    authMiddleware({ roles: ["admin"] }),
    zValidator('param', validators.CancelEmailQueueItemParams, validationErrorHandler),
    zValidator('json', validators.CancelEmailQueueItemBody, validationErrorHandler),
    registry.cancelEmailQueueItem as unknown as Handler
  );

  // retryEmailQueueItem
  app.post('/email/queue/:queue/retry',
    authMiddleware({ roles: ["admin"] }),
    zValidator('param', validators.RetryEmailQueueItemParams, validationErrorHandler),
    registry.retryEmailQueueItem as unknown as Handler
  );

  // listEmailTemplates
  app.get('/email/templates',
    authMiddleware({ roles: ["admin"] }),
    zValidator('query', validators.ListEmailTemplatesQuery, validationErrorHandler),
    registry.listEmailTemplates as unknown as Handler
  );

  // createEmailTemplate
  app.post('/email/templates',
    authMiddleware({ roles: ["admin"] }),
    zValidator('json', validators.CreateEmailTemplateBody, validationErrorHandler),
    registry.createEmailTemplate as unknown as Handler
  );

  // getEmailTemplate
  app.get('/email/templates/:template',
    authMiddleware({ roles: ["admin"] }),
    zValidator('param', validators.GetEmailTemplateParams, validationErrorHandler),
    registry.getEmailTemplate as unknown as Handler
  );

  // updateEmailTemplate
  app.patch('/email/templates/:template',
    authMiddleware({ roles: ["admin"] }),
    zValidator('param', validators.UpdateEmailTemplateParams, validationErrorHandler),
    zValidator('json', validators.UpdateEmailTemplateBody, validationErrorHandler),
    registry.updateEmailTemplate as unknown as Handler
  );

  // testEmailTemplate
  app.post('/email/templates/:template/test',
    authMiddleware({ roles: ["admin"] }),
    zValidator('param', validators.TestEmailTemplateParams, validationErrorHandler),
    zValidator('json', validators.TestEmailTemplateBody, validationErrorHandler),
    registry.testEmailTemplate as unknown as Handler
  );

  // createConsultation
  app.post('/emr/consultations',
    authMiddleware({ roles: ["provider"] }),
    zValidator('json', validators.CreateConsultationBody, validationErrorHandler),
    registry.createConsultation as unknown as Handler
  );

  // listConsultations
  app.get('/emr/consultations',
    authMiddleware({ roles: ["provider", "admin", "patient"] }),
    zValidator('query', validators.ListConsultationsQuery, validationErrorHandler),
    registry.listConsultations as unknown as Handler
  );

  // getConsultation
  app.get('/emr/consultations/:consultation',
    authMiddleware({ roles: ["admin", "provider:owner", "patient:owner"] }),
    zValidator('param', validators.GetConsultationParams, validationErrorHandler),
    registry.getConsultation as unknown as Handler
  );

  // updateConsultation
  app.patch('/emr/consultations/:consultation',
    authMiddleware({ roles: ["provider:owner"] }),
    zValidator('param', validators.UpdateConsultationParams, validationErrorHandler),
    zValidator('json', validators.UpdateConsultationBody, validationErrorHandler),
    registry.updateConsultation as unknown as Handler
  );

  // finalizeConsultation
  app.post('/emr/consultations/:consultation/finalize',
    authMiddleware({ roles: ["provider:owner"] }),
    zValidator('param', validators.FinalizeConsultationParams, validationErrorHandler),
    registry.finalizeConsultation as unknown as Handler
  );

  // listEMRPatients
  app.get('/emr/patients',
    authMiddleware({ roles: ["provider", "admin"] }),
    zValidator('query', validators.ListEMRPatientsQuery, validationErrorHandler),
    registry.listEMRPatients as unknown as Handler
  );

  // listNotifications
  app.get('/notifs',
    authMiddleware({ roles: ["user", "admin"] }),
    zValidator('query', validators.ListNotificationsQuery, validationErrorHandler),
    registry.listNotifications as unknown as Handler
  );

  // markAllNotificationsAsRead
  app.post('/notifs/read-all',
    authMiddleware({ roles: ["user"] }),
    zValidator('query', validators.MarkAllNotificationsAsReadQuery, validationErrorHandler),
    registry.markAllNotificationsAsRead as unknown as Handler
  );

  // getNotification
  app.get('/notifs/:notif',
    authMiddleware({ roles: ["user", "admin"] }),
    zValidator('param', validators.GetNotificationParams, validationErrorHandler),
    registry.getNotification as unknown as Handler
  );

  // markNotificationAsRead
  app.post('/notifs/:notif/read',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.MarkNotificationAsReadParams, validationErrorHandler),
    registry.markNotificationAsRead as unknown as Handler
  );

  // createPatient
  app.post('/patients',
    authMiddleware({ roles: ["admin", "clinician", "registrar", "user"] }),
    zValidator('json', validators.CreatePatientBody, validationErrorHandler),
    registry.createPatient as unknown as Handler
  );

  // listPatients
  app.get('/patients',
    authMiddleware({ roles: ["admin", "clinician", "support", "user"] }),
    zValidator('query', validators.ListPatientsQuery, validationErrorHandler),
    registry.listPatients as unknown as Handler
  );

  // mergePatients
  app.post('/patients/merge',
    zValidator('json', validators.MergePatientsBody, validationErrorHandler),
    registry.mergePatients as unknown as Handler
  );

  // unmergePatients
  app.post('/patients/unmerge',
    zValidator('json', validators.UnmergePatientsBody, validationErrorHandler),
    registry.unmergePatients as unknown as Handler
  );

  // getPatient
  app.get('/patients/:id',
    authMiddleware({ roles: ["admin", "clinician", "support", "user", "patient:owner"] }),
    zValidator('param', validators.GetPatientParams, validationErrorHandler),
    registry.getPatient as unknown as Handler
  );

  // updatePatient
  app.patch('/patients/:id',
    authMiddleware({ roles: ["admin", "clinician", "registrar", "user", "patient:owner"] }),
    zValidator('param', validators.UpdatePatientParams, validationErrorHandler),
    zValidator('json', validators.UpdatePatientBody, validationErrorHandler),
    registry.updatePatient as unknown as Handler
  );

  // deactivatePatient
  app.delete('/patients/:id',
    authMiddleware({ roles: ["admin", "registrar", "user"] }),
    zValidator('param', validators.DeactivatePatientParams, validationErrorHandler),
    registry.deactivatePatient as unknown as Handler
  );

  // createPerson
  app.post('/persons',
    authMiddleware({ roles: ["user"] }),
    zValidator('json', validators.CreatePersonBody, validationErrorHandler),
    registry.createPerson as unknown as Handler
  );

  // listPersons
  app.get('/persons',
    authMiddleware({ roles: ["admin", "support"] }),
    zValidator('query', validators.ListPersonsQuery, validationErrorHandler),
    registry.listPersons as unknown as Handler
  );

  // getPerson
  app.get('/persons/:person',
    authMiddleware({ roles: ["admin", "support", "user:owner"] }),
    zValidator('param', validators.GetPersonParams, validationErrorHandler),
    registry.getPerson as unknown as Handler
  );

  // updatePerson
  app.patch('/persons/:person',
    authMiddleware({ roles: ["user:owner"] }),
    zValidator('param', validators.UpdatePersonParams, validationErrorHandler),
    zValidator('json', validators.UpdatePersonBody, validationErrorHandler),
    registry.updatePerson as unknown as Handler
  );

  // createPractitionerRole
  app.post('/providers/practitioner-roles',
    authMiddleware({ roles: ["admin", "credentialing"] }),
    zValidator('json', validators.CreatePractitionerRoleBody, validationErrorHandler),
    registry.createPractitionerRole as unknown as Handler
  );

  // listPractitionerRoles
  app.get('/providers/practitioner-roles',
    authMiddleware({ roles: ["admin", "clinician", "support"] }),
    zValidator('query', validators.ListPractitionerRolesQuery, validationErrorHandler),
    registry.listPractitionerRoles as unknown as Handler
  );

  // getPractitionerRole
  app.get('/providers/practitioner-roles/:id',
    authMiddleware({ roles: ["admin", "clinician", "support", "practitioner:owner"] }),
    zValidator('param', validators.GetPractitionerRoleParams, validationErrorHandler),
    registry.getPractitionerRole as unknown as Handler
  );

  // updatePractitionerRole
  app.patch('/providers/practitioner-roles/:id',
    authMiddleware({ roles: ["admin", "credentialing", "practitioner:owner"] }),
    zValidator('param', validators.UpdatePractitionerRoleParams, validationErrorHandler),
    zValidator('json', validators.UpdatePractitionerRoleBody, validationErrorHandler),
    registry.updatePractitionerRole as unknown as Handler
  );

  // deactivatePractitionerRole
  app.delete('/providers/practitioner-roles/:id',
    authMiddleware({ roles: ["admin"] }),
    zValidator('param', validators.DeactivatePractitionerRoleParams, validationErrorHandler),
    registry.deactivatePractitionerRole as unknown as Handler
  );

  // createPractitioner
  app.post('/providers/practitioners',
    authMiddleware({ roles: ["admin", "credentialing"] }),
    zValidator('json', validators.CreatePractitionerBody, validationErrorHandler),
    registry.createPractitioner as unknown as Handler
  );

  // listPractitioners
  app.get('/providers/practitioners',
    authMiddleware({ roles: ["admin", "clinician", "support"] }),
    zValidator('query', validators.ListPractitionersQuery, validationErrorHandler),
    registry.listPractitioners as unknown as Handler
  );

  // getPractitioner
  app.get('/providers/practitioners/:id',
    authMiddleware({ roles: ["admin", "clinician", "support", "practitioner:owner"] }),
    zValidator('param', validators.GetPractitionerParams, validationErrorHandler),
    registry.getPractitioner as unknown as Handler
  );

  // updatePractitioner
  app.patch('/providers/practitioners/:id',
    authMiddleware({ roles: ["admin", "credentialing", "practitioner:owner"] }),
    zValidator('param', validators.UpdatePractitionerParams, validationErrorHandler),
    zValidator('json', validators.UpdatePractitionerBody, validationErrorHandler),
    registry.updatePractitioner as unknown as Handler
  );

  // deactivatePractitioner
  app.delete('/providers/practitioners/:id',
    authMiddleware({ roles: ["admin"] }),
    zValidator('param', validators.DeactivatePractitionerParams, validationErrorHandler),
    registry.deactivatePractitioner as unknown as Handler
  );

  // createReview
  app.post('/reviews/',
    authMiddleware({ roles: ["user"] }),
    zValidator('json', validators.CreateReviewBody, validationErrorHandler),
    registry.createReview as unknown as Handler
  );

  // listReviews
  app.get('/reviews/',
    authMiddleware({ roles: ["user"] }),
    zValidator('query', validators.ListReviewsQuery, validationErrorHandler),
    registry.listReviews as unknown as Handler
  );

  // getReview
  app.get('/reviews/:review',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.GetReviewParams, validationErrorHandler),
    registry.getReview as unknown as Handler
  );

  // deleteReview
  app.delete('/reviews/:review',
    authMiddleware({ roles: ["review:owner", "admin"] }),
    zValidator('param', validators.DeleteReviewParams, validationErrorHandler),
    registry.deleteReview as unknown as Handler
  );

  // listFiles
  app.get('/storage/files',
    authMiddleware(),
    zValidator('query', validators.ListFilesQuery, validationErrorHandler),
    registry.listFiles as unknown as Handler
  );

  // uploadFile
  app.post('/storage/files/upload',
    authMiddleware({ roles: ["user"] }),
    zValidator('json', validators.UploadFileBody, validationErrorHandler),
    registry.uploadFile as unknown as Handler
  );

  // getFile
  app.get('/storage/files/:file',
    authMiddleware({ roles: ["admin", "user:owner"] }),
    zValidator('param', validators.GetFileParams, validationErrorHandler),
    registry.getFile as unknown as Handler
  );

  // deleteFile
  app.delete('/storage/files/:file',
    authMiddleware({ roles: ["user:owner"] }),
    zValidator('param', validators.DeleteFileParams, validationErrorHandler),
    registry.deleteFile as unknown as Handler
  );

  // completeFileUpload
  app.post('/storage/files/:file/complete',
    authMiddleware({ roles: ["user:owner"] }),
    zValidator('param', validators.CompleteFileUploadParams, validationErrorHandler),
    registry.completeFileUpload as unknown as Handler
  );

  // getFileDownload
  app.get('/storage/files/:file/download',
    authMiddleware({ roles: ["admin", "user:owner"] }),
    zValidator('param', validators.GetFileDownloadParams, validationErrorHandler),
    registry.getFileDownload as unknown as Handler
  );

  // initiateMultipartUpload
  app.post('/storage/multipart/initiate',
    authMiddleware({ roles: ["user"] }),
    zValidator('json', validators.InitiateMultipartUploadBody, validationErrorHandler),
    registry.initiateMultipartUpload as unknown as Handler
  );

  // abortMultipartUpload
  app.delete('/storage/multipart/:file/abort',
    authMiddleware({ roles: ["user:owner"] }),
    zValidator('param', validators.AbortMultipartUploadParams, validationErrorHandler),
    registry.abortMultipartUpload as unknown as Handler
  );

  // completeMultipartUpload
  app.post('/storage/multipart/:file/complete',
    authMiddleware({ roles: ["user:owner"] }),
    zValidator('param', validators.CompleteMultipartUploadParams, validationErrorHandler),
    zValidator('json', validators.CompleteMultipartUploadBody, validationErrorHandler),
    registry.completeMultipartUpload as unknown as Handler
  );

  // generateMultipartPartUrl
  app.get('/storage/multipart/:file/part-url',
    authMiddleware({ roles: ["user:owner"] }),
    zValidator('param', validators.GenerateMultipartPartUrlParams, validationErrorHandler),
    zValidator('query', validators.GenerateMultipartPartUrlQuery, validationErrorHandler),
    registry.generateMultipartPartUrl as unknown as Handler
  );

}