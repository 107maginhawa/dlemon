import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { listBookingEventsOptions } from '@monobase/sdk-ts/generated/react-query'
import type { BookingEvent, Person } from '@monobase/sdk-ts/generated/types.gen'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/avatar'
import { Badge } from '@/components/badge'
import { Loader2, Calendar } from 'lucide-react'

function ownerOf(event: BookingEvent): Person | null {
  // expand=owner inflates `event.owner` from a string ID to a full Person.
  return typeof event.owner === 'string' ? null : (event.owner as Person)
}

function priceLabel(event: BookingEvent): string | null {
  const cfg = event.billingConfig
  if (!cfg || cfg.price <= 0) return null
  return `${cfg.currency} ${(cfg.price / 100).toFixed(2)}`
}

function initials(person: Person | null): string {
  if (!person) return '?'
  const first = person.firstName?.[0] ?? ''
  const last = person.lastName?.[0] ?? ''
  return (first + last || '?').toUpperCase()
}

export function HostDirectory() {
  const { data, isPending, error } = useQuery({
    ...listBookingEventsOptions({
      query: { status: 'active', expand: 'owner', limit: 50 },
    }),
    staleTime: 60_000,
  })

  if (isPending) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <p className="p-6 text-sm text-destructive">
        Could not load hosts: {error instanceof Error ? error.message : 'unknown error'}
      </p>
    )
  }

  const events = data?.data ?? []

  if (events.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
          <Calendar className="h-10 w-10 text-muted-foreground" />
          <p className="text-muted-foreground">No active hosts yet.</p>
          <p className="text-xs text-muted-foreground">
            Publish your own schedule under Settings → Schedule to see your event here.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {events.map((event) => {
        const owner = ownerOf(event)
        const price = priceLabel(event)
        // Skip events where the owner failed to expand — we can't link without a person id.
        if (!owner) return null
        return (
          <Link
            key={event.id}
            to="/bookings/host/$personId"
            params={{ personId: owner.id }}
            className="block focus:outline-none"
          >
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardHeader className="flex flex-row items-center gap-3 pb-2">
                <Avatar>
                  <AvatarImage src={owner.avatar?.url} />
                  <AvatarFallback>{initials(owner)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <CardTitle className="truncate text-base">{event.title}</CardTitle>
                  <p className="truncate text-sm text-muted-foreground">
                    {[owner.firstName, owner.lastName].filter(Boolean).join(' ')}
                  </p>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {event.description && (
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {event.description}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {event.locationTypes.map((loc) => (
                    <Badge key={loc} variant="secondary" className="capitalize">
                      {loc}
                    </Badge>
                  ))}
                  {price && <Badge variant="outline">{price}</Badge>}
                </div>
              </CardContent>
            </Card>
          </Link>
        )
      })}
    </div>
  )
}
