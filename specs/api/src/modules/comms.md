# Comms Module Documentation

## Overview

The **Comms Module** provides communication capabilities for the Monobase Application Platform. This module provides a focused, streamlined solution designed for video consultations and secure messaging.

### Purpose
- Enable secure video consultations between users
- Provide persistent chat functionality for coordination and follow-up
- Integrate seamlessly with scheduling systems
- Support both scheduled consultations and ad-hoc communications

### Key Features
- **Facebook Messenger-style chat** with immutable message history
- **Embedded video calls** that appear as special messages in the timeline
- **One active video call per chat room** with efficient state management
- **Direct appointment integration** for scheduled teleconsultations
- **Action-based API** with clear endpoints for video call management

## Architecture

### Entity Relationship Diagram

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Appointment   │    │    ChatRoom      │────│   ChatMessage   │
│   (Booking)     │    │                  │    │                 │
│                 │    │ • participants[] │    │ • sender        │
│ • patient       │    │ • admins[]       │    │ • messageType   │
│ • provider      │    │ • context?       │    │ • message?      │
│ • consultationType  │ • activeVideo     │    │ • videoCallData?│
│ • scheduledTime │    │   CallMessage?   │    │                 │
└─────────────────┘    │                  │    └─────────────────┘
                       └──────────────────┘              │
                               │                         │
                        ┌──────▼──────┐         ┌───────▼────────┐
                        │   Person    │         │  VideoCallData │
                        │             │         │                │
                        │ • participants[]     │ • status       │
                        │ • admins[]   │        │ • roomUrl      │
                        └─────────────┘         │ • participants │
                                               │ • startedAt    │
                                               │ • endedAt      │
                                               └────────────────┘
```

### Video Call State Flow

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│ Appointment │───▶│ ChatRoom     │───▶│ Text        │
│ Scheduled   │    │ Created      │    │ Messages    │
└─────────────┘    └──────────────┘    └─────────────┘
                                              │
                                              ▼
┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│ Follow-up   │◄───│ Video Call   │◄───│ Start Video │
│ Messages    │    │ Ends         │    │ Call        │
└─────────────┘    └──────────────┘    └─────────────┘
                          ▲                   │
                          │                   ▼
                   ┌──────────────┐    ┌─────────────┐
                   │ Participants │    │ Video Call  │
                   │ Join/Leave   │    │ Message     │
                   └──────────────┘    │ Created     │
                                      └─────────────┘
                                             │
                                             ▼
                                    ┌─────────────┐
                                    │ activeVideo │
                                    │ CallMessage │
                                    │ Set         │
                                    └─────────────┘
```

## Appointment Integration

### Integration Patterns

#### 1. Scheduled Teleconsultation
```typescript
// Booking flow
1. Patient books appointment with consultationType: "video"
2. App creates ChatRoom with context = appointment.id
3. Pre-consultation messaging available
4. Video call initiated at appointment time
5. Post-consultation follow-up in same room

// Database relationships
Appointment.consultationType = "video"
ChatRoom.context = Appointment.id // Optional association
ChatRoom.participants = [Appointment.patient, Appointment.provider]
ChatRoom.admins = [Appointment.provider]
```

#### 2. In-Person to Video Escalation
```typescript
// Scenario: Provider suggests video follow-up
1. In-person appointment scheduled
2. ChatRoom created for coordination
3. Provider suggests video call for follow-up  
4. Video call initiated from existing chat
5. No appointment link required for ad-hoc calls

// Implementation
ChatRoom.context = Appointment.id (original in-person)
// New video call message without context constraint
```

#### 3. Emergency Video Consultation
```typescript
// Direct provider contact
1. No scheduled appointment needed
2. ChatRoom created directly between patient/provider
3. Immediate video call capability
4. Optional appointment creation afterward

// Database state
ChatRoom.context = null (initially)
// Can optionally link to context (appointment) created post-call
```

### Consultation Mode Integration

The comms module integrates with the booking module's consultation modes:

```typescript
// From booking.tsp
enum ConsultationType {
  in_person: "in-person",
  video: "video", 
  hybrid: "hybrid"
}

// Comms module behavior by type:
switch (appointment.consultationType) {
  case "video":
    // Auto-create ChatRoom with video call capabilities
    // Send appointment reminders with video call links
    break;
  case "in_person": 
    // Optional ChatRoom for coordination messages
    // Video call available for follow-up discussions
    break;
  case "hybrid":
    // ChatRoom supports both pre-consultation chat
    // and video call options during appointment
    break;
}
```

