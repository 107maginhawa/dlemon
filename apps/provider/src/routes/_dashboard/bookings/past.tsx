import { createFileRoute } from '@tanstack/react-router'
import {
  Calendar,
  Clock,
  Video,
  Phone,
  MapPin,
  AlertCircle,
  Loader2
} from 'lucide-react'
import { useListBookings } from '@monobase/sdk/react/hooks/use-booking'
import { parseISO } from 'date-fns'

type LocationType = 'video' | 'phone' | 'in-person'
type AppointmentStatus = 'completed' | 'cancelled' | 'rejected' | 'no_show_client' | 'no_show_provider'
import { formatDate } from '@monobase/ui/lib/format-date'
import { Card, CardContent } from "@monobase/ui/components/card"
import { Badge } from "@monobase/ui/components/badge"
import { Avatar, AvatarFallback } from "@monobase/ui/components/avatar"

export const Route = createFileRoute('/_dashboard/bookings/past')({
  component: PastBookingsPage,
})

function PastBookingsPage() {
  // Fetch all past appointment statuses
  const { data: completedData, isLoading: isLoadingCompleted, error: completedError } =
    useListBookings({ status: 'completed' })
  const { data: cancelledData, isLoading: isLoadingCancelled, error: cancelledError } =
    useListBookings({ status: 'cancelled' })
  const { data: rejectedData, isLoading: isLoadingRejected, error: rejectedError } =
    useListBookings({ status: 'rejected' })
  const { data: noShowClientData, isLoading: isLoadingNoShowClient, error: noShowClientError } =
    useListBookings({ status: 'no_show_client' })
  const { data: noShowProviderData, isLoading: isLoadingNoShowProvider, error: noShowProviderError } =
    useListBookings({ status: 'no_show_provider' })

  const isLoading = isLoadingCompleted || isLoadingCancelled || isLoadingRejected ||
    isLoadingNoShowClient || isLoadingNoShowProvider
  const error = completedError || cancelledError || rejectedError ||
    noShowClientError || noShowProviderError

  // Combine and sort appointments by date (most recent first)
  const appointments = [
    ...(completedData?.data || []),
    ...(cancelledData?.data || []),
    ...(rejectedData?.data || []),
    ...(noShowClientData?.data || []),
    ...(noShowProviderData?.data || [])
  ].sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime())

  // Format date and time from ISO string
  const formatAppointmentDateTime = (isoString: string) => {
    const date = parseISO(isoString)
    return {
      date: formatDate(date, { format: 'yyyy-MM-dd' }),
      time: formatDate(date, { format: 'time' }),
    }
  }

  const getTypeIcon = (type: LocationType) => {
    switch (type) {
      case 'video':
        return <Video className="h-4 w-4" />
      case 'phone':
        return <Phone className="h-4 w-4" />
      case 'in-person':
        return <MapPin className="h-4 w-4" />
      default:
        return <MapPin className="h-4 w-4" />
    }
  }

  const getTypeLabel = (type: LocationType) => {
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

  const getStatusBadge = (status: AppointmentStatus) => {
    switch (status) {
      case 'completed':
        return { variant: 'secondary' as const, label: 'Completed' }
      case 'cancelled':
        return { variant: 'destructive' as const, label: 'Cancelled' }
      case 'rejected':
        return { variant: 'destructive' as const, label: 'Rejected' }
      case 'no_show_client':
        return { variant: 'destructive' as const, label: 'No Show (Client)' }
      case 'no_show_provider':
        return { variant: 'destructive' as const, label: 'No Show (Provider)' }
      default:
        return { variant: 'secondary' as const, label: status }
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading past appointments...</span>
      </div>
    )
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-6">
          <p className="text-red-800">Failed to load past appointments</p>
        </CardContent>
      </Card>
    )
  }

  if (appointments.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">No completed appointments</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {appointments.map((appointment) => {
        const { date, time } = formatAppointmentDateTime(appointment.scheduledAt)
        return (
          <Card key={appointment.id}>
            <CardContent className="p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                <div className="flex gap-4 flex-1">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback>PT</AvatarFallback>
                  </Avatar>
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold">Patient {appointment.client.substring(0, 8)}</p>
                      <Badge variant={getStatusBadge(appointment.status).variant} className="text-xs">
                        {getStatusBadge(appointment.status).label}
                      </Badge>
                    </div>

                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">{appointment.reason}</p>

                      <div className="flex flex-col gap-1 text-sm">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          <span>{date}</span>
                          <Clock className="h-3 w-3 text-muted-foreground ml-2" />
                          <span>{time}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {getTypeIcon(appointment.locationType)}
                          <span>{getTypeLabel(appointment.locationType)}</span>
                          <span className="text-muted-foreground">
                            • {appointment.durationMinutes} min
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
