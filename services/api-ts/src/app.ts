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
import { registerRetentionJobs } from '@/handlers/retention/jobs';
import { registerDentalSchedulingJobs } from '@/handlers/dental-scheduling/jobs/holdCleanup';

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
import { getToothHistory } from '@/handlers/dental-visit/chart/getToothHistory';
// TR-DG-002: contacts/recalls/alerts/tasks/treatment-plans(create,list,update,approval)/
// sync-logs/insurance/claims/occlusion/postop/inventory/fee-schedule/queue handlers are
// now codegen-routed (registry → registerOpenAPIRoutes); their app.ts imports were removed.
// Only the two operationId-collision treatment-plan keeps remain hand-mounted:
import { getTreatmentPlan } from '@/handlers/dental-patient/treatment-plans/getTreatmentPlan';
import { acceptTreatmentPlan } from '@/handlers/dental-patient/treatment-plans/acceptTreatmentPlan';
import { TreatmentPlanPlanParams } from '@/handlers/dental-patient/utils/treatment-plan-validators';
import { zValidator } from '@hono/zod-validator';
import { user as userTable } from '@/generated/better-auth/schema';
import { eq } from 'drizzle-orm';
import { recoverPin } from '@/handlers/dental-org/pinRecovery';
import { RecoverPinParams, RecoverPinBody } from '@/generated/openapi/validators';


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
  // /dental/branches (user's branches) — MIGRATED to TypeSpec codegen (TR-DG-002):
  // emits from dental-org.tsp BranchConfigManagement.getBranchesByUser in main.tsp.
  (app as any).get('/dental/visits/history/:patientId/teeth/:toothNumber',
    authMiddleware({ roles: ['user'] }),
    getToothHistory
  );
  // G8-S4: canonical audit viewer GET /dental/audit-events is MIGRATED to
  // TypeSpec codegen (TR-DG-002) — emits from dental-audit.tsp → DentalAuditMgmt
  // in main.tsp, registered via registerOpenAPIRoutes below. The append-only
  // /dental/audit-events/:id 405 guards stay here (Cat-1: method-shadow guards).
  // Fee schedule (EF-ORG-P016 / WF-025, FR6.3) — MIGRATED to TypeSpec codegen
  // (TR-DG-002): emits from dental-ops-extras.tsp → FeeScheduleMgmt in main.tsp.
  // EM-AUD-006: Audit log is append-only — DELETE/PUT/PATCH on individual records are not permitted.
  // V-AUD-005: code is AUDIT_EVENT_IMMUTABLE (matches ERROR_TAXONOMY §5 dental-audit).
  (app as any).delete('/dental/audit-events/:id', (c: any) =>
    c.json({ error: 'Audit log is append-only. Records cannot be deleted.', code: 'AUDIT_EVENT_IMMUTABLE' }, 405)
  );
  (app as any).put('/dental/audit-events/:id', (c: any) =>
    c.json({ error: 'Audit log is append-only. Records cannot be modified.', code: 'AUDIT_EVENT_IMMUTABLE' }, 405)
  );
  (app as any).patch('/dental/audit-events/:id', (c: any) =>
    c.json({ error: 'Audit log is append-only. Records cannot be modified.', code: 'AUDIT_EVENT_IMMUTABLE' }, 405)
  );

  // V-PMD-001: Imported PMDs are immutable (BR-022 / AC-PMD-002). PATCH/PUT/DELETE on
  // /dental/pmd/imported/:id must return 405 IMPORTED_PMD_IMMUTABLE. The generated routes
  // only expose GET; these guards shadow any mutating verb so it never falls through to a
  // default 404. Mirrors the append-only audit-event guard style above.
  (app as any).patch('/dental/pmd/imported/:id', (c: any) =>
    c.json({ error: 'Imported PMDs are immutable and cannot be modified.', code: 'IMPORTED_PMD_IMMUTABLE' }, 405)
  );
  (app as any).put('/dental/pmd/imported/:id', (c: any) =>
    c.json({ error: 'Imported PMDs are immutable and cannot be modified.', code: 'IMPORTED_PMD_IMMUTABLE' }, 405)
  );
  (app as any).delete('/dental/pmd/imported/:id', (c: any) =>
    c.json({ error: 'Imported PMDs are immutable and cannot be deleted.', code: 'IMPORTED_PMD_IMMUTABLE' }, 405)
  );
  // V-DG-002: right-to-erasure (WFG-006) — MIGRATED to TypeSpec codegen
  // (TR-DG-002). Routes now emit from dental-erasure.tsp → DentalErasureMgmt in
  // main.tsp and register via registerOpenAPIRoutes below. Admin RBAC stays
  // in-handler. See handlers/dental-erasure/erasure-route-registration.test.ts.

  // V-DG-002 support: legal holds (WFG-006) — MIGRATED to TypeSpec codegen
  // (TR-DG-002). Routes emit from dental-legal-hold.tsp → DentalLegalHoldMgmt in
  // main.tsp; admin RBAC stays in-handler. An active hold blocks erasure of the
  // subject. See handlers/dental-legalhold/legal-hold-route-registration.test.ts.

  // ── TR-DG-002: the following dental endpoints are MIGRATED to TypeSpec codegen
  // and now register via registerOpenAPIRoutes below (in-handler RBAC unchanged):
  //   contacts/recalls/dental-alerts/tasks  → dental-patient-engagement.tsp
  //   treatment-plans(create/list/update/approval), sync-logs, insurance-profiles,
  //     claims                              → dental-patient-finance.tsp
  //   occlusion-screenings/postop-templates/inventory → dental-clinical-ops.tsp
  //   queue (queue-item/queue-board/status) → dental-ops-extras.tsp
  // Boot-smoke per feature lives in each handler dir's *-route-registration.test.ts.

  // TreatmentPlan (plural) GET-one + accept stay hand-mounted: their handlers are
  // re-export shims of dental-visit's getTreatmentPlan/acceptTreatmentPlan, whose
  // operationIds already emit via the singular /treatment-plan route — codegen
  // forbids duplicate operationIds, so these two routes remain Cat-1 manual keeps.
  (app as any).get('/dental/patients/:patientId/treatment-plans/:planId',
    authMiddleware({ roles: ['user'] }),
    zValidator('param', TreatmentPlanPlanParams),
    getTreatmentPlan
  );
  (app as any).post('/dental/patients/:patientId/treatment-plans/:planId/accept',
    authMiddleware({ roles: ['user'] }),
    zValidator('param', TreatmentPlanPlanParams),
    acceptTreatmentPlan
  );

  // PHI cache headers — no-store on all API responses (ASVS V8 / F-025)
  app.use('*', createPhiCacheHeaders());

  // CSRF guard — must come before generated routes; Bearer/internal-expand/no-browser-signal exempt
  app.use('*', createCsrfGuard(config, logger));

  // Prometheus scrape endpoint - register BEFORE generated routes so it takes priority.
  // Auth via static bearer token (METRICS_TOKEN env var).
  app.get('/metrics', metricsHandler);

  // EM-ORG-001: Shadow the generated recoverPin route (which lacks authMiddleware)
  // with an authenticated version. Hono matches first-registered route, so this
  // shadow takes priority over the generated routes registered below.
  (app as any).post('/dental/org/members/:memberId/recover-pin',
    authMiddleware({ roles: ['user'] }),
    zValidator('param', RecoverPinParams),
    zValidator('json', RecoverPinBody),
    recoverPin,
  );

  // EM-CLI-001: revokeConsentForm is now declared in TypeSpec and registered via
  // the generated OpenAPI routes (PATCH /dental/visits/:visitId/consents/:cid/revoke).
  // The former hand-registration here was removed to avoid a duplicate route.

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
  registerRetentionJobs(jobs);
  registerDentalSchedulingJobs(jobs);

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
