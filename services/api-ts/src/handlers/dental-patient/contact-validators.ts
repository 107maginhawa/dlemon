import { z } from 'zod';

export const PatientContactParams = z.object({
  patientId: z.string().uuid('patientId must be a UUID'),
});

export const PatientContactContactParams = z.object({
  patientId: z.string().uuid('patientId must be a UUID'),
  contactId: z.string().uuid('contactId must be a UUID'),
});

export const CreatePatientContactBody = z.object({
  name: z.string().trim().min(1, 'name is required and cannot be blank'),
  relationship: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  isGuardian: z.boolean().default(false),
  isEmergencyContact: z.boolean().default(false),
  notes: z.string().optional(),
});

export const UpdatePatientContactBody = z.object({
  name: z.string().trim().min(1, 'name cannot be blank').optional(),
  relationship: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  isGuardian: z.boolean().optional(),
  isEmergencyContact: z.boolean().optional(),
  notes: z.string().nullable().optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided for update' },
);

export type CreatePatientContactInput = z.infer<typeof CreatePatientContactBody>;
export type UpdatePatientContactInput = z.infer<typeof UpdatePatientContactBody>;
