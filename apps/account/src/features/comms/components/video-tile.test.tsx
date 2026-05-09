import { describe, test, expect, afterEach } from 'bun:test'
import { render, screen, cleanup } from '@testing-library/react'
import { VideoTile } from './video-tile'

afterEach(() => cleanup())

describe('VideoTile', () => {
  test('renders without crashing with null stream', () => {
    render(<VideoTile stream={null} />)
    expect(document.body).toBeDefined()
  })

  test('renders label when provided', () => {
    render(<VideoTile stream={null} label="You" />)
    expect(screen.getByText('You')).toBeDefined()
  })

  test('renders remote label', () => {
    render(<VideoTile stream={null} label="Host" />)
    expect(screen.getByText('Host')).toBeDefined()
  })

  test('renders without label (no crash)', () => {
    render(<VideoTile stream={null} />)
    expect(document.body).toBeDefined()
  })

  test('renders video element', () => {
    render(<VideoTile stream={null} />)
    const video = document.querySelector('video')
    expect(video).not.toBeNull()
  })

  test('video element is muted when muted=true', () => {
    render(<VideoTile stream={null} muted={true} />)
    const video = document.querySelector('video') as HTMLVideoElement
    expect(video).not.toBeNull()
    expect(video.muted).toBe(true)
  })

  test('accepts optional className prop', () => {
    const { container } = render(<VideoTile stream={null} className="custom-tile" />)
    expect(container.firstChild).not.toBeNull()
  })

  test('renders label for remote participant', () => {
    // stream=null is sufficient; the video element handles null srcObject gracefully
    render(<VideoTile stream={null} label="Remote" />)
    expect(screen.getByText('Remote')).toBeDefined()
  })
})
