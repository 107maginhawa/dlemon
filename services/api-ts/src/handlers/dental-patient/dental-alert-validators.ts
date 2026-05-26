import { z } from 'zod';
import { DENTAL_ALERT_TYPES, DENTAL_ALERT_SEVERITIES } from './repos/dental-alert.schema';

export const DentalAlertParams = z.object({
  patientId: z.string().uuid(),
});

export const DentalAlertIdParams = z.object({
  patientId: z.string().uuid(),
  alertId: z.string().uuid(),
});

export const CreateDentalAlertBody = z.object({
  alertType: z.enum(DENTAL_ALERT_TYPES),
  severity: z.enum(DENTAL_ALERT_SEVERITIES).optional(),
  description: z.string().optional(),
});

export const UpdateDentalAlertBody = z.object({
  alertType: z.enum(DENTAL_ALERT_TYPES).optional(),
  severity: z.enum(DENTAL_ALERT_SEVERITIES).optional(),
  description: z.string().optional(),
  active: z.boolean().optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'At least one field required' });
