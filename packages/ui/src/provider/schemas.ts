import { z } from 'zod'

/**
 * Provider Form Schema
 * Validation for provider profile forms
 */

export const providerFormSchema = z.object({
  providerType: z.string().default('general'),
  yearsOfExperience: z.number().int().min(0).max(70).optional(),
  biography: z.string().min(10, 'Biography must be at least 10 characters').max(2000),
})

export type ProviderFormData = z.infer<typeof providerFormSchema>

// Provider type options
export const PROVIDER_TYPES = [
  { value: 'general', label: 'General Provider' },
  { value: 'specialist', label: 'Specialist' },
  { value: 'other', label: 'Other' },
] as const
