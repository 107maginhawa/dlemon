import { pgTable, text, timestamp, index } from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';

export const SYNC_STATUSES = ['pending', 'syncing', 'synced', 'failed'] as const;
export type SyncStatus = typeof SYNC_STATUSES[number];

export const SYNC_FSM: Record<SyncStatus, SyncStatus[]> = {
  pending: ['syncing', 'failed'],
  syncing: ['synced', 'failed'],
  synced: [],
  failed: ['syncing'],
};

export const dentalSyncLogs = pgTable('dental_sync_log', {
  ...baseEntityFields,
  localId: text('local_id').notNull(),
  serverId: text('server_id'),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  branchId: text('branch_id'),
  syncStatus: text('sync_status').notNull().default('pending').$type<SyncStatus>(),
  lastSyncAt: timestamp('last_sync_at'),
  error: text('error'),
}, (table) => ({
  entityIdx: index('dental_sync_log_entity_idx').on(table.entityType, table.entityId),
  statusIdx: index('dental_sync_log_status_idx').on(table.syncStatus),
  localIdx: index('dental_sync_log_local_idx').on(table.localId),
}));

export type DentalSyncLog = typeof dentalSyncLogs.$inferSelect;
export type NewDentalSyncLog = typeof dentalSyncLogs.$inferInsert;
