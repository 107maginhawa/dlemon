import { z } from 'zod';
import { SYNC_STATUSES } from '../repos/sync-log.schema';

export const SyncLogParams = z.object({});

export const SyncLogIdParams = z.object({
  logId: z.string().uuid(),
});

export const CreateSyncLogBody = z.object({
  localId: z.string().min(1),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  serverId: z.string().optional(),
  branchId: z.string().optional(),
});

export const UpdateSyncLogBody = z.object({
  syncStatus: z.enum(SYNC_STATUSES).optional(),
  serverId: z.string().optional(),
  error: z.string().optional(),
  version: z.number().int().optional(),
}).refine((d) => Object.keys(d).filter(k => k !== 'version').length > 0, { message: 'At least one field required' });
