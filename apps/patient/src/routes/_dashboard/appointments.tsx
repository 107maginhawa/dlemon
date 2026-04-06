import { createFileRoute, Link, Outlet, useMatchRoute } from '@tanstack/react-router'
import { Calendar } from 'lucide-react'
import { requireAuth, requireEmailVerified, requirePerson, composeGuards } from '@/utils/guards'
import { useListBookings } from '@monobase/sdk/react/hooks/use-booking'
import { Button } from '@monobase/ui/components/button'
import { Tabs, TabsList, TabsTrigger } from '@monobase/ui/components/tabs'
import { Badge } from '@monobase/ui/components/badge'

export const Route = createFileRoute('/_dashboard/appointments')({
  beforeLoad: composeGuards(requireAuth, requireEmailVerified, requirePerson),
  component: AppointmentsLayout,
})

function AppointmentsLayout() {
  const matchRoute = useMatchRoute()

  // Fetch counts for each tab badge (lightweight queries - limit: 1)
  const { data: confirmedData } = useListBookings({ status: 'confirmed', limit: 1 })
  const { data: pendingData } = useListBookings({ status: 'pending', limit: 1 })

  const confirmedCount = confirmedData?.pagination?.totalCount || 0
  const pendingCount = pendingData?.pagination?.totalCount || 0

  // Determine active tab based on current route
  const isConfirmed = !!matchRoute({ to: '/appointments/confirmed' })
  const isPending = !!matchRoute({ to: '/appointments/pending' })
  const isPast = !!matchRoute({ to: '/appointments/past' })

  const activeTab = isPending ? 'pending' : isPast ? 'past' : 'confirmed'

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-headline font-bold">Appointments</h1>
          <p className="text-muted-foreground font-body">
            Manage your healthcare appointments
          </p>
        </div>
        <Button className="w-full sm:w-auto" asChild>
          <Link to="/providers">
            <Calendar className="mr-2 h-4 w-4" />
            Book New Appointment
          </Link>
        </Button>
      </div>

      {/* Appointments Tabs */}
      <Tabs value={activeTab} className="w-full">
        <TabsList>
          <TabsTrigger value="confirmed" asChild>
            <Link to="/appointments/confirmed">
              Confirmed
              <Badge variant="secondary" className="ml-2">
                {confirmedCount}
              </Badge>
            </Link>
          </TabsTrigger>
          <TabsTrigger value="pending" asChild>
            <Link to="/appointments/pending">
              Pending
              <Badge variant="secondary" className="ml-2">
                {pendingCount}
              </Badge>
            </Link>
          </TabsTrigger>
          <TabsTrigger value="past" asChild>
            <Link to="/appointments/past">
              Past
            </Link>
          </TabsTrigger>
        </TabsList>

        {/* Child routes render here */}
        <div className="mt-6">
          <Outlet />
        </div>
      </Tabs>
    </div>
  )
}
