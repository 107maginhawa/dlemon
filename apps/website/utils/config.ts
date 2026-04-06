/**
 * Application configuration constants
 */

// API Configuration
export const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:7213'

// Cross-app navigation URLs
export const patientAppUrl = process.env.NEXT_PUBLIC_PATIENT_APP_URL || 'http://localhost:3001'
export const providerAppUrl = process.env.NEXT_PUBLIC_PROVIDER_APP_URL || 'http://localhost:3002'

// Signup URLs
export const patientSignupUrl = process.env.NEXT_PUBLIC_PATIENT_SIGNUP_URL || `${patientAppUrl}/auth/sign-up`
export const providerSignupUrl = process.env.NEXT_PUBLIC_PROVIDER_SIGNUP_URL || `${providerAppUrl}/auth/sign-up`
