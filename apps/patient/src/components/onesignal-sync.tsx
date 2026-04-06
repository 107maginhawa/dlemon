import { useEffect } from 'react'
import { useSession } from '@monobase/sdk/react/hooks/use-auth'
import { setOneSignalUserId, clearOneSignalUserId } from '@/services/onesignal'

/**
 * OneSignal User ID Sync Component
 * 
 * Synchronizes the authenticated user's ID with OneSignal for push notifications.
 * Must be placed inside QueryClientProvider and AuthQueryProvider to use useSession().
 */
export function OneSignalSync() {
  const { data: session } = useSession()

  useEffect(() => {
    if (session?.user?.id) {
      // User is logged in - set OneSignal user ID
      setOneSignalUserId(session.user.id)
    } else {
      // User is logged out - clear OneSignal user ID
      clearOneSignalUserId()
    }
  }, [session?.user?.id])

  // This component doesn't render anything
  return null
}
