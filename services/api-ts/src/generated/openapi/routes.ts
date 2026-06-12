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

  // confirmAppointment
  app.post('/dental/appointments/:appointmentId/confirm',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.ConfirmAppointmentParams, validationErrorHandler),
    registry.confirmAppointment as unknown as Handler
  );

  // createQueueItem
  app.post('/dental/appointments/:appointmentId/queue-item',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.CreateQueueItemParams, validationErrorHandler),
    zValidator('json', validators.CreateQueueItemBody, validationErrorHandler),
    registry.createQueueItem as unknown as Handler
  );

  // getAuditEvents
  app.get('/dental/audit-events',
    authMiddleware({ roles: ["user"] }),
    zValidator('query', validators.GetAuditEventsQuery, validationErrorHandler),
    registry.getAuditEvents as unknown as Handler
  );

  // createInsuranceClaim
  app.post('/dental/billing/claims',
    authMiddleware({ roles: ["user"] }),
    zValidator('json', validators.CreateInsuranceClaimBody, validationErrorHandler),
    registry.createInsuranceClaim as unknown as Handler
  );

  // listInsuranceClaims
  app.get('/dental/billing/claims',
    authMiddleware({ roles: ["user"] }),
    zValidator('query', validators.ListInsuranceClaimsQuery, validationErrorHandler),
    registry.listInsuranceClaims as unknown as Handler
  );

  // getPayerArAging
  app.get('/dental/billing/claims/aging',
    authMiddleware({ roles: ["user"] }),
    zValidator('query', validators.GetPayerArAgingQuery, validationErrorHandler),
    registry.getPayerArAging as unknown as Handler
  );

  // getInsuranceClaim
  app.get('/dental/billing/claims/:claimId',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.GetInsuranceClaimParams, validationErrorHandler),
    registry.getInsuranceClaim as unknown as Handler
  );

  // addInsuranceClaimLine
  app.post('/dental/billing/claims/:claimId/lines',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.AddInsuranceClaimLineParams, validationErrorHandler),
    zValidator('json', validators.AddInsuranceClaimLineBody, validationErrorHandler),
    registry.addInsuranceClaimLine as unknown as Handler
  );

  // updateInsuranceClaimLine
  app.patch('/dental/billing/claims/:claimId/lines/:lineId',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.UpdateInsuranceClaimLineParams, validationErrorHandler),
    zValidator('json', validators.UpdateInsuranceClaimLineBody, validationErrorHandler),
    registry.updateInsuranceClaimLine as unknown as Handler
  );

  // recordClaimRemittance
  app.post('/dental/billing/claims/:claimId/remittance',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.RecordClaimRemittanceParams, validationErrorHandler),
    zValidator('json', validators.RecordClaimRemittanceBody, validationErrorHandler),
    registry.recordClaimRemittance as unknown as Handler
  );

  // updateInsuranceClaimStatus
  app.patch('/dental/billing/claims/:claimId/status',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.UpdateInsuranceClaimStatusParams, validationErrorHandler),
    zValidator('json', validators.UpdateInsuranceClaimStatusBody, validationErrorHandler),
    registry.updateInsuranceClaimStatus as unknown as Handler
  );

  // getArAging
  app.get('/dental/billing/collections/aging',
    authMiddleware({ roles: ["user"] }),
    zValidator('query', validators.GetArAgingQuery, validationErrorHandler),
    registry.getArAging as unknown as Handler
  );

  // getCollectionsSummary
  app.get('/dental/billing/collections/summary',
    authMiddleware({ roles: ["user"] }),
    zValidator('query', validators.GetCollectionsSummaryQuery, validationErrorHandler),
    registry.getCollectionsSummary as unknown as Handler
  );

  // estimateClaimCoverage
  app.post('/dental/billing/estimate',
    authMiddleware({ roles: ["user"] }),
    zValidator('json', validators.EstimateClaimCoverageBody, validationErrorHandler),
    registry.estimateClaimCoverage as unknown as Handler
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
    zValidator('json', validators.VoidDentalInvoiceBody, validationErrorHandler),
    registry.voidDentalInvoice as unknown as Handler
  );

  // getPatientBalance
  app.get('/dental/billing/patients/:patientId/balance',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.GetPatientBalanceParams, validationErrorHandler),
    registry.getPatientBalance as unknown as Handler
  );

  // generateStatementBatch
  app.post('/dental/billing/statements/batch',
    authMiddleware({ roles: ["user"] }),
    zValidator('json', validators.GenerateStatementBatchBody, validationErrorHandler),
    registry.generateStatementBatch as unknown as Handler
  );

  // getBranchesByUser
  app.get('/dental/branches',
    authMiddleware({ roles: ["user"] }),
    registry.getBranchesByUser as unknown as Handler
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

  // createInventoryItem
  app.post('/dental/branches/:branchId/inventory',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.CreateInventoryItemParams, validationErrorHandler),
    zValidator('json', validators.CreateInventoryItemBody, validationErrorHandler),
    registry.createInventoryItem as unknown as Handler
  );

  // listInventoryItems
  app.get('/dental/branches/:branchId/inventory',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.ListInventoryItemsParams, validationErrorHandler),
    registry.listInventoryItems as unknown as Handler
  );

  // updateInventoryItem
  app.patch('/dental/branches/:branchId/inventory/:itemId',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.UpdateInventoryItemParams, validationErrorHandler),
    zValidator('json', validators.UpdateInventoryItemBody, validationErrorHandler),
    registry.updateInventoryItem as unknown as Handler
  );

  // createInventoryAdjustment
  app.post('/dental/branches/:branchId/inventory/:itemId/adjustments',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.CreateInventoryAdjustmentParams, validationErrorHandler),
    zValidator('json', validators.CreateInventoryAdjustmentBody, validationErrorHandler),
    registry.createInventoryAdjustment as unknown as Handler
  );

  // listInventoryAdjustments
  app.get('/dental/branches/:branchId/inventory/:itemId/adjustments',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.ListInventoryAdjustmentsParams, validationErrorHandler),
    registry.listInventoryAdjustments as unknown as Handler
  );

  // createPostopTemplate
  app.post('/dental/branches/:branchId/postop-templates',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.CreatePostopTemplateParams, validationErrorHandler),
    zValidator('json', validators.CreatePostopTemplateBody, validationErrorHandler),
    registry.createPostopTemplate as unknown as Handler
  );

  // listPostopTemplates
  app.get('/dental/branches/:branchId/postop-templates',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.ListPostopTemplatesParams, validationErrorHandler),
    zValidator('query', validators.ListPostopTemplatesQuery, validationErrorHandler),
    registry.listPostopTemplates as unknown as Handler
  );

  // updatePostopTemplate
  app.patch('/dental/branches/:branchId/postop-templates/:templateId',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.UpdatePostopTemplateParams, validationErrorHandler),
    zValidator('json', validators.UpdatePostopTemplateBody, validationErrorHandler),
    registry.updatePostopTemplate as unknown as Handler
  );

  // listQueueBoard
  app.get('/dental/branches/:branchId/queue-board',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.ListQueueBoardParams, validationErrorHandler),
    registry.listQueueBoard as unknown as Handler
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

  // createWaitlistEntry
  app.post('/dental/branches/:branchId/waitlist',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.CreateWaitlistEntryParams, validationErrorHandler),
    zValidator('json', validators.CreateWaitlistEntryBody, validationErrorHandler),
    registry.createWaitlistEntry as unknown as Handler
  );

  // listWaitlist
  app.get('/dental/branches/:branchId/waitlist',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.ListWaitlistParams, validationErrorHandler),
    zValidator('query', validators.ListWaitlistQuery, validationErrorHandler),
    registry.listWaitlist as unknown as Handler
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

  // recordMedicalHistoryReview
  app.post('/dental/clinical/medical-history-review',
    authMiddleware({ roles: ["user"] }),
    zValidator('json', validators.RecordMedicalHistoryReviewBody, validationErrorHandler),
    registry.recordMedicalHistoryReview as unknown as Handler
  );

  // getMedicalHistoryReview
  app.get('/dental/clinical/medical-history-review',
    authMiddleware({ roles: ["user"] }),
    zValidator('query', validators.GetMedicalHistoryReviewQuery, validationErrorHandler),
    registry.getMedicalHistoryReview as unknown as Handler
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

  // requestErasure
  app.post('/dental/erasure-requests',
    authMiddleware({ roles: ["admin"] }),
    zValidator('json', validators.RequestErasureBody, validationErrorHandler),
    registry.requestErasure as unknown as Handler
  );

  // listErasureRequests
  app.get('/dental/erasure-requests',
    authMiddleware({ roles: ["admin"] }),
    zValidator('query', validators.ListErasureRequestsQuery, validationErrorHandler),
    registry.listErasureRequests as unknown as Handler
  );

  // getErasureRequest
  app.get('/dental/erasure-requests/:id',
    authMiddleware({ roles: ["admin"] }),
    zValidator('param', validators.GetErasureRequestParams, validationErrorHandler),
    registry.getErasureRequest as unknown as Handler
  );

  // approveErasure
  app.post('/dental/erasure-requests/:id/approve',
    authMiddleware({ roles: ["admin"] }),
    zValidator('param', validators.ApproveErasureParams, validationErrorHandler),
    zValidator('json', validators.ApproveErasureBody, validationErrorHandler),
    registry.approveErasure as unknown as Handler
  );

  // rejectErasure
  app.post('/dental/erasure-requests/:id/reject',
    authMiddleware({ roles: ["admin"] }),
    zValidator('param', validators.RejectErasureParams, validationErrorHandler),
    zValidator('json', validators.RejectErasureBody, validationErrorHandler),
    registry.rejectErasure as unknown as Handler
  );

  // getFeeSchedule
  app.get('/dental/fee-schedule',
    authMiddleware({ roles: ["user"] }),
    zValidator('query', validators.GetFeeScheduleQuery, validationErrorHandler),
    registry.getFeeSchedule as unknown as Handler
  );

  // updateFeeScheduleEntry
  app.patch('/dental/fee-schedule/:cdt',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.UpdateFeeScheduleEntryParams, validationErrorHandler),
    zValidator('json', validators.UpdateFeeScheduleEntryBody, validationErrorHandler),
    registry.updateFeeScheduleEntry as unknown as Handler
  );

  // createHousehold
  app.post('/dental/households',
    authMiddleware({ roles: ["user"] }),
    zValidator('json', validators.CreateHouseholdBody, validationErrorHandler),
    registry.createHousehold as unknown as Handler
  );

  // getHousehold
  app.get('/dental/households/:householdId',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.GetHouseholdParams, validationErrorHandler),
    registry.getHousehold as unknown as Handler
  );

  // addHouseholdMember
  app.post('/dental/households/:householdId/members',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.AddHouseholdMemberParams, validationErrorHandler),
    zValidator('json', validators.AddHouseholdMemberBody, validationErrorHandler),
    registry.addHouseholdMember as unknown as Handler
  );

  // removeHouseholdMember
  app.delete('/dental/households/:householdId/members/:patientId',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.RemoveHouseholdMemberParams, validationErrorHandler),
    registry.removeHouseholdMember as unknown as Handler
  );

  // CephMgmt_createCephSuperimposition
  app.post('/dental/imaging/ceph/superimpositions',
    authMiddleware(),
    zValidator('json', validators.CephMgmt_createCephSuperimpositionBody, validationErrorHandler),
    registry.CephMgmt_createCephSuperimposition as unknown as Handler
  );

  // CephMgmt_previewCephSuperimposition
  app.post('/dental/imaging/ceph/superimpositions/preview',
    authMiddleware(),
    zValidator('json', validators.CephMgmt_previewCephSuperimpositionBody, validationErrorHandler),
    registry.CephMgmt_previewCephSuperimposition as unknown as Handler
  );

  // CephMgmt_getCephSuperimposition
  app.get('/dental/imaging/ceph/superimpositions/:superimpositionId',
    authMiddleware(),
    zValidator('param', validators.CephMgmt_getCephSuperimpositionParams, validationErrorHandler),
    registry.CephMgmt_getCephSuperimposition as unknown as Handler
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
    zValidator('query', validators.CephMgmt_getCephAnalysisQuery, validationErrorHandler),
    registry.CephMgmt_getCephAnalysis as unknown as Handler
  );

  // CephMgmt_recomputeCephAnalysis
  app.post('/dental/imaging/images/:imageId/ceph/analysis/recompute',
    authMiddleware(),
    zValidator('param', validators.CephMgmt_recomputeCephAnalysisParams, validationErrorHandler),
    zValidator('query', validators.CephMgmt_recomputeCephAnalysisQuery, validationErrorHandler),
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

  // CephMgmt_detectCephLandmarks
  app.post('/dental/imaging/images/:imageId/ceph/landmarks/detect',
    authMiddleware(),
    zValidator('param', validators.CephMgmt_detectCephLandmarksParams, validationErrorHandler),
    registry.CephMgmt_detectCephLandmarks as unknown as Handler
  );

  // CephMgmt_getCephLandmarkDetectionJob
  app.get('/dental/imaging/images/:imageId/ceph/landmarks/detect/:jobId',
    authMiddleware(),
    zValidator('param', validators.CephMgmt_getCephLandmarkDetectionJobParams, validationErrorHandler),
    registry.CephMgmt_getCephLandmarkDetectionJob as unknown as Handler
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
    zValidator('json', validators.CephMgmt_createCephReportBody, validationErrorHandler),
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

  // ImagingMgmt_createImageLink
  app.post('/dental/imaging/images/:imageId/links',
    authMiddleware(),
    zValidator('param', validators.ImagingMgmt_createImageLinkParams, validationErrorHandler),
    zValidator('json', validators.ImagingMgmt_createImageLinkBody, validationErrorHandler),
    registry.ImagingMgmt_createImageLink as unknown as Handler
  );

  // ImagingMgmt_listImageLinks
  app.get('/dental/imaging/images/:imageId/links',
    authMiddleware(),
    zValidator('param', validators.ImagingMgmt_listImageLinksParams, validationErrorHandler),
    registry.ImagingMgmt_listImageLinks as unknown as Handler
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

  // ImagingMgmt_updateImageMetadata
  app.patch('/dental/imaging/images/:imageId/metadata',
    authMiddleware(),
    zValidator('param', validators.ImagingMgmt_updateImageMetadataParams, validationErrorHandler),
    zValidator('json', validators.ImagingMgmt_updateImageMetadataBody, validationErrorHandler),
    registry.ImagingMgmt_updateImageMetadata as unknown as Handler
  );

  // ImagingMgmt_updateImageModality
  app.patch('/dental/imaging/images/:imageId/modality',
    authMiddleware(),
    zValidator('param', validators.ImagingMgmt_updateImageModalityParams, validationErrorHandler),
    zValidator('json', validators.ImagingMgmt_updateImageModalityBody, validationErrorHandler),
    registry.ImagingMgmt_updateImageModality as unknown as Handler
  );

  // ImagingMgmt_deleteImageLink
  app.delete('/dental/imaging/links/:linkId',
    authMiddleware(),
    zValidator('param', validators.ImagingMgmt_deleteImageLinkParams, validationErrorHandler),
    registry.ImagingMgmt_deleteImageLink as unknown as Handler
  );

  // ImagingMgmt_deleteMeasurement
  app.delete('/dental/imaging/measurements/:measurementId',
    authMiddleware(),
    zValidator('param', validators.ImagingMgmt_deleteMeasurementParams, validationErrorHandler),
    registry.ImagingMgmt_deleteMeasurement as unknown as Handler
  );

  // CephMgmt_listCephSuperimpositions
  app.get('/dental/imaging/patients/:patientId/ceph/superimpositions',
    authMiddleware(),
    zValidator('param', validators.CephMgmt_listCephSuperimpositionsParams, validationErrorHandler),
    registry.CephMgmt_listCephSuperimpositions as unknown as Handler
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

  // ImagingMgmt_finalizeCbctStudy
  app.post('/dental/imaging/studies/:studyId/cbct/finalize',
    authMiddleware(),
    zValidator('param', validators.ImagingMgmt_finalizeCbctStudyParams, validationErrorHandler),
    zValidator('json', validators.ImagingMgmt_finalizeCbctStudyBody, validationErrorHandler),
    registry.ImagingMgmt_finalizeCbctStudy as unknown as Handler
  );

  // ImagingMgmt_getCbctViewerLink
  app.get('/dental/imaging/studies/:studyId/cbct/viewer-link',
    authMiddleware(),
    zValidator('param', validators.ImagingMgmt_getCbctViewerLinkParams, validationErrorHandler),
    registry.ImagingMgmt_getCbctViewerLink as unknown as Handler
  );

  // placeLegalHold
  app.post('/dental/legal-holds',
    authMiddleware({ roles: ["admin"] }),
    zValidator('json', validators.PlaceLegalHoldBody, validationErrorHandler),
    registry.placeLegalHold as unknown as Handler
  );

  // listLegalHolds
  app.get('/dental/legal-holds',
    authMiddleware({ roles: ["admin"] }),
    zValidator('query', validators.ListLegalHoldsQuery, validationErrorHandler),
    registry.listLegalHolds as unknown as Handler
  );

  // releaseLegalHold
  app.post('/dental/legal-holds/:id/release',
    authMiddleware({ roles: ["admin"] }),
    zValidator('param', validators.ReleaseLegalHoldParams, validationErrorHandler),
    registry.releaseLegalHold as unknown as Handler
  );

  // createOnboarding
  app.post('/dental/onboarding',
    authMiddleware(),
    zValidator('json', validators.CreateOnboardingBody, validationErrorHandler),
    registry.createOnboarding as unknown as Handler
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
    zValidator('query', validators.CreateMemberQuery, validationErrorHandler),
    zValidator('json', validators.CreateMemberBody, validationErrorHandler),
    registry.createMember as unknown as Handler
  );

  // updateMember
  app.patch('/dental/org/members/:memberId',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.UpdateMemberParams, validationErrorHandler),
    zValidator('json', validators.UpdateMemberBody, validationErrorHandler),
    registry.updateMember as unknown as Handler
  );

  // deactivateMember
  app.delete('/dental/org/members/:memberId',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.DeactivateMemberParams, validationErrorHandler),
    registry.deactivateMember as unknown as Handler
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

  // getPermissionGrid
  app.get('/dental/org/permissions',
    authMiddleware({ roles: ["user"] }),
    zValidator('query', validators.GetPermissionGridQuery, validationErrorHandler),
    registry.getPermissionGrid as unknown as Handler
  );

  // updatePermissions
  app.put('/dental/org/permissions',
    authMiddleware({ roles: ["user"] }),
    zValidator('query', validators.UpdatePermissionsQuery, validationErrorHandler),
    zValidator('json', validators.UpdatePermissionsBody, validationErrorHandler),
    registry.updatePermissions as unknown as Handler
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

  // activateOrganization
  app.post('/dental/organizations/:id/activate',
    authMiddleware(),
    zValidator('param', validators.ActivateOrganizationParams, validationErrorHandler),
    registry.activateOrganization as unknown as Handler
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

  // detectDuplicatePatients
  app.get('/dental/patients/duplicates',
    authMiddleware({ roles: ["user"] }),
    zValidator('query', validators.DetectDuplicatePatientsQuery, validationErrorHandler),
    registry.detectDuplicatePatients as unknown as Handler
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

  // createCoverageAuthorization
  app.post('/dental/patients/:patientId/authorizations',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.CreateCoverageAuthorizationParams, validationErrorHandler),
    zValidator('json', validators.CreateCoverageAuthorizationBody, validationErrorHandler),
    registry.createCoverageAuthorization as unknown as Handler
  );

  // listCoverageAuthorizations
  app.get('/dental/patients/:patientId/authorizations',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.ListCoverageAuthorizationsParams, validationErrorHandler),
    registry.listCoverageAuthorizations as unknown as Handler
  );

  // updateCoverageAuthorizationStatus
  app.patch('/dental/patients/:patientId/authorizations/:authorizationId/status',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.UpdateCoverageAuthorizationStatusParams, validationErrorHandler),
    zValidator('json', validators.UpdateCoverageAuthorizationStatusBody, validationErrorHandler),
    registry.updateCoverageAuthorizationStatus as unknown as Handler
  );

  // createCasePresentation
  app.post('/dental/patients/:patientId/case-presentations',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.CreateCasePresentationParams, validationErrorHandler),
    zValidator('json', validators.CreateCasePresentationBody, validationErrorHandler),
    registry.createCasePresentation as unknown as Handler
  );

  // listCasePresentations
  app.get('/dental/patients/:patientId/case-presentations',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.ListCasePresentationsParams, validationErrorHandler),
    registry.listCasePresentations as unknown as Handler
  );

  // getCasePresentation
  app.get('/dental/patients/:patientId/case-presentations/:presentationId',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.GetCasePresentationParams, validationErrorHandler),
    registry.getCasePresentation as unknown as Handler
  );

  // acceptCasePresentation
  app.post('/dental/patients/:patientId/case-presentations/:presentationId/accept',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.AcceptCasePresentationParams, validationErrorHandler),
    zValidator('json', validators.AcceptCasePresentationBody, validationErrorHandler),
    registry.acceptCasePresentation as unknown as Handler
  );

  // rejectCasePresentation
  app.post('/dental/patients/:patientId/case-presentations/:presentationId/reject',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.RejectCasePresentationParams, validationErrorHandler),
    zValidator('json', validators.RejectCasePresentationBody, validationErrorHandler),
    registry.rejectCasePresentation as unknown as Handler
  );

  // createClaimDraft
  app.post('/dental/patients/:patientId/claims',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.CreateClaimDraftParams, validationErrorHandler),
    zValidator('json', validators.CreateClaimDraftBody, validationErrorHandler),
    registry.createClaimDraft as unknown as Handler
  );

  // listPatientClaims
  app.get('/dental/patients/:patientId/claims',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.ListPatientClaimsParams, validationErrorHandler),
    registry.listPatientClaims as unknown as Handler
  );

  // getClaimReadiness
  app.get('/dental/patients/:patientId/claims/:claimId/readiness',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.GetClaimReadinessParams, validationErrorHandler),
    registry.getClaimReadiness as unknown as Handler
  );

  // updateClaimStatus
  app.patch('/dental/patients/:patientId/claims/:claimId/status',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.UpdateClaimStatusParams, validationErrorHandler),
    zValidator('json', validators.UpdateClaimStatusBody, validationErrorHandler),
    registry.updateClaimStatus as unknown as Handler
  );

  // getPatientCommunicationConsent
  app.get('/dental/patients/:patientId/communication-consent',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.GetPatientCommunicationConsentParams, validationErrorHandler),
    registry.getPatientCommunicationConsent as unknown as Handler
  );

  // updatePatientCommunicationConsent
  app.patch('/dental/patients/:patientId/communication-consent',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.UpdatePatientCommunicationConsentParams, validationErrorHandler),
    zValidator('json', validators.UpdatePatientCommunicationConsentBody, validationErrorHandler),
    registry.updatePatientCommunicationConsent as unknown as Handler
  );

  // createPatientContact
  app.post('/dental/patients/:patientId/contacts',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.CreatePatientContactParams, validationErrorHandler),
    zValidator('json', validators.CreatePatientContactBody, validationErrorHandler),
    registry.createPatientContact as unknown as Handler
  );

  // listPatientContacts
  app.get('/dental/patients/:patientId/contacts',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.ListPatientContactsParams, validationErrorHandler),
    registry.listPatientContacts as unknown as Handler
  );

  // updatePatientContact
  app.patch('/dental/patients/:patientId/contacts/:contactId',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.UpdatePatientContactParams, validationErrorHandler),
    zValidator('json', validators.UpdatePatientContactBody, validationErrorHandler),
    registry.updatePatientContact as unknown as Handler
  );

  // deletePatientContact
  app.delete('/dental/patients/:patientId/contacts/:contactId',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.DeletePatientContactParams, validationErrorHandler),
    registry.deletePatientContact as unknown as Handler
  );

  // createDentalAlert
  app.post('/dental/patients/:patientId/dental-alerts',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.CreateDentalAlertParams, validationErrorHandler),
    zValidator('json', validators.CreateDentalAlertBody, validationErrorHandler),
    registry.createDentalAlert as unknown as Handler
  );

  // listDentalAlerts
  app.get('/dental/patients/:patientId/dental-alerts',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.ListDentalAlertsParams, validationErrorHandler),
    registry.listDentalAlerts as unknown as Handler
  );

  // updateDentalAlert
  app.patch('/dental/patients/:patientId/dental-alerts/:alertId',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.UpdateDentalAlertParams, validationErrorHandler),
    zValidator('json', validators.UpdateDentalAlertBody, validationErrorHandler),
    registry.updateDentalAlert as unknown as Handler
  );

  // initializeDentition
  app.post('/dental/patients/:patientId/dentition',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.InitializeDentitionParams, validationErrorHandler),
    zValidator('json', validators.InitializeDentitionBody, validationErrorHandler),
    registry.initializeDentition as unknown as Handler
  );

  // getPatientHousehold
  app.get('/dental/patients/:patientId/household',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.GetPatientHouseholdParams, validationErrorHandler),
    registry.getPatientHousehold as unknown as Handler
  );

  // PatientImageMgmt_listPatientImages
  app.get('/dental/patients/:patientId/images',
    authMiddleware(),
    zValidator('param', validators.PatientImageMgmt_listPatientImagesParams, validationErrorHandler),
    zValidator('query', validators.PatientImageMgmt_listPatientImagesQuery, validationErrorHandler),
    registry.PatientImageMgmt_listPatientImages as unknown as Handler
  );

  // createInsuranceProfile
  app.post('/dental/patients/:patientId/insurance-profiles',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.CreateInsuranceProfileParams, validationErrorHandler),
    zValidator('json', validators.CreateInsuranceProfileBody, validationErrorHandler),
    registry.createInsuranceProfile as unknown as Handler
  );

  // listPatientInsuranceProfiles
  app.get('/dental/patients/:patientId/insurance-profiles',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.ListPatientInsuranceProfilesParams, validationErrorHandler),
    registry.listPatientInsuranceProfiles as unknown as Handler
  );

  // updateInsuranceProfile
  app.patch('/dental/patients/:patientId/insurance-profiles/:profileId',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.UpdateInsuranceProfileParams, validationErrorHandler),
    zValidator('json', validators.UpdateInsuranceProfileBody, validationErrorHandler),
    registry.updateInsuranceProfile as unknown as Handler
  );

  // createOcclusionScreening
  app.post('/dental/patients/:patientId/occlusion-screenings',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.CreateOcclusionScreeningParams, validationErrorHandler),
    zValidator('json', validators.CreateOcclusionScreeningBody, validationErrorHandler),
    registry.createOcclusionScreening as unknown as Handler
  );

  // listOcclusionScreenings
  app.get('/dental/patients/:patientId/occlusion-screenings',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.ListOcclusionScreeningsParams, validationErrorHandler),
    registry.listOcclusionScreenings as unknown as Handler
  );

  // createRecall
  app.post('/dental/patients/:patientId/recalls',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.CreateRecallParams, validationErrorHandler),
    zValidator('json', validators.CreateRecallBody, validationErrorHandler),
    registry.createRecall as unknown as Handler
  );

  // listPatientRecalls
  app.get('/dental/patients/:patientId/recalls',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.ListPatientRecallsParams, validationErrorHandler),
    registry.listPatientRecalls as unknown as Handler
  );

  // updateRecall
  app.patch('/dental/patients/:patientId/recalls/:recallId',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.UpdateRecallParams, validationErrorHandler),
    zValidator('json', validators.UpdateRecallBody, validationErrorHandler),
    registry.updateRecall as unknown as Handler
  );

  // createTask
  app.post('/dental/patients/:patientId/tasks',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.CreateTaskParams, validationErrorHandler),
    zValidator('json', validators.CreateTaskBody, validationErrorHandler),
    registry.createTask as unknown as Handler
  );

  // listPatientTasks
  app.get('/dental/patients/:patientId/tasks',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.ListPatientTasksParams, validationErrorHandler),
    registry.listPatientTasks as unknown as Handler
  );

  // updateTask
  app.patch('/dental/patients/:patientId/tasks/:taskId',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.UpdateTaskParams, validationErrorHandler),
    zValidator('json', validators.UpdateTaskBody, validationErrorHandler),
    registry.updateTask as unknown as Handler
  );

  // listTreatmentOptionGroup
  app.get('/dental/patients/:patientId/treatment-options/:optionGroupId',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.ListTreatmentOptionGroupParams, validationErrorHandler),
    registry.listTreatmentOptionGroup as unknown as Handler
  );

  // acceptTreatmentOption
  app.post('/dental/patients/:patientId/treatment-options/:optionGroupId/accept',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.AcceptTreatmentOptionParams, validationErrorHandler),
    zValidator('json', validators.AcceptTreatmentOptionBody, validationErrorHandler),
    registry.acceptTreatmentOption as unknown as Handler
  );

  // getTreatmentPlan
  app.get('/dental/patients/:patientId/treatment-plan',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.GetTreatmentPlanParams, validationErrorHandler),
    zValidator('query', validators.GetTreatmentPlanQuery, validationErrorHandler),
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

  // createTreatmentPlan
  app.post('/dental/patients/:patientId/treatment-plans',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.CreateTreatmentPlanParams, validationErrorHandler),
    zValidator('json', validators.CreateTreatmentPlanBody, validationErrorHandler),
    registry.createTreatmentPlan as unknown as Handler
  );

  // listPatientTreatmentPlans
  app.get('/dental/patients/:patientId/treatment-plans',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.ListPatientTreatmentPlansParams, validationErrorHandler),
    registry.listPatientTreatmentPlans as unknown as Handler
  );

  // updateTreatmentPlan
  app.patch('/dental/patients/:patientId/treatment-plans/:planId',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.UpdateTreatmentPlanParams, validationErrorHandler),
    zValidator('json', validators.UpdateTreatmentPlanBody, validationErrorHandler),
    registry.updateTreatmentPlan as unknown as Handler
  );

  // approveTreatmentPlan
  app.post('/dental/patients/:patientId/treatment-plans/:planId/approval',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.ApproveTreatmentPlanParams, validationErrorHandler),
    zValidator('json', validators.ApproveTreatmentPlanBody, validationErrorHandler),
    registry.approveTreatmentPlan as unknown as Handler
  );

  // listTreatmentPlanStatusHistory
  app.get('/dental/patients/:patientId/treatment-plans/:planId/status-history',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.ListTreatmentPlanStatusHistoryParams, validationErrorHandler),
    registry.listTreatmentPlanStatusHistory as unknown as Handler
  );

  // listPatientConditions
  app.get('/dental/patients/:patientId/treatments',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.ListPatientConditionsParams, validationErrorHandler),
    zValidator('query', validators.ListPatientConditionsQuery, validationErrorHandler),
    registry.listPatientConditions as unknown as Handler
  );

  // attachTreatmentAppointment
  app.post('/dental/patients/:patientId/treatments/:treatmentId/appointment',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.AttachTreatmentAppointmentParams, validationErrorHandler),
    zValidator('json', validators.AttachTreatmentAppointmentBody, validationErrorHandler),
    registry.attachTreatmentAppointment as unknown as Handler
  );

  // detachTreatmentAppointment
  app.delete('/dental/patients/:patientId/treatments/:treatmentId/appointment',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.DetachTreatmentAppointmentParams, validationErrorHandler),
    registry.detachTreatmentAppointment as unknown as Handler
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

  // listPerioChartsForPatient
  app.get('/dental/perio-charts',
    authMiddleware({ roles: ["user"] }),
    zValidator('query', validators.ListPerioChartsForPatientQuery, validationErrorHandler),
    registry.listPerioChartsForPatient as unknown as Handler
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
    zValidator('json', validators.CompletePerioChartBody, validationErrorHandler),
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

  // mergeImportedPMDSafetyFloor
  app.post('/dental/pmd/imported/:id/merge-safety-floor',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.MergeImportedPMDSafetyFloorParams, validationErrorHandler),
    registry.mergeImportedPMDSafetyFloor as unknown as Handler
  );

  // exportPatientCareRecord
  app.get('/dental/pmd/patient/:patientId/care-record',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.ExportPatientCareRecordParams, validationErrorHandler),
    registry.exportPatientCareRecord as unknown as Handler
  );

  // confirmAppointmentByToken
  app.post('/dental/public/appointments/:appointmentId/confirm/:token',
    zValidator('param', validators.ConfirmAppointmentByTokenParams, validationErrorHandler),
    registry.confirmAppointmentByToken as unknown as Handler
  );

  // getOnlineBooking
  app.get('/dental/public/bookings/:confirmationCode',
    zValidator('param', validators.GetOnlineBookingParams, validationErrorHandler),
    registry.getOnlineBooking as unknown as Handler
  );

  // getPublicAvailability
  app.get('/dental/public/branches/:branchId/availability',
    zValidator('param', validators.GetPublicAvailabilityParams, validationErrorHandler),
    zValidator('query', validators.GetPublicAvailabilityQuery, validationErrorHandler),
    registry.getPublicAvailability as unknown as Handler
  );

  // getPublicBookingConfig
  app.get('/dental/public/branches/:branchId/booking-config',
    zValidator('param', validators.GetPublicBookingConfigParams, validationErrorHandler),
    registry.getPublicBookingConfig as unknown as Handler
  );

  // createOnlineBooking
  app.post('/dental/public/branches/:branchId/bookings',
    zValidator('param', validators.CreateOnlineBookingParams, validationErrorHandler),
    zValidator('json', validators.CreateOnlineBookingBody, validationErrorHandler),
    registry.createOnlineBooking as unknown as Handler
  );

  // createBookingHold
  app.post('/dental/public/branches/:branchId/holds',
    zValidator('param', validators.CreateBookingHoldParams, validationErrorHandler),
    zValidator('json', validators.CreateBookingHoldBody, validationErrorHandler),
    registry.createBookingHold as unknown as Handler
  );

  // updateQueueItemStatus
  app.patch('/dental/queue-items/:itemId/status',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.UpdateQueueItemStatusParams, validationErrorHandler),
    zValidator('json', validators.UpdateQueueItemStatusBody, validationErrorHandler),
    registry.updateQueueItemStatus as unknown as Handler
  );

  // listDueRecalls
  app.get('/dental/recalls/due',
    authMiddleware({ roles: ["user"] }),
    zValidator('query', validators.ListDueRecallsQuery, validationErrorHandler),
    registry.listDueRecalls as unknown as Handler
  );

  // getRetentionStatus
  app.get('/dental/retention-status',
    authMiddleware({ roles: ["admin"] }),
    zValidator('query', validators.GetRetentionStatusQuery, validationErrorHandler),
    registry.getRetentionStatus as unknown as Handler
  );

  // createSyncLog
  app.post('/dental/sync-logs',
    authMiddleware({ roles: ["user"] }),
    zValidator('json', validators.CreateSyncLogBody, validationErrorHandler),
    registry.createSyncLog as unknown as Handler
  );

  // listSyncLogs
  app.get('/dental/sync-logs',
    authMiddleware({ roles: ["user"] }),
    registry.listSyncLogs as unknown as Handler
  );

  // updateSyncLog
  app.patch('/dental/sync-logs/:logId',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.UpdateSyncLogParams, validationErrorHandler),
    zValidator('json', validators.UpdateSyncLogBody, validationErrorHandler),
    registry.updateSyncLog as unknown as Handler
  );

  // listTreatmentTemplates
  app.get('/dental/treatment-templates',
    authMiddleware({ roles: ["user"] }),
    zValidator('query', validators.ListTreatmentTemplatesQuery, validationErrorHandler),
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

  // listChartConflicts
  app.get('/dental/visits/chart-conflicts/:patientId',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.ListChartConflictsParams, validationErrorHandler),
    registry.listChartConflicts as unknown as Handler
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

  // approveAmendment
  app.post('/dental/visits/:visitId/amendments/:amendmentId/approve',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.ApproveAmendmentParams, validationErrorHandler),
    registry.approveAmendment as unknown as Handler
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

  // exportDentalChart
  app.get('/dental/visits/:visitId/chart/export',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.ExportDentalChartParams, validationErrorHandler),
    registry.exportDentalChart as unknown as Handler
  );

  // resolveChartConflict
  app.post('/dental/visits/:visitId/chart/resolve-conflict',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.ResolveChartConflictParams, validationErrorHandler),
    zValidator('json', validators.ResolveChartConflictBody, validationErrorHandler),
    registry.resolveChartConflict as unknown as Handler
  );

  // updateTooth
  app.patch('/dental/visits/:visitId/chart/teeth/:toothNumber',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.UpdateToothParams, validationErrorHandler),
    zValidator('json', validators.UpdateToothBody, validationErrorHandler),
    registry.updateTooth as unknown as Handler
  );

  // recordConsentRefusal
  app.post('/dental/visits/:visitId/consent-refusals',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.RecordConsentRefusalParams, validationErrorHandler),
    zValidator('json', validators.RecordConsentRefusalBody, validationErrorHandler),
    registry.recordConsentRefusal as unknown as Handler
  );

  // listConsentRefusals
  app.get('/dental/visits/:visitId/consent-refusals',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.ListConsentRefusalsParams, validationErrorHandler),
    registry.listConsentRefusals as unknown as Handler
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

  // revokeConsentForm
  app.patch('/dental/visits/:visitId/consents/:cid/revoke',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.RevokeConsentFormParams, validationErrorHandler),
    registry.revokeConsentForm as unknown as Handler
  );

  // signConsentForm
  app.post('/dental/visits/:visitId/consents/:consentId/sign',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.SignConsentFormParams, validationErrorHandler),
    zValidator('json', validators.SignConsentFormBody, validationErrorHandler),
    registry.signConsentForm as unknown as Handler
  );

  // discardVisit
  app.post('/dental/visits/:visitId/discard',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.DiscardVisitParams, validationErrorHandler),
    zValidator('json', validators.DiscardVisitBody, validationErrorHandler),
    registry.discardVisit as unknown as Handler
  );

  // createDentalFinding
  app.post('/dental/visits/:visitId/findings',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.CreateDentalFindingParams, validationErrorHandler),
    zValidator('json', validators.CreateDentalFindingBody, validationErrorHandler),
    registry.createDentalFinding as unknown as Handler
  );

  // listDentalFindings
  app.get('/dental/visits/:visitId/findings',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.ListDentalFindingsParams, validationErrorHandler),
    registry.listDentalFindings as unknown as Handler
  );

  // updateDentalFinding
  app.patch('/dental/visits/:visitId/findings/:findingId',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.UpdateDentalFindingParams, validationErrorHandler),
    zValidator('json', validators.UpdateDentalFindingBody, validationErrorHandler),
    registry.updateDentalFinding as unknown as Handler
  );

  // convertFindingToTreatment
  app.post('/dental/visits/:visitId/findings/:findingId/treatment',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.ConvertFindingToTreatmentParams, validationErrorHandler),
    zValidator('json', validators.ConvertFindingToTreatmentBody, validationErrorHandler),
    registry.convertFindingToTreatment as unknown as Handler
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

  // promoteWaitlistEntry
  app.post('/dental/waitlist/:entryId/promote',
    authMiddleware({ roles: ["user"] }),
    zValidator('param', validators.PromoteWaitlistEntryParams, validationErrorHandler),
    zValidator('json', validators.PromoteWaitlistEntryBody, validationErrorHandler),
    registry.promoteWaitlistEntry as unknown as Handler
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

  // listMyAppointments
  app.get('/me/appointments',
    authMiddleware({ roles: ["user"] }),
    registry.listMyAppointments as unknown as Handler
  );

  // getMyBalance
  app.get('/me/balance',
    authMiddleware({ roles: ["user"] }),
    registry.getMyBalance as unknown as Handler
  );

  // listMyInvoices
  app.get('/me/invoices',
    authMiddleware({ roles: ["user"] }),
    registry.listMyInvoices as unknown as Handler
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
    authMiddleware({ roles: ["admin"] }),
    zValidator('json', validators.MergePatientsBody, validationErrorHandler),
    registry.mergePatients as unknown as Handler
  );

  // unmergePatients
  app.post('/patients/unmerge',
    authMiddleware({ roles: ["admin"] }),
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

  // createProvider
  app.post('/providers',
    authMiddleware({ roles: ["user"] }),
    zValidator('json', validators.CreateProviderBody, validationErrorHandler),
    createExpandMiddleware("Provider"),
    registry.createProvider as unknown as Handler
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
    authMiddleware({ roles: ["admin", "clinician", "support"] }),
    zValidator('param', validators.GetPractitionerRoleParams, validationErrorHandler),
    registry.getPractitionerRole as unknown as Handler
  );

  // updatePractitionerRole
  app.patch('/providers/practitioner-roles/:id',
    authMiddleware({ roles: ["admin", "credentialing"] }),
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
    authMiddleware({ roles: ["admin", "clinician", "support"] }),
    zValidator('param', validators.GetPractitionerParams, validationErrorHandler),
    registry.getPractitioner as unknown as Handler
  );

  // updatePractitioner
  app.patch('/providers/practitioners/:id',
    authMiddleware({ roles: ["admin", "credentialing"] }),
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