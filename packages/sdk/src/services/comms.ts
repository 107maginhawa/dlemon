/**
 * Comms Service - REST API client for video call and chat functionality
 * Handles WebRTC signaling, ICE server configuration, and video call lifecycle
 */

import { apiGet, apiPost, apiPatch, type PaginatedResponse } from '../api'

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Chat room status
 */
export type ChatRoomStatus = 'active' | 'archived'

/**
 * Message type enumeration
 */
export type MessageType = 'text' | 'system' | 'video_call'

/**
 * Chat room for communication between participants
 */
export interface ChatRoom {
  /** Unique identifier */
  id: string
  /** Room participants (e.g., [client, service_provider]) */
  participants: string[]
  /** Room administrators who can control video calls */
  admins: string[]
  /** Optional context ID for contextual associations */
  context?: string
  /** Room status */
  status: ChatRoomStatus
  /** Last message timestamp for sorting and activity tracking */
  lastMessageAt?: string
  /** Total message count for efficient pagination */
  messageCount: number
  /** Efficiency reference to active video call message */
  activeVideoCallMessage?: string
  /** Creation timestamp */
  createdAt: string
  /** Last update timestamp */
  updatedAt: string
}

/**
 * Chat message with optional video call data
 */
export interface ChatMessage {
  /** Unique identifier */
  id: string
  /** Chat room reference */
  chatRoom: string
  /** Message sender (client or service provider) */
  sender: string
  /** Message timestamp */
  timestamp: string
  /** Message type determines content structure */
  messageType: MessageType
  /** Text content for text and system messages */
  message?: string
  /** Video call data for video call messages */
  videoCallData?: VideoCallData
  /** Creation timestamp */
  createdAt: string
  /** Last update timestamp */
  updatedAt: string
}

/**
 * Video call session data embedded in messages
 */
export interface VideoCallData {
  /** Current video call status */
  status: 'starting' | 'active' | 'ended' | 'cancelled'
  /** WebRTC room URL for active calls */
  roomUrl?: string
  /** Authentication token for WebRTC room access */
  token?: string
  /** Call start timestamp */
  startedAt?: string
  /** Person who started the call */
  startedBy?: string
  /** Call end timestamp */
  endedAt?: string
  /** Person who ended the call */
  endedBy?: string
  /** Call duration in minutes */
  durationMinutes?: number
  /** Call participants list */
  participants: CallParticipant[]
}

/**
 * Create chat room request
 */
export interface CreateChatRoomRequest {
  /** Participant IDs */
  participants: string[]
  /** Admin IDs (defaults to all participants if not specified) */
  admins?: string[]
  /** Optional context ID for contextual associations */
  context?: string
  /** If true, return existing room instead of error when unique constraint is hit */
  upsert?: boolean
}

/**
 * List chat rooms query parameters
 */
export interface ListChatRoomsParams {
  /** Filter by room status */
  status?: ChatRoomStatus
  /** Filter by context ID */
  context?: string
  /** Filter rooms that include both the current user AND the specified participant */
  withParticipant?: string
  /** Filter to show only rooms with active video calls */
  hasActiveCall?: boolean
  /** Number of items per page */
  limit?: number
  /** Offset for pagination */
  offset?: number
}

/**
 * Get chat messages query parameters
 */
export interface GetChatMessagesParams {
  /** Filter by message type */
  messageType?: MessageType
  /** Number of items per page */
  limit?: number
  /** Offset for pagination */
  offset?: number
}

/**
 * Send text message request
 */
export interface SendTextMessageRequest {
  /** Message type (always 'text' for this request) */
  messageType: 'text'
  /** Message content */
  message: string
}

/**
 * Start video call request
 */
export interface StartVideoCallRequest {
  /** Message type (always 'video_call' for this request) */
  messageType: 'video_call'
  /** Video call initialization data */
  videoCallData: {
    /** Initial call status */
    status: 'starting'
    /** Initial call participants */
    participants: CallParticipant[]
  }
}



/**
 * ICE (Interactive Connectivity Establishment) server configuration for WebRTC
 * Used for NAT traversal and establishing peer-to-peer connections
 */
export interface IceServer {
  /** STUN/TURN server URLs */
  urls: string | string[]
  /** Username for TURN server authentication (optional) */
  username?: string
  /** Credential for TURN server authentication (optional) */
  credential?: string
}

/**
 * Response containing ICE server configurations
 */
export interface IceServersResponse {
  /** List of ICE servers (STUN/TURN) for WebRTC peer connections */
  iceServers: IceServer[]
}

/**
 * Request to join an active video call
 */
