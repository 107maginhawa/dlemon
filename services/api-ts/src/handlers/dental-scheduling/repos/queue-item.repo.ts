import { eq, and, notInArray } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { DatabaseRepository } from '@/core/database.repo';
import {
  dentalQueueItems,
  type DentalQueueItem,
  type NewDentalQueueItem,
  type QueueItemStatus,
} from './queue-item.schema';

export interface QueueItemFilters {
  branchId?: string;
  status?: QueueItemStatus;
}

export class QueueItemRepository extends DatabaseRepository<DentalQueueItem, NewDentalQueueItem, QueueItemFilters> {
  constructor(db: DatabaseInstance, logger?: any) {
    super(db, dentalQueueItems, logger);
  }

  protected buildWhereConditions(filters?: QueueItemFilters) {
    if (!filters) return undefined;
    const conditions = [];
    if (filters.branchId) conditions.push(eq(dentalQueueItems.branchId, filters.branchId));
    if (filters.status) conditions.push(eq(dentalQueueItems.status, filters.status));
    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  override async findMany(filters?: QueueItemFilters): Promise<DentalQueueItem[]> {
    const where = this.buildWhereConditions(filters);
    return where
      ? await this.db.select().from(dentalQueueItems).where(where)
      : await this.db.select().from(dentalQueueItems);
  }

  override async findOneById(id: string): Promise<DentalQueueItem | null> {
    const [row] = await this.db.select().from(dentalQueueItems).where(eq(dentalQueueItems.id, id));
    return row ?? null;
  }

  async findActiveByBranch(branchId: string): Promise<DentalQueueItem[]> {
    const terminalStatuses: QueueItemStatus[] = ['completed', 'cancelled'];
    return this.db
      .select()
      .from(dentalQueueItems)
      .where(
        and(
          eq(dentalQueueItems.branchId, branchId),
          notInArray(dentalQueueItems.status, terminalStatuses),
        ),
      );
  }

  async update(
    id: string,
    values: Partial<Pick<DentalQueueItem, 'status' | 'calledAt' | 'startedAt' | 'completedAt' | 'notes'>>,
  ): Promise<DentalQueueItem | null> {
    const [row] = await this.db
      .update(dentalQueueItems)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(dentalQueueItems.id, id))
      .returning();
    return row ?? null;
  }
}
