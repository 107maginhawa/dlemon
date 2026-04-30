import { useState, useEffect, useMemo } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  createBookingEventMutation,
  updateBookingEventMutation,
  listBookingEventsQueryKey,
} from '@monobase/sdk-ts/generated/react-query'
import type {
  BookingEvent,
  LocationType,
} from '@monobase/sdk-ts/generated/types.gen'
import {
  DAY_KEYS,
  DAY_LABELS,
  type DayState,
  type FormState,
  emptyState,
  eventToState,
  stateToCreateBody,
  stateToUpdateBody,
} from '@/features/booking/lib/event-state'
import { Button } from '@/components/button'
import { Input } from '@/components/input'
import { Label } from '@/components/label'
import { Switch } from '@/components/switch'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/select'
import { Checkbox } from '@/components/checkbox'

const LOCATION_OPTIONS: LocationType[] = ['video', 'phone', 'in-person']

export interface BookingEventEditorProps {
  /** Existing event to edit, or null if the user has no event yet. */
  existing: BookingEvent | null
}

export function BookingEventEditor({ existing }: BookingEventEditorProps) {
  const queryClient = useQueryClient()
  const [state, setState] = useState<FormState>(() =>
    existing ? eventToState(existing) : emptyState(),
  )

  useEffect(() => {
    if (existing) setState(eventToState(existing))
  }, [existing])

  const create = useMutation({
    ...createBookingEventMutation(),
    meta: {
      toast: { success: 'Schedule published', error: 'Could not save schedule' },
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: listBookingEventsQueryKey() })
    },
  })

  const update = useMutation({
    ...updateBookingEventMutation(),
    meta: {
      toast: { success: 'Schedule updated', error: 'Could not save schedule' },
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: listBookingEventsQueryKey() })
    },
  })

  const submitting = create.isPending || update.isPending

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (existing) {
      update.mutate({ path: { event: existing.id }, body: stateToUpdateBody(state) })
    } else {
      create.mutate({ body: stateToCreateBody(state) })
    }
  }

  const updateDay = (key: (typeof DAY_KEYS)[number], patch: Partial<DayState>) => {
    setState((s) => ({ ...s, days: { ...s.days, [key]: { ...s.days[key], ...patch } } }))
  }

  const toggleLocation = (loc: LocationType) => {
    setState((s) => {
      const has = s.locationTypes.includes(loc)
      return {
        ...s,
        locationTypes: has
          ? s.locationTypes.filter((l) => l !== loc)
          : [...s.locationTypes, loc],
      }
    })
  }

  const previewPrice = useMemo(
    () =>
      state.priceCents > 0
        ? `${state.currency} ${(state.priceCents / 100).toFixed(2)} per booking`
        : 'Free',
    [state.priceCents, state.currency],
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Event details</CardTitle>
          <CardDescription>What people see when they book with you.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              required
              value={state.title}
              onChange={(e) => setState((s) => ({ ...s, title: e.target.value }))}
              placeholder="e.g. 30-minute consultation"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={state.description}
              onChange={(e) => setState((s) => ({ ...s, description: e.target.value }))}
              placeholder="Optional. Describe what you offer."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <Input
              id="timezone"
              value={state.timezone}
              onChange={(e) => setState((s) => ({ ...s, timezone: e.target.value }))}
              placeholder="America/New_York"
            />
          </div>
          <div className="space-y-2">
            <Label>Location types</Label>
            <div className="flex gap-4">
              {LOCATION_OPTIONS.map((loc) => (
                <label key={loc} className="flex items-center gap-2 capitalize">
                  <Checkbox
                    checked={state.locationTypes.includes(loc)}
                    onCheckedChange={() => toggleLocation(loc)}
                  />
                  {loc}
                </label>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="status">Publish</Label>
              <p className="text-sm text-muted-foreground">
                Active events appear in the bookings directory.
              </p>
            </div>
            <Switch
              id="status"
              checked={state.status === 'active'}
              onCheckedChange={(active) =>
                setState((s) => ({ ...s, status: active ? 'active' : 'draft' }))
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Weekly availability</CardTitle>
          <CardDescription>Toggle each day and set the open hours.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {DAY_KEYS.map((key) => {
            const day = state.days[key]
            return (
              <div key={key} className="flex items-center gap-3">
                <div className="flex w-32 items-center gap-2">
                  <Checkbox
                    checked={day.enabled}
                    onCheckedChange={(checked) => updateDay(key, { enabled: !!checked })}
                  />
                  <span className="text-sm">{DAY_LABELS[key]}</span>
                </div>
                <Input
                  type="time"
                  value={day.startTime}
                  disabled={!day.enabled}
                  onChange={(e) => updateDay(key, { startTime: e.target.value })}
                  className="w-28"
                />
                <span className="text-muted-foreground">→</span>
                <Input
                  type="time"
                  value={day.endTime}
                  disabled={!day.enabled}
                  onChange={(e) => updateDay(key, { endTime: e.target.value })}
                  className="w-28"
                />
                <div className="ml-2 flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Slot</Label>
                  <Select
                    value={String(day.slotDuration)}
                    onValueChange={(v) => updateDay(key, { slotDuration: Number(v) })}
                    disabled={!day.enabled}
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15m</SelectItem>
                      <SelectItem value="30">30m</SelectItem>
                      <SelectItem value="45">45m</SelectItem>
                      <SelectItem value="60">60m</SelectItem>
                      <SelectItem value="90">90m</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pricing (optional)</CardTitle>
          <CardDescription>Leave at 0 for free bookings.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price">Price</Label>
              <Input
                id="price"
                type="number"
                min={0}
                step="0.01"
                value={state.priceCents / 100}
                onChange={(e) =>
                  setState((s) => ({
                    ...s,
                    priceCents: Math.max(0, Math.round(Number(e.target.value) * 100)),
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Input
                id="currency"
                value={state.currency}
                onChange={(e) => setState((s) => ({ ...s, currency: e.target.value.toUpperCase() }))}
              />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">{previewPrice}</p>
          {state.priceCents > 0 && (
            <p className="text-xs text-muted-foreground">
              Set up Stripe Connect under Settings → Billing to actually receive payments.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : existing ? 'Save changes' : 'Publish schedule'}
        </Button>
      </div>
    </form>
  )
}
