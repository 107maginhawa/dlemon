import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { listBookingsOptions } from '@monobase/sdk-ts/generated/react-query'
import type { Booking } from '@monobase/sdk-ts/generated/types.gen'
import { Card, CardContent } from '@/components/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/tabs'
import { Badge } from '@/components/badge'
import { formatDate } from '@/lib/format-date'
import { Loader2, Calendar } from 'lucide-react'
import { partitionBookings } from '@/features/booking/lib/partition-bookings'

interface BookingListProps {
  myPersonId: string
}

const STATUS_COLOR: Partial<Record<Booking['status'], string>> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-700',
  completed: 'bg-blue-100 text-blue-800',
}

function BookingRow({ booking }: { booking: Booking }) {
  const statusClass = STATUS_COLOR[booking.status] ?? 'bg-gray-100 text-gray-700'
  return (
    <Link
      to="/bookings/$bookingId"
      params={{ bookingId: booking.id }}
      className="block focus:outline-none"
    >
      <Card className="transition-shadow hover:shadow-md">
        <CardContent className="flex items-center justify-between p-4">
          <div>
            <div className="font-medium">
              {formatDate(booking.scheduledAt, { format: 'medium' })}
              {' · '}
              {formatDate(booking.scheduledAt, { format: 'time' })}
            </div>
            <p className="text-sm text-muted-foreground">
              {booking.durationMinutes} min · {booking.locationType}
            </p>
            {booking.reason && (
              <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                "{booking.reason}"
              </p>
            )}
          </div>
          <Badge className={statusClass + ' capitalize'} variant="outline">
            {booking.status}
          </Badge>
        </CardContent>
      </Card>
    </Link>
  )
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-2 p-10 text-center">
        <Calendar className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{children}</p>
      </CardContent>
    </Card>
  )
}

export function BookingList({ myPersonId }: BookingListProps) {
  const asClient = useQuery({
    ...listBookingsOptions({ query: { client: myPersonId, limit: 100 } }),
    staleTime: 30_000,
  })
  const asHost = useQuery({
    ...listBookingsOptions({ query: { host: myPersonId, limit: 100 } }),
    staleTime: 30_000,
  })

  const clientPart = useMemo(() => partitionBookings(asClient.data?.data), [asClient.data?.data])
  const hostPart = useMemo(() => partitionBookings(asHost.data?.data), [asHost.data?.data])

  const isLoading = asClient.isPending || asHost.isPending

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <Tabs defaultValue="client">
      <TabsList>
        <TabsTrigger value="client">
          Booked by me
          {clientPart.upcoming.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {clientPart.upcoming.length}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="host">
          With me
          {hostPart.upcoming.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {hostPart.upcoming.length}
            </Badge>
          )}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="client" className="mt-4 space-y-6">
        <Section title="Upcoming" empty="You haven't booked anyone yet." items={clientPart.upcoming} />
        <Section title="Past" empty="No past bookings." items={clientPart.past} />
      </TabsContent>

      <TabsContent value="host" className="mt-4 space-y-6">
        <Section
          title="Upcoming"
          empty="No bookings on your schedule yet. Publish your schedule under Settings → Schedule to start accepting bookings."
          items={hostPart.upcoming}
        />
        <Section title="Past" empty="No past bookings." items={hostPart.past} />
      </TabsContent>
    </Tabs>
  )
}

function Section({
  title,
  items,
  empty,
}: {
  title: string
  items: Booking[]
  empty: string
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      {items.length === 0 ? (
        <EmptyState>{empty}</EmptyState>
      ) : (
        <div className="space-y-2">
          {items.map((b) => (
            <BookingRow key={b.id} booking={b} />
          ))}
        </div>
      )}
    </div>
  )
}
