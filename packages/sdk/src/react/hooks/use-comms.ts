/**
 * React Hooks for Comms Module
 * Provides stateful management for chat rooms, messages, and video calls
 */

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  createChatRoom,
  listChatRooms,
  getChatRoom,
  getChatMessages,
  sendChatMessage,
  type ChatRoom,
  type ChatMessage,
  type CreateChatRoomRequest,
  type ListChatRoomsParams,
  type GetChatMessagesParams,
  type SendTextMessageRequest,
  type StartVideoCallRequest,
} from '../../services/comms'
import type { PaginatedResponse } from '../../api'
import { queryKeys } from '../query-keys'
import { ApiError } from '../../api'

// ============================================================================
// Chat Rooms Hooks
// ============================================================================

/**
 * Hook to list chat rooms where the current user is a participant
 */
export function useChatRooms(params?: ListChatRoomsParams) {
  return useQuery({
    queryKey: queryKeys.chatRoomsList(params),
    queryFn: () => listChatRooms(params),
    retry: (failureCount, error) => {
      // Don't retry on authentication errors
      if (error instanceof ApiError && error.status === 401) {
        return false
      }
      return failureCount < 3
    },
  })
}

/**
 * Hook to get a specific chat room by ID
 */
export function useChatRoom(roomId: string, options?: {
  enabled?: boolean
}) {
  return useQuery({
    queryKey: queryKeys.chatRoom(roomId),
    queryFn: () => getChatRoom(roomId),
    enabled: options?.enabled ?? true,
    retry: (failureCount, error) => {
      // Don't retry on authentication or not found errors
      if (error instanceof ApiError && (error.status === 401 || error.status === 404)) {
        return false
      }
      return failureCount < 3
    },
  })
}

/**
 * Hook to create a new chat room
 */
export function useCreateChatRoom(options?: {
  toastSuccess?: boolean,
  onSuccess?: (data: ChatRoom) => void
  toastError?: boolean,
  onError?: (error: Error) => void
}) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createChatRoom,
    onSuccess: (data) => {
      // Invalidate the chat rooms list
      queryClient.invalidateQueries({ queryKey: queryKeys.chatRooms() })
      // Set the new chat room data in cache
      queryClient.setQueryData(queryKeys.chatRoom(data.id), data)

      // Show success message for new rooms (status 201)
      // Upsert returns existing room with status 200
      if (options?.toastSuccess !== false) {
        toast.success('Chat room created successfully!')
      }

      options?.onSuccess?.(data)
    },
    onError: (error) => {
      console.error('Failed to create chat room:', error)
      if (options?.toastError !== false) {
        if (error instanceof ApiError) {
          if (error.status === 409) {
            toast.error('Chat room already exists. Try enabling upsert option.')
          } else {
            toast.error(error.message || 'Failed to create chat room')
          }
        } else {
          toast.error('Failed to create chat room. Please try again.')
        }
      }
      options?.onError?.(error)
    },
  })
}

/**
 * Hook to create or get existing chat room with upsert
 * Convenience wrapper around useCreateChatRoom with upsert: true
 */
export function useUpsertChatRoom(options?: {
  toastSuccess?: boolean,
  onSuccess?: (data: ChatRoom, created: boolean) => void
  toastError?: boolean,
  onError?: (error: Error) => void
}) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: Omit<CreateChatRoomRequest, 'upsert'>) =>
      createChatRoom({ ...request, upsert: true }),
    onSuccess: (data, variables) => {
      // Invalidate the chat rooms list
      queryClient.invalidateQueries({ queryKey: queryKeys.chatRooms() })
      // Set the chat room data in cache
      queryClient.setQueryData(queryKeys.chatRoom(data.id), data)

      // Determine if this was a new room or existing
      // We can check if the room already existed in our cache
      const existingData = queryClient.getQueryData<ChatRoom>(queryKeys.chatRoom(data.id))
      const isNew = !existingData || existingData.createdAt !== data.createdAt

      if (isNew && options?.toastSuccess !== false) {
        toast.success('Chat room created successfully!')
      }

      options?.onSuccess?.(data, isNew)
    },
    onError: (error) => {
      console.error('Failed to upsert chat room:', error)
      
      if (options?.toastError !== false) {
        if (error instanceof ApiError) {
          toast.error(error.message || 'Failed to create or get chat room')
        } else {
          toast.error('Failed to create or get chat room. Please try again.')
        }
      }
      
      options?.onError?.(error)
    },
  })
}

/**
 * Hook to prefetch a chat room
 * Useful for hover/focus states to improve perceived performance
 */
export function usePrefetchChatRoom() {
  const queryClient = useQueryClient()

  return (roomId: string) => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.chatRoom(roomId),
      queryFn: () => getChatRoom(roomId),
      staleTime: 5 * 60 * 1000, // Consider data stale after 5 minutes
    })
  }
}

/**
 * Hook to invalidate chat room queries
 * Useful for manual refresh or after external updates
 */
export function useInvalidateChatRooms() {
  const queryClient = useQueryClient()

  return {
    invalidateAll: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.chatRooms() })
    },
    invalidateRoom: (roomId: string) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.chatRoom(roomId) })
    },
    invalidateList: (params?: ListChatRoomsParams) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.chatRoomsList(params) })
    },
  }
}