## Data Models

### ChatRoom

The central entity for 1:1 communication between participants.

```typescript
@doc("Communication room with admin-controlled video calls")
model ChatRoom extends BaseEntity {
  @doc("Room participants (e.g., [patient, provider])")
  participants: UUID[];

  @doc("Room administrators who can control video calls (typically includes the provider)")
  admins: UUID[];

  @doc("Optional context ID for contextual associations (e.g., appointment ID, billing session ID)")
  context?: UUID;

  @doc("Room status")
  status: "active" | "archived";

  @doc("Last message timestamp")
  lastMessageAt?: utcDateTime;

  @doc("Total message count in room")
  messageCount: int32;

  @doc("Efficiency reference to active video call message")
  activeVideoCallMessage?: UUID;
}
```

**Key Design Decisions:**
- **Participant arrays**: `participants[]` allows flexible participant management and leverages PostgreSQL's efficient JSONB array operations
- **Admin arrays**: `admins[]` enables multiple administrators (useful for team-based care or provider groups)
- **Context field**: Optional UUID for domain-agnostic associations (appointments, billing sessions, etc.)
- **Unique constraint**: `(participants, context)` ensures one room per unique participant set and context
- **Null context**: Represents general/ongoing communication between participants
- **activeVideoCallMessage**: O(1) checking for concurrent video call prevention
- **messageCount**: Efficient pagination without expensive COUNT queries
- **Array queries**: PostgreSQL GIN indexes make array containment queries highly efficient

### ChatMessage

Immutable messages with embedded video call data.

```typescript
@doc("Immutable chat message with optional video call data")
model ChatMessage extends BaseEntity {
  @doc("Chat room reference")
  chatRoom: UUID;

  @doc("Message sender (patient or provider)")
  sender: UUID;

  @doc("Message timestamp")
  timestamp: utcDateTime;

  @doc("Message type")
  messageType: MessageType;

  @doc("Text content for text messages")
  @maxLength(5000)
  message?: string;

  @doc("Video call data for video call messages")
  videoCallData?: VideoCallData;
}

@doc("Message type enumeration")
enum MessageType {
  @doc("Regular text message")
  text: "text",
  
  @doc("System-generated message")
  system: "system",
  
  @doc("Video call message")
  video_call: "video_call"
}
```

**Immutability Principle:**
- Messages never change after creation
- Video call state updates handled via separate action endpoints
- History preserved exactly as it occurred
- System messages track video call events ("Call started", "Alice joined")

### VideoCallData

Embedded video call information within messages.

```typescript
@doc("Video call session data embedded in messages")
model VideoCallData {
  @doc("Current call status")
  status: VideoCallStatus;

  @doc("WebRTC room URL for active calls")
  roomUrl?: string;

  @doc("Authentication token for room access")
  token?: string;

  @doc("Call start timestamp")
  startedAt?: utcDateTime;

  @doc("Person who started the call")
  startedBy?: UUID;

  @doc("Call end timestamp")
  endedAt?: utcDateTime;

  @doc("Person who ended the call")
  endedBy?: UUID;

  @doc("Call duration in minutes")
  durationMinutes?: int32;

  @doc("Call participants")
  participants: CallParticipant[];
}

@doc("Video call status")
enum VideoCallStatus {
  @doc("Call being initiated")
  starting: "starting",
  
  @doc("Call in progress")
  active: "active",
  
  @doc("Call completed normally")
  ended: "ended",
  
  @doc("Call cancelled before starting")
  cancelled: "cancelled"
}

@doc("Video call participant")
model CallParticipant {
  @doc("Participant user ID")
  user: UUID;

  @doc("Display name in call")
  @maxLength(100)
  displayName: string;

  @doc("Join timestamp")
  joinedAt?: utcDateTime;

  @doc("Leave timestamp")
  leftAt?: utcDateTime;

  @doc("Audio enabled status")
  audioEnabled: boolean;

  @doc("Video enabled status")  
  videoEnabled: boolean;
}
```

## API Endpoints

### Chat Room Management

