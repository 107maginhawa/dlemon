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
    authMiddleware({ roles: ["client:owner", "provider:owner", "admin", "support"] }),
    zValidator('query', validators.ListBookingsQuery, validationErrorHandler),
    registry.listBookings as unknown as Handler
  );

  // getBooking
  app.get('/booking/bookings/:booking',
    authMiddleware({ roles: ["client:owner", "provider:owner", "admin", "support"] }),
    zValidator('param', validators.GetBookingParams, validationErrorHandler),
    zValidator('query', validators.GetBookingQuery, validationErrorHandler),
    createExpandMiddleware("Booking"),
    registry.getBooking as unknown as Handler
  );

  // cancelBooking
  app.post('/booking/bookings/:booking/cancel',
    authMiddleware({ roles: ["client:owner", "provider:owner", "admin"] }),
    zValidator('param', validators.CancelBookingParams, validationErrorHandler),
    zValidator('json', validators.CancelBookingBody, validationErrorHandler),
    createExpandMiddleware("Booking"),
    registry.cancelBooking as unknown as Handler
  );

  // confirmBooking
  app.post('/booking/bookings/:booking/confirm',
    authMiddleware({ roles: ["provider:owner", "admin"] }),
    zValidator('param', validators.ConfirmBookingParams, validationErrorHandler),
    zValidator('json', validators.ConfirmBookingBody, validationErrorHandler),
    createExpandMiddleware("Booking"),
    registry.confirmBooking as unknown as Handler
  );

  // markNoShowBooking
  app.post('/booking/bookings/:booking/no-show',
    authMiddleware({ roles: ["client:owner", "provider:owner", "admin"] }),
    zValidator('param', validators.MarkNoShowBookingParams, validationErrorHandler),
    zValidator('json', validators.MarkNoShowBookingBody, validationErrorHandler),
    createExpandMiddleware("Booking"),
    registry.markNoShowBooking as unknown as Handler
  );

  // rejectBooking
  app.post('/booking/bookings/:booking/reject',
    authMiddleware({ roles: ["provider:owner", "admin"] }),
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

  // getCapabilityStatement
  app.get('/fhir/',
    registry.getCapabilityStatement as unknown as Handler
  );

  // kickoffSystemExport
  app.post('/fhir/$export',
    zValidator('query', validators.KickoffSystemExportQuery, validationErrorHandler),
    registry.kickoffSystemExport as unknown as Handler
  );

  // getExportStatus
  app.get('/fhir/$export-status/:exportId',
    zValidator('param', validators.GetExportStatusParams, validationErrorHandler),
    registry.getExportStatus as unknown as Handler
  );

  // cancelExport
  app.delete('/fhir/$export-status/:exportId',
    zValidator('param', validators.CancelExportParams, validationErrorHandler),
    registry.cancelExport as unknown as Handler
  );

  // kickoffBulkImport
  app.post('/fhir/$import',
    zValidator('json', validators.KickoffBulkImportBody, validationErrorHandler),
    registry.kickoffBulkImport as unknown as Handler
  );

  // getBulkImportStatus
  app.get('/fhir/$import-status/:importId',
    zValidator('param', validators.GetBulkImportStatusParams, validationErrorHandler),
    registry.getBulkImportStatus as unknown as Handler
  );

  // cancelBulkImport
  app.delete('/fhir/$import-status/:importId',
    zValidator('param', validators.CancelBulkImportParams, validationErrorHandler),
    registry.cancelBulkImport as unknown as Handler
  );

  // validateResource
  app.post('/fhir/$validate',
    zValidator('json', validators.ValidateResourceBody, validationErrorHandler),
    registry.validateResource as unknown as Handler
  );

  // generateDocument
  app.post('/fhir/Composition/:id/$document',
    zValidator('param', validators.GenerateDocumentParams, validationErrorHandler),
    zValidator('json', validators.GenerateDocumentBody, validationErrorHandler),
    registry.generateDocument as unknown as Handler
  );

  // kickoffGroupExport
  app.post('/fhir/Group/:groupId/$export',
    zValidator('param', validators.KickoffGroupExportParams, validationErrorHandler),
    zValidator('query', validators.KickoffGroupExportQuery, validationErrorHandler),
    registry.kickoffGroupExport as unknown as Handler
  );

  // kickoffPatientExport
  app.post('/fhir/Patient/$export',
    zValidator('query', validators.KickoffPatientExportQuery, validationErrorHandler),
    registry.kickoffPatientExport as unknown as Handler
  );

  // patientMatch
  app.post('/fhir/Patient/$match',
    zValidator('json', validators.PatientMatchBody, validationErrorHandler),
    registry.patientMatch as unknown as Handler
  );

  // patientEverything
  app.get('/fhir/Patient/:id/$everything',
    zValidator('param', validators.PatientEverythingParams, validationErrorHandler),
    zValidator('query', validators.PatientEverythingQuery, validationErrorHandler),
    registry.patientEverything as unknown as Handler
  );

  // getMetadata
  app.get('/fhir/metadata',
    registry.getMetadata as unknown as Handler
  );

  // generatePatientSummary
  app.post('/fhir/:patientId/$summary',
    zValidator('param', validators.GeneratePatientSummaryParams, validationErrorHandler),
    zValidator('json', validators.GeneratePatientSummaryBody, validationErrorHandler),
    registry.generatePatientSummary as unknown as Handler
  );

  // getPatientSummary
  app.get('/fhir/:patientId/$summary',
    zValidator('param', validators.GetPatientSummaryParams, validationErrorHandler),
    registry.getPatientSummary as unknown as Handler
  );

  // createAIOutputMetadata
  app.post('/healthcare/analytics/ai-outputs',
    zValidator('json', validators.CreateAIOutputMetadataBody, validationErrorHandler),
    registry.createAIOutputMetadata as unknown as Handler
  );

  // searchAIOutputMetadata
  app.get('/healthcare/analytics/ai-outputs/search',
    zValidator('query', validators.SearchAIOutputMetadataQuery, validationErrorHandler),
    registry.searchAIOutputMetadata as unknown as Handler
  );

  // getAIOutputMetadata
  app.get('/healthcare/analytics/ai-outputs/:id',
    zValidator('param', validators.GetAIOutputMetadataParams, validationErrorHandler),
    registry.getAIOutputMetadata as unknown as Handler
  );

  // reviewAIOutput
  app.post('/healthcare/analytics/ai-outputs/:id/review',
    zValidator('param', validators.ReviewAIOutputParams, validationErrorHandler),
    zValidator('json', validators.ReviewAIOutputBody, validationErrorHandler),
    registry.reviewAIOutput as unknown as Handler
  );

  // createCohortDefinition
  app.post('/healthcare/analytics/cohorts',
    zValidator('json', validators.CreateCohortDefinitionBody, validationErrorHandler),
    registry.createCohortDefinition as unknown as Handler
  );

  // searchCohortDefinitions
  app.get('/healthcare/analytics/cohorts/search',
    zValidator('query', validators.SearchCohortDefinitionsQuery, validationErrorHandler),
    registry.searchCohortDefinitions as unknown as Handler
  );

  // getCohortDefinition
  app.get('/healthcare/analytics/cohorts/:id',
    zValidator('param', validators.GetCohortDefinitionParams, validationErrorHandler),
    registry.getCohortDefinition as unknown as Handler
  );

  // updateCohortDefinition
  app.put('/healthcare/analytics/cohorts/:id',
    zValidator('param', validators.UpdateCohortDefinitionParams, validationErrorHandler),
    zValidator('json', validators.UpdateCohortDefinitionBody, validationErrorHandler),
    registry.updateCohortDefinition as unknown as Handler
  );

  // patchCohortDefinition
  app.patch('/healthcare/analytics/cohorts/:id',
    zValidator('param', validators.PatchCohortDefinitionParams, validationErrorHandler),
    zValidator('json', validators.PatchCohortDefinitionBody, validationErrorHandler),
    registry.patchCohortDefinition as unknown as Handler
  );

  // deleteCohortDefinition
  app.delete('/healthcare/analytics/cohorts/:id',
    zValidator('param', validators.DeleteCohortDefinitionParams, validationErrorHandler),
    registry.deleteCohortDefinition as unknown as Handler
  );

  // evaluateCohort
  app.post('/healthcare/analytics/cohorts/:id/evaluate',
    zValidator('param', validators.EvaluateCohortParams, validationErrorHandler),
    zValidator('json', validators.EvaluateCohortBody, validationErrorHandler),
    registry.evaluateCohort as unknown as Handler
  );

  // createDashboard
  app.post('/healthcare/analytics/dashboards',
    zValidator('json', validators.CreateDashboardBody, validationErrorHandler),
    registry.createDashboard as unknown as Handler
  );

  // searchDashboards
  app.get('/healthcare/analytics/dashboards/search',
    zValidator('query', validators.SearchDashboardsQuery, validationErrorHandler),
    registry.searchDashboards as unknown as Handler
  );

  // getDashboard
  app.get('/healthcare/analytics/dashboards/:id',
    zValidator('param', validators.GetDashboardParams, validationErrorHandler),
    registry.getDashboard as unknown as Handler
  );

  // updateDashboard
  app.put('/healthcare/analytics/dashboards/:id',
    zValidator('param', validators.UpdateDashboardParams, validationErrorHandler),
    zValidator('json', validators.UpdateDashboardBody, validationErrorHandler),
    registry.updateDashboard as unknown as Handler
  );

  // patchDashboard
  app.patch('/healthcare/analytics/dashboards/:id',
    zValidator('param', validators.PatchDashboardParams, validationErrorHandler),
    zValidator('json', validators.PatchDashboardBody, validationErrorHandler),
    registry.patchDashboard as unknown as Handler
  );

  // deleteDashboard
  app.delete('/healthcare/analytics/dashboards/:id',
    zValidator('param', validators.DeleteDashboardParams, validationErrorHandler),
    registry.deleteDashboard as unknown as Handler
  );

  // createDataLineageRecord
  app.post('/healthcare/analytics/data-lineage',
    zValidator('json', validators.CreateDataLineageRecordBody, validationErrorHandler),
    registry.createDataLineageRecord as unknown as Handler
  );

  // searchDataLineageRecords
  app.get('/healthcare/analytics/data-lineage/search',
    zValidator('query', validators.SearchDataLineageRecordsQuery, validationErrorHandler),
    registry.searchDataLineageRecords as unknown as Handler
  );

  // getDataLineageRecord
  app.get('/healthcare/analytics/data-lineage/:id',
    zValidator('param', validators.GetDataLineageRecordParams, validationErrorHandler),
    registry.getDataLineageRecord as unknown as Handler
  );

  // createDeIdentificationProfile
  app.post('/healthcare/analytics/de-identification',
    zValidator('json', validators.CreateDeIdentificationProfileBody, validationErrorHandler),
    registry.createDeIdentificationProfile as unknown as Handler
  );

  // executeDeIdentification
  app.post('/healthcare/analytics/de-identification/execute',
    zValidator('json', validators.ExecuteDeIdentificationBody, validationErrorHandler),
    registry.executeDeIdentification as unknown as Handler
  );

  // searchDeIdentificationProfiles
  app.get('/healthcare/analytics/de-identification/search',
    zValidator('query', validators.SearchDeIdentificationProfilesQuery, validationErrorHandler),
    registry.searchDeIdentificationProfiles as unknown as Handler
  );

  // getDeIdentificationProfile
  app.get('/healthcare/analytics/de-identification/:id',
    zValidator('param', validators.GetDeIdentificationProfileParams, validationErrorHandler),
    registry.getDeIdentificationProfile as unknown as Handler
  );

  // updateDeIdentificationProfile
  app.put('/healthcare/analytics/de-identification/:id',
    zValidator('param', validators.UpdateDeIdentificationProfileParams, validationErrorHandler),
    zValidator('json', validators.UpdateDeIdentificationProfileBody, validationErrorHandler),
    registry.updateDeIdentificationProfile as unknown as Handler
  );

  // patchDeIdentificationProfile
  app.patch('/healthcare/analytics/de-identification/:id',
    zValidator('param', validators.PatchDeIdentificationProfileParams, validationErrorHandler),
    zValidator('json', validators.PatchDeIdentificationProfileBody, validationErrorHandler),
    registry.patchDeIdentificationProfile as unknown as Handler
  );

  // deleteDeIdentificationProfile
  app.delete('/healthcare/analytics/de-identification/:id',
    zValidator('param', validators.DeleteDeIdentificationProfileParams, validationErrorHandler),
    registry.deleteDeIdentificationProfile as unknown as Handler
  );

  // createReportDefinition
  app.post('/healthcare/analytics/reports/definitions',
    zValidator('json', validators.CreateReportDefinitionBody, validationErrorHandler),
    registry.createReportDefinition as unknown as Handler
  );

  // searchReportDefinitions
  app.get('/healthcare/analytics/reports/definitions/search',
    zValidator('query', validators.SearchReportDefinitionsQuery, validationErrorHandler),
    registry.searchReportDefinitions as unknown as Handler
  );

  // getReportDefinition
  app.get('/healthcare/analytics/reports/definitions/:id',
    zValidator('param', validators.GetReportDefinitionParams, validationErrorHandler),
    registry.getReportDefinition as unknown as Handler
  );

  // updateReportDefinition
  app.put('/healthcare/analytics/reports/definitions/:id',
    zValidator('param', validators.UpdateReportDefinitionParams, validationErrorHandler),
    zValidator('json', validators.UpdateReportDefinitionBody, validationErrorHandler),
    registry.updateReportDefinition as unknown as Handler
  );

  // patchReportDefinition
  app.patch('/healthcare/analytics/reports/definitions/:id',
    zValidator('param', validators.PatchReportDefinitionParams, validationErrorHandler),
    zValidator('json', validators.PatchReportDefinitionBody, validationErrorHandler),
    registry.patchReportDefinition as unknown as Handler
  );

  // deleteReportDefinition
  app.delete('/healthcare/analytics/reports/definitions/:id',
    zValidator('param', validators.DeleteReportDefinitionParams, validationErrorHandler),
    registry.deleteReportDefinition as unknown as Handler
  );

  // createReportRun
  app.post('/healthcare/analytics/reports/runs',
    zValidator('json', validators.CreateReportRunBody, validationErrorHandler),
    registry.createReportRun as unknown as Handler
  );

  // searchReportRuns
  app.get('/healthcare/analytics/reports/runs/search',
    zValidator('query', validators.SearchReportRunsQuery, validationErrorHandler),
    registry.searchReportRuns as unknown as Handler
  );

  // getReportRunStatus
  app.get('/healthcare/analytics/reports/runs/:id',
    zValidator('param', validators.GetReportRunStatusParams, validationErrorHandler),
    registry.getReportRunStatus as unknown as Handler
  );

  // cancelReportRun
  app.post('/healthcare/analytics/reports/runs/:id/cancel',
    zValidator('param', validators.CancelReportRunParams, validationErrorHandler),
    zValidator('json', validators.CancelReportRunBody, validationErrorHandler),
    registry.cancelReportRun as unknown as Handler
  );

  // downloadReportRun
  app.get('/healthcare/analytics/reports/runs/:id/download',
    zValidator('param', validators.DownloadReportRunParams, validationErrorHandler),
    registry.downloadReportRun as unknown as Handler
  );

  // createResearchExtract
  app.post('/healthcare/analytics/research-extracts',
    zValidator('json', validators.CreateResearchExtractBody, validationErrorHandler),
    registry.createResearchExtract as unknown as Handler
  );

  // searchResearchExtracts
  app.get('/healthcare/analytics/research-extracts/search',
    zValidator('query', validators.SearchResearchExtractsQuery, validationErrorHandler),
    registry.searchResearchExtracts as unknown as Handler
  );

  // getResearchExtract
  app.get('/healthcare/analytics/research-extracts/:id',
    zValidator('param', validators.GetResearchExtractParams, validationErrorHandler),
    registry.getResearchExtract as unknown as Handler
  );

  // downloadResearchExtract
  app.get('/healthcare/analytics/research-extracts/:id/download',
    zValidator('param', validators.DownloadResearchExtractParams, validationErrorHandler),
    registry.downloadResearchExtract as unknown as Handler
  );

  // createBed
  app.post('/healthcare/bed-management',
    zValidator('json', validators.CreateBedBody, validationErrorHandler),
    registry.createBed as unknown as Handler
  );

  // listBedOccupancy
  app.get('/healthcare/bed-management/occupancy',
    zValidator('query', validators.ListBedOccupancyQuery, validationErrorHandler),
    registry.listBedOccupancy as unknown as Handler
  );

  // searchBeds
  app.get('/healthcare/bed-management/search',
    zValidator('query', validators.SearchBedsQuery, validationErrorHandler),
    registry.searchBeds as unknown as Handler
  );

  // getBed
  app.get('/healthcare/bed-management/:id',
    zValidator('param', validators.GetBedParams, validationErrorHandler),
    registry.getBed as unknown as Handler
  );

  // updateBed
  app.put('/healthcare/bed-management/:id',
    zValidator('param', validators.UpdateBedParams, validationErrorHandler),
    zValidator('json', validators.UpdateBedBody, validationErrorHandler),
    registry.updateBed as unknown as Handler
  );

  // patchBed
  app.patch('/healthcare/bed-management/:id',
    zValidator('param', validators.PatchBedParams, validationErrorHandler),
    zValidator('json', validators.PatchBedBody, validationErrorHandler),
    registry.patchBed as unknown as Handler
  );

  // deleteBed
  app.delete('/healthcare/bed-management/:id',
    zValidator('param', validators.DeleteBedParams, validationErrorHandler),
    registry.deleteBed as unknown as Handler
  );

  // assignBed
  app.post('/healthcare/bed-management/:id/assign',
    zValidator('param', validators.AssignBedParams, validationErrorHandler),
    zValidator('json', validators.AssignBedBody, validationErrorHandler),
    registry.assignBed as unknown as Handler
  );

  // releaseBed
  app.post('/healthcare/bed-management/:id/release',
    zValidator('param', validators.ReleaseBedParams, validationErrorHandler),
    registry.releaseBed as unknown as Handler
  );

  // createCrossmatch
  app.post('/healthcare/blood-bank/crossmatch',
    zValidator('json', validators.CreateCrossmatchBody, validationErrorHandler),
    registry.createCrossmatch as unknown as Handler
  );

  // searchCrossmatches
  app.get('/healthcare/blood-bank/crossmatch/search',
    zValidator('query', validators.SearchCrossmatchesQuery, validationErrorHandler),
    registry.searchCrossmatches as unknown as Handler
  );

  // getCrossmatch
  app.get('/healthcare/blood-bank/crossmatch/:id',
    zValidator('param', validators.GetCrossmatchParams, validationErrorHandler),
    registry.getCrossmatch as unknown as Handler
  );

  // updateCrossmatch
  app.put('/healthcare/blood-bank/crossmatch/:id',
    zValidator('param', validators.UpdateCrossmatchParams, validationErrorHandler),
    zValidator('json', validators.UpdateCrossmatchBody, validationErrorHandler),
    registry.updateCrossmatch as unknown as Handler
  );

  // deleteCrossmatch
  app.delete('/healthcare/blood-bank/crossmatch/:id',
    zValidator('param', validators.DeleteCrossmatchParams, validationErrorHandler),
    registry.deleteCrossmatch as unknown as Handler
  );

  // createBloodProduct
  app.post('/healthcare/blood-bank/products',
    zValidator('json', validators.CreateBloodProductBody, validationErrorHandler),
    registry.createBloodProduct as unknown as Handler
  );

  // searchBloodProducts
  app.get('/healthcare/blood-bank/products/search',
    zValidator('query', validators.SearchBloodProductsQuery, validationErrorHandler),
    registry.searchBloodProducts as unknown as Handler
  );

  // getBloodProduct
  app.get('/healthcare/blood-bank/products/:id',
    zValidator('param', validators.GetBloodProductParams, validationErrorHandler),
    registry.getBloodProduct as unknown as Handler
  );

  // updateBloodProduct
  app.put('/healthcare/blood-bank/products/:id',
    zValidator('param', validators.UpdateBloodProductParams, validationErrorHandler),
    zValidator('json', validators.UpdateBloodProductBody, validationErrorHandler),
    registry.updateBloodProduct as unknown as Handler
  );

  // deleteBloodProduct
  app.delete('/healthcare/blood-bank/products/:id',
    zValidator('param', validators.DeleteBloodProductParams, validationErrorHandler),
    registry.deleteBloodProduct as unknown as Handler
  );

  // createTransfusionRecord
  app.post('/healthcare/blood-bank/transfusions',
    zValidator('json', validators.CreateTransfusionRecordBody, validationErrorHandler),
    registry.createTransfusionRecord as unknown as Handler
  );

  // searchTransfusionRecords
  app.get('/healthcare/blood-bank/transfusions/search',
    zValidator('query', validators.SearchTransfusionRecordsQuery, validationErrorHandler),
    registry.searchTransfusionRecords as unknown as Handler
  );

  // getTransfusionRecord
  app.get('/healthcare/blood-bank/transfusions/:id',
    zValidator('param', validators.GetTransfusionRecordParams, validationErrorHandler),
    registry.getTransfusionRecord as unknown as Handler
  );

  // updateTransfusionRecord
  app.put('/healthcare/blood-bank/transfusions/:id',
    zValidator('param', validators.UpdateTransfusionRecordParams, validationErrorHandler),
    zValidator('json', validators.UpdateTransfusionRecordBody, validationErrorHandler),
    registry.updateTransfusionRecord as unknown as Handler
  );

  // deleteTransfusionRecord
  app.delete('/healthcare/blood-bank/transfusions/:id',
    zValidator('param', validators.DeleteTransfusionRecordParams, validationErrorHandler),
    registry.deleteTransfusionRecord as unknown as Handler
  );

  // activateBreakGlass
  app.post('/healthcare/break-glass',
    zValidator('json', validators.ActivateBreakGlassBody, validationErrorHandler),
    registry.activateBreakGlass as unknown as Handler
  );

  // searchBreakGlassOverrides
  app.get('/healthcare/break-glass/search',
    zValidator('query', validators.SearchBreakGlassOverridesQuery, validationErrorHandler),
    registry.searchBreakGlassOverrides as unknown as Handler
  );

  // getBreakGlassOverride
  app.get('/healthcare/break-glass/:id',
    zValidator('param', validators.GetBreakGlassOverrideParams, validationErrorHandler),
    registry.getBreakGlassOverride as unknown as Handler
  );

  // reviewBreakGlassOverride
  app.post('/healthcare/break-glass/:id/review',
    zValidator('param', validators.ReviewBreakGlassOverrideParams, validationErrorHandler),
    zValidator('json', validators.ReviewBreakGlassOverrideBody, validationErrorHandler),
    registry.reviewBreakGlassOverride as unknown as Handler
  );

  // createCarePlan
  app.post('/healthcare/care-planning/care-plans',
    zValidator('json', validators.CreateCarePlanBody, validationErrorHandler),
    registry.createCarePlan as unknown as Handler
  );

  // searchCarePlans
  app.get('/healthcare/care-planning/care-plans/search',
    zValidator('query', validators.SearchCarePlansQuery, validationErrorHandler),
    registry.searchCarePlans as unknown as Handler
  );

  // getCarePlan
  app.get('/healthcare/care-planning/care-plans/:id',
    zValidator('param', validators.GetCarePlanParams, validationErrorHandler),
    registry.getCarePlan as unknown as Handler
  );

  // updateCarePlan
  app.put('/healthcare/care-planning/care-plans/:id',
    zValidator('param', validators.UpdateCarePlanParams, validationErrorHandler),
    zValidator('json', validators.UpdateCarePlanBody, validationErrorHandler),
    registry.updateCarePlan as unknown as Handler
  );

  // patchCarePlan
  app.patch('/healthcare/care-planning/care-plans/:id',
    zValidator('param', validators.PatchCarePlanParams, validationErrorHandler),
    zValidator('json', validators.PatchCarePlanBody, validationErrorHandler),
    registry.patchCarePlan as unknown as Handler
  );

  // deleteCarePlan
  app.delete('/healthcare/care-planning/care-plans/:id',
    zValidator('param', validators.DeleteCarePlanParams, validationErrorHandler),
    registry.deleteCarePlan as unknown as Handler
  );

  // createCareTeam
  app.post('/healthcare/care-planning/care-teams',
    zValidator('json', validators.CreateCareTeamBody, validationErrorHandler),
    registry.createCareTeam as unknown as Handler
  );

  // searchCareTeams
  app.get('/healthcare/care-planning/care-teams/search',
    zValidator('query', validators.SearchCareTeamsQuery, validationErrorHandler),
    registry.searchCareTeams as unknown as Handler
  );

  // getCareTeam
  app.get('/healthcare/care-planning/care-teams/:id',
    zValidator('param', validators.GetCareTeamParams, validationErrorHandler),
    registry.getCareTeam as unknown as Handler
  );

  // updateCareTeam
  app.put('/healthcare/care-planning/care-teams/:id',
    zValidator('param', validators.UpdateCareTeamParams, validationErrorHandler),
    zValidator('json', validators.UpdateCareTeamBody, validationErrorHandler),
    registry.updateCareTeam as unknown as Handler
  );

  // patchCareTeam
  app.patch('/healthcare/care-planning/care-teams/:id',
    zValidator('param', validators.PatchCareTeamParams, validationErrorHandler),
    zValidator('json', validators.PatchCareTeamBody, validationErrorHandler),
    registry.patchCareTeam as unknown as Handler
  );

  // deleteCareTeam
  app.delete('/healthcare/care-planning/care-teams/:id',
    zValidator('param', validators.DeleteCareTeamParams, validationErrorHandler),
    registry.deleteCareTeam as unknown as Handler
  );

  // createGoal
  app.post('/healthcare/care-planning/goals',
    zValidator('json', validators.CreateGoalBody, validationErrorHandler),
    registry.createGoal as unknown as Handler
  );

  // searchGoals
  app.get('/healthcare/care-planning/goals/search',
    zValidator('query', validators.SearchGoalsQuery, validationErrorHandler),
    registry.searchGoals as unknown as Handler
  );

  // getGoal
  app.get('/healthcare/care-planning/goals/:id',
    zValidator('param', validators.GetGoalParams, validationErrorHandler),
    registry.getGoal as unknown as Handler
  );

  // updateGoal
  app.put('/healthcare/care-planning/goals/:id',
    zValidator('param', validators.UpdateGoalParams, validationErrorHandler),
    zValidator('json', validators.UpdateGoalBody, validationErrorHandler),
    registry.updateGoal as unknown as Handler
  );

  // patchGoal
  app.patch('/healthcare/care-planning/goals/:id',
    zValidator('param', validators.PatchGoalParams, validationErrorHandler),
    zValidator('json', validators.PatchGoalBody, validationErrorHandler),
    registry.patchGoal as unknown as Handler
  );

  // deleteGoal
  app.delete('/healthcare/care-planning/goals/:id',
    zValidator('param', validators.DeleteGoalParams, validationErrorHandler),
    registry.deleteGoal as unknown as Handler
  );

  // cdsEncounterStart
  app.post('/healthcare/cds-hooks/encounter-start',
    zValidator('json', validators.CdsEncounterStartBody, validationErrorHandler),
    registry.cdsEncounterStart as unknown as Handler
  );

  // cdsOrderSelect
  app.post('/healthcare/cds-hooks/order-select',
    zValidator('json', validators.CdsOrderSelectBody, validationErrorHandler),
    registry.cdsOrderSelect as unknown as Handler
  );

  // cdsOrderSign
  app.post('/healthcare/cds-hooks/order-sign',
    zValidator('json', validators.CdsOrderSignBody, validationErrorHandler),
    registry.cdsOrderSign as unknown as Handler
  );

  // cdsPatientView
  app.post('/healthcare/cds-hooks/patient-view',
    zValidator('json', validators.CdsPatientViewBody, validationErrorHandler),
    registry.cdsPatientView as unknown as Handler
  );

  // discoverCDSServices
  app.get('/healthcare/cds-hooks/services',
    registry.discoverCDSServices as unknown as Handler
  );

  // createChargeDefinition
  app.post('/healthcare/charge-capture/definitions',
    zValidator('json', validators.CreateChargeDefinitionBody, validationErrorHandler),
    registry.createChargeDefinition as unknown as Handler
  );

  // searchChargeDefinitions
  app.get('/healthcare/charge-capture/definitions/search',
    zValidator('query', validators.SearchChargeDefinitionsQuery, validationErrorHandler),
    registry.searchChargeDefinitions as unknown as Handler
  );

  // getChargeDefinition
  app.get('/healthcare/charge-capture/definitions/:id',
    zValidator('param', validators.GetChargeDefinitionParams, validationErrorHandler),
    registry.getChargeDefinition as unknown as Handler
  );

  // updateChargeDefinition
  app.put('/healthcare/charge-capture/definitions/:id',
    zValidator('param', validators.UpdateChargeDefinitionParams, validationErrorHandler),
    zValidator('json', validators.UpdateChargeDefinitionBody, validationErrorHandler),
    registry.updateChargeDefinition as unknown as Handler
  );

  // patchChargeDefinition
  app.patch('/healthcare/charge-capture/definitions/:id',
    zValidator('param', validators.PatchChargeDefinitionParams, validationErrorHandler),
    zValidator('json', validators.PatchChargeDefinitionBody, validationErrorHandler),
    registry.patchChargeDefinition as unknown as Handler
  );

  // deleteChargeDefinition
  app.delete('/healthcare/charge-capture/definitions/:id',
    zValidator('param', validators.DeleteChargeDefinitionParams, validationErrorHandler),
    registry.deleteChargeDefinition as unknown as Handler
  );

  // createChargeItem
  app.post('/healthcare/charge-capture/items',
    zValidator('json', validators.CreateChargeItemBody, validationErrorHandler),
    registry.createChargeItem as unknown as Handler
  );

  // bulkCreateChargeItems
  app.post('/healthcare/charge-capture/items/bulk',
    zValidator('json', validators.BulkCreateChargeItemsBody, validationErrorHandler),
    registry.bulkCreateChargeItems as unknown as Handler
  );

  // searchChargeItems
  app.get('/healthcare/charge-capture/items/search',
    zValidator('query', validators.SearchChargeItemsQuery, validationErrorHandler),
    registry.searchChargeItems as unknown as Handler
  );

  // verifyCharges
  app.post('/healthcare/charge-capture/items/verify',
    zValidator('json', validators.VerifyChargesBody, validationErrorHandler),
    registry.verifyCharges as unknown as Handler
  );

  // getChargeItem
  app.get('/healthcare/charge-capture/items/:id',
    zValidator('param', validators.GetChargeItemParams, validationErrorHandler),
    registry.getChargeItem as unknown as Handler
  );

  // updateChargeItem
  app.put('/healthcare/charge-capture/items/:id',
    zValidator('param', validators.UpdateChargeItemParams, validationErrorHandler),
    zValidator('json', validators.UpdateChargeItemBody, validationErrorHandler),
    registry.updateChargeItem as unknown as Handler
  );

  // patchChargeItem
  app.patch('/healthcare/charge-capture/items/:id',
    zValidator('param', validators.PatchChargeItemParams, validationErrorHandler),
    zValidator('json', validators.PatchChargeItemBody, validationErrorHandler),
    registry.patchChargeItem as unknown as Handler
  );

  // deleteChargeItem
  app.delete('/healthcare/charge-capture/items/:id',
    zValidator('param', validators.DeleteChargeItemParams, validationErrorHandler),
    registry.deleteChargeItem as unknown as Handler
  );

  // createClaim
  app.post('/healthcare/claims',
    zValidator('json', validators.CreateClaimBody, validationErrorHandler),
    registry.createClaim as unknown as Handler
  );

  // searchClaimResponses
  app.get('/healthcare/claims/responses/search',
    zValidator('query', validators.SearchClaimResponsesQuery, validationErrorHandler),
    registry.searchClaimResponses as unknown as Handler
  );

  // getClaimResponse
  app.get('/healthcare/claims/responses/:id',
    zValidator('param', validators.GetClaimResponseParams, validationErrorHandler),
    registry.getClaimResponse as unknown as Handler
  );

  // searchClaims
  app.get('/healthcare/claims/search',
    zValidator('query', validators.SearchClaimsQuery, validationErrorHandler),
    registry.searchClaims as unknown as Handler
  );

  // submitClaim
  app.post('/healthcare/claims/submit',
    zValidator('json', validators.SubmitClaimBody, validationErrorHandler),
    registry.submitClaim as unknown as Handler
  );

  // getClaim
  app.get('/healthcare/claims/:id',
    zValidator('param', validators.GetClaimParams, validationErrorHandler),
    registry.getClaim as unknown as Handler
  );

  // updateClaim
  app.put('/healthcare/claims/:id',
    zValidator('param', validators.UpdateClaimParams, validationErrorHandler),
    zValidator('json', validators.UpdateClaimBody, validationErrorHandler),
    registry.updateClaim as unknown as Handler
  );

  // patchClaim
  app.patch('/healthcare/claims/:id',
    zValidator('param', validators.PatchClaimParams, validationErrorHandler),
    zValidator('json', validators.PatchClaimBody, validationErrorHandler),
    registry.patchClaim as unknown as Handler
  );

  // deleteClaim
  app.delete('/healthcare/claims/:id',
    zValidator('param', validators.DeleteClaimParams, validationErrorHandler),
    registry.deleteClaim as unknown as Handler
  );

  // createClinicalBenchmark
  app.post('/healthcare/clinical-outcomes/benchmarks',
    zValidator('json', validators.CreateClinicalBenchmarkBody, validationErrorHandler),
    registry.createClinicalBenchmark as unknown as Handler
  );

  // searchClinicalBenchmarks
  app.get('/healthcare/clinical-outcomes/benchmarks/search',
    zValidator('query', validators.SearchClinicalBenchmarksQuery, validationErrorHandler),
    registry.searchClinicalBenchmarks as unknown as Handler
  );

  // getClinicalBenchmark
  app.get('/healthcare/clinical-outcomes/benchmarks/:id',
    zValidator('param', validators.GetClinicalBenchmarkParams, validationErrorHandler),
    registry.getClinicalBenchmark as unknown as Handler
  );

  // updateClinicalBenchmark
  app.put('/healthcare/clinical-outcomes/benchmarks/:id',
    zValidator('param', validators.UpdateClinicalBenchmarkParams, validationErrorHandler),
    zValidator('json', validators.UpdateClinicalBenchmarkBody, validationErrorHandler),
    registry.updateClinicalBenchmark as unknown as Handler
  );

  // patchClinicalBenchmark
  app.patch('/healthcare/clinical-outcomes/benchmarks/:id',
    zValidator('param', validators.PatchClinicalBenchmarkParams, validationErrorHandler),
    zValidator('json', validators.PatchClinicalBenchmarkBody, validationErrorHandler),
    registry.patchClinicalBenchmark as unknown as Handler
  );

  // deleteClinicalBenchmark
  app.delete('/healthcare/clinical-outcomes/benchmarks/:id',
    zValidator('param', validators.DeleteClinicalBenchmarkParams, validationErrorHandler),
    registry.deleteClinicalBenchmark as unknown as Handler
  );

  // createOutcomeRecord
  app.post('/healthcare/clinical-outcomes/records',
    zValidator('json', validators.CreateOutcomeRecordBody, validationErrorHandler),
    registry.createOutcomeRecord as unknown as Handler
  );

  // searchOutcomeRecords
  app.get('/healthcare/clinical-outcomes/records/search',
    zValidator('query', validators.SearchOutcomeRecordsQuery, validationErrorHandler),
    registry.searchOutcomeRecords as unknown as Handler
  );

  // getOutcomeRecord
  app.get('/healthcare/clinical-outcomes/records/:id',
    zValidator('param', validators.GetOutcomeRecordParams, validationErrorHandler),
    registry.getOutcomeRecord as unknown as Handler
  );

  // updateOutcomeRecord
  app.put('/healthcare/clinical-outcomes/records/:id',
    zValidator('param', validators.UpdateOutcomeRecordParams, validationErrorHandler),
    zValidator('json', validators.UpdateOutcomeRecordBody, validationErrorHandler),
    registry.updateOutcomeRecord as unknown as Handler
  );

  // patchOutcomeRecord
  app.patch('/healthcare/clinical-outcomes/records/:id',
    zValidator('param', validators.PatchOutcomeRecordParams, validationErrorHandler),
    zValidator('json', validators.PatchOutcomeRecordBody, validationErrorHandler),
    registry.patchOutcomeRecord as unknown as Handler
  );

  // deleteOutcomeRecord
  app.delete('/healthcare/clinical-outcomes/records/:id',
    zValidator('param', validators.DeleteOutcomeRecordParams, validationErrorHandler),
    registry.deleteOutcomeRecord as unknown as Handler
  );

  // generateOutcomeReport
  app.post('/healthcare/clinical-outcomes/reports',
    zValidator('json', validators.GenerateOutcomeReportBody, validationErrorHandler),
    registry.generateOutcomeReport as unknown as Handler
  );

  // searchOutcomeReports
  app.get('/healthcare/clinical-outcomes/reports/search',
    zValidator('query', validators.SearchOutcomeReportsQuery, validationErrorHandler),
    registry.searchOutcomeReports as unknown as Handler
  );

  // getOutcomeReport
  app.get('/healthcare/clinical-outcomes/reports/:id',
    zValidator('param', validators.GetOutcomeReportParams, validationErrorHandler),
    registry.getOutcomeReport as unknown as Handler
  );

  // createADTEvent
  app.post('/healthcare/clinical/adt-events',
    zValidator('json', validators.CreateADTEventBody, validationErrorHandler),
    registry.createADTEvent as unknown as Handler
  );

  // getPatientADTTimeline
  app.get('/healthcare/clinical/adt-events/patient/:patientId/timeline',
    zValidator('param', validators.GetPatientADTTimelineParams, validationErrorHandler),
    zValidator('query', validators.GetPatientADTTimelineQuery, validationErrorHandler),
    registry.getPatientADTTimeline as unknown as Handler
  );

  // searchADTEvents
  app.get('/healthcare/clinical/adt-events/search',
    zValidator('query', validators.SearchADTEventsQuery, validationErrorHandler),
    registry.searchADTEvents as unknown as Handler
  );

  // getADTEvent
  app.get('/healthcare/clinical/adt-events/:id',
    zValidator('param', validators.GetADTEventParams, validationErrorHandler),
    registry.getADTEvent as unknown as Handler
  );

  // createAllergyIntolerance
  app.post('/healthcare/clinical/allergies',
    zValidator('json', validators.CreateAllergyIntoleranceBody, validationErrorHandler),
    registry.createAllergyIntolerance as unknown as Handler
  );

  // searchAllergyIntolerances
  app.get('/healthcare/clinical/allergies/search',
    zValidator('json', validators.SearchAllergyIntolerancesBody, validationErrorHandler),
    registry.searchAllergyIntolerances as unknown as Handler
  );

  // getAllergyIntolerance
  app.get('/healthcare/clinical/allergies/:id',
    zValidator('param', validators.GetAllergyIntoleranceParams, validationErrorHandler),
    registry.getAllergyIntolerance as unknown as Handler
  );

  // updateAllergyIntolerance
  app.put('/healthcare/clinical/allergies/:id',
    zValidator('param', validators.UpdateAllergyIntoleranceParams, validationErrorHandler),
    zValidator('json', validators.UpdateAllergyIntoleranceBody, validationErrorHandler),
    registry.updateAllergyIntolerance as unknown as Handler
  );

  // patchAllergyIntolerance
  app.patch('/healthcare/clinical/allergies/:id',
    zValidator('param', validators.PatchAllergyIntoleranceParams, validationErrorHandler),
    zValidator('json', validators.PatchAllergyIntoleranceBody, validationErrorHandler),
    registry.patchAllergyIntolerance as unknown as Handler
  );

  // deleteAllergyIntolerance
  app.delete('/healthcare/clinical/allergies/:id',
    zValidator('param', validators.DeleteAllergyIntoleranceParams, validationErrorHandler),
    registry.deleteAllergyIntolerance as unknown as Handler
  );

  // createAnesthesiaRecord
  app.post('/healthcare/clinical/anesthesia-records',
    zValidator('json', validators.CreateAnesthesiaRecordBody, validationErrorHandler),
    registry.createAnesthesiaRecord as unknown as Handler
  );

  // searchAnesthesiaRecords
  app.get('/healthcare/clinical/anesthesia-records/search',
    zValidator('query', validators.SearchAnesthesiaRecordsQuery, validationErrorHandler),
    registry.searchAnesthesiaRecords as unknown as Handler
  );

  // getAnesthesiaRecord
  app.get('/healthcare/clinical/anesthesia-records/:id',
    zValidator('param', validators.GetAnesthesiaRecordParams, validationErrorHandler),
    registry.getAnesthesiaRecord as unknown as Handler
  );

  // updateAnesthesiaRecord
  app.put('/healthcare/clinical/anesthesia-records/:id',
    zValidator('param', validators.UpdateAnesthesiaRecordParams, validationErrorHandler),
    zValidator('json', validators.UpdateAnesthesiaRecordBody, validationErrorHandler),
    registry.updateAnesthesiaRecord as unknown as Handler
  );

  // deleteAnesthesiaRecord
  app.delete('/healthcare/clinical/anesthesia-records/:id',
    zValidator('param', validators.DeleteAnesthesiaRecordParams, validationErrorHandler),
    registry.deleteAnesthesiaRecord as unknown as Handler
  );

  // createComposition
  app.post('/healthcare/clinical/compositions',
    zValidator('json', validators.CreateCompositionBody, validationErrorHandler),
    registry.createComposition as unknown as Handler
  );

  // searchCompositions
  app.get('/healthcare/clinical/compositions/search',
    zValidator('query', validators.SearchCompositionsQuery, validationErrorHandler),
    zValidator('json', validators.SearchCompositionsBody, validationErrorHandler),
    registry.searchCompositions as unknown as Handler
  );

  // getComposition
  app.get('/healthcare/clinical/compositions/:id',
    zValidator('param', validators.GetCompositionParams, validationErrorHandler),
    registry.getComposition as unknown as Handler
  );

  // updateComposition
  app.put('/healthcare/clinical/compositions/:id',
    zValidator('param', validators.UpdateCompositionParams, validationErrorHandler),
    zValidator('json', validators.UpdateCompositionBody, validationErrorHandler),
    registry.updateComposition as unknown as Handler
  );

  // patchComposition
  app.patch('/healthcare/clinical/compositions/:id',
    zValidator('param', validators.PatchCompositionParams, validationErrorHandler),
    zValidator('json', validators.PatchCompositionBody, validationErrorHandler),
    registry.patchComposition as unknown as Handler
  );

  // deleteComposition
  app.delete('/healthcare/clinical/compositions/:id',
    zValidator('param', validators.DeleteCompositionParams, validationErrorHandler),
    registry.deleteComposition as unknown as Handler
  );

  // createCondition
  app.post('/healthcare/clinical/conditions',
    zValidator('json', validators.CreateConditionBody, validationErrorHandler),
    registry.createCondition as unknown as Handler
  );

  // searchConditions
  app.get('/healthcare/clinical/conditions/search',
    zValidator('json', validators.SearchConditionsBody, validationErrorHandler),
    registry.searchConditions as unknown as Handler
  );

  // getCondition
  app.get('/healthcare/clinical/conditions/:id',
    zValidator('param', validators.GetConditionParams, validationErrorHandler),
    registry.getCondition as unknown as Handler
  );

  // updateCondition
  app.put('/healthcare/clinical/conditions/:id',
    zValidator('param', validators.UpdateConditionParams, validationErrorHandler),
    zValidator('json', validators.UpdateConditionBody, validationErrorHandler),
    registry.updateCondition as unknown as Handler
  );

  // patchCondition
  app.patch('/healthcare/clinical/conditions/:id',
    zValidator('param', validators.PatchConditionParams, validationErrorHandler),
    zValidator('json', validators.PatchConditionBody, validationErrorHandler),
    registry.patchCondition as unknown as Handler
  );

  // deleteCondition
  app.delete('/healthcare/clinical/conditions/:id',
    zValidator('param', validators.DeleteConditionParams, validationErrorHandler),
    registry.deleteCondition as unknown as Handler
  );

  // createDocumentReference
  app.post('/healthcare/clinical/document-references',
    zValidator('json', validators.CreateDocumentReferenceBody, validationErrorHandler),
    registry.createDocumentReference as unknown as Handler
  );

  // searchDocumentReferences
  app.get('/healthcare/clinical/document-references/search',
    zValidator('json', validators.SearchDocumentReferencesBody, validationErrorHandler),
    registry.searchDocumentReferences as unknown as Handler
  );

  // getDocumentReference
  app.get('/healthcare/clinical/document-references/:id',
    zValidator('param', validators.GetDocumentReferenceParams, validationErrorHandler),
    registry.getDocumentReference as unknown as Handler
  );

  // updateDocumentReference
  app.put('/healthcare/clinical/document-references/:id',
    zValidator('param', validators.UpdateDocumentReferenceParams, validationErrorHandler),
    zValidator('json', validators.UpdateDocumentReferenceBody, validationErrorHandler),
    registry.updateDocumentReference as unknown as Handler
  );

  // patchDocumentReference
  app.patch('/healthcare/clinical/document-references/:id',
    zValidator('param', validators.PatchDocumentReferenceParams, validationErrorHandler),
    zValidator('json', validators.PatchDocumentReferenceBody, validationErrorHandler),
    registry.patchDocumentReference as unknown as Handler
  );

  // deleteDocumentReference
  app.delete('/healthcare/clinical/document-references/:id',
    zValidator('param', validators.DeleteDocumentReferenceParams, validationErrorHandler),
    registry.deleteDocumentReference as unknown as Handler
  );

  // createEncounter
  app.post('/healthcare/clinical/encounters',
    zValidator('json', validators.CreateEncounterBody, validationErrorHandler),
    registry.createEncounter as unknown as Handler
  );

  // searchEncounters
  app.get('/healthcare/clinical/encounters/search',
    zValidator('json', validators.SearchEncountersBody, validationErrorHandler),
    registry.searchEncounters as unknown as Handler
  );

  // getEncounter
  app.get('/healthcare/clinical/encounters/:id',
    zValidator('param', validators.GetEncounterParams, validationErrorHandler),
    registry.getEncounter as unknown as Handler
  );

  // updateEncounter
  app.put('/healthcare/clinical/encounters/:id',
    zValidator('param', validators.UpdateEncounterParams, validationErrorHandler),
    zValidator('json', validators.UpdateEncounterBody, validationErrorHandler),
    registry.updateEncounter as unknown as Handler
  );

  // patchEncounter
  app.patch('/healthcare/clinical/encounters/:id',
    zValidator('param', validators.PatchEncounterParams, validationErrorHandler),
    zValidator('json', validators.PatchEncounterBody, validationErrorHandler),
    registry.patchEncounter as unknown as Handler
  );

  // deleteEncounter
  app.delete('/healthcare/clinical/encounters/:id',
    zValidator('param', validators.DeleteEncounterParams, validationErrorHandler),
    registry.deleteEncounter as unknown as Handler
  );

  // transitionEncounterStatus
  app.post('/healthcare/clinical/encounters/:id/status',
    zValidator('param', validators.TransitionEncounterStatusParams, validationErrorHandler),
    zValidator('json', validators.TransitionEncounterStatusBody, validationErrorHandler),
    registry.transitionEncounterStatus as unknown as Handler
  );

  // createEpisodeOfCare
  app.post('/healthcare/clinical/episodes-of-care',
    zValidator('json', validators.CreateEpisodeOfCareBody, validationErrorHandler),
    registry.createEpisodeOfCare as unknown as Handler
  );

  // searchEpisodesOfCare
  app.get('/healthcare/clinical/episodes-of-care/search',
    zValidator('query', validators.SearchEpisodesOfCareQuery, validationErrorHandler),
    zValidator('json', validators.SearchEpisodesOfCareBody, validationErrorHandler),
    registry.searchEpisodesOfCare as unknown as Handler
  );

  // getEpisodeOfCare
  app.get('/healthcare/clinical/episodes-of-care/:id',
    zValidator('param', validators.GetEpisodeOfCareParams, validationErrorHandler),
    registry.getEpisodeOfCare as unknown as Handler
  );

  // updateEpisodeOfCare
  app.put('/healthcare/clinical/episodes-of-care/:id',
    zValidator('param', validators.UpdateEpisodeOfCareParams, validationErrorHandler),
    zValidator('json', validators.UpdateEpisodeOfCareBody, validationErrorHandler),
    registry.updateEpisodeOfCare as unknown as Handler
  );

  // patchEpisodeOfCare
  app.patch('/healthcare/clinical/episodes-of-care/:id',
    zValidator('param', validators.PatchEpisodeOfCareParams, validationErrorHandler),
    zValidator('json', validators.PatchEpisodeOfCareBody, validationErrorHandler),
    registry.patchEpisodeOfCare as unknown as Handler
  );

  // deleteEpisodeOfCare
  app.delete('/healthcare/clinical/episodes-of-care/:id',
    zValidator('param', validators.DeleteEpisodeOfCareParams, validationErrorHandler),
    registry.deleteEpisodeOfCare as unknown as Handler
  );

  // transitionEpisodeOfCareStatus
  app.post('/healthcare/clinical/episodes-of-care/:id/status',
    zValidator('param', validators.TransitionEpisodeOfCareStatusParams, validationErrorHandler),
    zValidator('json', validators.TransitionEpisodeOfCareStatusBody, validationErrorHandler),
    registry.transitionEpisodeOfCareStatus as unknown as Handler
  );

  // createFamilyMemberHistory
  app.post('/healthcare/clinical/family-history',
    zValidator('json', validators.CreateFamilyMemberHistoryBody, validationErrorHandler),
    registry.createFamilyMemberHistory as unknown as Handler
  );

  // searchFamilyMemberHistories
  app.get('/healthcare/clinical/family-history/search',
    zValidator('json', validators.SearchFamilyMemberHistoriesBody, validationErrorHandler),
    registry.searchFamilyMemberHistories as unknown as Handler
  );

  // getFamilyMemberHistory
  app.get('/healthcare/clinical/family-history/:id',
    zValidator('param', validators.GetFamilyMemberHistoryParams, validationErrorHandler),
    registry.getFamilyMemberHistory as unknown as Handler
  );

  // updateFamilyMemberHistory
  app.put('/healthcare/clinical/family-history/:id',
    zValidator('param', validators.UpdateFamilyMemberHistoryParams, validationErrorHandler),
    zValidator('json', validators.UpdateFamilyMemberHistoryBody, validationErrorHandler),
    registry.updateFamilyMemberHistory as unknown as Handler
  );

  // patchFamilyMemberHistory
  app.patch('/healthcare/clinical/family-history/:id',
    zValidator('param', validators.PatchFamilyMemberHistoryParams, validationErrorHandler),
    zValidator('json', validators.PatchFamilyMemberHistoryBody, validationErrorHandler),
    registry.patchFamilyMemberHistory as unknown as Handler
  );

  // deleteFamilyMemberHistory
  app.delete('/healthcare/clinical/family-history/:id',
    zValidator('param', validators.DeleteFamilyMemberHistoryParams, validationErrorHandler),
    registry.deleteFamilyMemberHistory as unknown as Handler
  );

  // createFlag
  app.post('/healthcare/clinical/flags',
    zValidator('json', validators.CreateFlagBody, validationErrorHandler),
    registry.createFlag as unknown as Handler
  );

  // searchFlags
  app.get('/healthcare/clinical/flags/search',
    zValidator('query', validators.SearchFlagsQuery, validationErrorHandler),
    zValidator('json', validators.SearchFlagsBody, validationErrorHandler),
    registry.searchFlags as unknown as Handler
  );

  // getFlag
  app.get('/healthcare/clinical/flags/:id',
    zValidator('param', validators.GetFlagParams, validationErrorHandler),
    registry.getFlag as unknown as Handler
  );

  // updateFlag
  app.put('/healthcare/clinical/flags/:id',
    zValidator('param', validators.UpdateFlagParams, validationErrorHandler),
    zValidator('json', validators.UpdateFlagBody, validationErrorHandler),
    registry.updateFlag as unknown as Handler
  );

  // patchFlag
  app.patch('/healthcare/clinical/flags/:id',
    zValidator('param', validators.PatchFlagParams, validationErrorHandler),
    zValidator('json', validators.PatchFlagBody, validationErrorHandler),
    registry.patchFlag as unknown as Handler
  );

  // deleteFlag
  app.delete('/healthcare/clinical/flags/:id',
    zValidator('param', validators.DeleteFlagParams, validationErrorHandler),
    registry.deleteFlag as unknown as Handler
  );

  // createClinicalHandoff
  app.post('/healthcare/clinical/handoffs',
    zValidator('json', validators.CreateClinicalHandoffBody, validationErrorHandler),
    registry.createClinicalHandoff as unknown as Handler
  );

  // searchClinicalHandoffs
  app.get('/healthcare/clinical/handoffs/search',
    zValidator('query', validators.SearchClinicalHandoffsQuery, validationErrorHandler),
    registry.searchClinicalHandoffs as unknown as Handler
  );

  // getClinicalHandoff
  app.get('/healthcare/clinical/handoffs/:id',
    zValidator('param', validators.GetClinicalHandoffParams, validationErrorHandler),
    registry.getClinicalHandoff as unknown as Handler
  );

  // updateClinicalHandoff
  app.put('/healthcare/clinical/handoffs/:id',
    zValidator('param', validators.UpdateClinicalHandoffParams, validationErrorHandler),
    zValidator('json', validators.UpdateClinicalHandoffBody, validationErrorHandler),
    registry.updateClinicalHandoff as unknown as Handler
  );

  // deleteClinicalHandoff
  app.delete('/healthcare/clinical/handoffs/:id',
    zValidator('param', validators.DeleteClinicalHandoffParams, validationErrorHandler),
    registry.deleteClinicalHandoff as unknown as Handler
  );

  // createBehavioralHealthPlan
  app.post('/healthcare/clinical/hospital/behavioral-health-plans',
    zValidator('json', validators.CreateBehavioralHealthPlanBody, validationErrorHandler),
    registry.createBehavioralHealthPlan as unknown as Handler
  );

  // searchBehavioralHealthPlans
  app.get('/healthcare/clinical/hospital/behavioral-health-plans/search',
    zValidator('query', validators.SearchBehavioralHealthPlansQuery, validationErrorHandler),
    registry.searchBehavioralHealthPlans as unknown as Handler
  );

  // getBehavioralHealthPlan
  app.get('/healthcare/clinical/hospital/behavioral-health-plans/:id',
    zValidator('param', validators.GetBehavioralHealthPlanParams, validationErrorHandler),
    registry.getBehavioralHealthPlan as unknown as Handler
  );

  // updateBehavioralHealthPlan
  app.put('/healthcare/clinical/hospital/behavioral-health-plans/:id',
    zValidator('param', validators.UpdateBehavioralHealthPlanParams, validationErrorHandler),
    zValidator('json', validators.UpdateBehavioralHealthPlanBody, validationErrorHandler),
    registry.updateBehavioralHealthPlan as unknown as Handler
  );

  // deleteBehavioralHealthPlan
  app.delete('/healthcare/clinical/hospital/behavioral-health-plans/:id',
    zValidator('param', validators.DeleteBehavioralHealthPlanParams, validationErrorHandler),
    registry.deleteBehavioralHealthPlan as unknown as Handler
  );

  // createCancerDiagnosis
  app.post('/healthcare/clinical/hospital/cancer-diagnoses',
    zValidator('json', validators.CreateCancerDiagnosisBody, validationErrorHandler),
    registry.createCancerDiagnosis as unknown as Handler
  );

  // searchCancerDiagnoses
  app.get('/healthcare/clinical/hospital/cancer-diagnoses/search',
    zValidator('query', validators.SearchCancerDiagnosesQuery, validationErrorHandler),
    registry.searchCancerDiagnoses as unknown as Handler
  );

  // getCancerDiagnosis
  app.get('/healthcare/clinical/hospital/cancer-diagnoses/:id',
    zValidator('param', validators.GetCancerDiagnosisParams, validationErrorHandler),
    registry.getCancerDiagnosis as unknown as Handler
  );

  // updateCancerDiagnosis
  app.put('/healthcare/clinical/hospital/cancer-diagnoses/:id',
    zValidator('param', validators.UpdateCancerDiagnosisParams, validationErrorHandler),
    zValidator('json', validators.UpdateCancerDiagnosisBody, validationErrorHandler),
    registry.updateCancerDiagnosis as unknown as Handler
  );

  // deleteCancerDiagnosis
  app.delete('/healthcare/clinical/hospital/cancer-diagnoses/:id',
    zValidator('param', validators.DeleteCancerDiagnosisParams, validationErrorHandler),
    registry.deleteCancerDiagnosis as unknown as Handler
  );

  // createCardiacRehab
  app.post('/healthcare/clinical/hospital/cardiology/cardiac-rehab',
    zValidator('json', validators.CreateCardiacRehabBody, validationErrorHandler),
    registry.createCardiacRehab as unknown as Handler
  );

  // searchCardiacRehabs
  app.get('/healthcare/clinical/hospital/cardiology/cardiac-rehab/search',
    zValidator('query', validators.SearchCardiacRehabsQuery, validationErrorHandler),
    registry.searchCardiacRehabs as unknown as Handler
  );

  // getCardiacRehab
  app.get('/healthcare/clinical/hospital/cardiology/cardiac-rehab/:id',
    zValidator('param', validators.GetCardiacRehabParams, validationErrorHandler),
    registry.getCardiacRehab as unknown as Handler
  );

  // updateCardiacRehab
  app.put('/healthcare/clinical/hospital/cardiology/cardiac-rehab/:id',
    zValidator('param', validators.UpdateCardiacRehabParams, validationErrorHandler),
    zValidator('json', validators.UpdateCardiacRehabBody, validationErrorHandler),
    registry.updateCardiacRehab as unknown as Handler
  );

  // deleteCardiacRehab
  app.delete('/healthcare/clinical/hospital/cardiology/cardiac-rehab/:id',
    zValidator('param', validators.DeleteCardiacRehabParams, validationErrorHandler),
    registry.deleteCardiacRehab as unknown as Handler
  );

  // createCardiacCathRecord
  app.post('/healthcare/clinical/hospital/cardiology/cath-records',
    zValidator('json', validators.CreateCardiacCathRecordBody, validationErrorHandler),
    registry.createCardiacCathRecord as unknown as Handler
  );

  // searchCardiacCathRecords
  app.get('/healthcare/clinical/hospital/cardiology/cath-records/search',
    zValidator('query', validators.SearchCardiacCathRecordsQuery, validationErrorHandler),
    registry.searchCardiacCathRecords as unknown as Handler
  );

  // getCardiacCathRecord
  app.get('/healthcare/clinical/hospital/cardiology/cath-records/:id',
    zValidator('param', validators.GetCardiacCathRecordParams, validationErrorHandler),
    registry.getCardiacCathRecord as unknown as Handler
  );

  // updateCardiacCathRecord
  app.put('/healthcare/clinical/hospital/cardiology/cath-records/:id',
    zValidator('param', validators.UpdateCardiacCathRecordParams, validationErrorHandler),
    zValidator('json', validators.UpdateCardiacCathRecordBody, validationErrorHandler),
    registry.updateCardiacCathRecord as unknown as Handler
  );

  // deleteCardiacCathRecord
  app.delete('/healthcare/clinical/hospital/cardiology/cath-records/:id',
    zValidator('param', validators.DeleteCardiacCathRecordParams, validationErrorHandler),
    registry.deleteCardiacCathRecord as unknown as Handler
  );

  // createEchoReport
  app.post('/healthcare/clinical/hospital/cardiology/echo-reports',
    zValidator('json', validators.CreateEchoReportBody, validationErrorHandler),
    registry.createEchoReport as unknown as Handler
  );

  // searchEchoReports
  app.get('/healthcare/clinical/hospital/cardiology/echo-reports/search',
    zValidator('query', validators.SearchEchoReportsQuery, validationErrorHandler),
    registry.searchEchoReports as unknown as Handler
  );

  // getEchoReport
  app.get('/healthcare/clinical/hospital/cardiology/echo-reports/:id',
    zValidator('param', validators.GetEchoReportParams, validationErrorHandler),
    registry.getEchoReport as unknown as Handler
  );

  // updateEchoReport
  app.put('/healthcare/clinical/hospital/cardiology/echo-reports/:id',
    zValidator('param', validators.UpdateEchoReportParams, validationErrorHandler),
    zValidator('json', validators.UpdateEchoReportBody, validationErrorHandler),
    registry.updateEchoReport as unknown as Handler
  );

  // deleteEchoReport
  app.delete('/healthcare/clinical/hospital/cardiology/echo-reports/:id',
    zValidator('param', validators.DeleteEchoReportParams, validationErrorHandler),
    registry.deleteEchoReport as unknown as Handler
  );

  // createEPStudy
  app.post('/healthcare/clinical/hospital/cardiology/ep-studies',
    zValidator('json', validators.CreateEPStudyBody, validationErrorHandler),
    registry.createEPStudy as unknown as Handler
  );

  // searchEPStudies
  app.get('/healthcare/clinical/hospital/cardiology/ep-studies/search',
    zValidator('query', validators.SearchEPStudiesQuery, validationErrorHandler),
    registry.searchEPStudies as unknown as Handler
  );

  // getEPStudy
  app.get('/healthcare/clinical/hospital/cardiology/ep-studies/:id',
    zValidator('param', validators.GetEPStudyParams, validationErrorHandler),
    registry.getEPStudy as unknown as Handler
  );

  // updateEPStudy
  app.put('/healthcare/clinical/hospital/cardiology/ep-studies/:id',
    zValidator('param', validators.UpdateEPStudyParams, validationErrorHandler),
    zValidator('json', validators.UpdateEPStudyBody, validationErrorHandler),
    registry.updateEPStudy as unknown as Handler
  );

  // deleteEPStudy
  app.delete('/healthcare/clinical/hospital/cardiology/ep-studies/:id',
    zValidator('param', validators.DeleteEPStudyParams, validationErrorHandler),
    registry.deleteEPStudy as unknown as Handler
  );

  // createChemotherapyCycle
  app.post('/healthcare/clinical/hospital/chemo-cycles',
    zValidator('json', validators.CreateChemotherapyCycleBody, validationErrorHandler),
    registry.createChemotherapyCycle as unknown as Handler
  );

  // searchChemotherapyCycles
  app.get('/healthcare/clinical/hospital/chemo-cycles/search',
    zValidator('query', validators.SearchChemotherapyCyclesQuery, validationErrorHandler),
    registry.searchChemotherapyCycles as unknown as Handler
  );

  // getChemotherapyCycle
  app.get('/healthcare/clinical/hospital/chemo-cycles/:id',
    zValidator('param', validators.GetChemotherapyCycleParams, validationErrorHandler),
    registry.getChemotherapyCycle as unknown as Handler
  );

  // updateChemotherapyCycle
  app.put('/healthcare/clinical/hospital/chemo-cycles/:id',
    zValidator('param', validators.UpdateChemotherapyCycleParams, validationErrorHandler),
    zValidator('json', validators.UpdateChemotherapyCycleBody, validationErrorHandler),
    registry.updateChemotherapyCycle as unknown as Handler
  );

  // deleteChemotherapyCycle
  app.delete('/healthcare/clinical/hospital/chemo-cycles/:id',
    zValidator('param', validators.DeleteChemotherapyCycleParams, validationErrorHandler),
    registry.deleteChemotherapyCycle as unknown as Handler
  );

  // createChemotherapyProtocol
  app.post('/healthcare/clinical/hospital/chemo-protocols',
    zValidator('json', validators.CreateChemotherapyProtocolBody, validationErrorHandler),
    registry.createChemotherapyProtocol as unknown as Handler
  );

  // searchChemotherapyProtocols
  app.get('/healthcare/clinical/hospital/chemo-protocols/search',
    zValidator('query', validators.SearchChemotherapyProtocolsQuery, validationErrorHandler),
    registry.searchChemotherapyProtocols as unknown as Handler
  );

  // getChemotherapyProtocol
  app.get('/healthcare/clinical/hospital/chemo-protocols/:id',
    zValidator('param', validators.GetChemotherapyProtocolParams, validationErrorHandler),
    registry.getChemotherapyProtocol as unknown as Handler
  );

  // updateChemotherapyProtocol
  app.put('/healthcare/clinical/hospital/chemo-protocols/:id',
    zValidator('param', validators.UpdateChemotherapyProtocolParams, validationErrorHandler),
    zValidator('json', validators.UpdateChemotherapyProtocolBody, validationErrorHandler),
    registry.updateChemotherapyProtocol as unknown as Handler
  );

  // deleteChemotherapyProtocol
  app.delete('/healthcare/clinical/hospital/chemo-protocols/:id',
    zValidator('param', validators.DeleteChemotherapyProtocolParams, validationErrorHandler),
    registry.deleteChemotherapyProtocol as unknown as Handler
  );

  // createCodeBlueDebrief
  app.post('/healthcare/clinical/hospital/code-blue-debriefs',
    zValidator('json', validators.CreateCodeBlueDebriefBody, validationErrorHandler),
    registry.createCodeBlueDebrief as unknown as Handler
  );

  // searchCodeBlueDebriefs
  app.get('/healthcare/clinical/hospital/code-blue-debriefs/search',
    zValidator('query', validators.SearchCodeBlueDebriefsQuery, validationErrorHandler),
    registry.searchCodeBlueDebriefs as unknown as Handler
  );

  // getCodeBlueDebrief
  app.get('/healthcare/clinical/hospital/code-blue-debriefs/:id',
    zValidator('param', validators.GetCodeBlueDebriefParams, validationErrorHandler),
    registry.getCodeBlueDebrief as unknown as Handler
  );

  // updateCodeBlueDebrief
  app.put('/healthcare/clinical/hospital/code-blue-debriefs/:id',
    zValidator('param', validators.UpdateCodeBlueDebriefParams, validationErrorHandler),
    zValidator('json', validators.UpdateCodeBlueDebriefBody, validationErrorHandler),
    registry.updateCodeBlueDebrief as unknown as Handler
  );

  // deleteCodeBlueDebrief
  app.delete('/healthcare/clinical/hospital/code-blue-debriefs/:id',
    zValidator('param', validators.DeleteCodeBlueDebriefParams, validationErrorHandler),
    registry.deleteCodeBlueDebrief as unknown as Handler
  );

  // createCodeBlueEvent
  app.post('/healthcare/clinical/hospital/code-blue-events',
    zValidator('json', validators.CreateCodeBlueEventBody, validationErrorHandler),
    registry.createCodeBlueEvent as unknown as Handler
  );

  // getActiveCodeBlueEvents
  app.get('/healthcare/clinical/hospital/code-blue-events/active',
    zValidator('query', validators.GetActiveCodeBlueEventsQuery, validationErrorHandler),
    registry.getActiveCodeBlueEvents as unknown as Handler
  );

  // searchCodeBlueEvents
  app.get('/healthcare/clinical/hospital/code-blue-events/search',
    zValidator('query', validators.SearchCodeBlueEventsQuery, validationErrorHandler),
    registry.searchCodeBlueEvents as unknown as Handler
  );

  // getCodeBlueEvent
  app.get('/healthcare/clinical/hospital/code-blue-events/:id',
    zValidator('param', validators.GetCodeBlueEventParams, validationErrorHandler),
    registry.getCodeBlueEvent as unknown as Handler
  );

  // updateCodeBlueEvent
  app.put('/healthcare/clinical/hospital/code-blue-events/:id',
    zValidator('param', validators.UpdateCodeBlueEventParams, validationErrorHandler),
    zValidator('json', validators.UpdateCodeBlueEventBody, validationErrorHandler),
    registry.updateCodeBlueEvent as unknown as Handler
  );

  // patchCodeBlueEvent
  app.patch('/healthcare/clinical/hospital/code-blue-events/:id',
    zValidator('param', validators.PatchCodeBlueEventParams, validationErrorHandler),
    zValidator('json', validators.PatchCodeBlueEventBody, validationErrorHandler),
    registry.patchCodeBlueEvent as unknown as Handler
  );

  // deleteCodeBlueEvent
  app.delete('/healthcare/clinical/hospital/code-blue-events/:id',
    zValidator('param', validators.DeleteCodeBlueEventParams, validationErrorHandler),
    registry.deleteCodeBlueEvent as unknown as Handler
  );

  // createCodeBlueTeamRoster
  app.post('/healthcare/clinical/hospital/code-blue-teams',
    zValidator('json', validators.CreateCodeBlueTeamRosterBody, validationErrorHandler),
    registry.createCodeBlueTeamRoster as unknown as Handler
  );

  // getCodeBlueTeamRoster
  app.get('/healthcare/clinical/hospital/code-blue-teams/:id',
    zValidator('param', validators.GetCodeBlueTeamRosterParams, validationErrorHandler),
    registry.getCodeBlueTeamRoster as unknown as Handler
  );

  // updateCodeBlueTeamRoster
  app.put('/healthcare/clinical/hospital/code-blue-teams/:id',
    zValidator('param', validators.UpdateCodeBlueTeamRosterParams, validationErrorHandler),
    zValidator('json', validators.UpdateCodeBlueTeamRosterBody, validationErrorHandler),
    registry.updateCodeBlueTeamRoster as unknown as Handler
  );

  // patchCodeBlueTeamRoster
  app.patch('/healthcare/clinical/hospital/code-blue-teams/:id',
    zValidator('param', validators.PatchCodeBlueTeamRosterParams, validationErrorHandler),
    zValidator('json', validators.PatchCodeBlueTeamRosterBody, validationErrorHandler),
    registry.patchCodeBlueTeamRoster as unknown as Handler
  );

  // deleteCodeBlueTeamRoster
  app.delete('/healthcare/clinical/hospital/code-blue-teams/:id',
    zValidator('param', validators.DeleteCodeBlueTeamRosterParams, validationErrorHandler),
    registry.deleteCodeBlueTeamRoster as unknown as Handler
  );

  // createDialysisAccessRecord
  app.post('/healthcare/clinical/hospital/dialysis-access',
    zValidator('json', validators.CreateDialysisAccessRecordBody, validationErrorHandler),
    registry.createDialysisAccessRecord as unknown as Handler
  );

  // searchDialysisAccessRecords
  app.get('/healthcare/clinical/hospital/dialysis-access/search',
    zValidator('query', validators.SearchDialysisAccessRecordsQuery, validationErrorHandler),
    registry.searchDialysisAccessRecords as unknown as Handler
  );

  // getDialysisAccessRecord
  app.get('/healthcare/clinical/hospital/dialysis-access/:id',
    zValidator('param', validators.GetDialysisAccessRecordParams, validationErrorHandler),
    registry.getDialysisAccessRecord as unknown as Handler
  );

  // updateDialysisAccessRecord
  app.put('/healthcare/clinical/hospital/dialysis-access/:id',
    zValidator('param', validators.UpdateDialysisAccessRecordParams, validationErrorHandler),
    zValidator('json', validators.UpdateDialysisAccessRecordBody, validationErrorHandler),
    registry.updateDialysisAccessRecord as unknown as Handler
  );

  // deleteDialysisAccessRecord
  app.delete('/healthcare/clinical/hospital/dialysis-access/:id',
    zValidator('param', validators.DeleteDialysisAccessRecordParams, validationErrorHandler),
    registry.deleteDialysisAccessRecord as unknown as Handler
  );

  // createDialysisOrder
  app.post('/healthcare/clinical/hospital/dialysis-orders',
    zValidator('json', validators.CreateDialysisOrderBody, validationErrorHandler),
    registry.createDialysisOrder as unknown as Handler
  );

  // searchDialysisOrders
  app.get('/healthcare/clinical/hospital/dialysis-orders/search',
    zValidator('query', validators.SearchDialysisOrdersQuery, validationErrorHandler),
    registry.searchDialysisOrders as unknown as Handler
  );

  // getDialysisOrder
  app.get('/healthcare/clinical/hospital/dialysis-orders/:id',
    zValidator('param', validators.GetDialysisOrderParams, validationErrorHandler),
    registry.getDialysisOrder as unknown as Handler
  );

  // updateDialysisOrder
  app.put('/healthcare/clinical/hospital/dialysis-orders/:id',
    zValidator('param', validators.UpdateDialysisOrderParams, validationErrorHandler),
    zValidator('json', validators.UpdateDialysisOrderBody, validationErrorHandler),
    registry.updateDialysisOrder as unknown as Handler
  );

  // deleteDialysisOrder
  app.delete('/healthcare/clinical/hospital/dialysis-orders/:id',
    zValidator('param', validators.DeleteDialysisOrderParams, validationErrorHandler),
    registry.deleteDialysisOrder as unknown as Handler
  );

  // createDialysisSession
  app.post('/healthcare/clinical/hospital/dialysis-sessions',
    zValidator('json', validators.CreateDialysisSessionBody, validationErrorHandler),
    registry.createDialysisSession as unknown as Handler
  );

  // searchDialysisSessions
  app.get('/healthcare/clinical/hospital/dialysis-sessions/search',
    zValidator('query', validators.SearchDialysisSessionsQuery, validationErrorHandler),
    registry.searchDialysisSessions as unknown as Handler
  );

  // getDialysisSession
  app.get('/healthcare/clinical/hospital/dialysis-sessions/:id',
    zValidator('param', validators.GetDialysisSessionParams, validationErrorHandler),
    registry.getDialysisSession as unknown as Handler
  );

  // updateDialysisSession
  app.put('/healthcare/clinical/hospital/dialysis-sessions/:id',
    zValidator('param', validators.UpdateDialysisSessionParams, validationErrorHandler),
    zValidator('json', validators.UpdateDialysisSessionBody, validationErrorHandler),
    registry.updateDialysisSession as unknown as Handler
  );

  // deleteDialysisSession
  app.delete('/healthcare/clinical/hospital/dialysis-sessions/:id',
    zValidator('param', validators.DeleteDialysisSessionParams, validationErrorHandler),
    registry.deleteDialysisSession as unknown as Handler
  );

  // getEDBoard
  app.get('/healthcare/clinical/hospital/ed-board',
    registry.getEDBoard as unknown as Handler
  );

  // createEDVisit
  app.post('/healthcare/clinical/hospital/ed-visits',
    zValidator('json', validators.CreateEDVisitBody, validationErrorHandler),
    registry.createEDVisit as unknown as Handler
  );

  // searchEDVisits
  app.get('/healthcare/clinical/hospital/ed-visits/search',
    zValidator('query', validators.SearchEDVisitsQuery, validationErrorHandler),
    registry.searchEDVisits as unknown as Handler
  );

  // getEDVisit
  app.get('/healthcare/clinical/hospital/ed-visits/:id',
    zValidator('param', validators.GetEDVisitParams, validationErrorHandler),
    registry.getEDVisit as unknown as Handler
  );

  // updateEDVisit
  app.put('/healthcare/clinical/hospital/ed-visits/:id',
    zValidator('param', validators.UpdateEDVisitParams, validationErrorHandler),
    zValidator('json', validators.UpdateEDVisitBody, validationErrorHandler),
    registry.updateEDVisit as unknown as Handler
  );

  // patchEDVisit
  app.patch('/healthcare/clinical/hospital/ed-visits/:id',
    zValidator('param', validators.PatchEDVisitParams, validationErrorHandler),
    zValidator('json', validators.PatchEDVisitBody, validationErrorHandler),
    registry.patchEDVisit as unknown as Handler
  );

  // deleteEDVisit
  app.delete('/healthcare/clinical/hospital/ed-visits/:id',
    zValidator('param', validators.DeleteEDVisitParams, validationErrorHandler),
    registry.deleteEDVisit as unknown as Handler
  );

  // createFallRiskAssessment
  app.post('/healthcare/clinical/hospital/fall-risk',
    zValidator('json', validators.CreateFallRiskAssessmentBody, validationErrorHandler),
    registry.createFallRiskAssessment as unknown as Handler
  );

  // searchFallRiskAssessments
  app.get('/healthcare/clinical/hospital/fall-risk/search',
    zValidator('query', validators.SearchFallRiskAssessmentsQuery, validationErrorHandler),
    registry.searchFallRiskAssessments as unknown as Handler
  );

  // getFallRiskAssessment
  app.get('/healthcare/clinical/hospital/fall-risk/:id',
    zValidator('param', validators.GetFallRiskAssessmentParams, validationErrorHandler),
    registry.getFallRiskAssessment as unknown as Handler
  );

  // updateFallRiskAssessment
  app.put('/healthcare/clinical/hospital/fall-risk/:id',
    zValidator('param', validators.UpdateFallRiskAssessmentParams, validationErrorHandler),
    zValidator('json', validators.UpdateFallRiskAssessmentBody, validationErrorHandler),
    registry.updateFallRiskAssessment as unknown as Handler
  );

  // deleteFallRiskAssessment
  app.delete('/healthcare/clinical/hospital/fall-risk/:id',
    zValidator('param', validators.DeleteFallRiskAssessmentParams, validationErrorHandler),
    registry.deleteFallRiskAssessment as unknown as Handler
  );

  // createFlowsheetEntry
  app.post('/healthcare/clinical/hospital/flowsheets',
    zValidator('json', validators.CreateFlowsheetEntryBody, validationErrorHandler),
    registry.createFlowsheetEntry as unknown as Handler
  );

  // searchFlowsheetEntries
  app.get('/healthcare/clinical/hospital/flowsheets/search',
    zValidator('query', validators.SearchFlowsheetEntriesQuery, validationErrorHandler),
    registry.searchFlowsheetEntries as unknown as Handler
  );

  // getFlowsheetEntry
  app.get('/healthcare/clinical/hospital/flowsheets/:id',
    zValidator('param', validators.GetFlowsheetEntryParams, validationErrorHandler),
    registry.getFlowsheetEntry as unknown as Handler
  );

  // updateFlowsheetEntry
  app.put('/healthcare/clinical/hospital/flowsheets/:id',
    zValidator('param', validators.UpdateFlowsheetEntryParams, validationErrorHandler),
    zValidator('json', validators.UpdateFlowsheetEntryBody, validationErrorHandler),
    registry.updateFlowsheetEntry as unknown as Handler
  );

  // deleteFlowsheetEntry
  app.delete('/healthcare/clinical/hospital/flowsheets/:id',
    zValidator('param', validators.DeleteFlowsheetEntryParams, validationErrorHandler),
    registry.deleteFlowsheetEntry as unknown as Handler
  );

  // createICUAdmission
  app.post('/healthcare/clinical/hospital/icu-admissions',
    zValidator('json', validators.CreateICUAdmissionBody, validationErrorHandler),
    registry.createICUAdmission as unknown as Handler
  );

  // searchICUAdmissions
  app.get('/healthcare/clinical/hospital/icu-admissions/search',
    zValidator('query', validators.SearchICUAdmissionsQuery, validationErrorHandler),
    registry.searchICUAdmissions as unknown as Handler
  );

  // getICUAdmission
  app.get('/healthcare/clinical/hospital/icu-admissions/:id',
    zValidator('param', validators.GetICUAdmissionParams, validationErrorHandler),
    registry.getICUAdmission as unknown as Handler
  );

  // updateICUAdmission
  app.put('/healthcare/clinical/hospital/icu-admissions/:id',
    zValidator('param', validators.UpdateICUAdmissionParams, validationErrorHandler),
    zValidator('json', validators.UpdateICUAdmissionBody, validationErrorHandler),
    registry.updateICUAdmission as unknown as Handler
  );

  // deleteICUAdmission
  app.delete('/healthcare/clinical/hospital/icu-admissions/:id',
    zValidator('param', validators.DeleteICUAdmissionParams, validationErrorHandler),
    registry.deleteICUAdmission as unknown as Handler
  );

  // transitionICUAdmissionStatus
  app.post('/healthcare/clinical/hospital/icu-admissions/:id/status',
    zValidator('param', validators.TransitionICUAdmissionStatusParams, validationErrorHandler),
    zValidator('json', validators.TransitionICUAdmissionStatusBody, validationErrorHandler),
    registry.transitionICUAdmissionStatus as unknown as Handler
  );

  // createInvoluntaryHold
  app.post('/healthcare/clinical/hospital/involuntary-holds',
    zValidator('json', validators.CreateInvoluntaryHoldBody, validationErrorHandler),
    registry.createInvoluntaryHold as unknown as Handler
  );

  // searchInvoluntaryHolds
  app.get('/healthcare/clinical/hospital/involuntary-holds/search',
    zValidator('query', validators.SearchInvoluntaryHoldsQuery, validationErrorHandler),
    registry.searchInvoluntaryHolds as unknown as Handler
  );

  // getInvoluntaryHold
  app.get('/healthcare/clinical/hospital/involuntary-holds/:id',
    zValidator('param', validators.GetInvoluntaryHoldParams, validationErrorHandler),
    registry.getInvoluntaryHold as unknown as Handler
  );

  // updateInvoluntaryHold
  app.put('/healthcare/clinical/hospital/involuntary-holds/:id',
    zValidator('param', validators.UpdateInvoluntaryHoldParams, validationErrorHandler),
    zValidator('json', validators.UpdateInvoluntaryHoldBody, validationErrorHandler),
    registry.updateInvoluntaryHold as unknown as Handler
  );

  // deleteInvoluntaryHold
  app.delete('/healthcare/clinical/hospital/involuntary-holds/:id',
    zValidator('param', validators.DeleteInvoluntaryHoldParams, validationErrorHandler),
    registry.deleteInvoluntaryHold as unknown as Handler
  );

  // createLaborRecord
  app.post('/healthcare/clinical/hospital/labor-records',
    zValidator('json', validators.CreateLaborRecordBody, validationErrorHandler),
    registry.createLaborRecord as unknown as Handler
  );

  // searchLaborRecords
  app.get('/healthcare/clinical/hospital/labor-records/search',
    zValidator('query', validators.SearchLaborRecordsQuery, validationErrorHandler),
    registry.searchLaborRecords as unknown as Handler
  );

  // getLaborRecord
  app.get('/healthcare/clinical/hospital/labor-records/:id',
    zValidator('param', validators.GetLaborRecordParams, validationErrorHandler),
    registry.getLaborRecord as unknown as Handler
  );

  // updateLaborRecord
  app.put('/healthcare/clinical/hospital/labor-records/:id',
    zValidator('param', validators.UpdateLaborRecordParams, validationErrorHandler),
    zValidator('json', validators.UpdateLaborRecordBody, validationErrorHandler),
    registry.updateLaborRecord as unknown as Handler
  );

  // deleteLaborRecord
  app.delete('/healthcare/clinical/hospital/labor-records/:id',
    zValidator('param', validators.DeleteLaborRecordParams, validationErrorHandler),
    registry.deleteLaborRecord as unknown as Handler
  );

  // createNICUAdmission
  app.post('/healthcare/clinical/hospital/neonatal/admissions',
    zValidator('json', validators.CreateNICUAdmissionBody, validationErrorHandler),
    registry.createNICUAdmission as unknown as Handler
  );

  // searchNICUAdmissions
  app.get('/healthcare/clinical/hospital/neonatal/admissions/search',
    zValidator('query', validators.SearchNICUAdmissionsQuery, validationErrorHandler),
    registry.searchNICUAdmissions as unknown as Handler
  );

  // getNICUAdmission
  app.get('/healthcare/clinical/hospital/neonatal/admissions/:id',
    zValidator('param', validators.GetNICUAdmissionParams, validationErrorHandler),
    registry.getNICUAdmission as unknown as Handler
  );

  // updateNICUAdmission
  app.put('/healthcare/clinical/hospital/neonatal/admissions/:id',
    zValidator('param', validators.UpdateNICUAdmissionParams, validationErrorHandler),
    zValidator('json', validators.UpdateNICUAdmissionBody, validationErrorHandler),
    registry.updateNICUAdmission as unknown as Handler
  );

  // deleteNICUAdmission
  app.delete('/healthcare/clinical/hospital/neonatal/admissions/:id',
    zValidator('param', validators.DeleteNICUAdmissionParams, validationErrorHandler),
    registry.deleteNICUAdmission as unknown as Handler
  );

  // createFeedingRecord
  app.post('/healthcare/clinical/hospital/neonatal/feeding-records',
    zValidator('json', validators.CreateFeedingRecordBody, validationErrorHandler),
    registry.createFeedingRecord as unknown as Handler
  );

  // searchFeedingRecords
  app.get('/healthcare/clinical/hospital/neonatal/feeding-records/search',
    zValidator('query', validators.SearchFeedingRecordsQuery, validationErrorHandler),
    registry.searchFeedingRecords as unknown as Handler
  );

  // getFeedingRecord
  app.get('/healthcare/clinical/hospital/neonatal/feeding-records/:id',
    zValidator('param', validators.GetFeedingRecordParams, validationErrorHandler),
    registry.getFeedingRecord as unknown as Handler
  );

  // updateFeedingRecord
  app.put('/healthcare/clinical/hospital/neonatal/feeding-records/:id',
    zValidator('param', validators.UpdateFeedingRecordParams, validationErrorHandler),
    zValidator('json', validators.UpdateFeedingRecordBody, validationErrorHandler),
    registry.updateFeedingRecord as unknown as Handler
  );

  // deleteFeedingRecord
  app.delete('/healthcare/clinical/hospital/neonatal/feeding-records/:id',
    zValidator('param', validators.DeleteFeedingRecordParams, validationErrorHandler),
    registry.deleteFeedingRecord as unknown as Handler
  );

  // createNewbornScreening
  app.post('/healthcare/clinical/hospital/neonatal/newborn-screening',
    zValidator('json', validators.CreateNewbornScreeningBody, validationErrorHandler),
    registry.createNewbornScreening as unknown as Handler
  );

  // searchNewbornScreenings
  app.get('/healthcare/clinical/hospital/neonatal/newborn-screening/search',
    zValidator('query', validators.SearchNewbornScreeningsQuery, validationErrorHandler),
    registry.searchNewbornScreenings as unknown as Handler
  );

  // getNewbornScreening
  app.get('/healthcare/clinical/hospital/neonatal/newborn-screening/:id',
    zValidator('param', validators.GetNewbornScreeningParams, validationErrorHandler),
    registry.getNewbornScreening as unknown as Handler
  );

  // updateNewbornScreening
  app.put('/healthcare/clinical/hospital/neonatal/newborn-screening/:id',
    zValidator('param', validators.UpdateNewbornScreeningParams, validationErrorHandler),
    zValidator('json', validators.UpdateNewbornScreeningBody, validationErrorHandler),
    registry.updateNewbornScreening as unknown as Handler
  );

  // deleteNewbornScreening
  app.delete('/healthcare/clinical/hospital/neonatal/newborn-screening/:id',
    zValidator('param', validators.DeleteNewbornScreeningParams, validationErrorHandler),
    registry.deleteNewbornScreening as unknown as Handler
  );

  // createNeonatalVitals
  app.post('/healthcare/clinical/hospital/neonatal/vitals',
    zValidator('json', validators.CreateNeonatalVitalsBody, validationErrorHandler),
    registry.createNeonatalVitals as unknown as Handler
  );

  // searchNeonatalVitals
  app.get('/healthcare/clinical/hospital/neonatal/vitals/search',
    zValidator('query', validators.SearchNeonatalVitalsQuery, validationErrorHandler),
    registry.searchNeonatalVitals as unknown as Handler
  );

  // getNeonatalVitals
  app.get('/healthcare/clinical/hospital/neonatal/vitals/:id',
    zValidator('param', validators.GetNeonatalVitalsParams, validationErrorHandler),
    registry.getNeonatalVitals as unknown as Handler
  );

  // updateNeonatalVitals
  app.put('/healthcare/clinical/hospital/neonatal/vitals/:id',
    zValidator('param', validators.UpdateNeonatalVitalsParams, validationErrorHandler),
    zValidator('json', validators.UpdateNeonatalVitalsBody, validationErrorHandler),
    registry.updateNeonatalVitals as unknown as Handler
  );

  // deleteNeonatalVitals
  app.delete('/healthcare/clinical/hospital/neonatal/vitals/:id',
    zValidator('param', validators.DeleteNeonatalVitalsParams, validationErrorHandler),
    registry.deleteNeonatalVitals as unknown as Handler
  );

  // createNewbornRecord
  app.post('/healthcare/clinical/hospital/newborns',
    zValidator('json', validators.CreateNewbornRecordBody, validationErrorHandler),
    registry.createNewbornRecord as unknown as Handler
  );

  // searchNewbornRecords
  app.get('/healthcare/clinical/hospital/newborns/search',
    zValidator('query', validators.SearchNewbornRecordsQuery, validationErrorHandler),
    registry.searchNewbornRecords as unknown as Handler
  );

  // getNewbornRecord
  app.get('/healthcare/clinical/hospital/newborns/:id',
    zValidator('param', validators.GetNewbornRecordParams, validationErrorHandler),
    registry.getNewbornRecord as unknown as Handler
  );

  // updateNewbornRecord
  app.put('/healthcare/clinical/hospital/newborns/:id',
    zValidator('param', validators.UpdateNewbornRecordParams, validationErrorHandler),
    zValidator('json', validators.UpdateNewbornRecordBody, validationErrorHandler),
    registry.updateNewbornRecord as unknown as Handler
  );

  // deleteNewbornRecord
  app.delete('/healthcare/clinical/hospital/newborns/:id',
    zValidator('param', validators.DeleteNewbornRecordParams, validationErrorHandler),
    registry.deleteNewbornRecord as unknown as Handler
  );

  // createNursingAssessment
  app.post('/healthcare/clinical/hospital/nursing-assessments',
    zValidator('json', validators.CreateNursingAssessmentBody, validationErrorHandler),
    registry.createNursingAssessment as unknown as Handler
  );

  // searchNursingAssessments
  app.get('/healthcare/clinical/hospital/nursing-assessments/search',
    zValidator('query', validators.SearchNursingAssessmentsQuery, validationErrorHandler),
    registry.searchNursingAssessments as unknown as Handler
  );

  // getNursingAssessment
  app.get('/healthcare/clinical/hospital/nursing-assessments/:id',
    zValidator('param', validators.GetNursingAssessmentParams, validationErrorHandler),
    registry.getNursingAssessment as unknown as Handler
  );

  // updateNursingAssessment
  app.put('/healthcare/clinical/hospital/nursing-assessments/:id',
    zValidator('param', validators.UpdateNursingAssessmentParams, validationErrorHandler),
    zValidator('json', validators.UpdateNursingAssessmentBody, validationErrorHandler),
    registry.updateNursingAssessment as unknown as Handler
  );

  // patchNursingAssessment
  app.patch('/healthcare/clinical/hospital/nursing-assessments/:id',
    zValidator('param', validators.PatchNursingAssessmentParams, validationErrorHandler),
    zValidator('json', validators.PatchNursingAssessmentBody, validationErrorHandler),
    registry.patchNursingAssessment as unknown as Handler
  );

  // deleteNursingAssessment
  app.delete('/healthcare/clinical/hospital/nursing-assessments/:id',
    zValidator('param', validators.DeleteNursingAssessmentParams, validationErrorHandler),
    registry.deleteNursingAssessment as unknown as Handler
  );

  // createOrderSet
  app.post('/healthcare/clinical/hospital/order-sets',
    zValidator('json', validators.CreateOrderSetBody, validationErrorHandler),
    registry.createOrderSet as unknown as Handler
  );

  // applyOrderSet
  app.post('/healthcare/clinical/hospital/order-sets/apply',
    zValidator('json', validators.ApplyOrderSetBody, validationErrorHandler),
    registry.applyOrderSet as unknown as Handler
  );

  // searchOrderSets
  app.get('/healthcare/clinical/hospital/order-sets/search',
    zValidator('query', validators.SearchOrderSetsQuery, validationErrorHandler),
    registry.searchOrderSets as unknown as Handler
  );

  // getOrderSet
  app.get('/healthcare/clinical/hospital/order-sets/:id',
    zValidator('param', validators.GetOrderSetParams, validationErrorHandler),
    registry.getOrderSet as unknown as Handler
  );

  // updateOrderSet
  app.put('/healthcare/clinical/hospital/order-sets/:id',
    zValidator('param', validators.UpdateOrderSetParams, validationErrorHandler),
    zValidator('json', validators.UpdateOrderSetBody, validationErrorHandler),
    registry.updateOrderSet as unknown as Handler
  );

  // deleteOrderSet
  app.delete('/healthcare/clinical/hospital/order-sets/:id',
    zValidator('param', validators.DeleteOrderSetParams, validationErrorHandler),
    registry.deleteOrderSet as unknown as Handler
  );

  // createOrderVerification
  app.post('/healthcare/clinical/hospital/order-verifications',
    zValidator('json', validators.CreateOrderVerificationBody, validationErrorHandler),
    registry.createOrderVerification as unknown as Handler
  );

  // searchOrderVerifications
  app.get('/healthcare/clinical/hospital/order-verifications/search',
    zValidator('query', validators.SearchOrderVerificationsQuery, validationErrorHandler),
    registry.searchOrderVerifications as unknown as Handler
  );

  // createClinicalOrder
  app.post('/healthcare/clinical/hospital/orders',
    zValidator('json', validators.CreateClinicalOrderBody, validationErrorHandler),
    registry.createClinicalOrder as unknown as Handler
  );

  // searchClinicalOrders
  app.get('/healthcare/clinical/hospital/orders/search',
    zValidator('query', validators.SearchClinicalOrdersQuery, validationErrorHandler),
    registry.searchClinicalOrders as unknown as Handler
  );

  // getClinicalOrder
  app.get('/healthcare/clinical/hospital/orders/:id',
    zValidator('param', validators.GetClinicalOrderParams, validationErrorHandler),
    registry.getClinicalOrder as unknown as Handler
  );

  // updateClinicalOrder
  app.put('/healthcare/clinical/hospital/orders/:id',
    zValidator('param', validators.UpdateClinicalOrderParams, validationErrorHandler),
    zValidator('json', validators.UpdateClinicalOrderBody, validationErrorHandler),
    registry.updateClinicalOrder as unknown as Handler
  );

  // patchClinicalOrder
  app.patch('/healthcare/clinical/hospital/orders/:id',
    zValidator('param', validators.PatchClinicalOrderParams, validationErrorHandler),
    zValidator('json', validators.PatchClinicalOrderBody, validationErrorHandler),
    registry.patchClinicalOrder as unknown as Handler
  );

  // deleteClinicalOrder
  app.delete('/healthcare/clinical/hospital/orders/:id',
    zValidator('param', validators.DeleteClinicalOrderParams, validationErrorHandler),
    registry.deleteClinicalOrder as unknown as Handler
  );

  // coSignClinicalOrder
  app.post('/healthcare/clinical/hospital/orders/:id/co-sign',
    zValidator('param', validators.CoSignClinicalOrderParams, validationErrorHandler),
    zValidator('json', validators.CoSignClinicalOrderBody, validationErrorHandler),
    registry.coSignClinicalOrder as unknown as Handler
  );

  // createPainAssessment
  app.post('/healthcare/clinical/hospital/pain-assessments',
    zValidator('json', validators.CreatePainAssessmentBody, validationErrorHandler),
    registry.createPainAssessment as unknown as Handler
  );

  // searchPainAssessments
  app.get('/healthcare/clinical/hospital/pain-assessments/search',
    zValidator('query', validators.SearchPainAssessmentsQuery, validationErrorHandler),
    registry.searchPainAssessments as unknown as Handler
  );

  // getPainAssessment
  app.get('/healthcare/clinical/hospital/pain-assessments/:id',
    zValidator('param', validators.GetPainAssessmentParams, validationErrorHandler),
    registry.getPainAssessment as unknown as Handler
  );

  // updatePainAssessment
  app.put('/healthcare/clinical/hospital/pain-assessments/:id',
    zValidator('param', validators.UpdatePainAssessmentParams, validationErrorHandler),
    zValidator('json', validators.UpdatePainAssessmentBody, validationErrorHandler),
    registry.updatePainAssessment as unknown as Handler
  );

  // deletePainAssessment
  app.delete('/healthcare/clinical/hospital/pain-assessments/:id',
    zValidator('param', validators.DeletePainAssessmentParams, validationErrorHandler),
    registry.deletePainAssessment as unknown as Handler
  );

  // createGoalsOfCareDiscussion
  app.post('/healthcare/clinical/hospital/palliative/goals-of-care',
    zValidator('json', validators.CreateGoalsOfCareDiscussionBody, validationErrorHandler),
    registry.createGoalsOfCareDiscussion as unknown as Handler
  );

  // searchGoalsOfCareDiscussions
  app.get('/healthcare/clinical/hospital/palliative/goals-of-care/search',
    zValidator('query', validators.SearchGoalsOfCareDiscussionsQuery, validationErrorHandler),
    registry.searchGoalsOfCareDiscussions as unknown as Handler
  );

  // getGoalsOfCareDiscussion
  app.get('/healthcare/clinical/hospital/palliative/goals-of-care/:id',
    zValidator('param', validators.GetGoalsOfCareDiscussionParams, validationErrorHandler),
    registry.getGoalsOfCareDiscussion as unknown as Handler
  );

  // updateGoalsOfCareDiscussion
  app.put('/healthcare/clinical/hospital/palliative/goals-of-care/:id',
    zValidator('param', validators.UpdateGoalsOfCareDiscussionParams, validationErrorHandler),
    zValidator('json', validators.UpdateGoalsOfCareDiscussionBody, validationErrorHandler),
    registry.updateGoalsOfCareDiscussion as unknown as Handler
  );

  // deleteGoalsOfCareDiscussion
  app.delete('/healthcare/clinical/hospital/palliative/goals-of-care/:id',
    zValidator('param', validators.DeleteGoalsOfCareDiscussionParams, validationErrorHandler),
    registry.deleteGoalsOfCareDiscussion as unknown as Handler
  );

  // createHospiceEligibility
  app.post('/healthcare/clinical/hospital/palliative/hospice-eligibility',
    zValidator('json', validators.CreateHospiceEligibilityBody, validationErrorHandler),
    registry.createHospiceEligibility as unknown as Handler
  );

  // searchHospiceEligibilities
  app.get('/healthcare/clinical/hospital/palliative/hospice-eligibility/search',
    zValidator('query', validators.SearchHospiceEligibilitiesQuery, validationErrorHandler),
    registry.searchHospiceEligibilities as unknown as Handler
  );

  // getHospiceEligibility
  app.get('/healthcare/clinical/hospital/palliative/hospice-eligibility/:id',
    zValidator('param', validators.GetHospiceEligibilityParams, validationErrorHandler),
    registry.getHospiceEligibility as unknown as Handler
  );

  // updateHospiceEligibility
  app.put('/healthcare/clinical/hospital/palliative/hospice-eligibility/:id',
    zValidator('param', validators.UpdateHospiceEligibilityParams, validationErrorHandler),
    zValidator('json', validators.UpdateHospiceEligibilityBody, validationErrorHandler),
    registry.updateHospiceEligibility as unknown as Handler
  );

  // deleteHospiceEligibility
  app.delete('/healthcare/clinical/hospital/palliative/hospice-eligibility/:id',
    zValidator('param', validators.DeleteHospiceEligibilityParams, validationErrorHandler),
    registry.deleteHospiceEligibility as unknown as Handler
  );

  // createHospiceIDTMeeting
  app.post('/healthcare/clinical/hospital/palliative/hospice-idt',
    zValidator('json', validators.CreateHospiceIDTMeetingBody, validationErrorHandler),
    registry.createHospiceIDTMeeting as unknown as Handler
  );

  // searchHospiceIDTMeetings
  app.get('/healthcare/clinical/hospital/palliative/hospice-idt/search',
    zValidator('query', validators.SearchHospiceIDTMeetingsQuery, validationErrorHandler),
    registry.searchHospiceIDTMeetings as unknown as Handler
  );

  // getHospiceIDTMeeting
  app.get('/healthcare/clinical/hospital/palliative/hospice-idt/:id',
    zValidator('param', validators.GetHospiceIDTMeetingParams, validationErrorHandler),
    registry.getHospiceIDTMeeting as unknown as Handler
  );

  // updateHospiceIDTMeeting
  app.put('/healthcare/clinical/hospital/palliative/hospice-idt/:id',
    zValidator('param', validators.UpdateHospiceIDTMeetingParams, validationErrorHandler),
    zValidator('json', validators.UpdateHospiceIDTMeetingBody, validationErrorHandler),
    registry.updateHospiceIDTMeeting as unknown as Handler
  );

  // deleteHospiceIDTMeeting
  app.delete('/healthcare/clinical/hospital/palliative/hospice-idt/:id',
    zValidator('param', validators.DeleteHospiceIDTMeetingParams, validationErrorHandler),
    registry.deleteHospiceIDTMeeting as unknown as Handler
  );

  // createSymptomAssessment
  app.post('/healthcare/clinical/hospital/palliative/symptom-assessments',
    zValidator('json', validators.CreateSymptomAssessmentBody, validationErrorHandler),
    registry.createSymptomAssessment as unknown as Handler
  );

  // searchSymptomAssessments
  app.get('/healthcare/clinical/hospital/palliative/symptom-assessments/search',
    zValidator('query', validators.SearchSymptomAssessmentsQuery, validationErrorHandler),
    registry.searchSymptomAssessments as unknown as Handler
  );

  // getSymptomAssessment
  app.get('/healthcare/clinical/hospital/palliative/symptom-assessments/:id',
    zValidator('param', validators.GetSymptomAssessmentParams, validationErrorHandler),
    registry.getSymptomAssessment as unknown as Handler
  );

  // updateSymptomAssessment
  app.put('/healthcare/clinical/hospital/palliative/symptom-assessments/:id',
    zValidator('param', validators.UpdateSymptomAssessmentParams, validationErrorHandler),
    zValidator('json', validators.UpdateSymptomAssessmentBody, validationErrorHandler),
    registry.updateSymptomAssessment as unknown as Handler
  );

  // deleteSymptomAssessment
  app.delete('/healthcare/clinical/hospital/palliative/symptom-assessments/:id',
    zValidator('param', validators.DeleteSymptomAssessmentParams, validationErrorHandler),
    registry.deleteSymptomAssessment as unknown as Handler
  );

  // createADLAssessment
  app.post('/healthcare/clinical/hospital/post-acute/adl-assessments',
    zValidator('json', validators.CreateADLAssessmentBody, validationErrorHandler),
    registry.createADLAssessment as unknown as Handler
  );

  // searchADLAssessments
  app.get('/healthcare/clinical/hospital/post-acute/adl-assessments/search',
    zValidator('query', validators.SearchADLAssessmentsQuery, validationErrorHandler),
    registry.searchADLAssessments as unknown as Handler
  );

  // getADLAssessment
  app.get('/healthcare/clinical/hospital/post-acute/adl-assessments/:id',
    zValidator('param', validators.GetADLAssessmentParams, validationErrorHandler),
    registry.getADLAssessment as unknown as Handler
  );

  // updateADLAssessment
  app.put('/healthcare/clinical/hospital/post-acute/adl-assessments/:id',
    zValidator('param', validators.UpdateADLAssessmentParams, validationErrorHandler),
    zValidator('json', validators.UpdateADLAssessmentBody, validationErrorHandler),
    registry.updateADLAssessment as unknown as Handler
  );

  // deleteADLAssessment
  app.delete('/healthcare/clinical/hospital/post-acute/adl-assessments/:id',
    zValidator('param', validators.DeleteADLAssessmentParams, validationErrorHandler),
    registry.deleteADLAssessment as unknown as Handler
  );

  // createPostAcuteAdmission
  app.post('/healthcare/clinical/hospital/post-acute/admissions',
    zValidator('json', validators.CreatePostAcuteAdmissionBody, validationErrorHandler),
    registry.createPostAcuteAdmission as unknown as Handler
  );

  // searchPostAcuteAdmissions
  app.get('/healthcare/clinical/hospital/post-acute/admissions/search',
    zValidator('query', validators.SearchPostAcuteAdmissionsQuery, validationErrorHandler),
    registry.searchPostAcuteAdmissions as unknown as Handler
  );

  // getPostAcuteAdmission
  app.get('/healthcare/clinical/hospital/post-acute/admissions/:id',
    zValidator('param', validators.GetPostAcuteAdmissionParams, validationErrorHandler),
    registry.getPostAcuteAdmission as unknown as Handler
  );

  // updatePostAcuteAdmission
  app.put('/healthcare/clinical/hospital/post-acute/admissions/:id',
    zValidator('param', validators.UpdatePostAcuteAdmissionParams, validationErrorHandler),
    zValidator('json', validators.UpdatePostAcuteAdmissionBody, validationErrorHandler),
    registry.updatePostAcuteAdmission as unknown as Handler
  );

  // deletePostAcuteAdmission
  app.delete('/healthcare/clinical/hospital/post-acute/admissions/:id',
    zValidator('param', validators.DeletePostAcuteAdmissionParams, validationErrorHandler),
    registry.deletePostAcuteAdmission as unknown as Handler
  );

  // createHomeHealthCertification
  app.post('/healthcare/clinical/hospital/post-acute/home-health-certifications',
    zValidator('json', validators.CreateHomeHealthCertificationBody, validationErrorHandler),
    registry.createHomeHealthCertification as unknown as Handler
  );

  // searchHomeHealthCertifications
  app.get('/healthcare/clinical/hospital/post-acute/home-health-certifications/search',
    zValidator('query', validators.SearchHomeHealthCertificationsQuery, validationErrorHandler),
    registry.searchHomeHealthCertifications as unknown as Handler
  );

  // getHomeHealthCertification
  app.get('/healthcare/clinical/hospital/post-acute/home-health-certifications/:id',
    zValidator('param', validators.GetHomeHealthCertificationParams, validationErrorHandler),
    registry.getHomeHealthCertification as unknown as Handler
  );

  // updateHomeHealthCertification
  app.put('/healthcare/clinical/hospital/post-acute/home-health-certifications/:id',
    zValidator('param', validators.UpdateHomeHealthCertificationParams, validationErrorHandler),
    zValidator('json', validators.UpdateHomeHealthCertificationBody, validationErrorHandler),
    registry.updateHomeHealthCertification as unknown as Handler
  );

  // deleteHomeHealthCertification
  app.delete('/healthcare/clinical/hospital/post-acute/home-health-certifications/:id',
    zValidator('param', validators.DeleteHomeHealthCertificationParams, validationErrorHandler),
    registry.deleteHomeHealthCertification as unknown as Handler
  );

  // createMDSAssessment
  app.post('/healthcare/clinical/hospital/post-acute/mds-assessments',
    zValidator('json', validators.CreateMDSAssessmentBody, validationErrorHandler),
    registry.createMDSAssessment as unknown as Handler
  );

  // searchMDSAssessments
  app.get('/healthcare/clinical/hospital/post-acute/mds-assessments/search',
    zValidator('query', validators.SearchMDSAssessmentsQuery, validationErrorHandler),
    registry.searchMDSAssessments as unknown as Handler
  );

  // getMDSAssessment
  app.get('/healthcare/clinical/hospital/post-acute/mds-assessments/:id',
    zValidator('param', validators.GetMDSAssessmentParams, validationErrorHandler),
    registry.getMDSAssessment as unknown as Handler
  );

  // updateMDSAssessment
  app.put('/healthcare/clinical/hospital/post-acute/mds-assessments/:id',
    zValidator('param', validators.UpdateMDSAssessmentParams, validationErrorHandler),
    zValidator('json', validators.UpdateMDSAssessmentBody, validationErrorHandler),
    registry.updateMDSAssessment as unknown as Handler
  );

  // deleteMDSAssessment
  app.delete('/healthcare/clinical/hospital/post-acute/mds-assessments/:id',
    zValidator('param', validators.DeleteMDSAssessmentParams, validationErrorHandler),
    registry.deleteMDSAssessment as unknown as Handler
  );

  // createOASISAssessment
  app.post('/healthcare/clinical/hospital/post-acute/oasis-assessments',
    zValidator('json', validators.CreateOASISAssessmentBody, validationErrorHandler),
    registry.createOASISAssessment as unknown as Handler
  );

  // searchOASISAssessments
  app.get('/healthcare/clinical/hospital/post-acute/oasis-assessments/search',
    zValidator('query', validators.SearchOASISAssessmentsQuery, validationErrorHandler),
    registry.searchOASISAssessments as unknown as Handler
  );

  // getOASISAssessment
  app.get('/healthcare/clinical/hospital/post-acute/oasis-assessments/:id',
    zValidator('param', validators.GetOASISAssessmentParams, validationErrorHandler),
    registry.getOASISAssessment as unknown as Handler
  );

  // updateOASISAssessment
  app.put('/healthcare/clinical/hospital/post-acute/oasis-assessments/:id',
    zValidator('param', validators.UpdateOASISAssessmentParams, validationErrorHandler),
    zValidator('json', validators.UpdateOASISAssessmentBody, validationErrorHandler),
    registry.updateOASISAssessment as unknown as Handler
  );

  // deleteOASISAssessment
  app.delete('/healthcare/clinical/hospital/post-acute/oasis-assessments/:id',
    zValidator('param', validators.DeleteOASISAssessmentParams, validationErrorHandler),
    registry.deleteOASISAssessment as unknown as Handler
  );

  // createPostpartumAssessment
  app.post('/healthcare/clinical/hospital/postpartum',
    zValidator('json', validators.CreatePostpartumAssessmentBody, validationErrorHandler),
    registry.createPostpartumAssessment as unknown as Handler
  );

  // searchPostpartumAssessments
  app.get('/healthcare/clinical/hospital/postpartum/search',
    zValidator('query', validators.SearchPostpartumAssessmentsQuery, validationErrorHandler),
    registry.searchPostpartumAssessments as unknown as Handler
  );

  // getPostpartumAssessment
  app.get('/healthcare/clinical/hospital/postpartum/:id',
    zValidator('param', validators.GetPostpartumAssessmentParams, validationErrorHandler),
    registry.getPostpartumAssessment as unknown as Handler
  );

  // updatePostpartumAssessment
  app.put('/healthcare/clinical/hospital/postpartum/:id',
    zValidator('param', validators.UpdatePostpartumAssessmentParams, validationErrorHandler),
    zValidator('json', validators.UpdatePostpartumAssessmentBody, validationErrorHandler),
    registry.updatePostpartumAssessment as unknown as Handler
  );

  // deletePostpartumAssessment
  app.delete('/healthcare/clinical/hospital/postpartum/:id',
    zValidator('param', validators.DeletePostpartumAssessmentParams, validationErrorHandler),
    registry.deletePostpartumAssessment as unknown as Handler
  );

  // createPregnancyRecord
  app.post('/healthcare/clinical/hospital/pregnancies',
    zValidator('json', validators.CreatePregnancyRecordBody, validationErrorHandler),
    registry.createPregnancyRecord as unknown as Handler
  );

  // searchPregnancyRecords
  app.get('/healthcare/clinical/hospital/pregnancies/search',
    zValidator('query', validators.SearchPregnancyRecordsQuery, validationErrorHandler),
    registry.searchPregnancyRecords as unknown as Handler
  );

  // getPregnancyRecord
  app.get('/healthcare/clinical/hospital/pregnancies/:id',
    zValidator('param', validators.GetPregnancyRecordParams, validationErrorHandler),
    registry.getPregnancyRecord as unknown as Handler
  );

  // updatePregnancyRecord
  app.put('/healthcare/clinical/hospital/pregnancies/:id',
    zValidator('param', validators.UpdatePregnancyRecordParams, validationErrorHandler),
    zValidator('json', validators.UpdatePregnancyRecordBody, validationErrorHandler),
    registry.updatePregnancyRecord as unknown as Handler
  );

  // deletePregnancyRecord
  app.delete('/healthcare/clinical/hospital/pregnancies/:id',
    zValidator('param', validators.DeletePregnancyRecordParams, validationErrorHandler),
    registry.deletePregnancyRecord as unknown as Handler
  );

  // createPressureInjuryRisk
  app.post('/healthcare/clinical/hospital/pressure-injury',
    zValidator('json', validators.CreatePressureInjuryRiskBody, validationErrorHandler),
    registry.createPressureInjuryRisk as unknown as Handler
  );

  // searchPressureInjuryRisks
  app.get('/healthcare/clinical/hospital/pressure-injury/search',
    zValidator('query', validators.SearchPressureInjuryRisksQuery, validationErrorHandler),
    registry.searchPressureInjuryRisks as unknown as Handler
  );

  // getPressureInjuryRisk
  app.get('/healthcare/clinical/hospital/pressure-injury/:id',
    zValidator('param', validators.GetPressureInjuryRiskParams, validationErrorHandler),
    registry.getPressureInjuryRisk as unknown as Handler
  );

  // updatePressureInjuryRisk
  app.put('/healthcare/clinical/hospital/pressure-injury/:id',
    zValidator('param', validators.UpdatePressureInjuryRiskParams, validationErrorHandler),
    zValidator('json', validators.UpdatePressureInjuryRiskBody, validationErrorHandler),
    registry.updatePressureInjuryRisk as unknown as Handler
  );

  // deletePressureInjuryRisk
  app.delete('/healthcare/clinical/hospital/pressure-injury/:id',
    zValidator('param', validators.DeletePressureInjuryRiskParams, validationErrorHandler),
    registry.deletePressureInjuryRisk as unknown as Handler
  );

  // createPsychiatricAssessment
  app.post('/healthcare/clinical/hospital/psychiatric-assessments',
    zValidator('json', validators.CreatePsychiatricAssessmentBody, validationErrorHandler),
    registry.createPsychiatricAssessment as unknown as Handler
  );

  // searchPsychiatricAssessments
  app.get('/healthcare/clinical/hospital/psychiatric-assessments/search',
    zValidator('query', validators.SearchPsychiatricAssessmentsQuery, validationErrorHandler),
    registry.searchPsychiatricAssessments as unknown as Handler
  );

  // getPsychiatricAssessment
  app.get('/healthcare/clinical/hospital/psychiatric-assessments/:id',
    zValidator('param', validators.GetPsychiatricAssessmentParams, validationErrorHandler),
    registry.getPsychiatricAssessment as unknown as Handler
  );

  // updatePsychiatricAssessment
  app.put('/healthcare/clinical/hospital/psychiatric-assessments/:id',
    zValidator('param', validators.UpdatePsychiatricAssessmentParams, validationErrorHandler),
    zValidator('json', validators.UpdatePsychiatricAssessmentBody, validationErrorHandler),
    registry.updatePsychiatricAssessment as unknown as Handler
  );

  // deletePsychiatricAssessment
  app.delete('/healthcare/clinical/hospital/psychiatric-assessments/:id',
    zValidator('param', validators.DeletePsychiatricAssessmentParams, validationErrorHandler),
    registry.deletePsychiatricAssessment as unknown as Handler
  );

  // createRadiationTherapy
  app.post('/healthcare/clinical/hospital/radiation-therapy',
    zValidator('json', validators.CreateRadiationTherapyBody, validationErrorHandler),
    registry.createRadiationTherapy as unknown as Handler
  );

  // searchRadiationTherapy
  app.get('/healthcare/clinical/hospital/radiation-therapy/search',
    zValidator('query', validators.SearchRadiationTherapyQuery, validationErrorHandler),
    registry.searchRadiationTherapy as unknown as Handler
  );

  // getRadiationTherapy
  app.get('/healthcare/clinical/hospital/radiation-therapy/:id',
    zValidator('param', validators.GetRadiationTherapyParams, validationErrorHandler),
    registry.getRadiationTherapy as unknown as Handler
  );

  // updateRadiationTherapy
  app.put('/healthcare/clinical/hospital/radiation-therapy/:id',
    zValidator('param', validators.UpdateRadiationTherapyParams, validationErrorHandler),
    zValidator('json', validators.UpdateRadiationTherapyBody, validationErrorHandler),
    registry.updateRadiationTherapy as unknown as Handler
  );

  // deleteRadiationTherapy
  app.delete('/healthcare/clinical/hospital/radiation-therapy/:id',
    zValidator('param', validators.DeleteRadiationTherapyParams, validationErrorHandler),
    registry.deleteRadiationTherapy as unknown as Handler
  );

  // createRehabEvaluation
  app.post('/healthcare/clinical/hospital/rehab/evaluations',
    zValidator('json', validators.CreateRehabEvaluationBody, validationErrorHandler),
    registry.createRehabEvaluation as unknown as Handler
  );

  // searchRehabEvaluations
  app.get('/healthcare/clinical/hospital/rehab/evaluations/search',
    zValidator('query', validators.SearchRehabEvaluationsQuery, validationErrorHandler),
    registry.searchRehabEvaluations as unknown as Handler
  );

  // getRehabEvaluation
  app.get('/healthcare/clinical/hospital/rehab/evaluations/:id',
    zValidator('param', validators.GetRehabEvaluationParams, validationErrorHandler),
    registry.getRehabEvaluation as unknown as Handler
  );

  // updateRehabEvaluation
  app.put('/healthcare/clinical/hospital/rehab/evaluations/:id',
    zValidator('param', validators.UpdateRehabEvaluationParams, validationErrorHandler),
    zValidator('json', validators.UpdateRehabEvaluationBody, validationErrorHandler),
    registry.updateRehabEvaluation as unknown as Handler
  );

  // deleteRehabEvaluation
  app.delete('/healthcare/clinical/hospital/rehab/evaluations/:id',
    zValidator('param', validators.DeleteRehabEvaluationParams, validationErrorHandler),
    registry.deleteRehabEvaluation as unknown as Handler
  );

  // createFunctionalOutcome
  app.post('/healthcare/clinical/hospital/rehab/functional-outcomes',
    zValidator('json', validators.CreateFunctionalOutcomeBody, validationErrorHandler),
    registry.createFunctionalOutcome as unknown as Handler
  );

  // searchFunctionalOutcomes
  app.get('/healthcare/clinical/hospital/rehab/functional-outcomes/search',
    zValidator('query', validators.SearchFunctionalOutcomesQuery, validationErrorHandler),
    registry.searchFunctionalOutcomes as unknown as Handler
  );

  // getFunctionalOutcome
  app.get('/healthcare/clinical/hospital/rehab/functional-outcomes/:id',
    zValidator('param', validators.GetFunctionalOutcomeParams, validationErrorHandler),
    registry.getFunctionalOutcome as unknown as Handler
  );

  // updateFunctionalOutcome
  app.put('/healthcare/clinical/hospital/rehab/functional-outcomes/:id',
    zValidator('param', validators.UpdateFunctionalOutcomeParams, validationErrorHandler),
    zValidator('json', validators.UpdateFunctionalOutcomeBody, validationErrorHandler),
    registry.updateFunctionalOutcome as unknown as Handler
  );

  // deleteFunctionalOutcome
  app.delete('/healthcare/clinical/hospital/rehab/functional-outcomes/:id',
    zValidator('param', validators.DeleteFunctionalOutcomeParams, validationErrorHandler),
    registry.deleteFunctionalOutcome as unknown as Handler
  );

  // createRehabReferral
  app.post('/healthcare/clinical/hospital/rehab/referrals',
    zValidator('json', validators.CreateRehabReferralBody, validationErrorHandler),
    registry.createRehabReferral as unknown as Handler
  );

  // searchRehabReferrals
  app.get('/healthcare/clinical/hospital/rehab/referrals/search',
    zValidator('query', validators.SearchRehabReferralsQuery, validationErrorHandler),
    registry.searchRehabReferrals as unknown as Handler
  );

  // getRehabReferral
  app.get('/healthcare/clinical/hospital/rehab/referrals/:id',
    zValidator('param', validators.GetRehabReferralParams, validationErrorHandler),
    registry.getRehabReferral as unknown as Handler
  );

  // updateRehabReferral
  app.put('/healthcare/clinical/hospital/rehab/referrals/:id',
    zValidator('param', validators.UpdateRehabReferralParams, validationErrorHandler),
    zValidator('json', validators.UpdateRehabReferralBody, validationErrorHandler),
    registry.updateRehabReferral as unknown as Handler
  );

  // deleteRehabReferral
  app.delete('/healthcare/clinical/hospital/rehab/referrals/:id',
    zValidator('param', validators.DeleteRehabReferralParams, validationErrorHandler),
    registry.deleteRehabReferral as unknown as Handler
  );

  // createRehabSession
  app.post('/healthcare/clinical/hospital/rehab/sessions',
    zValidator('json', validators.CreateRehabSessionBody, validationErrorHandler),
    registry.createRehabSession as unknown as Handler
  );

  // searchRehabSessions
  app.get('/healthcare/clinical/hospital/rehab/sessions/search',
    zValidator('query', validators.SearchRehabSessionsQuery, validationErrorHandler),
    registry.searchRehabSessions as unknown as Handler
  );

  // getRehabSession
  app.get('/healthcare/clinical/hospital/rehab/sessions/:id',
    zValidator('param', validators.GetRehabSessionParams, validationErrorHandler),
    registry.getRehabSession as unknown as Handler
  );

  // updateRehabSession
  app.put('/healthcare/clinical/hospital/rehab/sessions/:id',
    zValidator('param', validators.UpdateRehabSessionParams, validationErrorHandler),
    zValidator('json', validators.UpdateRehabSessionBody, validationErrorHandler),
    registry.updateRehabSession as unknown as Handler
  );

  // deleteRehabSession
  app.delete('/healthcare/clinical/hospital/rehab/sessions/:id',
    zValidator('param', validators.DeleteRehabSessionParams, validationErrorHandler),
    registry.deleteRehabSession as unknown as Handler
  );

  // createABGResult
  app.post('/healthcare/clinical/hospital/respiratory/abg-results',
    zValidator('json', validators.CreateABGResultBody, validationErrorHandler),
    registry.createABGResult as unknown as Handler
  );

  // searchABGResults
  app.get('/healthcare/clinical/hospital/respiratory/abg-results/search',
    zValidator('query', validators.SearchABGResultsQuery, validationErrorHandler),
    registry.searchABGResults as unknown as Handler
  );

  // getABGResult
  app.get('/healthcare/clinical/hospital/respiratory/abg-results/:id',
    zValidator('param', validators.GetABGResultParams, validationErrorHandler),
    registry.getABGResult as unknown as Handler
  );

  // updateABGResult
  app.put('/healthcare/clinical/hospital/respiratory/abg-results/:id',
    zValidator('param', validators.UpdateABGResultParams, validationErrorHandler),
    zValidator('json', validators.UpdateABGResultBody, validationErrorHandler),
    registry.updateABGResult as unknown as Handler
  );

  // deleteABGResult
  app.delete('/healthcare/clinical/hospital/respiratory/abg-results/:id',
    zValidator('param', validators.DeleteABGResultParams, validationErrorHandler),
    registry.deleteABGResult as unknown as Handler
  );

  // createRespiratoryOrder
  app.post('/healthcare/clinical/hospital/respiratory/orders',
    zValidator('json', validators.CreateRespiratoryOrderBody, validationErrorHandler),
    registry.createRespiratoryOrder as unknown as Handler
  );

  // searchRespiratoryOrders
  app.get('/healthcare/clinical/hospital/respiratory/orders/search',
    zValidator('query', validators.SearchRespiratoryOrdersQuery, validationErrorHandler),
    registry.searchRespiratoryOrders as unknown as Handler
  );

  // getRespiratoryOrder
  app.get('/healthcare/clinical/hospital/respiratory/orders/:id',
    zValidator('param', validators.GetRespiratoryOrderParams, validationErrorHandler),
    registry.getRespiratoryOrder as unknown as Handler
  );

  // updateRespiratoryOrder
  app.put('/healthcare/clinical/hospital/respiratory/orders/:id',
    zValidator('param', validators.UpdateRespiratoryOrderParams, validationErrorHandler),
    zValidator('json', validators.UpdateRespiratoryOrderBody, validationErrorHandler),
    registry.updateRespiratoryOrder as unknown as Handler
  );

  // deleteRespiratoryOrder
  app.delete('/healthcare/clinical/hospital/respiratory/orders/:id',
    zValidator('param', validators.DeleteRespiratoryOrderParams, validationErrorHandler),
    registry.deleteRespiratoryOrder as unknown as Handler
  );

  // createPFT
  app.post('/healthcare/clinical/hospital/respiratory/pft',
    zValidator('json', validators.CreatePFTBody, validationErrorHandler),
    registry.createPFT as unknown as Handler
  );

  // searchPFTs
  app.get('/healthcare/clinical/hospital/respiratory/pft/search',
    zValidator('query', validators.SearchPFTsQuery, validationErrorHandler),
    registry.searchPFTs as unknown as Handler
  );

  // getPFT
  app.get('/healthcare/clinical/hospital/respiratory/pft/:id',
    zValidator('param', validators.GetPFTParams, validationErrorHandler),
    registry.getPFT as unknown as Handler
  );

  // updatePFT
  app.put('/healthcare/clinical/hospital/respiratory/pft/:id',
    zValidator('param', validators.UpdatePFTParams, validationErrorHandler),
    zValidator('json', validators.UpdatePFTBody, validationErrorHandler),
    registry.updatePFT as unknown as Handler
  );

  // deletePFT
  app.delete('/healthcare/clinical/hospital/respiratory/pft/:id',
    zValidator('param', validators.DeletePFTParams, validationErrorHandler),
    registry.deletePFT as unknown as Handler
  );

  // createRespiratoryTreatment
  app.post('/healthcare/clinical/hospital/respiratory/treatments',
    zValidator('json', validators.CreateRespiratoryTreatmentBody, validationErrorHandler),
    registry.createRespiratoryTreatment as unknown as Handler
  );

  // searchRespiratoryTreatments
  app.get('/healthcare/clinical/hospital/respiratory/treatments/search',
    zValidator('query', validators.SearchRespiratoryTreatmentsQuery, validationErrorHandler),
    registry.searchRespiratoryTreatments as unknown as Handler
  );

  // getRespiratoryTreatment
  app.get('/healthcare/clinical/hospital/respiratory/treatments/:id',
    zValidator('param', validators.GetRespiratoryTreatmentParams, validationErrorHandler),
    registry.getRespiratoryTreatment as unknown as Handler
  );

  // updateRespiratoryTreatment
  app.put('/healthcare/clinical/hospital/respiratory/treatments/:id',
    zValidator('param', validators.UpdateRespiratoryTreatmentParams, validationErrorHandler),
    zValidator('json', validators.UpdateRespiratoryTreatmentBody, validationErrorHandler),
    registry.updateRespiratoryTreatment as unknown as Handler
  );

  // deleteRespiratoryTreatment
  app.delete('/healthcare/clinical/hospital/respiratory/treatments/:id',
    zValidator('param', validators.DeleteRespiratoryTreatmentParams, validationErrorHandler),
    registry.deleteRespiratoryTreatment as unknown as Handler
  );

  // createSeverityScore
  app.post('/healthcare/clinical/hospital/severity-scores',
    zValidator('json', validators.CreateSeverityScoreBody, validationErrorHandler),
    registry.createSeverityScore as unknown as Handler
  );

  // searchSeverityScores
  app.get('/healthcare/clinical/hospital/severity-scores/search',
    zValidator('query', validators.SearchSeverityScoresQuery, validationErrorHandler),
    registry.searchSeverityScores as unknown as Handler
  );

  // getSeverityScore
  app.get('/healthcare/clinical/hospital/severity-scores/:id',
    zValidator('param', validators.GetSeverityScoreParams, validationErrorHandler),
    registry.getSeverityScore as unknown as Handler
  );

  // updateSeverityScore
  app.put('/healthcare/clinical/hospital/severity-scores/:id',
    zValidator('param', validators.UpdateSeverityScoreParams, validationErrorHandler),
    zValidator('json', validators.UpdateSeverityScoreBody, validationErrorHandler),
    registry.updateSeverityScore as unknown as Handler
  );

  // deleteSeverityScore
  app.delete('/healthcare/clinical/hospital/severity-scores/:id',
    zValidator('param', validators.DeleteSeverityScoreParams, validationErrorHandler),
    registry.deleteSeverityScore as unknown as Handler
  );

  // createSubstanceUseAssessment
  app.post('/healthcare/clinical/hospital/substance-use',
    zValidator('json', validators.CreateSubstanceUseAssessmentBody, validationErrorHandler),
    registry.createSubstanceUseAssessment as unknown as Handler
  );

  // searchSubstanceUseAssessments
  app.get('/healthcare/clinical/hospital/substance-use/search',
    zValidator('query', validators.SearchSubstanceUseAssessmentsQuery, validationErrorHandler),
    registry.searchSubstanceUseAssessments as unknown as Handler
  );

  // getSubstanceUseAssessment
  app.get('/healthcare/clinical/hospital/substance-use/:id',
    zValidator('param', validators.GetSubstanceUseAssessmentParams, validationErrorHandler),
    registry.getSubstanceUseAssessment as unknown as Handler
  );

  // updateSubstanceUseAssessment
  app.put('/healthcare/clinical/hospital/substance-use/:id',
    zValidator('param', validators.UpdateSubstanceUseAssessmentParams, validationErrorHandler),
    zValidator('json', validators.UpdateSubstanceUseAssessmentBody, validationErrorHandler),
    registry.updateSubstanceUseAssessment as unknown as Handler
  );

  // deleteSubstanceUseAssessment
  app.delete('/healthcare/clinical/hospital/substance-use/:id',
    zValidator('param', validators.DeleteSubstanceUseAssessmentParams, validationErrorHandler),
    registry.deleteSubstanceUseAssessment as unknown as Handler
  );

  // createTriageAssessment
  app.post('/healthcare/clinical/hospital/triage',
    zValidator('json', validators.CreateTriageAssessmentBody, validationErrorHandler),
    registry.createTriageAssessment as unknown as Handler
  );

  // searchTriageAssessments
  app.get('/healthcare/clinical/hospital/triage/search',
    zValidator('query', validators.SearchTriageAssessmentsQuery, validationErrorHandler),
    registry.searchTriageAssessments as unknown as Handler
  );

  // getTriageAssessment
  app.get('/healthcare/clinical/hospital/triage/:id',
    zValidator('param', validators.GetTriageAssessmentParams, validationErrorHandler),
    registry.getTriageAssessment as unknown as Handler
  );

  // updateTriageAssessment
  app.put('/healthcare/clinical/hospital/triage/:id',
    zValidator('param', validators.UpdateTriageAssessmentParams, validationErrorHandler),
    zValidator('json', validators.UpdateTriageAssessmentBody, validationErrorHandler),
    registry.updateTriageAssessment as unknown as Handler
  );

  // deleteTriageAssessment
  app.delete('/healthcare/clinical/hospital/triage/:id',
    zValidator('param', validators.DeleteTriageAssessmentParams, validationErrorHandler),
    registry.deleteTriageAssessment as unknown as Handler
  );

  // createVentilatorRecord
  app.post('/healthcare/clinical/hospital/ventilators',
    zValidator('json', validators.CreateVentilatorRecordBody, validationErrorHandler),
    registry.createVentilatorRecord as unknown as Handler
  );

  // searchVentilatorRecords
  app.get('/healthcare/clinical/hospital/ventilators/search',
    zValidator('query', validators.SearchVentilatorRecordsQuery, validationErrorHandler),
    registry.searchVentilatorRecords as unknown as Handler
  );

  // getVentilatorRecord
  app.get('/healthcare/clinical/hospital/ventilators/:id',
    zValidator('param', validators.GetVentilatorRecordParams, validationErrorHandler),
    registry.getVentilatorRecord as unknown as Handler
  );

  // updateVentilatorRecord
  app.put('/healthcare/clinical/hospital/ventilators/:id',
    zValidator('param', validators.UpdateVentilatorRecordParams, validationErrorHandler),
    zValidator('json', validators.UpdateVentilatorRecordBody, validationErrorHandler),
    registry.updateVentilatorRecord as unknown as Handler
  );

  // deleteVentilatorRecord
  app.delete('/healthcare/clinical/hospital/ventilators/:id',
    zValidator('param', validators.DeleteVentilatorRecordParams, validationErrorHandler),
    registry.deleteVentilatorRecord as unknown as Handler
  );

  // createWoundAssessment
  app.post('/healthcare/clinical/hospital/wound-assessments',
    zValidator('json', validators.CreateWoundAssessmentBody, validationErrorHandler),
    registry.createWoundAssessment as unknown as Handler
  );

  // searchWoundAssessments
  app.get('/healthcare/clinical/hospital/wound-assessments/search',
    zValidator('query', validators.SearchWoundAssessmentsQuery, validationErrorHandler),
    registry.searchWoundAssessments as unknown as Handler
  );

  // getWoundAssessment
  app.get('/healthcare/clinical/hospital/wound-assessments/:id',
    zValidator('param', validators.GetWoundAssessmentParams, validationErrorHandler),
    registry.getWoundAssessment as unknown as Handler
  );

  // updateWoundAssessment
  app.put('/healthcare/clinical/hospital/wound-assessments/:id',
    zValidator('param', validators.UpdateWoundAssessmentParams, validationErrorHandler),
    zValidator('json', validators.UpdateWoundAssessmentBody, validationErrorHandler),
    registry.updateWoundAssessment as unknown as Handler
  );

  // patchWoundAssessment
  app.patch('/healthcare/clinical/hospital/wound-assessments/:id',
    zValidator('param', validators.PatchWoundAssessmentParams, validationErrorHandler),
    zValidator('json', validators.PatchWoundAssessmentBody, validationErrorHandler),
    registry.patchWoundAssessment as unknown as Handler
  );

  // deleteWoundAssessment
  app.delete('/healthcare/clinical/hospital/wound-assessments/:id',
    zValidator('param', validators.DeleteWoundAssessmentParams, validationErrorHandler),
    registry.deleteWoundAssessment as unknown as Handler
  );

  // createWoundCareOrder
  app.post('/healthcare/clinical/hospital/wound-orders',
    zValidator('json', validators.CreateWoundCareOrderBody, validationErrorHandler),
    registry.createWoundCareOrder as unknown as Handler
  );

  // searchWoundCareOrders
  app.get('/healthcare/clinical/hospital/wound-orders/search',
    zValidator('query', validators.SearchWoundCareOrdersQuery, validationErrorHandler),
    registry.searchWoundCareOrders as unknown as Handler
  );

  // getWoundCareOrder
  app.get('/healthcare/clinical/hospital/wound-orders/:id',
    zValidator('param', validators.GetWoundCareOrderParams, validationErrorHandler),
    registry.getWoundCareOrder as unknown as Handler
  );

  // updateWoundCareOrder
  app.put('/healthcare/clinical/hospital/wound-orders/:id',
    zValidator('param', validators.UpdateWoundCareOrderParams, validationErrorHandler),
    zValidator('json', validators.UpdateWoundCareOrderBody, validationErrorHandler),
    registry.updateWoundCareOrder as unknown as Handler
  );

  // patchWoundCareOrder
  app.patch('/healthcare/clinical/hospital/wound-orders/:id',
    zValidator('param', validators.PatchWoundCareOrderParams, validationErrorHandler),
    zValidator('json', validators.PatchWoundCareOrderBody, validationErrorHandler),
    registry.patchWoundCareOrder as unknown as Handler
  );

  // deleteWoundCareOrder
  app.delete('/healthcare/clinical/hospital/wound-orders/:id',
    zValidator('param', validators.DeleteWoundCareOrderParams, validationErrorHandler),
    registry.deleteWoundCareOrder as unknown as Handler
  );

  // createWoundTreatment
  app.post('/healthcare/clinical/hospital/wound-treatments',
    zValidator('json', validators.CreateWoundTreatmentBody, validationErrorHandler),
    registry.createWoundTreatment as unknown as Handler
  );

  // searchWoundTreatments
  app.get('/healthcare/clinical/hospital/wound-treatments/search',
    zValidator('query', validators.SearchWoundTreatmentsQuery, validationErrorHandler),
    registry.searchWoundTreatments as unknown as Handler
  );

  // getWoundTreatment
  app.get('/healthcare/clinical/hospital/wound-treatments/:id',
    zValidator('param', validators.GetWoundTreatmentParams, validationErrorHandler),
    registry.getWoundTreatment as unknown as Handler
  );

  // updateWoundTreatment
  app.put('/healthcare/clinical/hospital/wound-treatments/:id',
    zValidator('param', validators.UpdateWoundTreatmentParams, validationErrorHandler),
    zValidator('json', validators.UpdateWoundTreatmentBody, validationErrorHandler),
    registry.updateWoundTreatment as unknown as Handler
  );

  // deleteWoundTreatment
  app.delete('/healthcare/clinical/hospital/wound-treatments/:id',
    zValidator('param', validators.DeleteWoundTreatmentParams, validationErrorHandler),
    registry.deleteWoundTreatment as unknown as Handler
  );

  // createImmunization
  app.post('/healthcare/clinical/immunizations',
    zValidator('json', validators.CreateImmunizationBody, validationErrorHandler),
    registry.createImmunization as unknown as Handler
  );

  // searchImmunizations
  app.get('/healthcare/clinical/immunizations/search',
    zValidator('json', validators.SearchImmunizationsBody, validationErrorHandler),
    registry.searchImmunizations as unknown as Handler
  );

  // getImmunization
  app.get('/healthcare/clinical/immunizations/:id',
    zValidator('param', validators.GetImmunizationParams, validationErrorHandler),
    registry.getImmunization as unknown as Handler
  );

  // updateImmunization
  app.put('/healthcare/clinical/immunizations/:id',
    zValidator('param', validators.UpdateImmunizationParams, validationErrorHandler),
    zValidator('json', validators.UpdateImmunizationBody, validationErrorHandler),
    registry.updateImmunization as unknown as Handler
  );

  // patchImmunization
  app.patch('/healthcare/clinical/immunizations/:id',
    zValidator('param', validators.PatchImmunizationParams, validationErrorHandler),
    zValidator('json', validators.PatchImmunizationBody, validationErrorHandler),
    registry.patchImmunization as unknown as Handler
  );

  // deleteImmunization
  app.delete('/healthcare/clinical/immunizations/:id',
    zValidator('param', validators.DeleteImmunizationParams, validationErrorHandler),
    registry.deleteImmunization as unknown as Handler
  );

  // createMedicationRequest
  app.post('/healthcare/clinical/medication-requests',
    zValidator('json', validators.CreateMedicationRequestBody, validationErrorHandler),
    registry.createMedicationRequest as unknown as Handler
  );

  // searchMedicationRequests
  app.get('/healthcare/clinical/medication-requests/search',
    zValidator('json', validators.SearchMedicationRequestsBody, validationErrorHandler),
    registry.searchMedicationRequests as unknown as Handler
  );

  // getMedicationRequest
  app.get('/healthcare/clinical/medication-requests/:id',
    zValidator('param', validators.GetMedicationRequestParams, validationErrorHandler),
    registry.getMedicationRequest as unknown as Handler
  );

  // updateMedicationRequest
  app.put('/healthcare/clinical/medication-requests/:id',
    zValidator('param', validators.UpdateMedicationRequestParams, validationErrorHandler),
    zValidator('json', validators.UpdateMedicationRequestBody, validationErrorHandler),
    registry.updateMedicationRequest as unknown as Handler
  );

  // patchMedicationRequest
  app.patch('/healthcare/clinical/medication-requests/:id',
    zValidator('param', validators.PatchMedicationRequestParams, validationErrorHandler),
    zValidator('json', validators.PatchMedicationRequestBody, validationErrorHandler),
    registry.patchMedicationRequest as unknown as Handler
  );

  // deleteMedicationRequest
  app.delete('/healthcare/clinical/medication-requests/:id',
    zValidator('param', validators.DeleteMedicationRequestParams, validationErrorHandler),
    registry.deleteMedicationRequest as unknown as Handler
  );

  // transitionMedicationRequestStatus
  app.post('/healthcare/clinical/medication-requests/:id/status',
    zValidator('param', validators.TransitionMedicationRequestStatusParams, validationErrorHandler),
    zValidator('json', validators.TransitionMedicationRequestStatusBody, validationErrorHandler),
    registry.transitionMedicationRequestStatus as unknown as Handler
  );

  // sendClinicalMessage
  app.post('/healthcare/clinical/messages',
    zValidator('json', validators.SendClinicalMessageBody, validationErrorHandler),
    registry.sendClinicalMessage as unknown as Handler
  );

  // searchClinicalMessages
  app.get('/healthcare/clinical/messages/search',
    zValidator('query', validators.SearchClinicalMessagesQuery, validationErrorHandler),
    registry.searchClinicalMessages as unknown as Handler
  );

  // getClinicalMessage
  app.get('/healthcare/clinical/messages/:id',
    zValidator('param', validators.GetClinicalMessageParams, validationErrorHandler),
    registry.getClinicalMessage as unknown as Handler
  );

  // updateClinicalMessage
  app.put('/healthcare/clinical/messages/:id',
    zValidator('param', validators.UpdateClinicalMessageParams, validationErrorHandler),
    zValidator('json', validators.UpdateClinicalMessageBody, validationErrorHandler),
    registry.updateClinicalMessage as unknown as Handler
  );

  // deleteClinicalMessage
  app.delete('/healthcare/clinical/messages/:id',
    zValidator('param', validators.DeleteClinicalMessageParams, validationErrorHandler),
    registry.deleteClinicalMessage as unknown as Handler
  );

  // acknowledgeClinicalMessage
  app.post('/healthcare/clinical/messages/:id/acknowledge',
    zValidator('param', validators.AcknowledgeClinicalMessageParams, validationErrorHandler),
    zValidator('json', validators.AcknowledgeClinicalMessageBody, validationErrorHandler),
    registry.acknowledgeClinicalMessage as unknown as Handler
  );

  // createObservation
  app.post('/healthcare/clinical/observations',
    zValidator('json', validators.CreateObservationBody, validationErrorHandler),
    registry.createObservation as unknown as Handler
  );

  // bulkCreateObservations
  app.post('/healthcare/clinical/observations/bulk',
    zValidator('json', validators.BulkCreateObservationsBody, validationErrorHandler),
    registry.bulkCreateObservations as unknown as Handler
  );

  // searchObservations
  app.get('/healthcare/clinical/observations/search',
    zValidator('json', validators.SearchObservationsBody, validationErrorHandler),
    registry.searchObservations as unknown as Handler
  );

  // getObservation
  app.get('/healthcare/clinical/observations/:id',
    zValidator('param', validators.GetObservationParams, validationErrorHandler),
    registry.getObservation as unknown as Handler
  );

  // updateObservation
  app.put('/healthcare/clinical/observations/:id',
    zValidator('param', validators.UpdateObservationParams, validationErrorHandler),
    zValidator('json', validators.UpdateObservationBody, validationErrorHandler),
    registry.updateObservation as unknown as Handler
  );

  // patchObservation
  app.patch('/healthcare/clinical/observations/:id',
    zValidator('param', validators.PatchObservationParams, validationErrorHandler),
    zValidator('json', validators.PatchObservationBody, validationErrorHandler),
    registry.patchObservation as unknown as Handler
  );

  // deleteObservation
  app.delete('/healthcare/clinical/observations/:id',
    zValidator('param', validators.DeleteObservationParams, validationErrorHandler),
    registry.deleteObservation as unknown as Handler
  );

  // createOperatingRoom
  app.post('/healthcare/clinical/operating-rooms',
    zValidator('json', validators.CreateOperatingRoomBody, validationErrorHandler),
    registry.createOperatingRoom as unknown as Handler
  );

  // searchOperatingRooms
  app.get('/healthcare/clinical/operating-rooms/search',
    zValidator('query', validators.SearchOperatingRoomsQuery, validationErrorHandler),
    registry.searchOperatingRooms as unknown as Handler
  );

  // getOperatingRoom
  app.get('/healthcare/clinical/operating-rooms/:id',
    zValidator('param', validators.GetOperatingRoomParams, validationErrorHandler),
    registry.getOperatingRoom as unknown as Handler
  );

  // updateOperatingRoom
  app.put('/healthcare/clinical/operating-rooms/:id',
    zValidator('param', validators.UpdateOperatingRoomParams, validationErrorHandler),
    zValidator('json', validators.UpdateOperatingRoomBody, validationErrorHandler),
    registry.updateOperatingRoom as unknown as Handler
  );

  // deleteOperatingRoom
  app.delete('/healthcare/clinical/operating-rooms/:id',
    zValidator('param', validators.DeleteOperatingRoomParams, validationErrorHandler),
    registry.deleteOperatingRoom as unknown as Handler
  );

  // createProcedure
  app.post('/healthcare/clinical/procedures',
    zValidator('json', validators.CreateProcedureBody, validationErrorHandler),
    registry.createProcedure as unknown as Handler
  );

  // searchProcedures
  app.get('/healthcare/clinical/procedures/search',
    zValidator('json', validators.SearchProceduresBody, validationErrorHandler),
    registry.searchProcedures as unknown as Handler
  );

  // getProcedure
  app.get('/healthcare/clinical/procedures/:id',
    zValidator('param', validators.GetProcedureParams, validationErrorHandler),
    registry.getProcedure as unknown as Handler
  );

  // updateProcedure
  app.put('/healthcare/clinical/procedures/:id',
    zValidator('param', validators.UpdateProcedureParams, validationErrorHandler),
    zValidator('json', validators.UpdateProcedureBody, validationErrorHandler),
    registry.updateProcedure as unknown as Handler
  );

  // patchProcedure
  app.patch('/healthcare/clinical/procedures/:id',
    zValidator('param', validators.PatchProcedureParams, validationErrorHandler),
    zValidator('json', validators.PatchProcedureBody, validationErrorHandler),
    registry.patchProcedure as unknown as Handler
  );

  // deleteProcedure
  app.delete('/healthcare/clinical/procedures/:id',
    zValidator('param', validators.DeleteProcedureParams, validationErrorHandler),
    registry.deleteProcedure as unknown as Handler
  );

  // createRelatedPerson
  app.post('/healthcare/clinical/related-persons',
    zValidator('json', validators.CreateRelatedPersonBody, validationErrorHandler),
    registry.createRelatedPerson as unknown as Handler
  );

  // searchRelatedPersons
  app.get('/healthcare/clinical/related-persons/search',
    zValidator('query', validators.SearchRelatedPersonsQuery, validationErrorHandler),
    zValidator('json', validators.SearchRelatedPersonsBody, validationErrorHandler),
    registry.searchRelatedPersons as unknown as Handler
  );

  // getRelatedPerson
  app.get('/healthcare/clinical/related-persons/:id',
    zValidator('param', validators.GetRelatedPersonParams, validationErrorHandler),
    registry.getRelatedPerson as unknown as Handler
  );

  // updateRelatedPerson
  app.put('/healthcare/clinical/related-persons/:id',
    zValidator('param', validators.UpdateRelatedPersonParams, validationErrorHandler),
    zValidator('json', validators.UpdateRelatedPersonBody, validationErrorHandler),
    registry.updateRelatedPerson as unknown as Handler
  );

  // patchRelatedPerson
  app.patch('/healthcare/clinical/related-persons/:id',
    zValidator('param', validators.PatchRelatedPersonParams, validationErrorHandler),
    zValidator('json', validators.PatchRelatedPersonBody, validationErrorHandler),
    registry.patchRelatedPerson as unknown as Handler
  );

  // deleteRelatedPerson
  app.delete('/healthcare/clinical/related-persons/:id',
    zValidator('param', validators.DeleteRelatedPersonParams, validationErrorHandler),
    registry.deleteRelatedPerson as unknown as Handler
  );

  // createServiceRequest
  app.post('/healthcare/clinical/service-requests',
    zValidator('json', validators.CreateServiceRequestBody, validationErrorHandler),
    registry.createServiceRequest as unknown as Handler
  );

  // searchServiceRequests
  app.get('/healthcare/clinical/service-requests/search',
    zValidator('json', validators.SearchServiceRequestsBody, validationErrorHandler),
    registry.searchServiceRequests as unknown as Handler
  );

  // getServiceRequest
  app.get('/healthcare/clinical/service-requests/:id',
    zValidator('param', validators.GetServiceRequestParams, validationErrorHandler),
    registry.getServiceRequest as unknown as Handler
  );

  // updateServiceRequest
  app.put('/healthcare/clinical/service-requests/:id',
    zValidator('param', validators.UpdateServiceRequestParams, validationErrorHandler),
    zValidator('json', validators.UpdateServiceRequestBody, validationErrorHandler),
    registry.updateServiceRequest as unknown as Handler
  );

  // patchServiceRequest
  app.patch('/healthcare/clinical/service-requests/:id',
    zValidator('param', validators.PatchServiceRequestParams, validationErrorHandler),
    zValidator('json', validators.PatchServiceRequestBody, validationErrorHandler),
    registry.patchServiceRequest as unknown as Handler
  );

  // deleteServiceRequest
  app.delete('/healthcare/clinical/service-requests/:id',
    zValidator('param', validators.DeleteServiceRequestParams, validationErrorHandler),
    registry.deleteServiceRequest as unknown as Handler
  );

  // transitionServiceRequestStatus
  app.post('/healthcare/clinical/service-requests/:id/status',
    zValidator('param', validators.TransitionServiceRequestStatusParams, validationErrorHandler),
    zValidator('json', validators.TransitionServiceRequestStatusBody, validationErrorHandler),
    registry.transitionServiceRequestStatus as unknown as Handler
  );

  // createSurgicalCase
  app.post('/healthcare/clinical/surgical-cases',
    zValidator('json', validators.CreateSurgicalCaseBody, validationErrorHandler),
    registry.createSurgicalCase as unknown as Handler
  );

  // searchSurgicalCases
  app.get('/healthcare/clinical/surgical-cases/search',
    zValidator('query', validators.SearchSurgicalCasesQuery, validationErrorHandler),
    registry.searchSurgicalCases as unknown as Handler
  );

  // getSurgicalCase
  app.get('/healthcare/clinical/surgical-cases/:id',
    zValidator('param', validators.GetSurgicalCaseParams, validationErrorHandler),
    registry.getSurgicalCase as unknown as Handler
  );

  // updateSurgicalCase
  app.put('/healthcare/clinical/surgical-cases/:id',
    zValidator('param', validators.UpdateSurgicalCaseParams, validationErrorHandler),
    zValidator('json', validators.UpdateSurgicalCaseBody, validationErrorHandler),
    registry.updateSurgicalCase as unknown as Handler
  );

  // deleteSurgicalCase
  app.delete('/healthcare/clinical/surgical-cases/:id',
    zValidator('param', validators.DeleteSurgicalCaseParams, validationErrorHandler),
    registry.deleteSurgicalCase as unknown as Handler
  );

  // transitionSurgicalCaseStatus
  app.post('/healthcare/clinical/surgical-cases/:id/status',
    zValidator('param', validators.TransitionSurgicalCaseStatusParams, validationErrorHandler),
    zValidator('json', validators.TransitionSurgicalCaseStatusBody, validationErrorHandler),
    registry.transitionSurgicalCaseStatus as unknown as Handler
  );

  // createPolicyAttestation
  app.post('/healthcare/compliance/attestations',
    zValidator('json', validators.CreatePolicyAttestationBody, validationErrorHandler),
    registry.createPolicyAttestation as unknown as Handler
  );

  // searchPolicyAttestations
  app.get('/healthcare/compliance/attestations/search',
    zValidator('query', validators.SearchPolicyAttestationsQuery, validationErrorHandler),
    registry.searchPolicyAttestations as unknown as Handler
  );

  // getPolicyAttestation
  app.get('/healthcare/compliance/attestations/:id',
    zValidator('param', validators.GetPolicyAttestationParams, validationErrorHandler),
    registry.getPolicyAttestation as unknown as Handler
  );

  // updatePolicyAttestation
  app.put('/healthcare/compliance/attestations/:id',
    zValidator('param', validators.UpdatePolicyAttestationParams, validationErrorHandler),
    zValidator('json', validators.UpdatePolicyAttestationBody, validationErrorHandler),
    registry.updatePolicyAttestation as unknown as Handler
  );

  // deletePolicyAttestation
  app.delete('/healthcare/compliance/attestations/:id',
    zValidator('param', validators.DeletePolicyAttestationParams, validationErrorHandler),
    registry.deletePolicyAttestation as unknown as Handler
  );

  // createBAARecord
  app.post('/healthcare/compliance/baa-records',
    zValidator('json', validators.CreateBAARecordBody, validationErrorHandler),
    registry.createBAARecord as unknown as Handler
  );

  // searchBAARecords
  app.get('/healthcare/compliance/baa-records/search',
    zValidator('query', validators.SearchBAARecordsQuery, validationErrorHandler),
    registry.searchBAARecords as unknown as Handler
  );

  // getBAARecord
  app.get('/healthcare/compliance/baa-records/:id',
    zValidator('param', validators.GetBAARecordParams, validationErrorHandler),
    registry.getBAARecord as unknown as Handler
  );

  // updateBAARecord
  app.put('/healthcare/compliance/baa-records/:id',
    zValidator('param', validators.UpdateBAARecordParams, validationErrorHandler),
    zValidator('json', validators.UpdateBAARecordBody, validationErrorHandler),
    registry.updateBAARecord as unknown as Handler
  );

  // deleteBAARecord
  app.delete('/healthcare/compliance/baa-records/:id',
    zValidator('param', validators.DeleteBAARecordParams, validationErrorHandler),
    registry.deleteBAARecord as unknown as Handler
  );

  // createCAPARecord
  app.post('/healthcare/compliance/capa',
    zValidator('json', validators.CreateCAPARecordBody, validationErrorHandler),
    registry.createCAPARecord as unknown as Handler
  );

  // searchCAPARecords
  app.get('/healthcare/compliance/capa/search',
    zValidator('query', validators.SearchCAPARecordsQuery, validationErrorHandler),
    registry.searchCAPARecords as unknown as Handler
  );

  // getCAPARecord
  app.get('/healthcare/compliance/capa/:id',
    zValidator('param', validators.GetCAPARecordParams, validationErrorHandler),
    registry.getCAPARecord as unknown as Handler
  );

  // updateCAPARecord
  app.put('/healthcare/compliance/capa/:id',
    zValidator('param', validators.UpdateCAPARecordParams, validationErrorHandler),
    zValidator('json', validators.UpdateCAPARecordBody, validationErrorHandler),
    registry.updateCAPARecord as unknown as Handler
  );

  // deleteCAPARecord
  app.delete('/healthcare/compliance/capa/:id',
    zValidator('param', validators.DeleteCAPARecordParams, validationErrorHandler),
    registry.deleteCAPARecord as unknown as Handler
  );

  // transitionCAPAStatus
  app.post('/healthcare/compliance/capa/:id/status',
    zValidator('param', validators.TransitionCAPAStatusParams, validationErrorHandler),
    zValidator('json', validators.TransitionCAPAStatusBody, validationErrorHandler),
    registry.transitionCAPAStatus as unknown as Handler
  );

  // createRetentionSchedule
  app.post('/healthcare/compliance/data-retention',
    zValidator('json', validators.CreateRetentionScheduleBody, validationErrorHandler),
    registry.createRetentionSchedule as unknown as Handler
  );

  // searchRetentionSchedules
  app.get('/healthcare/compliance/data-retention/search',
    zValidator('query', validators.SearchRetentionSchedulesQuery, validationErrorHandler),
    registry.searchRetentionSchedules as unknown as Handler
  );

  // getRetentionSchedule
  app.get('/healthcare/compliance/data-retention/:id',
    zValidator('param', validators.GetRetentionScheduleParams, validationErrorHandler),
    registry.getRetentionSchedule as unknown as Handler
  );

  // updateRetentionSchedule
  app.put('/healthcare/compliance/data-retention/:id',
    zValidator('param', validators.UpdateRetentionScheduleParams, validationErrorHandler),
    zValidator('json', validators.UpdateRetentionScheduleBody, validationErrorHandler),
    registry.updateRetentionSchedule as unknown as Handler
  );

  // deleteRetentionSchedule
  app.delete('/healthcare/compliance/data-retention/:id',
    zValidator('param', validators.DeleteRetentionScheduleParams, validationErrorHandler),
    registry.deleteRetentionSchedule as unknown as Handler
  );

  // createLegalHold
  app.post('/healthcare/compliance/legal-holds',
    zValidator('json', validators.CreateLegalHoldBody, validationErrorHandler),
    registry.createLegalHold as unknown as Handler
  );

  // searchLegalHolds
  app.get('/healthcare/compliance/legal-holds/search',
    zValidator('query', validators.SearchLegalHoldsQuery, validationErrorHandler),
    registry.searchLegalHolds as unknown as Handler
  );

  // getLegalHold
  app.get('/healthcare/compliance/legal-holds/:id',
    zValidator('param', validators.GetLegalHoldParams, validationErrorHandler),
    registry.getLegalHold as unknown as Handler
  );

  // updateLegalHold
  app.put('/healthcare/compliance/legal-holds/:id',
    zValidator('param', validators.UpdateLegalHoldParams, validationErrorHandler),
    zValidator('json', validators.UpdateLegalHoldBody, validationErrorHandler),
    registry.updateLegalHold as unknown as Handler
  );

  // deleteLegalHold
  app.delete('/healthcare/compliance/legal-holds/:id',
    zValidator('param', validators.DeleteLegalHoldParams, validationErrorHandler),
    registry.deleteLegalHold as unknown as Handler
  );

  // releaseLegalHold
  app.post('/healthcare/compliance/legal-holds/:id/release',
    zValidator('param', validators.ReleaseLegalHoldParams, validationErrorHandler),
    zValidator('json', validators.ReleaseLegalHoldBody, validationErrorHandler),
    registry.releaseLegalHold as unknown as Handler
  );

  // createCompliancePolicy
  app.post('/healthcare/compliance/policies',
    zValidator('json', validators.CreateCompliancePolicyBody, validationErrorHandler),
    registry.createCompliancePolicy as unknown as Handler
  );

  // searchCompliancePolicies
  app.get('/healthcare/compliance/policies/search',
    zValidator('query', validators.SearchCompliancePoliciesQuery, validationErrorHandler),
    registry.searchCompliancePolicies as unknown as Handler
  );

  // getCompliancePolicy
  app.get('/healthcare/compliance/policies/:id',
    zValidator('param', validators.GetCompliancePolicyParams, validationErrorHandler),
    registry.getCompliancePolicy as unknown as Handler
  );

  // updateCompliancePolicy
  app.put('/healthcare/compliance/policies/:id',
    zValidator('param', validators.UpdateCompliancePolicyParams, validationErrorHandler),
    zValidator('json', validators.UpdateCompliancePolicyBody, validationErrorHandler),
    registry.updateCompliancePolicy as unknown as Handler
  );

  // deleteCompliancePolicy
  app.delete('/healthcare/compliance/policies/:id',
    zValidator('param', validators.DeleteCompliancePolicyParams, validationErrorHandler),
    registry.deleteCompliancePolicy as unknown as Handler
  );

  // createAmendmentRequest
  app.post('/healthcare/compliance/privacy/amendments',
    zValidator('json', validators.CreateAmendmentRequestBody, validationErrorHandler),
    registry.createAmendmentRequest as unknown as Handler
  );

  // searchAmendmentRequests
  app.get('/healthcare/compliance/privacy/amendments/search',
    zValidator('query', validators.SearchAmendmentRequestsQuery, validationErrorHandler),
    registry.searchAmendmentRequests as unknown as Handler
  );

  // getAmendmentRequest
  app.get('/healthcare/compliance/privacy/amendments/:id',
    zValidator('param', validators.GetAmendmentRequestParams, validationErrorHandler),
    registry.getAmendmentRequest as unknown as Handler
  );

  // updateAmendmentRequest
  app.put('/healthcare/compliance/privacy/amendments/:id',
    zValidator('param', validators.UpdateAmendmentRequestParams, validationErrorHandler),
    zValidator('json', validators.UpdateAmendmentRequestBody, validationErrorHandler),
    registry.updateAmendmentRequest as unknown as Handler
  );

  // deleteAmendmentRequest
  app.delete('/healthcare/compliance/privacy/amendments/:id',
    zValidator('param', validators.DeleteAmendmentRequestParams, validationErrorHandler),
    registry.deleteAmendmentRequest as unknown as Handler
  );

  // approveAmendmentRequest
  app.post('/healthcare/compliance/privacy/amendments/:id/approve',
    zValidator('param', validators.ApproveAmendmentRequestParams, validationErrorHandler),
    zValidator('json', validators.ApproveAmendmentRequestBody, validationErrorHandler),
    registry.approveAmendmentRequest as unknown as Handler
  );

  // denyAmendmentRequest
  app.post('/healthcare/compliance/privacy/amendments/:id/deny',
    zValidator('param', validators.DenyAmendmentRequestParams, validationErrorHandler),
    zValidator('json', validators.DenyAmendmentRequestBody, validationErrorHandler),
    registry.denyAmendmentRequest as unknown as Handler
  );

  // createBreachAssessment
  app.post('/healthcare/compliance/privacy/breach-assessments',
    zValidator('json', validators.CreateBreachAssessmentBody, validationErrorHandler),
    registry.createBreachAssessment as unknown as Handler
  );

  // searchBreachAssessments
  app.get('/healthcare/compliance/privacy/breach-assessments/search',
    zValidator('query', validators.SearchBreachAssessmentsQuery, validationErrorHandler),
    registry.searchBreachAssessments as unknown as Handler
  );

  // getBreachAssessment
  app.get('/healthcare/compliance/privacy/breach-assessments/:id',
    zValidator('param', validators.GetBreachAssessmentParams, validationErrorHandler),
    registry.getBreachAssessment as unknown as Handler
  );

  // updateBreachAssessment
  app.put('/healthcare/compliance/privacy/breach-assessments/:id',
    zValidator('param', validators.UpdateBreachAssessmentParams, validationErrorHandler),
    zValidator('json', validators.UpdateBreachAssessmentBody, validationErrorHandler),
    registry.updateBreachAssessment as unknown as Handler
  );

  // deleteBreachAssessment
  app.delete('/healthcare/compliance/privacy/breach-assessments/:id',
    zValidator('param', validators.DeleteBreachAssessmentParams, validationErrorHandler),
    registry.deleteBreachAssessment as unknown as Handler
  );

  // createBreachNotification
  app.post('/healthcare/compliance/privacy/breach-notifications',
    zValidator('json', validators.CreateBreachNotificationBody, validationErrorHandler),
    registry.createBreachNotification as unknown as Handler
  );

  // searchBreachNotifications
  app.get('/healthcare/compliance/privacy/breach-notifications/search',
    zValidator('query', validators.SearchBreachNotificationsQuery, validationErrorHandler),
    registry.searchBreachNotifications as unknown as Handler
  );

  // getBreachNotification
  app.get('/healthcare/compliance/privacy/breach-notifications/:id',
    zValidator('param', validators.GetBreachNotificationParams, validationErrorHandler),
    registry.getBreachNotification as unknown as Handler
  );

  // updateBreachNotification
  app.put('/healthcare/compliance/privacy/breach-notifications/:id',
    zValidator('param', validators.UpdateBreachNotificationParams, validationErrorHandler),
    zValidator('json', validators.UpdateBreachNotificationBody, validationErrorHandler),
    registry.updateBreachNotification as unknown as Handler
  );

  // deleteBreachNotification
  app.delete('/healthcare/compliance/privacy/breach-notifications/:id',
    zValidator('param', validators.DeleteBreachNotificationParams, validationErrorHandler),
    registry.deleteBreachNotification as unknown as Handler
  );

  // createPrivacyComplaint
  app.post('/healthcare/compliance/privacy/complaints',
    zValidator('json', validators.CreatePrivacyComplaintBody, validationErrorHandler),
    registry.createPrivacyComplaint as unknown as Handler
  );

  // searchPrivacyComplaints
  app.get('/healthcare/compliance/privacy/complaints/search',
    zValidator('query', validators.SearchPrivacyComplaintsQuery, validationErrorHandler),
    registry.searchPrivacyComplaints as unknown as Handler
  );

  // getPrivacyComplaint
  app.get('/healthcare/compliance/privacy/complaints/:id',
    zValidator('param', validators.GetPrivacyComplaintParams, validationErrorHandler),
    registry.getPrivacyComplaint as unknown as Handler
  );

  // updatePrivacyComplaint
  app.put('/healthcare/compliance/privacy/complaints/:id',
    zValidator('param', validators.UpdatePrivacyComplaintParams, validationErrorHandler),
    zValidator('json', validators.UpdatePrivacyComplaintBody, validationErrorHandler),
    registry.updatePrivacyComplaint as unknown as Handler
  );

  // deletePrivacyComplaint
  app.delete('/healthcare/compliance/privacy/complaints/:id',
    zValidator('param', validators.DeletePrivacyComplaintParams, validationErrorHandler),
    registry.deletePrivacyComplaint as unknown as Handler
  );

  // transitionPrivacyComplaintStatus
  app.post('/healthcare/compliance/privacy/complaints/:id/status',
    zValidator('param', validators.TransitionPrivacyComplaintStatusParams, validationErrorHandler),
    zValidator('json', validators.TransitionPrivacyComplaintStatusBody, validationErrorHandler),
    registry.transitionPrivacyComplaintStatus as unknown as Handler
  );

  // createDisclosureRecord
  app.post('/healthcare/compliance/privacy/disclosures',
    zValidator('json', validators.CreateDisclosureRecordBody, validationErrorHandler),
    registry.createDisclosureRecord as unknown as Handler
  );

  // searchDisclosureRecords
  app.get('/healthcare/compliance/privacy/disclosures/search',
    zValidator('query', validators.SearchDisclosureRecordsQuery, validationErrorHandler),
    registry.searchDisclosureRecords as unknown as Handler
  );

  // getDisclosureRecord
  app.get('/healthcare/compliance/privacy/disclosures/:id',
    zValidator('param', validators.GetDisclosureRecordParams, validationErrorHandler),
    registry.getDisclosureRecord as unknown as Handler
  );

  // createConnector
  app.post('/healthcare/connectors',
    zValidator('json', validators.CreateConnectorBody, validationErrorHandler),
    registry.createConnector as unknown as Handler
  );

  // createConnectorCredential
  app.post('/healthcare/connectors/credentials',
    zValidator('json', validators.CreateConnectorCredentialBody, validationErrorHandler),
    registry.createConnectorCredential as unknown as Handler
  );

  // rotateConnectorCredential
  app.post('/healthcare/connectors/credentials/:id/rotate',
    zValidator('param', validators.RotateConnectorCredentialParams, validationErrorHandler),
    zValidator('json', validators.RotateConnectorCredentialBody, validationErrorHandler),
    registry.rotateConnectorCredential as unknown as Handler
  );

  // searchConnectors
  app.get('/healthcare/connectors/search',
    zValidator('query', validators.SearchConnectorsQuery, validationErrorHandler),
    registry.searchConnectors as unknown as Handler
  );

  // getLatestConnectorSyncLog
  app.get('/healthcare/connectors/sync-logs/latest',
    zValidator('query', validators.GetLatestConnectorSyncLogQuery, validationErrorHandler),
    registry.getLatestConnectorSyncLog as unknown as Handler
  );

  // searchConnectorSyncLogs
  app.get('/healthcare/connectors/sync-logs/search',
    zValidator('query', validators.SearchConnectorSyncLogsQuery, validationErrorHandler),
    registry.searchConnectorSyncLogs as unknown as Handler
  );

  // getConnector
  app.get('/healthcare/connectors/:id',
    zValidator('param', validators.GetConnectorParams, validationErrorHandler),
    registry.getConnector as unknown as Handler
  );

  // updateConnector
  app.put('/healthcare/connectors/:id',
    zValidator('param', validators.UpdateConnectorParams, validationErrorHandler),
    zValidator('json', validators.UpdateConnectorBody, validationErrorHandler),
    registry.updateConnector as unknown as Handler
  );

  // patchConnector
  app.patch('/healthcare/connectors/:id',
    zValidator('param', validators.PatchConnectorParams, validationErrorHandler),
    zValidator('json', validators.PatchConnectorBody, validationErrorHandler),
    registry.patchConnector as unknown as Handler
  );

  // deleteConnector
  app.delete('/healthcare/connectors/:id',
    zValidator('param', validators.DeleteConnectorParams, validationErrorHandler),
    registry.deleteConnector as unknown as Handler
  );

  // getConnectorHealth
  app.get('/healthcare/connectors/:id/health',
    zValidator('param', validators.GetConnectorHealthParams, validationErrorHandler),
    registry.getConnectorHealth as unknown as Handler
  );

  // testConnector
  app.post('/healthcare/connectors/:id/test',
    zValidator('param', validators.TestConnectorParams, validationErrorHandler),
    zValidator('json', validators.TestConnectorBody, validationErrorHandler),
    registry.testConnector as unknown as Handler
  );

  // createConsent
  app.post('/healthcare/consents',
    zValidator('json', validators.CreateConsentBody, validationErrorHandler),
    registry.createConsent as unknown as Handler
  );

  // searchConsents
  app.get('/healthcare/consents/search',
    zValidator('query', validators.SearchConsentsQuery, validationErrorHandler),
    registry.searchConsents as unknown as Handler
  );

  // getConsent
  app.get('/healthcare/consents/:id',
    zValidator('param', validators.GetConsentParams, validationErrorHandler),
    registry.getConsent as unknown as Handler
  );

  // updateConsent
  app.put('/healthcare/consents/:id',
    zValidator('param', validators.UpdateConsentParams, validationErrorHandler),
    zValidator('json', validators.UpdateConsentBody, validationErrorHandler),
    registry.updateConsent as unknown as Handler
  );

  // patchConsent
  app.patch('/healthcare/consents/:id',
    zValidator('param', validators.PatchConsentParams, validationErrorHandler),
    zValidator('json', validators.PatchConsentBody, validationErrorHandler),
    registry.patchConsent as unknown as Handler
  );

  // deleteConsent
  app.delete('/healthcare/consents/:id',
    zValidator('param', validators.DeleteConsentParams, validationErrorHandler),
    registry.deleteConsent as unknown as Handler
  );

  // createClinicalPrivilege
  app.post('/healthcare/credentialing/privileges',
    zValidator('json', validators.CreateClinicalPrivilegeBody, validationErrorHandler),
    registry.createClinicalPrivilege as unknown as Handler
  );

  // searchClinicalPrivileges
  app.get('/healthcare/credentialing/privileges/search',
    zValidator('query', validators.SearchClinicalPrivilegesQuery, validationErrorHandler),
    registry.searchClinicalPrivileges as unknown as Handler
  );

  // getClinicalPrivilege
  app.get('/healthcare/credentialing/privileges/:id',
    zValidator('param', validators.GetClinicalPrivilegeParams, validationErrorHandler),
    registry.getClinicalPrivilege as unknown as Handler
  );

  // updateClinicalPrivilege
  app.put('/healthcare/credentialing/privileges/:id',
    zValidator('param', validators.UpdateClinicalPrivilegeParams, validationErrorHandler),
    zValidator('json', validators.UpdateClinicalPrivilegeBody, validationErrorHandler),
    registry.updateClinicalPrivilege as unknown as Handler
  );

  // deleteClinicalPrivilege
  app.delete('/healthcare/credentialing/privileges/:id',
    zValidator('param', validators.DeleteClinicalPrivilegeParams, validationErrorHandler),
    registry.deleteClinicalPrivilege as unknown as Handler
  );

  // createCredentialingRecord
  app.post('/healthcare/credentialing/records',
    zValidator('json', validators.CreateCredentialingRecordBody, validationErrorHandler),
    registry.createCredentialingRecord as unknown as Handler
  );

  // searchCredentialingRecords
  app.get('/healthcare/credentialing/records/search',
    zValidator('query', validators.SearchCredentialingRecordsQuery, validationErrorHandler),
    registry.searchCredentialingRecords as unknown as Handler
  );

  // getCredentialingRecord
  app.get('/healthcare/credentialing/records/:id',
    zValidator('param', validators.GetCredentialingRecordParams, validationErrorHandler),
    registry.getCredentialingRecord as unknown as Handler
  );

  // updateCredentialingRecord
  app.put('/healthcare/credentialing/records/:id',
    zValidator('param', validators.UpdateCredentialingRecordParams, validationErrorHandler),
    zValidator('json', validators.UpdateCredentialingRecordBody, validationErrorHandler),
    registry.updateCredentialingRecord as unknown as Handler
  );

  // deleteCredentialingRecord
  app.delete('/healthcare/credentialing/records/:id',
    zValidator('param', validators.DeleteCredentialingRecordParams, validationErrorHandler),
    registry.deleteCredentialingRecord as unknown as Handler
  );

  // createImportJob
  app.post('/healthcare/data-import/jobs',
    zValidator('json', validators.CreateImportJobBody, validationErrorHandler),
    registry.createImportJob as unknown as Handler
  );

  // getImportJobStatus
  app.get('/healthcare/data-import/jobs/:id',
    zValidator('param', validators.GetImportJobStatusParams, validationErrorHandler),
    registry.getImportJobStatus as unknown as Handler
  );

  // cancelImportJob
  app.post('/healthcare/data-import/jobs/:id/cancel',
    zValidator('param', validators.CancelImportJobParams, validationErrorHandler),
    zValidator('json', validators.CancelImportJobBody, validationErrorHandler),
    registry.cancelImportJob as unknown as Handler
  );

  // getImportJobErrors
  app.get('/healthcare/data-import/jobs/:id/errors',
    zValidator('param', validators.GetImportJobErrorsParams, validationErrorHandler),
    zValidator('query', validators.GetImportJobErrorsQuery, validationErrorHandler),
    registry.getImportJobErrors as unknown as Handler
  );

  // executeImportJob
  app.post('/healthcare/data-import/jobs/:id/execute',
    zValidator('param', validators.ExecuteImportJobParams, validationErrorHandler),
    zValidator('json', validators.ExecuteImportJobBody, validationErrorHandler),
    registry.executeImportJob as unknown as Handler
  );

  // uploadImportFile
  app.post('/healthcare/data-import/jobs/:id/upload',
    zValidator('param', validators.UploadImportFileParams, validationErrorHandler),
    zValidator('json', validators.UploadImportFileBody, validationErrorHandler),
    registry.uploadImportFile as unknown as Handler
  );

  // validateImportJob
  app.post('/healthcare/data-import/jobs/:id/validate',
    zValidator('param', validators.ValidateImportJobParams, validationErrorHandler),
    registry.validateImportJob as unknown as Handler
  );

  // createImportMapping
  app.post('/healthcare/data-import/mappings',
    zValidator('json', validators.CreateImportMappingBody, validationErrorHandler),
    registry.createImportMapping as unknown as Handler
  );

  // searchImportMappings
  app.get('/healthcare/data-import/mappings/search',
    zValidator('query', validators.SearchImportMappingsQuery, validationErrorHandler),
    registry.searchImportMappings as unknown as Handler
  );

  // getImportMapping
  app.get('/healthcare/data-import/mappings/:id',
    zValidator('param', validators.GetImportMappingParams, validationErrorHandler),
    registry.getImportMapping as unknown as Handler
  );

  // updateImportMapping
  app.put('/healthcare/data-import/mappings/:id',
    zValidator('param', validators.UpdateImportMappingParams, validationErrorHandler),
    zValidator('json', validators.UpdateImportMappingBody, validationErrorHandler),
    registry.updateImportMapping as unknown as Handler
  );

  // patchImportMapping
  app.patch('/healthcare/data-import/mappings/:id',
    zValidator('param', validators.PatchImportMappingParams, validationErrorHandler),
    zValidator('json', validators.PatchImportMappingBody, validationErrorHandler),
    registry.patchImportMapping as unknown as Handler
  );

  // deleteImportMapping
  app.delete('/healthcare/data-import/mappings/:id',
    zValidator('param', validators.DeleteImportMappingParams, validationErrorHandler),
    registry.deleteImportMapping as unknown as Handler
  );

  // createCosmeticCase
  app.post('/healthcare/dental/cosmetic/cases',
    zValidator('json', validators.CreateCosmeticCaseBody, validationErrorHandler),
    registry.createCosmeticCase as unknown as Handler
  );

  // searchCosmeticCases
  app.get('/healthcare/dental/cosmetic/cases/search',
    zValidator('query', validators.SearchCosmeticCasesQuery, validationErrorHandler),
    registry.searchCosmeticCases as unknown as Handler
  );

  // getCosmeticCase
  app.get('/healthcare/dental/cosmetic/cases/:id',
    zValidator('param', validators.GetCosmeticCaseParams, validationErrorHandler),
    registry.getCosmeticCase as unknown as Handler
  );

  // updateCosmeticCase
  app.put('/healthcare/dental/cosmetic/cases/:id',
    zValidator('param', validators.UpdateCosmeticCaseParams, validationErrorHandler),
    zValidator('json', validators.UpdateCosmeticCaseBody, validationErrorHandler),
    registry.updateCosmeticCase as unknown as Handler
  );

  // deleteCosmeticCase
  app.delete('/healthcare/dental/cosmetic/cases/:id',
    zValidator('param', validators.DeleteCosmeticCaseParams, validationErrorHandler),
    registry.deleteCosmeticCase as unknown as Handler
  );

  // transitionCosmeticCaseStatus
  app.post('/healthcare/dental/cosmetic/cases/:id/status',
    zValidator('param', validators.TransitionCosmeticCaseStatusParams, validationErrorHandler),
    zValidator('json', validators.TransitionCosmeticCaseStatusBody, validationErrorHandler),
    registry.transitionCosmeticCaseStatus as unknown as Handler
  );

  // createBeforeAfterPhoto
  app.post('/healthcare/dental/cosmetic/photos',
    zValidator('json', validators.CreateBeforeAfterPhotoBody, validationErrorHandler),
    registry.createBeforeAfterPhoto as unknown as Handler
  );

  // searchBeforeAfterPhotos
  app.get('/healthcare/dental/cosmetic/photos/search',
    zValidator('query', validators.SearchBeforeAfterPhotosQuery, validationErrorHandler),
    registry.searchBeforeAfterPhotos as unknown as Handler
  );

  // getBeforeAfterPhoto
  app.get('/healthcare/dental/cosmetic/photos/:id',
    zValidator('param', validators.GetBeforeAfterPhotoParams, validationErrorHandler),
    registry.getBeforeAfterPhoto as unknown as Handler
  );

  // updateBeforeAfterPhoto
  app.put('/healthcare/dental/cosmetic/photos/:id',
    zValidator('param', validators.UpdateBeforeAfterPhotoParams, validationErrorHandler),
    zValidator('json', validators.UpdateBeforeAfterPhotoBody, validationErrorHandler),
    registry.updateBeforeAfterPhoto as unknown as Handler
  );

  // deleteBeforeAfterPhoto
  app.delete('/healthcare/dental/cosmetic/photos/:id',
    zValidator('param', validators.DeleteBeforeAfterPhotoParams, validationErrorHandler),
    registry.deleteBeforeAfterPhoto as unknown as Handler
  );

  // createSmileDesign
  app.post('/healthcare/dental/cosmetic/smile-designs',
    zValidator('json', validators.CreateSmileDesignBody, validationErrorHandler),
    registry.createSmileDesign as unknown as Handler
  );

  // getSmileDesign
  app.get('/healthcare/dental/cosmetic/smile-designs/:id',
    zValidator('param', validators.GetSmileDesignParams, validationErrorHandler),
    registry.getSmileDesign as unknown as Handler
  );

  // updateSmileDesign
  app.put('/healthcare/dental/cosmetic/smile-designs/:id',
    zValidator('param', validators.UpdateSmileDesignParams, validationErrorHandler),
    zValidator('json', validators.UpdateSmileDesignBody, validationErrorHandler),
    registry.updateSmileDesign as unknown as Handler
  );

  // deleteSmileDesign
  app.delete('/healthcare/dental/cosmetic/smile-designs/:id',
    zValidator('param', validators.DeleteSmileDesignParams, validationErrorHandler),
    registry.deleteSmileDesign as unknown as Handler
  );

  // createVeneerRecord
  app.post('/healthcare/dental/cosmetic/veneers',
    zValidator('json', validators.CreateVeneerRecordBody, validationErrorHandler),
    registry.createVeneerRecord as unknown as Handler
  );

  // searchVeneerRecords
  app.get('/healthcare/dental/cosmetic/veneers/search',
    zValidator('query', validators.SearchVeneerRecordsQuery, validationErrorHandler),
    registry.searchVeneerRecords as unknown as Handler
  );

  // getVeneerRecord
  app.get('/healthcare/dental/cosmetic/veneers/:id',
    zValidator('param', validators.GetVeneerRecordParams, validationErrorHandler),
    registry.getVeneerRecord as unknown as Handler
  );

  // updateVeneerRecord
  app.put('/healthcare/dental/cosmetic/veneers/:id',
    zValidator('param', validators.UpdateVeneerRecordParams, validationErrorHandler),
    zValidator('json', validators.UpdateVeneerRecordBody, validationErrorHandler),
    registry.updateVeneerRecord as unknown as Handler
  );

  // deleteVeneerRecord
  app.delete('/healthcare/dental/cosmetic/veneers/:id',
    zValidator('param', validators.DeleteVeneerRecordParams, validationErrorHandler),
    registry.deleteVeneerRecord as unknown as Handler
  );

  // createWhiteningRecord
  app.post('/healthcare/dental/cosmetic/whitening',
    zValidator('json', validators.CreateWhiteningRecordBody, validationErrorHandler),
    registry.createWhiteningRecord as unknown as Handler
  );

  // searchWhiteningRecords
  app.get('/healthcare/dental/cosmetic/whitening/search',
    zValidator('query', validators.SearchWhiteningRecordsQuery, validationErrorHandler),
    registry.searchWhiteningRecords as unknown as Handler
  );

  // getWhiteningRecord
  app.get('/healthcare/dental/cosmetic/whitening/:id',
    zValidator('param', validators.GetWhiteningRecordParams, validationErrorHandler),
    registry.getWhiteningRecord as unknown as Handler
  );

  // updateWhiteningRecord
  app.put('/healthcare/dental/cosmetic/whitening/:id',
    zValidator('param', validators.UpdateWhiteningRecordParams, validationErrorHandler),
    zValidator('json', validators.UpdateWhiteningRecordBody, validationErrorHandler),
    registry.updateWhiteningRecord as unknown as Handler
  );

  // deleteWhiteningRecord
  app.delete('/healthcare/dental/cosmetic/whitening/:id',
    zValidator('param', validators.DeleteWhiteningRecordParams, validationErrorHandler),
    registry.deleteWhiteningRecord as unknown as Handler
  );

  // createIrrigationRecord
  app.post('/healthcare/dental/endodontic/irrigations',
    zValidator('json', validators.CreateIrrigationRecordBody, validationErrorHandler),
    registry.createIrrigationRecord as unknown as Handler
  );

  // getIrrigationRecord
  app.get('/healthcare/dental/endodontic/irrigations/:id',
    zValidator('param', validators.GetIrrigationRecordParams, validationErrorHandler),
    registry.getIrrigationRecord as unknown as Handler
  );

  // updateIrrigationRecord
  app.put('/healthcare/dental/endodontic/irrigations/:id',
    zValidator('param', validators.UpdateIrrigationRecordParams, validationErrorHandler),
    zValidator('json', validators.UpdateIrrigationRecordBody, validationErrorHandler),
    registry.updateIrrigationRecord as unknown as Handler
  );

  // deleteIrrigationRecord
  app.delete('/healthcare/dental/endodontic/irrigations/:id',
    zValidator('param', validators.DeleteIrrigationRecordParams, validationErrorHandler),
    registry.deleteIrrigationRecord as unknown as Handler
  );

  // createEndoRecord
  app.post('/healthcare/dental/endodontic/records',
    zValidator('json', validators.CreateEndoRecordBody, validationErrorHandler),
    registry.createEndoRecord as unknown as Handler
  );

  // searchEndoRecords
  app.get('/healthcare/dental/endodontic/records',
    zValidator('query', validators.SearchEndoRecordsQuery, validationErrorHandler),
    zValidator('json', validators.SearchEndoRecordsBody, validationErrorHandler),
    registry.searchEndoRecords as unknown as Handler
  );

  // getEndoRecord
  app.get('/healthcare/dental/endodontic/records/:id',
    zValidator('param', validators.GetEndoRecordParams, validationErrorHandler),
    registry.getEndoRecord as unknown as Handler
  );

  // updateEndoRecord
  app.put('/healthcare/dental/endodontic/records/:id',
    zValidator('param', validators.UpdateEndoRecordParams, validationErrorHandler),
    zValidator('json', validators.UpdateEndoRecordBody, validationErrorHandler),
    registry.updateEndoRecord as unknown as Handler
  );

  // deleteEndoRecord
  app.delete('/healthcare/dental/endodontic/records/:id',
    zValidator('param', validators.DeleteEndoRecordParams, validationErrorHandler),
    registry.deleteEndoRecord as unknown as Handler
  );

  // transitionEndoRecordStatus
  app.post('/healthcare/dental/endodontic/records/:id/status',
    zValidator('param', validators.TransitionEndoRecordStatusParams, validationErrorHandler),
    zValidator('json', validators.TransitionEndoRecordStatusBody, validationErrorHandler),
    registry.transitionEndoRecordStatus as unknown as Handler
  );

  // createEndoRetreatment
  app.post('/healthcare/dental/endodontic/retreatments',
    zValidator('json', validators.CreateEndoRetreatmentBody, validationErrorHandler),
    registry.createEndoRetreatment as unknown as Handler
  );

  // searchEndoRetreatments
  app.get('/healthcare/dental/endodontic/retreatments',
    zValidator('query', validators.SearchEndoRetreatmentsQuery, validationErrorHandler),
    zValidator('json', validators.SearchEndoRetreatmentsBody, validationErrorHandler),
    registry.searchEndoRetreatments as unknown as Handler
  );

  // getEndoRetreatment
  app.get('/healthcare/dental/endodontic/retreatments/:id',
    zValidator('param', validators.GetEndoRetreatmentParams, validationErrorHandler),
    registry.getEndoRetreatment as unknown as Handler
  );

  // updateEndoRetreatment
  app.put('/healthcare/dental/endodontic/retreatments/:id',
    zValidator('param', validators.UpdateEndoRetreatmentParams, validationErrorHandler),
    zValidator('json', validators.UpdateEndoRetreatmentBody, validationErrorHandler),
    registry.updateEndoRetreatment as unknown as Handler
  );

  // deleteEndoRetreatment
  app.delete('/healthcare/dental/endodontic/retreatments/:id',
    zValidator('param', validators.DeleteEndoRetreatmentParams, validationErrorHandler),
    registry.deleteEndoRetreatment as unknown as Handler
  );

  // createDentalLabCase
  app.post('/healthcare/dental/lab/cases',
    zValidator('json', validators.CreateDentalLabCaseBody, validationErrorHandler),
    registry.createDentalLabCase as unknown as Handler
  );

  // searchDentalLabCases
  app.get('/healthcare/dental/lab/cases',
    zValidator('query', validators.SearchDentalLabCasesQuery, validationErrorHandler),
    zValidator('json', validators.SearchDentalLabCasesBody, validationErrorHandler),
    registry.searchDentalLabCases as unknown as Handler
  );

  // getDentalLabCase
  app.get('/healthcare/dental/lab/cases/:id',
    zValidator('param', validators.GetDentalLabCaseParams, validationErrorHandler),
    registry.getDentalLabCase as unknown as Handler
  );

  // updateDentalLabCase
  app.put('/healthcare/dental/lab/cases/:id',
    zValidator('param', validators.UpdateDentalLabCaseParams, validationErrorHandler),
    zValidator('json', validators.UpdateDentalLabCaseBody, validationErrorHandler),
    registry.updateDentalLabCase as unknown as Handler
  );

  // deleteDentalLabCase
  app.delete('/healthcare/dental/lab/cases/:id',
    zValidator('param', validators.DeleteDentalLabCaseParams, validationErrorHandler),
    registry.deleteDentalLabCase as unknown as Handler
  );

  // receiveDentalLabCase
  app.post('/healthcare/dental/lab/cases/:id/receive',
    zValidator('param', validators.ReceiveDentalLabCaseParams, validationErrorHandler),
    zValidator('json', validators.ReceiveDentalLabCaseBody, validationErrorHandler),
    registry.receiveDentalLabCase as unknown as Handler
  );

  // returnDentalLabCase
  app.post('/healthcare/dental/lab/cases/:id/return',
    zValidator('param', validators.ReturnDentalLabCaseParams, validationErrorHandler),
    zValidator('json', validators.ReturnDentalLabCaseBody, validationErrorHandler),
    registry.returnDentalLabCase as unknown as Handler
  );

  // createLabCommunicationNote
  app.post('/healthcare/dental/lab/communications',
    zValidator('json', validators.CreateLabCommunicationNoteBody, validationErrorHandler),
    registry.createLabCommunicationNote as unknown as Handler
  );

  // getLabCommunicationNote
  app.get('/healthcare/dental/lab/communications/:id',
    zValidator('param', validators.GetLabCommunicationNoteParams, validationErrorHandler),
    registry.getLabCommunicationNote as unknown as Handler
  );

  // updateLabCommunicationNote
  app.put('/healthcare/dental/lab/communications/:id',
    zValidator('param', validators.UpdateLabCommunicationNoteParams, validationErrorHandler),
    zValidator('json', validators.UpdateLabCommunicationNoteBody, validationErrorHandler),
    registry.updateLabCommunicationNote as unknown as Handler
  );

  // deleteLabCommunicationNote
  app.delete('/healthcare/dental/lab/communications/:id',
    zValidator('param', validators.DeleteLabCommunicationNoteParams, validationErrorHandler),
    registry.deleteLabCommunicationNote as unknown as Handler
  );

  // createDentalLabProvider
  app.post('/healthcare/dental/lab/providers',
    zValidator('json', validators.CreateDentalLabProviderBody, validationErrorHandler),
    registry.createDentalLabProvider as unknown as Handler
  );

  // searchDentalLabProviders
  app.get('/healthcare/dental/lab/providers',
    zValidator('query', validators.SearchDentalLabProvidersQuery, validationErrorHandler),
    zValidator('json', validators.SearchDentalLabProvidersBody, validationErrorHandler),
    registry.searchDentalLabProviders as unknown as Handler
  );

  // getDentalLabProvider
  app.get('/healthcare/dental/lab/providers/:id',
    zValidator('param', validators.GetDentalLabProviderParams, validationErrorHandler),
    registry.getDentalLabProvider as unknown as Handler
  );

  // updateDentalLabProvider
  app.put('/healthcare/dental/lab/providers/:id',
    zValidator('param', validators.UpdateDentalLabProviderParams, validationErrorHandler),
    zValidator('json', validators.UpdateDentalLabProviderBody, validationErrorHandler),
    registry.updateDentalLabProvider as unknown as Handler
  );

  // deleteDentalLabProvider
  app.delete('/healthcare/dental/lab/providers/:id',
    zValidator('param', validators.DeleteDentalLabProviderParams, validationErrorHandler),
    registry.deleteDentalLabProvider as unknown as Handler
  );

  // createOdontogram
  app.post('/healthcare/dental/odontograms',
    zValidator('json', validators.CreateOdontogramBody, validationErrorHandler),
    registry.createOdontogram as unknown as Handler
  );

  // searchOdontograms
  app.get('/healthcare/dental/odontograms',
    zValidator('query', validators.SearchOdontogramsQuery, validationErrorHandler),
    zValidator('json', validators.SearchOdontogramsBody, validationErrorHandler),
    registry.searchOdontograms as unknown as Handler
  );

  // getOdontogram
  app.get('/healthcare/dental/odontograms/:id',
    zValidator('param', validators.GetOdontogramParams, validationErrorHandler),
    registry.getOdontogram as unknown as Handler
  );

  // updateOdontogram
  app.put('/healthcare/dental/odontograms/:id',
    zValidator('param', validators.UpdateOdontogramParams, validationErrorHandler),
    zValidator('json', validators.UpdateOdontogramBody, validationErrorHandler),
    registry.updateOdontogram as unknown as Handler
  );

  // deleteOdontogram
  app.delete('/healthcare/dental/odontograms/:id',
    zValidator('param', validators.DeleteOdontogramParams, validationErrorHandler),
    registry.deleteOdontogram as unknown as Handler
  );

  // createExtractionRecord
  app.post('/healthcare/dental/oral-surgery/extractions',
    zValidator('json', validators.CreateExtractionRecordBody, validationErrorHandler),
    registry.createExtractionRecord as unknown as Handler
  );

  // searchExtractionRecords
  app.get('/healthcare/dental/oral-surgery/extractions/search',
    zValidator('query', validators.SearchExtractionRecordsQuery, validationErrorHandler),
    registry.searchExtractionRecords as unknown as Handler
  );

  // getExtractionRecord
  app.get('/healthcare/dental/oral-surgery/extractions/:id',
    zValidator('param', validators.GetExtractionRecordParams, validationErrorHandler),
    registry.getExtractionRecord as unknown as Handler
  );

  // updateExtractionRecord
  app.put('/healthcare/dental/oral-surgery/extractions/:id',
    zValidator('param', validators.UpdateExtractionRecordParams, validationErrorHandler),
    zValidator('json', validators.UpdateExtractionRecordBody, validationErrorHandler),
    registry.updateExtractionRecord as unknown as Handler
  );

  // deleteExtractionRecord
  app.delete('/healthcare/dental/oral-surgery/extractions/:id',
    zValidator('param', validators.DeleteExtractionRecordParams, validationErrorHandler),
    registry.deleteExtractionRecord as unknown as Handler
  );

  // createHealingFollowUp
  app.post('/healthcare/dental/oral-surgery/healing',
    zValidator('json', validators.CreateHealingFollowUpBody, validationErrorHandler),
    registry.createHealingFollowUp as unknown as Handler
  );

  // searchHealingFollowUps
  app.get('/healthcare/dental/oral-surgery/healing/search',
    zValidator('query', validators.SearchHealingFollowUpsQuery, validationErrorHandler),
    registry.searchHealingFollowUps as unknown as Handler
  );

  // getHealingFollowUp
  app.get('/healthcare/dental/oral-surgery/healing/:id',
    zValidator('param', validators.GetHealingFollowUpParams, validationErrorHandler),
    registry.getHealingFollowUp as unknown as Handler
  );

  // updateHealingFollowUp
  app.put('/healthcare/dental/oral-surgery/healing/:id',
    zValidator('param', validators.UpdateHealingFollowUpParams, validationErrorHandler),
    zValidator('json', validators.UpdateHealingFollowUpBody, validationErrorHandler),
    registry.updateHealingFollowUp as unknown as Handler
  );

  // deleteHealingFollowUp
  app.delete('/healthcare/dental/oral-surgery/healing/:id',
    zValidator('param', validators.DeleteHealingFollowUpParams, validationErrorHandler),
    registry.deleteHealingFollowUp as unknown as Handler
  );

  // createDentalPathologySpecimen
  app.post('/healthcare/dental/oral-surgery/pathology',
    zValidator('json', validators.CreateDentalPathologySpecimenBody, validationErrorHandler),
    registry.createDentalPathologySpecimen as unknown as Handler
  );

  // searchDentalPathologySpecimens
  app.get('/healthcare/dental/oral-surgery/pathology/search',
    zValidator('query', validators.SearchDentalPathologySpecimensQuery, validationErrorHandler),
    registry.searchDentalPathologySpecimens as unknown as Handler
  );

  // getDentalPathologySpecimen
  app.get('/healthcare/dental/oral-surgery/pathology/:id',
    zValidator('param', validators.GetDentalPathologySpecimenParams, validationErrorHandler),
    registry.getDentalPathologySpecimen as unknown as Handler
  );

  // updateDentalPathologySpecimen
  app.put('/healthcare/dental/oral-surgery/pathology/:id',
    zValidator('param', validators.UpdateDentalPathologySpecimenParams, validationErrorHandler),
    zValidator('json', validators.UpdateDentalPathologySpecimenBody, validationErrorHandler),
    registry.updateDentalPathologySpecimen as unknown as Handler
  );

  // deleteDentalPathologySpecimen
  app.delete('/healthcare/dental/oral-surgery/pathology/:id',
    zValidator('param', validators.DeleteDentalPathologySpecimenParams, validationErrorHandler),
    registry.deleteDentalPathologySpecimen as unknown as Handler
  );

  // createPostOpInstruction
  app.post('/healthcare/dental/oral-surgery/post-op',
    zValidator('json', validators.CreatePostOpInstructionBody, validationErrorHandler),
    registry.createPostOpInstruction as unknown as Handler
  );

  // searchPostOpInstructions
  app.get('/healthcare/dental/oral-surgery/post-op/search',
    zValidator('query', validators.SearchPostOpInstructionsQuery, validationErrorHandler),
    registry.searchPostOpInstructions as unknown as Handler
  );

  // getPostOpInstruction
  app.get('/healthcare/dental/oral-surgery/post-op/:id',
    zValidator('param', validators.GetPostOpInstructionParams, validationErrorHandler),
    registry.getPostOpInstruction as unknown as Handler
  );

  // updatePostOpInstruction
  app.put('/healthcare/dental/oral-surgery/post-op/:id',
    zValidator('param', validators.UpdatePostOpInstructionParams, validationErrorHandler),
    zValidator('json', validators.UpdatePostOpInstructionBody, validationErrorHandler),
    registry.updatePostOpInstruction as unknown as Handler
  );

  // deletePostOpInstruction
  app.delete('/healthcare/dental/oral-surgery/post-op/:id',
    zValidator('param', validators.DeletePostOpInstructionParams, validationErrorHandler),
    registry.deletePostOpInstruction as unknown as Handler
  );

  // createAlignerSeries
  app.post('/healthcare/dental/orthodontic/aligners',
    zValidator('json', validators.CreateAlignerSeriesBody, validationErrorHandler),
    registry.createAlignerSeries as unknown as Handler
  );

  // getAlignerSeries
  app.get('/healthcare/dental/orthodontic/aligners/:id',
    zValidator('param', validators.GetAlignerSeriesParams, validationErrorHandler),
    registry.getAlignerSeries as unknown as Handler
  );

  // updateAlignerSeries
  app.put('/healthcare/dental/orthodontic/aligners/:id',
    zValidator('param', validators.UpdateAlignerSeriesParams, validationErrorHandler),
    zValidator('json', validators.UpdateAlignerSeriesBody, validationErrorHandler),
    registry.updateAlignerSeries as unknown as Handler
  );

  // deleteAlignerSeries
  app.delete('/healthcare/dental/orthodontic/aligners/:id',
    zValidator('param', validators.DeleteAlignerSeriesParams, validationErrorHandler),
    registry.deleteAlignerSeries as unknown as Handler
  );

  // advanceAlignerTray
  app.post('/healthcare/dental/orthodontic/aligners/:id/advance-tray',
    zValidator('param', validators.AdvanceAlignerTrayParams, validationErrorHandler),
    zValidator('json', validators.AdvanceAlignerTrayBody, validationErrorHandler),
    registry.advanceAlignerTray as unknown as Handler
  );

  // createOrthoCase
  app.post('/healthcare/dental/orthodontic/cases',
    zValidator('json', validators.CreateOrthoCaseBody, validationErrorHandler),
    registry.createOrthoCase as unknown as Handler
  );

  // searchOrthoCases
  app.get('/healthcare/dental/orthodontic/cases',
    zValidator('query', validators.SearchOrthoCasesQuery, validationErrorHandler),
    zValidator('json', validators.SearchOrthoCasesBody, validationErrorHandler),
    registry.searchOrthoCases as unknown as Handler
  );

  // getOrthoCase
  app.get('/healthcare/dental/orthodontic/cases/:id',
    zValidator('param', validators.GetOrthoCaseParams, validationErrorHandler),
    registry.getOrthoCase as unknown as Handler
  );

  // updateOrthoCase
  app.put('/healthcare/dental/orthodontic/cases/:id',
    zValidator('param', validators.UpdateOrthoCaseParams, validationErrorHandler),
    zValidator('json', validators.UpdateOrthoCaseBody, validationErrorHandler),
    registry.updateOrthoCase as unknown as Handler
  );

  // deleteOrthoCase
  app.delete('/healthcare/dental/orthodontic/cases/:id',
    zValidator('param', validators.DeleteOrthoCaseParams, validationErrorHandler),
    registry.deleteOrthoCase as unknown as Handler
  );

  // transitionOrthoCaseStatus
  app.post('/healthcare/dental/orthodontic/cases/:id/status',
    zValidator('param', validators.TransitionOrthoCaseStatusParams, validationErrorHandler),
    zValidator('json', validators.TransitionOrthoCaseStatusBody, validationErrorHandler),
    registry.transitionOrthoCaseStatus as unknown as Handler
  );

  // createOrthoProgressRecord
  app.post('/healthcare/dental/orthodontic/progress',
    zValidator('json', validators.CreateOrthoProgressRecordBody, validationErrorHandler),
    registry.createOrthoProgressRecord as unknown as Handler
  );

  // getOrthoProgressRecord
  app.get('/healthcare/dental/orthodontic/progress/:id',
    zValidator('param', validators.GetOrthoProgressRecordParams, validationErrorHandler),
    registry.getOrthoProgressRecord as unknown as Handler
  );

  // updateOrthoProgressRecord
  app.put('/healthcare/dental/orthodontic/progress/:id',
    zValidator('param', validators.UpdateOrthoProgressRecordParams, validationErrorHandler),
    zValidator('json', validators.UpdateOrthoProgressRecordBody, validationErrorHandler),
    registry.updateOrthoProgressRecord as unknown as Handler
  );

  // deleteOrthoProgressRecord
  app.delete('/healthcare/dental/orthodontic/progress/:id',
    zValidator('param', validators.DeleteOrthoProgressRecordParams, validationErrorHandler),
    registry.deleteOrthoProgressRecord as unknown as Handler
  );

  // createOrthoStage
  app.post('/healthcare/dental/orthodontic/stages',
    zValidator('json', validators.CreateOrthoStageBody, validationErrorHandler),
    registry.createOrthoStage as unknown as Handler
  );

  // getOrthoStage
  app.get('/healthcare/dental/orthodontic/stages/:id',
    zValidator('param', validators.GetOrthoStageParams, validationErrorHandler),
    registry.getOrthoStage as unknown as Handler
  );

  // updateOrthoStage
  app.put('/healthcare/dental/orthodontic/stages/:id',
    zValidator('param', validators.UpdateOrthoStageParams, validationErrorHandler),
    zValidator('json', validators.UpdateOrthoStageBody, validationErrorHandler),
    registry.updateOrthoStage as unknown as Handler
  );

  // deleteOrthoStage
  app.delete('/healthcare/dental/orthodontic/stages/:id',
    zValidator('param', validators.DeleteOrthoStageParams, validationErrorHandler),
    registry.deleteOrthoStage as unknown as Handler
  );

  // createBehaviorAssessment
  app.post('/healthcare/dental/pediatric/behavior',
    zValidator('json', validators.CreateBehaviorAssessmentBody, validationErrorHandler),
    registry.createBehaviorAssessment as unknown as Handler
  );

  // searchBehaviorAssessments
  app.get('/healthcare/dental/pediatric/behavior',
    zValidator('query', validators.SearchBehaviorAssessmentsQuery, validationErrorHandler),
    zValidator('json', validators.SearchBehaviorAssessmentsBody, validationErrorHandler),
    registry.searchBehaviorAssessments as unknown as Handler
  );

  // getBehaviorAssessment
  app.get('/healthcare/dental/pediatric/behavior/:id',
    zValidator('param', validators.GetBehaviorAssessmentParams, validationErrorHandler),
    registry.getBehaviorAssessment as unknown as Handler
  );

  // updateBehaviorAssessment
  app.put('/healthcare/dental/pediatric/behavior/:id',
    zValidator('param', validators.UpdateBehaviorAssessmentParams, validationErrorHandler),
    zValidator('json', validators.UpdateBehaviorAssessmentBody, validationErrorHandler),
    registry.updateBehaviorAssessment as unknown as Handler
  );

  // deleteBehaviorAssessment
  app.delete('/healthcare/dental/pediatric/behavior/:id',
    zValidator('param', validators.DeleteBehaviorAssessmentParams, validationErrorHandler),
    registry.deleteBehaviorAssessment as unknown as Handler
  );

  // createEruptionRecord
  app.post('/healthcare/dental/pediatric/eruptions',
    zValidator('json', validators.CreateEruptionRecordBody, validationErrorHandler),
    registry.createEruptionRecord as unknown as Handler
  );

  // getEruptionRecord
  app.get('/healthcare/dental/pediatric/eruptions/:id',
    zValidator('param', validators.GetEruptionRecordParams, validationErrorHandler),
    registry.getEruptionRecord as unknown as Handler
  );

  // updateEruptionRecord
  app.put('/healthcare/dental/pediatric/eruptions/:id',
    zValidator('param', validators.UpdateEruptionRecordParams, validationErrorHandler),
    zValidator('json', validators.UpdateEruptionRecordBody, validationErrorHandler),
    registry.updateEruptionRecord as unknown as Handler
  );

  // deleteEruptionRecord
  app.delete('/healthcare/dental/pediatric/eruptions/:id',
    zValidator('param', validators.DeleteEruptionRecordParams, validationErrorHandler),
    registry.deleteEruptionRecord as unknown as Handler
  );

  // createExfoliationRecord
  app.post('/healthcare/dental/pediatric/exfoliations',
    zValidator('json', validators.CreateExfoliationRecordBody, validationErrorHandler),
    registry.createExfoliationRecord as unknown as Handler
  );

  // getExfoliationRecord
  app.get('/healthcare/dental/pediatric/exfoliations/:id',
    zValidator('param', validators.GetExfoliationRecordParams, validationErrorHandler),
    registry.getExfoliationRecord as unknown as Handler
  );

  // updateExfoliationRecord
  app.put('/healthcare/dental/pediatric/exfoliations/:id',
    zValidator('param', validators.UpdateExfoliationRecordParams, validationErrorHandler),
    zValidator('json', validators.UpdateExfoliationRecordBody, validationErrorHandler),
    registry.updateExfoliationRecord as unknown as Handler
  );

  // deleteExfoliationRecord
  app.delete('/healthcare/dental/pediatric/exfoliations/:id',
    zValidator('param', validators.DeleteExfoliationRecordParams, validationErrorHandler),
    registry.deleteExfoliationRecord as unknown as Handler
  );

  // createFluorideApplication
  app.post('/healthcare/dental/pediatric/fluoride',
    zValidator('json', validators.CreateFluorideApplicationBody, validationErrorHandler),
    registry.createFluorideApplication as unknown as Handler
  );

  // searchFluorideApplications
  app.get('/healthcare/dental/pediatric/fluoride',
    zValidator('query', validators.SearchFluorideApplicationsQuery, validationErrorHandler),
    zValidator('json', validators.SearchFluorideApplicationsBody, validationErrorHandler),
    registry.searchFluorideApplications as unknown as Handler
  );

  // getFluorideApplication
  app.get('/healthcare/dental/pediatric/fluoride/:id',
    zValidator('param', validators.GetFluorideApplicationParams, validationErrorHandler),
    registry.getFluorideApplication as unknown as Handler
  );

  // updateFluorideApplication
  app.put('/healthcare/dental/pediatric/fluoride/:id',
    zValidator('param', validators.UpdateFluorideApplicationParams, validationErrorHandler),
    zValidator('json', validators.UpdateFluorideApplicationBody, validationErrorHandler),
    registry.updateFluorideApplication as unknown as Handler
  );

  // deleteFluorideApplication
  app.delete('/healthcare/dental/pediatric/fluoride/:id',
    zValidator('param', validators.DeleteFluorideApplicationParams, validationErrorHandler),
    registry.deleteFluorideApplication as unknown as Handler
  );

  // createSealantRecord
  app.post('/healthcare/dental/pediatric/sealants',
    zValidator('json', validators.CreateSealantRecordBody, validationErrorHandler),
    registry.createSealantRecord as unknown as Handler
  );

  // searchSealantRecords
  app.get('/healthcare/dental/pediatric/sealants',
    zValidator('query', validators.SearchSealantRecordsQuery, validationErrorHandler),
    zValidator('json', validators.SearchSealantRecordsBody, validationErrorHandler),
    registry.searchSealantRecords as unknown as Handler
  );

  // getSealantRecord
  app.get('/healthcare/dental/pediatric/sealants/:id',
    zValidator('param', validators.GetSealantRecordParams, validationErrorHandler),
    registry.getSealantRecord as unknown as Handler
  );

  // updateSealantRecord
  app.put('/healthcare/dental/pediatric/sealants/:id',
    zValidator('param', validators.UpdateSealantRecordParams, validationErrorHandler),
    zValidator('json', validators.UpdateSealantRecordBody, validationErrorHandler),
    registry.updateSealantRecord as unknown as Handler
  );

  // deleteSealantRecord
  app.delete('/healthcare/dental/pediatric/sealants/:id',
    zValidator('param', validators.DeleteSealantRecordParams, validationErrorHandler),
    registry.deleteSealantRecord as unknown as Handler
  );

  // createSpaceMaintainer
  app.post('/healthcare/dental/pediatric/space-maintainers',
    zValidator('json', validators.CreateSpaceMaintainerBody, validationErrorHandler),
    registry.createSpaceMaintainer as unknown as Handler
  );

  // searchSpaceMaintainers
  app.get('/healthcare/dental/pediatric/space-maintainers',
    zValidator('query', validators.SearchSpaceMaintainersQuery, validationErrorHandler),
    zValidator('json', validators.SearchSpaceMaintainersBody, validationErrorHandler),
    registry.searchSpaceMaintainers as unknown as Handler
  );

  // getSpaceMaintainer
  app.get('/healthcare/dental/pediatric/space-maintainers/:id',
    zValidator('param', validators.GetSpaceMaintainerParams, validationErrorHandler),
    registry.getSpaceMaintainer as unknown as Handler
  );

  // updateSpaceMaintainer
  app.put('/healthcare/dental/pediatric/space-maintainers/:id',
    zValidator('param', validators.UpdateSpaceMaintainerParams, validationErrorHandler),
    zValidator('json', validators.UpdateSpaceMaintainerBody, validationErrorHandler),
    registry.updateSpaceMaintainer as unknown as Handler
  );

  // deleteSpaceMaintainer
  app.delete('/healthcare/dental/pediatric/space-maintainers/:id',
    zValidator('param', validators.DeleteSpaceMaintainerParams, validationErrorHandler),
    registry.deleteSpaceMaintainer as unknown as Handler
  );

  // createPerioExam
  app.post('/healthcare/dental/periodontal/exams',
    zValidator('json', validators.CreatePerioExamBody, validationErrorHandler),
    registry.createPerioExam as unknown as Handler
  );

  // searchPerioExams
  app.get('/healthcare/dental/periodontal/exams',
    zValidator('query', validators.SearchPerioExamsQuery, validationErrorHandler),
    zValidator('json', validators.SearchPerioExamsBody, validationErrorHandler),
    registry.searchPerioExams as unknown as Handler
  );

  // comparePerioExams
  app.get('/healthcare/dental/periodontal/exams/compare',
    zValidator('json', validators.ComparePerioExamsBody, validationErrorHandler),
    registry.comparePerioExams as unknown as Handler
  );

  // getPerioExam
  app.get('/healthcare/dental/periodontal/exams/:id',
    zValidator('param', validators.GetPerioExamParams, validationErrorHandler),
    registry.getPerioExam as unknown as Handler
  );

  // updatePerioExam
  app.put('/healthcare/dental/periodontal/exams/:id',
    zValidator('param', validators.UpdatePerioExamParams, validationErrorHandler),
    zValidator('json', validators.UpdatePerioExamBody, validationErrorHandler),
    registry.updatePerioExam as unknown as Handler
  );

  // deletePerioExam
  app.delete('/healthcare/dental/periodontal/exams/:id',
    zValidator('param', validators.DeletePerioExamParams, validationErrorHandler),
    registry.deletePerioExam as unknown as Handler
  );

  // completePerioExam
  app.post('/healthcare/dental/periodontal/exams/:id/complete',
    zValidator('param', validators.CompletePerioExamParams, validationErrorHandler),
    registry.completePerioExam as unknown as Handler
  );

  // createFurcationRecord
  app.post('/healthcare/dental/periodontal/furcations',
    zValidator('json', validators.CreateFurcationRecordBody, validationErrorHandler),
    registry.createFurcationRecord as unknown as Handler
  );

  // getFurcationRecord
  app.get('/healthcare/dental/periodontal/furcations/:id',
    zValidator('param', validators.GetFurcationRecordParams, validationErrorHandler),
    registry.getFurcationRecord as unknown as Handler
  );

  // updateFurcationRecord
  app.put('/healthcare/dental/periodontal/furcations/:id',
    zValidator('param', validators.UpdateFurcationRecordParams, validationErrorHandler),
    zValidator('json', validators.UpdateFurcationRecordBody, validationErrorHandler),
    registry.updateFurcationRecord as unknown as Handler
  );

  // deleteFurcationRecord
  app.delete('/healthcare/dental/periodontal/furcations/:id',
    zValidator('param', validators.DeleteFurcationRecordParams, validationErrorHandler),
    registry.deleteFurcationRecord as unknown as Handler
  );

  // createMobilityRecord
  app.post('/healthcare/dental/periodontal/mobility',
    zValidator('json', validators.CreateMobilityRecordBody, validationErrorHandler),
    registry.createMobilityRecord as unknown as Handler
  );

  // getMobilityRecord
  app.get('/healthcare/dental/periodontal/mobility/:id',
    zValidator('param', validators.GetMobilityRecordParams, validationErrorHandler),
    registry.getMobilityRecord as unknown as Handler
  );

  // updateMobilityRecord
  app.put('/healthcare/dental/periodontal/mobility/:id',
    zValidator('param', validators.UpdateMobilityRecordParams, validationErrorHandler),
    zValidator('json', validators.UpdateMobilityRecordBody, validationErrorHandler),
    registry.updateMobilityRecord as unknown as Handler
  );

  // deleteMobilityRecord
  app.delete('/healthcare/dental/periodontal/mobility/:id',
    zValidator('param', validators.DeleteMobilityRecordParams, validationErrorHandler),
    registry.deleteMobilityRecord as unknown as Handler
  );

  // createImpression
  app.post('/healthcare/dental/prosthodontic/impressions',
    zValidator('json', validators.CreateImpressionBody, validationErrorHandler),
    registry.createImpression as unknown as Handler
  );

  // getImpression
  app.get('/healthcare/dental/prosthodontic/impressions/:id',
    zValidator('param', validators.GetImpressionParams, validationErrorHandler),
    registry.getImpression as unknown as Handler
  );

  // updateImpression
  app.put('/healthcare/dental/prosthodontic/impressions/:id',
    zValidator('param', validators.UpdateImpressionParams, validationErrorHandler),
    zValidator('json', validators.UpdateImpressionBody, validationErrorHandler),
    registry.updateImpression as unknown as Handler
  );

  // deleteImpression
  app.delete('/healthcare/dental/prosthodontic/impressions/:id',
    zValidator('param', validators.DeleteImpressionParams, validationErrorHandler),
    registry.deleteImpression as unknown as Handler
  );

  // createLabCaseLink
  app.post('/healthcare/dental/prosthodontic/lab-cases',
    zValidator('json', validators.CreateLabCaseLinkBody, validationErrorHandler),
    registry.createLabCaseLink as unknown as Handler
  );

  // searchLabCaseLinks
  app.get('/healthcare/dental/prosthodontic/lab-cases',
    zValidator('query', validators.SearchLabCaseLinksQuery, validationErrorHandler),
    zValidator('json', validators.SearchLabCaseLinksBody, validationErrorHandler),
    registry.searchLabCaseLinks as unknown as Handler
  );

  // getLabCaseLink
  app.get('/healthcare/dental/prosthodontic/lab-cases/:id',
    zValidator('param', validators.GetLabCaseLinkParams, validationErrorHandler),
    registry.getLabCaseLink as unknown as Handler
  );

  // updateLabCaseLink
  app.put('/healthcare/dental/prosthodontic/lab-cases/:id',
    zValidator('param', validators.UpdateLabCaseLinkParams, validationErrorHandler),
    zValidator('json', validators.UpdateLabCaseLinkBody, validationErrorHandler),
    registry.updateLabCaseLink as unknown as Handler
  );

  // deleteLabCaseLink
  app.delete('/healthcare/dental/prosthodontic/lab-cases/:id',
    zValidator('param', validators.DeleteLabCaseLinkParams, validationErrorHandler),
    registry.deleteLabCaseLink as unknown as Handler
  );

  // createProsthoRecord
  app.post('/healthcare/dental/prosthodontic/records',
    zValidator('json', validators.CreateProsthoRecordBody, validationErrorHandler),
    registry.createProsthoRecord as unknown as Handler
  );

  // searchProsthoRecords
  app.get('/healthcare/dental/prosthodontic/records',
    zValidator('query', validators.SearchProsthoRecordsQuery, validationErrorHandler),
    zValidator('json', validators.SearchProsthoRecordsBody, validationErrorHandler),
    registry.searchProsthoRecords as unknown as Handler
  );

  // getProsthoRecord
  app.get('/healthcare/dental/prosthodontic/records/:id',
    zValidator('param', validators.GetProsthoRecordParams, validationErrorHandler),
    registry.getProsthoRecord as unknown as Handler
  );

  // updateProsthoRecord
  app.put('/healthcare/dental/prosthodontic/records/:id',
    zValidator('param', validators.UpdateProsthoRecordParams, validationErrorHandler),
    zValidator('json', validators.UpdateProsthoRecordBody, validationErrorHandler),
    registry.updateProsthoRecord as unknown as Handler
  );

  // deleteProsthoRecord
  app.delete('/healthcare/dental/prosthodontic/records/:id',
    zValidator('param', validators.DeleteProsthoRecordParams, validationErrorHandler),
    registry.deleteProsthoRecord as unknown as Handler
  );

  // transitionProsthoStatus
  app.post('/healthcare/dental/prosthodontic/records/:id/status',
    zValidator('param', validators.TransitionProsthoStatusParams, validationErrorHandler),
    zValidator('json', validators.TransitionProsthoStatusBody, validationErrorHandler),
    registry.transitionProsthoStatus as unknown as Handler
  );

  // createShadeSelection
  app.post('/healthcare/dental/prosthodontic/shades',
    zValidator('json', validators.CreateShadeSelectionBody, validationErrorHandler),
    registry.createShadeSelection as unknown as Handler
  );

  // getShadeSelection
  app.get('/healthcare/dental/prosthodontic/shades/:id',
    zValidator('param', validators.GetShadeSelectionParams, validationErrorHandler),
    registry.getShadeSelection as unknown as Handler
  );

  // updateShadeSelection
  app.put('/healthcare/dental/prosthodontic/shades/:id',
    zValidator('param', validators.UpdateShadeSelectionParams, validationErrorHandler),
    zValidator('json', validators.UpdateShadeSelectionBody, validationErrorHandler),
    registry.updateShadeSelection as unknown as Handler
  );

  // deleteShadeSelection
  app.delete('/healthcare/dental/prosthodontic/shades/:id',
    zValidator('param', validators.DeleteShadeSelectionParams, validationErrorHandler),
    registry.deleteShadeSelection as unknown as Handler
  );

  // createDentalTreatmentPlan
  app.post('/healthcare/dental/treatment-plans',
    zValidator('json', validators.CreateDentalTreatmentPlanBody, validationErrorHandler),
    registry.createDentalTreatmentPlan as unknown as Handler
  );

  // searchDentalTreatmentPlans
  app.get('/healthcare/dental/treatment-plans',
    zValidator('query', validators.SearchDentalTreatmentPlansQuery, validationErrorHandler),
    zValidator('json', validators.SearchDentalTreatmentPlansBody, validationErrorHandler),
    registry.searchDentalTreatmentPlans as unknown as Handler
  );

  // getDentalTreatmentPlan
  app.get('/healthcare/dental/treatment-plans/:id',
    zValidator('param', validators.GetDentalTreatmentPlanParams, validationErrorHandler),
    registry.getDentalTreatmentPlan as unknown as Handler
  );

  // updateDentalTreatmentPlan
  app.put('/healthcare/dental/treatment-plans/:id',
    zValidator('param', validators.UpdateDentalTreatmentPlanParams, validationErrorHandler),
    zValidator('json', validators.UpdateDentalTreatmentPlanBody, validationErrorHandler),
    registry.updateDentalTreatmentPlan as unknown as Handler
  );

  // deleteDentalTreatmentPlan
  app.delete('/healthcare/dental/treatment-plans/:id',
    zValidator('param', validators.DeleteDentalTreatmentPlanParams, validationErrorHandler),
    registry.deleteDentalTreatmentPlan as unknown as Handler
  );

  // createDepartment
  app.post('/healthcare/departments',
    authMiddleware({ roles: ["admin", "org-admin"] }),
    zValidator('json', validators.CreateDepartmentBody, validationErrorHandler),
    registry.createDepartment as unknown as Handler
  );

  // listDepartments
  app.get('/healthcare/departments',
    authMiddleware({ roles: ["admin", "clinician", "support"] }),
    zValidator('query', validators.ListDepartmentsQuery, validationErrorHandler),
    registry.listDepartments as unknown as Handler
  );

  // getDepartment
  app.get('/healthcare/departments/:id',
    authMiddleware({ roles: ["admin", "clinician", "support"] }),
    zValidator('param', validators.GetDepartmentParams, validationErrorHandler),
    registry.getDepartment as unknown as Handler
  );

  // updateDepartment
  app.patch('/healthcare/departments/:id',
    authMiddleware({ roles: ["admin", "org-admin"] }),
    zValidator('param', validators.UpdateDepartmentParams, validationErrorHandler),
    zValidator('json', validators.UpdateDepartmentBody, validationErrorHandler),
    registry.updateDepartment as unknown as Handler
  );

  // deactivateDepartment
  app.delete('/healthcare/departments/:id',
    authMiddleware({ roles: ["admin"] }),
    zValidator('param', validators.DeactivateDepartmentParams, validationErrorHandler),
    registry.deactivateDepartment as unknown as Handler
  );

  // createDeviceAssignment
  app.post('/healthcare/device-assignments',
    zValidator('json', validators.CreateDeviceAssignmentBody, validationErrorHandler),
    registry.createDeviceAssignment as unknown as Handler
  );

  // searchDeviceAssignments
  app.get('/healthcare/device-assignments/search',
    zValidator('query', validators.SearchDeviceAssignmentsQuery, validationErrorHandler),
    registry.searchDeviceAssignments as unknown as Handler
  );

  // getDeviceAssignment
  app.get('/healthcare/device-assignments/:id',
    zValidator('param', validators.GetDeviceAssignmentParams, validationErrorHandler),
    registry.getDeviceAssignment as unknown as Handler
  );

  // updateDeviceAssignment
  app.put('/healthcare/device-assignments/:id',
    zValidator('param', validators.UpdateDeviceAssignmentParams, validationErrorHandler),
    zValidator('json', validators.UpdateDeviceAssignmentBody, validationErrorHandler),
    registry.updateDeviceAssignment as unknown as Handler
  );

  // patchDeviceAssignment
  app.patch('/healthcare/device-assignments/:id',
    zValidator('param', validators.PatchDeviceAssignmentParams, validationErrorHandler),
    zValidator('json', validators.PatchDeviceAssignmentBody, validationErrorHandler),
    registry.patchDeviceAssignment as unknown as Handler
  );

  // deleteDeviceAssignment
  app.delete('/healthcare/device-assignments/:id',
    zValidator('param', validators.DeleteDeviceAssignmentParams, validationErrorHandler),
    registry.deleteDeviceAssignment as unknown as Handler
  );

  // createDeviceMetric
  app.post('/healthcare/device-metrics',
    zValidator('json', validators.CreateDeviceMetricBody, validationErrorHandler),
    registry.createDeviceMetric as unknown as Handler
  );

  // searchDeviceMetrics
  app.get('/healthcare/device-metrics/search',
    zValidator('query', validators.SearchDeviceMetricsQuery, validationErrorHandler),
    registry.searchDeviceMetrics as unknown as Handler
  );

  // getDeviceMetric
  app.get('/healthcare/device-metrics/:id',
    zValidator('param', validators.GetDeviceMetricParams, validationErrorHandler),
    registry.getDeviceMetric as unknown as Handler
  );

  // updateDeviceMetric
  app.put('/healthcare/device-metrics/:id',
    zValidator('param', validators.UpdateDeviceMetricParams, validationErrorHandler),
    zValidator('json', validators.UpdateDeviceMetricBody, validationErrorHandler),
    registry.updateDeviceMetric as unknown as Handler
  );

  // patchDeviceMetric
  app.patch('/healthcare/device-metrics/:id',
    zValidator('param', validators.PatchDeviceMetricParams, validationErrorHandler),
    zValidator('json', validators.PatchDeviceMetricBody, validationErrorHandler),
    registry.patchDeviceMetric as unknown as Handler
  );

  // deleteDeviceMetric
  app.delete('/healthcare/device-metrics/:id',
    zValidator('param', validators.DeleteDeviceMetricParams, validationErrorHandler),
    registry.deleteDeviceMetric as unknown as Handler
  );

  // createDevice
  app.post('/healthcare/devices',
    zValidator('json', validators.CreateDeviceBody, validationErrorHandler),
    registry.createDevice as unknown as Handler
  );

  // searchDevices
  app.get('/healthcare/devices/search',
    zValidator('query', validators.SearchDevicesQuery, validationErrorHandler),
    registry.searchDevices as unknown as Handler
  );

  // getDevice
  app.get('/healthcare/devices/:id',
    zValidator('param', validators.GetDeviceParams, validationErrorHandler),
    registry.getDevice as unknown as Handler
  );

  // updateDevice
  app.put('/healthcare/devices/:id',
    zValidator('param', validators.UpdateDeviceParams, validationErrorHandler),
    zValidator('json', validators.UpdateDeviceBody, validationErrorHandler),
    registry.updateDevice as unknown as Handler
  );

  // patchDevice
  app.patch('/healthcare/devices/:id',
    zValidator('param', validators.PatchDeviceParams, validationErrorHandler),
    zValidator('json', validators.PatchDeviceBody, validationErrorHandler),
    registry.patchDevice as unknown as Handler
  );

  // deleteDevice
  app.delete('/healthcare/devices/:id',
    zValidator('param', validators.DeleteDeviceParams, validationErrorHandler),
    registry.deleteDevice as unknown as Handler
  );

  // createFeeSchedule
  app.post('/healthcare/fee-schedules',
    zValidator('json', validators.CreateFeeScheduleBody, validationErrorHandler),
    registry.createFeeSchedule as unknown as Handler
  );

  // createInsuranceContractRate
  app.post('/healthcare/fee-schedules/contract-rates',
    zValidator('json', validators.CreateInsuranceContractRateBody, validationErrorHandler),
    registry.createInsuranceContractRate as unknown as Handler
  );

  // searchInsuranceContractRates
  app.get('/healthcare/fee-schedules/contract-rates/search',
    zValidator('query', validators.SearchInsuranceContractRatesQuery, validationErrorHandler),
    registry.searchInsuranceContractRates as unknown as Handler
  );

  // getInsuranceContractRate
  app.get('/healthcare/fee-schedules/contract-rates/:id',
    zValidator('param', validators.GetInsuranceContractRateParams, validationErrorHandler),
    registry.getInsuranceContractRate as unknown as Handler
  );

  // updateInsuranceContractRate
  app.put('/healthcare/fee-schedules/contract-rates/:id',
    zValidator('param', validators.UpdateInsuranceContractRateParams, validationErrorHandler),
    zValidator('json', validators.UpdateInsuranceContractRateBody, validationErrorHandler),
    registry.updateInsuranceContractRate as unknown as Handler
  );

  // deleteInsuranceContractRate
  app.delete('/healthcare/fee-schedules/contract-rates/:id',
    zValidator('param', validators.DeleteInsuranceContractRateParams, validationErrorHandler),
    registry.deleteInsuranceContractRate as unknown as Handler
  );

  // createDiscount
  app.post('/healthcare/fee-schedules/discounts',
    zValidator('json', validators.CreateDiscountBody, validationErrorHandler),
    registry.createDiscount as unknown as Handler
  );

  // searchDiscounts
  app.get('/healthcare/fee-schedules/discounts/search',
    zValidator('query', validators.SearchDiscountsQuery, validationErrorHandler),
    registry.searchDiscounts as unknown as Handler
  );

  // getDiscount
  app.get('/healthcare/fee-schedules/discounts/:id',
    zValidator('param', validators.GetDiscountParams, validationErrorHandler),
    registry.getDiscount as unknown as Handler
  );

  // updateDiscount
  app.put('/healthcare/fee-schedules/discounts/:id',
    zValidator('param', validators.UpdateDiscountParams, validationErrorHandler),
    zValidator('json', validators.UpdateDiscountBody, validationErrorHandler),
    registry.updateDiscount as unknown as Handler
  );

  // patchDiscount
  app.patch('/healthcare/fee-schedules/discounts/:id',
    zValidator('param', validators.PatchDiscountParams, validationErrorHandler),
    zValidator('json', validators.PatchDiscountBody, validationErrorHandler),
    registry.patchDiscount as unknown as Handler
  );

  // deleteDiscount
  app.delete('/healthcare/fee-schedules/discounts/:id',
    zValidator('param', validators.DeleteDiscountParams, validationErrorHandler),
    registry.deleteDiscount as unknown as Handler
  );

  // createFeeScheduleItem
  app.post('/healthcare/fee-schedules/items',
    zValidator('json', validators.CreateFeeScheduleItemBody, validationErrorHandler),
    registry.createFeeScheduleItem as unknown as Handler
  );

  // bulkImportFeeScheduleItems
  app.post('/healthcare/fee-schedules/items/bulk-import',
    zValidator('json', validators.BulkImportFeeScheduleItemsBody, validationErrorHandler),
    registry.bulkImportFeeScheduleItems as unknown as Handler
  );

  // searchFeeScheduleItems
  app.get('/healthcare/fee-schedules/items/search',
    zValidator('query', validators.SearchFeeScheduleItemsQuery, validationErrorHandler),
    registry.searchFeeScheduleItems as unknown as Handler
  );

  // getFeeScheduleItem
  app.get('/healthcare/fee-schedules/items/:id',
    zValidator('param', validators.GetFeeScheduleItemParams, validationErrorHandler),
    registry.getFeeScheduleItem as unknown as Handler
  );

  // updateFeeScheduleItem
  app.put('/healthcare/fee-schedules/items/:id',
    zValidator('param', validators.UpdateFeeScheduleItemParams, validationErrorHandler),
    zValidator('json', validators.UpdateFeeScheduleItemBody, validationErrorHandler),
    registry.updateFeeScheduleItem as unknown as Handler
  );

  // patchFeeScheduleItem
  app.patch('/healthcare/fee-schedules/items/:id',
    zValidator('param', validators.PatchFeeScheduleItemParams, validationErrorHandler),
    zValidator('json', validators.PatchFeeScheduleItemBody, validationErrorHandler),
    registry.patchFeeScheduleItem as unknown as Handler
  );

  // deleteFeeScheduleItem
  app.delete('/healthcare/fee-schedules/items/:id',
    zValidator('param', validators.DeleteFeeScheduleItemParams, validationErrorHandler),
    registry.deleteFeeScheduleItem as unknown as Handler
  );

  // searchFeeSchedules
  app.get('/healthcare/fee-schedules/search',
    zValidator('query', validators.SearchFeeSchedulesQuery, validationErrorHandler),
    registry.searchFeeSchedules as unknown as Handler
  );

  // getFeeSchedule
  app.get('/healthcare/fee-schedules/:id',
    zValidator('param', validators.GetFeeScheduleParams, validationErrorHandler),
    registry.getFeeSchedule as unknown as Handler
  );

  // updateFeeSchedule
  app.put('/healthcare/fee-schedules/:id',
    zValidator('param', validators.UpdateFeeScheduleParams, validationErrorHandler),
    zValidator('json', validators.UpdateFeeScheduleBody, validationErrorHandler),
    registry.updateFeeSchedule as unknown as Handler
  );

  // patchFeeSchedule
  app.patch('/healthcare/fee-schedules/:id',
    zValidator('param', validators.PatchFeeScheduleParams, validationErrorHandler),
    zValidator('json', validators.PatchFeeScheduleBody, validationErrorHandler),
    registry.patchFeeSchedule as unknown as Handler
  );

  // deleteFeeSchedule
  app.delete('/healthcare/fee-schedules/:id',
    zValidator('param', validators.DeleteFeeScheduleParams, validationErrorHandler),
    registry.deleteFeeSchedule as unknown as Handler
  );

  // createFormularyItem
  app.post('/healthcare/formulary',
    zValidator('json', validators.CreateFormularyItemBody, validationErrorHandler),
    registry.createFormularyItem as unknown as Handler
  );

  // searchFormularyItems
  app.get('/healthcare/formulary/search',
    zValidator('query', validators.SearchFormularyItemsQuery, validationErrorHandler),
    zValidator('json', validators.SearchFormularyItemsBody, validationErrorHandler),
    registry.searchFormularyItems as unknown as Handler
  );

  // getFormularyItem
  app.get('/healthcare/formulary/:id',
    zValidator('param', validators.GetFormularyItemParams, validationErrorHandler),
    registry.getFormularyItem as unknown as Handler
  );

  // updateFormularyItem
  app.put('/healthcare/formulary/:id',
    zValidator('param', validators.UpdateFormularyItemParams, validationErrorHandler),
    zValidator('json', validators.UpdateFormularyItemBody, validationErrorHandler),
    registry.updateFormularyItem as unknown as Handler
  );

  // patchFormularyItem
  app.patch('/healthcare/formulary/:id',
    zValidator('param', validators.PatchFormularyItemParams, validationErrorHandler),
    zValidator('json', validators.PatchFormularyItemBody, validationErrorHandler),
    registry.patchFormularyItem as unknown as Handler
  );

  // deleteFormularyItem
  app.delete('/healthcare/formulary/:id',
    zValidator('param', validators.DeleteFormularyItemParams, validationErrorHandler),
    registry.deleteFormularyItem as unknown as Handler
  );

  // createCaseCosting
  app.post('/healthcare/hospital-admin/case-costing',
    zValidator('json', validators.CreateCaseCostingBody, validationErrorHandler),
    registry.createCaseCosting as unknown as Handler
  );

  // generateCaseCosting
  app.post('/healthcare/hospital-admin/case-costing/generate',
    zValidator('query', validators.GenerateCaseCostingQuery, validationErrorHandler),
    registry.generateCaseCosting as unknown as Handler
  );

  // searchCaseCosting
  app.get('/healthcare/hospital-admin/case-costing/search',
    zValidator('query', validators.SearchCaseCostingQuery, validationErrorHandler),
    registry.searchCaseCosting as unknown as Handler
  );

  // getCaseCosting
  app.get('/healthcare/hospital-admin/case-costing/:id',
    zValidator('param', validators.GetCaseCostingParams, validationErrorHandler),
    registry.getCaseCosting as unknown as Handler
  );

  // updateCaseCosting
  app.put('/healthcare/hospital-admin/case-costing/:id',
    zValidator('param', validators.UpdateCaseCostingParams, validationErrorHandler),
    zValidator('json', validators.UpdateCaseCostingBody, validationErrorHandler),
    registry.updateCaseCosting as unknown as Handler
  );

  // deleteCaseCosting
  app.delete('/healthcare/hospital-admin/case-costing/:id',
    zValidator('param', validators.DeleteCaseCostingParams, validationErrorHandler),
    registry.deleteCaseCosting as unknown as Handler
  );

  // createCodingReview
  app.post('/healthcare/hospital-admin/coding-reviews',
    zValidator('json', validators.CreateCodingReviewBody, validationErrorHandler),
    registry.createCodingReview as unknown as Handler
  );

  // searchCodingReviews
  app.get('/healthcare/hospital-admin/coding-reviews/search',
    zValidator('query', validators.SearchCodingReviewsQuery, validationErrorHandler),
    registry.searchCodingReviews as unknown as Handler
  );

  // getCodingReview
  app.get('/healthcare/hospital-admin/coding-reviews/:id',
    zValidator('param', validators.GetCodingReviewParams, validationErrorHandler),
    registry.getCodingReview as unknown as Handler
  );

  // updateCodingReview
  app.put('/healthcare/hospital-admin/coding-reviews/:id',
    zValidator('param', validators.UpdateCodingReviewParams, validationErrorHandler),
    zValidator('json', validators.UpdateCodingReviewBody, validationErrorHandler),
    registry.updateCodingReview as unknown as Handler
  );

  // deleteCodingReview
  app.delete('/healthcare/hospital-admin/coding-reviews/:id',
    zValidator('param', validators.DeleteCodingReviewParams, validationErrorHandler),
    registry.deleteCodingReview as unknown as Handler
  );

  // finalizeCodingReview
  app.post('/healthcare/hospital-admin/coding-reviews/:id/finalize',
    zValidator('param', validators.FinalizeCodingReviewParams, validationErrorHandler),
    registry.finalizeCodingReview as unknown as Handler
  );

  // createCostAllocation
  app.post('/healthcare/hospital-admin/cost-allocations',
    zValidator('json', validators.CreateCostAllocationBody, validationErrorHandler),
    registry.createCostAllocation as unknown as Handler
  );

  // searchCostAllocations
  app.get('/healthcare/hospital-admin/cost-allocations/search',
    zValidator('query', validators.SearchCostAllocationsQuery, validationErrorHandler),
    registry.searchCostAllocations as unknown as Handler
  );

  // getCostAllocation
  app.get('/healthcare/hospital-admin/cost-allocations/:id',
    zValidator('param', validators.GetCostAllocationParams, validationErrorHandler),
    registry.getCostAllocation as unknown as Handler
  );

  // updateCostAllocation
  app.put('/healthcare/hospital-admin/cost-allocations/:id',
    zValidator('param', validators.UpdateCostAllocationParams, validationErrorHandler),
    zValidator('json', validators.UpdateCostAllocationBody, validationErrorHandler),
    registry.updateCostAllocation as unknown as Handler
  );

  // deleteCostAllocation
  app.delete('/healthcare/hospital-admin/cost-allocations/:id',
    zValidator('param', validators.DeleteCostAllocationParams, validationErrorHandler),
    registry.deleteCostAllocation as unknown as Handler
  );

  // createCostCenter
  app.post('/healthcare/hospital-admin/cost-centers',
    zValidator('json', validators.CreateCostCenterBody, validationErrorHandler),
    registry.createCostCenter as unknown as Handler
  );

  // searchCostCenters
  app.get('/healthcare/hospital-admin/cost-centers/search',
    zValidator('query', validators.SearchCostCentersQuery, validationErrorHandler),
    registry.searchCostCenters as unknown as Handler
  );

  // getCostCenter
  app.get('/healthcare/hospital-admin/cost-centers/:id',
    zValidator('param', validators.GetCostCenterParams, validationErrorHandler),
    registry.getCostCenter as unknown as Handler
  );

  // updateCostCenter
  app.put('/healthcare/hospital-admin/cost-centers/:id',
    zValidator('param', validators.UpdateCostCenterParams, validationErrorHandler),
    zValidator('json', validators.UpdateCostCenterBody, validationErrorHandler),
    registry.updateCostCenter as unknown as Handler
  );

  // deleteCostCenter
  app.delete('/healthcare/hospital-admin/cost-centers/:id',
    zValidator('param', validators.DeleteCostCenterParams, validationErrorHandler),
    registry.deleteCostCenter as unknown as Handler
  );

  // createGLExport
  app.post('/healthcare/hospital-admin/gl-exports',
    zValidator('json', validators.CreateGLExportBody, validationErrorHandler),
    registry.createGLExport as unknown as Handler
  );

  // searchGLExports
  app.get('/healthcare/hospital-admin/gl-exports/search',
    zValidator('query', validators.SearchGLExportsQuery, validationErrorHandler),
    registry.searchGLExports as unknown as Handler
  );

  // getGLExport
  app.get('/healthcare/hospital-admin/gl-exports/:id',
    zValidator('param', validators.GetGLExportParams, validationErrorHandler),
    registry.getGLExport as unknown as Handler
  );

  // createResidentEvaluation
  app.post('/healthcare/hospital-admin/gme/evaluations',
    zValidator('json', validators.CreateResidentEvaluationBody, validationErrorHandler),
    registry.createResidentEvaluation as unknown as Handler
  );

  // searchResidentEvaluations
  app.get('/healthcare/hospital-admin/gme/evaluations/search',
    zValidator('query', validators.SearchResidentEvaluationsQuery, validationErrorHandler),
    registry.searchResidentEvaluations as unknown as Handler
  );

  // getResidentEvaluation
  app.get('/healthcare/hospital-admin/gme/evaluations/:id',
    zValidator('param', validators.GetResidentEvaluationParams, validationErrorHandler),
    registry.getResidentEvaluation as unknown as Handler
  );

  // updateResidentEvaluation
  app.put('/healthcare/hospital-admin/gme/evaluations/:id',
    zValidator('param', validators.UpdateResidentEvaluationParams, validationErrorHandler),
    zValidator('json', validators.UpdateResidentEvaluationBody, validationErrorHandler),
    registry.updateResidentEvaluation as unknown as Handler
  );

  // deleteResidentEvaluation
  app.delete('/healthcare/hospital-admin/gme/evaluations/:id',
    zValidator('param', validators.DeleteResidentEvaluationParams, validationErrorHandler),
    registry.deleteResidentEvaluation as unknown as Handler
  );

  // submitResidentEvaluation
  app.post('/healthcare/hospital-admin/gme/evaluations/:id/submit',
    zValidator('param', validators.SubmitResidentEvaluationParams, validationErrorHandler),
    registry.submitResidentEvaluation as unknown as Handler
  );

  // createProcedureLog
  app.post('/healthcare/hospital-admin/gme/procedure-logs',
    zValidator('json', validators.CreateProcedureLogBody, validationErrorHandler),
    registry.createProcedureLog as unknown as Handler
  );

  // searchProcedureLogs
  app.get('/healthcare/hospital-admin/gme/procedure-logs/search',
    zValidator('query', validators.SearchProcedureLogsQuery, validationErrorHandler),
    registry.searchProcedureLogs as unknown as Handler
  );

  // getProcedureLog
  app.get('/healthcare/hospital-admin/gme/procedure-logs/:id',
    zValidator('param', validators.GetProcedureLogParams, validationErrorHandler),
    registry.getProcedureLog as unknown as Handler
  );

  // updateProcedureLog
  app.put('/healthcare/hospital-admin/gme/procedure-logs/:id',
    zValidator('param', validators.UpdateProcedureLogParams, validationErrorHandler),
    zValidator('json', validators.UpdateProcedureLogBody, validationErrorHandler),
    registry.updateProcedureLog as unknown as Handler
  );

  // deleteProcedureLog
  app.delete('/healthcare/hospital-admin/gme/procedure-logs/:id',
    zValidator('param', validators.DeleteProcedureLogParams, validationErrorHandler),
    registry.deleteProcedureLog as unknown as Handler
  );

  // verifyProcedureLog
  app.post('/healthcare/hospital-admin/gme/procedure-logs/:id/verify',
    zValidator('param', validators.VerifyProcedureLogParams, validationErrorHandler),
    zValidator('query', validators.VerifyProcedureLogQuery, validationErrorHandler),
    registry.verifyProcedureLog as unknown as Handler
  );

  // createResidencyProgram
  app.post('/healthcare/hospital-admin/gme/programs',
    zValidator('json', validators.CreateResidencyProgramBody, validationErrorHandler),
    registry.createResidencyProgram as unknown as Handler
  );

  // searchResidencyPrograms
  app.get('/healthcare/hospital-admin/gme/programs/search',
    zValidator('query', validators.SearchResidencyProgramsQuery, validationErrorHandler),
    registry.searchResidencyPrograms as unknown as Handler
  );

  // getResidencyProgram
  app.get('/healthcare/hospital-admin/gme/programs/:id',
    zValidator('param', validators.GetResidencyProgramParams, validationErrorHandler),
    registry.getResidencyProgram as unknown as Handler
  );

  // updateResidencyProgram
  app.put('/healthcare/hospital-admin/gme/programs/:id',
    zValidator('param', validators.UpdateResidencyProgramParams, validationErrorHandler),
    zValidator('json', validators.UpdateResidencyProgramBody, validationErrorHandler),
    registry.updateResidencyProgram as unknown as Handler
  );

  // deleteResidencyProgram
  app.delete('/healthcare/hospital-admin/gme/programs/:id',
    zValidator('param', validators.DeleteResidencyProgramParams, validationErrorHandler),
    registry.deleteResidencyProgram as unknown as Handler
  );

  // createResident
  app.post('/healthcare/hospital-admin/gme/residents',
    zValidator('json', validators.CreateResidentBody, validationErrorHandler),
    registry.createResident as unknown as Handler
  );

  // searchResidents
  app.get('/healthcare/hospital-admin/gme/residents/search',
    zValidator('query', validators.SearchResidentsQuery, validationErrorHandler),
    registry.searchResidents as unknown as Handler
  );

  // getResident
  app.get('/healthcare/hospital-admin/gme/residents/:id',
    zValidator('param', validators.GetResidentParams, validationErrorHandler),
    registry.getResident as unknown as Handler
  );

  // updateResident
  app.put('/healthcare/hospital-admin/gme/residents/:id',
    zValidator('param', validators.UpdateResidentParams, validationErrorHandler),
    zValidator('json', validators.UpdateResidentBody, validationErrorHandler),
    registry.updateResident as unknown as Handler
  );

  // deleteResident
  app.delete('/healthcare/hospital-admin/gme/residents/:id',
    zValidator('param', validators.DeleteResidentParams, validationErrorHandler),
    registry.deleteResident as unknown as Handler
  );

  // createRotationAssignment
  app.post('/healthcare/hospital-admin/gme/rotations',
    zValidator('json', validators.CreateRotationAssignmentBody, validationErrorHandler),
    registry.createRotationAssignment as unknown as Handler
  );

  // searchRotationAssignments
  app.get('/healthcare/hospital-admin/gme/rotations/search',
    zValidator('query', validators.SearchRotationAssignmentsQuery, validationErrorHandler),
    registry.searchRotationAssignments as unknown as Handler
  );

  // getRotationAssignment
  app.get('/healthcare/hospital-admin/gme/rotations/:id',
    zValidator('param', validators.GetRotationAssignmentParams, validationErrorHandler),
    registry.getRotationAssignment as unknown as Handler
  );

  // updateRotationAssignment
  app.put('/healthcare/hospital-admin/gme/rotations/:id',
    zValidator('param', validators.UpdateRotationAssignmentParams, validationErrorHandler),
    zValidator('json', validators.UpdateRotationAssignmentBody, validationErrorHandler),
    registry.updateRotationAssignment as unknown as Handler
  );

  // deleteRotationAssignment
  app.delete('/healthcare/hospital-admin/gme/rotations/:id',
    zValidator('param', validators.DeleteRotationAssignmentParams, validationErrorHandler),
    registry.deleteRotationAssignment as unknown as Handler
  );

  // createMedicalRecordRequest
  app.post('/healthcare/hospital-admin/record-requests',
    zValidator('json', validators.CreateMedicalRecordRequestBody, validationErrorHandler),
    registry.createMedicalRecordRequest as unknown as Handler
  );

  // searchMedicalRecordRequests
  app.get('/healthcare/hospital-admin/record-requests/search',
    zValidator('query', validators.SearchMedicalRecordRequestsQuery, validationErrorHandler),
    registry.searchMedicalRecordRequests as unknown as Handler
  );

  // getMedicalRecordRequest
  app.get('/healthcare/hospital-admin/record-requests/:id',
    zValidator('param', validators.GetMedicalRecordRequestParams, validationErrorHandler),
    registry.getMedicalRecordRequest as unknown as Handler
  );

  // updateMedicalRecordRequest
  app.put('/healthcare/hospital-admin/record-requests/:id',
    zValidator('param', validators.UpdateMedicalRecordRequestParams, validationErrorHandler),
    zValidator('json', validators.UpdateMedicalRecordRequestBody, validationErrorHandler),
    registry.updateMedicalRecordRequest as unknown as Handler
  );

  // deleteMedicalRecordRequest
  app.delete('/healthcare/hospital-admin/record-requests/:id',
    zValidator('param', validators.DeleteMedicalRecordRequestParams, validationErrorHandler),
    registry.deleteMedicalRecordRequest as unknown as Handler
  );

  // createROIRequest
  app.post('/healthcare/hospital-admin/roi-requests',
    zValidator('json', validators.CreateROIRequestBody, validationErrorHandler),
    registry.createROIRequest as unknown as Handler
  );

  // searchROIRequests
  app.get('/healthcare/hospital-admin/roi-requests/search',
    zValidator('query', validators.SearchROIRequestsQuery, validationErrorHandler),
    registry.searchROIRequests as unknown as Handler
  );

  // getROIRequest
  app.get('/healthcare/hospital-admin/roi-requests/:id',
    zValidator('param', validators.GetROIRequestParams, validationErrorHandler),
    registry.getROIRequest as unknown as Handler
  );

  // updateROIRequest
  app.put('/healthcare/hospital-admin/roi-requests/:id',
    zValidator('param', validators.UpdateROIRequestParams, validationErrorHandler),
    zValidator('json', validators.UpdateROIRequestBody, validationErrorHandler),
    registry.updateROIRequest as unknown as Handler
  );

  // deleteROIRequest
  app.delete('/healthcare/hospital-admin/roi-requests/:id',
    zValidator('param', validators.DeleteROIRequestParams, validationErrorHandler),
    registry.deleteROIRequest as unknown as Handler
  );

  // denyROIRequest
  app.post('/healthcare/hospital-admin/roi-requests/:id/deny',
    zValidator('param', validators.DenyROIRequestParams, validationErrorHandler),
    zValidator('json', validators.DenyROIRequestBody, validationErrorHandler),
    registry.denyROIRequest as unknown as Handler
  );

  // releaseROIRequest
  app.post('/healthcare/hospital-admin/roi-requests/:id/release',
    zValidator('param', validators.ReleaseROIRequestParams, validationErrorHandler),
    zValidator('json', validators.ReleaseROIRequestBody, validationErrorHandler),
    registry.releaseROIRequest as unknown as Handler
  );

  // createBiologicalIndicator
  app.post('/healthcare/hospital-ops/biological-indicators',
    zValidator('json', validators.CreateBiologicalIndicatorBody, validationErrorHandler),
    registry.createBiologicalIndicator as unknown as Handler
  );

  // searchBiologicalIndicators
  app.get('/healthcare/hospital-ops/biological-indicators/search',
    zValidator('query', validators.SearchBiologicalIndicatorsQuery, validationErrorHandler),
    registry.searchBiologicalIndicators as unknown as Handler
  );

  // getBiologicalIndicator
  app.get('/healthcare/hospital-ops/biological-indicators/:id',
    zValidator('param', validators.GetBiologicalIndicatorParams, validationErrorHandler),
    registry.getBiologicalIndicator as unknown as Handler
  );

  // updateBiologicalIndicator
  app.put('/healthcare/hospital-ops/biological-indicators/:id',
    zValidator('param', validators.UpdateBiologicalIndicatorParams, validationErrorHandler),
    zValidator('json', validators.UpdateBiologicalIndicatorBody, validationErrorHandler),
    registry.updateBiologicalIndicator as unknown as Handler
  );

  // deleteBiologicalIndicator
  app.delete('/healthcare/hospital-ops/biological-indicators/:id',
    zValidator('param', validators.DeleteBiologicalIndicatorParams, validationErrorHandler),
    registry.deleteBiologicalIndicator as unknown as Handler
  );

  // createBodyRelease
  app.post('/healthcare/hospital-ops/body-releases',
    zValidator('json', validators.CreateBodyReleaseBody, validationErrorHandler),
    registry.createBodyRelease as unknown as Handler
  );

  // searchBodyReleases
  app.get('/healthcare/hospital-ops/body-releases/search',
    zValidator('query', validators.SearchBodyReleasesQuery, validationErrorHandler),
    registry.searchBodyReleases as unknown as Handler
  );

  // getBodyRelease
  app.get('/healthcare/hospital-ops/body-releases/:id',
    zValidator('param', validators.GetBodyReleaseParams, validationErrorHandler),
    registry.getBodyRelease as unknown as Handler
  );

  // updateBodyRelease
  app.put('/healthcare/hospital-ops/body-releases/:id',
    zValidator('param', validators.UpdateBodyReleaseParams, validationErrorHandler),
    zValidator('json', validators.UpdateBodyReleaseBody, validationErrorHandler),
    registry.updateBodyRelease as unknown as Handler
  );

  // deleteBodyRelease
  app.delete('/healthcare/hospital-ops/body-releases/:id',
    zValidator('param', validators.DeleteBodyReleaseParams, validationErrorHandler),
    registry.deleteBodyRelease as unknown as Handler
  );

  // createCleaningSchedule
  app.post('/healthcare/hospital-ops/cleaning-schedules',
    zValidator('json', validators.CreateCleaningScheduleBody, validationErrorHandler),
    registry.createCleaningSchedule as unknown as Handler
  );

  // searchCleaningSchedules
  app.get('/healthcare/hospital-ops/cleaning-schedules/search',
    zValidator('query', validators.SearchCleaningSchedulesQuery, validationErrorHandler),
    registry.searchCleaningSchedules as unknown as Handler
  );

  // getCleaningSchedule
  app.get('/healthcare/hospital-ops/cleaning-schedules/:id',
    zValidator('param', validators.GetCleaningScheduleParams, validationErrorHandler),
    registry.getCleaningSchedule as unknown as Handler
  );

  // updateCleaningSchedule
  app.put('/healthcare/hospital-ops/cleaning-schedules/:id',
    zValidator('param', validators.UpdateCleaningScheduleParams, validationErrorHandler),
    zValidator('json', validators.UpdateCleaningScheduleBody, validationErrorHandler),
    registry.updateCleaningSchedule as unknown as Handler
  );

  // deleteCleaningSchedule
  app.delete('/healthcare/hospital-ops/cleaning-schedules/:id',
    zValidator('param', validators.DeleteCleaningScheduleParams, validationErrorHandler),
    registry.deleteCleaningSchedule as unknown as Handler
  );

  // createCleaningTask
  app.post('/healthcare/hospital-ops/cleaning-tasks',
    zValidator('json', validators.CreateCleaningTaskBody, validationErrorHandler),
    registry.createCleaningTask as unknown as Handler
  );

  // searchCleaningTasks
  app.get('/healthcare/hospital-ops/cleaning-tasks/search',
    zValidator('query', validators.SearchCleaningTasksQuery, validationErrorHandler),
    registry.searchCleaningTasks as unknown as Handler
  );

  // getCleaningTask
  app.get('/healthcare/hospital-ops/cleaning-tasks/:id',
    zValidator('param', validators.GetCleaningTaskParams, validationErrorHandler),
    registry.getCleaningTask as unknown as Handler
  );

  // updateCleaningTask
  app.put('/healthcare/hospital-ops/cleaning-tasks/:id',
    zValidator('param', validators.UpdateCleaningTaskParams, validationErrorHandler),
    zValidator('json', validators.UpdateCleaningTaskBody, validationErrorHandler),
    registry.updateCleaningTask as unknown as Handler
  );

  // deleteCleaningTask
  app.delete('/healthcare/hospital-ops/cleaning-tasks/:id',
    zValidator('param', validators.DeleteCleaningTaskParams, validationErrorHandler),
    registry.deleteCleaningTask as unknown as Handler
  );

  // assignCleaningTask
  app.post('/healthcare/hospital-ops/cleaning-tasks/:id/assign',
    zValidator('param', validators.AssignCleaningTaskParams, validationErrorHandler),
    zValidator('json', validators.AssignCleaningTaskBody, validationErrorHandler),
    registry.assignCleaningTask as unknown as Handler
  );

  // completeCleaningTask
  app.post('/healthcare/hospital-ops/cleaning-tasks/:id/complete',
    zValidator('param', validators.CompleteCleaningTaskParams, validationErrorHandler),
    zValidator('json', validators.CompleteCleaningTaskBody, validationErrorHandler),
    registry.completeCleaningTask as unknown as Handler
  );

  // verifyCleaningTask
  app.post('/healthcare/hospital-ops/cleaning-tasks/:id/verify',
    zValidator('param', validators.VerifyCleaningTaskParams, validationErrorHandler),
    zValidator('json', validators.VerifyCleaningTaskBody, validationErrorHandler),
    registry.verifyCleaningTask as unknown as Handler
  );

  // createDeceasedRecord
  app.post('/healthcare/hospital-ops/deceased-records',
    zValidator('json', validators.CreateDeceasedRecordBody, validationErrorHandler),
    registry.createDeceasedRecord as unknown as Handler
  );

  // searchDeceasedRecords
  app.get('/healthcare/hospital-ops/deceased-records/search',
    zValidator('query', validators.SearchDeceasedRecordsQuery, validationErrorHandler),
    registry.searchDeceasedRecords as unknown as Handler
  );

  // getDeceasedRecord
  app.get('/healthcare/hospital-ops/deceased-records/:id',
    zValidator('param', validators.GetDeceasedRecordParams, validationErrorHandler),
    registry.getDeceasedRecord as unknown as Handler
  );

  // updateDeceasedRecord
  app.put('/healthcare/hospital-ops/deceased-records/:id',
    zValidator('param', validators.UpdateDeceasedRecordParams, validationErrorHandler),
    zValidator('json', validators.UpdateDeceasedRecordBody, validationErrorHandler),
    registry.updateDeceasedRecord as unknown as Handler
  );

  // deleteDeceasedRecord
  app.delete('/healthcare/hospital-ops/deceased-records/:id',
    zValidator('param', validators.DeleteDeceasedRecordParams, validationErrorHandler),
    registry.deleteDeceasedRecord as unknown as Handler
  );

  // createDietOrder
  app.post('/healthcare/hospital-ops/diet-orders',
    zValidator('json', validators.CreateDietOrderBody, validationErrorHandler),
    registry.createDietOrder as unknown as Handler
  );

  // searchDietOrders
  app.get('/healthcare/hospital-ops/diet-orders/search',
    zValidator('query', validators.SearchDietOrdersQuery, validationErrorHandler),
    registry.searchDietOrders as unknown as Handler
  );

  // getDietOrder
  app.get('/healthcare/hospital-ops/diet-orders/:id',
    zValidator('param', validators.GetDietOrderParams, validationErrorHandler),
    registry.getDietOrder as unknown as Handler
  );

  // updateDietOrder
  app.put('/healthcare/hospital-ops/diet-orders/:id',
    zValidator('param', validators.UpdateDietOrderParams, validationErrorHandler),
    zValidator('json', validators.UpdateDietOrderBody, validationErrorHandler),
    registry.updateDietOrder as unknown as Handler
  );

  // deleteDietOrder
  app.delete('/healthcare/hospital-ops/diet-orders/:id',
    zValidator('param', validators.DeleteDietOrderParams, validationErrorHandler),
    registry.deleteDietOrder as unknown as Handler
  );

  // createEmergencyActivation
  app.post('/healthcare/hospital-ops/emergency/activations',
    zValidator('json', validators.CreateEmergencyActivationBody, validationErrorHandler),
    registry.createEmergencyActivation as unknown as Handler
  );

  // activateEmergencyPlan
  app.post('/healthcare/hospital-ops/emergency/activations/activate',
    zValidator('json', validators.ActivateEmergencyPlanBody, validationErrorHandler),
    registry.activateEmergencyPlan as unknown as Handler
  );

  // searchEmergencyActivations
  app.get('/healthcare/hospital-ops/emergency/activations/search',
    zValidator('query', validators.SearchEmergencyActivationsQuery, validationErrorHandler),
    registry.searchEmergencyActivations as unknown as Handler
  );

  // getEmergencyActivation
  app.get('/healthcare/hospital-ops/emergency/activations/:id',
    zValidator('param', validators.GetEmergencyActivationParams, validationErrorHandler),
    registry.getEmergencyActivation as unknown as Handler
  );

  // updateEmergencyActivation
  app.put('/healthcare/hospital-ops/emergency/activations/:id',
    zValidator('param', validators.UpdateEmergencyActivationParams, validationErrorHandler),
    zValidator('json', validators.UpdateEmergencyActivationBody, validationErrorHandler),
    registry.updateEmergencyActivation as unknown as Handler
  );

  // deleteEmergencyActivation
  app.delete('/healthcare/hospital-ops/emergency/activations/:id',
    zValidator('param', validators.DeleteEmergencyActivationParams, validationErrorHandler),
    registry.deleteEmergencyActivation as unknown as Handler
  );

  // deactivateEmergency
  app.post('/healthcare/hospital-ops/emergency/activations/:id/deactivate',
    zValidator('param', validators.DeactivateEmergencyParams, validationErrorHandler),
    zValidator('json', validators.DeactivateEmergencyBody, validationErrorHandler),
    registry.deactivateEmergency as unknown as Handler
  );

  // createEmergencyDrill
  app.post('/healthcare/hospital-ops/emergency/drills',
    zValidator('json', validators.CreateEmergencyDrillBody, validationErrorHandler),
    registry.createEmergencyDrill as unknown as Handler
  );

  // searchEmergencyDrills
  app.get('/healthcare/hospital-ops/emergency/drills/search',
    zValidator('query', validators.SearchEmergencyDrillsQuery, validationErrorHandler),
    registry.searchEmergencyDrills as unknown as Handler
  );

  // getEmergencyDrill
  app.get('/healthcare/hospital-ops/emergency/drills/:id',
    zValidator('param', validators.GetEmergencyDrillParams, validationErrorHandler),
    registry.getEmergencyDrill as unknown as Handler
  );

  // updateEmergencyDrill
  app.put('/healthcare/hospital-ops/emergency/drills/:id',
    zValidator('param', validators.UpdateEmergencyDrillParams, validationErrorHandler),
    zValidator('json', validators.UpdateEmergencyDrillBody, validationErrorHandler),
    registry.updateEmergencyDrill as unknown as Handler
  );

  // deleteEmergencyDrill
  app.delete('/healthcare/hospital-ops/emergency/drills/:id',
    zValidator('param', validators.DeleteEmergencyDrillParams, validationErrorHandler),
    registry.deleteEmergencyDrill as unknown as Handler
  );

  // createEmergencyPlan
  app.post('/healthcare/hospital-ops/emergency/plans',
    zValidator('json', validators.CreateEmergencyPlanBody, validationErrorHandler),
    registry.createEmergencyPlan as unknown as Handler
  );

  // searchEmergencyPlans
  app.get('/healthcare/hospital-ops/emergency/plans/search',
    zValidator('query', validators.SearchEmergencyPlansQuery, validationErrorHandler),
    registry.searchEmergencyPlans as unknown as Handler
  );

  // getEmergencyPlan
  app.get('/healthcare/hospital-ops/emergency/plans/:id',
    zValidator('param', validators.GetEmergencyPlanParams, validationErrorHandler),
    registry.getEmergencyPlan as unknown as Handler
  );

  // updateEmergencyPlan
  app.put('/healthcare/hospital-ops/emergency/plans/:id',
    zValidator('param', validators.UpdateEmergencyPlanParams, validationErrorHandler),
    zValidator('json', validators.UpdateEmergencyPlanBody, validationErrorHandler),
    registry.updateEmergencyPlan as unknown as Handler
  );

  // deleteEmergencyPlan
  app.delete('/healthcare/hospital-ops/emergency/plans/:id',
    zValidator('param', validators.DeleteEmergencyPlanParams, validationErrorHandler),
    registry.deleteEmergencyPlan as unknown as Handler
  );

  // createSurgeCapacity
  app.post('/healthcare/hospital-ops/emergency/surge-capacity',
    zValidator('json', validators.CreateSurgeCapacityBody, validationErrorHandler),
    registry.createSurgeCapacity as unknown as Handler
  );

  // getCurrentSurgeCapacity
  app.get('/healthcare/hospital-ops/emergency/surge-capacity/current',
    registry.getCurrentSurgeCapacity as unknown as Handler
  );

  // searchSurgeCapacity
  app.get('/healthcare/hospital-ops/emergency/surge-capacity/search',
    zValidator('query', validators.SearchSurgeCapacityQuery, validationErrorHandler),
    registry.searchSurgeCapacity as unknown as Handler
  );

  // createInstrumentSet
  app.post('/healthcare/hospital-ops/instrument-sets',
    zValidator('json', validators.CreateInstrumentSetBody, validationErrorHandler),
    registry.createInstrumentSet as unknown as Handler
  );

  // searchInstrumentSets
  app.get('/healthcare/hospital-ops/instrument-sets/search',
    zValidator('query', validators.SearchInstrumentSetsQuery, validationErrorHandler),
    registry.searchInstrumentSets as unknown as Handler
  );

  // getInstrumentSet
  app.get('/healthcare/hospital-ops/instrument-sets/:id',
    zValidator('param', validators.GetInstrumentSetParams, validationErrorHandler),
    registry.getInstrumentSet as unknown as Handler
  );

  // updateInstrumentSet
  app.put('/healthcare/hospital-ops/instrument-sets/:id',
    zValidator('param', validators.UpdateInstrumentSetParams, validationErrorHandler),
    zValidator('json', validators.UpdateInstrumentSetBody, validationErrorHandler),
    registry.updateInstrumentSet as unknown as Handler
  );

  // deleteInstrumentSet
  app.delete('/healthcare/hospital-ops/instrument-sets/:id',
    zValidator('param', validators.DeleteInstrumentSetParams, validationErrorHandler),
    registry.deleteInstrumentSet as unknown as Handler
  );

  // createMealService
  app.post('/healthcare/hospital-ops/meal-service',
    zValidator('json', validators.CreateMealServiceBody, validationErrorHandler),
    registry.createMealService as unknown as Handler
  );

  // searchMealServices
  app.get('/healthcare/hospital-ops/meal-service/search',
    zValidator('query', validators.SearchMealServicesQuery, validationErrorHandler),
    registry.searchMealServices as unknown as Handler
  );

  // getMealService
  app.get('/healthcare/hospital-ops/meal-service/:id',
    zValidator('param', validators.GetMealServiceParams, validationErrorHandler),
    registry.getMealService as unknown as Handler
  );

  // updateMealService
  app.put('/healthcare/hospital-ops/meal-service/:id',
    zValidator('param', validators.UpdateMealServiceParams, validationErrorHandler),
    zValidator('json', validators.UpdateMealServiceBody, validationErrorHandler),
    registry.updateMealService as unknown as Handler
  );

  // deleteMealService
  app.delete('/healthcare/hospital-ops/meal-service/:id',
    zValidator('param', validators.DeleteMealServiceParams, validationErrorHandler),
    registry.deleteMealService as unknown as Handler
  );

  // createMortuaryStorage
  app.post('/healthcare/hospital-ops/mortuary-storage',
    zValidator('json', validators.CreateMortuaryStorageBody, validationErrorHandler),
    registry.createMortuaryStorage as unknown as Handler
  );

  // searchMortuaryStorage
  app.get('/healthcare/hospital-ops/mortuary-storage/search',
    zValidator('query', validators.SearchMortuaryStorageQuery, validationErrorHandler),
    registry.searchMortuaryStorage as unknown as Handler
  );

  // getMortuaryStorage
  app.get('/healthcare/hospital-ops/mortuary-storage/:id',
    zValidator('param', validators.GetMortuaryStorageParams, validationErrorHandler),
    registry.getMortuaryStorage as unknown as Handler
  );

  // updateMortuaryStorage
  app.put('/healthcare/hospital-ops/mortuary-storage/:id',
    zValidator('param', validators.UpdateMortuaryStorageParams, validationErrorHandler),
    zValidator('json', validators.UpdateMortuaryStorageBody, validationErrorHandler),
    registry.updateMortuaryStorage as unknown as Handler
  );

  // deleteMortuaryStorage
  app.delete('/healthcare/hospital-ops/mortuary-storage/:id',
    zValidator('param', validators.DeleteMortuaryStorageParams, validationErrorHandler),
    registry.deleteMortuaryStorage as unknown as Handler
  );

  // createNutritionScreening
  app.post('/healthcare/hospital-ops/nutrition-screening',
    zValidator('json', validators.CreateNutritionScreeningBody, validationErrorHandler),
    registry.createNutritionScreening as unknown as Handler
  );

  // searchNutritionScreenings
  app.get('/healthcare/hospital-ops/nutrition-screening/search',
    zValidator('query', validators.SearchNutritionScreeningsQuery, validationErrorHandler),
    registry.searchNutritionScreenings as unknown as Handler
  );

  // getNutritionScreening
  app.get('/healthcare/hospital-ops/nutrition-screening/:id',
    zValidator('param', validators.GetNutritionScreeningParams, validationErrorHandler),
    registry.getNutritionScreening as unknown as Handler
  );

  // updateNutritionScreening
  app.put('/healthcare/hospital-ops/nutrition-screening/:id',
    zValidator('param', validators.UpdateNutritionScreeningParams, validationErrorHandler),
    zValidator('json', validators.UpdateNutritionScreeningBody, validationErrorHandler),
    registry.updateNutritionScreening as unknown as Handler
  );

  // deleteNutritionScreening
  app.delete('/healthcare/hospital-ops/nutrition-screening/:id',
    zValidator('param', validators.DeleteNutritionScreeningParams, validationErrorHandler),
    registry.deleteNutritionScreening as unknown as Handler
  );

  // createPeerReviewAction
  app.post('/healthcare/hospital-ops/peer-review/actions',
    zValidator('json', validators.CreatePeerReviewActionBody, validationErrorHandler),
    registry.createPeerReviewAction as unknown as Handler
  );

  // searchPeerReviewActions
  app.get('/healthcare/hospital-ops/peer-review/actions/search',
    zValidator('query', validators.SearchPeerReviewActionsQuery, validationErrorHandler),
    registry.searchPeerReviewActions as unknown as Handler
  );

  // getPeerReviewAction
  app.get('/healthcare/hospital-ops/peer-review/actions/:id',
    zValidator('param', validators.GetPeerReviewActionParams, validationErrorHandler),
    registry.getPeerReviewAction as unknown as Handler
  );

  // updatePeerReviewAction
  app.put('/healthcare/hospital-ops/peer-review/actions/:id',
    zValidator('param', validators.UpdatePeerReviewActionParams, validationErrorHandler),
    zValidator('json', validators.UpdatePeerReviewActionBody, validationErrorHandler),
    registry.updatePeerReviewAction as unknown as Handler
  );

  // deletePeerReviewAction
  app.delete('/healthcare/hospital-ops/peer-review/actions/:id',
    zValidator('param', validators.DeletePeerReviewActionParams, validationErrorHandler),
    registry.deletePeerReviewAction as unknown as Handler
  );

  // createPeerReviewCase
  app.post('/healthcare/hospital-ops/peer-review/cases',
    zValidator('json', validators.CreatePeerReviewCaseBody, validationErrorHandler),
    registry.createPeerReviewCase as unknown as Handler
  );

  // searchPeerReviewCases
  app.get('/healthcare/hospital-ops/peer-review/cases/search',
    zValidator('query', validators.SearchPeerReviewCasesQuery, validationErrorHandler),
    registry.searchPeerReviewCases as unknown as Handler
  );

  // getPeerReviewCase
  app.get('/healthcare/hospital-ops/peer-review/cases/:id',
    zValidator('param', validators.GetPeerReviewCaseParams, validationErrorHandler),
    registry.getPeerReviewCase as unknown as Handler
  );

  // updatePeerReviewCase
  app.put('/healthcare/hospital-ops/peer-review/cases/:id',
    zValidator('param', validators.UpdatePeerReviewCaseParams, validationErrorHandler),
    zValidator('json', validators.UpdatePeerReviewCaseBody, validationErrorHandler),
    registry.updatePeerReviewCase as unknown as Handler
  );

  // deletePeerReviewCase
  app.delete('/healthcare/hospital-ops/peer-review/cases/:id',
    zValidator('param', validators.DeletePeerReviewCaseParams, validationErrorHandler),
    registry.deletePeerReviewCase as unknown as Handler
  );

  // transitionPeerReviewCaseStatus
  app.post('/healthcare/hospital-ops/peer-review/cases/:id/status',
    zValidator('param', validators.TransitionPeerReviewCaseStatusParams, validationErrorHandler),
    zValidator('json', validators.TransitionPeerReviewCaseStatusBody, validationErrorHandler),
    registry.transitionPeerReviewCaseStatus as unknown as Handler
  );

  // createPeerReviewPanel
  app.post('/healthcare/hospital-ops/peer-review/panels',
    zValidator('json', validators.CreatePeerReviewPanelBody, validationErrorHandler),
    registry.createPeerReviewPanel as unknown as Handler
  );

  // searchPeerReviewPanels
  app.get('/healthcare/hospital-ops/peer-review/panels/search',
    zValidator('query', validators.SearchPeerReviewPanelsQuery, validationErrorHandler),
    registry.searchPeerReviewPanels as unknown as Handler
  );

  // getPeerReviewPanel
  app.get('/healthcare/hospital-ops/peer-review/panels/:id',
    zValidator('param', validators.GetPeerReviewPanelParams, validationErrorHandler),
    registry.getPeerReviewPanel as unknown as Handler
  );

  // updatePeerReviewPanel
  app.put('/healthcare/hospital-ops/peer-review/panels/:id',
    zValidator('param', validators.UpdatePeerReviewPanelParams, validationErrorHandler),
    zValidator('json', validators.UpdatePeerReviewPanelBody, validationErrorHandler),
    registry.updatePeerReviewPanel as unknown as Handler
  );

  // deletePeerReviewPanel
  app.delete('/healthcare/hospital-ops/peer-review/panels/:id',
    zValidator('param', validators.DeletePeerReviewPanelParams, validationErrorHandler),
    registry.deletePeerReviewPanel as unknown as Handler
  );

  // createSterilizationCycle
  app.post('/healthcare/hospital-ops/sterilization-cycles',
    zValidator('json', validators.CreateSterilizationCycleBody, validationErrorHandler),
    registry.createSterilizationCycle as unknown as Handler
  );

  // searchSterilizationCycles
  app.get('/healthcare/hospital-ops/sterilization-cycles/search',
    zValidator('query', validators.SearchSterilizationCyclesQuery, validationErrorHandler),
    registry.searchSterilizationCycles as unknown as Handler
  );

  // getSterilizationCycle
  app.get('/healthcare/hospital-ops/sterilization-cycles/:id',
    zValidator('param', validators.GetSterilizationCycleParams, validationErrorHandler),
    registry.getSterilizationCycle as unknown as Handler
  );

  // updateSterilizationCycle
  app.put('/healthcare/hospital-ops/sterilization-cycles/:id',
    zValidator('param', validators.UpdateSterilizationCycleParams, validationErrorHandler),
    zValidator('json', validators.UpdateSterilizationCycleBody, validationErrorHandler),
    registry.updateSterilizationCycle as unknown as Handler
  );

  // deleteSterilizationCycle
  app.delete('/healthcare/hospital-ops/sterilization-cycles/:id',
    zValidator('param', validators.DeleteSterilizationCycleParams, validationErrorHandler),
    registry.deleteSterilizationCycle as unknown as Handler
  );

  // createSterilizationLog
  app.post('/healthcare/hospital-ops/sterilization-logs',
    zValidator('json', validators.CreateSterilizationLogBody, validationErrorHandler),
    registry.createSterilizationLog as unknown as Handler
  );

  // searchSterilizationLogs
  app.get('/healthcare/hospital-ops/sterilization-logs/search',
    zValidator('query', validators.SearchSterilizationLogsQuery, validationErrorHandler),
    registry.searchSterilizationLogs as unknown as Handler
  );

  // getSterilizationLog
  app.get('/healthcare/hospital-ops/sterilization-logs/:id',
    zValidator('param', validators.GetSterilizationLogParams, validationErrorHandler),
    registry.getSterilizationLog as unknown as Handler
  );

  // updateSterilizationLog
  app.put('/healthcare/hospital-ops/sterilization-logs/:id',
    zValidator('param', validators.UpdateSterilizationLogParams, validationErrorHandler),
    zValidator('json', validators.UpdateSterilizationLogBody, validationErrorHandler),
    registry.updateSterilizationLog as unknown as Handler
  );

  // deleteSterilizationLog
  app.delete('/healthcare/hospital-ops/sterilization-logs/:id',
    zValidator('param', validators.DeleteSterilizationLogParams, validationErrorHandler),
    registry.deleteSterilizationLog as unknown as Handler
  );

  // createTransportRequest
  app.post('/healthcare/hospital-ops/transport-requests',
    zValidator('json', validators.CreateTransportRequestBody, validationErrorHandler),
    registry.createTransportRequest as unknown as Handler
  );

  // searchTransportRequests
  app.get('/healthcare/hospital-ops/transport-requests/search',
    zValidator('query', validators.SearchTransportRequestsQuery, validationErrorHandler),
    registry.searchTransportRequests as unknown as Handler
  );

  // getTransportRequest
  app.get('/healthcare/hospital-ops/transport-requests/:id',
    zValidator('param', validators.GetTransportRequestParams, validationErrorHandler),
    registry.getTransportRequest as unknown as Handler
  );

  // updateTransportRequest
  app.put('/healthcare/hospital-ops/transport-requests/:id',
    zValidator('param', validators.UpdateTransportRequestParams, validationErrorHandler),
    zValidator('json', validators.UpdateTransportRequestBody, validationErrorHandler),
    registry.updateTransportRequest as unknown as Handler
  );

  // deleteTransportRequest
  app.delete('/healthcare/hospital-ops/transport-requests/:id',
    zValidator('param', validators.DeleteTransportRequestParams, validationErrorHandler),
    registry.deleteTransportRequest as unknown as Handler
  );

  // assignTransportRequest
  app.post('/healthcare/hospital-ops/transport-requests/:id/assign',
    zValidator('param', validators.AssignTransportRequestParams, validationErrorHandler),
    zValidator('json', validators.AssignTransportRequestBody, validationErrorHandler),
    registry.assignTransportRequest as unknown as Handler
  );

  // completeTransportRequest
  app.post('/healthcare/hospital-ops/transport-requests/:id/complete',
    zValidator('param', validators.CompleteTransportRequestParams, validationErrorHandler),
    zValidator('json', validators.CompleteTransportRequestBody, validationErrorHandler),
    registry.completeTransportRequest as unknown as Handler
  );

  // dispatchTransportRequest
  app.post('/healthcare/hospital-ops/transport-requests/:id/dispatch',
    zValidator('param', validators.DispatchTransportRequestParams, validationErrorHandler),
    zValidator('json', validators.DispatchTransportRequestBody, validationErrorHandler),
    registry.dispatchTransportRequest as unknown as Handler
  );

  // createTransportTeam
  app.post('/healthcare/hospital-ops/transport-teams',
    zValidator('json', validators.CreateTransportTeamBody, validationErrorHandler),
    registry.createTransportTeam as unknown as Handler
  );

  // searchTransportTeams
  app.get('/healthcare/hospital-ops/transport-teams/search',
    zValidator('query', validators.SearchTransportTeamsQuery, validationErrorHandler),
    registry.searchTransportTeams as unknown as Handler
  );

  // getTransportTeam
  app.get('/healthcare/hospital-ops/transport-teams/:id',
    zValidator('param', validators.GetTransportTeamParams, validationErrorHandler),
    registry.getTransportTeam as unknown as Handler
  );

  // updateTransportTeam
  app.put('/healthcare/hospital-ops/transport-teams/:id',
    zValidator('param', validators.UpdateTransportTeamParams, validationErrorHandler),
    zValidator('json', validators.UpdateTransportTeamBody, validationErrorHandler),
    registry.updateTransportTeam as unknown as Handler
  );

  // deleteTransportTeam
  app.delete('/healthcare/hospital-ops/transport-teams/:id',
    zValidator('param', validators.DeleteTransportTeamParams, validationErrorHandler),
    registry.deleteTransportTeam as unknown as Handler
  );

  // createImplant
  app.post('/healthcare/implant-registry/implants',
    zValidator('json', validators.CreateImplantBody, validationErrorHandler),
    registry.createImplant as unknown as Handler
  );

  // searchImplants
  app.get('/healthcare/implant-registry/implants',
    zValidator('query', validators.SearchImplantsQuery, validationErrorHandler),
    zValidator('json', validators.SearchImplantsBody, validationErrorHandler),
    registry.searchImplants as unknown as Handler
  );

  // getImplantsByLotNumber
  app.get('/healthcare/implant-registry/implants/by-lot',
    zValidator('query', validators.GetImplantsByLotNumberQuery, validationErrorHandler),
    zValidator('json', validators.GetImplantsByLotNumberBody, validationErrorHandler),
    registry.getImplantsByLotNumber as unknown as Handler
  );

  // getImplant
  app.get('/healthcare/implant-registry/implants/:id',
    zValidator('param', validators.GetImplantParams, validationErrorHandler),
    registry.getImplant as unknown as Handler
  );

  // updateImplant
  app.put('/healthcare/implant-registry/implants/:id',
    zValidator('param', validators.UpdateImplantParams, validationErrorHandler),
    zValidator('json', validators.UpdateImplantBody, validationErrorHandler),
    registry.updateImplant as unknown as Handler
  );

  // deleteImplant
  app.delete('/healthcare/implant-registry/implants/:id',
    zValidator('param', validators.DeleteImplantParams, validationErrorHandler),
    registry.deleteImplant as unknown as Handler
  );

  // createOsseointegrationCheck
  app.post('/healthcare/implant-registry/osseointegration',
    zValidator('json', validators.CreateOsseointegrationCheckBody, validationErrorHandler),
    registry.createOsseointegrationCheck as unknown as Handler
  );

  // searchOsseointegrationChecks
  app.get('/healthcare/implant-registry/osseointegration',
    zValidator('query', validators.SearchOsseointegrationChecksQuery, validationErrorHandler),
    zValidator('json', validators.SearchOsseointegrationChecksBody, validationErrorHandler),
    registry.searchOsseointegrationChecks as unknown as Handler
  );

  // getOsseointegrationCheck
  app.get('/healthcare/implant-registry/osseointegration/:id',
    zValidator('param', validators.GetOsseointegrationCheckParams, validationErrorHandler),
    registry.getOsseointegrationCheck as unknown as Handler
  );

  // updateOsseointegrationCheck
  app.put('/healthcare/implant-registry/osseointegration/:id',
    zValidator('param', validators.UpdateOsseointegrationCheckParams, validationErrorHandler),
    zValidator('json', validators.UpdateOsseointegrationCheckBody, validationErrorHandler),
    registry.updateOsseointegrationCheck as unknown as Handler
  );

  // deleteOsseointegrationCheck
  app.delete('/healthcare/implant-registry/osseointegration/:id',
    zValidator('param', validators.DeleteOsseointegrationCheckParams, validationErrorHandler),
    registry.deleteOsseointegrationCheck as unknown as Handler
  );

  // createImplantRecall
  app.post('/healthcare/implant-registry/recalls',
    zValidator('json', validators.CreateImplantRecallBody, validationErrorHandler),
    registry.createImplantRecall as unknown as Handler
  );

  // searchImplantRecalls
  app.get('/healthcare/implant-registry/recalls',
    zValidator('query', validators.SearchImplantRecallsQuery, validationErrorHandler),
    zValidator('json', validators.SearchImplantRecallsBody, validationErrorHandler),
    registry.searchImplantRecalls as unknown as Handler
  );

  // getImplantRecallAffectedPatients
  app.get('/healthcare/implant-registry/recalls/affected-patients',
    zValidator('query', validators.GetImplantRecallAffectedPatientsQuery, validationErrorHandler),
    zValidator('json', validators.GetImplantRecallAffectedPatientsBody, validationErrorHandler),
    registry.getImplantRecallAffectedPatients as unknown as Handler
  );

  // createAntibiogram
  app.post('/healthcare/infection-control/antibiograms',
    zValidator('json', validators.CreateAntibiogramBody, validationErrorHandler),
    registry.createAntibiogram as unknown as Handler
  );

  // searchAntibiograms
  app.get('/healthcare/infection-control/antibiograms/search',
    zValidator('query', validators.SearchAntibiogramsQuery, validationErrorHandler),
    registry.searchAntibiograms as unknown as Handler
  );

  // getAntibiogram
  app.get('/healthcare/infection-control/antibiograms/:id',
    zValidator('param', validators.GetAntibiogramParams, validationErrorHandler),
    registry.getAntibiogram as unknown as Handler
  );

  // updateAntibiogram
  app.put('/healthcare/infection-control/antibiograms/:id',
    zValidator('param', validators.UpdateAntibiogramParams, validationErrorHandler),
    zValidator('json', validators.UpdateAntibiogramBody, validationErrorHandler),
    registry.updateAntibiogram as unknown as Handler
  );

  // deleteAntibiogram
  app.delete('/healthcare/infection-control/antibiograms/:id',
    zValidator('param', validators.DeleteAntibiogramParams, validationErrorHandler),
    registry.deleteAntibiogram as unknown as Handler
  );

  // createInfectionSurveillance
  app.post('/healthcare/infection-control/surveillance',
    zValidator('json', validators.CreateInfectionSurveillanceBody, validationErrorHandler),
    registry.createInfectionSurveillance as unknown as Handler
  );

  // searchInfectionSurveillance
  app.get('/healthcare/infection-control/surveillance/search',
    zValidator('query', validators.SearchInfectionSurveillanceQuery, validationErrorHandler),
    registry.searchInfectionSurveillance as unknown as Handler
  );

  // getInfectionSurveillance
  app.get('/healthcare/infection-control/surveillance/:id',
    zValidator('param', validators.GetInfectionSurveillanceParams, validationErrorHandler),
    registry.getInfectionSurveillance as unknown as Handler
  );

  // updateInfectionSurveillance
  app.put('/healthcare/infection-control/surveillance/:id',
    zValidator('param', validators.UpdateInfectionSurveillanceParams, validationErrorHandler),
    zValidator('json', validators.UpdateInfectionSurveillanceBody, validationErrorHandler),
    registry.updateInfectionSurveillance as unknown as Handler
  );

  // deleteInfectionSurveillance
  app.delete('/healthcare/infection-control/surveillance/:id',
    zValidator('param', validators.DeleteInfectionSurveillanceParams, validationErrorHandler),
    registry.deleteInfectionSurveillance as unknown as Handler
  );

  // createCoverage
  app.post('/healthcare/insurance/coverages',
    zValidator('json', validators.CreateCoverageBody, validationErrorHandler),
    registry.createCoverage as unknown as Handler
  );

  // searchCoverages
  app.get('/healthcare/insurance/coverages/search',
    zValidator('query', validators.SearchCoveragesQuery, validationErrorHandler),
    registry.searchCoverages as unknown as Handler
  );

  // getCoverage
  app.get('/healthcare/insurance/coverages/:id',
    zValidator('param', validators.GetCoverageParams, validationErrorHandler),
    registry.getCoverage as unknown as Handler
  );

  // updateCoverage
  app.put('/healthcare/insurance/coverages/:id',
    zValidator('param', validators.UpdateCoverageParams, validationErrorHandler),
    zValidator('json', validators.UpdateCoverageBody, validationErrorHandler),
    registry.updateCoverage as unknown as Handler
  );

  // patchCoverage
  app.patch('/healthcare/insurance/coverages/:id',
    zValidator('param', validators.PatchCoverageParams, validationErrorHandler),
    zValidator('json', validators.PatchCoverageBody, validationErrorHandler),
    registry.patchCoverage as unknown as Handler
  );

  // deleteCoverage
  app.delete('/healthcare/insurance/coverages/:id',
    zValidator('param', validators.DeleteCoverageParams, validationErrorHandler),
    registry.deleteCoverage as unknown as Handler
  );

  // verifyEligibility
  app.post('/healthcare/insurance/eligibility',
    zValidator('json', validators.VerifyEligibilityBody, validationErrorHandler),
    registry.verifyEligibility as unknown as Handler
  );

  // createInventoryBatch
  app.post('/healthcare/inventory/batches',
    zValidator('json', validators.CreateInventoryBatchBody, validationErrorHandler),
    registry.createInventoryBatch as unknown as Handler
  );

  // searchInventoryBatches
  app.get('/healthcare/inventory/batches/search',
    zValidator('query', validators.SearchInventoryBatchesQuery, validationErrorHandler),
    registry.searchInventoryBatches as unknown as Handler
  );

  // getInventoryBatch
  app.get('/healthcare/inventory/batches/:id',
    zValidator('param', validators.GetInventoryBatchParams, validationErrorHandler),
    registry.getInventoryBatch as unknown as Handler
  );

  // updateInventoryBatch
  app.put('/healthcare/inventory/batches/:id',
    zValidator('param', validators.UpdateInventoryBatchParams, validationErrorHandler),
    zValidator('json', validators.UpdateInventoryBatchBody, validationErrorHandler),
    registry.updateInventoryBatch as unknown as Handler
  );

  // patchInventoryBatch
  app.patch('/healthcare/inventory/batches/:id',
    zValidator('param', validators.PatchInventoryBatchParams, validationErrorHandler),
    zValidator('json', validators.PatchInventoryBatchBody, validationErrorHandler),
    registry.patchInventoryBatch as unknown as Handler
  );

  // deleteInventoryBatch
  app.delete('/healthcare/inventory/batches/:id',
    zValidator('param', validators.DeleteInventoryBatchParams, validationErrorHandler),
    registry.deleteInventoryBatch as unknown as Handler
  );

  // createSupplyConsumption
  app.post('/healthcare/inventory/consumption',
    zValidator('json', validators.CreateSupplyConsumptionBody, validationErrorHandler),
    registry.createSupplyConsumption as unknown as Handler
  );

  // searchSupplyConsumptions
  app.get('/healthcare/inventory/consumption/search',
    zValidator('query', validators.SearchSupplyConsumptionsQuery, validationErrorHandler),
    registry.searchSupplyConsumptions as unknown as Handler
  );

  // getSupplyConsumption
  app.get('/healthcare/inventory/consumption/:id',
    zValidator('param', validators.GetSupplyConsumptionParams, validationErrorHandler),
    registry.getSupplyConsumption as unknown as Handler
  );

  // createInventoryItem
  app.post('/healthcare/inventory/items',
    zValidator('json', validators.CreateInventoryItemBody, validationErrorHandler),
    registry.createInventoryItem as unknown as Handler
  );

  // searchInventoryItems
  app.get('/healthcare/inventory/items/search',
    zValidator('query', validators.SearchInventoryItemsQuery, validationErrorHandler),
    registry.searchInventoryItems as unknown as Handler
  );

  // getInventoryItem
  app.get('/healthcare/inventory/items/:id',
    zValidator('param', validators.GetInventoryItemParams, validationErrorHandler),
    registry.getInventoryItem as unknown as Handler
  );

  // updateInventoryItem
  app.put('/healthcare/inventory/items/:id',
    zValidator('param', validators.UpdateInventoryItemParams, validationErrorHandler),
    zValidator('json', validators.UpdateInventoryItemBody, validationErrorHandler),
    registry.updateInventoryItem as unknown as Handler
  );

  // patchInventoryItem
  app.patch('/healthcare/inventory/items/:id',
    zValidator('param', validators.PatchInventoryItemParams, validationErrorHandler),
    zValidator('json', validators.PatchInventoryItemBody, validationErrorHandler),
    registry.patchInventoryItem as unknown as Handler
  );

  // deleteInventoryItem
  app.delete('/healthcare/inventory/items/:id',
    zValidator('param', validators.DeleteInventoryItemParams, validationErrorHandler),
    registry.deleteInventoryItem as unknown as Handler
  );

  // createDiagnosticReport
  app.post('/healthcare/laboratory/diagnostic-reports',
    zValidator('json', validators.CreateDiagnosticReportBody, validationErrorHandler),
    registry.createDiagnosticReport as unknown as Handler
  );

  // searchDiagnosticReports
  app.get('/healthcare/laboratory/diagnostic-reports',
    zValidator('query', validators.SearchDiagnosticReportsQuery, validationErrorHandler),
    zValidator('json', validators.SearchDiagnosticReportsBody, validationErrorHandler),
    registry.searchDiagnosticReports as unknown as Handler
  );

  // getDiagnosticReport
  app.get('/healthcare/laboratory/diagnostic-reports/:id',
    zValidator('param', validators.GetDiagnosticReportParams, validationErrorHandler),
    registry.getDiagnosticReport as unknown as Handler
  );

  // updateDiagnosticReport
  app.put('/healthcare/laboratory/diagnostic-reports/:id',
    zValidator('param', validators.UpdateDiagnosticReportParams, validationErrorHandler),
    zValidator('json', validators.UpdateDiagnosticReportBody, validationErrorHandler),
    registry.updateDiagnosticReport as unknown as Handler
  );

  // deleteDiagnosticReport
  app.delete('/healthcare/laboratory/diagnostic-reports/:id',
    zValidator('param', validators.DeleteDiagnosticReportParams, validationErrorHandler),
    registry.deleteDiagnosticReport as unknown as Handler
  );

  // createResultPanel
  app.post('/healthcare/laboratory/panels',
    zValidator('json', validators.CreateResultPanelBody, validationErrorHandler),
    registry.createResultPanel as unknown as Handler
  );

  // searchResultPanels
  app.get('/healthcare/laboratory/panels/search',
    zValidator('query', validators.SearchResultPanelsQuery, validationErrorHandler),
    registry.searchResultPanels as unknown as Handler
  );

  // getResultPanel
  app.get('/healthcare/laboratory/panels/:id',
    zValidator('param', validators.GetResultPanelParams, validationErrorHandler),
    registry.getResultPanel as unknown as Handler
  );

  // createSpecimen
  app.post('/healthcare/laboratory/specimens',
    zValidator('json', validators.CreateSpecimenBody, validationErrorHandler),
    registry.createSpecimen as unknown as Handler
  );

  // searchSpecimens
  app.get('/healthcare/laboratory/specimens',
    zValidator('query', validators.SearchSpecimensQuery, validationErrorHandler),
    zValidator('json', validators.SearchSpecimensBody, validationErrorHandler),
    registry.searchSpecimens as unknown as Handler
  );

  // getSpecimen
  app.get('/healthcare/laboratory/specimens/:id',
    zValidator('param', validators.GetSpecimenParams, validationErrorHandler),
    registry.getSpecimen as unknown as Handler
  );

  // updateSpecimen
  app.put('/healthcare/laboratory/specimens/:id',
    zValidator('param', validators.UpdateSpecimenParams, validationErrorHandler),
    zValidator('json', validators.UpdateSpecimenBody, validationErrorHandler),
    registry.updateSpecimen as unknown as Handler
  );

  // deleteSpecimen
  app.delete('/healthcare/laboratory/specimens/:id',
    zValidator('param', validators.DeleteSpecimenParams, validationErrorHandler),
    registry.deleteSpecimen as unknown as Handler
  );

  // verifyLabResult
  app.post('/healthcare/laboratory/verifications',
    zValidator('json', validators.VerifyLabResultBody, validationErrorHandler),
    registry.verifyLabResult as unknown as Handler
  );

  // searchLabVerifications
  app.get('/healthcare/laboratory/verifications/search',
    zValidator('query', validators.SearchLabVerificationsQuery, validationErrorHandler),
    registry.searchLabVerifications as unknown as Handler
  );

  // getLabResultVerification
  app.get('/healthcare/laboratory/verifications/:reportId',
    zValidator('param', validators.GetLabResultVerificationParams, validationErrorHandler),
    registry.getLabResultVerification as unknown as Handler
  );

  // createLocation
  app.post('/healthcare/locations',
    authMiddleware({ roles: ["admin", "org-admin"] }),
    zValidator('json', validators.CreateLocationBody, validationErrorHandler),
    registry.createLocation as unknown as Handler
  );

  // listLocations
  app.get('/healthcare/locations',
    authMiddleware({ roles: ["admin", "clinician", "support"] }),
    zValidator('query', validators.ListLocationsQuery, validationErrorHandler),
    registry.listLocations as unknown as Handler
  );

  // getLocation
  app.get('/healthcare/locations/:id',
    authMiddleware({ roles: ["admin", "clinician", "support"] }),
    zValidator('param', validators.GetLocationParams, validationErrorHandler),
    registry.getLocation as unknown as Handler
  );

  // updateLocation
  app.patch('/healthcare/locations/:id',
    authMiddleware({ roles: ["admin", "org-admin"] }),
    zValidator('param', validators.UpdateLocationParams, validationErrorHandler),
    zValidator('json', validators.UpdateLocationBody, validationErrorHandler),
    registry.updateLocation as unknown as Handler
  );

  // deactivateLocation
  app.delete('/healthcare/locations/:id',
    authMiddleware({ roles: ["admin"] }),
    zValidator('param', validators.DeactivateLocationParams, validationErrorHandler),
    registry.deactivateLocation as unknown as Handler
  );

  // createMandatoryReport
  app.post('/healthcare/mandatory-reporting',
    zValidator('json', validators.CreateMandatoryReportBody, validationErrorHandler),
    registry.createMandatoryReport as unknown as Handler
  );

  // searchMandatoryReports
  app.get('/healthcare/mandatory-reporting/search',
    zValidator('query', validators.SearchMandatoryReportsQuery, validationErrorHandler),
    registry.searchMandatoryReports as unknown as Handler
  );

  // getMandatoryReport
  app.get('/healthcare/mandatory-reporting/:id',
    zValidator('param', validators.GetMandatoryReportParams, validationErrorHandler),
    registry.getMandatoryReport as unknown as Handler
  );

  // updateMandatoryReport
  app.put('/healthcare/mandatory-reporting/:id',
    zValidator('param', validators.UpdateMandatoryReportParams, validationErrorHandler),
    zValidator('json', validators.UpdateMandatoryReportBody, validationErrorHandler),
    registry.updateMandatoryReport as unknown as Handler
  );

  // deleteMandatoryReport
  app.delete('/healthcare/mandatory-reporting/:id',
    zValidator('param', validators.DeleteMandatoryReportParams, validationErrorHandler),
    registry.deleteMandatoryReport as unknown as Handler
  );

  // createMedicationAdministration
  app.post('/healthcare/medication-administrations',
    zValidator('json', validators.CreateMedicationAdministrationBody, validationErrorHandler),
    registry.createMedicationAdministration as unknown as Handler
  );

  // searchMedicationAdministrations
  app.get('/healthcare/medication-administrations/search',
    zValidator('query', validators.SearchMedicationAdministrationsQuery, validationErrorHandler),
    zValidator('json', validators.SearchMedicationAdministrationsBody, validationErrorHandler),
    registry.searchMedicationAdministrations as unknown as Handler
  );

  // getMedicationAdministration
  app.get('/healthcare/medication-administrations/:id',
    zValidator('param', validators.GetMedicationAdministrationParams, validationErrorHandler),
    registry.getMedicationAdministration as unknown as Handler
  );

  // updateMedicationAdministration
  app.put('/healthcare/medication-administrations/:id',
    zValidator('param', validators.UpdateMedicationAdministrationParams, validationErrorHandler),
    zValidator('json', validators.UpdateMedicationAdministrationBody, validationErrorHandler),
    registry.updateMedicationAdministration as unknown as Handler
  );

  // patchMedicationAdministration
  app.patch('/healthcare/medication-administrations/:id',
    zValidator('param', validators.PatchMedicationAdministrationParams, validationErrorHandler),
    zValidator('json', validators.PatchMedicationAdministrationBody, validationErrorHandler),
    registry.patchMedicationAdministration as unknown as Handler
  );

  // deleteMedicationAdministration
  app.delete('/healthcare/medication-administrations/:id',
    zValidator('param', validators.DeleteMedicationAdministrationParams, validationErrorHandler),
    registry.deleteMedicationAdministration as unknown as Handler
  );

  // createMedication
  app.post('/healthcare/medications',
    zValidator('json', validators.CreateMedicationBody, validationErrorHandler),
    registry.createMedication as unknown as Handler
  );

  // searchMedications
  app.get('/healthcare/medications/search',
    zValidator('query', validators.SearchMedicationsQuery, validationErrorHandler),
    zValidator('json', validators.SearchMedicationsBody, validationErrorHandler),
    registry.searchMedications as unknown as Handler
  );

  // getMedication
  app.get('/healthcare/medications/:id',
    zValidator('param', validators.GetMedicationParams, validationErrorHandler),
    registry.getMedication as unknown as Handler
  );

  // updateMedication
  app.put('/healthcare/medications/:id',
    zValidator('param', validators.UpdateMedicationParams, validationErrorHandler),
    zValidator('json', validators.UpdateMedicationBody, validationErrorHandler),
    registry.updateMedication as unknown as Handler
  );

  // patchMedication
  app.patch('/healthcare/medications/:id',
    zValidator('param', validators.PatchMedicationParams, validationErrorHandler),
    zValidator('json', validators.PatchMedicationBody, validationErrorHandler),
    registry.patchMedication as unknown as Handler
  );

  // deleteMedication
  app.delete('/healthcare/medications/:id',
    zValidator('param', validators.DeleteMedicationParams, validationErrorHandler),
    registry.deleteMedication as unknown as Handler
  );

  // createOperatoryAssignment
  app.post('/healthcare/operatory/assignments',
    zValidator('json', validators.CreateOperatoryAssignmentBody, validationErrorHandler),
    registry.createOperatoryAssignment as unknown as Handler
  );

  // searchOperatoryAssignments
  app.get('/healthcare/operatory/assignments',
    zValidator('query', validators.SearchOperatoryAssignmentsQuery, validationErrorHandler),
    zValidator('json', validators.SearchOperatoryAssignmentsBody, validationErrorHandler),
    registry.searchOperatoryAssignments as unknown as Handler
  );

  // getOperatoryAssignment
  app.get('/healthcare/operatory/assignments/:id',
    zValidator('param', validators.GetOperatoryAssignmentParams, validationErrorHandler),
    registry.getOperatoryAssignment as unknown as Handler
  );

  // updateOperatoryAssignment
  app.put('/healthcare/operatory/assignments/:id',
    zValidator('param', validators.UpdateOperatoryAssignmentParams, validationErrorHandler),
    zValidator('json', validators.UpdateOperatoryAssignmentBody, validationErrorHandler),
    registry.updateOperatoryAssignment as unknown as Handler
  );

  // deleteOperatoryAssignment
  app.delete('/healthcare/operatory/assignments/:id',
    zValidator('param', validators.DeleteOperatoryAssignmentParams, validationErrorHandler),
    registry.deleteOperatoryAssignment as unknown as Handler
  );

  // createChairTimeBlock
  app.post('/healthcare/operatory/chair-blocks',
    zValidator('json', validators.CreateChairTimeBlockBody, validationErrorHandler),
    registry.createChairTimeBlock as unknown as Handler
  );

  // searchChairTimeBlocks
  app.get('/healthcare/operatory/chair-blocks',
    zValidator('query', validators.SearchChairTimeBlocksQuery, validationErrorHandler),
    zValidator('json', validators.SearchChairTimeBlocksBody, validationErrorHandler),
    registry.searchChairTimeBlocks as unknown as Handler
  );

  // getChairTimeBlock
  app.get('/healthcare/operatory/chair-blocks/:id',
    zValidator('param', validators.GetChairTimeBlockParams, validationErrorHandler),
    registry.getChairTimeBlock as unknown as Handler
  );

  // updateChairTimeBlock
  app.put('/healthcare/operatory/chair-blocks/:id',
    zValidator('param', validators.UpdateChairTimeBlockParams, validationErrorHandler),
    zValidator('json', validators.UpdateChairTimeBlockBody, validationErrorHandler),
    registry.updateChairTimeBlock as unknown as Handler
  );

  // deleteChairTimeBlock
  app.delete('/healthcare/operatory/chair-blocks/:id',
    zValidator('param', validators.DeleteChairTimeBlockParams, validationErrorHandler),
    registry.deleteChairTimeBlock as unknown as Handler
  );

  // getOperatoryMetrics
  app.get('/healthcare/operatory/metrics',
    zValidator('json', validators.GetOperatoryMetricsBody, validationErrorHandler),
    registry.getOperatoryMetrics as unknown as Handler
  );

  // createOperatory
  app.post('/healthcare/operatory/rooms',
    zValidator('json', validators.CreateOperatoryBody, validationErrorHandler),
    registry.createOperatory as unknown as Handler
  );

  // searchOperatories
  app.get('/healthcare/operatory/rooms',
    zValidator('query', validators.SearchOperatoriesQuery, validationErrorHandler),
    zValidator('json', validators.SearchOperatoriesBody, validationErrorHandler),
    registry.searchOperatories as unknown as Handler
  );

  // getOperatoryStatusBoard
  app.get('/healthcare/operatory/rooms/status-board',
    zValidator('json', validators.GetOperatoryStatusBoardBody, validationErrorHandler),
    registry.getOperatoryStatusBoard as unknown as Handler
  );

  // getOperatory
  app.get('/healthcare/operatory/rooms/:id',
    zValidator('param', validators.GetOperatoryParams, validationErrorHandler),
    registry.getOperatory as unknown as Handler
  );

  // updateOperatory
  app.put('/healthcare/operatory/rooms/:id',
    zValidator('param', validators.UpdateOperatoryParams, validationErrorHandler),
    zValidator('json', validators.UpdateOperatoryBody, validationErrorHandler),
    registry.updateOperatory as unknown as Handler
  );

  // deleteOperatory
  app.delete('/healthcare/operatory/rooms/:id',
    zValidator('param', validators.DeleteOperatoryParams, validationErrorHandler),
    registry.deleteOperatory as unknown as Handler
  );

  // createTurnoverEvent
  app.post('/healthcare/operatory/turnovers',
    zValidator('json', validators.CreateTurnoverEventBody, validationErrorHandler),
    registry.createTurnoverEvent as unknown as Handler
  );

  // searchTurnoverEvents
  app.get('/healthcare/operatory/turnovers',
    zValidator('query', validators.SearchTurnoverEventsQuery, validationErrorHandler),
    zValidator('json', validators.SearchTurnoverEventsBody, validationErrorHandler),
    registry.searchTurnoverEvents as unknown as Handler
  );

  // createOrganization
  app.post('/healthcare/organizations',
    authMiddleware({ roles: ["admin", "org-admin"] }),
    zValidator('json', validators.CreateOrganizationBody, validationErrorHandler),
    registry.createOrganization as unknown as Handler
  );

  // listOrganizations
  app.get('/healthcare/organizations',
    authMiddleware({ roles: ["admin", "clinician", "support"] }),
    zValidator('query', validators.ListOrganizationsQuery, validationErrorHandler),
    registry.listOrganizations as unknown as Handler
  );

  // getOrganization
  app.get('/healthcare/organizations/:id',
    authMiddleware({ roles: ["admin", "clinician", "support"] }),
    zValidator('param', validators.GetOrganizationParams, validationErrorHandler),
    registry.getOrganization as unknown as Handler
  );

  // updateOrganization
  app.patch('/healthcare/organizations/:id',
    authMiddleware({ roles: ["admin", "org-admin"] }),
    zValidator('param', validators.UpdateOrganizationParams, validationErrorHandler),
    zValidator('json', validators.UpdateOrganizationBody, validationErrorHandler),
    registry.updateOrganization as unknown as Handler
  );

  // deactivateOrganization
  app.delete('/healthcare/organizations/:id',
    authMiddleware({ roles: ["admin"] }),
    zValidator('param', validators.DeactivateOrganizationParams, validationErrorHandler),
    registry.deactivateOrganization as unknown as Handler
  );

  // createPaymentPlan
  app.post('/healthcare/patient-financial/payment-plans',
    zValidator('json', validators.CreatePaymentPlanBody, validationErrorHandler),
    registry.createPaymentPlan as unknown as Handler
  );

  // searchPaymentPlans
  app.get('/healthcare/patient-financial/payment-plans/search',
    zValidator('query', validators.SearchPaymentPlansQuery, validationErrorHandler),
    registry.searchPaymentPlans as unknown as Handler
  );

  // getPaymentPlan
  app.get('/healthcare/patient-financial/payment-plans/:id',
    zValidator('param', validators.GetPaymentPlanParams, validationErrorHandler),
    registry.getPaymentPlan as unknown as Handler
  );

  // updatePaymentPlan
  app.put('/healthcare/patient-financial/payment-plans/:id',
    zValidator('param', validators.UpdatePaymentPlanParams, validationErrorHandler),
    zValidator('json', validators.UpdatePaymentPlanBody, validationErrorHandler),
    registry.updatePaymentPlan as unknown as Handler
  );

  // patchPaymentPlan
  app.patch('/healthcare/patient-financial/payment-plans/:id',
    zValidator('param', validators.PatchPaymentPlanParams, validationErrorHandler),
    zValidator('json', validators.PatchPaymentPlanBody, validationErrorHandler),
    registry.patchPaymentPlan as unknown as Handler
  );

  // deletePaymentPlan
  app.delete('/healthcare/patient-financial/payment-plans/:id',
    zValidator('param', validators.DeletePaymentPlanParams, validationErrorHandler),
    registry.deletePaymentPlan as unknown as Handler
  );

  // createPayment
  app.post('/healthcare/patient-financial/payments',
    zValidator('json', validators.CreatePaymentBody, validationErrorHandler),
    registry.createPayment as unknown as Handler
  );

  // searchPayments
  app.get('/healthcare/patient-financial/payments/search',
    zValidator('query', validators.SearchPaymentsQuery, validationErrorHandler),
    registry.searchPayments as unknown as Handler
  );

  // getPayment
  app.get('/healthcare/patient-financial/payments/:id',
    zValidator('param', validators.GetPaymentParams, validationErrorHandler),
    registry.getPayment as unknown as Handler
  );

  // updatePayment
  app.put('/healthcare/patient-financial/payments/:id',
    zValidator('param', validators.UpdatePaymentParams, validationErrorHandler),
    zValidator('json', validators.UpdatePaymentBody, validationErrorHandler),
    registry.updatePayment as unknown as Handler
  );

  // patchPayment
  app.patch('/healthcare/patient-financial/payments/:id',
    zValidator('param', validators.PatchPaymentParams, validationErrorHandler),
    zValidator('json', validators.PatchPaymentBody, validationErrorHandler),
    registry.patchPayment as unknown as Handler
  );

  // deletePayment
  app.delete('/healthcare/patient-financial/payments/:id',
    zValidator('param', validators.DeletePaymentParams, validationErrorHandler),
    registry.deletePayment as unknown as Handler
  );

  // createPromissoryNote
  app.post('/healthcare/patient-financial/promissory-notes',
    zValidator('json', validators.CreatePromissoryNoteBody, validationErrorHandler),
    registry.createPromissoryNote as unknown as Handler
  );

  // searchPromissoryNotes
  app.get('/healthcare/patient-financial/promissory-notes/search',
    zValidator('query', validators.SearchPromissoryNotesQuery, validationErrorHandler),
    registry.searchPromissoryNotes as unknown as Handler
  );

  // getPromissoryNote
  app.get('/healthcare/patient-financial/promissory-notes/:id',
    zValidator('param', validators.GetPromissoryNoteParams, validationErrorHandler),
    registry.getPromissoryNote as unknown as Handler
  );

  // patchPromissoryNote
  app.patch('/healthcare/patient-financial/promissory-notes/:id',
    zValidator('param', validators.PatchPromissoryNoteParams, validationErrorHandler),
    zValidator('json', validators.PatchPromissoryNoteBody, validationErrorHandler),
    registry.patchPromissoryNote as unknown as Handler
  );

  // deletePromissoryNote
  app.delete('/healthcare/patient-financial/promissory-notes/:id',
    zValidator('param', validators.DeletePromissoryNoteParams, validationErrorHandler),
    registry.deletePromissoryNote as unknown as Handler
  );

  // createReceipt
  app.post('/healthcare/patient-financial/receipts',
    zValidator('json', validators.CreateReceiptBody, validationErrorHandler),
    registry.createReceipt as unknown as Handler
  );

  // searchReceipts
  app.get('/healthcare/patient-financial/receipts/search',
    zValidator('query', validators.SearchReceiptsQuery, validationErrorHandler),
    registry.searchReceipts as unknown as Handler
  );

  // getReceipt
  app.get('/healthcare/patient-financial/receipts/:id',
    zValidator('param', validators.GetReceiptParams, validationErrorHandler),
    registry.getReceipt as unknown as Handler
  );

  // patchReceipt
  app.patch('/healthcare/patient-financial/receipts/:id',
    zValidator('param', validators.PatchReceiptParams, validationErrorHandler),
    zValidator('json', validators.PatchReceiptBody, validationErrorHandler),
    registry.patchReceipt as unknown as Handler
  );

  // createPortalAccount
  app.post('/healthcare/patient-portal/accounts',
    zValidator('json', validators.CreatePortalAccountBody, validationErrorHandler),
    registry.createPortalAccount as unknown as Handler
  );

  // searchPortalAccounts
  app.get('/healthcare/patient-portal/accounts/search',
    zValidator('query', validators.SearchPortalAccountsQuery, validationErrorHandler),
    registry.searchPortalAccounts as unknown as Handler
  );

  // getPortalAccount
  app.get('/healthcare/patient-portal/accounts/:id',
    zValidator('param', validators.GetPortalAccountParams, validationErrorHandler),
    registry.getPortalAccount as unknown as Handler
  );

  // updatePortalAccount
  app.put('/healthcare/patient-portal/accounts/:id',
    zValidator('param', validators.UpdatePortalAccountParams, validationErrorHandler),
    zValidator('json', validators.UpdatePortalAccountBody, validationErrorHandler),
    registry.updatePortalAccount as unknown as Handler
  );

  // patchPortalAccount
  app.patch('/healthcare/patient-portal/accounts/:id',
    zValidator('param', validators.PatchPortalAccountParams, validationErrorHandler),
    zValidator('json', validators.PatchPortalAccountBody, validationErrorHandler),
    registry.patchPortalAccount as unknown as Handler
  );

  // deletePortalAccount
  app.delete('/healthcare/patient-portal/accounts/:id',
    zValidator('param', validators.DeletePortalAccountParams, validationErrorHandler),
    registry.deletePortalAccount as unknown as Handler
  );

  // createOnlineBookingRequest
  app.post('/healthcare/patient-portal/bookings',
    zValidator('json', validators.CreateOnlineBookingRequestBody, validationErrorHandler),
    registry.createOnlineBookingRequest as unknown as Handler
  );

  // getOnlineBookingRequest
  app.get('/healthcare/patient-portal/bookings/:id',
    zValidator('param', validators.GetOnlineBookingRequestParams, validationErrorHandler),
    registry.getOnlineBookingRequest as unknown as Handler
  );

  // updateOnlineBookingRequest
  app.put('/healthcare/patient-portal/bookings/:id',
    zValidator('param', validators.UpdateOnlineBookingRequestParams, validationErrorHandler),
    zValidator('json', validators.UpdateOnlineBookingRequestBody, validationErrorHandler),
    registry.updateOnlineBookingRequest as unknown as Handler
  );

  // deleteOnlineBookingRequest
  app.delete('/healthcare/patient-portal/bookings/:id',
    zValidator('param', validators.DeleteOnlineBookingRequestParams, validationErrorHandler),
    registry.deleteOnlineBookingRequest as unknown as Handler
  );

  // confirmOnlineBookingRequest
  app.post('/healthcare/patient-portal/bookings/:id/confirm',
    zValidator('param', validators.ConfirmOnlineBookingRequestParams, validationErrorHandler),
    zValidator('json', validators.ConfirmOnlineBookingRequestBody, validationErrorHandler),
    registry.confirmOnlineBookingRequest as unknown as Handler
  );

  // declineOnlineBookingRequest
  app.post('/healthcare/patient-portal/bookings/:id/decline',
    zValidator('param', validators.DeclineOnlineBookingRequestParams, validationErrorHandler),
    zValidator('json', validators.DeclineOnlineBookingRequestBody, validationErrorHandler),
    registry.declineOnlineBookingRequest as unknown as Handler
  );

  // createPatientIntakeForm
  app.post('/healthcare/patient-portal/intake-forms',
    zValidator('json', validators.CreatePatientIntakeFormBody, validationErrorHandler),
    registry.createPatientIntakeForm as unknown as Handler
  );

  // searchPatientIntakeForms
  app.get('/healthcare/patient-portal/intake-forms/search',
    zValidator('query', validators.SearchPatientIntakeFormsQuery, validationErrorHandler),
    registry.searchPatientIntakeForms as unknown as Handler
  );

  // getPatientIntakeForm
  app.get('/healthcare/patient-portal/intake-forms/:id',
    zValidator('param', validators.GetPatientIntakeFormParams, validationErrorHandler),
    registry.getPatientIntakeForm as unknown as Handler
  );

  // updatePatientIntakeForm
  app.put('/healthcare/patient-portal/intake-forms/:id',
    zValidator('param', validators.UpdatePatientIntakeFormParams, validationErrorHandler),
    zValidator('json', validators.UpdatePatientIntakeFormBody, validationErrorHandler),
    registry.updatePatientIntakeForm as unknown as Handler
  );

  // deletePatientIntakeForm
  app.delete('/healthcare/patient-portal/intake-forms/:id',
    zValidator('param', validators.DeletePatientIntakeFormParams, validationErrorHandler),
    registry.deletePatientIntakeForm as unknown as Handler
  );

  // sendPatientIntakeForm
  app.post('/healthcare/patient-portal/intake-forms/:id/send',
    zValidator('param', validators.SendPatientIntakeFormParams, validationErrorHandler),
    zValidator('json', validators.SendPatientIntakeFormBody, validationErrorHandler),
    registry.sendPatientIntakeForm as unknown as Handler
  );

  // createPortalMessage
  app.post('/healthcare/patient-portal/messages',
    zValidator('json', validators.CreatePortalMessageBody, validationErrorHandler),
    registry.createPortalMessage as unknown as Handler
  );

  // searchPortalMessages
  app.get('/healthcare/patient-portal/messages/search',
    zValidator('query', validators.SearchPortalMessagesQuery, validationErrorHandler),
    registry.searchPortalMessages as unknown as Handler
  );

  // getPortalMessage
  app.get('/healthcare/patient-portal/messages/:id',
    zValidator('param', validators.GetPortalMessageParams, validationErrorHandler),
    registry.getPortalMessage as unknown as Handler
  );

  // deletePortalMessage
  app.delete('/healthcare/patient-portal/messages/:id',
    zValidator('param', validators.DeletePortalMessageParams, validationErrorHandler),
    registry.deletePortalMessage as unknown as Handler
  );

  // createPortalPayment
  app.post('/healthcare/patient-portal/payments',
    zValidator('json', validators.CreatePortalPaymentBody, validationErrorHandler),
    registry.createPortalPayment as unknown as Handler
  );

  // searchPortalPayments
  app.get('/healthcare/patient-portal/payments/search',
    zValidator('query', validators.SearchPortalPaymentsQuery, validationErrorHandler),
    registry.searchPortalPayments as unknown as Handler
  );

  // getPortalPayment
  app.get('/healthcare/patient-portal/payments/:id',
    zValidator('param', validators.GetPortalPaymentParams, validationErrorHandler),
    registry.getPortalPayment as unknown as Handler
  );

  // createAdherenceRecord
  app.post('/healthcare/pharmacy/adherence',
    zValidator('json', validators.CreateAdherenceRecordBody, validationErrorHandler),
    registry.createAdherenceRecord as unknown as Handler
  );

  // searchAdherenceRecords
  app.get('/healthcare/pharmacy/adherence/search',
    zValidator('query', validators.SearchAdherenceRecordsQuery, validationErrorHandler),
    registry.searchAdherenceRecords as unknown as Handler
  );

  // getAdherenceRecord
  app.get('/healthcare/pharmacy/adherence/:id',
    zValidator('param', validators.GetAdherenceRecordParams, validationErrorHandler),
    registry.getAdherenceRecord as unknown as Handler
  );

  // createMedicationDispense
  app.post('/healthcare/pharmacy/dispenses',
    zValidator('json', validators.CreateMedicationDispenseBody, validationErrorHandler),
    registry.createMedicationDispense as unknown as Handler
  );

  // searchMedicationDispenses
  app.get('/healthcare/pharmacy/dispenses',
    zValidator('query', validators.SearchMedicationDispensesQuery, validationErrorHandler),
    zValidator('json', validators.SearchMedicationDispensesBody, validationErrorHandler),
    registry.searchMedicationDispenses as unknown as Handler
  );

  // getMedicationDispense
  app.get('/healthcare/pharmacy/dispenses/:id',
    zValidator('param', validators.GetMedicationDispenseParams, validationErrorHandler),
    registry.getMedicationDispense as unknown as Handler
  );

  // updateMedicationDispense
  app.put('/healthcare/pharmacy/dispenses/:id',
    zValidator('param', validators.UpdateMedicationDispenseParams, validationErrorHandler),
    zValidator('json', validators.UpdateMedicationDispenseBody, validationErrorHandler),
    registry.updateMedicationDispense as unknown as Handler
  );

  // deleteMedicationDispense
  app.delete('/healthcare/pharmacy/dispenses/:id',
    zValidator('param', validators.DeleteMedicationDispenseParams, validationErrorHandler),
    registry.deleteMedicationDispense as unknown as Handler
  );

  // checkDrugInteractions
  app.post('/healthcare/pharmacy/interactions',
    zValidator('json', validators.CheckDrugInteractionsBody, validationErrorHandler),
    registry.checkDrugInteractions as unknown as Handler
  );

  // createMedicationReconciliation
  app.post('/healthcare/pharmacy/reconciliations',
    zValidator('json', validators.CreateMedicationReconciliationBody, validationErrorHandler),
    registry.createMedicationReconciliation as unknown as Handler
  );

  // searchMedicationReconciliations
  app.get('/healthcare/pharmacy/reconciliations/search',
    zValidator('query', validators.SearchMedicationReconciliationsQuery, validationErrorHandler),
    zValidator('json', validators.SearchMedicationReconciliationsBody, validationErrorHandler),
    registry.searchMedicationReconciliations as unknown as Handler
  );

  // getMedicationReconciliation
  app.get('/healthcare/pharmacy/reconciliations/:id',
    zValidator('param', validators.GetMedicationReconciliationParams, validationErrorHandler),
    registry.getMedicationReconciliation as unknown as Handler
  );

  // updateMedicationReconciliation
  app.put('/healthcare/pharmacy/reconciliations/:id',
    zValidator('param', validators.UpdateMedicationReconciliationParams, validationErrorHandler),
    zValidator('json', validators.UpdateMedicationReconciliationBody, validationErrorHandler),
    registry.updateMedicationReconciliation as unknown as Handler
  );

  // patchMedicationReconciliation
  app.patch('/healthcare/pharmacy/reconciliations/:id',
    zValidator('param', validators.PatchMedicationReconciliationParams, validationErrorHandler),
    zValidator('json', validators.PatchMedicationReconciliationBody, validationErrorHandler),
    registry.patchMedicationReconciliation as unknown as Handler
  );

  // deleteMedicationReconciliation
  app.delete('/healthcare/pharmacy/reconciliations/:id',
    zValidator('param', validators.DeleteMedicationReconciliationParams, validationErrorHandler),
    registry.deleteMedicationReconciliation as unknown as Handler
  );

  // createPriorAuthorization
  app.post('/healthcare/prior-authorizations',
    zValidator('json', validators.CreatePriorAuthorizationBody, validationErrorHandler),
    registry.createPriorAuthorization as unknown as Handler
  );

  // searchPriorAuthorizations
  app.get('/healthcare/prior-authorizations/search',
    zValidator('query', validators.SearchPriorAuthorizationsQuery, validationErrorHandler),
    registry.searchPriorAuthorizations as unknown as Handler
  );

  // submitPriorAuthorization
  app.post('/healthcare/prior-authorizations/submit',
    zValidator('json', validators.SubmitPriorAuthorizationBody, validationErrorHandler),
    registry.submitPriorAuthorization as unknown as Handler
  );

  // getPriorAuthorization
  app.get('/healthcare/prior-authorizations/:id',
    zValidator('param', validators.GetPriorAuthorizationParams, validationErrorHandler),
    registry.getPriorAuthorization as unknown as Handler
  );

  // updatePriorAuthorization
  app.put('/healthcare/prior-authorizations/:id',
    zValidator('param', validators.UpdatePriorAuthorizationParams, validationErrorHandler),
    zValidator('json', validators.UpdatePriorAuthorizationBody, validationErrorHandler),
    registry.updatePriorAuthorization as unknown as Handler
  );

  // patchPriorAuthorization
  app.patch('/healthcare/prior-authorizations/:id',
    zValidator('param', validators.PatchPriorAuthorizationParams, validationErrorHandler),
    zValidator('json', validators.PatchPriorAuthorizationBody, validationErrorHandler),
    registry.patchPriorAuthorization as unknown as Handler
  );

  // deletePriorAuthorization
  app.delete('/healthcare/prior-authorizations/:id',
    zValidator('param', validators.DeletePriorAuthorizationParams, validationErrorHandler),
    registry.deletePriorAuthorization as unknown as Handler
  );

  // transitionPriorAuthorizationStatus
  app.post('/healthcare/prior-authorizations/:id/status',
    zValidator('param', validators.TransitionPriorAuthorizationStatusParams, validationErrorHandler),
    zValidator('json', validators.TransitionPriorAuthorizationStatusBody, validationErrorHandler),
    registry.transitionPriorAuthorizationStatus as unknown as Handler
  );

  // createProvenance
  app.post('/healthcare/provenance',
    zValidator('json', validators.CreateProvenanceBody, validationErrorHandler),
    registry.createProvenance as unknown as Handler
  );

  // searchProvenance
  app.get('/healthcare/provenance/search',
    zValidator('query', validators.SearchProvenanceQuery, validationErrorHandler),
    registry.searchProvenance as unknown as Handler
  );

  // getProvenance
  app.get('/healthcare/provenance/:id',
    zValidator('param', validators.GetProvenanceParams, validationErrorHandler),
    registry.getProvenance as unknown as Handler
  );

  // createProxyAccessGrant
  app.post('/healthcare/proxy-access',
    zValidator('json', validators.CreateProxyAccessGrantBody, validationErrorHandler),
    registry.createProxyAccessGrant as unknown as Handler
  );

  // searchProxyAccessGrants
  app.get('/healthcare/proxy-access/search',
    zValidator('query', validators.SearchProxyAccessGrantsQuery, validationErrorHandler),
    registry.searchProxyAccessGrants as unknown as Handler
  );

  // getProxyAccessGrant
  app.get('/healthcare/proxy-access/:id',
    zValidator('param', validators.GetProxyAccessGrantParams, validationErrorHandler),
    registry.getProxyAccessGrant as unknown as Handler
  );

  // updateProxyAccessGrant
  app.put('/healthcare/proxy-access/:id',
    zValidator('param', validators.UpdateProxyAccessGrantParams, validationErrorHandler),
    zValidator('json', validators.UpdateProxyAccessGrantBody, validationErrorHandler),
    registry.updateProxyAccessGrant as unknown as Handler
  );

  // deleteProxyAccessGrant
  app.delete('/healthcare/proxy-access/:id',
    zValidator('param', validators.DeleteProxyAccessGrantParams, validationErrorHandler),
    registry.deleteProxyAccessGrant as unknown as Handler
  );

  // revokeProxyAccessGrant
  app.post('/healthcare/proxy-access/:id/revoke',
    zValidator('param', validators.RevokeProxyAccessGrantParams, validationErrorHandler),
    zValidator('json', validators.RevokeProxyAccessGrantBody, validationErrorHandler),
    registry.revokeProxyAccessGrant as unknown as Handler
  );

  // createCancerAbstract
  app.post('/healthcare/public-health/cancer-registry/abstracts',
    zValidator('json', validators.CreateCancerAbstractBody, validationErrorHandler),
    registry.createCancerAbstract as unknown as Handler
  );

  // searchCancerAbstracts
  app.get('/healthcare/public-health/cancer-registry/abstracts/search',
    zValidator('query', validators.SearchCancerAbstractsQuery, validationErrorHandler),
    registry.searchCancerAbstracts as unknown as Handler
  );

  // getCancerAbstract
  app.get('/healthcare/public-health/cancer-registry/abstracts/:id',
    zValidator('param', validators.GetCancerAbstractParams, validationErrorHandler),
    registry.getCancerAbstract as unknown as Handler
  );

  // updateCancerAbstract
  app.put('/healthcare/public-health/cancer-registry/abstracts/:id',
    zValidator('param', validators.UpdateCancerAbstractParams, validationErrorHandler),
    zValidator('json', validators.UpdateCancerAbstractBody, validationErrorHandler),
    registry.updateCancerAbstract as unknown as Handler
  );

  // deleteCancerAbstract
  app.delete('/healthcare/public-health/cancer-registry/abstracts/:id',
    zValidator('param', validators.DeleteCancerAbstractParams, validationErrorHandler),
    registry.deleteCancerAbstract as unknown as Handler
  );

  // createCancerRegistryCase
  app.post('/healthcare/public-health/cancer-registry/cases',
    zValidator('json', validators.CreateCancerRegistryCaseBody, validationErrorHandler),
    registry.createCancerRegistryCase as unknown as Handler
  );

  // searchCancerRegistryCases
  app.get('/healthcare/public-health/cancer-registry/cases/search',
    zValidator('query', validators.SearchCancerRegistryCasesQuery, validationErrorHandler),
    registry.searchCancerRegistryCases as unknown as Handler
  );

  // getCancerRegistryCase
  app.get('/healthcare/public-health/cancer-registry/cases/:id',
    zValidator('param', validators.GetCancerRegistryCaseParams, validationErrorHandler),
    registry.getCancerRegistryCase as unknown as Handler
  );

  // updateCancerRegistryCase
  app.put('/healthcare/public-health/cancer-registry/cases/:id',
    zValidator('param', validators.UpdateCancerRegistryCaseParams, validationErrorHandler),
    zValidator('json', validators.UpdateCancerRegistryCaseBody, validationErrorHandler),
    registry.updateCancerRegistryCase as unknown as Handler
  );

  // deleteCancerRegistryCase
  app.delete('/healthcare/public-health/cancer-registry/cases/:id',
    zValidator('param', validators.DeleteCancerRegistryCaseParams, validationErrorHandler),
    registry.deleteCancerRegistryCase as unknown as Handler
  );

  // submitCancerRegistryCase
  app.post('/healthcare/public-health/cancer-registry/cases/:id/submit',
    zValidator('param', validators.SubmitCancerRegistryCaseParams, validationErrorHandler),
    zValidator('json', validators.SubmitCancerRegistryCaseBody, validationErrorHandler),
    registry.submitCancerRegistryCase as unknown as Handler
  );

  // createElectronicCaseReport
  app.post('/healthcare/public-health/ecr',
    zValidator('json', validators.CreateElectronicCaseReportBody, validationErrorHandler),
    registry.createElectronicCaseReport as unknown as Handler
  );

  // searchElectronicCaseReports
  app.get('/healthcare/public-health/ecr/search',
    zValidator('query', validators.SearchElectronicCaseReportsQuery, validationErrorHandler),
    registry.searchElectronicCaseReports as unknown as Handler
  );

  // getElectronicCaseReport
  app.get('/healthcare/public-health/ecr/:id',
    zValidator('param', validators.GetElectronicCaseReportParams, validationErrorHandler),
    registry.getElectronicCaseReport as unknown as Handler
  );

  // updateElectronicCaseReport
  app.put('/healthcare/public-health/ecr/:id',
    zValidator('param', validators.UpdateElectronicCaseReportParams, validationErrorHandler),
    zValidator('json', validators.UpdateElectronicCaseReportBody, validationErrorHandler),
    registry.updateElectronicCaseReport as unknown as Handler
  );

  // deleteElectronicCaseReport
  app.delete('/healthcare/public-health/ecr/:id',
    zValidator('param', validators.DeleteElectronicCaseReportParams, validationErrorHandler),
    registry.deleteElectronicCaseReport as unknown as Handler
  );

  // submitElectronicCaseReport
  app.post('/healthcare/public-health/ecr/:id/submit',
    zValidator('param', validators.SubmitElectronicCaseReportParams, validationErrorHandler),
    zValidator('json', validators.SubmitElectronicCaseReportBody, validationErrorHandler),
    registry.submitElectronicCaseReport as unknown as Handler
  );

  // createIISQuery
  app.post('/healthcare/public-health/iis/queries',
    zValidator('json', validators.CreateIISQueryBody, validationErrorHandler),
    registry.createIISQuery as unknown as Handler
  );

  // getImmunizationForecast
  app.get('/healthcare/public-health/iis/queries/forecast',
    zValidator('query', validators.GetImmunizationForecastQuery, validationErrorHandler),
    registry.getImmunizationForecast as unknown as Handler
  );

  // searchIISQueries
  app.get('/healthcare/public-health/iis/queries/search',
    zValidator('query', validators.SearchIISQueriesQuery, validationErrorHandler),
    registry.searchIISQueries as unknown as Handler
  );

  // getIISQuery
  app.get('/healthcare/public-health/iis/queries/:id',
    zValidator('param', validators.GetIISQueryParams, validationErrorHandler),
    registry.getIISQuery as unknown as Handler
  );

  // createIISSubmission
  app.post('/healthcare/public-health/iis/submissions',
    zValidator('json', validators.CreateIISSubmissionBody, validationErrorHandler),
    registry.createIISSubmission as unknown as Handler
  );

  // searchIISSubmissions
  app.get('/healthcare/public-health/iis/submissions/search',
    zValidator('query', validators.SearchIISSubmissionsQuery, validationErrorHandler),
    registry.searchIISSubmissions as unknown as Handler
  );

  // getIISSubmission
  app.get('/healthcare/public-health/iis/submissions/:id',
    zValidator('param', validators.GetIISSubmissionParams, validationErrorHandler),
    registry.getIISSubmission as unknown as Handler
  );

  // createElectronicLabReport
  app.post('/healthcare/public-health/surveillance/elr',
    zValidator('json', validators.CreateElectronicLabReportBody, validationErrorHandler),
    registry.createElectronicLabReport as unknown as Handler
  );

  // searchElectronicLabReports
  app.get('/healthcare/public-health/surveillance/elr/search',
    zValidator('query', validators.SearchElectronicLabReportsQuery, validationErrorHandler),
    registry.searchElectronicLabReports as unknown as Handler
  );

  // getElectronicLabReport
  app.get('/healthcare/public-health/surveillance/elr/:id',
    zValidator('param', validators.GetElectronicLabReportParams, validationErrorHandler),
    registry.getElectronicLabReport as unknown as Handler
  );

  // submitElectronicLabReport
  app.post('/healthcare/public-health/surveillance/elr/:id/submit',
    zValidator('param', validators.SubmitElectronicLabReportParams, validationErrorHandler),
    zValidator('json', validators.SubmitElectronicLabReportBody, validationErrorHandler),
    registry.submitElectronicLabReport as unknown as Handler
  );

  // createSyndromicSurveillanceReport
  app.post('/healthcare/public-health/surveillance/syndromic',
    zValidator('json', validators.CreateSyndromicSurveillanceReportBody, validationErrorHandler),
    registry.createSyndromicSurveillanceReport as unknown as Handler
  );

  // searchSyndromicSurveillanceReports
  app.get('/healthcare/public-health/surveillance/syndromic/search',
    zValidator('query', validators.SearchSyndromicSurveillanceReportsQuery, validationErrorHandler),
    registry.searchSyndromicSurveillanceReports as unknown as Handler
  );

  // getSyndromicSurveillanceReport
  app.get('/healthcare/public-health/surveillance/syndromic/:id',
    zValidator('param', validators.GetSyndromicSurveillanceReportParams, validationErrorHandler),
    registry.getSyndromicSurveillanceReport as unknown as Handler
  );

  // submitSyndromicSurveillanceReport
  app.post('/healthcare/public-health/surveillance/syndromic/:id/submit',
    zValidator('param', validators.SubmitSyndromicSurveillanceReportParams, validationErrorHandler),
    zValidator('json', validators.SubmitSyndromicSurveillanceReportBody, validationErrorHandler),
    registry.submitSyndromicSurveillanceReport as unknown as Handler
  );

  // createTraumaRegistryCase
  app.post('/healthcare/public-health/surveillance/trauma',
    zValidator('json', validators.CreateTraumaRegistryCaseBody, validationErrorHandler),
    registry.createTraumaRegistryCase as unknown as Handler
  );

  // searchTraumaRegistryCases
  app.get('/healthcare/public-health/surveillance/trauma/search',
    zValidator('query', validators.SearchTraumaRegistryCasesQuery, validationErrorHandler),
    registry.searchTraumaRegistryCases as unknown as Handler
  );

  // getTraumaRegistryCase
  app.get('/healthcare/public-health/surveillance/trauma/:id',
    zValidator('param', validators.GetTraumaRegistryCaseParams, validationErrorHandler),
    registry.getTraumaRegistryCase as unknown as Handler
  );

  // updateTraumaRegistryCase
  app.put('/healthcare/public-health/surveillance/trauma/:id',
    zValidator('param', validators.UpdateTraumaRegistryCaseParams, validationErrorHandler),
    zValidator('json', validators.UpdateTraumaRegistryCaseBody, validationErrorHandler),
    registry.updateTraumaRegistryCase as unknown as Handler
  );

  // deleteTraumaRegistryCase
  app.delete('/healthcare/public-health/surveillance/trauma/:id',
    zValidator('param', validators.DeleteTraumaRegistryCaseParams, validationErrorHandler),
    registry.deleteTraumaRegistryCase as unknown as Handler
  );

  // submitTraumaRegistryCase
  app.post('/healthcare/public-health/surveillance/trauma/:id/submit',
    zValidator('param', validators.SubmitTraumaRegistryCaseParams, validationErrorHandler),
    zValidator('json', validators.SubmitTraumaRegistryCaseBody, validationErrorHandler),
    registry.submitTraumaRegistryCase as unknown as Handler
  );

  // createBirthCertificate
  app.post('/healthcare/public-health/vital-records/births',
    zValidator('json', validators.CreateBirthCertificateBody, validationErrorHandler),
    registry.createBirthCertificate as unknown as Handler
  );

  // searchBirthCertificates
  app.get('/healthcare/public-health/vital-records/births/search',
    zValidator('query', validators.SearchBirthCertificatesQuery, validationErrorHandler),
    registry.searchBirthCertificates as unknown as Handler
  );

  // getBirthCertificate
  app.get('/healthcare/public-health/vital-records/births/:id',
    zValidator('param', validators.GetBirthCertificateParams, validationErrorHandler),
    registry.getBirthCertificate as unknown as Handler
  );

  // updateBirthCertificate
  app.put('/healthcare/public-health/vital-records/births/:id',
    zValidator('param', validators.UpdateBirthCertificateParams, validationErrorHandler),
    zValidator('json', validators.UpdateBirthCertificateBody, validationErrorHandler),
    registry.updateBirthCertificate as unknown as Handler
  );

  // deleteBirthCertificate
  app.delete('/healthcare/public-health/vital-records/births/:id',
    zValidator('param', validators.DeleteBirthCertificateParams, validationErrorHandler),
    registry.deleteBirthCertificate as unknown as Handler
  );

  // submitBirthCertificate
  app.post('/healthcare/public-health/vital-records/births/:id/submit',
    zValidator('param', validators.SubmitBirthCertificateParams, validationErrorHandler),
    zValidator('json', validators.SubmitBirthCertificateBody, validationErrorHandler),
    registry.submitBirthCertificate as unknown as Handler
  );

  // createDeathCertificate
  app.post('/healthcare/public-health/vital-records/deaths',
    zValidator('json', validators.CreateDeathCertificateBody, validationErrorHandler),
    registry.createDeathCertificate as unknown as Handler
  );

  // searchDeathCertificates
  app.get('/healthcare/public-health/vital-records/deaths/search',
    zValidator('query', validators.SearchDeathCertificatesQuery, validationErrorHandler),
    registry.searchDeathCertificates as unknown as Handler
  );

  // getDeathCertificate
  app.get('/healthcare/public-health/vital-records/deaths/:id',
    zValidator('param', validators.GetDeathCertificateParams, validationErrorHandler),
    registry.getDeathCertificate as unknown as Handler
  );

  // updateDeathCertificate
  app.put('/healthcare/public-health/vital-records/deaths/:id',
    zValidator('param', validators.UpdateDeathCertificateParams, validationErrorHandler),
    zValidator('json', validators.UpdateDeathCertificateBody, validationErrorHandler),
    registry.updateDeathCertificate as unknown as Handler
  );

  // deleteDeathCertificate
  app.delete('/healthcare/public-health/vital-records/deaths/:id',
    zValidator('param', validators.DeleteDeathCertificateParams, validationErrorHandler),
    registry.deleteDeathCertificate as unknown as Handler
  );

  // submitDeathCertificate
  app.post('/healthcare/public-health/vital-records/deaths/:id/submit',
    zValidator('param', validators.SubmitDeathCertificateParams, validationErrorHandler),
    zValidator('json', validators.SubmitDeathCertificateBody, validationErrorHandler),
    registry.submitDeathCertificate as unknown as Handler
  );

  // createFetalDeathReport
  app.post('/healthcare/public-health/vital-records/fetal-deaths',
    zValidator('json', validators.CreateFetalDeathReportBody, validationErrorHandler),
    registry.createFetalDeathReport as unknown as Handler
  );

  // searchFetalDeathReports
  app.get('/healthcare/public-health/vital-records/fetal-deaths/search',
    zValidator('query', validators.SearchFetalDeathReportsQuery, validationErrorHandler),
    registry.searchFetalDeathReports as unknown as Handler
  );

  // getFetalDeathReport
  app.get('/healthcare/public-health/vital-records/fetal-deaths/:id',
    zValidator('param', validators.GetFetalDeathReportParams, validationErrorHandler),
    registry.getFetalDeathReport as unknown as Handler
  );

  // updateFetalDeathReport
  app.put('/healthcare/public-health/vital-records/fetal-deaths/:id',
    zValidator('param', validators.UpdateFetalDeathReportParams, validationErrorHandler),
    zValidator('json', validators.UpdateFetalDeathReportBody, validationErrorHandler),
    registry.updateFetalDeathReport as unknown as Handler
  );

  // deleteFetalDeathReport
  app.delete('/healthcare/public-health/vital-records/fetal-deaths/:id',
    zValidator('param', validators.DeleteFetalDeathReportParams, validationErrorHandler),
    registry.deleteFetalDeathReport as unknown as Handler
  );

  // submitFetalDeathReport
  app.post('/healthcare/public-health/vital-records/fetal-deaths/:id/submit',
    zValidator('param', validators.SubmitFetalDeathReportParams, validationErrorHandler),
    zValidator('json', validators.SubmitFetalDeathReportBody, validationErrorHandler),
    registry.submitFetalDeathReport as unknown as Handler
  );

  // createIncidentReport
  app.post('/healthcare/quality/incidents',
    zValidator('json', validators.CreateIncidentReportBody, validationErrorHandler),
    registry.createIncidentReport as unknown as Handler
  );

  // searchIncidentReports
  app.get('/healthcare/quality/incidents/search',
    zValidator('query', validators.SearchIncidentReportsQuery, validationErrorHandler),
    registry.searchIncidentReports as unknown as Handler
  );

  // getIncidentReport
  app.get('/healthcare/quality/incidents/:id',
    zValidator('param', validators.GetIncidentReportParams, validationErrorHandler),
    registry.getIncidentReport as unknown as Handler
  );

  // updateIncidentReport
  app.put('/healthcare/quality/incidents/:id',
    zValidator('param', validators.UpdateIncidentReportParams, validationErrorHandler),
    zValidator('json', validators.UpdateIncidentReportBody, validationErrorHandler),
    registry.updateIncidentReport as unknown as Handler
  );

  // deleteIncidentReport
  app.delete('/healthcare/quality/incidents/:id',
    zValidator('param', validators.DeleteIncidentReportParams, validationErrorHandler),
    registry.deleteIncidentReport as unknown as Handler
  );

  // transitionIncidentStatus
  app.post('/healthcare/quality/incidents/:id/status',
    zValidator('param', validators.TransitionIncidentStatusParams, validationErrorHandler),
    zValidator('json', validators.TransitionIncidentStatusBody, validationErrorHandler),
    registry.transitionIncidentStatus as unknown as Handler
  );

  // createQualityMeasure
  app.post('/healthcare/quality/measures',
    zValidator('json', validators.CreateQualityMeasureBody, validationErrorHandler),
    registry.createQualityMeasure as unknown as Handler
  );

  // searchQualityMeasures
  app.get('/healthcare/quality/measures/search',
    zValidator('query', validators.SearchQualityMeasuresQuery, validationErrorHandler),
    registry.searchQualityMeasures as unknown as Handler
  );

  // getQualityMeasure
  app.get('/healthcare/quality/measures/:id',
    zValidator('param', validators.GetQualityMeasureParams, validationErrorHandler),
    registry.getQualityMeasure as unknown as Handler
  );

  // updateQualityMeasure
  app.put('/healthcare/quality/measures/:id',
    zValidator('param', validators.UpdateQualityMeasureParams, validationErrorHandler),
    zValidator('json', validators.UpdateQualityMeasureBody, validationErrorHandler),
    registry.updateQualityMeasure as unknown as Handler
  );

  // deleteQualityMeasure
  app.delete('/healthcare/quality/measures/:id',
    zValidator('param', validators.DeleteQualityMeasureParams, validationErrorHandler),
    registry.deleteQualityMeasure as unknown as Handler
  );

  // createQuestionnaireResponse
  app.post('/healthcare/questionnaire-responses',
    zValidator('json', validators.CreateQuestionnaireResponseBody, validationErrorHandler),
    registry.createQuestionnaireResponse as unknown as Handler
  );

  // searchQuestionnaireResponses
  app.get('/healthcare/questionnaire-responses/search',
    zValidator('query', validators.SearchQuestionnaireResponsesQuery, validationErrorHandler),
    registry.searchQuestionnaireResponses as unknown as Handler
  );

  // getQuestionnaireResponse
  app.get('/healthcare/questionnaire-responses/:id',
    zValidator('param', validators.GetQuestionnaireResponseParams, validationErrorHandler),
    registry.getQuestionnaireResponse as unknown as Handler
  );

  // updateQuestionnaireResponse
  app.put('/healthcare/questionnaire-responses/:id',
    zValidator('param', validators.UpdateQuestionnaireResponseParams, validationErrorHandler),
    zValidator('json', validators.UpdateQuestionnaireResponseBody, validationErrorHandler),
    registry.updateQuestionnaireResponse as unknown as Handler
  );

  // patchQuestionnaireResponse
  app.patch('/healthcare/questionnaire-responses/:id',
    zValidator('param', validators.PatchQuestionnaireResponseParams, validationErrorHandler),
    zValidator('json', validators.PatchQuestionnaireResponseBody, validationErrorHandler),
    registry.patchQuestionnaireResponse as unknown as Handler
  );

  // deleteQuestionnaireResponse
  app.delete('/healthcare/questionnaire-responses/:id',
    zValidator('param', validators.DeleteQuestionnaireResponseParams, validationErrorHandler),
    registry.deleteQuestionnaireResponse as unknown as Handler
  );

  // createQuestionnaire
  app.post('/healthcare/questionnaires',
    zValidator('json', validators.CreateQuestionnaireBody, validationErrorHandler),
    registry.createQuestionnaire as unknown as Handler
  );

  // searchQuestionnaires
  app.get('/healthcare/questionnaires/search',
    zValidator('query', validators.SearchQuestionnairesQuery, validationErrorHandler),
    registry.searchQuestionnaires as unknown as Handler
  );

  // getQuestionnaire
  app.get('/healthcare/questionnaires/:id',
    zValidator('param', validators.GetQuestionnaireParams, validationErrorHandler),
    registry.getQuestionnaire as unknown as Handler
  );

  // updateQuestionnaire
  app.put('/healthcare/questionnaires/:id',
    zValidator('param', validators.UpdateQuestionnaireParams, validationErrorHandler),
    zValidator('json', validators.UpdateQuestionnaireBody, validationErrorHandler),
    registry.updateQuestionnaire as unknown as Handler
  );

  // patchQuestionnaire
  app.patch('/healthcare/questionnaires/:id',
    zValidator('param', validators.PatchQuestionnaireParams, validationErrorHandler),
    zValidator('json', validators.PatchQuestionnaireBody, validationErrorHandler),
    registry.patchQuestionnaire as unknown as Handler
  );

  // deleteQuestionnaire
  app.delete('/healthcare/questionnaires/:id',
    zValidator('param', validators.DeleteQuestionnaireParams, validationErrorHandler),
    registry.deleteQuestionnaire as unknown as Handler
  );

  // createImagingStudy
  app.post('/healthcare/radiology/imaging-studies',
    zValidator('json', validators.CreateImagingStudyBody, validationErrorHandler),
    registry.createImagingStudy as unknown as Handler
  );

  // searchImagingStudies
  app.get('/healthcare/radiology/imaging-studies',
    zValidator('query', validators.SearchImagingStudiesQuery, validationErrorHandler),
    zValidator('json', validators.SearchImagingStudiesBody, validationErrorHandler),
    registry.searchImagingStudies as unknown as Handler
  );

  // getImagingStudy
  app.get('/healthcare/radiology/imaging-studies/:id',
    zValidator('param', validators.GetImagingStudyParams, validationErrorHandler),
    registry.getImagingStudy as unknown as Handler
  );

  // updateImagingStudy
  app.put('/healthcare/radiology/imaging-studies/:id',
    zValidator('param', validators.UpdateImagingStudyParams, validationErrorHandler),
    zValidator('json', validators.UpdateImagingStudyBody, validationErrorHandler),
    registry.updateImagingStudy as unknown as Handler
  );

  // deleteImagingStudy
  app.delete('/healthcare/radiology/imaging-studies/:id',
    zValidator('param', validators.DeleteImagingStudyParams, validationErrorHandler),
    registry.deleteImagingStudy as unknown as Handler
  );

  // createRadiologyReport
  app.post('/healthcare/radiology/reports',
    zValidator('json', validators.CreateRadiologyReportBody, validationErrorHandler),
    registry.createRadiologyReport as unknown as Handler
  );

  // searchRadiologyReports
  app.get('/healthcare/radiology/reports/search',
    zValidator('query', validators.SearchRadiologyReportsQuery, validationErrorHandler),
    zValidator('json', validators.SearchRadiologyReportsBody, validationErrorHandler),
    registry.searchRadiologyReports as unknown as Handler
  );

  // getRadiologyReport
  app.get('/healthcare/radiology/reports/:id',
    zValidator('param', validators.GetRadiologyReportParams, validationErrorHandler),
    registry.getRadiologyReport as unknown as Handler
  );

  // updateRadiologyReport
  app.put('/healthcare/radiology/reports/:id',
    zValidator('param', validators.UpdateRadiologyReportParams, validationErrorHandler),
    zValidator('json', validators.UpdateRadiologyReportBody, validationErrorHandler),
    registry.updateRadiologyReport as unknown as Handler
  );

  // patchRadiologyReport
  app.patch('/healthcare/radiology/reports/:id',
    zValidator('param', validators.PatchRadiologyReportParams, validationErrorHandler),
    zValidator('json', validators.PatchRadiologyReportBody, validationErrorHandler),
    registry.patchRadiologyReport as unknown as Handler
  );

  // deleteRadiologyReport
  app.delete('/healthcare/radiology/reports/:id',
    zValidator('param', validators.DeleteRadiologyReportParams, validationErrorHandler),
    registry.deleteRadiologyReport as unknown as Handler
  );

  // createRecallCampaign
  app.post('/healthcare/recall/campaigns',
    zValidator('json', validators.CreateRecallCampaignBody, validationErrorHandler),
    registry.createRecallCampaign as unknown as Handler
  );

  // searchRecallCampaigns
  app.get('/healthcare/recall/campaigns/search',
    zValidator('query', validators.SearchRecallCampaignsQuery, validationErrorHandler),
    registry.searchRecallCampaigns as unknown as Handler
  );

  // getRecallCampaign
  app.get('/healthcare/recall/campaigns/:id',
    zValidator('param', validators.GetRecallCampaignParams, validationErrorHandler),
    registry.getRecallCampaign as unknown as Handler
  );

  // updateRecallCampaign
  app.put('/healthcare/recall/campaigns/:id',
    zValidator('param', validators.UpdateRecallCampaignParams, validationErrorHandler),
    zValidator('json', validators.UpdateRecallCampaignBody, validationErrorHandler),
    registry.updateRecallCampaign as unknown as Handler
  );

  // deleteRecallCampaign
  app.delete('/healthcare/recall/campaigns/:id',
    zValidator('param', validators.DeleteRecallCampaignParams, validationErrorHandler),
    registry.deleteRecallCampaign as unknown as Handler
  );

  // getRecallCampaignReport
  app.get('/healthcare/recall/campaigns/:id/report',
    zValidator('param', validators.GetRecallCampaignReportParams, validationErrorHandler),
    registry.getRecallCampaignReport as unknown as Handler
  );

  // runRecallCampaign
  app.post('/healthcare/recall/campaigns/:id/run',
    zValidator('param', validators.RunRecallCampaignParams, validationErrorHandler),
    zValidator('json', validators.RunRecallCampaignBody, validationErrorHandler),
    registry.runRecallCampaign as unknown as Handler
  );

  // createRecallRule
  app.post('/healthcare/recall/rules',
    zValidator('json', validators.CreateRecallRuleBody, validationErrorHandler),
    registry.createRecallRule as unknown as Handler
  );

  // getRecallRule
  app.get('/healthcare/recall/rules/:id',
    zValidator('param', validators.GetRecallRuleParams, validationErrorHandler),
    registry.getRecallRule as unknown as Handler
  );

  // updateRecallRule
  app.put('/healthcare/recall/rules/:id',
    zValidator('param', validators.UpdateRecallRuleParams, validationErrorHandler),
    zValidator('json', validators.UpdateRecallRuleBody, validationErrorHandler),
    registry.updateRecallRule as unknown as Handler
  );

  // patchRecallRule
  app.patch('/healthcare/recall/rules/:id',
    zValidator('param', validators.PatchRecallRuleParams, validationErrorHandler),
    zValidator('json', validators.PatchRecallRuleBody, validationErrorHandler),
    registry.patchRecallRule as unknown as Handler
  );

  // deleteRecallRule
  app.delete('/healthcare/recall/rules/:id',
    zValidator('param', validators.DeleteRecallRuleParams, validationErrorHandler),
    registry.deleteRecallRule as unknown as Handler
  );

  // createRecallSchedule
  app.post('/healthcare/recall/schedules',
    zValidator('json', validators.CreateRecallScheduleBody, validationErrorHandler),
    registry.createRecallSchedule as unknown as Handler
  );

  // searchRecallSchedules
  app.get('/healthcare/recall/schedules/search',
    zValidator('query', validators.SearchRecallSchedulesQuery, validationErrorHandler),
    registry.searchRecallSchedules as unknown as Handler
  );

  // getRecallSchedule
  app.get('/healthcare/recall/schedules/:id',
    zValidator('param', validators.GetRecallScheduleParams, validationErrorHandler),
    registry.getRecallSchedule as unknown as Handler
  );

  // updateRecallSchedule
  app.put('/healthcare/recall/schedules/:id',
    zValidator('param', validators.UpdateRecallScheduleParams, validationErrorHandler),
    zValidator('json', validators.UpdateRecallScheduleBody, validationErrorHandler),
    registry.updateRecallSchedule as unknown as Handler
  );

  // deleteRecallSchedule
  app.delete('/healthcare/recall/schedules/:id',
    zValidator('param', validators.DeleteRecallScheduleParams, validationErrorHandler),
    registry.deleteRecallSchedule as unknown as Handler
  );

  // recordRecallContact
  app.post('/healthcare/recall/schedules/:id/contact',
    zValidator('param', validators.RecordRecallContactParams, validationErrorHandler),
    zValidator('json', validators.RecordRecallContactBody, validationErrorHandler),
    registry.recordRecallContact as unknown as Handler
  );

  // dismissRecall
  app.post('/healthcare/recall/schedules/:id/dismiss',
    zValidator('param', validators.DismissRecallParams, validationErrorHandler),
    zValidator('json', validators.DismissRecallBody, validationErrorHandler),
    registry.dismissRecall as unknown as Handler
  );

  // createAppointment
  app.post('/healthcare/scheduling/appointments',
    zValidator('json', validators.CreateAppointmentBody, validationErrorHandler),
    registry.createAppointment as unknown as Handler
  );

  // searchAppointments
  app.get('/healthcare/scheduling/appointments/search',
    zValidator('query', validators.SearchAppointmentsQuery, validationErrorHandler),
    registry.searchAppointments as unknown as Handler
  );

  // getAppointment
  app.get('/healthcare/scheduling/appointments/:id',
    zValidator('param', validators.GetAppointmentParams, validationErrorHandler),
    registry.getAppointment as unknown as Handler
  );

  // updateAppointment
  app.put('/healthcare/scheduling/appointments/:id',
    zValidator('param', validators.UpdateAppointmentParams, validationErrorHandler),
    zValidator('json', validators.UpdateAppointmentBody, validationErrorHandler),
    registry.updateAppointment as unknown as Handler
  );

  // patchAppointment
  app.patch('/healthcare/scheduling/appointments/:id',
    zValidator('param', validators.PatchAppointmentParams, validationErrorHandler),
    zValidator('json', validators.PatchAppointmentBody, validationErrorHandler),
    registry.patchAppointment as unknown as Handler
  );

  // deleteAppointment
  app.delete('/healthcare/scheduling/appointments/:id',
    zValidator('param', validators.DeleteAppointmentParams, validationErrorHandler),
    registry.deleteAppointment as unknown as Handler
  );

  // transitionAppointmentStatus
  app.post('/healthcare/scheduling/appointments/:id/status',
    zValidator('param', validators.TransitionAppointmentStatusParams, validationErrorHandler),
    zValidator('json', validators.TransitionAppointmentStatusBody, validationErrorHandler),
    registry.transitionAppointmentStatus as unknown as Handler
  );

  // createSchedule
  app.post('/healthcare/scheduling/schedules',
    zValidator('json', validators.CreateScheduleBody, validationErrorHandler),
    registry.createSchedule as unknown as Handler
  );

  // searchSchedules
  app.get('/healthcare/scheduling/schedules/search',
    zValidator('query', validators.SearchSchedulesQuery, validationErrorHandler),
    registry.searchSchedules as unknown as Handler
  );

  // getSchedule
  app.get('/healthcare/scheduling/schedules/:id',
    zValidator('param', validators.GetScheduleParams, validationErrorHandler),
    registry.getSchedule as unknown as Handler
  );

  // updateSchedule
  app.put('/healthcare/scheduling/schedules/:id',
    zValidator('param', validators.UpdateScheduleParams, validationErrorHandler),
    zValidator('json', validators.UpdateScheduleBody, validationErrorHandler),
    registry.updateSchedule as unknown as Handler
  );

  // patchSchedule
  app.patch('/healthcare/scheduling/schedules/:id',
    zValidator('param', validators.PatchScheduleParams, validationErrorHandler),
    zValidator('json', validators.PatchScheduleBody, validationErrorHandler),
    registry.patchSchedule as unknown as Handler
  );

  // deleteSchedule
  app.delete('/healthcare/scheduling/schedules/:id',
    zValidator('param', validators.DeleteScheduleParams, validationErrorHandler),
    registry.deleteSchedule as unknown as Handler
  );

  // createSlot
  app.post('/healthcare/scheduling/slots',
    zValidator('json', validators.CreateSlotBody, validationErrorHandler),
    registry.createSlot as unknown as Handler
  );

  // searchSlots
  app.get('/healthcare/scheduling/slots/search',
    zValidator('query', validators.SearchSlotsQuery, validationErrorHandler),
    registry.searchSlots as unknown as Handler
  );

  // getSlot
  app.get('/healthcare/scheduling/slots/:id',
    zValidator('param', validators.GetSlotParams, validationErrorHandler),
    registry.getSlot as unknown as Handler
  );

  // updateSlot
  app.put('/healthcare/scheduling/slots/:id',
    zValidator('param', validators.UpdateSlotParams, validationErrorHandler),
    zValidator('json', validators.UpdateSlotBody, validationErrorHandler),
    registry.updateSlot as unknown as Handler
  );

  // patchSlot
  app.patch('/healthcare/scheduling/slots/:id',
    zValidator('param', validators.PatchSlotParams, validationErrorHandler),
    zValidator('json', validators.PatchSlotBody, validationErrorHandler),
    registry.patchSlot as unknown as Handler
  );

  // deleteSlot
  app.delete('/healthcare/scheduling/slots/:id',
    zValidator('param', validators.DeleteSlotParams, validationErrorHandler),
    registry.deleteSlot as unknown as Handler
  );

  // createSDOHReferral
  app.post('/healthcare/sdoh/referrals',
    zValidator('json', validators.CreateSDOHReferralBody, validationErrorHandler),
    registry.createSDOHReferral as unknown as Handler
  );

  // searchSDOHReferrals
  app.get('/healthcare/sdoh/referrals/search',
    zValidator('query', validators.SearchSDOHReferralsQuery, validationErrorHandler),
    registry.searchSDOHReferrals as unknown as Handler
  );

  // getSDOHReferral
  app.get('/healthcare/sdoh/referrals/:id',
    zValidator('param', validators.GetSDOHReferralParams, validationErrorHandler),
    registry.getSDOHReferral as unknown as Handler
  );

  // updateSDOHReferral
  app.put('/healthcare/sdoh/referrals/:id',
    zValidator('param', validators.UpdateSDOHReferralParams, validationErrorHandler),
    zValidator('json', validators.UpdateSDOHReferralBody, validationErrorHandler),
    registry.updateSDOHReferral as unknown as Handler
  );

  // patchSDOHReferral
  app.patch('/healthcare/sdoh/referrals/:id',
    zValidator('param', validators.PatchSDOHReferralParams, validationErrorHandler),
    zValidator('json', validators.PatchSDOHReferralBody, validationErrorHandler),
    registry.patchSDOHReferral as unknown as Handler
  );

  // deleteSDOHReferral
  app.delete('/healthcare/sdoh/referrals/:id',
    zValidator('param', validators.DeleteSDOHReferralParams, validationErrorHandler),
    registry.deleteSDOHReferral as unknown as Handler
  );

  // createSDOHScreening
  app.post('/healthcare/sdoh/screenings',
    zValidator('json', validators.CreateSDOHScreeningBody, validationErrorHandler),
    registry.createSDOHScreening as unknown as Handler
  );

  // searchSDOHScreenings
  app.get('/healthcare/sdoh/screenings/search',
    zValidator('query', validators.SearchSDOHScreeningsQuery, validationErrorHandler),
    registry.searchSDOHScreenings as unknown as Handler
  );

  // getSDOHScreening
  app.get('/healthcare/sdoh/screenings/:id',
    zValidator('param', validators.GetSDOHScreeningParams, validationErrorHandler),
    registry.getSDOHScreening as unknown as Handler
  );

  // updateSDOHScreening
  app.put('/healthcare/sdoh/screenings/:id',
    zValidator('param', validators.UpdateSDOHScreeningParams, validationErrorHandler),
    zValidator('json', validators.UpdateSDOHScreeningBody, validationErrorHandler),
    registry.updateSDOHScreening as unknown as Handler
  );

  // patchSDOHScreening
  app.patch('/healthcare/sdoh/screenings/:id',
    zValidator('param', validators.PatchSDOHScreeningParams, validationErrorHandler),
    zValidator('json', validators.PatchSDOHScreeningBody, validationErrorHandler),
    registry.patchSDOHScreening as unknown as Handler
  );

  // deleteSDOHScreening
  app.delete('/healthcare/sdoh/screenings/:id',
    zValidator('param', validators.DeleteSDOHScreeningParams, validationErrorHandler),
    registry.deleteSDOHScreening as unknown as Handler
  );

  // createSignature
  app.post('/healthcare/signatures',
    zValidator('json', validators.CreateSignatureBody, validationErrorHandler),
    registry.createSignature as unknown as Handler
  );

  // searchSignatures
  app.get('/healthcare/signatures/search',
    zValidator('query', validators.SearchSignaturesQuery, validationErrorHandler),
    registry.searchSignatures as unknown as Handler
  );

  // getSignature
  app.get('/healthcare/signatures/:id',
    zValidator('param', validators.GetSignatureParams, validationErrorHandler),
    registry.getSignature as unknown as Handler
  );

  // revokeSignature
  app.post('/healthcare/signatures/:id/revoke',
    zValidator('param', validators.RevokeSignatureParams, validationErrorHandler),
    registry.revokeSignature as unknown as Handler
  );

  // verifySignature
  app.post('/healthcare/signatures/:id/verify',
    zValidator('param', validators.VerifySignatureParams, validationErrorHandler),
    registry.verifySignature as unknown as Handler
  );

  // createSubscription
  app.post('/healthcare/subscriptions/Subscription',
    zValidator('json', validators.CreateSubscriptionBody, validationErrorHandler),
    registry.createSubscription as unknown as Handler
  );

  // getSubscription
  app.get('/healthcare/subscriptions/Subscription/:id',
    zValidator('param', validators.GetSubscriptionParams, validationErrorHandler),
    registry.getSubscription as unknown as Handler
  );

  // updateSubscription
  app.put('/healthcare/subscriptions/Subscription/:id',
    zValidator('param', validators.UpdateSubscriptionParams, validationErrorHandler),
    zValidator('json', validators.UpdateSubscriptionBody, validationErrorHandler),
    registry.updateSubscription as unknown as Handler
  );

  // deleteSubscription
  app.delete('/healthcare/subscriptions/Subscription/:id',
    zValidator('param', validators.DeleteSubscriptionParams, validationErrorHandler),
    registry.deleteSubscription as unknown as Handler
  );

  // getSubscriptionStatus
  app.get('/healthcare/subscriptions/Subscription/:id/status',
    zValidator('param', validators.GetSubscriptionStatusParams, validationErrorHandler),
    registry.getSubscriptionStatus as unknown as Handler
  );

  // listSubscriptionTopics
  app.get('/healthcare/subscriptions/SubscriptionTopic',
    zValidator('query', validators.ListSubscriptionTopicsQuery, validationErrorHandler),
    registry.listSubscriptionTopics as unknown as Handler
  );

  // createTask
  app.post('/healthcare/tasks',
    zValidator('json', validators.CreateTaskBody, validationErrorHandler),
    registry.createTask as unknown as Handler
  );

  // searchTasks
  app.get('/healthcare/tasks/search',
    zValidator('query', validators.SearchTasksQuery, validationErrorHandler),
    registry.searchTasks as unknown as Handler
  );

  // getTask
  app.get('/healthcare/tasks/:id',
    zValidator('param', validators.GetTaskParams, validationErrorHandler),
    registry.getTask as unknown as Handler
  );

  // updateTask
  app.put('/healthcare/tasks/:id',
    zValidator('param', validators.UpdateTaskParams, validationErrorHandler),
    zValidator('json', validators.UpdateTaskBody, validationErrorHandler),
    registry.updateTask as unknown as Handler
  );

  // patchTask
  app.patch('/healthcare/tasks/:id',
    zValidator('param', validators.PatchTaskParams, validationErrorHandler),
    zValidator('json', validators.PatchTaskBody, validationErrorHandler),
    registry.patchTask as unknown as Handler
  );

  // deleteTask
  app.delete('/healthcare/tasks/:id',
    zValidator('param', validators.DeleteTaskParams, validationErrorHandler),
    registry.deleteTask as unknown as Handler
  );

  // transitionTaskStatus
  app.post('/healthcare/tasks/:id/status',
    zValidator('param', validators.TransitionTaskStatusParams, validationErrorHandler),
    zValidator('json', validators.TransitionTaskStatusBody, validationErrorHandler),
    registry.transitionTaskStatus as unknown as Handler
  );

  // createAsyncConsultation
  app.post('/healthcare/telehealth/async-consultations',
    zValidator('json', validators.CreateAsyncConsultationBody, validationErrorHandler),
    registry.createAsyncConsultation as unknown as Handler
  );

  // searchAsyncConsultations
  app.get('/healthcare/telehealth/async-consultations/search',
    zValidator('query', validators.SearchAsyncConsultationsQuery, validationErrorHandler),
    registry.searchAsyncConsultations as unknown as Handler
  );

  // getAsyncConsultation
  app.get('/healthcare/telehealth/async-consultations/:id',
    zValidator('param', validators.GetAsyncConsultationParams, validationErrorHandler),
    registry.getAsyncConsultation as unknown as Handler
  );

  // updateAsyncConsultation
  app.put('/healthcare/telehealth/async-consultations/:id',
    zValidator('param', validators.UpdateAsyncConsultationParams, validationErrorHandler),
    zValidator('json', validators.UpdateAsyncConsultationBody, validationErrorHandler),
    registry.updateAsyncConsultation as unknown as Handler
  );

  // deleteAsyncConsultation
  app.delete('/healthcare/telehealth/async-consultations/:id',
    zValidator('param', validators.DeleteAsyncConsultationParams, validationErrorHandler),
    registry.deleteAsyncConsultation as unknown as Handler
  );

  // escalateAsyncConsultation
  app.post('/healthcare/telehealth/async-consultations/:id/escalate',
    zValidator('param', validators.EscalateAsyncConsultationParams, validationErrorHandler),
    zValidator('json', validators.EscalateAsyncConsultationBody, validationErrorHandler),
    registry.escalateAsyncConsultation as unknown as Handler
  );

  // respondToAsyncConsultation
  app.post('/healthcare/telehealth/async-consultations/:id/respond',
    zValidator('param', validators.RespondToAsyncConsultationParams, validationErrorHandler),
    zValidator('json', validators.RespondToAsyncConsultationBody, validationErrorHandler),
    registry.respondToAsyncConsultation as unknown as Handler
  );

  // createRemoteMonitoringEnrollment
  app.post('/healthcare/telehealth/remote-monitoring',
    zValidator('json', validators.CreateRemoteMonitoringEnrollmentBody, validationErrorHandler),
    registry.createRemoteMonitoringEnrollment as unknown as Handler
  );

  // searchRemoteMonitoringEnrollments
  app.get('/healthcare/telehealth/remote-monitoring/search',
    zValidator('query', validators.SearchRemoteMonitoringEnrollmentsQuery, validationErrorHandler),
    registry.searchRemoteMonitoringEnrollments as unknown as Handler
  );

  // getRemoteMonitoringEnrollment
  app.get('/healthcare/telehealth/remote-monitoring/:id',
    zValidator('param', validators.GetRemoteMonitoringEnrollmentParams, validationErrorHandler),
    registry.getRemoteMonitoringEnrollment as unknown as Handler
  );

  // updateRemoteMonitoringEnrollment
  app.put('/healthcare/telehealth/remote-monitoring/:id',
    zValidator('param', validators.UpdateRemoteMonitoringEnrollmentParams, validationErrorHandler),
    zValidator('json', validators.UpdateRemoteMonitoringEnrollmentBody, validationErrorHandler),
    registry.updateRemoteMonitoringEnrollment as unknown as Handler
  );

  // patchRemoteMonitoringEnrollment
  app.patch('/healthcare/telehealth/remote-monitoring/:id',
    zValidator('param', validators.PatchRemoteMonitoringEnrollmentParams, validationErrorHandler),
    zValidator('json', validators.PatchRemoteMonitoringEnrollmentBody, validationErrorHandler),
    registry.patchRemoteMonitoringEnrollment as unknown as Handler
  );

  // deleteRemoteMonitoringEnrollment
  app.delete('/healthcare/telehealth/remote-monitoring/:id',
    zValidator('param', validators.DeleteRemoteMonitoringEnrollmentParams, validationErrorHandler),
    registry.deleteRemoteMonitoringEnrollment as unknown as Handler
  );

  // createTelehealthSession
  app.post('/healthcare/telehealth/sessions',
    zValidator('json', validators.CreateTelehealthSessionBody, validationErrorHandler),
    registry.createTelehealthSession as unknown as Handler
  );

  // searchTelehealthSessions
  app.get('/healthcare/telehealth/sessions/search',
    zValidator('query', validators.SearchTelehealthSessionsQuery, validationErrorHandler),
    registry.searchTelehealthSessions as unknown as Handler
  );

  // getTelehealthSession
  app.get('/healthcare/telehealth/sessions/:id',
    zValidator('param', validators.GetTelehealthSessionParams, validationErrorHandler),
    registry.getTelehealthSession as unknown as Handler
  );

  // updateTelehealthSession
  app.put('/healthcare/telehealth/sessions/:id',
    zValidator('param', validators.UpdateTelehealthSessionParams, validationErrorHandler),
    zValidator('json', validators.UpdateTelehealthSessionBody, validationErrorHandler),
    registry.updateTelehealthSession as unknown as Handler
  );

  // patchTelehealthSession
  app.patch('/healthcare/telehealth/sessions/:id',
    zValidator('param', validators.PatchTelehealthSessionParams, validationErrorHandler),
    zValidator('json', validators.PatchTelehealthSessionBody, validationErrorHandler),
    registry.patchTelehealthSession as unknown as Handler
  );

  // deleteTelehealthSession
  app.delete('/healthcare/telehealth/sessions/:id',
    zValidator('param', validators.DeleteTelehealthSessionParams, validationErrorHandler),
    registry.deleteTelehealthSession as unknown as Handler
  );

  // endTelehealthSession
  app.post('/healthcare/telehealth/sessions/:id/end',
    zValidator('param', validators.EndTelehealthSessionParams, validationErrorHandler),
    zValidator('json', validators.EndTelehealthSessionBody, validationErrorHandler),
    registry.endTelehealthSession as unknown as Handler
  );

  // startTelehealthSession
  app.post('/healthcare/telehealth/sessions/:id/start',
    zValidator('param', validators.StartTelehealthSessionParams, validationErrorHandler),
    zValidator('json', validators.StartTelehealthSessionBody, validationErrorHandler),
    registry.startTelehealthSession as unknown as Handler
  );

  // createCodeSystem
  app.post('/healthcare/terminology/CodeSystem',
    zValidator('json', validators.CreateCodeSystemBody, validationErrorHandler),
    registry.createCodeSystem as unknown as Handler
  );

  // lookupCode
  app.post('/healthcare/terminology/CodeSystem/$lookup',
    zValidator('json', validators.LookupCodeBody, validationErrorHandler),
    registry.lookupCode as unknown as Handler
  );

  // getCodeSystem
  app.get('/healthcare/terminology/CodeSystem/:id',
    zValidator('param', validators.GetCodeSystemParams, validationErrorHandler),
    registry.getCodeSystem as unknown as Handler
  );

  // updateCodeSystem
  app.put('/healthcare/terminology/CodeSystem/:id',
    zValidator('param', validators.UpdateCodeSystemParams, validationErrorHandler),
    zValidator('json', validators.UpdateCodeSystemBody, validationErrorHandler),
    registry.updateCodeSystem as unknown as Handler
  );

  // deleteCodeSystem
  app.delete('/healthcare/terminology/CodeSystem/:id',
    zValidator('param', validators.DeleteCodeSystemParams, validationErrorHandler),
    registry.deleteCodeSystem as unknown as Handler
  );

  // createConceptMap
  app.post('/healthcare/terminology/ConceptMap',
    zValidator('json', validators.CreateConceptMapBody, validationErrorHandler),
    registry.createConceptMap as unknown as Handler
  );

  // translateCode
  app.post('/healthcare/terminology/ConceptMap/$translate',
    zValidator('json', validators.TranslateCodeBody, validationErrorHandler),
    registry.translateCode as unknown as Handler
  );

  // getConceptMap
  app.get('/healthcare/terminology/ConceptMap/:id',
    zValidator('param', validators.GetConceptMapParams, validationErrorHandler),
    registry.getConceptMap as unknown as Handler
  );

  // updateConceptMap
  app.put('/healthcare/terminology/ConceptMap/:id',
    zValidator('param', validators.UpdateConceptMapParams, validationErrorHandler),
    zValidator('json', validators.UpdateConceptMapBody, validationErrorHandler),
    registry.updateConceptMap as unknown as Handler
  );

  // deleteConceptMap
  app.delete('/healthcare/terminology/ConceptMap/:id',
    zValidator('param', validators.DeleteConceptMapParams, validationErrorHandler),
    registry.deleteConceptMap as unknown as Handler
  );

  // createValueSet
  app.post('/healthcare/terminology/ValueSet',
    zValidator('json', validators.CreateValueSetBody, validationErrorHandler),
    registry.createValueSet as unknown as Handler
  );

  // expandValueSet
  app.post('/healthcare/terminology/ValueSet/$expand',
    zValidator('json', validators.ExpandValueSetBody, validationErrorHandler),
    registry.expandValueSet as unknown as Handler
  );

  // validateCode
  app.post('/healthcare/terminology/ValueSet/$validate-code',
    zValidator('json', validators.ValidateCodeBody, validationErrorHandler),
    registry.validateCode as unknown as Handler
  );

  // getValueSet
  app.get('/healthcare/terminology/ValueSet/:id',
    zValidator('param', validators.GetValueSetParams, validationErrorHandler),
    registry.getValueSet as unknown as Handler
  );

  // updateValueSet
  app.put('/healthcare/terminology/ValueSet/:id',
    zValidator('param', validators.UpdateValueSetParams, validationErrorHandler),
    zValidator('json', validators.UpdateValueSetBody, validationErrorHandler),
    registry.updateValueSet as unknown as Handler
  );

  // deleteValueSet
  app.delete('/healthcare/terminology/ValueSet/:id',
    zValidator('param', validators.DeleteValueSetParams, validationErrorHandler),
    registry.deleteValueSet as unknown as Handler
  );

  // getExecutionsByRule
  app.get('/healthcare/workflow-automation/executions/by-rule/:ruleId',
    zValidator('param', validators.GetExecutionsByRuleParams, validationErrorHandler),
    zValidator('query', validators.GetExecutionsByRuleQuery, validationErrorHandler),
    registry.getExecutionsByRule as unknown as Handler
  );

  // searchWorkflowExecutions
  app.get('/healthcare/workflow-automation/executions/search',
    zValidator('query', validators.SearchWorkflowExecutionsQuery, validationErrorHandler),
    registry.searchWorkflowExecutions as unknown as Handler
  );

  // searchTaskQueueItems
  app.get('/healthcare/workflow-automation/queue-items/search',
    zValidator('query', validators.SearchTaskQueueItemsQuery, validationErrorHandler),
    registry.searchTaskQueueItems as unknown as Handler
  );

  // claimTaskQueueItem
  app.post('/healthcare/workflow-automation/queue-items/:id/claim',
    zValidator('param', validators.ClaimTaskQueueItemParams, validationErrorHandler),
    zValidator('json', validators.ClaimTaskQueueItemBody, validationErrorHandler),
    registry.claimTaskQueueItem as unknown as Handler
  );

  // completeTaskQueueItem
  app.post('/healthcare/workflow-automation/queue-items/:id/complete',
    zValidator('param', validators.CompleteTaskQueueItemParams, validationErrorHandler),
    registry.completeTaskQueueItem as unknown as Handler
  );

  // returnTaskQueueItem
  app.post('/healthcare/workflow-automation/queue-items/:id/return',
    zValidator('param', validators.ReturnTaskQueueItemParams, validationErrorHandler),
    registry.returnTaskQueueItem as unknown as Handler
  );

  // createTaskQueue
  app.post('/healthcare/workflow-automation/queues',
    zValidator('json', validators.CreateTaskQueueBody, validationErrorHandler),
    registry.createTaskQueue as unknown as Handler
  );

  // searchTaskQueues
  app.get('/healthcare/workflow-automation/queues/search',
    zValidator('query', validators.SearchTaskQueuesQuery, validationErrorHandler),
    registry.searchTaskQueues as unknown as Handler
  );

  // getTaskQueue
  app.get('/healthcare/workflow-automation/queues/:id',
    zValidator('param', validators.GetTaskQueueParams, validationErrorHandler),
    registry.getTaskQueue as unknown as Handler
  );

  // updateTaskQueue
  app.put('/healthcare/workflow-automation/queues/:id',
    zValidator('param', validators.UpdateTaskQueueParams, validationErrorHandler),
    zValidator('json', validators.UpdateTaskQueueBody, validationErrorHandler),
    registry.updateTaskQueue as unknown as Handler
  );

  // deleteTaskQueue
  app.delete('/healthcare/workflow-automation/queues/:id',
    zValidator('param', validators.DeleteTaskQueueParams, validationErrorHandler),
    registry.deleteTaskQueue as unknown as Handler
  );

  // createWorkflowRule
  app.post('/healthcare/workflow-automation/rules',
    zValidator('json', validators.CreateWorkflowRuleBody, validationErrorHandler),
    registry.createWorkflowRule as unknown as Handler
  );

  // searchWorkflowRules
  app.get('/healthcare/workflow-automation/rules/search',
    zValidator('query', validators.SearchWorkflowRulesQuery, validationErrorHandler),
    registry.searchWorkflowRules as unknown as Handler
  );

  // getWorkflowRule
  app.get('/healthcare/workflow-automation/rules/:id',
    zValidator('param', validators.GetWorkflowRuleParams, validationErrorHandler),
    registry.getWorkflowRule as unknown as Handler
  );

  // updateWorkflowRule
  app.put('/healthcare/workflow-automation/rules/:id',
    zValidator('param', validators.UpdateWorkflowRuleParams, validationErrorHandler),
    zValidator('json', validators.UpdateWorkflowRuleBody, validationErrorHandler),
    registry.updateWorkflowRule as unknown as Handler
  );

  // deleteWorkflowRule
  app.delete('/healthcare/workflow-automation/rules/:id',
    zValidator('param', validators.DeleteWorkflowRuleParams, validationErrorHandler),
    registry.deleteWorkflowRule as unknown as Handler
  );

  // disableWorkflowRule
  app.post('/healthcare/workflow-automation/rules/:id/disable',
    zValidator('param', validators.DisableWorkflowRuleParams, validationErrorHandler),
    registry.disableWorkflowRule as unknown as Handler
  );

  // enableWorkflowRule
  app.post('/healthcare/workflow-automation/rules/:id/enable',
    zValidator('param', validators.EnableWorkflowRuleParams, validationErrorHandler),
    registry.enableWorkflowRule as unknown as Handler
  );

  // testWorkflowRule
  app.post('/healthcare/workflow-automation/rules/:id/test',
    zValidator('param', validators.TestWorkflowRuleParams, validationErrorHandler),
    zValidator('json', validators.TestWorkflowRuleBody, validationErrorHandler),
    registry.testWorkflowRule as unknown as Handler
  );

  // createOnCallSchedule
  app.post('/healthcare/workforce/on-call',
    zValidator('json', validators.CreateOnCallScheduleBody, validationErrorHandler),
    registry.createOnCallSchedule as unknown as Handler
  );

  // getCurrentOnCall
  app.get('/healthcare/workforce/on-call/current',
    zValidator('query', validators.GetCurrentOnCallQuery, validationErrorHandler),
    registry.getCurrentOnCall as unknown as Handler
  );

  // searchOnCallSchedules
  app.get('/healthcare/workforce/on-call/search',
    zValidator('query', validators.SearchOnCallSchedulesQuery, validationErrorHandler),
    registry.searchOnCallSchedules as unknown as Handler
  );

  // getOnCallSchedule
  app.get('/healthcare/workforce/on-call/:id',
    zValidator('param', validators.GetOnCallScheduleParams, validationErrorHandler),
    registry.getOnCallSchedule as unknown as Handler
  );

  // updateOnCallSchedule
  app.put('/healthcare/workforce/on-call/:id',
    zValidator('param', validators.UpdateOnCallScheduleParams, validationErrorHandler),
    zValidator('json', validators.UpdateOnCallScheduleBody, validationErrorHandler),
    registry.updateOnCallSchedule as unknown as Handler
  );

  // deleteOnCallSchedule
  app.delete('/healthcare/workforce/on-call/:id',
    zValidator('param', validators.DeleteOnCallScheduleParams, validationErrorHandler),
    registry.deleteOnCallSchedule as unknown as Handler
  );

  // createWorkSchedule
  app.post('/healthcare/workforce/schedules',
    zValidator('json', validators.CreateWorkScheduleBody, validationErrorHandler),
    registry.createWorkSchedule as unknown as Handler
  );

  // getWorkSchedule
  app.get('/healthcare/workforce/schedules/:id',
    zValidator('param', validators.GetWorkScheduleParams, validationErrorHandler),
    registry.getWorkSchedule as unknown as Handler
  );

  // updateWorkSchedule
  app.put('/healthcare/workforce/schedules/:id',
    zValidator('param', validators.UpdateWorkScheduleParams, validationErrorHandler),
    zValidator('json', validators.UpdateWorkScheduleBody, validationErrorHandler),
    registry.updateWorkSchedule as unknown as Handler
  );

  // deleteWorkSchedule
  app.delete('/healthcare/workforce/schedules/:id',
    zValidator('param', validators.DeleteWorkScheduleParams, validationErrorHandler),
    registry.deleteWorkSchedule as unknown as Handler
  );

  // createShiftAssignment
  app.post('/healthcare/workforce/shifts',
    zValidator('json', validators.CreateShiftAssignmentBody, validationErrorHandler),
    registry.createShiftAssignment as unknown as Handler
  );

  // searchShiftAssignments
  app.get('/healthcare/workforce/shifts/search',
    zValidator('query', validators.SearchShiftAssignmentsQuery, validationErrorHandler),
    registry.searchShiftAssignments as unknown as Handler
  );

  // swapShift
  app.post('/healthcare/workforce/shifts/swap',
    zValidator('json', validators.SwapShiftBody, validationErrorHandler),
    registry.swapShift as unknown as Handler
  );

  // getShiftAssignment
  app.get('/healthcare/workforce/shifts/:id',
    zValidator('param', validators.GetShiftAssignmentParams, validationErrorHandler),
    registry.getShiftAssignment as unknown as Handler
  );

  // updateShiftAssignment
  app.put('/healthcare/workforce/shifts/:id',
    zValidator('param', validators.UpdateShiftAssignmentParams, validationErrorHandler),
    zValidator('json', validators.UpdateShiftAssignmentBody, validationErrorHandler),
    registry.updateShiftAssignment as unknown as Handler
  );

  // patchShiftAssignment
  app.patch('/healthcare/workforce/shifts/:id',
    zValidator('param', validators.PatchShiftAssignmentParams, validationErrorHandler),
    zValidator('json', validators.PatchShiftAssignmentBody, validationErrorHandler),
    registry.patchShiftAssignment as unknown as Handler
  );

  // deleteShiftAssignment
  app.delete('/healthcare/workforce/shifts/:id',
    zValidator('param', validators.DeleteShiftAssignmentParams, validationErrorHandler),
    registry.deleteShiftAssignment as unknown as Handler
  );

  // createTimeOffRequest
  app.post('/healthcare/workforce/time-off',
    zValidator('json', validators.CreateTimeOffRequestBody, validationErrorHandler),
    registry.createTimeOffRequest as unknown as Handler
  );

  // searchTimeOffRequests
  app.get('/healthcare/workforce/time-off/search',
    zValidator('query', validators.SearchTimeOffRequestsQuery, validationErrorHandler),
    registry.searchTimeOffRequests as unknown as Handler
  );

  // getTimeOffRequest
  app.get('/healthcare/workforce/time-off/:id',
    zValidator('param', validators.GetTimeOffRequestParams, validationErrorHandler),
    registry.getTimeOffRequest as unknown as Handler
  );

  // deleteTimeOffRequest
  app.delete('/healthcare/workforce/time-off/:id',
    zValidator('param', validators.DeleteTimeOffRequestParams, validationErrorHandler),
    registry.deleteTimeOffRequest as unknown as Handler
  );

  // decideTimeOffRequest
  app.post('/healthcare/workforce/time-off/:id/decision',
    zValidator('param', validators.DecideTimeOffRequestParams, validationErrorHandler),
    zValidator('json', validators.DecideTimeOffRequestBody, validationErrorHandler),
    registry.decideTimeOffRequest as unknown as Handler
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
    authMiddleware({ roles: ["admin", "clinician", "registrar"] }),
    zValidator('json', validators.CreatePatientBody, validationErrorHandler),
    registry.createPatient as unknown as Handler
  );

  // listPatients
  app.get('/patients',
    authMiddleware({ roles: ["admin", "clinician", "support"] }),
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
    authMiddleware({ roles: ["admin", "clinician", "support", "patient:owner"] }),
    zValidator('param', validators.GetPatientParams, validationErrorHandler),
    registry.getPatient as unknown as Handler
  );

  // updatePatient
  app.patch('/patients/:id',
    authMiddleware({ roles: ["admin", "clinician", "registrar", "patient:owner"] }),
    zValidator('param', validators.UpdatePatientParams, validationErrorHandler),
    zValidator('json', validators.UpdatePatientBody, validationErrorHandler),
    registry.updatePatient as unknown as Handler
  );

  // deactivatePatient
  app.delete('/patients/:id',
    authMiddleware({ roles: ["admin", "registrar"] }),
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

}