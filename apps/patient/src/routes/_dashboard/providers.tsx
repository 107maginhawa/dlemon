import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { AlertCircle } from 'lucide-react'
import { requireAuth, requireEmailVerified, requirePerson, composeGuards } from '@/utils/guards'
import { useListBookingEvents, useBookingEvent } from '@monobase/sdk/react/hooks/use-booking'
import { Button } from '@monobase/ui/components/button'
import { Alert, AlertDescription } from '@monobase/ui/components/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@monobase/ui/components/dialog'
import { ProviderCard } from '@monobase/ui/provider/components/provider-card'
import { ProviderListSkeleton } from '@monobase/ui/provider/components/provider-card-skeleton'
import { BookingWidget } from '@monobase/ui/booking/components/booking-widget'
import { BookingWidgetSkeleton } from '@monobase/ui/booking/components/booking-widget-skeleton'
import type { BookingTimeSlot } from '@monobase/ui/booking/types'

export const Route = createFileRoute('/_dashboard/providers')({
  beforeLoad: composeGuards(requireAuth, requireEmailVerified, requirePerson),
  component: ProvidersPage,
})

function ProvidersPage() {
  // Fetch all active booking events
  const { data: eventsResponse, isLoading, error: queryError } = useListBookingEvents({
    status: 'active',
  })

  const events = eventsResponse?.data || []
  const error = queryError?.message || null

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-headline font-bold">Find Providers</h1>
        <p className="text-muted-foreground font-body">
          Browse and book appointments with healthcare providers
        </p>
      </div>

      {/* Error State */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error}
            <Button
              variant="link"
              size="sm"
              className="ml-2 p-0 h-auto"
              onClick={() => window.location.reload()}
            >
              Try Again
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Provider Grid */}
      {isLoading ? (
        <ProviderListSkeleton count={6} />
      ) : events.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <ProviderBookingCard
              key={event.id}
              event={event}
              provider={{
                id: event.owner,
                name: event.title,
                title: 'Healthcare Professional',
                avatar: undefined,
                bio: event.description || 'Virtual consultation with your professional',
                specialties: event.tags || [],
                practiceLocations: [],
                languages: [],
              }}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-muted-foreground text-lg">
            No providers available at this time.
          </p>
        </div>
      )}
    </div>
  )
}

interface ProviderBookingCardProps {
  event: {
    id: string
    owner: string
    title: string
    description?: string
    tags?: string[]
  }
  provider: {
    id: string
    name: string
    title: string
    avatar?: string
    bio?: string
    specialties: string[]
    practiceLocations?: string[]
    languages?: string[]
  }
}

function ProviderBookingCard({ event, provider }: ProviderBookingCardProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const navigate = useNavigate()

  // Fetch event with slots when dialog opens
  const { data: eventWithSlots, isLoading, error } = useBookingEvent(
    event.id,
    {
      expand: 'slots',
      enabled: dialogOpen,
    }
  )

  const handleSlotSelect = (slot: BookingTimeSlot) => {
    // Navigate to booking flow with slot
    setDialogOpen(false)
    navigate({ to: `/booking/new/${slot.id}` })
  }

  // Transform API slots to BookingTimeSlot format
  const slots: BookingTimeSlot[] = eventWithSlots?.slots?.map(slot => ({
    id: slot.id,
    providerId: slot.provider,
    date: slot.startTime.split('T')[0], // Extract YYYY-MM-DD from ISO timestamp
    startTime: slot.startTime,
    endTime: slot.endTime,
    status: slot.status as 'available' | 'booked' | 'blocked',
    consultationModes: ['video'], // Default, could come from slot config
    price: slot.billingOverride?.price || 45.00
  })) || []

  return (
    <>
      <ProviderCard
        provider={provider}
        onBookClick={() => setDialogOpen(true)}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Book Appointment with {provider.name}</DialogTitle>
            {provider.title && (
              <p className="text-sm text-muted-foreground">{provider.title}</p>
            )}
          </DialogHeader>

          <div className="mt-4">
            {/* Loading State */}
            {isLoading && <BookingWidgetSkeleton />}

            {/* Error State */}
            {error && !isLoading && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {error.message || 'Failed to load slots'}
                  <Button
                    variant="link"
                    size="sm"
                    className="ml-2 p-0 h-auto"
                    onClick={() => setDialogOpen(false)}
                  >
                    Close
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {/* Booking Widget */}
            {!isLoading && !error && eventWithSlots && (
              <BookingWidget
                provider={{
                  id: event.owner,
                  name: provider.name,
                }}
                slots={slots}
                event={eventWithSlots.billingConfig ? {
                  billingConfig: eventWithSlots.billingConfig
                } : undefined}
                onSlotSelect={handleSlotSelect}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
