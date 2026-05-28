/**
 * Application configuration constants
 */

// API Configuration - Build-time fallback values
export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:7213'
export const onesignalAppId = import.meta.env.VITE_ONESIGNAL_APP_ID || ''

/**
 * Get runtime configuration with fallbacks to build-time env vars
 * This is the recommended way to get config values in production
 */
export async function getRuntimeConfig() {
  const { fetchRuntimeConfig } = await import('./runtime-config')
  const runtimeConfig = await fetchRuntimeConfig(2000)
  
  return {
    apiUrl: runtimeConfig.apiUrl || apiBaseUrl,
    onesignalAppId: runtimeConfig.onesignalAppId || onesignalAppId
  }
}
