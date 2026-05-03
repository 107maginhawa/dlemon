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
import { createDentalPatient } from '@/handlers/dental-patient/createDentalPatient';
import { listDentalPatients } from '@/handlers/dental-patient/listDentalPatients';
import { getDentalPatient } from '@/handlers/dental-patient/getDentalPatient';
import { updateDentalPatient } from '@/handlers/dental-patient/updateDentalPatient';
import { archiveDentalPatient } from '@/handlers/dental-patient/archiveDentalPatient';
import { restoreDentalPatient } from '@/handlers/dental-patient/restoreDentalPatient';
import { bulkArchiveDentalPatients } from '@/handlers/dental-patient/bulkArchiveDentalPatients';
import { exportDentalPatients } from '@/handlers/dental-patient/exportDentalPatients';
import { listFollowUpNotes, addFollowUpNote } from '@/handlers/dental-patient/followUpNotes';
import { getDentalPatientSafetyFloor } from '@/handlers/dental-patient/getDentalPatientSafetyFloor';
import { getDentalPatientStatement } from '@/handlers/dental-patient/getDentalPatientStatement';
import { getTreatmentPlan } from '@/handlers/dental-visit/getTreatmentPlan';
import { carryOverTreatments } from '@/handlers/dental-visit/carryOverTreatments';
import { initializeDentition } from '@/handlers/dental-visit/initializeDentition';
import {
  listTreatmentTemplates,
  createTreatmentTemplate,
  updateTreatmentTemplate,
  deleteTreatmentTemplate,
  applyTemplate,
} from '@/handlers/dental-visit/treatmentTemplates';
import { getPatientBalance } from '@/handlers/dental-billing/getPatientBalance';
import { getCollectionsSummary } from '@/handlers/dental-billing/getCollectionsSummary';
import { getDentalPaymentReceipt } from '@/handlers/dental-billing/getDentalPaymentReceipt';
import { getOrgContext } from '@/handlers/dental-org/getOrgContext';
import { getDashboardSummary } from '@/handlers/dental-org/getDashboardSummary';
import { setSecurityQuestion, recoverPin } from '@/handlers/dental-org/pinRecovery';
import { getImportedPMD } from '@/handlers/dental-pmd/getImportedPMD';
import { importPatients } from '@/handlers/dental-patient/importPatients';
import { exportPMD } from '@/handlers/dental-pmd/exportPMD';
import { getWorkingHours, updateWorkingHours } from '@/handlers/dental-scheduling/workingHours';
import { getBranchSettings, updateBranchSettings } from '@/handlers/dental-org/branchSettings';
import {
  listConsentTemplates,
  createConsentTemplate,
  updateConsentTemplate,
  deleteConsentTemplate,
} from '@/handlers/dental-org/consentTemplates';
import { authMiddleware } from '@/middleware/auth';
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
import { createSecurityHeaders, createCorsMiddleware } from '@/middleware/security';


/**
 * Create and configure the Hono application with proper dependency injection
 * Returns the Hono app instance with database, logger, auth, and storage attached
 */
