import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi";
import "../common/models.tsp";
import "../common/errors.tsp";
import "../common/pagination.tsp";
import "../common/security.tsp";

using TypeSpec.Http;
using TypeSpec.OpenAPI;

/**
 * Comms Module - Video Communication
 * 
 * Provides focused video call and chat functionality for professional
 * video sessions. Features Facebook Messenger-style chat with
 * embedded video calls and direct booking integration.
 * 
 * Key Features:
 * - Client-provider chat rooms with booking linking
 * - Video calls as special message types in chat history
 * - One active video call per room with efficient state management
 * - Immutable messages with action-based video call control
 * - WebRTC integration for secure video sessions
 */

// ============================================================================
// CORE MODELS
// ============================================================================

/**
 * Chat room for communication between participants
 */
@doc("Communication room with admin-controlled video calls")
model ChatRoom extends BaseEntity {
  @doc("Room participants (e.g., [client, service_provider])")
  participants: UUID[];

  @doc("Room administrators who can control video calls (typically includes the service provider)")
  admins: UUID[];

  @doc("Optional context ID for contextual associations (e.g., booking ID, billing session ID)")
  context?: UUID;

  @doc("Room status")
  status: ChatRoomStatus;

  @doc("Last message timestamp for sorting and activity tracking")
  lastMessageAt?: utcDateTime;

  @doc("Total message count for efficient pagination")
  messageCount: int32;

  @doc("Efficiency reference to active video call message (null if no active call)")
  activeVideoCallMessage?: UUID;
}

/**
 * Chat room status enumeration
 */
@doc("Chat room status")
enum ChatRoomStatus {
  @doc("Room is active and available for messaging")
  active: "active",
  
  @doc("Room is archived and read-only")
  archived: "archived"
}

/**
 * Immutable chat message with optional video call data
 */
@doc("Immutable chat message with optional video call data")
model ChatMessage extends BaseEntity {
  @doc("Chat room reference")
  chatRoom: UUID;

  @doc("Message sender (client or service provider)")
  sender: UUID;

  @doc("Message timestamp")
  timestamp: utcDateTime;

  @doc("Message type determines content structure")
  messageType: MessageType;

  @doc("Text content for text and system messages")
  @maxLength(5000)
  message?: string;

  @doc("Video call data for video call messages")
  videoCallData?: VideoCallData;
}

/**
 * Message type enumeration
 */
@doc("Message type enumeration")
enum MessageType {
  @doc("Regular text message from user")
  text: "text",
  
  @doc("System-generated message (call started, ended, etc.)")
  system: "system",
  
  @doc("Video call message with embedded call data")
  video_call: "video_call"
}

/**
 * Video call session data embedded in messages
 */
@doc("Video call session data embedded in messages")
model VideoCallData {
  @doc("Current video call status")
  status: VideoCallStatus;

  @doc("WebRTC room URL for active calls")
  roomUrl?: string;

  @doc("Authentication token for WebRTC room access")
  token?: string;

  @doc("Call start timestamp")
  startedAt?: utcDateTime;

  @doc("Person who started the call")
  startedBy?: UUID;

  @doc("Call end timestamp") 
  endedAt?: utcDateTime;

  @doc("Person who ended the call")
  endedBy?: UUID;

  @doc("Call duration in minutes (calculated when call ends)")
  durationMinutes?: int32;

  @doc("Call participants list")
  participants: CallParticipant[];
}

/**
 * Video call status enumeration
 */
@doc("Video call status")
enum VideoCallStatus {
  @doc("Call being initiated, waiting for WebRTC room")
  starting: "starting",
  
  @doc("Call in progress with active participants")
  active: "active",
  
  @doc("Call completed normally")
  ended: "ended",
  
  @doc("Call cancelled before participants joined")
  cancelled: "cancelled"
}

/**
 * Video call participant information
 */
@doc("Video call participant")
model CallParticipant {
  @doc("Participant user ID")
  user: UUID;

  @doc("Display name shown in video call interface")
  @maxLength(100)
  displayName: string;

  @doc("Timestamp when participant joined the call")
  joinedAt?: utcDateTime;

  @doc("Timestamp when participant left the call")
  leftAt?: utcDateTime;

  @doc("Audio enabled status")
  audioEnabled: boolean;

  @doc("Video enabled status")
  videoEnabled: boolean;
}