// ============================================================================
// Chat Messages Hooks
// ============================================================================

/**
 * Hook to get messages from a chat room with pagination
 */
export function useChatMessages(
  roomId: string,
  params?: GetChatMessagesParams,
  options?: {
    enabled?: boolean
  }
) {
  return useQuery({
    queryKey: queryKeys.chatMessagesList(roomId, params),
    queryFn: () => getChatMessages(roomId, params),
    enabled: options?.enabled ?? true,
    retry: (failureCount, error) => {
      // Don't retry on authentication or not found errors
      if (error instanceof ApiError && (error.status === 401 || error.status === 404)) {
        return false
      }
      return failureCount < 3
    },
  })
}

/**
 * Hook to get messages with infinite scrolling
 * Useful for chat interfaces that load more messages on scroll
 */
export function useInfiniteChatMessages(
  roomId: string,
  params?: Omit<GetChatMessagesParams, 'offset' | 'limit'> & {
    limit?: number
  }
) {
  const limit = params?.limit ?? 50

  return useInfiniteQuery({
    queryKey: queryKeys.chatMessagesList(roomId, { ...params, limit }),
    queryFn: ({ pageParam }: { pageParam: number }) =>
      getChatMessages(roomId, {
        ...params,
        limit,
        offset: pageParam,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage: PaginatedResponse<ChatMessage>, pages: PaginatedResponse<ChatMessage>[]) => {
      const loadedCount = pages.reduce((sum, page) => sum + page.data.length, 0)
      if (loadedCount < lastPage.pagination.totalCount) {
        return loadedCount
      }
      return undefined
    },
    retry: (failureCount, error) => {
      // Don't retry on authentication or not found errors
      if (error instanceof ApiError && (error.status === 401 || error.status === 404)) {
        return false
      }
      return failureCount < 3
    },
  })
}

/**
 * Hook to send a text message to a chat room
 */
export function useSendMessage(options?: {
  toastSuccess?: boolean,
  onSuccess?: (data: ChatMessage) => void
  toastError?: boolean,
  onError?: (error: Error) => void
}) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ roomId, message }: {
      roomId: string
      message: string
    }) => {
      const request: SendTextMessageRequest = {
        messageType: 'text',
        message,
      }
      return sendChatMessage(roomId, request)
    },
    onSuccess: (data, variables) => {
      // Invalidate the messages list for this room
      queryClient.invalidateQueries({
        queryKey: queryKeys.chatMessages(variables.roomId)
      })

      // Also invalidate the chat room to update lastMessageAt and messageCount
      queryClient.invalidateQueries({
        queryKey: queryKeys.chatRoom(variables.roomId)
      })

      // Optionally update the chat rooms list to reflect the new last message
      queryClient.invalidateQueries({
        queryKey: queryKeys.chatRooms()
      })

      options?.onSuccess?.(data)
    },
    onError: (error) => {
      console.error('Failed to send message:', error)
      
      if (options?.toastError !== false) {
        if (error instanceof ApiError) {
          toast.error(error.message || 'Failed to send message')
        } else {
          toast.error('Failed to send message. Please try again.')
        }
      }
      
      options?.onError?.(error)
    },
  })
}

/**
 * Hook to start a video call in a chat room
 */
export function useStartVideoCall(options?: {
  toastSuccess?: boolean,
  onSuccess?: (data: ChatMessage) => void
  toastError?: boolean,
  onError?: (error: Error) => void
}) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ roomId, participants = [] }: {
      roomId: string
      participants?: Array<{
        user: string
        displayName: string
        audioEnabled: boolean
        videoEnabled: boolean
      }>
    }) => {
      const request: StartVideoCallRequest = {
        messageType: 'video_call',
        videoCallData: {
          status: 'starting',
          participants,
        },
      }
      return sendChatMessage(roomId, request)
    },
    onSuccess: (data, variables) => {
      // Invalidate the messages list for this room
      queryClient.invalidateQueries({
        queryKey: queryKeys.chatMessages(variables.roomId)
      })

      // Also invalidate the chat room to update activeVideoCallMessage
      queryClient.invalidateQueries({
        queryKey: queryKeys.chatRoom(variables.roomId)
      })

      if (options?.toastSuccess !== false) {
        toast.success('Video call started!')
      }

      options?.onSuccess?.(data)
    },
    onError: (error, variables) => {
      console.error('Failed to start video call:', error)
      
      if (options?.toastError !== false) {
        if (error instanceof ApiError) {
          if (error.status === 409) {
            toast.error('A video call is already active in this room')
          } else if (error.status === 403) {
            toast.error('You do not have permission to start a video call')
          } else {
            toast.error(error.message || 'Failed to start video call')
          }
        } else {
          toast.error('Failed to start video call. Please try again.')
        }
      }
      
      options?.onError?.(error)
    },
  })
}

/**
 * Hook to send a message (generic - can be text or video call)
 */
