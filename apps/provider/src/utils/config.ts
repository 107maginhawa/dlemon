/**
 * Application Configuration
 * Reads environment variables and provides typed configuration
 */

// API Base URL
export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:7213'

// OneSignal Configuration
export const oneSignalAppId = import.meta.env.VITE_ONESIGNAL_APP_ID
export const oneSignalAppTag = import.meta.env.VITE_ONESIGNAL_APP_TAG || 'provider'

// Environment
export const isDevelopment = import.meta.env.DEV
export const isProduction = import.meta.env.PROD
