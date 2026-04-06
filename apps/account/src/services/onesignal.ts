/**
 * OneSignal Push Notification Service
 * Handles initialization and management of push notifications for the provider app
 *
 * All functions are safe to call whether OneSignal is configured or not.
 * If VITE_ONESIGNAL_APP_ID is not set, all functions become no-ops.
 *
 * Optional: Set VITE_ONESIGNAL_APP_TAG to tag this app instance for targeted notifications.
 * Example: VITE_ONESIGNAL_APP_TAG=provider
 */

import OneSignal from 'react-onesignal';

/**
 * OneSignal configuration
 */
interface OneSignalConfig {
  appId: string;
  allowLocalhostAsSecureOrigin?: boolean;
}

/**
 * Track whether OneSignal is initialized
 */
let isInitialized = false;

/**
 * Get OneSignal App ID from environment
 */
function getOneSignalAppId(): string | undefined {
  return import.meta.env.VITE_ONESIGNAL_APP_ID;
}

/**
 * Get optional app tag from environment
 * Used to differentiate this app instance for targeted notifications
 */
function getOneSignalAppTag(): string | undefined {
  return import.meta.env.VITE_ONESIGNAL_APP_TAG;
}

/**
 * Check if OneSignal is enabled and initialized
 */
export function isOneSignalEnabled(): boolean {
  return isInitialized;
}

/**
 * Initialize OneSignal SDK
 * Should be called once when the app starts
 */
export async function initializeOneSignal(): Promise<void> {
  const appId = getOneSignalAppId();

  if (!appId) {
    console.warn('OneSignal App ID not configured. Push notifications will not be available.');
    return;
  }

  try {
    await OneSignal.init({
      appId,
      allowLocalhostAsSecureOrigin: import.meta.env.DEV, // Allow localhost in development
      notifyButton: {
        enable: false, // We'll handle permission requests manually
      },
    });

    isInitialized = true;
    console.log('OneSignal initialized successfully');

    // Set optional app tag if configured
    const appTag = getOneSignalAppTag();
    if (appTag) {
      try {
        await OneSignal.User.addTag('app', appTag);
        console.log('OneSignal app tag set:', appTag);
      } catch (tagError) {
        console.error('Failed to set OneSignal app tag:', tagError);
      }
    }
  } catch (error) {
    console.error('Failed to initialize OneSignal:', error);
  }
}

/**
 * Set external user ID (link OneSignal to authenticated user)
 * Call this after user logs in
 */
export async function setOneSignalUserId(userId: string): Promise<void> {
  if (!isInitialized) return;

  try {
    await OneSignal.login(userId);
    console.log('OneSignal user ID set:', userId);
  } catch (error) {
    console.error('Failed to set OneSignal user ID:', error);
  }
}

/**
 * Clear external user ID
 * Call this when user logs out
 */
export async function clearOneSignalUserId(): Promise<void> {
  if (!isInitialized) return;

  try {
    await OneSignal.logout();
    console.log('OneSignal user ID cleared');
  } catch (error) {
    console.error('Failed to clear OneSignal user ID:', error);
  }
}

/**
 * Request permission for push notifications
 * Returns true if permission was granted
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!isInitialized) return false;

  try {
    const permission = await OneSignal.Notifications.requestPermission();
    return permission;
  } catch (error) {
    console.error('Failed to request notification permission:', error);
    return false;
  }
}

/**
 * Check if user has granted notification permission
 */
export async function hasNotificationPermission(): Promise<boolean> {
  if (!isInitialized) return false;

  try {
    const permission = await OneSignal.Notifications.permission;
    return permission;
  } catch (error) {
    console.error('Failed to check notification permission:', error);
    return false;
  }
}

/**
 * Opt in to push notifications
 */
export async function optInToNotifications(): Promise<void> {
  if (!isInitialized) return;

  try {
    await OneSignal.User.PushSubscription.optIn();
    console.log('Opted in to push notifications');
  } catch (error) {
    console.error('Failed to opt in to notifications:', error);
  }
}

/**
 * Opt out of push notifications
 */
export async function optOutOfNotifications(): Promise<void> {
  if (!isInitialized) return;

  try {
    await OneSignal.User.PushSubscription.optOut();
    console.log('Opted out of push notifications');
  } catch (error) {
    console.error('Failed to opt out of notifications:', error);
  }
}

/**
 * Check if user is subscribed to push notifications
 */
export async function isSubscribedToNotifications(): Promise<boolean> {
  if (!isInitialized) return false;

  try {
    const id = await OneSignal.User.PushSubscription.id;
    return !!id;
  } catch (error) {
    console.error('Failed to check notification subscription:', error);
    return false;
  }
}

/**
 * Add a notification click handler
 * Called when user clicks on a notification
 */
export function onNotificationClick(handler: (event: any) => void): void {
  if (!isInitialized) return;
  OneSignal.Notifications.addEventListener('click', handler);
}

/**
 * Add a notification received handler
 * Called when a notification is received while app is open
 */
export function onNotificationReceived(handler: (event: any) => void): void {
  if (!isInitialized) return;
  OneSignal.Notifications.addEventListener('foregroundWillDisplay', handler);
}

/**
 * Remove notification event listeners
 */
export function removeNotificationListeners(): void {
  if (!isInitialized) return;
  OneSignal.Notifications.removeEventListener('click');
  OneSignal.Notifications.removeEventListener('foregroundWillDisplay');
}
