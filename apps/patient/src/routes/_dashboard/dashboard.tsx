import { createFileRoute, Link } from '@tanstack/react-router'
import {
  Calendar,
  Clock,
  User,
  Stethoscope,
  FileText,
  CreditCard,
  Bell,
  MapPin,
  Video,
  ArrowRight,
  Activity,
  AlertCircle
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@monobase/ui/components/card'
import { Button } from '@monobase/ui/components/button'
import { Badge } from '@monobase/ui/components/badge'
import { Avatar, AvatarFallback } from '@monobase/ui/components/avatar'
import { useMyPatient } from '@monobase/sdk/react/hooks/use-patient'
import { useMyPerson } from '@monobase/sdk/react/hooks/use-person'
import { useListBookings } from '@monobase/sdk/react/hooks/use-booking'
import { useNotifications } from '@monobase/sdk/react/hooks/use-notifications'
import { Skeleton } from '@monobase/ui/components/skeleton'
import { ErrorBoundary } from '@/components/error-boundary'
import { formatDate, formatRelativeDate } from '@monobase/ui/lib/format-date'

export const Route = createFileRoute('/_dashboard/dashboard')({
  component: DashboardPage,
})

// Small error fallback for dashboard widgets
function WidgetErrorFallback({ title }: { title: string }) {
  return (
    <Card className="border-destructive/50">
      <CardContent className="p-6 text-center">
        <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Unable to load {title}</p>
        <Button 
          variant="outline" 
          size="sm" 
          className="mt-3"
          onClick={() => window.location.reload()}
        >
          Retry
        </Button>
      </CardContent>
    </Card>
  )
}

function DashboardPage() {
  const { data: patient, isLoading: patientLoading } = useMyPatient()
  const { data: person, isLoading: personLoading } = useMyPerson()

  // Fetch upcoming appointments
  const { data: upcomingAppointmentsData, isLoading: appointmentsLoading } = useListBookings({
    expand: 'provider,provider.person',
    status: 'confirmed',
    limit: 3,
    sort: 'scheduledAt', // Soonest first
  })

  // Fetch recent notifications
  const { data: notificationsData, isLoading: notificationsLoading } = useNotifications({
    limit: 3,
  })

  // Fetch last completed appointment for "Last Visit" date
  const { data: completedAppointmentsData } = useListBookings({
    status: 'completed',
    limit: 1,
    sort: '-scheduledAt', // Most recent first
  })

  const isLoading = patientLoading || personLoading

  // Get display name from expanded person data in patient profile, or fallback to separate person profile
  const displayName = patient?.person
    ? `${patient.person.firstName} ${patient.person.lastName}`
    : person
    ? `${person.firstName} ${person.lastName}`
    : 'Patient'

  // Calculate last visit date
  const lastVisitDate = completedAppointmentsData?.data?.[0]?.scheduledAt
    ? formatDate(completedAppointmentsData.data[0].scheduledAt, { format: 'long' })
    : 'No previous visits'

  const upcomingAppointments = upcomingAppointmentsData?.data || []
  const notifications = notificationsData?.data || []

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Welcome Header */}
      <div>
        <h1 className="text-3xl font-headline font-bold">Welcome back, {isLoading ? <Skeleton className="inline-block h-8 w-32" /> : displayName.split(' ')[0]}</h1>
        <p className="text-muted-foreground font-body mt-1">
          Here's an overview of your healthcare
        </p>
      </div>

      {/* Dashboard Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

        {/* Health Summary Card */}
        <ErrorBoundary fallback={<WidgetErrorFallback title="Health Summary" />}>
        <Card className="md:col-span-2 lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Health Summary
            </CardTitle>
            <CardDescription>Your health information at a glance</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Patient Name:</span>
                  <span className="text-sm text-muted-foreground">{displayName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Stethoscope className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Primary Care Provider:</span>
                  <span className="text-sm text-muted-foreground">
                    {patient?.primaryProvider?.name || 'Not set'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Last Visit:</span>
                  <span className="text-sm text-muted-foreground">{lastVisitDate}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
        </ErrorBoundary>

        {/* Upcoming Appointments Widget */}
        <ErrorBoundary fallback={<WidgetErrorFallback title="Upcoming Appointments" />}>
        <Card className="md:col-span-2 lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Upcoming Appointments
                </CardTitle>
                <CardDescription>Your next scheduled visits</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/appointments" className="flex items-center gap-1">
                  View All
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {appointmentsLoading ? (
              <>
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </>
            ) : upcomingAppointments.length > 0 ? (
              upcomingAppointments.map((appointment) => {
                const provider =
                  typeof appointment.provider === 'object' ? appointment.provider : null
                const providerName = provider
                  ? `${provider.person.firstName} ${provider.person.lastName}`
                  : 'Provider'
                const providerInitials = provider
                  ? `${provider.person.firstName[0]}${provider.person.lastName[0]}`
                  : 'P'

                const dateStr = formatDate(appointment.scheduledAt, { format: 'medium' })
                const timeStr = formatDate(appointment.scheduledAt, { format: 'time' })

                return (
                  <div
                    key={appointment.id}
                    className="flex items-start gap-3 p-3 rounded-lg border hover:bg-accent transition-colors"
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarFallback>{providerInitials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{providerName}</p>
                      <p className="text-xs text-muted-foreground">
                        {provider?.providerType || 'Healthcare Provider'}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {dateStr}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {timeStr}
                        </span>
                      </div>
                    </div>
                    <Badge variant="secondary" className="flex items-center gap-1">
                      {appointment.locationType === 'video' ? (
                        <Video className="h-3 w-3" />
                      ) : (
                        <MapPin className="h-3 w-3" />
                      )}
                      {appointment.locationType === 'video'
                        ? 'Video'
                        : appointment.locationType === 'phone'
                          ? 'Phone'
                          : 'In-Person'}
                    </Badge>
                  </div>
                )
              })
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No upcoming appointments
              </p>
            )}
          </CardContent>
        </Card>
        </ErrorBoundary>

        {/* Quick Actions Section */}
        <ErrorBoundary fallback={<WidgetErrorFallback title="Quick Actions" />}>
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks and shortcuts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link to="/providers">
                <Calendar className="mr-2 h-4 w-4" />
                Book Appointment
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link to="/medical-records">
                <FileText className="mr-2 h-4 w-4" />
                View Medical Records
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link to="/providers">
                <Stethoscope className="mr-2 h-4 w-4" />
                Find Providers
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link to="/billing">
                <CreditCard className="mr-2 h-4 w-4" />
                View Billing
              </Link>
            </Button>
          </CardContent>
        </Card>
        </ErrorBoundary>

        {/* Recent Notifications Widget */}
        <ErrorBoundary fallback={<WidgetErrorFallback title="Recent Notifications" />}>
        <Card className="md:col-span-1 lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-primary" />
                  Recent Notifications
                </CardTitle>
                <CardDescription>Stay updated with your healthcare</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/notifications" className="flex items-center gap-1">
                  View All
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {notificationsLoading ? (
              <>
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </>
            ) : notifications.length > 0 ? (
              notifications.map((notification) => {
                const isUnread = !notification.readAt
                const timeAgo = notification.sentAt
                  ? formatRelativeDate(notification.sentAt)
                  : formatRelativeDate(notification.createdAt)

                return (
                  <div
                    key={notification.id}
                    className="flex items-start gap-3 p-3 rounded-lg border hover:bg-accent transition-colors"
                  >
                    <div
                      className={`h-2 w-2 rounded-full mt-1.5 ${isUnread ? 'bg-primary' : 'bg-muted'}`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{notification.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{notification.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">{timeAgo}</p>
                    </div>
                  </div>
                )
              })
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No recent notifications
              </p>
            )}
          </CardContent>
        </Card>
        </ErrorBoundary>

      </div>
    </div>
  )
}