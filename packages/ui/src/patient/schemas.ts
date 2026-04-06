import { z } from 'zod'

// Primary Care Provider Schema
export const primaryProviderSchema = z.object({
  hasProvider: z.boolean(),
  name: z.string().optional(),
  specialty: z.string().optional(),
  phone: z.string().optional(),
  fax: z.string().optional(),
}).refine((data) => {
  // If hasProvider is true, name should be required
  if (data.hasProvider) {
    return data.name && data.name.trim().length > 0
  }
  return true
}, {
  message: "Provider name is required when you have a provider",
  path: ["name"]
})

// Primary Pharmacy Schema
export const primaryPharmacySchema = z.object({
  hasPharmacy: z.boolean(),
  name: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  fax: z.string().optional(),
}).refine((data) => {
  // If hasPharmacy is true, name should be required
  if (data.hasPharmacy) {
    return data.name && data.name.trim().length > 0
  }
  return true
}, {
  message: "Pharmacy name is required when you have a pharmacy",
  path: ["name"]
})

// Form type exports (include hasProvider/hasPharmacy flags)
export type PrimaryProviderData = z.infer<typeof primaryProviderSchema>
export type PrimaryPharmacyData = z.infer<typeof primaryPharmacySchema>

// API-specific types (for direct API communication, without UI flags)
export interface PrimaryProvider {
  name: string
  specialty?: string | null
  phone?: string | null
  fax?: string | null
}

export interface PrimaryPharmacy {
  name: string
  phone?: string | null
  address?: string | null
  fax?: string | null
}