#### 1. List Chat Rooms
```typescript
GET /chat-rooms
Authorization: Bearer {token}
Query Parameters:
  - status?: "active" | "archived"
  - context?: UUID
  - withParticipant?: UUID (filter to rooms with specific participant)
  - hasActiveCall?: boolean (filter to rooms with active video calls)
  - limit?: int32 (default: 20)
  - offset?: int32 (default: 0)

Response 200 OK (ApiOkResponse<PaginatedResponse<ChatRoom>>):
{
  "data": [
    {
      "id": "uuid",
      "participants": ["patient-uuid", "provider-uuid"],
      "admins": ["provider-uuid"],
      "context": "context-uuid",
      "status": "active",
      "lastMessageAt": "2024-01-15T10:30:00Z",
      "messageCount": 15,
      "activeVideoCallMessage": "uuid" | null
    }
  ],
  "pagination": {
    "total": 1,
    "limit": 20,
    "offset": 0
  }
}
```

#### 2. Get Specific Chat Room
```typescript
GET /chat-rooms/{id}
Authorization: Bearer {token}

Response 200 OK (ApiOkResponse<ChatRoom>):
{
  "id": "uuid",
  "participants": ["patient-uuid", "provider-uuid"],
  "admins": ["provider-uuid"],
  "context": "context-uuid",
  "status": "active",
  "createdAt": "2024-01-15T09:00:00Z",
  "lastMessageAt": "2024-01-15T10:30:00Z",
  "messageCount": 15,
  "activeVideoCallMessage": "uuid" | null
}

Response 404 Not Found (ApiNotFoundResponse)
```

#### 3. Create Chat Room
```typescript
POST /chat-rooms
Authorization: Bearer {token}
Content-Type: application/json

{
  "participants": ["patient-uuid", "provider-uuid"],
  "admins": ["provider-uuid"],
  "context": "context-uuid", // Optional
  "upsert": true // Return existing if already exists
}

Response 200 OK (ApiOkResponse<ChatRoom> - Existing room returned):
{
  "id": "existing-room-uuid",
  "participants": ["patient-uuid", "provider-uuid"],
  "admins": ["provider-uuid"],
  "context": "context-uuid",
  "status": "active",
  // ... other fields
}

Response 201 Created (ApiCreatedResponse<ChatRoom> - New room created):
{
  "id": "new-room-uuid",
  "participants": ["patient-uuid", "provider-uuid"],
  "admins": ["provider-uuid"],
  "context": "context-uuid",
  "status": "active",
  // ... other fields
}

Response 409 Conflict (ApiConflictResponse)
```

#### 4. Get Chat Messages
```typescript
GET /chat-rooms/{id}/messages
Authorization: Bearer {token}
Query Parameters:
  - limit?: int32 (default: 50)
  - offset?: int32 (default: 0)
  - messageType?: "text" | "system" | "video_call"

Response 200 OK (ApiOkResponse<PaginatedResponse<ChatMessage>>):
{
  "data": [
    {
      "id": "uuid",
      "chatRoom": "uuid",
      "sender": "uuid",
      "timestamp": "2024-01-15T10:30:00Z",
      "messageType": "text",
      "message": "How are you feeling today?"
    },
    {
      "id": "uuid", 
      "chatRoom": "uuid",
      "sender": "uuid",
      "timestamp": "2024-01-15T10:35:00Z",
      "messageType": "video_call",
      "videoCallData": {
        "status": "ended",
        "startedAt": "2024-01-15T10:35:00Z",
        "startedBy": "provider-uuid",
        "endedAt": "2024-01-15T10:50:00Z",
        "endedBy": "provider-uuid",
        "durationMinutes": 15,
        "participants": [...]
      }
    }
  ],
  "pagination": {...}
}
```

#### 5. Send Message
```typescript
POST /chat-rooms/{id}/messages
Authorization: Bearer {token}
Content-Type: application/json

// Text message
{
  "messageType": "text",
  "message": "I'm feeling much better, thank you!"
}

// Start video call
{
  "messageType": "video_call",
  "videoCallData": {
    "status": "starting",
    "participants": [
      {
        "user": "patient-uuid",
        "displayName": "John Doe",
        "audioEnabled": true,
        "videoEnabled": true
      }
    ]
  }
}

Response 201 Created (ApiCreatedResponse<ChatMessage>):
{
  "id": "uuid",
  "chatRoom": "uuid",
  "sender": "uuid",
  "timestamp": "2024-01-15T10:30:00Z",
  "messageType": "video_call",
  "videoCallData": {
    "status": "starting",
    "roomUrl": "https://webrtc.example.com/room/abc123",
    "token": "jwt-token-here",
    "participants": [...]
  }
}

Response 409 Conflict (ApiConflictResponse): Active video call already exists
Response 403 Forbidden (ApiForbiddenResponse): Cannot start video call
```

