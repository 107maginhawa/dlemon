import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { useState, useMemo } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  getTimeSlotOptions,
  getBookingEventOptions,
  createBookingMutation,
  listBookingsQueryKey,
} from '@monobase/sdk-ts/generated/react-query'
import { useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/card'
import { Button } from '@/components/button'
import { Label } from '@/components/label'
import { Textarea } from '@/components/textarea'
import { Loader2, Calendar, Clock } from 'lucide-react'
import { formatDate } from '@/lib/format-date'
import type { LocationType } from '@monobase/sdk-ts/generated/types.gen'

export const Route = createFileRoute('/_dashboard/bookings/host/$personId/$slotId')({
  component: ConfirmPage,
})

function ConfirmPage() {
  const { personId, slotId } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const slotQuery = useQuery({
    ...getTimeSlotOptions({ path: { slotId } }),
    staleTime: 30_000,
  })

  const slot = slotQuery.data
  const eventId = slot ? (typeof slot.event === 'string' ? slot.event : slot.event.id) : ''

  const eventQuery = useQuery({
    ...getBookingEventOptions({ path: { event: eventId } }),
    enabled: !!eventId,
    staleTime: 60_000,
  })

  const event = eventQuery.data
  const [reason, setReason] = useState('')
  const [locationType, setLocationType] = useState<LocationType | null>(null)

  const create = useMutation({
    ...createBookingMutation(),
    meta: {
      toast: {
        success: 'Booking requested',
        error: (err: unknown) =>
          err instanceof Error ? err.message : 'Could not create booking',
      },
    },
    onSuccess: (booking) => {
      queryClient.invalidateQueries({ queryKey: listBookingsQueryKey() })
      navigate({ to: '/bookings/$bookingId', params: { bookingId: booking.id } })
    },
  })

  const priceLabel = useMemo(() => {
    const cfg = event?.billingConfig
    if (!cfg || cfg.price <= 0) return 'Free'
    return `${cfg.currency} ${(cfg.price / 100).toFixed(2)}`
  }, [event])

  if (slotQuery.isPending || eventQuery.isPending) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!slot || !event) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Slot not available.</p>
      </div>
    )
  }

  if (slot.status !== 'available') {
    return (
      <div className="p-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>This slot isn't available</CardTitle>
            <CardDescription>Someone may have just booked it. Pick a different time.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/bookings/host/$personId" params={{ personId }}>
                Back to availability
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const locationOptions = slot.locationTypes
  const selectedLocation = locationType ?? locationOptions[0]

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedLocation) return
    create.mutate({
      body: {
        slot: slot.id,
        locationType: selectedLocation,
        reason: reason || undefined,
      },
    })
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold">Confirm booking</h1>
        <p className="text-muted-foreground">{event.title}</p>
      </div>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            {formatDate(slot.startTime, { format: 'medium' })}
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            {formatDate(slot.startTime, { format: 'time' })} – {formatDate(slot.endTime, { format: 'time' })}
          </div>
          <p className="text-sm text-muted-foreground">{priceLabel}</p>
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit} className="space-y-4">
        {locationOptions.length > 1 && (
          <div className="space-y-2">
            <Label>Location</Label>
            <div className="flex gap-2">
              {locationOptions.map((loc) => (
                <Button
                  key={loc}
                  type="button"
                  variant={selectedLocation === loc ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setLocationType(loc)}
                  className="capitalize"
                >
                  {loc}
                </Button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="reason">Reason (optional)</Label>
          <Textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="What would you like to discuss?"
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button asChild variant="outline" type="button">
            <Link to="/bookings/host/$personId" params={{ personId }}>
              Cancel
            </Link>
          </Button>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? 'Requesting…' : 'Request booking'}
          </Button>
        </div>
      </form>
    </div>
  )
}
