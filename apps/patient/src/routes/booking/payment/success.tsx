import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { CheckCircle, Loader2, Calendar } from 'lucide-react'
import { Button } from '@monobase/ui/components/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@monobase/ui/components/card'
import { Alert, AlertDescription } from '@monobase/ui/components/alert'

export const Route = createFileRoute('/booking/payment/success')({
  component: PaymentSuccessPage,
})

function PaymentSuccessPage() {
  const navigate = useNavigate()
  const [appointmentId, setAppointmentId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Retrieve the appointment ID from sessionStorage
    const pendingAppointmentId = sessionStorage.getItem('pending_appointment_id')

    if (pendingAppointmentId) {
      setAppointmentId(pendingAppointmentId)
      // Clean up sessionStorage
      sessionStorage.removeItem('pending_appointment_id')
    }

    setIsLoading(false)
  }, [])

  const handleViewAppointment = () => {
    if (appointmentId) {
      navigate({
        to: '/booking/$appointmentId/details',
        params: { appointmentId },
        replace: true
      })
    }
  }

  const handleViewAllAppointments = () => {
    navigate({
      to: '/dashboard/appointments',
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
              <span className="text-muted-foreground">Processing payment confirmation...</span>
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
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle className="h-10 w-10 text-green-600" />
          </div>
          <CardTitle className="text-2xl">Payment Successful!</CardTitle>
          <CardDescription>
            Your payment has been processed successfully
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert className="bg-green-50 border-green-200">
            <Calendar className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-900">
              Your appointment has been confirmed. You will receive a confirmation email shortly with appointment details.
            </AlertDescription>
          </Alert>

          <div className="text-sm text-muted-foreground text-center space-y-1">
            <p>A receipt has been sent to your email.</p>
            <p>You can view your appointment details anytime from your dashboard.</p>
          </div>

          <div className="space-y-3 pt-2">
            {appointmentId && (
              <Button
                onClick={handleViewAppointment}
                className="w-full"
                size="lg"
              >
                View Appointment Details
              </Button>
            )}
            <Button
              onClick={handleViewAllAppointments}
              variant={appointmentId ? "outline" : "default"}
              className="w-full"
              size="lg"
            >
              Go to My Appointments
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