### Video Call Actions

#### 6. Join Video Call
```typescript
POST /chat-rooms/{id}/video-call/join
Authorization: Bearer {token}
Content-Type: application/json

{
  "displayName": "Dr. Sarah Johnson",
  "audioEnabled": true,
  "videoEnabled": true
}

Response 200 OK (ApiOkResponse<VideoCallJoinResponse>):
{
  "roomUrl": "https://webrtc.example.com/room/abc123",
  "token": "jwt-token-for-participant",
  "participants": [
    {
      "user": "patient-uuid",
      "displayName": "John Doe", 
      "joinedAt": "2024-01-15T10:35:00Z",
      "audioEnabled": true,
      "videoEnabled": true
    },
    {
      "user": "provider-uuid",
      "displayName": "Dr. Sarah Johnson",
      "joinedAt": "2024-01-15T10:36:00Z", 
      "audioEnabled": true,
      "videoEnabled": true
    }
  ]
}

Response 404 Not Found (ApiNotFoundResponse): No active video call
Response 409 Conflict (ApiConflictResponse): User already in call
```

#### 7. End Video Call
```typescript
POST /chat-rooms/{id}/video-call/end
Authorization: Bearer {token}

Response 200 OK (ApiOkResponse<VideoCallEndResponse>):
{
  "durationMinutes": 15
}

Response 404 Not Found (ApiNotFoundResponse): No active video call
Response 403 Forbidden (ApiForbiddenResponse): Not authorized
```

#### 8. Leave Video Call
```typescript
POST /chat-rooms/{id}/video-call/leave
Authorization: Bearer {token}

Response 200 OK (ApiOkResponse<LeaveVideoCallResponse>):
{
  "participants": [
    {
      "user": "provider-uuid",
      "displayName": "Dr. Sarah Johnson",
      "joinedAt": "2024-01-15T10:36:00Z",
      "audioEnabled": true,
      "videoEnabled": true
    }
  ]
}

Response 404 Not Found (ApiNotFoundResponse): No active video call or user not in call
```

#### 9. Update Participant Status
```typescript
PATCH /chat-rooms/{id}/video-call/participant
Authorization: Bearer {token}
Content-Type: application/json

{
  "audioEnabled": false,
  "videoEnabled": true
}

Response 200 OK (ApiOkResponse<CallParticipant>):
{
  "user": "uuid",
  "displayName": "John Doe",
  "joinedAt": "2024-01-15T10:35:00Z",
  "leftAt": null,
  "audioEnabled": false,
  "videoEnabled": true
}
```

### Integration Pattern

The comms module is domain-agnostic and doesn't know about appointments, billing, or other domain concepts. Instead, other modules use the `context` field to associate chat rooms with their entities:

```typescript
// App creates appointment
const appointment = await POST('/appointments', {
  patient: "patient-123",
  provider: "provider-456",
  consultationType: "video",
  // ...
});

// App creates/gets chat room for appointment
const chatRoom = await POST('/chat-rooms', {
  participants: [appointment.patient, appointment.provider],
  admins: [appointment.provider],
  context: appointment.id,  // Associate with appointment
  upsert: true  // Return existing if already created
});

// For general chat (no specific context)
const generalChat = await POST('/chat-rooms', {
  participants: ["patient-123", "provider-456"],
  admins: ["provider-456"],
  // No context - represents general communication
  upsert: true
});
```

## Implementation Workflows

### Workflow 1: Scheduled Video Consultation