export function createApp(config: Config): App {
  const app = new Hono<{ Variables: Variables }>();

  // Generate internal service token for secure service-to-service communication
  // Used for expand requests and future microservice communication
  // TODO: Move to config/env for production deployments
  const internalServiceToken = crypto.randomUUID();

  // Create core dependencies with config
  const logger = createLogger(config);
  const database = createDatabase(config.database);
  const email = createEmailService(database, config, logger);
  const auth = createAuth(database, config, logger, email);
  const storage = createStorageProvider(config.storage, logger);
  const jobs = createJobScheduler(database, logger);
  const ws = createWebSocketService(logger);

  const notifs = createNotificationService(database, logger, config.notifs, ws);
  const audit = createAuditService(database, logger);
  const billing = createBillingService(config.billing, database, logger);

  // Attach dependencies to the app instance early for access throughout
  Object.assign(app, { database, logger, auth, storage, jobs, notifs, email, audit, ws, billing, internalServiceToken });

  // Global middleware - order matters!

  // Request ID generation - Needed for all logging
  app.use('*', createRequestId(config));

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

  // Register API routes
  registerOpenAPIRoutes(app as any);

  // Dental-specific routes (not in TypeSpec, bypass generated validators)
  const dentalAuth = authMiddleware({ required: true, roles: ['user'] });

  // FR7.2: CSV / JSON patient import (before /:id to avoid param capture)
  app.post('/dental/patients/import', dentalAuth, importPatients);
  // FR2.8: Export must be before /:id to avoid param capture
  app.get('/dental/patients/export', dentalAuth, exportDentalPatients);
  // FR2.13: Bulk archive
  app.post('/dental/patients/bulk-archive', dentalAuth, bulkArchiveDentalPatients);

  // FR2.3: Create patient
  app.post('/dental/patients', dentalAuth, createDentalPatient);
  // FR2.1, FR2.2, FR2.10: List / search patients
  app.get('/dental/patients', dentalAuth, listDentalPatients);
  // FR2.4: Patient profile
  app.get('/dental/patients/:id', dentalAuth, getDentalPatient);
  // FR2.9, FR2.16, FR2.17, FR2.18: Update patient fields
  app.patch('/dental/patients/:id', dentalAuth, updateDentalPatient);
  // FR2.7: Archive / Restore
  app.post('/dental/patients/:id/archive', dentalAuth, archiveDentalPatient);
  app.post('/dental/patients/:id/restore', dentalAuth, restoreDentalPatient);
  // FR2.12: Follow-up notes
  app.get('/dental/patients/:id/follow-up-notes', dentalAuth, listFollowUpNotes);
  app.post('/dental/patients/:id/follow-up-notes', dentalAuth, addFollowUpNote);
  // FR2.15: Safety floor
  app.get('/dental/patients/:id/safety-floor', dentalAuth, getDentalPatientSafetyFloor);
  // FR2.21: Itemized statement
  app.get('/dental/patients/:id/statement', dentalAuth, getDentalPatientStatement);

  // FR1.8: Treatment templates
  app.get('/dental/treatment-templates', dentalAuth, listTreatmentTemplates);
  app.post('/dental/treatment-templates', dentalAuth, createTreatmentTemplate);
  app.patch('/dental/treatment-templates/:id', dentalAuth, updateTreatmentTemplate);
  app.delete('/dental/treatment-templates/:id', dentalAuth, deleteTreatmentTemplate);
  app.post('/dental/visits/:visitId/apply-template/:templateId', dentalAuth, applyTemplate);
  // FR1.11: Carry over treatments
  app.post('/dental/visits/:visitId/carry-over', dentalAuth, carryOverTreatments);
  // FR1.19: Dentition management (deciduous auto-populate)
  app.post('/dental/patients/:patientId/dentition', dentalAuth, initializeDentition);
  // FR1.22: Treatment plan presentation
  app.get('/dental/patients/:patientId/treatment-plan', dentalAuth, getTreatmentPlan);

  // FR4.4: Per-patient outstanding balance
  app.get('/dental/billing/patients/:patientId/balance', dentalAuth, getPatientBalance);
  // FR4.5: Collections summary
  app.get('/dental/billing/collections/summary', dentalAuth, getCollectionsSummary);
  // FR4.6: Payment receipt
  app.get('/dental/billing/invoices/:invoiceId/payments/:paymentId/receipt', dentalAuth, getDentalPaymentReceipt);

  app.get('/dental/org/context', dentalAuth, getOrgContext);
  // FR0.7 + FR0.8: Dashboard summary (active payment plans + lab order status)
  app.get('/dental/dashboard/summary', dentalAuth, getDashboardSummary);

  // FR12.2: Read parsed imported PMD
  app.get('/dental/pmd/imported/:id', dentalAuth, getImportedPMD);
  // FR12.6: Export/share PMD as downloadable file
  // Must be registered before the generated :visitId/pmd GET to avoid conflicts
  app.get('/dental/visits/:visitId/pmd/export', dentalAuth, exportPMD);

  // FR9.7: PIN recovery via security question
  app.post('/dental/org/members/:memberId/security-question', dentalAuth, setSecurityQuestion);
  app.post('/dental/org/members/:memberId/recover-pin', recoverPin); // No auth — user is locked out

  // FR3.10 / FR8.6: Working hours configuration
  app.get('/dental/branches/:branchId/working-hours', dentalAuth, getWorkingHours);
  app.put('/dental/branches/:branchId/working-hours', dentalAuth, updateWorkingHours);

  // FR8.1-FR8.3, FR8.7, FR8.8, FR8.13: Branch settings (clinic config, fee schedule, locale, access control)
  app.get('/dental/branches/:branchId/settings', dentalAuth, getBranchSettings);
  app.put('/dental/branches/:branchId/settings', dentalAuth, updateBranchSettings);

  // FR8.4: Treatment Templates Editor — same handlers as FR1.8, branch-scoped CRUD
  // Routes already registered above at /dental/treatment-templates

  // FR8.4b: Consent Form Templates CRUD
  app.get('/dental/branches/:branchId/consent-templates', dentalAuth, listConsentTemplates);
  app.post('/dental/branches/:branchId/consent-templates', dentalAuth, createConsentTemplate);
  app.patch('/dental/branches/:branchId/consent-templates/:id', dentalAuth, updateConsentTemplate);
  app.delete('/dental/branches/:branchId/consent-templates/:id', dentalAuth, deleteConsentTemplate);

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
