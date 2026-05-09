import { describe, test, expect, afterEach, mock } from 'bun:test'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CallControls } from './call-controls'

afterEach(() => cleanup())

const defaultProps = {
  audioEnabled: true,
  videoEnabled: true,
  isScreenSharing: false,
  onToggleMic: mock(() => {}),
  onToggleCamera: mock(() => {}),
  onStartScreenShare: mock(() => {}),
  onStopScreenShare: mock(() => {}),
  onEndCall: mock(() => {}),
}

describe('CallControls', () => {
  test('renders without crashing', () => {
    render(<CallControls {...defaultProps} />)
    expect(document.body).toBeDefined()
  })

  test('renders mute microphone button when audio enabled', () => {
    render(<CallControls {...defaultProps} audioEnabled={true} />)
    expect(screen.getByTitle('Mute microphone')).toBeDefined()
  })

  test('renders unmute microphone button when audio disabled', () => {
    render(<CallControls {...defaultProps} audioEnabled={false} />)
    expect(screen.getByTitle('Unmute microphone')).toBeDefined()
  })

  test('renders turn off camera button when video enabled', () => {
    render(<CallControls {...defaultProps} videoEnabled={true} />)
    expect(screen.getByTitle('Turn off camera')).toBeDefined()
  })

  test('renders turn on camera button when video disabled', () => {
    render(<CallControls {...defaultProps} videoEnabled={false} />)
    expect(screen.getByTitle('Turn on camera')).toBeDefined()
  })

  test('renders start screen sharing button when not sharing', () => {
    render(<CallControls {...defaultProps} isScreenSharing={false} />)
    expect(screen.getByTitle('Start screen sharing')).toBeDefined()
  })

  test('renders stop screen sharing button when sharing', () => {
    render(<CallControls {...defaultProps} isScreenSharing={true} />)
    expect(screen.getByTitle('Stop screen sharing')).toBeDefined()
  })

  test('renders end call button', () => {
    render(<CallControls {...defaultProps} />)
    expect(screen.getByTitle('End call')).toBeDefined()
  })

  test('calls onToggleMic when mic button clicked', async () => {
    const onToggleMic = mock(() => {})
    render(<CallControls {...defaultProps} onToggleMic={onToggleMic} />)
    const user = userEvent.setup()
    await user.click(screen.getByTitle('Mute microphone'))
    expect(onToggleMic).toHaveBeenCalledTimes(1)
  })

  test('calls onToggleCamera when camera button clicked', async () => {
    const onToggleCamera = mock(() => {})
    render(<CallControls {...defaultProps} onToggleCamera={onToggleCamera} />)
    const user = userEvent.setup()
    await user.click(screen.getByTitle('Turn off camera'))
    expect(onToggleCamera).toHaveBeenCalledTimes(1)
  })

  test('calls onStartScreenShare when screen share button clicked (not sharing)', async () => {
    const onStartScreenShare = mock(() => {})
    render(
      <CallControls
        {...defaultProps}
        isScreenSharing={false}
        onStartScreenShare={onStartScreenShare}
      />
    )
    const user = userEvent.setup()
    await user.click(screen.getByTitle('Start screen sharing'))
    expect(onStartScreenShare).toHaveBeenCalledTimes(1)
  })

  test('calls onStopScreenShare when screen share button clicked (sharing)', async () => {
    const onStopScreenShare = mock(() => {})
    render(
      <CallControls
        {...defaultProps}
        isScreenSharing={true}
        onStopScreenShare={onStopScreenShare}
      />
    )
    const user = userEvent.setup()
    await user.click(screen.getByTitle('Stop screen sharing'))
    expect(onStopScreenShare).toHaveBeenCalledTimes(1)
  })

  test('calls onEndCall when end call button clicked', async () => {
    const onEndCall = mock(() => {})
    render(<CallControls {...defaultProps} onEndCall={onEndCall} />)
    const user = userEvent.setup()
    await user.click(screen.getByTitle('End call'))
    expect(onEndCall).toHaveBeenCalledTimes(1)
  })

  test('mic button has destructive variant when muted', () => {
    render(<CallControls {...defaultProps} audioEnabled={false} />)
    const btn = screen.getByTitle('Unmute microphone')
    // destructive variant adds bg-destructive or similar class
    expect(btn.className).toContain('destructive')
  })

  test('camera button has destructive variant when off', () => {
    render(<CallControls {...defaultProps} videoEnabled={false} />)
    const btn = screen.getByTitle('Turn on camera')
    expect(btn.className).toContain('destructive')
  })

  test('accepts optional className prop', () => {
    const { container } = render(<CallControls {...defaultProps} className="test-class" />)
    expect(container.firstChild).not.toBeNull()
  })
})
