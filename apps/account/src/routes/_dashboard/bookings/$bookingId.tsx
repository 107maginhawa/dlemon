import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getBookingOptions,
  getBookingQueryKey,
  listBookingsQueryKey,
  listChatRoomsOptions,
  createChatRoomMutation,
  confirmBookingMutation,
  rejectBookingMutation,
  cancelBookingMutation,
  payInvoiceMutation,
} from '@monobase/sdk-ts/generated/react-query'
import { useOptimisticMutation } from '@monobase/sdk-ts/react/use-optimistic-mutation'
import type { Booking, ChatRoom, Person } from '@monobase/sdk-ts/generated/types.gen'
import { ActiveBookingCard } from '@/features/booking/components/active-booking-card'
import { ChatThread } from '@/features/comms/components/chat-thread'
import { VideoCallPanel } from '@/features/comms/components/video-call-panel'
import { Button } from '@/components/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/card'
import { Loader2, ExternalLink } from 'lucide-react'

export const Route = createFileRoute('/_dashboard/bookings/$bookingId')({
  component: BookingDetailPage,
})

const VIDEO_WINDOW_MS = 15 * 60_000

function asPerson(value: string | Person | undefined): Person | null {
  if (!value || typeof value === 'string') return null
  return value
}

function nameOf(value: string | Person | undefined, fallback: string): string {
  const p = asPerson(value)
  if (!p) return fallback
  return [p.firstName, p.lastName].filter(Boolean).join(' ') || fallback
}

