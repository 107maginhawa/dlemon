/**
 * Main server setup with Hono, Better-Auth, and generated routes
 * Uses factory pattern for dependency injection with proper cleanup support
 */

import { Hono } from 'hono';
import type { Variables, App } from '@/types/app';
import type { Config } from '@/core/config';

// Core dependencies
import { createAuth } from '@/core/auth';
import { ensureAdminUsers } from '@/utils/auth';
import { createDatabase, checkDatabaseConnection, closeDatabaseConnection, runMigrations, type DatabaseInstance } from '@/core/database';
import { createJobScheduler } from '@/core/jobs';
import { createLogger } from '@/core/logger';
import { createStorageProvider } from '@/core/storage';
import { createNotificationService } from '@/core/notifs';
import { createEmailService } from '@/core/email';
import { createAuditService } from '@/core/audit';
import { createWebSocketService } from '@/core/ws';
import { createBillingService } from '@/core/billing';
import { registerEmailJobs } from '@/handlers/email/jobs';
import { registerNotifsJobs } from '@/handlers/notifs/jobs';
import { registerAuditJobs } from '@/handlers/audit/jobs';
import { registerBookingJobs } from '@/handlers/booking/jobs';

// Routes
import { registerRoutes as registerOpenAPIRoutes } from '@/generated/openapi/routes';
import { registerRoutes as registerHealthRoutes } from '@/core/health';
import { registerRoutes as registerAuthRoutes } from '@/core/auth';
import { registerRoutes as registerDocsRoutes } from '@/core/openapi';
import { registerRoutes as registerWebSocketRoutes } from '@/generated/websocket/registry';
import { registerHandlers as registerErrorHandlers } from '@/core/errors';

// OpenAPI Specifications
import typespecOpenapi from '@monobase/api-spec/openapi.json';
import betterAuthOpenapi from '@/generated/better-auth/openapi.json';
import healthOpenapi from '@/core/health.openapi.json';

