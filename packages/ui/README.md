# `@monobase/ui`

Shared UI component library for the Monobase Application Platform. Built with [shadcn/ui](https://ui.shadcn.com) for consistent, accessible components across all frontend applications.

## Architecture

This package follows a **domain-based organization pattern**:

- **Root directories** (`components/`, `hooks/`, `lib/`, `constants/`) contain **common/shared** code used across all domains
- **Domain subdirectories** (e.g., `person/`) are **self-contained** and can have their own `components/`, `hooks/`, `lib/`, `constants/`

```
packages/ui/src/
├── components/      # Common UI components (shadcn/ui)
├── hooks/           # Common React hooks
├── lib/             # Common utilities
├── constants/       # Common constants (countries, languages, timezones)
├── styles/          # Global CSS and theme
├── person/          # Person domain module
│   ├── components/  # Person-specific forms
│   └── schemas.ts   # Person validation schemas
├── comms/           # Comms domain module
│   ├── components/  # Video call UI components
│   ├── hooks/       # Media device hooks
│   └── lib/         # Browser media APIs
└── booking/         # Booking domain module
    ├── types.ts     # Booking types
    └── components/  # Booking widgets
```

## Installation

Add to your app's `package.json`:

```json
{
  "dependencies": {
    "@monobase/ui": "workspace:*"
  }
}
```

## Available Exports

### Styles
```typescript
import "@monobase/ui/styles"
```

### Common Components (shadcn/ui)
```typescript
import { Button } from "@monobase/ui/components/button"
import { Input } from "@monobase/ui/components/input"
import { Card } from "@monobase/ui/components/card"
import { Dialog } from "@monobase/ui/components/dialog"
// ... 40+ components available - see src/components/ for complete list
```

### Common Hooks
```typescript
import { useDetectCountry } from "@monobase/ui/hooks/use-detect-country"
import { useDetectLanguage } from "@monobase/ui/hooks/use-detect-language"
import { useDetectTimezone } from "@monobase/ui/hooks/use-detect-timezone"
import { useFormatCurrency } from "@monobase/ui/hooks/use-format-currency"
import { useFormatDate } from "@monobase/ui/hooks/use-format-date"
import { useMobile } from "@monobase/ui/hooks/use-mobile"
```

### Common Utilities
```typescript
import { cn } from "@monobase/ui/lib/utils"
import { detectCountry } from "@monobase/ui/lib/detect-country"
import { detectLanguage } from "@monobase/ui/lib/detect-language"
import { detectTimezone } from "@monobase/ui/lib/detect-timezone"
import { formatCurrency } from "@monobase/ui/lib/format-currency"
import { formatDate } from "@monobase/ui/lib/format-date"
```

### Common Constants
```typescript
import { COUNTRIES } from "@monobase/ui/constants/countries"
import { LANGUAGES } from "@monobase/ui/constants/languages"
import { TIMEZONES } from "@monobase/ui/constants/timezones"
```

### Domain: Person
```typescript
// Person-specific form components
import { PersonalInfoForm } from "@monobase/ui/person/components/personal-info-form"
import { ContactInfoForm } from "@monobase/ui/person/components/contact-info-form"
import { AddressForm } from "@monobase/ui/person/components/address-form"
import { PreferencesForm } from "@monobase/ui/person/components/preferences-form"

// Person validation schemas
import { personalInfoSchema, contactInfoSchema } from "@monobase/ui/person/schemas"
```

### Domain: Comms
```typescript
// Video call UI components
import { VideoTile } from "@monobase/ui/comms/components/video-tile"
import { CallControls } from "@monobase/ui/comms/components/call-controls"
import { ConnectionStatus } from "@monobase/ui/comms/components/connection-status"
import { VideoCallUI } from "@monobase/ui/comms/components/video-call-ui"

// Media device hooks
import { useMediaStream } from "@monobase/ui/comms/hooks/use-media-stream"
import { useVideoCall } from "@monobase/ui/comms/hooks/use-video-call"

// Browser media APIs
import {
  getLocalMediaStream,
  getDisplayMediaStream,
  toggleAudio,
  toggleVideo,
  stopMediaStream,
} from "@monobase/ui/comms/lib/media-devices"
```

### Domain: Booking
```typescript
// Booking UI components
import { BookingWidget } from "@monobase/ui/booking/components/booking-widget"
import { BookingWidgetSkeleton } from "@monobase/ui/booking/components/booking-widget-skeleton"
import { ActiveBookingCard } from "@monobase/ui/booking/components/active-booking-card"

// For booking domain data, use SDK types
import type {
  Booking,
  BookingTimeSlot,
  BookingProvider,
  BookingEventData,
} from "@monobase/sdk/services/booking"

// For user data, use SDK auth types
import type { User } from "@monobase/sdk/services/auth"
```

### Domain: Billing
```typescript
// Billing UI components
import { MerchantAccountSetup } from "@monobase/ui/billing/components/merchant-account-setup"

// Component prop types (exported from component)
import type {
  MerchantAccountSetupStatus,
  MerchantAccountFormProps,
} from "@monobase/ui/billing/components/merchant-account-setup"

// For invoice/merchant account data, use SDK types
import type { Invoice, MerchantAccount } from "@monobase/sdk/services/billing"
```

## Usage Examples

### Person Forms

```tsx
import "@monobase/ui/styles"
import { PersonalInfoForm } from "@monobase/ui/person/components/personal-info-form"
import { useDetectCountry } from "@monobase/ui/hooks/use-detect-country"

export function ProfilePage() {
  const country = useDetectCountry()

  return (
    <PersonalInfoForm 
      onSubmit={handleSubmit}
      defaultValues={{ country }}
    />
  )
}
```

### Video Call UI

```tsx
import "@monobase/ui/styles"
import { VideoCallUI } from "@monobase/ui/comms/components/video-call-ui"
import { useMediaStream } from "@monobase/ui/comms/hooks/use-media-stream"
import { useVideoCall } from "@monobase/ui/comms/hooks/use-video-call"
import { VideoPeerConnection } from "@monobase/sdk/utils/webrtc/peer-connection"

export function VideoCallPage({ roomId }: { roomId: string }) {
  // Get local media (camera/mic)
  const {
    stream,
    audioEnabled,
    videoEnabled,
    isScreenSharing,
    toggleMic,
    toggleCamera,
    startScreenShare,
    stopScreenShare,
  } = useMediaStream({ initialAudio: true, initialVideo: true })

  // Create peer connection (from SDK)
  const peerConnection = new VideoPeerConnection(
    signalingClient,
    iceServers,
    stream
  )

  // Manage video call state
  const {
    remoteStream,
    connectionState,
    handleEndCall,
  } = useVideoCall({
    peerConnection,
    roomId,
    onCallEnded: () => {
      console.log('Call ended')
    },
  })

  return (
    <VideoCallUI
      localStream={stream}
      remoteStream={remoteStream}
      connectionState={connectionState}
      audioEnabled={audioEnabled}
      videoEnabled={videoEnabled}
      isScreenSharing={isScreenSharing}
      onToggleMic={toggleMic}
      onToggleCamera={toggleCamera}
      onStartScreenShare={startScreenShare}
      onStopScreenShare={stopScreenShare}
      onEndCall={handleEndCall}
      localLabel="You"
      remoteLabel="Remote User"
    />
  )
}
```

### Booking Widget

```tsx
import "@monobase/ui/styles"
import { BookingWidget, BookingWidgetSkeleton } from "@monobase/ui/booking/components/booking-widget"
import { useProviderWithSlots } from "@monobase/sdk/react/hooks/use-booking"

export function BookingPage({ providerId }: { providerId: string }) {
  const { data, isLoading } = useProviderWithSlots(providerId)

  if (isLoading) return <BookingWidgetSkeleton />

  return (
    <BookingWidget
      provider={data.provider}
      slots={data.slots}
      event={data.event}
      onSlotSelect={(slot) => {
        console.log('Selected slot:', slot)
        // Handle booking creation
      }}
    />
  )
}
```

### Active Booking Status Card

```tsx
import { ActiveBookingCard } from "@monobase/ui/booking/components/active-booking-card"
import type { Booking } from "@monobase/sdk/services/booking"
import type { User } from "@monobase/sdk/services/auth"

export function BookingStatusPage({ 
  booking,
  providerId,
  providerName,
  user 
}: {
  booking: Booking
  providerId: string
  providerName: string
  user: User
}) {
  return (
    <ActiveBookingCard
      booking={booking}
      providerId={providerId}
      providerName={providerName}
      user={user}
      onPaymentClick={() => router.push('/payment')}
      onCancelClick={() => handleCancel()}
      onProfileClick={() => router.push('/profile')}
      onBrowseProviders={() => router.push('/providers')}
      onViewAppointments={() => router.push('/appointments')}
    />
  )
}
```

### Merchant Account Setup

```tsx
import { MerchantAccountSetup } from "@monobase/ui/billing/components/merchant-account-setup"
import {
  useMyMerchantAccount,
  useMyMerchantAccountStatus,
  useCreateMyMerchantAccount,
} from "@monobase/sdk/react/hooks/use-billing"

export function OnboardingPage() {
  const { data: account, isLoading } = useMyMerchantAccount()
  const status = useMyMerchantAccountStatus()
  const createAccount = useCreateMyMerchantAccount()

  const handleSetup = async () => {
    const refreshUrl = window.location.href
    const returnUrl = '/dashboard'

    // Creates account and automatically redirects to Stripe onboarding
    await createAccount.mutateAsync({ refreshUrl, returnUrl })
  }

  return (
    <MerchantAccountSetup
      account={account}
      status={status}
      isLoading={isLoading}
      onSetupAccount={handleSetup}
      onSubmit={() => router.navigate('/dashboard')}
      onSkip={() => router.navigate('/dashboard')}
      showButtons={true}
    />
  )
}
```

## Comms Module

The UI package provides browser-based media device access and presentation components for video calls. All components are **prop-based** and stateless - they receive all state as props and have no internal network/API logic.

### Architecture

- **`lib/media-devices.ts`** - Browser MediaDevices API wrappers (camera, mic, screen)
- **`hooks/use-media-stream.ts`** - React hook for managing local media streams
- **`hooks/use-video-call.ts`** - React hook for orchestrating video calls (accepts peer connection as prop)
- **`components/`** - Pure presentation components for video call UI

**Important**: The UI package handles only browser APIs and presentation. For network layer (REST API, WebSocket, WebRTC peer connections), use `@monobase/sdk/services/comms` and `@monobase/sdk/utils/webrtc/`.

### Browser Media APIs

```typescript
import {
  getLocalMediaStream,
  getDisplayMediaStream,
  toggleAudio,
  toggleVideo,
  stopMediaStream,
} from "@monobase/ui/comms/lib/media-devices"

// Get camera and microphone access
const stream = await getLocalMediaStream(true, true)

// Get screen sharing stream
const screenStream = await getDisplayMediaStream()

// Toggle audio/video tracks
toggleAudio(stream, false) // Mute
toggleVideo(stream, false) // Turn off camera

// Cleanup
stopMediaStream(stream)
```

### Media Stream Hook

```typescript
import { useMediaStream } from "@monobase/ui/comms/hooks/use-media-stream"

function VideoCallComponent() {
  const {
    stream,          // Local media stream (camera/mic)
    displayStream,   // Screen sharing stream
    audioEnabled,
    videoEnabled,
    isScreenSharing,
    toggleMic,
    toggleCamera,
    startScreenShare,
    stopScreenShare,
    error,
  } = useMediaStream({
    initialAudio: true,
    initialVideo: true
  })

  return (
    <div>
      <video ref={videoRef} srcObject={stream} autoPlay muted />
      <button onClick={toggleMic}>
        {audioEnabled ? 'Mute' : 'Unmute'}
      </button>
      <button onClick={toggleCamera}>
        {videoEnabled ? 'Stop Video' : 'Start Video'}
      </button>
      <button onClick={isScreenSharing ? stopScreenShare : startScreenShare}>
        {isScreenSharing ? 'Stop Sharing' : 'Share Screen'}
      </button>
    </div>
  )
}
```

### Video Call Hook

The `useVideoCall` hook orchestrates video calls by coordinating with a peer connection (from SDK).

```typescript
import { useVideoCall } from "@monobase/ui/comms/hooks/use-video-call"
import { VideoPeerConnection } from "@monobase/sdk/utils/webrtc/peer-connection"

function VideoCall({ roomId, peerConnection }: {
  roomId: string
  peerConnection: VideoPeerConnection // From SDK
}) {
  const {
    remoteStream,
    connectionState,
    handleEndCall,
  } = useVideoCall({
    peerConnection,
    roomId,
    onCallEnded: () => {
      console.log('Call ended')
    },
  })

  return (
    <div>
      <p>Connection: {connectionState}</p>
      <video srcObject={remoteStream} autoPlay />
      <button onClick={handleEndCall}>End Call</button>
    </div>
  )
}
```

**Connection States**: `'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'failed'`

### UI Components

All components are pure presentation - see individual component prop types for details:
- `VideoTile` - Displays a video stream with label
- `CallControls` - Action buttons for mic/camera/screen/end call
- `ConnectionStatus` - Shows connection state indicator
- `VideoCallUI` - Complete video call interface combining all components

## shadcn/ui Configuration

This package uses shadcn/ui with the following setup (defined in `components.json`):

- **Style**: `new-york`
- **Base Color**: `zinc`
- **CSS Variables**: Enabled
- **Icon Library**: `lucide-react`

Components are managed via the shadcn CLI. See [CONTRIBUTING.md](./CONTRIBUTING.md) for development details.

## Development

For monorepo setup and general development workflow, see the [main README](../../README.md).

For UI package-specific development patterns, see [CONTRIBUTING.md](./CONTRIBUTING.md).

## Testing

```bash
# Run tests
bun test

# Watch mode
bun test:watch
```

## License

PROPRIETARY
