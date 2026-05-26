import { z } from 'zod';
import { QUEUE_ITEM_STATUSES } from './repos/queue-item.schema';

export const QueueItemAppointmentParams = z.object({
  appointmentId: z.string().uuid(),
});

export const QueueItemIdParams = z.object({
  itemId: z.string().uuid(),
});

export const QueueBoardParams = z.object({
  branchId: z.string().uuid(),
});

export const CreateQueueItemBody = z.object({
  notes: z.string().optional(),
});

export const UpdateQueueItemStatusBody = z.object({
  status: z.enum(QUEUE_ITEM_STATUSES),
  notes: z.string().optional(),
});
