import { createFileRoute } from '@tanstack/react-router'
import {
  Calendar,
  Clock,
  Video,
  Phone,
  MapPin,
  AlertCircle,
  Check,
  X,
  Loader2
} from 'lucide-react'
import { useListBookings, useConfirmBooking, useRejectBooking } from '@monobase/sdk/react/hooks/use-booking'
import { parseISO } from 'date-fns'

type LocationType = 'video' | 'phone' | 'in-person'
import { formatDate } from '@monobase/ui/lib/format-date'
import { Button } from "@monobase/ui/components/button"
import { Card, CardContent } from "@monobase/ui/components/card"
import { Badge } from "@monobase/ui/components/badge"
import { Avatar, AvatarFallback } from "@monobase/ui/components/avatar"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@monobase/ui/components/alert-dialog"

export const Route = createFileRoute('/_dashboard/bookings/requests')({
  component: BookingRequestsPage,
})

function BookingRequestsPage() {
  // Fetch pending appointments
  const { data: appointmentsData, isLoading, error } = useListBookings({ status: 'pending' })
  const confirmAppointment = useConfirmBooking()
  const rejectAppointment = useRejectBooking()

  const appointments = appointmentsData?.data || []

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

  const handleConfirm = async (appointmentId: string) => {
    await confirmAppointment.mutateAsync({
      bookingId: appointmentId,
      reason: 'Confirmed by provider',
    })
  }

  const handleReject = async (appointmentId: string) => {
    await rejectAppointment.mutateAsync({
      bookingId: appointmentId,
      reason: 'Time slot no longer available',
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading appointment requests...</span>
      </div>
    )
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-6">
          <p className="text-red-800">Failed to load appointment requests</p>
        </CardContent>
      </Card>
    )
  }

  if (appointments.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">No pending appointment requests</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {appointments.map((appointment: any) => {
        const { date, time } = formatAppointmentDateTime(appointment.scheduledAt)
        return (
          <Card
            key={appointment.id}
            className="border-orange-200 bg-orange-50/30"
          >
            <CardContent className="p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex gap-4 flex-1">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback>PT</AvatarFallback>
                  </Avatar>
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold">Patient {appointment.client.substring(0, 8)}</p>
                      <Badge
                        variant="default"
                        className="text-xs bg-orange-100 text-orange-800 border-orange-200"
                      >
                        <AlertCircle className="h-2 w-2 mr-1" />
                        Needs Response
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
                        </div>
                      </div>

                      <div className="text-xs text-muted-foreground">
                        Duration: {appointment.durationMinutes} minutes
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                        disabled={confirmAppointment.isPending}
                      >
                        <Check className="mr-1 h-3 w-3" />
                        Accept
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Accept Appointment Request?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will confirm the appointment and notify the patient. The time slot will be reserved for this patient.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => handleConfirm(appointment.id)}
                        >
                          Accept
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-200 text-red-600 hover:bg-red-50"
                        disabled={rejectAppointment.isPending}
                      >
                        <X className="mr-1 h-3 w-3" />
                        Decline
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Decline Appointment Request?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will reject the appointment and notify the patient that the time slot is no longer available.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-red-600 hover:bg-red-700"
                          onClick={() => handleReject(appointment.id)}
                        >
                          Decline
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
