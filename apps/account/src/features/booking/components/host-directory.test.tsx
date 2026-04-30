import { describe, test, expect, afterEach, beforeEach, mock } from 'bun:test'
import { render, screen, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

// Stub TanStack Router's <Link> so we don't need a full RouterProvider.
// The component only uses Link's children/className visually.
mock.module('@tanstack/react-router', () => ({
  Link: ({ children, className }: { children: ReactNode; className?: string }) => (
    <a className={className}>{children}</a>
  ),
}))

import { HostDirectory } from './host-directory'
import { listBookingEventsQueryKey } from '@monobase/sdk-ts/generated/react-query'
import type { BookingEvent } from '@monobase/sdk-ts/generated/types.gen'

function buildEvent(): BookingEvent {
  return {
    id: 'e-1',
    version: 1,
    createdAt: new Date('2026-04-30T00:00:00Z'),
    updatedAt: new Date('2026-04-30T00:00:00Z'),
    owner: {
      id: 'p-1',
      version: 1,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
      firstName: 'Ada',
      lastName: 'Lovelace',
    },
    title: 'Coaching session',
    description: 'A short discussion of analytical engines.',
    timezone: 'UTC',
    locationTypes: ['video'],
    maxBookingDays: 30,
    minBookingMinutes: 1440,
    status: 'active',
    effectiveFrom: new Date('2026-04-30T00:00:00Z'),
    dailyConfigs: {},
  } as BookingEvent
}

function renderWithQuery(node: ReactNode, qc: QueryClient) {
  return render(<QueryClientProvider client={qc}>{node}</QueryClientProvider>)
}

function buildClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity } },
  })
}

describe('HostDirectory', () => {
  beforeEach(() => {
    // Generated client uses native fetch by default; ensure we never hit the network.
    globalThis.fetch = (async () => {
      throw new Error('fetch should not be called when query cache is pre-populated')
    }) as typeof fetch
  })
  afterEach(() => cleanup())

  test('renders host cards with name and event title from cache', () => {
    const qc = buildClient()
    const key = listBookingEventsQueryKey({
      query: { status: 'active', expand: 'owner', limit: 50 },
    })
    qc.setQueryData(key, {
      data: [buildEvent()],
      pagination: { offset: 0, limit: 50, count: 1, totalCount: 1, totalPages: 1, currentPage: 1, hasNextPage: false, hasPreviousPage: false },
    })

    renderWithQuery(<HostDirectory />, qc)
    expect(screen.getByText('Coaching session')).toBeDefined()
    expect(screen.getByText('Ada Lovelace')).toBeDefined()
  })

  test('shows the empty state when no active events exist', () => {
    const qc = buildClient()
    const key = listBookingEventsQueryKey({
      query: { status: 'active', expand: 'owner', limit: 50 },
    })
    qc.setQueryData(key, {
      data: [],
      pagination: { offset: 0, limit: 50, count: 0, totalCount: 0, totalPages: 0, currentPage: 1, hasNextPage: false, hasPreviousPage: false },
    })

    renderWithQuery(<HostDirectory />, qc)
    expect(screen.getByText(/No active hosts yet/i)).toBeDefined()
  })

  test('skips events whose owner did not expand into a Person', () => {
    const qc = buildClient()
    const key = listBookingEventsQueryKey({
      query: { status: 'active', expand: 'owner', limit: 50 },
    })
    const eventWithStringOwner = { ...buildEvent(), owner: 'p-1' }
    qc.setQueryData(key, {
      data: [eventWithStringOwner],
      pagination: { offset: 0, limit: 50, count: 1, totalCount: 1, totalPages: 1, currentPage: 1, hasNextPage: false, hasPreviousPage: false },
    })

    renderWithQuery(<HostDirectory />, qc)
    // Card omits because we can't link without a person ID; falls back to no
    // visible host title text in the directory.
    expect(screen.queryByText('Coaching session')).toBeNull()
  })
})
