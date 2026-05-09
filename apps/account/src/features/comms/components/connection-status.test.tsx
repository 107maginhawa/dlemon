import { describe, test, expect, afterEach } from 'bun:test'
import { render, screen, cleanup } from '@testing-library/react'
import { ConnectionStatus } from './connection-status'

type ConnectionState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'failed'

afterEach(() => cleanup())

describe('ConnectionStatus', () => {
  test('renders without crashing for "idle" state', () => {
    render(<ConnectionStatus state="idle" />)
    expect(document.body).toBeDefined()
  })

  test('renders "connecting" state', () => {
    render(<ConnectionStatus state="connecting" />)
    expect(screen.getByText(/connecting/i)).toBeDefined()
  })

  test('renders "connected" state', () => {
    render(<ConnectionStatus state="connected" />)
    expect(screen.getByText(/connected/i)).toBeDefined()
  })

  test('renders "reconnecting" state', () => {
    render(<ConnectionStatus state="reconnecting" />)
    expect(screen.getByText(/reconnecting/i)).toBeDefined()
  })

  test('renders "disconnected" state', () => {
    render(<ConnectionStatus state="disconnected" />)
    expect(screen.getByText(/disconnected/i)).toBeDefined()
  })

  test('renders "failed" state', () => {
    render(<ConnectionStatus state="failed" />)
    expect(screen.getByText(/failed/i)).toBeDefined()
  })

  test('renders all connection states without crashing', () => {
    const states: ConnectionState[] = [
      'idle', 'connecting', 'connected', 'reconnecting', 'disconnected', 'failed',
    ]
    for (const state of states) {
      render(<ConnectionStatus state={state} />)
      cleanup()
    }
  })

  test('accepts optional className prop', () => {
    const { container } = render(<ConnectionStatus state="connected" className="test-class" />)
    expect(container.firstChild).not.toBeNull()
  })
})
