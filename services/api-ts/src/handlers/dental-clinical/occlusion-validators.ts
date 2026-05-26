import { z } from 'zod';
import { OCCLUSION_CLASSES } from './repos/occlusion-screening.schema';

export const OcclusionParams = z.object({
  patientId: z.string().uuid(),
});

export const OcclusionIdParams = z.object({
  patientId: z.string().uuid(),
  screeningId: z.string().uuid(),
});

export const CreateOcclusionBody = z.object({
  angleClass: z.enum(OCCLUSION_CLASSES).optional(),
  overbiteMm: z.number().int().optional(),
  overjetMm: z.number().int().optional(),
  crossbite: z.boolean().optional(),
  crowding: z.boolean().optional(),
  spacing: z.boolean().optional(),
  midlineDeviation: z.string().optional(),
  visitId: z.string().uuid().optional(),
  notes: z.string().optional(),
});

export const UpdateOcclusionBody = z.object({
  angleClass: z.enum(OCCLUSION_CLASSES).optional(),
  overbiteMm: z.number().int().optional(),
  overjetMm: z.number().int().optional(),
  crossbite: z.boolean().optional(),
  crowding: z.boolean().optional(),
  spacing: z.boolean().optional(),
  midlineDeviation: z.string().optional(),
  visitId: z.string().uuid().optional(),
  notes: z.string().optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'At least one field required' });
