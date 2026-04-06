import { createFileRoute } from '@tanstack/react-router'
import { formatDate } from '@monobase/ui/lib/format-date'
import {
  Calendar,
  Clock,
  MapPin,
  Video,
  Phone,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { useListBookings } from '@monobase/sdk/react/hooks/use-booking'
import type { Appointment, LocationType, AppointmentStatus } from '@monobase/sdk/types'
import { Button } from '@monobase/ui/components/button'
import {
  Card,
  CardContent,
} from '@monobase/ui/components/card'
import { Badge } from '@monobase/ui/components/badge'
import { Avatar, AvatarFallback } from '@monobase/ui/components/avatar'

export const Route = createFileRoute('/_dashboard/appointments/past')({
  component: PastAppointmentsPage,
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

function getStatusBadge(status: AppointmentStatus) {
  switch (status) {
    case 'completed':
      return { variant: 'secondary' as const, label: 'Completed' }
    case 'cancelled':
      return { variant: 'destructive' as const, label: 'Cancelled' }
    case 'rejected':
      return { variant: 'destructive' as const, label: 'Rejected' }
    case 'no_show_client':
      return { variant: 'destructive' as const, label: 'No Show' }
    case 'no_show_provider':
      return { variant: 'destructive' as const, label: 'Provider No Show' }
    default:
      return { variant: 'secondary' as const, label: status }
  }
}

function PastAppointmentsPage() {
  // Fetch all past appointment statuses separately
  const { data: completedData, isLoading: isLoadingCompleted, error: completedError } =
    useListBookings({ status: 'completed', expand: 'provider,provider.person' })
  const { data: cancelledData, isLoading: isLoadingCancelled, error: cancelledError } =
    useListBookings({ status: 'cancelled', expand: 'provider,provider.person' })
  const { data: rejectedData, isLoading: isLoadingRejected, error: rejectedError } =
    useListBookings({ status: 'rejected', expand: 'provider,provider.person' })
  const { data: noShowClientData, isLoading: isLoadingNoShowClient, error: noShowClientError } =
    useListBookings({ status: 'no_show_client', expand: 'provider,provider.person' })
  const { data: noShowProviderData, isLoading: isLoadingNoShowProvider, error: noShowProviderError } =
    useListBookings({ status: 'no_show_provider', expand: 'provider,provider.person' })

  const isLoading =
    isLoadingCompleted ||
    isLoadingCancelled ||
    isLoadingRejected ||
    isLoadingNoShowClient ||
    isLoadingNoShowProvider
  const error =
    completedError ||
    cancelledError ||
    rejectedError ||
    noShowClientError ||
    noShowProviderError

  // Combine and sort appointments by date (most recent first)
  const pastAppointments = [
    ...(completedData?.data || []),
    ...(cancelledData?.data || []),
    ...(rejectedData?.data || []),
    ...(noShowClientData?.data || []),
    ...(noShowProviderData?.data || []),
  ].sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime())

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
      <Card key={appointment.id}>
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
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
                  <Badge
                    variant={getStatusBadge(appointment.status).variant}
                    className="w-fit"
                  >
                    {getStatusBadge(appointment.status).label}
                  </Badge>
                  {appointment.cancellationReason && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Reason: {appointment.cancellationReason}
                    </p>
                  )}
                </div>
              </div>
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
          <p className="text-destructive mb-4">Failed to load past appointments</p>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Empty State
  if (pastAppointments.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No past appointments</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {pastAppointments.map((appointment) => renderAppointmentCard(appointment))}
    </div>
  )
}