```typescript
// 1. Appointment booking (Booking module)
POST /appointments
{
  "patient": "patient-uuid",
  "provider": "provider-uuid", 
  "consultationType": "video",
  "scheduledTime": "2024-01-15T14:00:00Z"
}

// 2. App creates chat room for appointment
POST /chat-rooms
{
  "participants": ["patient-uuid", "provider-uuid"],
  "admins": ["provider-uuid"],
  "context": "appointment-uuid",
  "upsert": true
}

// 3. Pre-consultation messaging
POST /chat-rooms/{roomId}/messages
{
  "messageType": "text",
  "message": "Hi Dr. Johnson, I've been experiencing headaches lately."
}

// 4. Provider response
POST /chat-rooms/{roomId}/messages  
{
  "messageType": "text",
  "message": "Thanks for the details. Let's start our video consultation."
}

// 5. Start video call
POST /chat-rooms/{roomId}/messages
{
  "messageType": "video_call",
  "videoCallData": {
    "status": "starting",
    "participants": [provider_participant_data]
  }
}

// 6. Patient joins
POST /chat-rooms/{roomId}/video-call/join
{
  "displayName": "John Doe",
  "audioEnabled": true,
  "videoEnabled": true
}

// 7. Consultation conducted via WebRTC
// 8. End call
POST /chat-rooms/{roomId}/video-call/end

// 9. Follow-up messaging
POST /chat-rooms/{roomId}/messages
{
  "messageType": "text", 
  "message": "Please continue taking the medication as discussed."
}
```

### Workflow 2: Emergency Video Call

```typescript
// 1. Direct chat room creation (no specific context)
POST /chat-rooms
{
  "participants": ["patient-uuid", "provider-uuid"],
  "admins": ["provider-uuid"],
  "upsert": true
  // No context field - general chat
}

// 2. Immediate video call
POST /chat-rooms/{roomId}/messages
{
  "messageType": "video_call",
  "videoCallData": {
    "status": "starting",
    "participants": [patient_participant_data]
  }
}

// 3. Provider joins quickly
POST /chat-rooms/{roomId}/video-call/join
{...}

// 4. Emergency consultation
// 5. End call
POST /chat-rooms/{roomId}/video-call/end

// 6. Optional: Create appointment record for billing
POST /appointments
{
  "patient": "patient-uuid",
  "provider": "provider-uuid",
  "consultationType": "video",
  "scheduledTime": "2024-01-15T11:30:00Z", // actual call time
  "status": "completed"
}

// 7. Update chat room context to reference appointment
PATCH /chat-rooms/{roomId}
{
  "context": "new-appointment-uuid"
}
```

## Database Schema

### Table Definitions

```sql
-- Chat rooms table
CREATE TABLE chat_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participants UUID[] NOT NULL,
  admins UUID[] NOT NULL,
  context UUID,  -- Optional context for associations
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived')),
  message_count INTEGER NOT NULL DEFAULT 0,
  active_video_call_message UUID REFERENCES chat_messages(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ,

  -- Ensure unique room per participant set and context
  UNIQUE(participants, context),
  -- Ensure admins are participants
  CONSTRAINT admins_are_participants CHECK (admins <@ participants),
  -- Ensure at least 2 participants
  CONSTRAINT min_participants CHECK (array_length(participants, 1) >= 2),
  -- Ensure at least 1 admin
  CONSTRAINT min_admins CHECK (array_length(admins, 1) >= 1)
);

-- Partial unique index to ensure only one NULL context per participant set
CREATE UNIQUE INDEX idx_one_null_context
ON chat_rooms (participants)
WHERE context IS NULL;

-- Chat messages table  
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_room UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  sender UUID NOT NULL REFERENCES persons(id),
  message_type VARCHAR(20) NOT NULL 
    CHECK (message_type IN ('text', 'system', 'video_call')),
  message TEXT,
  video_call_data JSONB,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure message content matches type
  CONSTRAINT message_content_check CHECK (
    (message_type = 'text' AND message IS NOT NULL AND video_call_data IS NULL) OR
    (message_type = 'system' AND message IS NOT NULL AND video_call_data IS NULL) OR  
    (message_type = 'video_call' AND video_call_data IS NOT NULL)
  )
);

-- Call participants table (normalized for querying)
CREATE TABLE call_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_message UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES persons(id),
  user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('patient', 'provider')),
  display_name VARCHAR(100) NOT NULL,
  joined_at TIMESTAMPTZ,
  left_at TIMESTAMPTZ,
  is_audio_enabled BOOLEAN NOT NULL DEFAULT true,
  is_video_enabled BOOLEAN NOT NULL DEFAULT true,
  
  UNIQUE(chat_message, user_id)
);
```

### Performance Indexes

