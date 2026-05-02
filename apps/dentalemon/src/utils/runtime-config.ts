/**
 * Runtime configuration fetcher for dynamic API URL configuration
 * Allows changing API endpoints without rebuilding the application
 */

// Raw response from /config.json endpoint
interface RawRuntimeConfig {
  api_url?: string
  onesignal_app_id?: string
}

// Final normalized config exposed to account app
export interface RuntimeConfig {
  apiUrl?: string
  onesignalAppId?: string
}

/**
 * Normalize raw runtime config to final RuntimeConfig
 */
function normalizeRuntimeConfig(raw: RawRuntimeConfig): RuntimeConfig {
  return {
    apiUrl: raw.api_url,
    onesignalAppId: raw.onesignal_app_id
  }
}

// In-memory cache for runtime config
let configCache: RuntimeConfig | null = null
let cacheTimestamp = 0
const CACHE_TTL = 30000 // 30 seconds cache TTL

/**
 * Fetches runtime configuration from /config.json with timeout and caching
 * @param timeout - Timeout in milliseconds (default: 2000ms)
 * @returns Promise<RuntimeConfig> - Runtime configuration object
 */
export async function fetchRuntimeConfig(timeout = 2000): Promise<RuntimeConfig> {
  // Check cache first
  const now = Date.now()
  if (configCache && (now - cacheTimestamp) < CACHE_TTL) {
    return configCache
  }

  try {
    // Create fetch with timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    const response = await fetch('/config.json', {
      signal: controller.signal,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const rawConfig: RawRuntimeConfig = await response.json()
    const config = normalizeRuntimeConfig(rawConfig)

    // Cache the successful result
    configCache = config
    cacheTimestamp = now

    console.log('[RuntimeConfig] Fetched runtime config:', config)
    return config

  } catch (error) {
    // Log the error but don't throw - we want to fallback gracefully
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn('[RuntimeConfig] Fetch timeout after', timeout, 'ms, using fallback config')
    } else {
      console.warn('[RuntimeConfig] Failed to fetch runtime config:', error, '- using fallback config')
    }

    // Return empty config to trigger fallback behavior
    return {}
  }
}

/**
 * Clears the runtime config cache (useful for testing or forced refresh)
 */
export function clearRuntimeConfigCache(): void {
  configCache = null
  cacheTimestamp = 0
}
