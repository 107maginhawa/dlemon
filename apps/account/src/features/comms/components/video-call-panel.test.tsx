import { describe, test, expect, afterEach, mock } from 'bun:test'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Mock WebRTC and media APIs
const mockMediaStream = {
  getTracks: () => [],
  getAudioTracks: () => [{ enabled: true, stop: () => {} }],
  getVideoTracks: () => [{ enabled: true, stop: () => {} }],
}

Object.defineProperty(global, 'navigator', {
  value: {
    ...global.navigator,
    mediaDevices: {
      getUserMedia: mock(() => Promise.resolve(mockMediaStream)),
      getDisplayMedia: mock(() => Promise.resolve(mockMediaStream)),
    },
  },
  writable: true,
  configurable: true,
})

// Mock RTCPeerConnection
global.RTCPeerConnection = mock(() => ({
  createOffer: mock(async () => ({})),
  createAnswer: mock(async () => ({})),
  setLocalDescription: mock(async () => {}),
  setRemoteDescription: mock(async () => {}),
  addIceCandidate: mock(async () => {}),
  close: mock(() => {}),
  addEventListener: mock(() => {}),
  removeEventListener: mock(() => {}),
})) as unknown as typeof RTCPeerConnection

// Mock SDK hooks
mock.module('@monobase/sdk-ts/generated/react-query', () => ({
  getIceServersOptions: mock(() => ({
    queryKey: ['iceServers'],
    queryFn: mock(async () => ({ iceServers: [] })),
  })),
  joinVideoCallMutation: mock(() => ({
    mutationFn: mock(async () => ({})),
  })),
  leaveVideoCallMutation: mock(() => ({
    mutationFn: mock(async () => ({})),
  })),
}))

mock.module('@monobase/sdk-ts/utils/webrtc/peer-connection', () => ({
  VideoPeerConnection: mock(function () {
    return {
      close: mock(() => {}),
      addTrack: mock(() => {}),
    }
  }),
}))

mock.module('@monobase/sdk-ts/client', () => ({
  getSdkBaseUrl: mock(() => 'http://localhost:7213'),
}))

// Mock the useVideoCall hook
mock.module('@/features/comms/hooks/use-video-call', () => ({
  useVideoCall: mock(() => ({
    localStream: null,
    remoteStream: null,
    connectionState: 'idle' as const,
    audioEnabled: true,
    videoEnabled: true,
    isScreenSharing: false,
    error: null,
    toggleMic: mock(() => {}),
    toggleCamera: mock(() => {}),
    startScreenShare: mock(async () => {}),
    stopScreenShare: mock(() => {}),
    endCall: mock(() => {}),
  })),
}))

import { VideoCallPanel } from './video-call-panel'

afterEach(() => cleanup())

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={makeQueryClient()}>
      {children}
    </QueryClientProvider>
  )
}

describe('VideoCallPanel', () => {
  test('renders disabled state when enabled=false', () => {
    render(
      <Wrapper>
        <VideoCallPanel
          roomId="room-1"
          isInitiator={true}
          displayName="Test User"
          enabled={false}
        />
      </Wrapper>
    )
    expect(screen.getByText(/video opens 15 minutes before/i)).toBeDefined()
  })

  test('renders "Start call" button for initiator when enabled=true', () => {
    render(
      <Wrapper>
        <VideoCallPanel
          roomId="room-1"
          isInitiator={true}
          displayName="Test User"
          enabled={true}
        />
      </Wrapper>
    )
    expect(screen.getByRole('button', { name: /start call/i })).toBeDefined()
  })

  test('renders "Join call" button for non-initiator when enabled=true', () => {
    render(
      <Wrapper>
        <VideoCallPanel
          roomId="room-1"
          isInitiator={false}
          displayName="Client User"
          enabled={true}
        />
      </Wrapper>
    )
    expect(screen.getByRole('button', { name: /join call/i })).toBeDefined()
  })

  test('renders video call card title', () => {
    render(
      <Wrapper>
        <VideoCallPanel
          roomId="room-1"
          isInitiator={true}
          displayName="Test User"
          enabled={true}
        />
      </Wrapper>
    )
    expect(screen.getByText(/video call/i)).toBeDefined()
  })

  test('start call button is clickable', async () => {
    render(
      <Wrapper>
        <VideoCallPanel
          roomId="room-1"
          isInitiator={true}
          displayName="Test User"
          enabled={true}
        />
      </Wrapper>
    )
    const user = userEvent.setup()
    const btn = screen.getByRole('button', { name: /start call/i })
    // Should not throw
    await user.click(btn)
  })

  test('renders without crashing for non-initiator', () => {
    render(
      <Wrapper>
        <VideoCallPanel
          roomId="room-2"
          isInitiator={false}
          displayName="Guest"
          enabled={true}
        />
      </Wrapper>
    )
    expect(document.body).toBeDefined()
  })
})