// Middleware
import { createRequestId, createRequestLogger } from '@/middleware/request';
import { createDependencyInjection } from '@/middleware/dependency';
import { createSecurityHeaders, createCorsMiddleware, createCsrfGuard, createPhiCacheHeaders } from '@/middleware/security';
import { metricsMiddleware } from '@/middleware/metrics-middleware';
import { metricsHandler } from '@/handlers/metrics';
import { authMiddleware } from '@/middleware/auth';
import { getToothHistory } from '@/handlers/dental-visit/getToothHistory';
import { getAuditEvents } from '@/handlers/dental-audit/getAuditEvents';
import { getBranchesByUser } from '@/handlers/dental-org/getBranchesByUser';
import { createPatientContact } from '@/handlers/dental-patient/createPatientContact';
import { listPatientContacts } from '@/handlers/dental-patient/listPatientContacts';
import { updatePatientContact } from '@/handlers/dental-patient/updatePatientContact';
import { deletePatientContact } from '@/handlers/dental-patient/deletePatientContact';
import { PatientContactParams, PatientContactContactParams, CreatePatientContactBody, UpdatePatientContactBody } from '@/handlers/dental-patient/contact-validators';
import { createRecall } from '@/handlers/dental-patient/createRecall';
import { listPatientRecalls } from '@/handlers/dental-patient/listPatientRecalls';
import { updateRecall } from '@/handlers/dental-patient/updateRecall';
import { RecallParams, RecallRecallParams, CreateRecallBody, UpdateRecallBody } from '@/handlers/dental-patient/recall-validators';
import { createTreatmentPlan } from '@/handlers/dental-patient/createTreatmentPlan';
import { listPatientTreatmentPlans } from '@/handlers/dental-patient/listPatientTreatmentPlans';
import { getTreatmentPlan } from '@/handlers/dental-patient/getTreatmentPlan';
import { updateTreatmentPlan } from '@/handlers/dental-patient/updateTreatmentPlan';
import { acceptTreatmentPlan } from '@/handlers/dental-patient/acceptTreatmentPlan';
import { TreatmentPlanParams, TreatmentPlanPlanParams, CreateTreatmentPlanBody, UpdateTreatmentPlanBody } from '@/handlers/dental-patient/treatment-plan-validators';
import { createSyncLog } from '@/handlers/dental-patient/createSyncLog';
import { listSyncLogs } from '@/handlers/dental-patient/listSyncLogs';
import { updateSyncLog } from '@/handlers/dental-patient/updateSyncLog';
import { SyncLogParams, SyncLogIdParams, CreateSyncLogBody, UpdateSyncLogBody } from '@/handlers/dental-patient/sync-log-validators';
import { createQueueItem } from '@/handlers/dental-scheduling/createQueueItem';
import { listQueueBoard } from '@/handlers/dental-scheduling/listQueueBoard';
import { updateQueueItemStatus } from '@/handlers/dental-scheduling/updateQueueItemStatus';
import { QueueItemAppointmentParams, QueueItemIdParams, QueueBoardParams, CreateQueueItemBody, UpdateQueueItemStatusBody } from '@/handlers/dental-scheduling/queue-item-validators';
import { createInsuranceProfile } from '@/handlers/dental-patient/createInsuranceProfile';
import { listPatientInsuranceProfiles } from '@/handlers/dental-patient/listPatientInsuranceProfiles';
import { updateInsuranceProfile } from '@/handlers/dental-patient/updateInsuranceProfile';
import { createClaimDraft } from '@/handlers/dental-patient/createClaimDraft';
import { listPatientClaims } from '@/handlers/dental-patient/listPatientClaims';
import { getClaimReadiness } from '@/handlers/dental-patient/getClaimReadiness';
import { updateClaimStatus } from '@/handlers/dental-patient/updateClaimStatus';
import {
  InsuranceProfileParams,
  InsuranceProfileIdParams,
  ClaimDraftParams,
  ClaimDraftIdParams,
  CreateInsuranceProfileBody,
  UpdateInsuranceProfileBody,
  CreateClaimDraftBody,
  UpdateClaimDraftStatusBody,
} from '@/handlers/dental-patient/insurance-validators';
import { createDentalAlert } from '@/handlers/dental-patient/createDentalAlert';
import { listDentalAlerts } from '@/handlers/dental-patient/listDentalAlerts';
import { updateDentalAlert } from '@/handlers/dental-patient/updateDentalAlert';
import { DentalAlertParams, DentalAlertIdParams, CreateDentalAlertBody, UpdateDentalAlertBody } from '@/handlers/dental-patient/dental-alert-validators';
import { createOcclusionScreening } from '@/handlers/dental-clinical/createOcclusionScreening';
import { listOcclusionScreenings } from '@/handlers/dental-clinical/listOcclusionScreenings';
import { OcclusionParams, OcclusionIdParams, CreateOcclusionBody, UpdateOcclusionBody } from '@/handlers/dental-clinical/occlusion-validators';
import { createPostopTemplate } from '@/handlers/dental-clinical/createPostopTemplate';
import { listPostopTemplates } from '@/handlers/dental-clinical/listPostopTemplates';
import { updatePostopTemplate } from '@/handlers/dental-clinical/updatePostopTemplate';
import { PostopBranchParams, PostopTemplateIdParams, CreatePostopTemplateBody, UpdatePostopTemplateBody } from '@/handlers/dental-clinical/postop-validators';
import { zValidator } from '@hono/zod-validator';
import { user as userTable } from '@/generated/better-auth/schema';
import { eq } from 'drizzle-orm';


/**
 * Create and configure the Hono application with proper dependency injection
 * Returns the Hono app instance with database, logger, auth, and storage attached
 */