export function useSendChatMessage(options?: {
  toastSuccess?: boolean,
  onSuccess?: (data: ChatMessage) => void
  toastError?: boolean,
  onError?: (error: Error) => void
}) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ roomId, message }: {
      roomId: string
      message: SendTextMessageRequest | StartVideoCallRequest
    }) => sendChatMessage(roomId, message),
    onSuccess: (data, variables) => {
      // Invalidate the messages list for this room
      queryClient.invalidateQueries({
        queryKey: queryKeys.chatMessages(variables.roomId)
      })

      // Also invalidate the chat room
      queryClient.invalidateQueries({
        queryKey: queryKeys.chatRoom(variables.roomId)
      })

      // Optionally update the chat rooms list
      queryClient.invalidateQueries({
        queryKey: queryKeys.chatRooms()
      })

      const isVideoCall = variables.message.messageType === 'video_call'
      if (isVideoCall && options?.toastSuccess !== false) {
        toast.success('Video call started!')
      }

      options?.onSuccess?.(data)
    },
    onError: (error, variables) => {
      const isVideoCall = variables.message.messageType === 'video_call'
      const errorPrefix = isVideoCall ? 'Failed to start video call' : 'Failed to send message'

      console.error(errorPrefix + ':', error)
      
      if (options?.toastError !== false) {
        if (error instanceof ApiError) {
          if (error.status === 409 && isVideoCall) {
            toast.error('A video call is already active in this room')
          } else if (error.status === 403) {
            toast.error(`You do not have permission to ${isVideoCall ? 'start a video call' : 'send messages'}`)
          } else {
            toast.error(error.message || errorPrefix)
          }
        } else {
          toast.error(errorPrefix + '. Please try again.')
        }
      }
      
      options?.onError?.(error)
    },
  })
}

/**
 * Hook to prefetch messages for a chat room
 * Useful for hover/focus states to improve perceived performance
 */
export function usePrefetchChatMessages() {
  const queryClient = useQueryClient()

  return (roomId: string, params?: GetChatMessagesParams) => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.chatMessagesList(roomId, params),
      queryFn: () => getChatMessages(roomId, params),
      staleTime: 2 * 60 * 1000, // Consider data stale after 2 minutes
    })
  }
}

/**
 * Hook to invalidate chat message queries
 * Useful for manual refresh or after external updates
 */
export function useInvalidateChatMessages() {
  const queryClient = useQueryClient()

  return {
    invalidateAll: (roomId: string) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.chatMessages(roomId) })
    },
    invalidateList: (roomId: string, params?: GetChatMessagesParams) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.chatMessagesList(roomId, params) })
    },
    invalidateMessage: (roomId: string, messageId: string) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.chatMessage(roomId, messageId) })
    },
  }
}

/**
 * Hook for optimistic message updates
 * Adds message to cache immediately for better UX
 */
export function useOptimisticSendMessage(options?: {
  toastSuccess?: boolean,
  onSuccess?: (data: ChatMessage) => void
  toastError?: boolean,
  onError?: (error: Error, rollbackMessage: ChatMessage) => void
}) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ roomId, message, tempId, sender }: {
      roomId: string
      message: string
      tempId: string
      sender: string
    }) => {
      const request: SendTextMessageRequest = {
        messageType: 'text',
        message,
      }
      return sendChatMessage(roomId, request)
    },
    onMutate: async ({ roomId, message, tempId, sender }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.chatMessages(roomId) })

      // Snapshot the previous value
      const previousMessages = queryClient.getQueryData<PaginatedResponse<ChatMessage>>(
        queryKeys.chatMessagesList(roomId, {})
      )

      // Optimistically update with temporary message
      const tempMessage: ChatMessage = {
        id: tempId,
        chatRoom: roomId,
        sender,
        timestamp: new Date().toISOString(),
        messageType: 'text',
        message,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      if (previousMessages) {
        queryClient.setQueryData<PaginatedResponse<ChatMessage>>(
          queryKeys.chatMessagesList(roomId, {}),
          {
            ...previousMessages,
            data: [tempMessage, ...previousMessages.data],
            pagination: {
              ...previousMessages.pagination,
              count: previousMessages.pagination.count + 1,
              totalCount: previousMessages.pagination.totalCount + 1,
            },
          }
        )
      }

      // Return a context object with the snapshotted value
      return { previousMessages, tempMessage }
    },
    onError: (error, variables, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousMessages) {
        queryClient.setQueryData(
          queryKeys.chatMessagesList(variables.roomId, {}),
          context.previousMessages
        )
      }

      console.error('Failed to send message:', error)
      
      if (options?.toastError !== false) {
        if (error instanceof ApiError) {
          toast.error(error.message || 'Failed to send message')
        } else {
          toast.error('Failed to send message. Please try again.')
        }
      }

      if (context?.tempMessage) {
        options?.onError?.(error, context.tempMessage)
      }
    },
    onSettled: (data, error, variables) => {
      // Always refetch after error or success
      queryClient.invalidateQueries({
        queryKey: queryKeys.chatMessages(variables.roomId)
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.chatRoom(variables.roomId)
      })
    },
    onSuccess: (data) => {
      options?.onSuccess?.(data)
    },
  })
}
