import { eq, sql, inArray } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import type { Logger } from '@/types/logger';
import { dentalSyncLogs, type DentalSyncLog, type NewDentalSyncLog, type SyncStatus } from './sync-log.schema';

export class SyncLogRepository {
  constructor(
    private readonly db: DatabaseInstance,
    private readonly logger?: Logger,
  ) {}

  /**
   * G1 (P0): sync logs are tenant-scoped by branch. Callers MUST pass the set of
   * branch ids they are authorized to read; an empty scope returns nothing.
   * (The former no-WHERE `findAll()` leaked every org's sync logs.)
   */
  async findAll(branchIds: string[]): Promise<DentalSyncLog[]> {
    if (branchIds.length === 0) return [];
    return this.db.select().from(dentalSyncLogs).where(inArray(dentalSyncLogs.branchId, branchIds));
  }

  async findOneById(id: string): Promise<DentalSyncLog | null> {
    const [row] = await this.db.select().from(dentalSyncLogs).where(eq(dentalSyncLogs.id, id));
    return row ?? null;
  }

  async create(values: Omit<NewDentalSyncLog, 'id' | 'createdAt' | 'updatedAt' | 'version'>): Promise<DentalSyncLog> {
    const [row] = await this.db.insert(dentalSyncLogs).values(values).returning();
    if (!row) throw new Error('Insert returned no row');
    return row;
  }

  async update(
    id: string,
    values: Partial<Pick<DentalSyncLog, 'syncStatus' | 'serverId' | 'lastSyncAt' | 'error'>>,
  ): Promise<DentalSyncLog | null> {
    const [row] = await this.db
      .update(dentalSyncLogs)
      .set({ ...values, version: sql`${dentalSyncLogs.version} + 1`, updatedAt: new Date() })
      .where(eq(dentalSyncLogs.id, id))
      .returning();
    return row ?? null;
  }
}
