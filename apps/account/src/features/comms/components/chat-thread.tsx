import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getChatMessagesOptions,
  getChatMessagesQueryKey,
  sendChatMessageMutation,
} from '@monobase/sdk-ts/generated/react-query'
import type { ChatMessage } from '@monobase/sdk-ts/generated/types.gen'
import { Button } from '@/components/button'
import { Input } from '@/components/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/card'
import { Loader2, Send } from 'lucide-react'

interface ChatThreadProps {
  roomId: string
  /** Person ID of the signed-in user, so we can right-align our own messages. */
  myPersonId: string
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

export function ChatThread({ roomId, myPersonId }: ChatThreadProps) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  // Poll for new messages every 5 seconds while the page is open. The detail
  // page is the only place chat is mounted, so this scopes nicely.
  const messagesQuery = useQuery({
    ...getChatMessagesOptions({ path: { room: roomId }, query: { limit: 100 } }),
    refetchInterval: 5_000,
    staleTime: 1_000,
  })

  const send = useMutation({
    ...sendChatMessageMutation(),
    meta: { toast: { error: 'Could not send message' } },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: getChatMessagesQueryKey({ path: { room: roomId }, query: { limit: 100 } }),
      })
    },
  })

  const messages: ChatMessage[] = messagesQuery.data?.data ?? []

  useEffect(() => {
    // Auto-scroll to bottom on new messages.
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages.length])

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault()
    const text = draft.trim()
    if (!text || send.isPending) return
    send.mutate(
      { path: { room: roomId }, body: { messageType: 'text', message: text } },
      { onSuccess: () => setDraft('') },
    )
  }

  return (
    <Card className="flex h-[480px] flex-col">
      <CardHeader className="border-b py-3">
        <CardTitle className="text-base">Chat</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3 overflow-hidden p-0">
        <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
          {messagesQuery.isPending ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No messages yet. Say hi.
            </p>
          ) : (
            messages.map((m) => {
              const mine = m.sender === myPersonId
              const text = m.message ?? '(non-text message)'
              return (
                <div
                  key={m.id}
                  className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                      mine
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-foreground'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{text}</p>
                    <p className={`mt-1 text-[10px] ${mine ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                      {formatTime(m.timestamp)}
                    </p>
                  </div>
                </div>
              )
            })
          )}
        </div>

        <form onSubmit={handleSend} className="flex items-center gap-2 border-t p-3">
          <Input
            placeholder="Type a message…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={send.isPending}
          />
          <Button type="submit" size="icon" disabled={!draft.trim() || send.isPending}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
