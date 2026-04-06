import { createFileRoute, Link } from '@tanstack/react-router'
import { formatDate } from '@monobase/ui/lib/format-date'
import {
  Calendar,
  Clock,
  MapPin,
  Video,
  Phone,
  MoreVertical,
  Loader2,
  AlertCircle,
  X,
} from 'lucide-react'
import { useListBookings, useCancelBooking } from '@monobase/sdk/react/hooks/use-booking'
import type { Appointment, LocationType } from '@monobase/sdk/types'
import { Button } from '@monobase/ui/components/button'
import {
  Card,
  CardContent,
} from '@monobase/ui/components/card'
import { Badge } from '@monobase/ui/components/badge'
import { Avatar, AvatarFallback } from '@monobase/ui/components/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@monobase/ui/components/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@monobase/ui/components/alert-dialog'
import { useState } from 'react'

export const Route = createFileRoute('/_dashboard/appointments/pending')({
  component: PendingAppointmentsPage,
})

// Helper functions
function getTypeIcon(type: LocationType) {
  switch (type) {
    case 'video':
      return <Video className="h-4 w-4" />
    case 'phone':
      return <Phone className="h-4 w-4" />
    default:
      return <MapPin className="h-4 w-4" />
  }
}

function getTypeLabel(type: LocationType): string {
  switch (type) {
    case 'video':
      return 'Video Call'
    case 'phone':
      return 'Phone Call'
    case 'in-person':
      return 'In-Person'
    default:
      return 'In-Person'
  }
}

function PendingAppointmentsPage() {
  // Fetch pending appointments
  const {
    data: pendingData,
    isLoading,
    error,
  } = useListBookings({
    status: 'pending',
    expand: 'provider,provider.person',
    sort: 'scheduledAt',
  })

  const cancelAppointmentMutation = useCancelBooking()

  const pendingAppointments = pendingData?.data || []

  // Dialog state for cancel confirmation
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [appointmentToCancel, setAppointmentToCancel] = useState<string | null>(null)

  const handleCancelClick = (appointmentId: string) => {
    setAppointmentToCancel(appointmentId)
    setCancelDialogOpen(true)
  }

  const handleConfirmCancel = () => {
    if (appointmentToCancel) {
      cancelAppointmentMutation.mutate({
        id: appointmentToCancel,
        reason: 'Cancelled by patient',
      })
      setCancelDialogOpen(false)
      setAppointmentToCancel(null)
    }
  }

  // Appointment card renderer
  const renderAppointmentCard = (appointment: Appointment) => {
    const provider = typeof appointment.provider === 'object' ? appointment.provider : null
    const providerName = provider
      ? `${provider.person.firstName} ${provider.person.lastName}`
      : 'Provider'
    const providerInitials = provider
      ? `${provider.person.firstName[0]}${provider.person.lastName[0]}`
      : 'P'

    const scheduledDate = new Date(appointment.scheduledAt)
    const dateStr = formatDate(scheduledDate, { format: 'medium' })
    const timeStr = formatDate(scheduledDate, { format: 'time' })

    return (
      <Card key={appointment.id} className="border-orange-200 bg-orange-50/30">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex gap-4">
              <Avatar className="h-12 w-12">
                <AvatarFallback>{providerInitials}</AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <div>
                  <p className="font-semibold">{providerName}</p>
                  <p className="text-sm text-muted-foreground">
                    {provider?.providerType || 'Healthcare Provider'}
                  </p>
                </div>
                <div className="flex flex-col gap-1 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3 w-3 text-muted-foreground" />
                    <span>{dateStr}</span>
                    <Clock className="h-3 w-3 text-muted-foreground ml-2" />
                    <span>{timeStr}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {getTypeIcon(appointment.locationType)}
                    <span>{getTypeLabel(appointment.locationType)}</span>
                  </div>
                </div>
                <Badge
                  variant="default"
                  className="bg-orange-100 text-orange-800 border-orange-200 w-fit"
                >
                  <AlertCircle className="h-2 w-2 mr-1" />
                  Awaiting Confirmation
                </Badge>
              </div>
            </div>
            <div className="flex gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="ghost">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link
                      to="/booking/$appointmentId/details"
                      params={{ appointmentId: appointment.id }}
                    >
                      View Details
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-red-600"
                    onClick={() => handleCancelClick(appointment.id)}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Cancel Request
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Loading State
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Error State
  if (error) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <p className="text-destructive mb-4">Failed to load pending appointments</p>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Empty State
  if (pendingAppointments.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No pending appointments</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <div className="space-y-4">
        {pendingAppointments.map((appointment) => renderAppointmentCard(appointment))}
      </div>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Request?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this appointment request? The provider will be
              notified and you will need to submit a new request if you change your mind.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setAppointmentToCancel(null)}>
              Keep Request
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmCancel}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Cancel Request
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
