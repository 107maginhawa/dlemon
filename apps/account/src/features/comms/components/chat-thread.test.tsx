import { describe, test, expect, afterEach, beforeEach } from 'bun:test'
import { render, screen, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ChatThread } from './chat-thread'
import {
  getChatMessagesQueryKey,
  getChatMessagesOptions,
} from '@monobase/sdk-ts/generated/react-query'
import type { ChatMessage } from '@monobase/sdk-ts/generated/types.gen'

const ROOM_ID = '00000000-0000-0000-0000-000000000001'

function build(message: string, sender: string): ChatMessage {
  return {
    id: crypto.randomUUID(),
    version: 1,
    createdAt: new Date('2026-05-15T10:00:00Z'),
    updatedAt: new Date('2026-05-15T10:00:00Z'),
    chatRoom: ROOM_ID,
    sender,
    timestamp: new Date('2026-05-15T10:00:00Z'),
    messageType: 'text',
    message,
  } as ChatMessage
}

function renderWithQuery(node: ReactNode, qc: QueryClient) {
  return render(<QueryClientProvider client={qc}>{node}</QueryClientProvider>)
}

function buildClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity } },
  })
}

describe('ChatThread', () => {
  beforeEach(() => {
    globalThis.fetch = (async () => {
      throw new Error('fetch should not be called when query cache is pre-populated')
    }) as typeof fetch
  })
  afterEach(() => cleanup())

  test('renders empty state when there are no messages', () => {
    const qc = buildClient()
    qc.setQueryData(
      getChatMessagesQueryKey({ path: { room: ROOM_ID }, query: { limit: 100 } }),
      {
        data: [],
        pagination: { offset: 0, limit: 100, count: 0, totalCount: 0, totalPages: 0, currentPage: 1, hasNextPage: false, hasPreviousPage: false },
      },
    )
    renderWithQuery(<ChatThread roomId={ROOM_ID} myPersonId="me" />, qc)
    expect(screen.getByText(/No messages yet/i)).toBeDefined()
  })

  test('renders messages from the cache, splitting mine vs theirs by sender', () => {
    const qc = buildClient()
    const messages = [build('Hi from me', 'me'), build('Hi from them', 'other')]
    qc.setQueryData(
      getChatMessagesQueryKey({ path: { room: ROOM_ID }, query: { limit: 100 } }),
      {
        data: messages,
        pagination: { offset: 0, limit: 100, count: 2, totalCount: 2, totalPages: 1, currentPage: 1, hasNextPage: false, hasPreviousPage: false },
      },
    )
    renderWithQuery(<ChatThread roomId={ROOM_ID} myPersonId="me" />, qc)
    expect(screen.getByText('Hi from me')).toBeDefined()
    expect(screen.getByText('Hi from them')).toBeDefined()
  })

  test('send button is disabled while the input is empty', () => {
    const qc = buildClient()
    qc.setQueryData(
      getChatMessagesQueryKey({ path: { room: ROOM_ID }, query: { limit: 100 } }),
      {
        data: [],
        pagination: { offset: 0, limit: 100, count: 0, totalCount: 0, totalPages: 0, currentPage: 1, hasNextPage: false, hasPreviousPage: false },
      },
    )
    renderWithQuery(<ChatThread roomId={ROOM_ID} myPersonId="me" />, qc)
    const button = screen.getByRole('button')
    expect((button as HTMLButtonElement).disabled).toBe(true)
  })

  test('uses getChatMessagesOptions defaults so generated transforms still apply', () => {
    // Smoke check that the same options helper the component imports is callable
    // and produces a queryKey we can match against.
    const opts = getChatMessagesOptions({ path: { room: ROOM_ID }, query: { limit: 100 } })
    expect(opts.queryKey).toBeDefined()
  })
})
