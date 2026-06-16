/**
 * BookingWizard.tsx (P1-25)
 *
 * Public, unauthenticated self-service booking flow for a single branch:
 *   service/visit-type + provider -> live slot grid -> contact details -> confirm.
 *
 * Uses the generated SDK public endpoints (config/availability/hold/booking).
 * Lemon brand accent comes through the `primary` design token only — no
 * hardcoded colors. Mobile-responsive; loading + empty + error states handled.
 */

import { useMemo } from 'react'
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
  Button, Input, Label, Badge, Skeleton, Logo,
} from '@monobase/ui'
import { Calendar, Clock, CheckCircle2, ArrowLeft, AlertCircle } from 'lucide-react'
import { toastError } from '@/lib/error-toast'
import {
  useBookingConfig, useAvailability, useCreateHold, useCreateBooking,
  useBookingWizard, type VisitType, type SelectedSlot,
} from './use-online-booking'

const VISIT_LABELS: Record<VisitType, string> = {
  checkup: 'Check-up',
  recall: 'Recall / Hygiene',
  treatment: 'Treatment',
  emergency: 'Emergency',
}

function formatTime(d: Date): string {
  return new Date(d).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}
function formatDayKey(d: Date): string {
  return new Date(d).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
}

export function BookingWizard({ branchId }: { branchId: string }) {
  const wiz = useBookingWizard()
  const configQuery = useBookingConfig(branchId)
  const config = configQuery.data

  const availabilityQuery = useAvailability({
    branchId,
    visitType: wiz.visitType,
    providerId: wiz.providerId,
    dateFrom: wiz.window.from,
    dateTo: wiz.window.to,
    enabled: wiz.step === 'slot' && !!wiz.visitType,
  })

  const createHold = useCreateHold()
  const createBooking = useCreateBooking()

  // Group available slots by day for the grid.
  const slotsByDay = useMemo(() => {
    const groups = new Map<string, SelectedSlot[]>()
    for (const s of availabilityQuery.data?.slots ?? []) {
      const key = formatDayKey(s.startAt)
      const list = groups.get(key) ?? []
      list.push(s as SelectedSlot)
      groups.set(key, list)
    }
    return Array.from(groups.entries())
  }, [availabilityQuery.data])

  if (configQuery.isPending) {
    return <Shell><Skeleton className="h-48 w-full" data-testid="booking-loading" /></Shell>
  }

  if (configQuery.isError || !config) {
    return (
      <Shell>
        <EmptyState
          icon={<AlertCircle className="size-8 text-muted-foreground" />}
          title="Clinic not found"
          description="We couldn't find this clinic. Please check the link and try again."
        />
      </Shell>
    )
  }

  if (!config.enabled) {
    return (
      <Shell>
        <EmptyState
          icon={<Calendar className="size-8 text-muted-foreground" />}
          title="Online booking unavailable"
          description={`${config.branchName} is not accepting online bookings right now. Please call the clinic to schedule.`}
        />
      </Shell>
    )
  }

  // ── Confirmed ───────────────────────────────────────────────────────────
  if (wiz.step === 'confirmed' && wiz.confirmation) {
    return (
      <Shell branchName={config.branchName}>
        <Card data-testid="booking-confirmed">
          <CardHeader className="items-center text-center">
            <CheckCircle2 className="size-12 text-primary" />
            <CardTitle>You&apos;re booked!</CardTitle>
            <CardDescription>
              {formatDayKey(wiz.confirmation.startAt)} at {formatTime(wiz.confirmation.startAt)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">Your confirmation code</p>
            <p className="font-mono text-2xl font-semibold tracking-widest" data-testid="confirmation-code">
              {wiz.confirmation.confirmationCode}
            </p>
            <p className="text-sm text-muted-foreground">
              The clinic will review and confirm your appointment. Keep this code to look up your booking.
            </p>
            <Button variant="outline" onClick={wiz.reset} className="w-full">Book another</Button>
          </CardContent>
        </Card>
      </Shell>
    )
  }

  return (
    <Shell branchName={config.branchName}>
      <Card>
        <CardHeader>
          <CardTitle>Book an appointment</CardTitle>
          <CardDescription>{config.branchName}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* ── Step: service + provider ─────────────────────────────────── */}
          {wiz.step === 'service' && (
            <div className="space-y-6" data-testid="step-service">
              <div className="space-y-2">
                <Label>What do you need?</Label>
                <div className="grid grid-cols-2 gap-2">
                  {config.bookableVisitTypes.map((vt) => (
                    <Button
                      key={vt}
                      type="button"
                      className="h-11"
                      variant={wiz.visitType === vt ? 'default' : 'outline'}
                      onClick={() => wiz.setVisitType(vt as VisitType)}
                      data-testid={`visit-type-${vt}`}
                    >
                      {VISIT_LABELS[vt as VisitType] ?? vt}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Provider</Label>
                <div className="grid gap-2">
                  <Button
                    type="button"
                    className="h-11"
                    variant={!wiz.providerId ? 'default' : 'outline'}
                    onClick={() => wiz.setProviderId(undefined)}
                    data-testid="provider-any"
                  >
                    Any available provider
                  </Button>
                  {config.providers.map((p) => (
                    <Button
                      key={p.providerId}
                      type="button"
                      className="h-11"
                      variant={wiz.providerId === p.providerId ? 'default' : 'outline'}
                      onClick={() => wiz.setProviderId(p.providerId)}
                      data-testid={`provider-${p.providerId}`}
                    >
                      {p.displayName}
                    </Button>
                  ))}
                </div>
              </div>

              <Button
                className="w-full"
                disabled={!wiz.visitType}
                onClick={() => wiz.setStep('slot')}
                data-testid="to-slots"
              >
                See available times
              </Button>
            </div>
          )}

          {/* ── Step: slot grid ──────────────────────────────────────────── */}
          {wiz.step === 'slot' && (
            <div className="space-y-4" data-testid="step-slot">
              <BackButton onClick={() => wiz.setStep('service')} />
              {availabilityQuery.isPending && <Skeleton className="h-40 w-full" data-testid="slots-loading" />}
              {availabilityQuery.isError && (
                <EmptyState
                  icon={<AlertCircle className="size-8 text-muted-foreground" />}
                  title="Couldn't load times"
                  description="Please try again in a moment."
                />
              )}
              {availabilityQuery.data && slotsByDay.length === 0 && (
                <EmptyState
                  icon={<Calendar className="size-8 text-muted-foreground" />}
                  title="No open times"
                  description="There are no available slots in the next two weeks. Please call the clinic."
                  data-testid="no-slots"
                />
              )}
              {slotsByDay.map(([day, slots]) => (
                <div key={day} className="space-y-2">
                  <p className="text-sm font-medium">{day}</p>
                  <div className="flex flex-wrap gap-2">
                    {slots.map((s) => (
                      <Button
                        key={`${s.providerId}-${s.startAt.toISOString()}`}
                        type="button"
                        className="h-11"
                        variant={wiz.selectedSlot?.startAt.getTime() === s.startAt.getTime() && wiz.selectedSlot?.providerId === s.providerId ? 'default' : 'outline'}
                        onClick={() => wiz.setSelectedSlot(s)}
                        data-testid="slot-option"
                      >
                        <Clock className="mr-1 size-3" />
                        {formatTime(s.startAt)}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
              {wiz.selectedSlot && (
                <Button
                  className="w-full"
                  disabled={createHold.isPending}
                  data-testid="hold-slot"
                  onClick={async () => {
                    const slot = wiz.selectedSlot!
                    try {
                      const hold = await createHold.mutateAsync({
                        path: { branchId },
                        body: { providerId: slot.providerId, startAt: slot.startAt, visitType: slot.visitType },
                      })
                      wiz.setSessionToken(hold.sessionToken)
                      wiz.setStep('details')
                    } catch (err) {
                      // Slot was taken between render and hold — refresh availability.
                      toastError(err, "Couldn't hold that time slot. Please pick another.")
                      wiz.setSelectedSlot(undefined)
                      void availabilityQuery.refetch()
                    }
                  }}
                >
                  {createHold.isPending ? 'Holding…' : `Continue — ${formatTime(wiz.selectedSlot.startAt)}`}
                </Button>
              )}
            </div>
          )}

          {/* ── Step: contact details ────────────────────────────────────── */}
          {wiz.step === 'details' && wiz.selectedSlot && (
            <ContactForm
              slot={wiz.selectedSlot}
              submitting={createBooking.isPending}
              error={createBooking.isError}
              onBack={() => wiz.setStep('slot')}
              onSubmit={async (details) => {
                try {
                  const res = await createBooking.mutateAsync({
                    path: { branchId },
                    body: {
                      providerId: wiz.selectedSlot!.providerId,
                      startAt: wiz.selectedSlot!.startAt,
                      visitType: wiz.selectedSlot!.visitType,
                      ...(wiz.sessionToken ? { sessionToken: wiz.sessionToken } : {}),
                      ...details,
                    },
                  })
                  wiz.setConfirmation({ confirmationCode: res.confirmationCode, startAt: res.startAt })
                  wiz.setStep('confirmed')
                } catch (err) {
                  // 409 SLOT_TAKEN → bounce back to the grid and re-fetch.
                  toastError(err, 'Booking failed. Please try again.')
                  wiz.setStep('slot')
                  wiz.setSelectedSlot(undefined)
                  void availabilityQuery.refetch()
                }
              }}
            />
          )}
        </CardContent>
      </Card>
    </Shell>
  )
}

function Shell({ children, branchName }: { children: React.ReactNode; branchName?: string }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-4 py-10">
      <div className="flex items-center justify-center gap-2">
        <Logo />
        {branchName && <Badge variant="secondary">{branchName}</Badge>}
      </div>
      {children}
    </div>
  )
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" onClick={onClick} className="h-11 -ml-2" data-testid="back">
      <ArrowLeft className="mr-1 size-4" /> Back
    </Button>
  )
}

function EmptyState({ icon, title, description, ...rest }: {
  icon: React.ReactNode; title: string; description: string
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center" {...rest}>
      {icon}
      <p className="font-medium">{title}</p>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

interface ContactDetails {
  firstName: string
  lastName?: string
  email?: string
  phone?: string
}

function ContactForm({ slot, submitting, error, onBack, onSubmit }: {
  slot: SelectedSlot
  submitting: boolean
  error: boolean
  onBack: () => void
  onSubmit: (d: ContactDetails) => void
}) {
  return (
    <form
      className="space-y-4"
      data-testid="step-details"
      onSubmit={(e) => {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)
        const firstName = String(fd.get('firstName') ?? '').trim()
        if (!firstName) return
        onSubmit({
          firstName,
          lastName: String(fd.get('lastName') ?? '').trim() || undefined,
          email: String(fd.get('email') ?? '').trim() || undefined,
          phone: String(fd.get('phone') ?? '').trim() || undefined,
        })
      }}
    >
      <BackButton onClick={onBack} />
      <div className="rounded-md border-l-4 border-primary bg-primary/10 p-3 text-sm font-semibold text-foreground">
        {formatDayKey(slot.startAt)} at {formatTime(slot.startAt)}
      </div>
      <div className="space-y-2">
        <Label htmlFor="firstName">First name *</Label>
        <Input id="firstName" name="firstName" required data-testid="input-firstName" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="lastName">Last name</Label>
        <Input id="lastName" name="lastName" data-testid="input-lastName" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Phone</Label>
        <Input id="phone" name="phone" type="tel" data-testid="input-phone" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" data-testid="input-email" />
      </div>
      {error && (
        <p className="text-sm text-destructive" data-testid="booking-error">
          That time was just taken. Please pick another slot.
        </p>
      )}
      <Button type="submit" className="w-full" disabled={submitting} data-testid="confirm-booking">
        {submitting ? 'Booking…' : 'Confirm booking'}
      </Button>
    </form>
  )
}
