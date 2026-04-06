# `@monobase/sdk`

Type-safe frontend SDK for the Monobase Application Platform. Provides API client utilities, service functions, and React hooks for seamless integration with the Monobase API.

## Architecture

The SDK is organized into two main layers:

1. **Core Layer** - Vanilla TypeScript API client and service functions
2. **React Layer** - TanStack Query hooks and Better-Auth integration

```
packages/sdk/src/
├── api.ts              # Core API client (fetch wrapper)
├── services/           # API service functions
│   ├── auth.ts         # Auth type re-exports (User, Session)
│   ├── person.ts       # Person profile operations
│   ├── notifications.ts # Notification operations
│   ├── storage.ts      # File upload/download
│   ├── comms.ts        # Chat rooms, messages, video calls
│   ├── booking.ts      # Provider search and booking slots
│   └── billing.ts      # Merchant accounts and invoices
├── react/              # React-specific code
│   ├── provider.tsx    # ApiProvider setup
│   ├── auth.ts         # Better-Auth client factory
│   ├── query-keys.ts   # TanStack Query key factory
│   └── hooks/          # React hooks
│       ├── use-auth.ts          # Better-Auth hooks
│       ├── use-person.ts        # Person hooks
│       ├── use-notifications.ts # Notification hooks
│       ├── use-storage.ts       # File upload hook
│       ├── use-comms.ts         # Chat and video call hooks
│       ├── use-booking.ts       # Booking providers and slots
│       └── use-billing.ts       # Billing and invoices hooks
└── utils/
    ├── api.ts          # API utilities (pagination, sanitization)
    ├── format.ts       # Date formatting utilities
    └── webrtc/         # WebRTC utilities
        ├── signaling-client.ts  # WebSocket signaling for WebRTC
        └── peer-connection.ts   # RTCPeerConnection wrapper
```

## Installation

Add to your app's `package.json`:

```json
{
  "dependencies": {
    "@monobase/sdk": "workspace:*"
  }
}
```

## Setup

### React Applications

Wrap your app with `ApiProvider`:

```tsx
import { ApiProvider } from "@monobase/sdk/react/provider"

function App() {
  return (
    <ApiProvider apiBaseUrl="http://localhost:7213">
      <YourApp />
    </ApiProvider>
  )
}
```

The `ApiProvider` automatically:
- Configures the API base URL
- Sets up TanStack Query with optimized defaults
- Initializes Better-Auth client
- Provides auth state to all hooks

### Custom QueryClient (Optional)

```tsx
import { QueryClient } from "@tanstack/react-query"
import { ApiProvider } from "@monobase/sdk/react/provider"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 10, // Custom: 10 minutes
    },
  },
})

function App() {
  return (
    <ApiProvider 
      apiBaseUrl="http://localhost:7213"
      queryClient={queryClient}
    >
      <YourApp />
    </ApiProvider>
  )
}
```

## Available Exports

### Core API Client

```typescript
import { apiGet, apiPost, apiPatch, apiDelete } from "@monobase/sdk/api"
import { ApiError } from "@monobase/sdk/api"

// Make authenticated requests
const data = await apiGet('/endpoint', { param: 'value' })
await apiPost('/endpoint', { body: 'data' })
await apiPatch('/endpoint', { body: 'data' })
await apiDelete('/endpoint')

// Handle errors
try {
  await apiGet('/endpoint')
} catch (error) {
  if (error instanceof ApiError) {
    console.error(error.status, error.message)
  }
}
```

### Services

#### Auth Service

```typescript
import type { User, Session } from "@monobase/sdk/services/auth"

// Type re-exports from Better-Auth
// Use these for type annotations in your components
function MyComponent() {
  const session: Session | null = // ...
  const user: User = session?.user
}
```

#### Person Service