```sql
-- Active video call queries (most critical)
CREATE INDEX idx_chat_rooms_active_video
ON chat_rooms (active_video_call_message)
WHERE active_video_call_message IS NOT NULL;

-- Participant room lookups using GIN index for array containment
CREATE INDEX idx_chat_rooms_participants ON chat_rooms USING GIN (participants);

-- Admin lookups using GIN index
CREATE INDEX idx_chat_rooms_admins ON chat_rooms USING GIN (admins);

-- Context integration (for appointments, billing, etc.)
CREATE INDEX idx_chat_rooms_context
ON chat_rooms (context)
WHERE context IS NOT NULL;

-- Message timeline queries
CREATE INDEX idx_chat_messages_room_timestamp 
ON chat_messages (chat_room, timestamp DESC);

-- Video call message queries
CREATE INDEX idx_chat_messages_video_calls
ON chat_messages (message_type, timestamp)
WHERE message_type = 'video_call';

-- Participant queries
CREATE INDEX idx_call_participants_user
ON call_participants (user_id, joined_at DESC);
```

### Data Migration Strategy

```sql
-- Migration from existing communication module
-- 1. Create new tables with above schema
-- 2. Migrate existing video call data:

INSERT INTO chat_rooms (participants, admins, context, created_at)
SELECT DISTINCT
  ARRAY[p.user_id, pr.user_id] as participants,
  ARRAY[pr.user_id] as admins,
  vc.appointment_id as context,  -- Use appointment ID as context
  MIN(vc.created_at)
FROM video_call_sessions vc
JOIN appointments a ON vc.appointment_id = a.id
JOIN persons p ON a.patient = p.id
JOIN persons pr ON a.provider = pr.id
GROUP BY p.user_id, pr.user_id, vc.appointment_id;

-- 3. Convert video calls to messages:
INSERT INTO chat_messages (chat_room, sender, message_type, video_call_data, timestamp)
SELECT
  cr.id as chat_room,
  CASE
    WHEN vc.initiated_by = ANY(cr.participants) THEN vc.initiated_by
    ELSE cr.participants[1]
  END,
  'video_call',
  jsonb_build_object(
    'status', CASE WHEN vc.ended_at IS NULL THEN 'active' ELSE 'ended' END,
    'startedAt', vc.started_at,
    'endedAt', vc.ended_at,
    'durationMinutes', EXTRACT(EPOCH FROM (vc.ended_at - vc.started_at))/60,
    'participants', vc.participants_json
  ),
  vc.started_at
FROM video_call_sessions vc
JOIN appointments a ON vc.appointment_id = a.id
JOIN chat_rooms cr ON cr.context = a.id;

-- 4. Drop old communication tables after verification
```

## Error Handling & Edge Cases

### Concurrent Video Call Prevention

```typescript
// Before creating video call message
const chatRoom = await getChatRoom(roomId);
if (chatRoom.activeVideoCallMessage) {
  throw new ConflictError(
    'A video call is already active in this room',
    'ACTIVE_VIDEO_CALL_EXISTS'
  );
}

// Atomic operation to prevent race conditions
await database.transaction(async (tx) => {
  // Create video call message
  const message = await tx.insert(chatMessages).values({
    chatRoom: roomId,
    messageType: 'video_call',
    videoCallData: callData
  });
  
  // Update room's active reference
  await tx.update(chatRooms)
    .set({ activeVideoCallMessage: message.id })
    .where(eq(chatRooms.id, roomId));
});
```

### Participant Validation

```typescript
// Ensure only room participants can join calls
const chatRoom = await getChatRoom(roomId);
const userId = getCurrentUserId(request);

if (!chatRoom.participants.includes(userId)) {
  throw new ForbiddenError('Not authorized to join this video call');
}

// Prevent duplicate participation  
const existingParticipant = callData.participants.find(p => p.user === userId);
if (existingParticipant && !existingParticipant.leftAt) {
  throw new ConflictError(
    'User is already participating in this call',
    'ALREADY_IN_CALL'
  );
}
```

### WebRTC Integration Notes

```typescript
// WebRTC room management (implementation detail)
interface WebRTCService {
  createRoom(roomId: string): Promise<{roomUrl: string, token: string}>;
  generateToken(roomId: string, userId: string): Promise<string>;
  endRoom(roomId: string): Promise<void>;
  getActiveParticipants(roomId: string): Promise<string[]>;
}

// Video call lifecycle
1. POST /messages (video_call) → WebRTC.createRoom()
2. POST /join → WebRTC.generateToken() 
3. Frontend connects to WebRTC with token
4. POST /end → WebRTC.endRoom()
```

