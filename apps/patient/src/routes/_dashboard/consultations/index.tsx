import { createFileRoute, Link } from '@tanstack/react-router'
import {
  Video,
  Calendar,
  Clock,
  User,
  AlertCircle,
  Loader2,
  CheckCircle,
  XCircle,
} from 'lucide-react'
import { differenceInMinutes } from 'date-fns'
import { requireAuth, requireEmailVerified, requirePerson, composeGuards } from '@/utils/guards'
import { useListBookings } from '@monobase/sdk/react/hooks/use-booking'
import { Button } from '@monobase/ui/components/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@monobase/ui/components/card'
import { Badge } from '@monobase/ui/components/badge'
import { Avatar, AvatarFallback } from '@monobase/ui/components/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@monobase/ui/components/tabs'
import { isPast, isFuture, isToday, parseISO } from 'date-fns'
import { formatDate } from '@monobase/ui/lib/format-date'

export const Route = createFileRoute('/_dashboard/consultations/')({
  beforeLoad: composeGuards(requireAuth, requireEmailVerified, requirePerson),
  component: ConsultationsPage,
})

function ConsultationsPage() {
  // Fetch video appointments only
  const {
    data: upcomingData,
    isLoading: upcomingLoading,
    error: upcomingError,
  } = useListBookings({
    status: 'confirmed',
    expand: 'provider,provider.person',
    sort: 'scheduledAt',
  })

  const {
    data: pastData,
    isLoading: pastLoading,
    error: pastError,
  } = useListBookings({
    status: 'completed',
    expand: 'provider,provider.person',
    sort: '-scheduledAt',
  })

  const isLoading = upcomingLoading || pastLoading
  const error = upcomingError || pastError

  // Filter for video consultations only
  const upcomingConsultations = (upcomingData?.data || []).filter(
    (apt) => apt.locationType === 'video'
  )

  const pastConsultations = (pastData?.data || []).filter(
    (apt) => apt.locationType === 'video'
  )

  const renderConsultationCard = (appointment: any, isUpcoming: boolean) => {
    const provider = typeof appointment.provider === 'object' ? appointment.provider : null
    const providerName = provider
      ? `${provider.person.firstName} ${provider.person.lastName}`
      : 'Provider'
    const providerInitials = provider
      ? `${provider.person.firstName[0]}${provider.person.lastName[0]}`
      : 'P'

    const scheduledDate = parseISO(appointment.scheduledAt)
    const appointmentDate = formatDate(scheduledDate, { format: 'full' })
    const appointmentTime = formatDate(scheduledDate, { format: 'time' })

    // Check if consultation is happening now (within 15 minutes before or after scheduled time)
    const now = new Date()
    const minutesUntil = differenceInMinutes(scheduledDate, now)
    const isHappeningNow = minutesUntil >= -30 && minutesUntil <= 15
    const canJoin = isToday(scheduledDate) && minutesUntil >= -30 && minutesUntil <= 30

    return (
      <Card key={appointment.id}>
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex gap-4">
              <Avatar className="h-12 w-12">
                <AvatarFallback>{providerInitials}</AvatarFallback>
              </Avatar>
              <div className="space-y-1 flex-1">
                <div>
                  <p className="font-semibold">{providerName}</p>
                  <p className="text-sm text-muted-foreground">
                    {provider?.providerType || 'Healthcare Provider'}
                  </p>
                </div>
                <div className="flex flex-col gap-1 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3 w-3 text-muted-foreground" />
                    <span>{appointmentDate}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span>{appointmentTime}</span>
                    {isHappeningNow && (
                      <Badge variant="default" className="ml-2">
                        Happening Now
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Video className="h-3 w-3 text-muted-foreground" />
                    <span>Video Consultation</span>
                  </div>
                </div>
                {appointment.reason && (
                  <p className="text-sm text-muted-foreground mt-2">
                    <span className="font-medium">Reason:</span> {appointment.reason}
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2 sm:flex-col">
              {isUpcoming && canJoin && (
                <Button size="sm" asChild className="min-w-24">
                  <Link
                    to="/consultations/$id"
                    params={{ id: appointment.id }}
                  >
                    <Video className="mr-2 h-4 w-4" />
                    Join Call
                  </Link>
                </Button>
              )}
              {isUpcoming && !canJoin && (
                <Button size="sm" variant="outline" disabled className="min-w-24">
                  Not Yet Available
                </Button>
              )}
              {!isUpcoming && (
                <Button size="sm" variant="outline" asChild>
                  <Link to="/medical-records">
                    View Notes
                  </Link>
                </Button>
              )}
              <Button size="sm" variant="outline" asChild>
                <Link
                  to="/appointments/$appointmentId"
                  params={{ appointmentId: appointment.id }}
                >
                  View Details
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-headline font-bold">Video Consultations</h1>
          <p className="text-muted-foreground font-body">
            Join your virtual appointments and view consultation history
          </p>
        </div>
        <Button className="w-full sm:w-auto" asChild>
          <Link to="/providers">
            <Calendar className="mr-2 h-4 w-4" />
            Book New Consultation
          </Link>
        </Button>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Error State */}
      {error && (
        <Card>
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="text-destructive mb-4">Failed to load consultations</p>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Consultations Tabs */}
      {!isLoading && !error && (
        <Tabs defaultValue="upcoming" className="w-full">
          <TabsList>
            <TabsTrigger value="upcoming">
              Upcoming
              <Badge variant="secondary" className="ml-2">
                {upcomingConsultations.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="past">Past</TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="space-y-4 mt-6">
            {upcomingConsultations.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Video className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-2">No upcoming video consultations</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Book a video consultation with a healthcare provider
                  </p>
                  <Button variant="outline" asChild>
                    <Link to="/providers">Browse Providers</Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              upcomingConsultations.map((consultation) =>
                renderConsultationCard(consultation, true)
              )
            )}
          </TabsContent>

          <TabsContent value="past" className="space-y-4 mt-6">
            {pastConsultations.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Video className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No past video consultations</p>
                </CardContent>
              </Card>
            ) : (
              pastConsultations.map((consultation) =>
                renderConsultationCard(consultation, false)
              )
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Help Card */}
      {!isLoading && !error && (
        <Card>
          <CardHeader>
            <CardTitle>Before Your Consultation</CardTitle>
            <CardDescription>Tips for a successful video consultation</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Test your camera and microphone before the call</li>
              <li>Find a quiet, well-lit location</li>
              <li>Join the call 5 minutes before your scheduled time</li>
              <li>Have your health card and list of medications ready</li>
              <li>Use the chat feature if you experience audio issues</li>
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
