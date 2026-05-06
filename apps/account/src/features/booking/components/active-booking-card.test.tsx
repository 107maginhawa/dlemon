import { describe, test, expect, afterEach, mock } from 'bun:test'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ActiveBookingCard } from './active-booking-card'
import type { Booking } from '@monobase/sdk-ts/generated/types.gen'

afterEach(() => cleanup())

function makeBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: 'booking-1',
    hostId: 'host-1',
    clientId: 'client-1',
    eventId: 'event-1',
    status: 'pending',
    scheduledAt: new Date('2026-06-01T10:00:00Z'),
    bookedAt: new Date(Date.now() - 60_000), // 1 minute ago
    durationMinutes: 30,
    locationTypes: ['video'],
    invoice: null,
    cancellationReason: null,
    notes: null,
    ...overrides,
  } as unknown as Booking
}

const defaultProps = {
  hostId: 'host-1',
  hostName: 'Dr. Smith',
  onPaymentClick: mock(() => {}),
  onCancelClick: mock(() => {}),
  onProfileClick: mock(() => {}),
}

describe('ActiveBookingCard', () => {
  test('renders pending booking with host name', () => {
    render(<ActiveBookingCard {...defaultProps} booking={makeBooking({ status: 'pending' })} />)
    expect(screen.getByText(/Dr\. Smith/)).toBeDefined()
  })

  test('renders pending state title', () => {
    render(<ActiveBookingCard {...defaultProps} booking={makeBooking({ status: 'pending' })} />)
    expect(screen.getByText(/booking pending confirmation/i)).toBeDefined()
  })

  test('renders confirmed state title', () => {
    render(<ActiveBookingCard {...defaultProps} booking={makeBooking({ status: 'confirmed' })} />)
    // Multiple elements contain "Appointment Confirmed" (card title + h3)
    expect(screen.getAllByText(/appointment confirmed/i).length).toBeGreaterThan(0)
  })

  test('renders rejected state', () => {
    render(<ActiveBookingCard {...defaultProps} booking={makeBooking({ status: 'rejected' })} />)
    expect(screen.getByText(/booking rejected/i)).toBeDefined()
    expect(screen.getByText(/booking request rejected/i)).toBeDefined()
  })

  test('renders cancelled state with title', () => {
    render(<ActiveBookingCard {...defaultProps} booking={makeBooking({ status: 'cancelled' })} />)
    expect(screen.getByText(/booking cancelled/i)).toBeDefined()
  })

  test('renders cancelled state with reason when provided', () => {
    render(
      <ActiveBookingCard
        {...defaultProps}
        booking={makeBooking({ status: 'cancelled', cancellationReason: 'Host unavailable' })}
      />
    )
    expect(screen.getByText(/host unavailable/i)).toBeDefined()
  })

  test('renders completed state', () => {
    render(<ActiveBookingCard {...defaultProps} booking={makeBooking({ status: 'completed' })} />)
    expect(screen.getByText(/appointment completed/i)).toBeDefined()
    expect(screen.getByText(/session completed/i)).toBeDefined()
  })

  test('shows browse hosts button when onBrowseHosts provided (rejected)', () => {
    const onBrowseHosts = mock(() => {})
    render(
      <ActiveBookingCard
        {...defaultProps}
        booking={makeBooking({ status: 'rejected' })}
        onBrowseHosts={onBrowseHosts}
      />
    )
    // Button text is "Browse Hosts" in rejected state
    expect(screen.getByRole('button', { name: /browse hosts/i })).toBeDefined()
  })

  test('shows view appointments button when onViewAppointments provided (completed)', () => {
    const onViewAppointments = mock(() => {})
    render(
      <ActiveBookingCard
        {...defaultProps}
        booking={makeBooking({ status: 'completed' })}
        onViewAppointments={onViewAppointments}
      />
    )
    expect(screen.getByRole('button', { name: /view my appointments/i })).toBeDefined()
  })

  test('shows cancel booking button in waiting state', () => {
    // isComplete = !needsProfile && !invoice. With invoice=null → isComplete=true, renders "Payment completed" section.
    // To reach the "Waiting" section: needsProfile=false, needsPayment=false, isComplete=false
    // isComplete=false requires invoice to be truthy but needsPayment=false means invoice falsy. Contradiction.
    // Instead, test the cancel button in the needsPayment path (invoice present + pending).
    const fakeInvoice = { id: 'inv-1', amount: 5000, currency: 'USD', status: 'pending' }
    render(
      <ActiveBookingCard
        {...defaultProps}
        booking={makeBooking({ status: 'pending', invoice: fakeInvoice as never })}
      />
    )
    expect(screen.getByRole('button', { name: /cancel booking request/i })).toBeDefined()
  })

  test('calls onBrowseHosts when button clicked (completed)', async () => {
    const onBrowseHosts = mock(() => {})
    render(
      <ActiveBookingCard
        {...defaultProps}
        booking={makeBooking({ status: 'completed' })}
        onBrowseHosts={onBrowseHosts}
      />
    )
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /book another appointment/i }))
    expect(onBrowseHosts).toHaveBeenCalledTimes(1)
  })
})