export function createApp(config: Config): App {
  const app = new Hono<{ Variables: Variables }>();

  // Internal service token for secure service-to-service communication.
  // Set INTERNAL_SERVICE_TOKEN env var in production for stable multi-instance deployments.
  const internalServiceToken = config.server.internalServiceToken;

  // Create core dependencies with config
  const logger = createLogger(config);
  const database = createDatabase(config.database);
  const email = createEmailService(database, config, logger);
  const auth = createAuth(database, config, logger, email);
  const storage = createStorageProvider(config.storage, logger);
  const jobs = createJobScheduler(database, logger);
  const ws = createWebSocketService(logger);

  const notifs = createNotificationService(database, logger, config.notifs, ws, email);
  const audit = createAuditService(database, logger);
  const billing = createBillingService(config.billing, database, logger);

  // Attach dependencies to the app instance early for access throughout
  Object.assign(app, { database, logger, auth, storage, jobs, notifs, email, audit, ws, billing, internalServiceToken });

  // Global middleware - order matters!

  // Request ID generation - Needed for all logging
  app.use('*', createRequestId(config));

  // Latency histogram - record duration of every request (skips /metrics itself)
  app.use('*', metricsMiddleware);

  // Dependency injection - Inject logger, database, storage, auth, jobs early
  app.use('*', createDependencyInjection(app as App, config));

  // Request logger - Log all incoming requests
  app.use('*', createRequestLogger(config));

  // Security headers - Lightweight, security critical
  app.use('*', createSecurityHeaders(config));

  // CORS - Required early for preflight
  app.use('*', createCorsMiddleware(config, logger));

  // Register health check endpoints
  registerHealthRoutes(app as App);

  // Register auth routes
  registerAuthRoutes(app as App);

  // Override routes where generated zValidator rejects string path params for int32 fields.
  // TypeSpec generates z.number().int() but Hono params are always strings.
  // These manual routes shadow the generated ones (Hono matches first-registered).

  // Dev-only: mark current session user's email as verified (for E2E tests)
  if (process.env['NODE_ENV'] !== 'production') {
    (app as any).post('/dev/verify-email',
      authMiddleware({ roles: ['user'] }),
      async (c: any) => {
        const sessionUser = c.get('user');
        await database.update(userTable).set({ emailVerified: true }).where(eq(userTable.id, sessionUser.id));
        return c.json({ ok: true });
      }
    );
  }
  (app as any).get('/dental/branches',
    authMiddleware({ roles: ['user'] }),
    getBranchesByUser
  );
  (app as any).get('/dental/visits/history/:patientId/teeth/:toothNumber',
    authMiddleware({ roles: ['user'] }),
    getToothHistory
  );
  (app as any).get('/dental/admin/audit',
    authMiddleware({ roles: ['admin'] }),
    getAuditEvents
  );
  // PatientContact / Guardian endpoints (PAT-BR-002 — P0-A)
  (app as any).post('/dental/patients/:patientId/contacts',
    authMiddleware({ roles: ['user'] }),
    zValidator('param', PatientContactParams),
    zValidator('json', CreatePatientContactBody),
    createPatientContact
  );
  (app as any).get('/dental/patients/:patientId/contacts',
    authMiddleware({ roles: ['user'] }),
    zValidator('param', PatientContactParams),
    listPatientContacts
  );
  (app as any).patch('/dental/patients/:patientId/contacts/:contactId',
    authMiddleware({ roles: ['user'] }),
    zValidator('param', PatientContactContactParams),
    zValidator('json', UpdatePatientContactBody),
    updatePatientContact
  );
  (app as any).delete('/dental/patients/:patientId/contacts/:contactId',
    authMiddleware({ roles: ['user'] }),
    zValidator('param', PatientContactContactParams),
    deletePatientContact
  );

  // Recall endpoints (P0-B)
  (app as any).post('/dental/patients/:patientId/recalls',
    authMiddleware({ roles: ['user'] }),
    zValidator('param', RecallParams),
    zValidator('json', CreateRecallBody),
    createRecall
  );
  (app as any).get('/dental/patients/:patientId/recalls',
    authMiddleware({ roles: ['user'] }),
    zValidator('param', RecallParams),
    listPatientRecalls
  );
  (app as any).patch('/dental/patients/:patientId/recalls/:recallId',
    authMiddleware({ roles: ['user'] }),
    zValidator('param', RecallRecallParams),
    zValidator('json', UpdateRecallBody),
    updateRecall
  );

  // DentalAlert endpoints (P2-001)
  (app as any).post('/dental/patients/:patientId/dental-alerts',
    authMiddleware({ roles: ['user'] }),
    zValidator('param', DentalAlertParams),
    zValidator('json', CreateDentalAlertBody),
    createDentalAlert
  );
  (app as any).get('/dental/patients/:patientId/dental-alerts',
    authMiddleware({ roles: ['user'] }),
    zValidator('param', DentalAlertParams),
    listDentalAlerts
  );
  (app as any).patch('/dental/patients/:patientId/dental-alerts/:alertId',
    authMiddleware({ roles: ['user'] }),
    zValidator('param', DentalAlertIdParams),
    zValidator('json', UpdateDentalAlertBody),
    updateDentalAlert
  );

  // OcclusionScreening endpoints (P2-002)
  (app as any).post('/dental/patients/:patientId/occlusion-screenings',
    authMiddleware({ roles: ['user'] }),
    zValidator('param', OcclusionParams),
    zValidator('json', CreateOcclusionBody),
    createOcclusionScreening
  );
  (app as any).get('/dental/patients/:patientId/occlusion-screenings',
    authMiddleware({ roles: ['user'] }),
    zValidator('param', OcclusionParams),
    listOcclusionScreenings
  );

  // PostOp Template endpoints (P2-008)
  (app as any).post('/dental/branches/:branchId/postop-templates',
    authMiddleware({ roles: ['user'] }),
    zValidator('param', PostopBranchParams),
    zValidator('json', CreatePostopTemplateBody),
    createPostopTemplate
  );
  (app as any).get('/dental/branches/:branchId/postop-templates',
    authMiddleware({ roles: ['user'] }),
    zValidator('param', PostopBranchParams),
    listPostopTemplates
  );
  (app as any).patch('/dental/branches/:branchId/postop-templates/:templateId',
    authMiddleware({ roles: ['user'] }),
    zValidator('param', PostopTemplateIdParams),
    zValidator('json', UpdatePostopTemplateBody),
    updatePostopTemplate
  );

  // TreatmentPlan endpoints (P0-C)
  (app as any).post('/dental/patients/:patientId/treatment-plans',
    authMiddleware({ roles: ['user'] }),
    zValidator('param', TreatmentPlanParams),
    zValidator('json', CreateTreatmentPlanBody),
    createTreatmentPlan
  );
  (app as any).get('/dental/patients/:patientId/treatment-plans',
    authMiddleware({ roles: ['user'] }),
    zValidator('param', TreatmentPlanParams),
    listPatientTreatmentPlans
  );
  (app as any).get('/dental/patients/:patientId/treatment-plans/:planId',
    authMiddleware({ roles: ['user'] }),
    zValidator('param', TreatmentPlanPlanParams),
    getTreatmentPlan
  );
  (app as any).patch('/dental/patients/:patientId/treatment-plans/:planId',
    authMiddleware({ roles: ['user'] }),
    zValidator('param', TreatmentPlanPlanParams),
    zValidator('json', UpdateTreatmentPlanBody),
    updateTreatmentPlan
  );
  (app as any).post('/dental/patients/:patientId/treatment-plans/:planId/accept',
    authMiddleware({ roles: ['user'] }),
    zValidator('param', TreatmentPlanPlanParams),
    acceptTreatmentPlan
  );

  // SyncLog endpoints (P0-D)
  (app as any).post('/dental/sync-logs',
    authMiddleware({ roles: ['user'] }),
    zValidator('json', CreateSyncLogBody),
    createSyncLog
  );
  (app as any).get('/dental/sync-logs',
    authMiddleware({ roles: ['user'] }),
    zValidator('query', SyncLogParams),
    listSyncLogs
  );
  (app as any).patch('/dental/sync-logs/:logId',
    authMiddleware({ roles: ['user'] }),
    zValidator('param', SyncLogIdParams),
    zValidator('json', UpdateSyncLogBody),
    updateSyncLog
  );

  // Queue board endpoints (A5 P1-003)
  (app as any).post('/dental/appointments/:appointmentId/queue-item',
    authMiddleware({ roles: ['user'] }),
    zValidator('param', QueueItemAppointmentParams),
    zValidator('json', CreateQueueItemBody),
    createQueueItem,
  );
  (app as any).get('/dental/branches/:branchId/queue-board',
    authMiddleware({ roles: ['user'] }),
    zValidator('param', QueueBoardParams),
    listQueueBoard,
  );
  (app as any).patch('/dental/queue-items/:itemId/status',
    authMiddleware({ roles: ['user'] }),
    zValidator('param', QueueItemIdParams),
    zValidator('json', UpdateQueueItemStatusBody),
    updateQueueItemStatus,
  );

  // Insurance profiles + Claim drafts (B2 P1-007)
  (app as any).post('/dental/patients/:patientId/insurance-profiles',
    authMiddleware({ roles: ['user'] }),
    zValidator('param', InsuranceProfileParams),
    zValidator('json', CreateInsuranceProfileBody),
    createInsuranceProfile
  );
  (app as any).get('/dental/patients/:patientId/insurance-profiles',
    authMiddleware({ roles: ['user'] }),
    zValidator('param', InsuranceProfileParams),
    listPatientInsuranceProfiles
  );
  (app as any).patch('/dental/patients/:patientId/insurance-profiles/:profileId',
    authMiddleware({ roles: ['user'] }),
    zValidator('param', InsuranceProfileIdParams),
    zValidator('json', UpdateInsuranceProfileBody),
    updateInsuranceProfile
  );
  (app as any).post('/dental/patients/:patientId/claims',
    authMiddleware({ roles: ['user'] }),
    zValidator('param', ClaimDraftParams),
    zValidator('json', CreateClaimDraftBody),
    createClaimDraft
  );
  (app as any).get('/dental/patients/:patientId/claims',
    authMiddleware({ roles: ['user'] }),
    zValidator('param', ClaimDraftParams),
    listPatientClaims
  );
  (app as any).get('/dental/patients/:patientId/claims/:claimId/readiness',
    authMiddleware({ roles: ['user'] }),
    zValidator('param', ClaimDraftIdParams),
    getClaimReadiness
  );
  (app as any).patch('/dental/patients/:patientId/claims/:claimId/status',
    authMiddleware({ roles: ['user'] }),
    zValidator('param', ClaimDraftIdParams),
    zValidator('json', UpdateClaimDraftStatusBody),
    updateClaimStatus
  );

  // PHI cache headers — no-store on all API responses (ASVS V8 / F-025)
  app.use('*', createPhiCacheHeaders());

  // CSRF guard — must come before generated routes; Bearer/internal-expand/no-browser-signal exempt
  app.use('*', createCsrfGuard(config, logger));

  // Prometheus scrape endpoint - register BEFORE generated routes so it takes priority.
  // Auth via static bearer token (METRICS_TOKEN env var).
  app.get('/metrics', metricsHandler);

  // Register API routes
  registerOpenAPIRoutes(app as any);

  // Register WebSocket handlers
  registerWebSocketRoutes(app as App);

  // Register documentation routes with multiple OpenAPI specs
  registerDocsRoutes(app as App, [typespecOpenapi, betterAuthOpenapi, healthOpenapi], config);

  // Register error handlers - must be last!
  registerErrorHandlers(app as App, config);

  return app as App;
}

