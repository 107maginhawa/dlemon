import { describe, test, expect, afterEach, beforeEach, mock } from 'bun:test'
import { render, screen, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

mock.module('@tanstack/react-router', () => ({
  Link: ({ children, className }: { children: ReactNode; className?: string }) => (
    <a className={className}>{children}</a>
  ),
}))

import { BookingList } from './booking-list'
import { listBookingsQueryKey } from '@monobase/sdk-ts/generated/react-query'
import type { Booking } from '@monobase/sdk-ts/generated/types.gen'

const ME = '00000000-0000-0000-0000-000000000001'

function buildBooking(
  id: string,
  scheduledAt: string,
  reason: string,
  status: Booking['status'] = 'confirmed',
): Booking {
  return {
    id,
    version: 1,
    createdAt: new Date(scheduledAt),
    updatedAt: new Date(scheduledAt),
    client: ME,
    host: 'host-1',
    slot: 'slot-1',
    locationType: 'video',
    reason,
    status,
    bookedAt: new Date(scheduledAt),
    scheduledAt: new Date(scheduledAt),
    durationMinutes: 30,
  } as Booking
}

function emptyPaginated() {
  return {
    data: [] as Booking[],
    pagination: { offset: 0, limit: 100, count: 0, totalCount: 0, totalPages: 0, currentPage: 1, hasNextPage: false, hasPreviousPage: false },
  }
}

function paginated(items: Booking[]) {
  return {
    data: items,
    pagination: { offset: 0, limit: 100, count: items.length, totalCount: items.length, totalPages: 1, currentPage: 1, hasNextPage: false, hasPreviousPage: false },
  }
}

function renderWithQuery(node: ReactNode, qc: QueryClient) {
  return render(<QueryClientProvider client={qc}>{node}</QueryClientProvider>)
}

function buildClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity } },
  })
}

describe('BookingList', () => {
  beforeEach(() => {
    globalThis.fetch = (async () => {
      throw new Error('fetch should not be called when query cache is pre-populated')
    }) as typeof fetch
  })
  afterEach(() => cleanup())

  test('shows empty-state copy when both as-client and as-host lists are empty', () => {
    const qc = buildClient()
    qc.setQueryData(listBookingsQueryKey({ query: { client: ME, limit: 100 } }), emptyPaginated())
    qc.setQueryData(listBookingsQueryKey({ query: { host: ME, limit: 100 } }), emptyPaginated())
    renderWithQuery(<BookingList myPersonId={ME} />, qc)
    expect(screen.getByText(/You haven't booked anyone yet\./i)).toBeDefined()
  })

  test('renders an as-client booking with its reason and a status badge', () => {
    const qc = buildClient()
    const future = '2099-01-01T10:00:00Z' // far future so partition keeps it as upcoming
    qc.setQueryData(
      listBookingsQueryKey({ query: { client: ME, limit: 100 } }),
      paginated([buildBooking('b-1', future, 'Quarterly review', 'confirmed')]),
    )
    qc.setQueryData(listBookingsQueryKey({ query: { host: ME, limit: 100 } }), emptyPaginated())
    renderWithQuery(<BookingList myPersonId={ME} />, qc)
    expect(screen.getByText(/"Quarterly review"/)).toBeDefined()
    // Status badge text — `capitalize` is a CSS class so the text is still 'confirmed'
    expect(screen.getByText('confirmed')).toBeDefined()
  })
})
