import * as z from 'zod'
import { isValidPhoneNumber } from 'react-phone-number-input'
import { differenceInYears } from 'date-fns'

// Personal Information Schema
export const personalInfoSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(50, 'First name must be less than 50 characters'),
  lastName: z.string().min(1, 'Last name is required').max(50, 'Last name must be less than 50 characters'),
  middleName: z.string().max(50, 'Middle name must be less than 50 characters').optional().or(z.literal('')),
  dateOfBirth: z.date({
    message: 'Date of birth is required',
  }).refine((date) => {
    const age = differenceInYears(new Date(), date)
    return age >= 0 && age <= 150
  }, 'Please enter a valid date of birth'),
  gender: z.enum(['male', 'female', 'non-binary', 'other', 'prefer-not-to-say']).optional().or(z.literal('')),
  avatar: z.object({
    file: z.string().optional(),
    url: z.string(),
  }).optional().nullable(),
})

// Address Schema - matches API's primaryAddress structure
export const addressSchema = z.object({
  street1: z.string().min(1, 'Street address is required').max(100, 'Street address must be less than 100 characters'),
  street2: z.string().max(100, 'Street address line 2 must be less than 100 characters').optional().or(z.literal('')),
  city: z.string().min(1, 'City is required').max(50, 'City must be less than 50 characters'),
  state: z.string().min(1, 'State is required').max(50, 'State must be less than 50 characters'),
  postalCode: z.string().min(1, 'Postal code is required').max(20, 'Postal code must be less than 20 characters'),
  country: z.string().length(2, 'Country must be a 2-letter code'),
})

// Optional Address Schema for onboarding
export const optionalAddressSchema = z.object({
  street1: z.string().max(100, 'Street address must be less than 100 characters').optional().or(z.literal('')),
  street2: z.string().max(100, 'Street address line 2 must be less than 100 characters').optional().or(z.literal('')),
  city: z.string().max(50, 'City must be less than 50 characters').optional().or(z.literal('')),
  state: z.string().max(50, 'State must be less than 50 characters').optional().or(z.literal('')),
  postalCode: z.string().max(20, 'Postal code must be less than 20 characters').optional().or(z.literal('')),
  country: z.string().length(2, 'Country must be a 2-letter code').optional().or(z.literal('')),
})

// Contact Info Schema
export const contactInfoSchema = z.object({
  email: z.string().email('Invalid email address').optional(), // Email is typically read-only from auth
  phone: z.string().refine(isValidPhoneNumber, 'Please enter a valid phone number').optional(),
})

// Preferences Schema
export const preferencesSchema = z.object({
  languagesSpoken: z.array(z.string()).min(1, 'At least one language is required'),
  timezone: z.string().min(1, 'Timezone is required'),
})

// Type exports
export type PersonalInfo = z.infer<typeof personalInfoSchema>
export type Address = z.infer<typeof addressSchema>
export type OptionalAddress = z.infer<typeof optionalAddressSchema>
export type ContactInfo = z.infer<typeof contactInfoSchema>
export type Preferences = z.infer<typeof preferencesSchema>
