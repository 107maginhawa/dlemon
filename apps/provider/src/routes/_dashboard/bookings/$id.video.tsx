/**
 * Video Call Route for Appointments
 * 1-on-1 video consultation between provider and patient
 */

import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { VideoCallUI } from '@monobase/ui/comms/components/video-call-ui'
import { requireAuth, requireEmailVerified, requirePerson, composeGuards } from '@/utils/guards'
import { useSession } from '@monobase/sdk/react/hooks/use-auth'
import { Alert, AlertDescription } from "@monobase/ui/components/alert"
import { Button } from "@monobase/ui/components/button"
import { Loader2, AlertCircle } from 'lucide-react'

export const Route = createFileRoute('/_dashboard/bookings/$id/video')({
  beforeLoad: composeGuards(requireAuth, requireEmailVerified, requirePerson),
  component: BookingVideoCall
})

function BookingVideoCall() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const { data: session } = useSession()
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Get session token for WebSocket authentication
    async function getToken() {
      try {
        // Better-auth stores session token in cookies
        // For WebSocket, we need to get it from the cookie
        const cookies = document.cookie.split(';')
        const sessionCookie = cookies.find(c => c.trim().startsWith('better-auth.session_token='))

        if (sessionCookie) {
          const cookieToken = sessionCookie.split('=')[1]
          setToken(cookieToken || null)
        } else if (session?.session) {
          // Fallback: try to get from session object
          setToken((session.session as any).token || null)
        } else {
          throw new Error('No session token found')
        }

        setIsLoading(false)
      } catch (err) {
        console.error('Failed to get session token:', err)
        setError('Failed to authenticate. Please refresh and try again.')
        setIsLoading(false)
      }
    }

    getToken()
  }, [])

  const handleEndCall = () => {
    navigate({ to: '/bookings' })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Initializing video call...</p>
        </div>
      </div>
    )
  }

  if (error || !token) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="max-w-md w-full">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error || 'Failed to start video call'}
            </AlertDescription>
          </Alert>
          <Button
            onClick={() => navigate({ to: '/bookings' })}
            className="w-full mt-4"
          >
            Back to Bookings
          </Button>
        </div>
      </div>
    )
  }

  return (
    <VideoCallUI
      {...({
        roomId: id,
        token: token,
        isProvider: true,
        onEndCall: handleEndCall,
      } as any)}
    />
  )
}