function BookingDetailPage() {
  const { bookingId } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { auth } = Route.useRouteContext()
  const myPersonId = auth.person?.id

  const bookingQuery = useQuery({
    ...getBookingOptions({
      path: { booking: bookingId },
      query: { expand: 'client,host' },
    }),
    staleTime: 30_000,
  })

  const booking = bookingQuery.data
  const clientId =
    booking && (typeof booking.client === 'string' ? booking.client : booking.client.id)
  const hostId =
    booking && (typeof booking.host === 'string' ? booking.host : booking.host.id)

  // Chat room is keyed off booking ID (context). Look it up; if missing, create
  // it via upsert with both participants.
  const roomsQuery = useQuery({
    ...listChatRoomsOptions({ query: { context: bookingId } }),
    enabled: !!booking,
    staleTime: 30_000,
  })

  const ensureRoom = useMutation({
    ...createChatRoomMutation(),
    meta: { toast: { error: 'Could not start chat room' } },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listChatRooms'] })
    },
  })

  const existingRoom: ChatRoom | undefined = roomsQuery.data?.data[0]

  // Auto-create the chat room once the booking + participants are loaded but
  // no room exists. Idempotent via upsert; only fires once per page load.
  const creationKey = useMemo(
    () => (existingRoom || !clientId || !hostId ? null : `${clientId}:${hostId}:${bookingId}`),
    [existingRoom, clientId, hostId, bookingId],
  )

  useEffect(() => {
    if (!creationKey || ensureRoom.isPending) return
    ensureRoom.mutate({
      body: {
        participants: [clientId!, hostId!],
        context: bookingId,
        upsert: true,
      },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creationKey])

  const room = existingRoom ?? ensureRoom.data ?? null
  const isClient = myPersonId === clientId
  const isHost = myPersonId === hostId

  // Mutations driving ActiveBookingCard's status actions.
  const invalidateBooking = () => {
    queryClient.invalidateQueries({
      queryKey: getBookingQueryKey({
        path: { booking: bookingId },
        query: { expand: 'client,host' },
      }),
    })
    queryClient.invalidateQueries({ queryKey: listBookingsQueryKey() })
  }

  const confirm = useOptimisticMutation(confirmBookingMutation(), {
    optimistic: {
      queryKey: () =>
        getBookingQueryKey({
          path: { booking: bookingId },
          query: { expand: 'client,host' },
        }),
      updater: (current: Booking | undefined) =>
        current ? { ...current, status: 'confirmed' as const } : current,
    },
  })

  const reject = useOptimisticMutation(rejectBookingMutation(), {
    optimistic: {
      queryKey: () =>
        getBookingQueryKey({
          path: { booking: bookingId },
          query: { expand: 'client,host' },
        }),
      updater: (current: Booking | undefined) =>
        current ? { ...current, status: 'rejected' as const } : current,
    },
  })

  const cancel = useOptimisticMutation(cancelBookingMutation(), {
    optimistic: {
      queryKey: () =>
        getBookingQueryKey({
          path: { booking: bookingId },
          query: { expand: 'client,host' },
        }),
      updater: (current: Booking | undefined) =>
        current ? { ...current, status: 'cancelled' as const } : current,
    },
  })

  // Pay-stub state: payInvoice returns a checkout URL we display rather than
  // auto-redirect.
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null)
  const pay = useMutation({
    ...payInvoiceMutation(),
    meta: { toast: { error: 'Could not start payment' } },
    onSuccess: (resp) => {
      if (resp.checkoutUrl) setCheckoutUrl(resp.checkoutUrl)
    },
  })

  const isVideoOpen = useMemo(() => {
    if (!booking || booking.status !== 'confirmed') return false
    const delta = Math.abs(Date.now() - booking.scheduledAt.getTime())
    return delta <= VIDEO_WINDOW_MS
  }, [booking])

  if (bookingQuery.isPending) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!booking) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Booking not found.</p>
      </div>
    )
  }

  const counterpartyName = isClient
    ? nameOf(booking.host, 'Host')
    : nameOf(booking.client, 'Client')
  const myDisplayName =
    [auth.user?.name].filter(Boolean).join(' ') || auth.user?.email || 'Me'

  const handleHostAction = (action: 'confirm' | 'reject') => {
    const m = action === 'confirm' ? confirm : reject
    m.mutate(
      { path: { booking: bookingId }, body: { reason: '' } },
      { onSettled: invalidateBooking },
    )
  }

  return (
    <div className="grid gap-6 p-6 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <ActiveBookingCard
          booking={booking}
          hostId={hostId ?? ''}
          hostName={counterpartyName}
          user={auth.user ?? undefined}
          onPaymentClick={() => {
            if (booking.invoice)
              pay.mutate({ path: { invoice: booking.invoice }, body: {} })
          }}
          onCancelClick={() =>
            cancel.mutate(
              { path: { booking: bookingId }, body: { reason: 'Cancelled by user' } },
              { onSettled: invalidateBooking },
            )
          }
          onProfileClick={() => navigate({ to: '/settings/account' })}
          onBrowseHosts={() => navigate({ to: '/bookings' })}
          onViewAppointments={() => navigate({ to: '/bookings' })}
        />

        {isHost && booking.status === 'pending' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Respond to this request</CardTitle>
              <CardDescription>
                {nameOf(booking.client, 'A client')} is waiting on you.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex gap-2">
              <Button
                onClick={() => handleHostAction('confirm')}
                disabled={confirm.isPending}
              >
                Accept
              </Button>
              <Button
                variant="outline"
                onClick={() => handleHostAction('reject')}
                disabled={reject.isPending}
              >
                Decline
              </Button>
            </CardContent>
          </Card>
        )}

        {checkoutUrl && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Stripe checkout link</CardTitle>
              <CardDescription>
                The pay button is a stub — we surface the link instead of redirecting.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <a
                href={checkoutUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 break-all text-primary underline"
              >
                {checkoutUrl}
                <ExternalLink className="h-3 w-3" />
              </a>
            </CardContent>
          </Card>
        )}

        <VideoCallPanel
          roomId={room?.id ?? bookingId}
          isInitiator={isHost}
          displayName={myDisplayName}
          enabled={isVideoOpen && !!room}
        />
      </div>

      <div className="lg:col-span-1">
        {room && myPersonId ? (
          <ChatThread roomId={room.id} myPersonId={myPersonId} />
        ) : (
          <Card>
            <CardContent className="p-6">
              <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