/**
 * Start video call data
 */
@doc("Video call initialization data")
model StartVideoCallData {
  @doc("Initial call status (always 'starting')")
  status: "starting";

  @doc("Initial call participants")
  participants: CallParticipant[];
}

// ============================================================================
// REQUEST/RESPONSE MODELS
// ============================================================================

/**
 * Send text message request
 */
@doc("Send text message request")
model SendTextMessageRequest {
  @doc("Message type (always 'text' for this request)")
  messageType: "text";

  @doc("Message content")
  @maxLength(5000)
  message: string;
}

/**
 * Start video call request
 */
@doc("Start video call message request.")
model StartVideoCallRequest {
  @doc("Message type (always 'video_call' for this request)")
  messageType: "video_call";

  @doc("Video call initialization data")
  videoCallData: StartVideoCallData;
}

/**
 * Join video call request
 */
@doc("Join video call request")
model JoinVideoCallRequest {
  @doc("Display name for the video call")
  @maxLength(100)
  displayName: string;

  @doc("Initial audio enabled status")
  audioEnabled: boolean;

  @doc("Initial video enabled status")
  videoEnabled: boolean;
}

/**
 * Update participant status request
 */
@doc("Update video call participant status")
model UpdateParticipantRequest {
  @doc("Audio enabled status")
  audioEnabled?: boolean;

  @doc("Video enabled status")
  videoEnabled?: boolean;
}

/**
 * Video call join response
 */
@doc("Video call join response with WebRTC connection info")
model VideoCallJoinResponse {
  @doc("WebRTC room URL for connecting")
  roomUrl: string;

  @doc("Authentication token for WebRTC room")
  token: string;

  @doc("Current status of the video call")
  callStatus: VideoCallStatus;

  @doc("All current participants in the call")
  participants: CallParticipant[];
}

/**
 * Video call end response
 */
@doc("Video call end response")
model VideoCallEndResponse {
  @doc("Confirmation message")
  message: string;

  @doc("Total call duration in minutes")
  callDuration?: int32;
}

/**
 * Leave video call response
 */
@doc("Leave video call response")
model LeaveVideoCallResponse {
  @doc("Confirmation message")
  message: string;

  @doc("Whether the call is still active after participant left")
  callStillActive: boolean;

  @doc("Number of participants remaining in the call")
  remainingParticipants: int32;
}

/**
 * ICE server configuration for WebRTC
 */
@doc("ICE server configuration")
model IceServer {
  @doc("STUN/TURN server URLs")
  urls: string | string[];

  @doc("Username for TURN server authentication (optional)")
  username?: string;

  @doc("Credential for TURN server authentication (optional)")
  credential?: string;
}

/**
 * ICE servers response
 */
@doc("ICE servers configuration response")
model IceServersResponse {
  @doc("List of ICE servers (STUN/TURN) for WebRTC peer connections")
  iceServers: IceServer[];
}

/**
 * Create chat room request
 */
@doc("Create chat room request")
model CreateChatRoomRequest {
  @doc("Participant IDs (e.g., [client, service_provider])")
  participants: UUID[];

  @doc("Admin IDs (users who can control video calls). Defaults to all participants if not specified.")
  admins?: UUID[];

  @doc("Optional context ID for contextual associations (e.g., booking ID, billing session ID)")
  context?: UUID;

  @doc("If true, return existing room instead of error when unique constraint is hit")
  upsert?: boolean = false;
}

// ============================================================================
// API ENDPOINTS
// ============================================================================

/**
 * Comms management endpoints
 */
namespace CommsModule {
  interface CommsManagement {
    
    // ========================================================================
    // CHAT ROOM MANAGEMENT
    // ========================================================================

