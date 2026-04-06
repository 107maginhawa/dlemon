import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { XCircle, Loader2, AlertTriangle } from 'lucide-react'
import { Button } from '@monobase/ui/components/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@monobase/ui/components/card'
import { Alert, AlertDescription } from '@monobase/ui/components/alert'

export const Route = createFileRoute('/booking/payment/cancel')({
  component: PaymentCancelPage,
})

function PaymentCancelPage() {
  const navigate = useNavigate()
  const [appointmentId, setAppointmentId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Retrieve the appointment ID from sessionStorage
    const pendingAppointmentId = sessionStorage.getItem('pending_appointment_id')

    if (pendingAppointmentId) {
      setAppointmentId(pendingAppointmentId)
      // Keep in sessionStorage in case user wants to retry payment
    }

    setIsLoading(false)
  }, [])

  const handleRetryPayment = () => {
    if (appointmentId) {
      navigate({
        to: '/booking/$appointmentId/details',
        params: { appointmentId },
        replace: true
      })
    }
  }

  const handleViewAppointments = () => {
    // Clean up sessionStorage since user is abandoning payment
    sessionStorage.removeItem('pending_appointment_id')

    navigate({
      to: '/dashboard/appointments',
      replace: true
    })
  }

  const handleBackToProviders = () => {
    // Clean up sessionStorage
    sessionStorage.removeItem('pending_appointment_id')

    navigate({
      to: '/dashboard/providers',
      replace: true
    })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardContent className="p-8">
            <div className="flex items-center justify-center space-x-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-muted-foreground">Loading...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100">
            <XCircle className="h-10 w-10 text-yellow-600" />
          </div>
          <CardTitle className="text-2xl">Payment Cancelled</CardTitle>
          <CardDescription>
            You cancelled the payment process
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert variant="destructive" className="bg-yellow-50 border-yellow-200 text-yellow-900">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Your appointment has been created but is <strong>pending payment</strong>.
              You'll need to complete payment to confirm your appointment.
            </AlertDescription>
          </Alert>

          <div className="text-sm text-muted-foreground text-center space-y-2">
            <p>Your appointment slot is temporarily reserved.</p>
            <p>Please complete payment within 24 hours to confirm your booking.</p>
          </div>

          <div className="space-y-3 pt-2">
            {appointmentId && (
              <Button
                onClick={handleRetryPayment}
                className="w-full"
                size="lg"
              >
                Complete Payment Now
              </Button>
            )}
            <Button
              onClick={handleViewAppointments}
              variant="outline"
              className="w-full"
              size="lg"
            >
              View My Appointments
            </Button>
            <Button
              onClick={handleBackToProviders}
              variant="ghost"
              className="w-full"
              size="lg"
            >
              Back to Providers
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