```typescript
import {
  getMyProfile,
  createMyPerson,
  updateMyPersonalInfo,
  updateMyContactInfo,
  updateMyAddress,
  updateMyPreferences,
  type Person,
} from "@monobase/sdk/services/person"

const profile = await getMyProfile()
const newProfile = await createMyPerson({ firstName: "John" })
```

#### Notifications Service

```typescript
import {
  listNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  type Notification,
} from "@monobase/sdk/services/notifications"

const notifications = await listNotifications({ status: 'unread' })
await markNotificationAsRead(notificationId)
```

#### Storage Service

```typescript
import {
  requestFileUpload,
  uploadToPresignedUrl,
  completeFileUpload,
  getFileDownload,
} from "@monobase/sdk/services/storage"

// 4-step upload process
const upload = await requestFileUpload({ filename, size, mimeType })
await uploadToPresignedUrl(upload.uploadUrl, file)
await completeFileUpload(upload.file)
const download = await getFileDownload(upload.file)
```

#### Booking Service

```typescript
import {
  searchProviders,
  getProviderWithSlots,
  type SearchProvidersParams,
  type PaginatedProviders,
  type ProviderWithSlots,
} from "@monobase/sdk/services/booking"

// Search providers
const providers = await searchProviders({
  q: 'massage therapy',
  location: 'New York',
  language: 'en',
  offset: 0,
  limit: 20,
})

// Get provider with available slots
const providerData = await getProviderWithSlots(providerId)
console.log(providerData.provider, providerData.slots, providerData.event)
```

#### Billing Service

```typescript
import {
  getMyMerchantAccount,
  createMyMerchantAccount,
  getMyOnboardingUrl,
  getMyDashboardLink,
  listMyInvoices,
  getInvoice,
  initiateInvoicePayment,
  isOnboardingComplete,
  canAccessDashboard,
  getAccountSetupStatus,
  type MerchantAccount,
  type Invoice,
  type InvoiceListParams,
} from "@monobase/sdk/services/billing"

// Merchant account management
const account = await getMyMerchantAccount()
const status = getAccountSetupStatus(account)

if (status === 'none') {
  // Create merchant account and get onboarding URL
  const newAccount = await createMyMerchantAccount({
    refreshUrl: 'https://app.example.com/onboarding',
    returnUrl: 'https://app.example.com/dashboard',
  })
  // Redirect to newAccount.onboardingUrl
}

if (status === 'incomplete' && account) {
  // Continue onboarding
  const { onboardingUrl } = await getMyOnboardingUrl(
    account.id,
    'https://app.example.com/onboarding',
    'https://app.example.com/dashboard'
  )
  // Redirect to onboardingUrl
}

if (canAccessDashboard(account)) {
  // Access Stripe dashboard
  const { dashboardUrl } = await getMyDashboardLink(account.id)
  // Open dashboardUrl in new tab
}

// Invoice management
const invoices = await listMyInvoices({
  status: 'sent',
  limit: 20,
  offset: 0,
})

const invoice = await getInvoice(invoiceId)

// Initiate payment
if (invoice.status === 'sent') {
  const payment = await initiateInvoicePayment(invoiceId, {
    successUrl: 'https://app.example.com/payment/success',
    cancelUrl: 'https://app.example.com/payment/cancel',
  })
  // Redirect to payment.checkoutUrl
}
```

### React Hooks

#### Authentication Hooks

