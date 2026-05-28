import { z } from 'zod';
import { TASK_TYPES, TASK_STATUSES } from '../repos/task.schema';

export const TaskParams = z.object({
  patientId: z.string().uuid(),
});

export const TaskTaskParams = z.object({
  patientId: z.string().uuid(),
  taskId: z.string().uuid(),
});

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const CreateTaskBody = z.object({
  title: z.string().min(1, 'title is required'),
  taskType: z.enum(TASK_TYPES),
  description: z.string().optional(),
  dueDate: z.string().regex(ISO_DATE, 'dueDate must be YYYY-MM-DD').optional(),
  assignedTo: z.string().uuid().optional(),
});

export const UpdateTaskBody = z.object({
  title: z.string().min(1).optional(),
  taskType: z.enum(TASK_TYPES).optional(),
  description: z.string().optional(),
  dueDate: z.string().regex(ISO_DATE, 'dueDate must be YYYY-MM-DD').optional(),
  assignedTo: z.string().uuid().optional(),
  status: z.enum(TASK_STATUSES).optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'At least one field required' });