/**
 * Initialize application components and dependencies
 * Handles database, admin users, and job scheduler initialization
 */
export async function initializeApp(app: App, config: Config): Promise<void> {
  const { database, logger, jobs } = app;

  // Run database migrations (skip when an embedded host injected a pre-built
  // Drizzle instance — that host owns schema management).
  if (config.database.instance) {
    logger.debug('Skipping migrations: pre-built database instance was injected');
  } else {
    logger.debug('Running database migrations...');
    await runMigrations(database);
    logger.debug('Database migrations completed successfully');
  }

  // Initialize email templates
  logger.debug('Initializing email templates...');
  await app.email.initializeDefaultTemplates();
  logger.debug('Email templates initialized successfully');

  // Setup admin users if configured
  if (config.auth.adminEmails && config.auth.adminEmails.length > 0) {
    logger.debug('Setting up admin users...');
    const promotedEmails = await ensureAdminUsers(database, config.auth.adminEmails);
    if (promotedEmails.length > 0) {
      logger.info({ promotedEmails }, `Promoted ${promotedEmails.length} users to admin role`);
    } else {
      logger.debug('No existing users found to promote to admin role');
    }
    logger.debug('Admin user setup completed successfully');
  }

  // Initialize and start background job scheduler
  registerEmailJobs(jobs, app.email);
  registerNotifsJobs(jobs, app.notifs);
  registerAuditJobs(jobs);
  registerBookingJobs(jobs, app.notifs);
  
  logger.debug('Starting background job scheduler...');
  await jobs.start();
  logger.debug('Background job scheduler started successfully');
}

/**
 * Cleanup helper function for graceful shutdown
 * Extracts database, logger, auth, and storage from the app instance and performs cleanup
 */
export async function cleanupApp(app: App): Promise<void> {
  const { database, logger, jobs } = app;
  
  logger.debug('Cleaning up application resources...');
  
  // Shutdown job scheduler first
  if (jobs) {
    logger.debug('Shutting down job scheduler...');
    await jobs.shutdown();
    logger.debug('Job scheduler shutdown successfully');
  }
  
  // Gracefully close db conn 
  await closeDatabaseConnection(database);
  logger.debug('Database connection closed successfully');
}
