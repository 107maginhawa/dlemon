import { z } from 'zod';
import { RECALL_TYPES, RECALL_STATUSES } from './repos/recall.schema';

export const RecallParams = z.object({
  patientId: z.string().uuid(),
});

export const RecallRecallParams = z.object({
  patientId: z.string().uuid(),
  recallId: z.string().uuid(),
});

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const CreateRecallBody = z.object({
  type: z.enum(RECALL_TYPES),
  dueDate: z.string().regex(ISO_DATE, 'dueDate must be YYYY-MM-DD'),
  notes: z.string().optional(),
});

export const UpdateRecallBody = z.object({
  type: z.enum(RECALL_TYPES).optional(),
  dueDate: z.string().regex(ISO_DATE, 'dueDate must be YYYY-MM-DD').optional(),
  status: z.enum(RECALL_STATUSES).optional(),
  notes: z.string().optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'At least one field required' });