```typescript
import {
  // Session management
  useSession,
  usePrefetchSession,
  useListAccounts,
  useListSessions,
  useListDeviceSessions,
  useListPasskeys,
  // User updates
  useUpdateUser,
  // Account & session management
  useUnlinkAccount,
  useRevokeOtherSessions,
  useRevokeSession,
  useRevokeSessions,
  useSetActiveSession,
  useRevokeDeviceSession,
  useDeletePasskey,
  // Custom hooks
  useSignOut,
  useEmailVerification,
  // Low-level hooks
  useAuthQuery,
  useAuthMutation,
} from "@monobase/sdk/react/hooks/use-auth"

// Basic session usage
function MyComponent() {
  const { data: session } = useSession()
  const updateUser = useUpdateUser()
  const sendVerification = useEmailVerification()

  return <div>Welcome {session?.user?.name}</div>
}

// Sign out with cache invalidation
function LogoutButton() {
  const signOut = useSignOut()
  
  return (
    <button onClick={() => signOut.mutate()}>
      Sign Out
    </button>
  )
}

// Email verification
function VerifyEmailButton({ email }: { email: string }) {
  const sendVerification = useEmailVerification()
  
  const handleSend = () => {
    sendVerification.mutate({
      email,
      callbackURL: window.location.origin + '/dashboard',
    })
  }
  
  return <button onClick={handleSend}>Send Verification</button>
}
```