    @doc("Create new chat room or return existing if upsert is true. Requires authenticated user.")
    @operationId("createChatRoom")
    @post
    @route("/chat-rooms")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    createChatRoom(
      @body request: CreateChatRoomRequest
    ): ApiOkResponse<ChatRoom> // Existing room returned when upsert=true
      | ApiCreatedResponse<ChatRoom> // New room created
      | ApiConflictResponse // Room already exists when upsert=false
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("List chat rooms where the current authenticated user is a participant. Results are automatically filtered to rooms containing the current user.")
    @operationId("listChatRooms")
    @get
    @route("/chat-rooms")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user:participant"])
    listChatRooms(
      @doc("Filter by room status (active, archived)")
      @query status?: ChatRoomStatus,
      @doc("Filter by context ID (e.g., booking ID)")
      @query context?: UUID,
      @doc("Filter rooms that include both the current user AND the specified participant UUID")
      @query withParticipant?: UUID,
      @doc("Filter to show only rooms with active video calls")
      @query hasActiveCall?: boolean,
      ...PaginationQuery
    ): ApiOkResponse<PaginatedResponse<ChatRoom>>
      | ApiUnauthorizedResponse;

    @doc("Get specific chat room. Requires participation in room.")
    @operationId("getChatRoom")
    @get
    @route("/chat-rooms/{room}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user:participant"])
    getChatRoom(
      @path room: UUID
    ): ApiOkResponse<ChatRoom>
      | ApiNotFoundResponse
      | ApiForbiddenResponse;

    @doc("Get chat room messages. Requires participation in room.")
    @operationId("getChatMessages")
    @get
    @route("/chat-rooms/{room}/messages")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user:participant"])
    getChatMessages(
      @path room: UUID,
      @doc("Filter by message type (text, system, video_call)")
      @query messageType?: MessageType,
      ...PaginationQuery
    ): ApiOkResponse<PaginatedResponse<ChatMessage>>
      | ApiNotFoundResponse
      | ApiForbiddenResponse;

    @doc("Send message (text or start video call). Requires participation in room.")
    @operationId("sendChatMessage")
    @post
    @route("/chat-rooms/{room}/messages")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user:participant"])
    sendChatMessage(
      @path room: UUID,
      @body message: SendTextMessageRequest | StartVideoCallRequest
    ): ApiCreatedResponse<ChatMessage>
      | ApiBadRequestResponse
      | ApiConflictResponse // Active video call already exists
      | ApiForbiddenResponse; // Not participant or non-admin trying to start video call

    // ========================================================================
    // VIDEO CALL ACTIONS
    // ========================================================================

    @doc("Join active video call in chat room. Requires participation in room.")
    @operationId("joinVideoCall")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user:participant"])
    @route("/chat-rooms/{room}/video-call/join")
    joinVideoCall(
      @path room: UUID,
      @body request: JoinVideoCallRequest
    ): ApiOkResponse<VideoCallJoinResponse>
      | ApiNotFoundResponse // No active video call
      | ApiConflictResponse // Already in call
      | ApiForbiddenResponse;

    @doc("End active video call.")
    @operationId("endVideoCall")
    @post
    @route("/chat-rooms/{room}/video-call/end")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user:admin"])
    endVideoCall(
      @path room: UUID
    ): ApiOkResponse<VideoCallEndResponse>
      | ApiNotFoundResponse // No active video call
      | ApiForbiddenResponse; // Not room admin

    @doc("Leave active video call. Requires participation in room.")
    @operationId("leaveVideoCall")
    @post
    @route("/chat-rooms/{room}/video-call/leave")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user:participant"])
    leaveVideoCall(
      @path room: UUID
    ): ApiOkResponse<LeaveVideoCallResponse>
      | ApiNotFoundResponse // No active call or user not in call
      | ApiForbiddenResponse;

    @doc("Update participant status in video call. Requires participation in room.")
    @operationId("updateVideoCallParticipant")
    @patch(#{implicitOptionality: true})
    @route("/chat-rooms/{room}/video-call/participant")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user:participant"])
    updateVideoCallParticipant(
      @path room: UUID,
      @body update: UpdateParticipantRequest
    ): ApiOkResponse<CallParticipant>
      | ApiNotFoundResponse // No active call or user not in call
      | ApiForbiddenResponse;

    @doc("Get TURN/STUN server configuration for WebRTC peer connections. Requires authentication.")
    @operationId("getIceServers")
    @get
    @route("/ice-servers")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    getIceServers(): ApiOkResponse<IceServersResponse>
      | ApiUnauthorizedResponse;

  }
}