export interface JoinVideoCallRequest {
  /** Display name shown in video call interface */
  displayName: string
  /** Initial audio enabled status */
  audioEnabled: boolean
  /** Initial video enabled status */
  videoEnabled: boolean
}

/**
 * Response after successfully joining a video call
 */
export interface VideoCallJoinResponse {
  /** WebRTC room URL for connecting */
  roomUrl: string
  /** Authentication token for WebRTC room */
  token: string
  /** Current status of the video call */
  callStatus: 'starting' | 'active' | 'ended' | 'cancelled'
  /** All current participants in the call */
  participants: CallParticipant[]
}

/**
 * Video call participant information
 */
export interface CallParticipant {
  /** Participant user ID */
  user: string
  /** Display name shown in video call interface */
  displayName: string
  /** Timestamp when participant joined the call */
  joinedAt?: string
  /** Timestamp when participant left the call */
  leftAt?: string
  /** Current audio enabled status */
  audioEnabled: boolean
  /** Current video enabled status */
  videoEnabled: boolean
}

/**
 * Request to update participant media status
 */
export interface UpdateParticipantRequest {
  /** Audio enabled status */
  audioEnabled?: boolean
  /** Video enabled status */
  videoEnabled?: boolean
}

/**
 * Response after ending a video call
 */
export interface VideoCallEndResponse {
  /** Confirmation message */
  message: string
  /** Total call duration in minutes */
  callDuration?: number
}

/**
 * Response after leaving a video call
 */
export interface LeaveVideoCallResponse {
  /** Confirmation message */
  message: string
  /** Whether the call is still active after participant left */
  callStillActive: boolean
  /** Number of participants remaining in the call */
  remainingParticipants: number
}

// ============================================================================
// CHAT ROOM MANAGEMENT
// ============================================================================

/**
 * Create a new chat room or return existing if upsert is true
 *
 * @param request - Chat room creation parameters
 * @returns The created or existing chat room
 * @throws {ApiError} If the request fails or user is unauthorized
 *
 * @example
 * ```typescript
 * const room = await createChatRoom({
 *   participants: [clientId, providerId],
 *   admins: [providerId],
 *   context: bookingId,
 *   upsert: true
 * })
 * ```
 */
export async function createChatRoom(request: CreateChatRoomRequest): Promise<ChatRoom> {
  return apiPost<ChatRoom>('/comms/chat-rooms', request)
}

/**
 * List chat rooms where the current user is a participant
 *
 * @param params - Query parameters for filtering and pagination
 * @returns Paginated list of chat rooms
 * @throws {ApiError} If the request fails or user is unauthorized
 *
 * @example
 * ```typescript
 * const response = await listChatRooms({
 *   status: 'active',
 *   hasActiveCall: true,
 *   limit: 20,
 *   offset: 0
 * })
 * ```
 */
export async function listChatRooms(params?: ListChatRoomsParams): Promise<PaginatedResponse<ChatRoom>> {
  const queryParams = new URLSearchParams()
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        queryParams.append(key, String(value))
      }
    })
  }
  const query = queryParams.toString()
  return apiGet<PaginatedResponse<ChatRoom>>(`/comms/chat-rooms${query ? '?' + query : ''}`)
}

/**
 * Get a specific chat room by ID
 *
 * @param roomId - The chat room ID
 * @returns The chat room details
 * @throws {ApiError} If the room doesn't exist or user lacks permission
 *
 * @example
 * ```typescript
 * const room = await getChatRoom(roomId)
 * ```
 */
export async function getChatRoom(roomId: string): Promise<ChatRoom> {
  return apiGet<ChatRoom>(`/comms/chat-rooms/${roomId}`)
}

// ============================================================================
// CHAT MESSAGES
// ============================================================================

/**
 * Get messages from a chat room
 *
 * @param roomId - The chat room ID
 * @param params - Query parameters for filtering and pagination
 * @returns Paginated list of chat messages
 * @throws {ApiError} If the room doesn't exist or user lacks permission
 *
 * @example
 * ```typescript
 * const messages = await getChatMessages(roomId, {
 *   messageType: 'text',
 *   limit: 50,
 *   offset: 0
 * })
 * ```
 */
export async function getChatMessages(
  roomId: string,
  params?: GetChatMessagesParams
): Promise<PaginatedResponse<ChatMessage>> {
  const queryParams = new URLSearchParams()
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        queryParams.append(key, String(value))
      }
    })
  }
  const query = queryParams.toString()
  return apiGet<PaginatedResponse<ChatMessage>>(`/comms/chat-rooms/${roomId}/messages${query ? '?' + query : ''}`)
}