**Note**: These hooks integrate [Better-Auth](https://better-auth.com) with TanStack Query. Most hooks are generated by `@daveyplate/better-auth-tanstack`, while `useSignOut` and `useEmailVerification` are custom wrappers with automatic cache invalidation.

#### Person Hooks

```typescript
import {
  useMyPerson,
  useCreateMyPerson,
  useUpdateMyPersonalInfo,
  useUpdateMyContactInfo,
  useUpdateMyAddress,
  useUpdateMyPreferences,
} from "@monobase/sdk/react/hooks/use-person"

function ProfilePage() {
  const { data: person, isLoading } = useMyPerson()
  const updateInfo = useUpdateMyPersonalInfo()

  const handleSubmit = (data) => {
    updateInfo.mutate(data)
  }

  if (isLoading) return <div>Loading...</div>
  if (!person) return <div>No profile found</div>

  return <div>{person.firstName}</div>
}
```

#### Notification Hooks

```typescript
import {
  useNotifications,
  useUnreadNotifications,
  useMarkNotificationAsRead,
  useMarkAllNotificationsAsRead,
} from "@monobase/sdk/react/hooks/use-notifications"

function NotificationBell() {
  const { data: unread } = useUnreadNotifications()
  const markAsRead = useMarkNotificationAsRead()

  return (
    <div>
      {unread?.data.length} unread
      <button onClick={() => markAsRead.mutate(notificationId)}>
        Mark as read
      </button>
    </div>
  )
}
```

#### Storage Hook

```typescript
import { useFileUpload } from "@monobase/sdk/react/hooks/use-storage"

function FileUploader() {
  const { upload, isUploading, progress } = useFileUpload({
    maxFileSize: 50 * 1024 * 1024, // 50MB
  })

  const handleUpload = async (file: File) => {
    try {
      const result = await upload(file)
      console.log('Uploaded:', result.downloadUrl)
    } catch (error) {
      console.error('Upload failed:', error)
    }
  }

  return (
    <div>
      <input type="file" onChange={(e) => handleUpload(e.target.files?.[0])} />
      {isUploading && <div>Progress: {progress}%</div>}
    </div>
  )
}
```

#### Booking Hooks

```typescript
import {
  useSearchProviders,
  useProviderWithSlots,
} from "@monobase/sdk/react/hooks/use-booking"

// Search providers
function ProviderSearch() {
  const { data, isLoading } = useSearchProviders({
    q: 'therapy',
    limit: 20,
  })

  if (isLoading) return <div>Loading...</div>

  return (
    <div>
      {data?.data.map(provider => (
        <div key={provider.id}>{provider.name}</div>
      ))}
    </div>
  )
}

// Get provider with slots
function BookingPage({ providerId }: { providerId: string }) {
  const { data, isLoading } = useProviderWithSlots(providerId)

  if (isLoading) return <div>Loading...</div>

  return (
    <div>
      <h1>{data?.provider.name}</h1>
      <p>Available slots: {data?.slots.length}</p>
      {data?.slots.map(slot => (
        <div key={slot.id}>
          {slot.startTime.toLocaleString()} - ${slot.price}
        </div>
      ))}
    </div>
  )
}
```

#### Billing Hooks

```typescript
import {
  useMyMerchantAccount,
  useMyMerchantAccountStatus,
  useCreateMyMerchantAccount,
  useGetMyOnboardingUrl,
  useGetMyDashboardLink,
  useMyInvoices,
  useInvoice,
  useInitiatePayment,
} from "@monobase/sdk/react/hooks/use-billing"

// Merchant account management
function MerchantSetup() {
  const { data: account, isLoading } = useMyMerchantAccount()
  const status = useMyMerchantAccountStatus()
  const createAccount = useCreateMyMerchantAccount()

  const handleSetup = async () => {
    await createAccount.mutateAsync({
      refreshUrl: window.location.href,
      returnUrl: '/dashboard',
    })
    // Automatically redirects to Stripe Connect onboarding
  }

  if (isLoading) return <div>Loading...</div>

  return (
    <div>
      <p>Account Status: {status}</p>
      {status === 'none' && (
        <button onClick={handleSetup}>Set Up Payment Account</button>
      )}
      {status === 'incomplete' && (
        <button onClick={handleSetup}>Continue Setup</button>
      )}
      {status === 'complete' && (
        <p>Payment account is active!</p>
      )}
    </div>
  )
}

// Invoice management
function InvoicesList() {
  const { data, isLoading } = useMyInvoices({
    status: 'sent',
    limit: 20,
  })

  if (isLoading) return <div>Loading...</div>

  return (
    <div>
      {data?.data.map(invoice => (
        <div key={invoice.id}>
          {invoice.invoiceNumber} - ${invoice.total} - {invoice.status}
        </div>
      ))}
    </div>
  )
}

// Payment initiation
function InvoicePayment({ invoiceId }: { invoiceId: string }) {
  const { data: invoice } = useInvoice(invoiceId)
  const initiatePayment = useInitiatePayment()

  const handlePay = async () => {
    await initiatePayment.mutateAsync({
      invoiceId,
      successUrl: '/payment/success',
      cancelUrl: '/payment/cancel',
    })
    // Automatically redirects to Stripe Checkout
  }

  return (
    <div>
      <h2>Invoice {invoice?.invoiceNumber}</h2>
      <p>Total: ${invoice?.total}</p>
      <button onClick={handlePay} disabled={invoice?.status !== 'sent'}>
        Pay Now
      </button>
    </div>
  )
}
```

#### Comms Hooks

```typescript
import {
  useChatRooms,
  useChatRoom,
  useCreateChatRoom,
  useChatMessages,
  useSendMessage,
  useStartVideoCall,
} from "@monobase/sdk/react/hooks/use-comms"

// List chat rooms
function ChatRoomsList() {
  const { data: rooms, isLoading } = useChatRooms({
    status: 'active',
    limit: 20,
  })
  const createRoom = useCreateChatRoom()

  const handleCreate = () => {
    createRoom.mutate({
      name: 'New Chat Room',
      participants: [{ personId: '123', role: 'member' }],
    })
  }

  if (isLoading) return <div>Loading...</div>

  return (
    <div>
      <button onClick={handleCreate}>Create Room</button>
      {rooms?.items.map(room => (
        <div key={room.id}>{room.name}</div>
      ))}
    </div>
  )
}

// Chat messages
function ChatMessagesView({ roomId }: { roomId: string }) {
  const { data: messages } = useChatMessages(roomId)
  const sendMessage = useSendMessage()

  const handleSend = (text: string) => {
    sendMessage.mutate({ roomId, message: text })
  }

  return (
    <div>
      {messages?.items.map(msg => (
        <div key={msg.id}>{msg.message}</div>
      ))}
      <input onKeyDown={(e) => {
        if (e.key === 'Enter') handleSend(e.currentTarget.value)
      }} />
    </div>
  )
}
```

### Comms Module

The SDK provides comprehensive chat and video call functionality through REST APIs, WebSocket signaling, and WebRTC peer connections.

#### REST API Client

```typescript
import {
  listChatRooms,
  getChatRoom,
  createChatRoom,
  updateChatRoom,
  archiveChatRoom,
  getChatMessages,
  sendTextMessage,
  updateMessage,
  deleteMessage,
  getIceServers,
  startVideoCall,
  joinVideoCall,
  endVideoCall,
  leaveVideoCall,
  updateVideoCallParticipant,
} from "@monobase/sdk/services/comms"

// Chat rooms
const rooms = await listChatRooms({ status: 'active', limit: 20 })
const room = await getChatRoom(roomId)
const newRoom = await createChatRoom({
  name: 'Project Discussion',
  participants: [{ personId: '123', role: 'member' }],
})

// Messages
const messages = await getChatMessages(roomId, { limit: 50, offset: 0 })
const message = await sendTextMessage(roomId, 'Hello!')
await updateMessage(roomId, messageId, { text: 'Updated text' })
await deleteMessage(roomId, messageId)

// Video calls
const iceServers = await getIceServers()
const call = await startVideoCall(roomId, [
  { personId: '123', role: 'host' },
  { personId: '456', role: 'participant' },
])
const session = await joinVideoCall(roomId, { deviceCapabilities: { audio: true, video: true } })
await updateVideoCallParticipant(roomId, { audioEnabled: false })
await leaveVideoCall(roomId)
await endVideoCall(roomId) // Host only
```

#### WebSocket Signaling Client

```typescript
import { SignalingClient } from "@monobase/sdk/utils/webrtc/signaling-client"

const signalingClient = new SignalingClient(
  'http://localhost:7213',
  roomId,
  authToken
)

// Listen for WebRTC signaling events
signalingClient.on('offer', (data) => {
  console.log('Received offer:', data)
})

signalingClient.on('answer', (data) => {
  console.log('Received answer:', data)
})

signalingClient.on('ice-candidate', (data) => {
  console.log('Received ICE candidate:', data)
})

signalingClient.on('error', (error) => {
  console.error('Signaling error:', error)
})

// Connect and send signals
signalingClient.connect()
signalingClient.send('offer', sessionDescription)
signalingClient.send('answer', sessionDescription)
signalingClient.send('ice-candidate', iceCandidate)
signalingClient.disconnect()
```

#### WebRTC Peer Connection

```typescript
import { VideoPeerConnection } from "@monobase/sdk/utils/webrtc/peer-connection"

const peerConnection = new VideoPeerConnection(
  signalingClient,
  iceServers,
  localStream
)

// Handle remote stream
peerConnection.onRemoteStream((stream) => {
  remoteVideoElement.srcObject = stream
})

// Handle connection state changes
peerConnection.onConnectionStateChange((state) => {
  console.log('Connection state:', state)
})

// Initialize connection (as host)
await peerConnection.createOffer()

// Initialize connection (as participant)
await peerConnection.createAnswer()

// Replace video track (e.g., for screen sharing)
const screenStream = await navigator.mediaDevices.getDisplayMedia()
const screenTrack = screenStream.getVideoTracks()[0]
await peerConnection.replaceVideoTrack(screenTrack)

// Cleanup
peerConnection.close()
```

#### React Hooks

```typescript
import {
  // Chat rooms
  useChatRooms,
  useChatRoom,
  useCreateChatRoom,
  useUpsertChatRoom,
  usePrefetchChatRoom,
  useInvalidateChatRooms,
  // Chat messages
  useChatMessages,
  useInfiniteChatMessages,
  useSendMessage,
  useStartVideoCall,
  useSendChatMessage,
  usePrefetchChatMessages,
  useInvalidateChatMessages,
  useOptimisticSendMessage,
} from "@monobase/sdk/react/hooks/use-comms"

// List chat rooms
function ChatRoomsList() {
  const { data, isLoading } = useChatRooms({
    status: 'active',
    limit: 20,
  })

  if (isLoading) return <div>Loading...</div>

  return (
    <div>
      {data?.items.map(room => (
        <div key={room.id}>{room.name}</div>
      ))}
    </div>
  )
}

// Single chat room with messages
function ChatRoom({ roomId }: { roomId: string }) {
  const { data: room } = useChatRoom(roomId)
  const { data: messages } = useChatMessages(roomId)
  const sendMessage = useSendMessage()

  return (
    <div>
      <h1>{room?.name}</h1>
      {messages?.items.map(msg => (
        <div key={msg.id}>{msg.message}</div>
      ))}
      <input onKeyDown={(e) => {
        if (e.key === 'Enter') {
          sendMessage.mutate({ 
            roomId,
            message: e.currentTarget.value 
          })
        }
      }} />
    </div>
  )
}

// Video call management
function VideoCallManager({ roomId }: { roomId: string }) {
  const startCall = useStartVideoCall()

  const handleStartCall = () => {
    startCall.mutate({
      roomId,
      participants: [
        { 
          user: '123', 
          displayName: 'John Doe',
          audioEnabled: true,
          videoEnabled: true
        },
      ],
    })
  }

  return (
    <div>
      <button onClick={handleStartCall}>Start Call</button>
    </div>
  )
}
```

**Note**: The SDK provides the **network layer** for comms. For UI components and browser media APIs, see `@monobase/ui/comms`.

### Utilities

```typescript
import { PaginatedResponse, sanitizeObject } from "@monobase/sdk/utils/api"
import { formatDate } from "@monobase/sdk/utils/format"

// Handle paginated responses
const response: PaginatedResponse<Notification> = await listNotifications()
console.log(response.data, response.pagination)

// Sanitize form data for API submission
const clean = sanitizeObject(formData, {
  nullable: ['lastName', 'middleName', 'primaryAddress']
})

// Format dates
const dateStr = formatDate(new Date(), { format: 'date' })
```

## Type Safety

All service functions use OpenAPI-generated types from `@monobase/api-spec`:

```typescript
import type { components } from "@monobase/api-spec/types"

type ApiPerson = components["schemas"]["Person"]
```

The SDK provides **frontend-friendly types** that:
- Use `Date` objects instead of ISO strings
- Provide cleaner interfaces for React components
- Handle type mapping between API and frontend

See [CONTRIBUTING.md](./CONTRIBUTING.md) for type mapping patterns.

## Common Patterns

### Form Integration

```tsx
import { PersonalInfoForm } from "@monobase/ui/person/components/personal-info-form"
import { useUpdateMyPersonalInfo } from "@monobase/sdk/react/hooks/use-person"

function EditProfile() {
  const updateInfo = useUpdateMyPersonalInfo()

  return (
    <PersonalInfoForm
      onSubmit={(data) => updateInfo.mutate(data)}
      isSubmitting={updateInfo.isPending}
    />
  )
}
```

### Optimistic Updates

Notification hooks use optimistic updates for better UX:

```typescript
// Mark as read immediately, rollback on error
const markAsRead = useMarkNotificationAsRead()
markAsRead.mutate(notificationId) // UI updates instantly
```

### Error Handling

All mutation hooks include built-in toast notifications:

```typescript
const updateInfo = useUpdateMyPersonalInfo()

// Success: Shows "Personal information updated successfully!"
// Error: Shows "Failed to update personal information"
updateInfo.mutate(data)
```

## Development

For monorepo setup and general development workflow, see the [main README](../../README.md).

For SDK-specific development patterns, see [CONTRIBUTING.md](./CONTRIBUTING.md).

## Testing

```bash
# Run type checking
bun run typecheck
```

## License

PROPRIETARY
