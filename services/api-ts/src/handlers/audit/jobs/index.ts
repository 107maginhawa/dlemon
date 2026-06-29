/**
 * Audit Module Background Jobs
 * Registers and configures audit-related background jobs
 */

import type { JobScheduler, JobContext } from '@/core/jobs';

/**
 * Register all audit module jobs with the scheduler
 */
export function registerAuditJobs(scheduler: JobScheduler): void {
  // Audit retention job - runs daily at 3 AM
  scheduler.registerCron('audit.retention', '0 3 * * *', async (context: JobContext) => {
    const { db, logger, jobId } = context;
    logger.debug({ jobId }, 'Starting audit retention job');
    
    try {
      const { AuditRepository } = await import('../repos/audit.repo');
      const auditRepo = new AuditRepository(db, logger);
      
      // Archive logs older than 1 year (365 days). The audit trail is
      // append-only and is NEVER purged (see handlers/retention/retention-targets.ts
      // — audit is a `protected`/`retain` target). Archival only changes
      // retention_status; no rows are ever deleted.
      const archivedCount = await auditRepo.archiveOldLogs(365);
      logger.info({ jobId, archivedCount }, `Archived ${archivedCount} audit logs older than 1 year`);

      logger.info({ jobId, archivedCount }, 'Audit retention job completed');
    } catch (error) {
      logger.error({ error, jobId }, 'Audit retention job failed');
      throw error;
    }
  });
}
