import { describe, test, expect, afterEach, mock } from 'bun:test'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { VideoCallUI } from './video-call-ui'
import type { ConnectionState } from './video-call-ui'

afterEach(() => cleanup())

const defaultProps = {
  localStream: null,
  remoteStream: null,
  connectionState: 'connected' as ConnectionState,
  audioEnabled: true,
  videoEnabled: true,
  isScreenSharing: false,
  error: null,
  onToggleMic: mock(() => {}),
  onToggleCamera: mock(() => {}),
  onStartScreenShare: mock(async () => {}),
  onStopScreenShare: mock(() => {}),
  onEndCall: mock(() => {}),
  localLabel: 'You',
  remoteLabel: 'Host',
}

describe('VideoCallUI', () => {
  test('renders without crashing in connected state', () => {
    render(<VideoCallUI {...defaultProps} />)
    expect(document.body).toBeDefined()
  })

  test('renders connection status badge', () => {
    render(<VideoCallUI {...defaultProps} connectionState="connected" />)
    expect(screen.getByText(/connected/i)).toBeDefined()
  })

  test('renders connecting state', () => {
    render(<VideoCallUI {...defaultProps} connectionState="connecting" />)
    expect(screen.getByText(/connecting/i)).toBeDefined()
  })

  test('renders reconnecting state', () => {
    render(<VideoCallUI {...defaultProps} connectionState="reconnecting" />)
    expect(screen.getByText(/reconnecting/i)).toBeDefined()
  })

  test('renders call controls (end call button)', () => {
    render(<VideoCallUI {...defaultProps} />)
    expect(screen.getByTitle('End call')).toBeDefined()
  })

  test('renders mute button', () => {
    render(<VideoCallUI {...defaultProps} audioEnabled={true} />)
    expect(screen.getByTitle('Mute microphone')).toBeDefined()
  })

  test('renders camera button', () => {
    render(<VideoCallUI {...defaultProps} videoEnabled={true} />)
    expect(screen.getByTitle('Turn off camera')).toBeDefined()
  })

  test('calls onEndCall when end call clicked', async () => {
    const onEndCall = mock(() => {})
    render(<VideoCallUI {...defaultProps} onEndCall={onEndCall} />)
    const user = userEvent.setup()
    await user.click(screen.getByTitle('End call'))
    expect(onEndCall).toHaveBeenCalledTimes(1)
  })

  test('calls onToggleMic when mic clicked', async () => {
    const onToggleMic = mock(() => {})
    render(<VideoCallUI {...defaultProps} onToggleMic={onToggleMic} />)
    const user = userEvent.setup()
    await user.click(screen.getByTitle('Mute microphone'))
    expect(onToggleMic).toHaveBeenCalledTimes(1)
  })

  test('calls onToggleCamera when camera clicked', async () => {
    const onToggleCamera = mock(() => {})
    render(<VideoCallUI {...defaultProps} onToggleCamera={onToggleCamera} />)
    const user = userEvent.setup()
    await user.click(screen.getByTitle('Turn off camera'))
    expect(onToggleCamera).toHaveBeenCalledTimes(1)
  })

  test('shows error alert when error prop provided', () => {
    render(<VideoCallUI {...defaultProps} error="Connection failed" />)
    expect(screen.getByText(/connection failed/i)).toBeDefined()
  })

  test('renders with idle state', () => {
    render(<VideoCallUI {...defaultProps} connectionState="idle" />)
    expect(document.body).toBeDefined()
  })

  test('renders with failed state', () => {
    render(<VideoCallUI {...defaultProps} connectionState="failed" />)
    expect(screen.getByText(/failed/i)).toBeDefined()
  })

  test('renders local label', () => {
    render(<VideoCallUI {...defaultProps} localLabel="Me" />)
    expect(screen.getByText('Me')).toBeDefined()
  })

  test('renders remote label', () => {
    render(<VideoCallUI {...defaultProps} remoteLabel="Client" />)
    expect(screen.getByText('Client')).toBeDefined()
  })
})