/**
 * Send a message to a chat room (text or start video call)
 *
 * @param roomId - The chat room ID
 * @param message - The message to send (text or video call start)
 * @returns The created chat message
 * @throws {ApiError} If the room doesn't exist, user lacks permission, or video call already active
 *
 * @example
 * ```typescript
 * // Send text message
 * const message = await sendChatMessage(roomId, {
 *   messageType: 'text',
 *   message: 'Hello, how are you?'
 * })
 *
 * // Start video call
 * const callMessage = await sendChatMessage(roomId, {
 *   messageType: 'video_call',
 *   videoCallData: {
 *     status: 'starting',
 *     participants: []
 *   }
 * })
 * ```
 */
export async function sendChatMessage(
  roomId: string,
  message: SendTextMessageRequest | StartVideoCallRequest
): Promise<ChatMessage> {
  return apiPost<ChatMessage>(`/comms/chat-rooms/${roomId}/messages`, message)
}

// ============================================================================
// ICE SERVERS
// ============================================================================

/**
 * Get TURN/STUN server configuration for WebRTC peer connections
 *
 * @returns ICE server configuration for establishing WebRTC connections
 * @throws {ApiError} If the request fails or user is unauthorized
 *
 * @example
 * ```typescript
 * const { iceServers } = await getIceServers()
 * const peerConnection = new RTCPeerConnection({ iceServers })
 * ```
 */
export async function getIceServers(): Promise<IceServersResponse> {
  return apiGet<IceServersResponse>('/comms/ice-servers')
}

// ============================================================================
// VIDEO CALL ACTIONS
// ============================================================================

/**
 * Join an active video call in a chat room
 *
 * @param roomId - The chat room ID containing the active video call
 * @param request - Join parameters including display name and media preferences
 * @returns Video call connection details and participant list
 * @throws {ApiError} If no active call exists, user is already in call, or lacks permission
 *
 * @example
 * ```typescript
 * const response = await joinVideoCall(roomId, {
 *   displayName: 'John Doe',
 *   audioEnabled: true,
 *   videoEnabled: false
 * })
 * // Use response.roomUrl and response.token to connect to WebRTC room
 * ```
 */
export async function joinVideoCall(
  roomId: string,
  request: JoinVideoCallRequest
): Promise<VideoCallJoinResponse> {
  return apiPost<VideoCallJoinResponse>(
    `/comms/chat-rooms/${roomId}/video-call/join`,
    request
  )
}

/**
 * Leave an active video call
 *
 * @param roomId - The chat room ID containing the video call
 * @returns Information about remaining call status and participants
 * @throws {ApiError} If no active call exists or user is not in the call
 *
 * @example
 * ```typescript
 * const response = await leaveVideoCall(roomId)
 * if (!response.callStillActive) {
 *   // Call ended when last participant left
 * }
 * ```
 */
export async function leaveVideoCall(roomId: string): Promise<LeaveVideoCallResponse> {
  return apiPost<LeaveVideoCallResponse>(
    `/comms/chat-rooms/${roomId}/video-call/leave`,
    {}
  )
}

/**
 * End an active video call (admin only)
 *
 * @param roomId - The chat room ID containing the video call to end
 * @returns Call duration and confirmation
 * @throws {ApiError} If no active call exists or user is not a room admin
 *
 * @example
 * ```typescript
 * const response = await endVideoCall(roomId)
 * console.log(`Call ended after ${response.callDuration} minutes`)
 * ```
 */
export async function endVideoCall(roomId: string): Promise<VideoCallEndResponse> {
  return apiPost<VideoCallEndResponse>(
    `/comms/chat-rooms/${roomId}/video-call/end`,
    {}
  )
}

/**
 * Update participant media status in an active video call
 *
 * @param roomId - The chat room ID containing the video call
 * @param updates - Media status updates (audio/video enabled flags)
 * @returns Updated participant information
 * @throws {ApiError} If no active call exists or user is not in the call
 *
 * @example
 * ```typescript
 * // Mute audio
 * await updateVideoCallParticipant(roomId, { audioEnabled: false })
 *
 * // Enable video
 * await updateVideoCallParticipant(roomId, { videoEnabled: true })
 *
 * // Toggle both
 * await updateVideoCallParticipant(roomId, {
 *   audioEnabled: true,
 *   videoEnabled: false
 * })
 * ```
 */
export async function updateVideoCallParticipant(
  roomId: string,
  updates: UpdateParticipantRequest
): Promise<CallParticipant> {
  return apiPatch<CallParticipant>(
    `/comms/chat-rooms/${roomId}/video-call/participant`,
    updates
  )
}