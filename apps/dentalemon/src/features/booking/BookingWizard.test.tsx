/**
 * BookingWizard component tests (P1-25)
 *
 * Drives the public booking wizard's render + step transitions by mocking the
 * data hooks (use-online-booking). Covers: disabled-branch empty state, the
 * service -> slot -> details -> confirmed happy path, the empty-slots state, and
 * the slot-taken error path that bounces back to the grid.
 */

import { describe, test, expect, afterEach, beforeEach, mock } from 'bun:test'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

// ── Mockable hook state ────────────────────────────────────────────────────
let configReturn: any
let availabilityReturn: any
const holdMutate = mock(async () => ({ sessionToken: 'tok-123' }))
const bookingMutate = mock(async () => ({ confirmationCode: 'ABC123DEF4', startAt: new Date('2099-01-05T09:00:00Z') }))

mock.module('./use-online-booking', () => {
  // Minimal in-test wizard state machine (mirrors the real one's shape).
  // Use the top-level React import (require() is lint-forbidden).
  const React2 = React
  return {
    useBookingConfig: () => configReturn,
    useAvailability: () => availabilityReturn,
    useCreateHold: () => ({ mutateAsync: holdMutate, isPending: false, isError: false }),
    useCreateBooking: () => ({ mutateAsync: bookingMutate, isPending: false, isError: false }),
    useBookingWizard: () => {
      const [step, setStep] = React2.useState('service')
      const [visitType, setVisitType] = React2.useState(undefined)
      const [providerId, setProviderId] = React2.useState(undefined)
      const [selectedSlot, setSelectedSlot] = React2.useState(undefined)
      const [sessionToken, setSessionToken] = React2.useState(undefined)
      const [confirmation, setConfirmation] = React2.useState(undefined)
      return {
        step, setStep, visitType, setVisitType, providerId, setProviderId,
        selectedSlot, setSelectedSlot, sessionToken, setSessionToken,
        confirmation, setConfirmation,
        window: { from: new Date(), to: new Date() },
        reset: () => setStep('service'),
      }
    },
  }
})

const { BookingWizard } = await import('./BookingWizard')

const ENABLED_CONFIG = {
  branchId: 'b1', branchName: 'Main Branch', timezone: 'UTC', enabled: true,
  bookableVisitTypes: ['checkup', 'recall'], leadTimeMinutes: 60, horizonDays: 60,
  slotStepMinutes: 30, requirePatientAuth: false,
  providers: [{ providerId: 'p1', displayName: 'Dr. Lee' }],
}

// The SDK response transformer yields Date objects for utcDateTime fields.
const SLOTS = {
  branchId: 'b1', visitType: 'checkup',
  slots: [
    { startAt: new Date('2099-01-05T09:00:00Z'), endAt: new Date('2099-01-05T09:30:00Z'), providerId: 'p1', visitType: 'checkup' },
    { startAt: new Date('2099-01-05T09:30:00Z'), endAt: new Date('2099-01-05T10:00:00Z'), providerId: 'p1', visitType: 'checkup' },
  ],
}

beforeEach(() => {
  configReturn = { data: ENABLED_CONFIG, isPending: false, isError: false }
  availabilityReturn = { data: SLOTS, isPending: false, isError: false, refetch: mock(() => {}) }
  holdMutate.mockClear()
  bookingMutate.mockClear()
})
afterEach(cleanup)

describe('BookingWizard', () => {
  test('shows a disabled-branch empty state when online booking is off', () => {
    configReturn = { data: { ...ENABLED_CONFIG, enabled: false }, isPending: false, isError: false }
    render(React.createElement(BookingWizard, { branchId: 'b1' }))
    expect(screen.getByText('Online booking unavailable')).not.toBeNull()
  })

  test('shows clinic-not-found on config error', () => {
    configReturn = { data: undefined, isPending: false, isError: true }
    render(React.createElement(BookingWizard, { branchId: 'b1' }))
    expect(screen.getByText('Clinic not found')).not.toBeNull()
  })

  test('renders bookable visit types + providers on the service step', () => {
    render(React.createElement(BookingWizard, { branchId: 'b1' }))
    expect(screen.getByTestId('visit-type-checkup')).not.toBeNull()
    expect(screen.getByTestId('visit-type-recall')).not.toBeNull()
    expect(screen.getByTestId('provider-p1')).not.toBeNull()
    expect(screen.getByTestId('provider-any')).not.toBeNull()
  })

  test('happy path: service -> slot -> details -> confirmed', async () => {
    const user = userEvent.setup()
    render(React.createElement(BookingWizard, { branchId: 'b1' }))

    await user.click(screen.getByTestId('visit-type-checkup'))
    await user.click(screen.getByTestId('to-slots'))

    // Slot grid renders the available times.
    const slotButtons = await screen.findAllByTestId('slot-option')
    expect(slotButtons.length).toBe(2)
    await user.click(slotButtons[0]!)
    await user.click(screen.getByTestId('hold-slot'))
    expect(holdMutate).toHaveBeenCalled()

    // Details step → fill name → confirm.
    const firstName = await screen.findByTestId('input-firstName')
    await user.type(firstName, 'Jordan')
    await user.click(screen.getByTestId('confirm-booking'))
    expect(bookingMutate).toHaveBeenCalled()

    // Confirmation shows the code.
    await waitFor(() => expect(screen.getByTestId('confirmation-code')).not.toBeNull())
    expect(screen.getByTestId('confirmation-code').textContent).toBe('ABC123DEF4')
  })

  test('empty-slots state when availability returns none', async () => {
    availabilityReturn = { data: { ...SLOTS, slots: [] }, isPending: false, isError: false, refetch: mock(() => {}) }
    const user = userEvent.setup()
    render(React.createElement(BookingWizard, { branchId: 'b1' }))
    await user.click(screen.getByTestId('visit-type-checkup'))
    await user.click(screen.getByTestId('to-slots'))
    expect(await screen.findByTestId('no-slots')).not.toBeNull()
  })

  test('slot-taken on commit bounces back to the slot grid', async () => {
    bookingMutate.mockImplementationOnce(async () => { throw new Error('SLOT_TAKEN') })
    const refetch = mock(() => {})
    availabilityReturn = { data: SLOTS, isPending: false, isError: false, refetch }
    const user = userEvent.setup()
    render(React.createElement(BookingWizard, { branchId: 'b1' }))
    await user.click(screen.getByTestId('visit-type-checkup'))
    await user.click(screen.getByTestId('to-slots'))
    const slotButtons = await screen.findAllByTestId('slot-option')
    await user.click(slotButtons[0]!)
    await user.click(screen.getByTestId('hold-slot'))
    await user.type(await screen.findByTestId('input-firstName'), 'Race')
    await user.click(screen.getByTestId('confirm-booking'))
    // Back on the slot step (grid visible again).
    await waitFor(() => expect(screen.getByTestId('step-slot')).not.toBeNull())
    expect(refetch).toHaveBeenCalled()
  })
})
