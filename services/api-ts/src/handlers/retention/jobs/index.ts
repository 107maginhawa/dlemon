/**
 * Retention module background jobs (V-DG-001).
 *
 * Registers the generic retention-enforcement cron. It is DRY-RUN by default:
 * real action only happens when RETENTION_ENFORCEMENT_ENABLED="true". The engine
 * enforces the other safety invariants (never-purge-audit, soft-archive,
 * legal-hold exemption) regardless.
 */

import type { JobScheduler, JobContext } from '@/core/jobs';

/** Real action is an explicit, env-gated opt-in. Anything but "true" → dry-run. */
function isEnforcementEnabled(): boolean {
  return process.env['RETENTION_ENFORCEMENT_ENABLED'] === 'true';
}

export function registerRetentionJobs(scheduler: JobScheduler): void {
  // Runs daily at 03:30 (offset from audit.retention at 03:00).
  scheduler.registerCron('retention.enforcement', '30 3 * * *', async (context: JobContext) => {
    const { db, logger, jobId } = context;
    const dryRun = !isEnforcementEnabled();
    logger.debug({ jobId, dryRun }, 'Starting retention enforcement job');

    try {
      const { RetentionPolicyRepository } = await import('../repos/retention-policy.repo');
      const { evaluateRetention } = await import('../retention-engine');

      const repo = new RetentionPolicyRepository(db, logger);
      const policies = await repo.findEnabled();

      const results = await evaluateRetention(db, logger, policies, { dryRun });

      const eligible = results.reduce((n, r) => n + r.eligibleCount, 0);
      const actioned = results.reduce((n, r) => n + r.actionedCount, 0);
      const legalHeld = results.reduce((n, r) => n + r.legalHeldCount, 0);

      logger.info(
        { jobId, dryRun, policies: policies.length, eligible, legalHeld, actioned },
        `Retention enforcement job completed (${dryRun ? 'dry-run' : 'enforced'})`,
      );
    } catch (error) {
      logger.error({ error, jobId }, 'Retention enforcement job failed');
      throw error;
    }
  });
}
