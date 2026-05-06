import { describe, test, expect, afterEach, mock } from 'bun:test'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BookingWidget } from './booking-widget'
import type { BookingTimeSlot, BookingHost, BookingEventData } from './booking-widget'

afterEach(() => cleanup())

function makeHost(overrides: Partial<BookingHost> = {}): BookingHost {
  return {
    id: 'host-1',
    name: 'Dr. Smith',
    email: 'smith@example.com',
    bio: 'Experienced professional',
    ...overrides,
  }
}

function makeSlot(overrides: Partial<BookingTimeSlot> = {}): BookingTimeSlot {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const startTime = new Date(today)
  startTime.setHours(10, 0, 0, 0)
  const endTime = new Date(today)
  endTime.setHours(10, 30, 0, 0)

  return {
    id: 'slot-1',
    hostId: 'host-1',
    date: today,
    startTime,
    endTime,
    status: 'available',
    locationTypes: ['video'],
    price: 50,
    ...overrides,
  }
}

describe('BookingWidget', () => {
  test('renders "Book Session" title', () => {
    render(
      <BookingWidget
        host={makeHost()}
        slots={[makeSlot()]}
        onSlotSelect={mock(() => {})}
      />
    )
    expect(screen.getByText('Book Session')).toBeDefined()
  })

  test('renders 7 date selector buttons', () => {
    render(
      <BookingWidget
        host={makeHost()}
        slots={[makeSlot()]}
        onSlotSelect={mock(() => {})}
      />
    )
    const dateButtons = screen.getAllByTestId('date-selector')
    expect(dateButtons.length).toBe(7)
  })

  test('renders available time slot for today', () => {
    render(
      <BookingWidget
        host={makeHost()}
        slots={[makeSlot()]}
        onSlotSelect={mock(() => {})}
      />
    )
    const timeSlots = screen.getAllByTestId('time-slot')
    expect(timeSlots.length).toBeGreaterThan(0)
  })

  test('shows no-slots message when no available slots for selected date', () => {
    // Slot for a different date (not today)
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 5)
    futureDate.setHours(0, 0, 0, 0)

    render(
      <BookingWidget
        host={makeHost()}
        slots={[makeSlot({ date: futureDate, startTime: futureDate, endTime: futureDate })]}
        onSlotSelect={mock(() => {})}
      />
    )
    expect(screen.getByTestId('no-slots-message')).toBeDefined()
  })

  test('shows no-slots message when slots array is empty', () => {
    render(
      <BookingWidget
        host={makeHost()}
        slots={[]}
        onSlotSelect={mock(() => {})}
      />
    )
    expect(screen.getByTestId('no-slots-message')).toBeDefined()
  })

  test('calls onSlotSelect when time slot clicked', async () => {
    const onSlotSelect = mock(() => {})
    render(
      <BookingWidget
        host={makeHost()}
        slots={[makeSlot()]}
        onSlotSelect={onSlotSelect}
      />
    )
    const user = userEvent.setup()
    const slots = screen.getAllByTestId('time-slot')
    await user.click(slots[0])
    expect(onSlotSelect).toHaveBeenCalledTimes(1)
  })

  test('shows "Continue to Book" button after slot selected', async () => {
    const onSlotSelect = mock(() => {})
    render(
      <BookingWidget
        host={makeHost()}
        slots={[makeSlot()]}
        onSlotSelect={onSlotSelect}
      />
    )
    const user = userEvent.setup()
    const slots = screen.getAllByTestId('time-slot')
    await user.click(slots[0])

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /continue to book/i })).toBeDefined()
    })
  })

  test('slot button shows selected state after click', async () => {
    const onSlotSelect = mock(() => {})
    render(
      <BookingWidget
        host={makeHost()}
        slots={[makeSlot({ id: 'slot-x' })]}
        onSlotSelect={onSlotSelect}
      />
    )
    const user = userEvent.setup()
    const [slotBtn] = screen.getAllByTestId('time-slot')
    await user.click(slotBtn)
    await waitFor(() => {
      expect(slotBtn.getAttribute('data-selected')).toBe('true')
    })
  })

  test('does not render booked slots as available', () => {
    render(
      <BookingWidget
        host={makeHost()}
        slots={[makeSlot({ status: 'booked' }), makeSlot({ id: 'slot-2', status: 'blocked' })]}
        onSlotSelect={mock(() => {})}
      />
    )
    // No available slots so no time-slot buttons
    expect(screen.queryAllByTestId('time-slot').length).toBe(0)
  })
})
