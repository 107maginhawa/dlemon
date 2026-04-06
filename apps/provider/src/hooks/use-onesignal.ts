/**
 * OneSignal Sync Hook
 * 
 * Automatically syncs OneSignal user ID with authenticated user's person ID
 * Call this hook once at app root level
 */

import { useEffect } from 'react'
import { useSession } from '@monobase/sdk/react/hooks/use-auth'
import { useMyPerson } from '@monobase/sdk/react/hooks/use-person'
import { setOneSignalUserId, clearOneSignalUserId } from '@/services/onesignal'

export function useOneSignal() {
  const { data: session } = useSession()
  const { data: person } = useMyPerson()

  useEffect(() => {
    // If user is authenticated and has a person profile, set OneSignal user ID
    if (session?.user && person?.id) {
      setOneSignalUserId(person.id)
    } else {
      // If user is not authenticated, clear OneSignal user ID
      clearOneSignalUserId()
    }
  }, [session?.user, person?.id])
}
