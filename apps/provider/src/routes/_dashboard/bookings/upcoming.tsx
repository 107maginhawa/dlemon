import { createFileRoute, Link } from '@tanstack/react-router'
import {
  Calendar,
  Clock,
  Video,
  Phone,
  MapPin,
  MoreVertical,
  Loader2
} from 'lucide-react'
import { useListBookings, useCancelBooking } from '@monobase/sdk/react/hooks/use-booking'
import { parseISO } from 'date-fns'

type LocationType = 'video' | 'phone' | 'in-person'
import { formatDate } from '@monobase/ui/lib/format-date'
import { Button } from "@monobase/ui/components/button"
import { Card, CardContent } from "@monobase/ui/components/card"
import { Badge } from "@monobase/ui/components/badge"
import { Avatar, AvatarFallback } from "@monobase/ui/components/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@monobase/ui/components/dropdown-menu"
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

export const Route = createFileRoute('/_dashboard/bookings/upcoming')({
  component: UpcomingBookingsPage,
})

function UpcomingBookingsPage() {
  // Fetch confirmed appointments
  const { data: appointmentsData, isLoading, error } = useListBookings({ status: 'confirmed' })
  const cancelAppointment = useCancelBooking()

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

  const handleCancel = async (appointmentId: string) => {
    await cancelAppointment.mutateAsync({
      bookingId: appointmentId,
      reason: 'Cancelled by provider',
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading appointments...</span>
      </div>
    )
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-6">
          <p className="text-red-800">Failed to load appointments</p>
        </CardContent>
      </Card>
    )
  }

  if (appointments.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">No upcoming confirmed appointments</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {appointments.map((appointment: any) => {
        const { date, time } = formatAppointmentDateTime(appointment.scheduledAt)
        return (
          <Card key={appointment.id}>
            <CardContent className="p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex gap-4 flex-1">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback>PT</AvatarFallback>
                  </Avatar>
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold">Patient {appointment.client.substring(0, 8)}</p>
                      <Badge variant="default" className="text-xs">
                        Confirmed
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

                <div className="flex flex-wrap gap-2">
                  {appointment.locationType === 'video' && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm">
                          <Video className="mr-1 h-3 w-3" />
                          Start Consultation
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Start Video Consultation?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will start the video consultation session with the patient. Make sure you're ready to begin.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Not Yet</AlertDialogCancel>
                          <AlertDialogAction asChild>
                            <Link to="/bookings/$id/video" params={{ id: appointment.id }}>
                              Start Video Call
                            </Link>
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="ghost">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <DropdownMenuItem
                            className="text-red-600"
                            onSelect={(e) => e.preventDefault()}
                          >
                            Cancel Appointment
                          </DropdownMenuItem>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Cancel This Appointment?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will cancel the appointment and notify the patient. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Keep Appointment</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-red-600 hover:bg-red-700"
                              onClick={() => handleCancel(appointment.id)}
                              disabled={cancelAppointment.isPending}
                            >
                              Cancel Appointment
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
