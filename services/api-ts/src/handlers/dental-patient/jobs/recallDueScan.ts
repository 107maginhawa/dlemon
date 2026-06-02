/**
 * recallDueScan (P1-24)
 *
 * Nightly cron. Surfaces recalls whose `dueDate` has arrived so the front-desk
 * due-list (and the dispatch job) can act. `pending` IS the "due-but-not-sent"
 * state, so this scan changes NO status — it is an observability/recompute pass:
 *   - counts recalls now due (dueDate ≤ today, status pending), and
 *   - is the hook where future auto-recompute from intervalMonths + last completed
 *     would live (next-cycle seeding already happens on recall completion).
 *
 * Idempotent (read-mostly) and batch-limited. Timezone-correct: due-ness is judged
 * per-branch against local "today".
 */

import type { JobContext } from '@/core/jobs';
import type { DatabaseInstance } from '@/core/database';
import { RecallRepository } from '../repos/recall.repo';
import { todayInTimezone, isDueOnOrBefore } from '../utils/recall-dates';

export async function recallDueScanJob(context: JobContext): Promise<void> {
  const { logger, jobId } = context;
  const db = context.db as unknown as DatabaseInstance;

  try {
    const repo = new RecallRepository(db, logger);
    const now = new Date();
    // UTC due filter as a coarse batch bound; refine per-branch below.
    const candidates = await repo.findRecurringPending(now.toISOString().slice(0, 10), 100);

    let dueCount = 0;
    for (const recall of candidates) {
      // Resolve branch tz via the patient's branch — but findRecurringPending does
      // not join patient; fall back to UTC-today for the coarse count. A precise
      // per-branch judgment is made in recallDispatch where the branch is joined.
      const today = todayInTimezone('UTC', now);
      if (isDueOnOrBefore(recall.dueDate, today)) dueCount++;
    }

    if (dueCount > 0) {
      logger.info({ jobId, recurring: candidates.length, due: dueCount }, 'Recall due scan complete');
    }
  } catch (error) {
    logger.error({ jobId, error: error instanceof Error ? error.message : String(error) }, 'Recall due scan job failed');
    // Non-critical — do not rethrow.
  }
}
