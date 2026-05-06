import { describe, test, expect, afterEach, mock } from 'bun:test'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Mock SDK mutations before importing component
mock.module('@monobase/sdk-ts/generated/react-query', () => ({
  createBookingEventMutation: mock(() => ({
    mutationFn: mock(async () => ({ id: 'new-event-1', title: 'Test' })),
  })),
  updateBookingEventMutation: mock(() => ({
    mutationFn: mock(async () => ({ id: 'event-1', title: 'Updated' })),
  })),
  listBookingEventsQueryKey: mock(() => ['bookingEvents']),
}))

import { BookingEventEditor } from './booking-event-editor'
import type { BookingEvent } from '@monobase/sdk-ts/generated/types.gen'

afterEach(() => cleanup())

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={makeQueryClient()}>
      {children}
    </QueryClientProvider>
  )
}

function makeExistingEvent(overrides: Partial<BookingEvent> = {}): BookingEvent {
  return {
    id: 'event-1',
    hostId: 'host-1',
    title: 'Existing Consultation',
    description: 'An existing event',
    timezone: 'America/New_York',
    locationTypes: ['video'],
    status: 'active',
    priceCents: 5000,
    currency: 'USD',
    cancellationThresholdMinutes: 1440,
    dailyConfigs: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as unknown as BookingEvent
}

describe('BookingEventEditor', () => {
  test('renders create mode with empty title field', () => {
    render(
      <Wrapper>
        <BookingEventEditor existing={null} />
      </Wrapper>
    )
    const titleInput = screen.getByLabelText(/title/i) as HTMLInputElement
    expect(titleInput).toBeDefined()
    expect(titleInput.value).toBe('')
  })

  test('renders edit mode pre-filled with existing event data', () => {
    render(
      <Wrapper>
        <BookingEventEditor existing={makeExistingEvent()} />
      </Wrapper>
    )
    const titleInput = screen.getByLabelText(/title/i) as HTMLInputElement
    expect(titleInput.value).toBe('Existing Consultation')
  })

  test('renders description field', () => {
    render(
      <Wrapper>
        <BookingEventEditor existing={null} />
      </Wrapper>
    )
    expect(screen.getByLabelText(/description/i)).toBeDefined()
  })

  test('renders timezone field', () => {
    render(
      <Wrapper>
        <BookingEventEditor existing={null} />
      </Wrapper>
    )
    expect(screen.getByLabelText(/timezone/i)).toBeDefined()
  })

  test('renders location type checkboxes', () => {
    render(
      <Wrapper>
        <BookingEventEditor existing={null} />
      </Wrapper>
    )
    expect(screen.getByText('video')).toBeDefined()
    expect(screen.getByText('phone')).toBeDefined()
    expect(screen.getByText('in-person')).toBeDefined()
  })

  test('renders Publish/Draft switch', () => {
    render(
      <Wrapper>
        <BookingEventEditor existing={null} />
      </Wrapper>
    )
    expect(screen.getByLabelText(/publish/i)).toBeDefined()
  })

  test('shows "Publish schedule" button in create mode', () => {
    render(
      <Wrapper>
        <BookingEventEditor existing={null} />
      </Wrapper>
    )
    expect(screen.getByRole('button', { name: /publish schedule/i })).toBeDefined()
  })

  test('shows "Save changes" button in edit mode', () => {
    render(
      <Wrapper>
        <BookingEventEditor existing={makeExistingEvent()} />
      </Wrapper>
    )
    expect(screen.getByRole('button', { name: /save changes/i })).toBeDefined()
  })

  test('user can type into title field', async () => {
    render(
      <Wrapper>
        <BookingEventEditor existing={null} />
      </Wrapper>
    )
    const user = userEvent.setup()
    const titleInput = screen.getByLabelText(/title/i) as HTMLInputElement
    await user.clear(titleInput)
    await user.type(titleInput, 'My New Event')
    expect(titleInput.value).toBe('My New Event')
  })

  test('shows pricing section', () => {
    render(
      <Wrapper>
        <BookingEventEditor existing={null} />
      </Wrapper>
    )
    expect(screen.getByText(/pricing/i)).toBeDefined()
    expect(screen.getByLabelText(/price/i)).toBeDefined()
  })

  test('shows "Free" preview price when price is 0', () => {
    render(
      <Wrapper>
        <BookingEventEditor existing={null} />
      </Wrapper>
    )
    expect(screen.getByText('Free')).toBeDefined()
  })
})
