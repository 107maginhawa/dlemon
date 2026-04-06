import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { addMinutes } from 'date-fns'
import { Button } from '@monobase/ui/components/button'
import { Card, CardContent } from '@monobase/ui/components/card'
import { Alert, AlertDescription } from '@monobase/ui/components/alert'
import { ActiveBookingCard } from '@monobase/ui/booking/components/active-booking-card'
import type { ActiveBooking, BookingUser } from '@monobase/ui/booking/types'
import { useBooking, useCancelBooking, useConfirmBooking } from '@monobase/sdk/react/hooks/use-booking'
import { useSession } from '@monobase/sdk/react/hooks/use-auth'
import { useInitiatePayment } from '@monobase/sdk/react/hooks/use-billing'
import { formatDate } from '@monobase/ui/lib/format-date'

export const Route = createFileRoute('/booking/$appointmentId/details')({
  component: BookingDetailsPage,
})

function BookingDetailsPage() {
  const { appointmentId } = Route.useParams()
  const navigate = useNavigate()
  const { data: session } = useSession()

  // Use real API hooks
  const {
    data: appointment,
    isLoading: isLoadingAppointment,
    error: appointmentError
  } = useBooking(appointmentId)

  const cancelAppointmentMutation = useCancelBooking()
  const confirmAppointmentMutation = useConfirmBooking()
  const initiatePaymentMutation = useInitiatePayment()

  const handlePaymentClick = async () => {
    if (!appointment?.invoice) return

    try {
      // Build return URLs with appointmentId in query params
      const baseUrl = window.location.origin
      const successUrl = `${baseUrl}/booking/${appointment.id}/details?payment=success`
      const cancelUrl = `${baseUrl}/booking/${appointment.id}/details?payment=cancelled`

      // Initiate payment - this will redirect to checkout URL
      await initiatePaymentMutation.mutateAsync({
        invoiceId: appointment.invoice,
        successUrl,
        cancelUrl,
        metadata: {
          appointmentId: appointment.id,
          source: 'appointment_details'
        }
      })
    } catch (error) {
      console.error('Failed to initiate payment', error)
      // Error toast is handled by the mutation hook
    }
  }

  const handleCancelClick = async () => {
    if (!appointment) return

    try {
      await cancelAppointmentMutation.mutateAsync({
        appointmentId: appointment.id,
        reason: 'Cancelled by patient'
      })
      navigate({ to: '/appointments', replace: true })
    } catch (error) {
      console.error('Failed to cancel appointment', error)
    }
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">Please sign in to continue with payment</p>
              <Button 
                onClick={() => navigate({ to: '/auth/sign-in' })}
                className="mt-4"
              >
                Sign In
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (isLoadingAppointment) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <Card>
            <CardContent className="p-8">
              <div className="flex items-center justify-center space-x-2">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="text-muted-foreground">Loading appointment details...</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (!appointment || appointmentError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <Card>
            <CardContent className="p-8 text-center">
              <Alert variant="destructive">
                <AlertDescription>
                  {appointmentError || 'Appointment not found'}
                </AlertDescription>
              </Alert>
              <Button onClick={() => navigate({ to: '/appointments' })} className="mt-4">
                View My Appointments
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Convert Appointment to ActiveBooking format for the ActiveBookingCard
  const activeBooking: ActiveBooking = {
    id: appointment.id,
    providerId: appointment.provider,
    providerName: appointment.providerName || 'Provider',
    date: appointment.scheduledAt.split('T')[0],
    startTime: appointment.scheduledAt,
    endTime: formatDate(addMinutes(new Date(appointment.scheduledAt), appointment.durationMinutes || 30), { format: 'iso' }),
    price: appointment.price || 0,
    paymentStatus: (appointment.paymentStatus || 'unpaid') as 'unpaid' | 'paid',
    status: appointment.status as 'pending' | 'confirmed' | 'rejected' | 'cancelled' | 'completed' | 'no_show_client' | 'no_show_provider',
    bookingTimestamp: appointment.bookedAt ? new Date(appointment.bookedAt).getTime() : Date.now(),
    cancellationReason: appointment.cancellationReason,
    rejectionReason: appointment.cancellationReason, // API uses cancellationReason for both
    invoice: appointment.invoice
  }

  // Create a BookingUser object from session
  const bookingUser: BookingUser = {
    id: session?.user?.id || '',
    role: session?.user?.role
  }

  const handleProfileClick = () => {
    navigate({ to: '/settings/account' })
  }

  const handleBrowseProviders = () => {
    navigate({ to: '/providers' })
  }

  const handleViewAppointments = () => {
    navigate({ to: '/appointments' })
  }

  // After payment completes, show success state with View Appointments button
  if (appointment.paymentStatus === 'paid') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-lg w-full">
          <ActiveBookingCard
            booking={activeBooking}
            user={bookingUser}
            onPaymentClick={handlePaymentClick}
            onCancelClick={handleCancelClick}
            onProfileClick={handleProfileClick}
          />
          {/* Add View My Appointments button below the widget when payment is complete */}
          <div className="mt-4">
            <Button
              onClick={handleViewAppointments}
              className="w-full"
              size="lg"
            >
              View My Appointments
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        <ActiveBookingCard
          booking={activeBooking}
          user={bookingUser}
          onPaymentClick={handlePaymentClick}
          onCancelClick={handleCancelClick}
          onProfileClick={handleProfileClick}
          onBrowseProviders={handleBrowseProviders}
          onViewAppointments={handleViewAppointments}
        />
      </div>
    </div>
  )
}
