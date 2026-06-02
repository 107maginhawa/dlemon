/**
 * use-online-booking.ts (P1-25)
 *
 * Data orchestration for the public self-service booking wizard. Wraps the
 * generated SDK hooks for booking-config, availability, hold, commit, and
 * lookup. These call the unauthenticated /dental/public/* endpoints, so no
 * session is required — the SDK client base URL is configured by ApiProvider.
 */

import { useMemo, useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  getPublicBookingConfigOptions,
  getPublicAvailabilityOptions,
  createBookingHoldMutation,
  createOnlineBookingMutation,
} from '@monobase/sdk-ts/generated/react-query'

export type VisitType = 'checkup' | 'treatment' | 'emergency' | 'recall'

/** YYYY-MM-DD for a Date (local). */
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function useBookingConfig(branchId: string) {
  return useQuery({
    ...getPublicBookingConfigOptions({ path: { branchId } }),
    retry: false,
  })
}

export function useAvailability(args: {
  branchId: string
  visitType?: VisitType
  providerId?: string
  dateFrom: Date
  dateTo: Date
  enabled: boolean
}) {
  const { branchId, visitType, providerId, dateFrom, dateTo, enabled } = args
  return useQuery({
    ...getPublicAvailabilityOptions({
      path: { branchId },
      query: {
        visitType: (visitType ?? 'checkup') as VisitType,
        date_from: isoDate(dateFrom),
        date_to: isoDate(dateTo),
        ...(providerId ? { providerId } : {}),
      },
    }),
    enabled: enabled && !!visitType,
    retry: false,
  })
}

export function useCreateHold() {
  return useMutation(createBookingHoldMutation())
}

export function useCreateBooking() {
  return useMutation(createOnlineBookingMutation())
}

/** Wizard step state machine for the booking flow. */
export type BookingStep = 'service' | 'slot' | 'details' | 'confirmed'

export interface SelectedSlot {
  // The SDK response transformer converts utcDateTime fields to Date objects,
  // and the request bodies likewise expect Date — keep slot times as Date.
  startAt: Date
  endAt: Date
  providerId: string
  visitType: VisitType
}

export function useBookingWizard() {
  const [step, setStep] = useState<BookingStep>('service')
  const [visitType, setVisitType] = useState<VisitType | undefined>()
  const [providerId, setProviderId] = useState<string | undefined>()
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | undefined>()
  const [sessionToken, setSessionToken] = useState<string | undefined>()
  const [confirmation, setConfirmation] = useState<
    { confirmationCode: string; startAt: Date } | undefined
  >()

  // A 14-day default availability window from today.
  const window = useMemo(() => {
    const from = new Date()
    const to = new Date()
    to.setDate(to.getDate() + 14)
    return { from, to }
  }, [])

  function reset() {
    setStep('service')
    setVisitType(undefined)
    setProviderId(undefined)
    setSelectedSlot(undefined)
    setSessionToken(undefined)
    setConfirmation(undefined)
  }

  return {
    step, setStep,
    visitType, setVisitType,
    providerId, setProviderId,
    selectedSlot, setSelectedSlot,
    sessionToken, setSessionToken,
    confirmation, setConfirmation,
    window,
    reset,
  }
}
