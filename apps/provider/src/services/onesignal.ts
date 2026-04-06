/**
 * OneSignal Push Notification Service
 * 
 * Initializes OneSignal for browser push notifications
 * Configuration from environment variables
 */

import OneSignal from 'react-onesignal'
import { oneSignalAppId, oneSignalAppTag } from '@/utils/config'

/**
 * Initialize OneSignal
 * Call this once at app startup
 */
export async function initializeOneSignal() {
  // Only initialize if app ID is configured
  if (!oneSignalAppId) {
    console.info('OneSignal app ID not configured - push notifications disabled')
    return
  }

  try {
    await OneSignal.init({
      appId: oneSignalAppId,
      allowLocalhostAsSecureOrigin: true, // Enable for local development
    })

    // Add app tag if configured (optional - for app-specific notifications)
    if (oneSignalAppTag) {
      await OneSignal.User.addTag('app', oneSignalAppTag)
      console.info(`OneSignal initialized with app tag: ${oneSignalAppTag}`)
    } else {
      console.info('OneSignal initialized')
    }
  } catch (error) {
    console.error('Failed to initialize OneSignal:', error)
  }
}

/**
 * Set OneSignal external user ID
 * This should be called when user logs in to sync their person ID
 */
export async function setOneSignalUserId(personId: string) {
  if (!oneSignalAppId) return

  try {
    await OneSignal.login(personId)
    console.info(`OneSignal user ID set: ${personId}`)
  } catch (error) {
    console.error('Failed to set OneSignal user ID:', error)
  }
}

/**
 * Clear OneSignal external user ID
 * This should be called when user logs out
 */
export async function clearOneSignalUserId() {
  if (!oneSignalAppId) return

  try {
    await OneSignal.logout()
    console.info('OneSignal user ID cleared')
  } catch (error) {
    console.error('Failed to clear OneSignal user ID:', error)
  }
}