## Security & Compliance

### Data Security
- All chat messages and video call data encrypted at rest
- WebRTC connections use end-to-end encryption
- Audit trail maintained for all video call access
- User consent required before video call recording

### Authentication & Authorization
- Bearer token authentication required for all endpoints
- Users can only access rooms where they are participants
- Context-linked rooms require appropriate access permissions
- Video call actions restricted to room participants

### Rate Limiting
```typescript
// Prevent video call spam
POST /messages (video_call): 5 per hour per room (admins only can start)
POST /join: 10 per minute per user
POST /end: No limit (safety endpoint, admins only)
```

## Performance Considerations

### Database Optimization
- **Active call queries**: O(1) lookup via `activeVideoCallMessage` index
- **Message pagination**: Efficient timestamp-based pagination
- **Participant tracking**: Normalized table for complex queries
- **JSONB video call data**: Indexed for status and metadata queries

### Caching Strategy
```typescript
// Redis cache for active rooms
CACHE: "chat_room:{id}" → ChatRoom (5 minutes TTL)
CACHE: "active_calls" → List<RoomId> (1 minute TTL)
CACHE: "room_messages:{id}:{page}" → Messages (2 minutes TTL)

// Invalidation triggers
- New message sent → Invalidate room and message caches
- Video call state change → Invalidate room and active_calls
- Room archived → Invalidate all related caches
```

### WebRTC Scalability
- Room size limit: 2 participants per call
- Multiple concurrent calls supported across different rooms
- WebRTC server horizontally scalable
- Fallback to TURN servers for NAT traversal

## Integration Testing

### Test Scenarios

#### 1. Complete Video Consultation Flow
```typescript
describe('Video Consultation Workflow', () => {
  it('should handle full appointment-based video consultation', async () => {
    // 1. Create appointment
    const appointment = await createAppointment({
      patient: patientId,
      provider: providerId,
      consultationType: 'video'
    });

    // 2. Create/get chat room for appointment
    const chatRoom = await POST(`/chat-rooms`, {
      participants: [appointment.patient, appointment.provider],
      admins: [appointment.provider],
      context: appointment.id,
      upsert: true
    });

    // 3. Send pre-consultation message
    await POST(`/chat-rooms/${chatRoom.id}/messages`, {
      messageType: 'text',
      message: 'Ready for our consultation'
    });

    // 4. Start video call
    const videoMessage = await POST(`/chat-rooms/${chatRoom.id}/messages`, {
      messageType: 'video_call',
      videoCallData: { status: 'starting' }
    });

    // 5. Provider joins
    const joinResult = await POST(`/chat-rooms/${chatRoom.id}/video-call/join`, {
      displayName: 'Dr. Smith'
    });

    expect(joinResult.roomUrl).toBeDefined();
    expect(joinResult.participants).toHaveLength(2);

    // 6. End call
    await POST(`/chat-rooms/${chatRoom.id}/video-call/end`);

    // 7. Verify room state
    const updatedRoom = await GET(`/chat-rooms/${chatRoom.id}`);
    expect(updatedRoom.activeVideoCallMessage).toBeNull();
  });
});
```

#### 2. Concurrent Call Prevention
```typescript
it('should prevent multiple active video calls per room', async () => {
  const chatRoom = await createChatRoom();
  
  // Start first video call
  await POST(`/chat-rooms/${chatRoom.id}/messages`, {
    messageType: 'video_call'
  });
  
  // Attempt second video call - should fail
  await expect(
    POST(`/chat-rooms/${chatRoom.id}/messages`, {
      messageType: 'video_call'
    })
  ).rejects.toMatchObject({
    status: 409,
    error: 'ACTIVE_VIDEO_CALL_EXISTS'
  });
});
```

## Summary

The Comms Module provides a streamlined, focused solution for video consultations with:

- **75% code reduction** from the original communication module
- **Domain-agnostic design** with flexible context associations
- **Facebook Messenger-style UX** familiar to all users
- **Immutable message history** with embedded video call data
- **Efficient active call management** with O(1) concurrent call prevention
- **Action-based API design** with clear video call lifecycle management
- **Security-compliant architecture** with proper encryption and audit trails
- **Upsert support** for idempotent room creation operations

This design balances simplicity with functionality, providing exactly what's needed for video consultations without coupling to specific domain modules.