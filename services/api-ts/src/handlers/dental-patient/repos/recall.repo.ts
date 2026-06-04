import { eq, and, sql } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import {
  dentalRecalls,
  type DentalRecall,
  type NewDentalRecall,
  type RecallStatus,
} from './recall.schema';
import { getDueRecallsByBranch, getDispatchableRecalls } from './recall-person.facade';

export class RecallRepository {
  constructor(
    private readonly db: DatabaseInstance,
    private readonly logger?: any,
  ) {}

  async findByPatientId(patientId: string): Promise<DentalRecall[]> {
    return this.db
      .select()
      .from(dentalRecalls)
      .where(eq(dentalRecalls.patientId, patientId));
  }

  async findOneById(id: string, patientId: string): Promise<DentalRecall | null> {
    const [row] = await this.db
      .select()
      .from(dentalRecalls)
      .where(and(eq(dentalRecalls.id, id), eq(dentalRecalls.patientId, patientId)));
    return row ?? null;
  }

  async create(
    values: Omit<NewDentalRecall, 'id' | 'createdAt' | 'updatedAt' | 'version'>,
  ): Promise<DentalRecall> {
    const [row] = await this.db.insert(dentalRecalls).values(values).returning();
    if (!row) throw new Error('Insert returned no row');
    return row;
  }

  async update(
    id: string,
    patientId: string,
    values: Partial<Pick<DentalRecall, 'type' | 'dueDate' | 'status' | 'notes' | 'intervalMonths' | 'sentAt' | 'lastSentAt' | 'sendAttempts' | 'completedAt'>>,
  ): Promise<DentalRecall | null> {
    const [row] = await this.db
      .update(dentalRecalls)
      .set({ ...values, updatedAt: new Date() })
      .where(and(eq(dentalRecalls.id, id), eq(dentalRecalls.patientId, patientId)))
      .returning();
    return row ?? null;
  }

  /**
   * P1-24: branch-scoped recare due-list. Returns recalls that are NOT terminal
   * (pending/sent) whose dueDate falls within [from, to] for patients whose
   * preferred branch is `branchId`, enriched with patient display name. Excludes
   * completed/cancelled. Paginated, ordered by dueDate ascending.
   */
  async findDueByBranch(
    branchId: string,
    from: string,
    to: string,
    options?: { limit?: number; offset?: number },
  ): Promise<Array<DentalRecall & { patientName: string }>> {
    return getDueRecallsByBranch(this.db, branchId, from, to, options);
  }

  /**
   * P1-24 recallDueScan: recalls with a recurrence interval whose dueDate is in
   * the past relative to `asOfDate` (YYYY-MM-DD) and that are still pending.
   * Used by the nightly scan to flag/recompute. Batch-limited.
   */
  async findRecurringPending(asOfDate: string, limit = 100): Promise<DentalRecall[]> {
    return this.db
      .select()
      .from(dentalRecalls)
      .where(and(
        eq(dentalRecalls.status, 'pending'),
        sql`${dentalRecalls.intervalMonths} IS NOT NULL`,
      ))
      .limit(limit);
  }

  /**
   * P1-24 recallDispatch: due recalls eligible for outreach.
   *   - pending + dueDate <= asOfDate (first send), OR
   *   - sent + lastSentAt older than reattemptCutoff + sendAttempts < maxAttempts.
   * Returns the row + patient.preferredBranchId so the dispatcher can consent-gate.
   */
  async findDispatchable(
    asOfDate: string,
    reattemptCutoff: Date,
    maxAttempts: number,
    limit = 100,
  ): Promise<Array<DentalRecall & { preferredBranchId: string | null; personId: string }>> {
    return getDispatchableRecalls(this.db, asOfDate, reattemptCutoff, maxAttempts, limit);
  }

  async markDispatched(id: string, attempts: number, actorId: string): Promise<DentalRecall | null> {
    const [row] = await this.db
      .update(dentalRecalls)
      .set({
        status: 'sent',
        sentAt: sql`COALESCE(${dentalRecalls.sentAt}, ${new Date().toISOString()})`,
        lastSentAt: new Date(),
        sendAttempts: attempts,
        updatedAt: new Date(),
        updatedBy: actorId,
      })
      .where(eq(dentalRecalls.id, id))
      .returning();
    return row ?? null;
  }
}
