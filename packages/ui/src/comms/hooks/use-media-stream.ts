/**
 * Hook for managing local media stream (camera/mic) and display stream (screen sharing)
 */

import { useEffect, useState } from 'react'
import {
  getLocalMediaStream,
  stopMediaStream,
  toggleAudio,
  toggleVideo,
  getDisplayMediaStream,
  stopDisplayStream
} from '../lib/media-devices'

export interface UseMediaStreamOptions {
  initialAudio?: boolean
  initialVideo?: boolean
}

interface UseMediaStreamReturn {
  stream: MediaStream | null
  displayStream: MediaStream | null
  error: string | null
  audioEnabled: boolean
  videoEnabled: boolean
  isScreenSharing: boolean
  toggleMic: () => void
  toggleCamera: () => void
  startScreenShare: () => Promise<void>
  stopScreenShare: () => void
}

export function useMediaStream(
  options: UseMediaStreamOptions = {}
): UseMediaStreamReturn {
  const { initialAudio = true, initialVideo = true } = options
  
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [displayStream, setDisplayStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [audioEnabled, setAudioEnabled] = useState(initialAudio)
  const [videoEnabled, setVideoEnabled] = useState(initialVideo)
  const [isScreenSharing, setIsScreenSharing] = useState(false)

  // Initialize camera/mic stream
  useEffect(() => {
    let mounted = true

    async function initStream() {
      try {
        const mediaStream = await getLocalMediaStream(initialAudio, initialVideo)

        if (mounted) {
          setStream(mediaStream)
          setError(null)
        } else {
          // Component unmounted before stream ready, cleanup
          stopMediaStream(mediaStream)
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to access media devices')
        }
      }
    }

    initStream()

    return () => {
      mounted = false
      if (stream) {
        stopMediaStream(stream)
      }
    }
  }, [initialAudio, initialVideo])

  // Cleanup display stream on unmount
  useEffect(() => {
    return () => {
      if (displayStream) {
        stopDisplayStream(displayStream)
      }
    }
  }, [displayStream])

  const toggleMic = () => {
    if (stream) {
      const newState = !audioEnabled
      toggleAudio(stream, newState)
      setAudioEnabled(newState)
    }
  }

  const toggleCamera = () => {
    if (stream) {
      const newState = !videoEnabled
      toggleVideo(stream, newState)
      setVideoEnabled(newState)
    }
  }

  const startScreenShare = async () => {
    if (isScreenSharing) {
      console.warn('[useMediaStream] Already screen sharing')
      return
    }

    try {
      const displayMediaStream = await getDisplayMediaStream()

      // Listen for browser stop sharing button
      displayMediaStream.getVideoTracks()[0].addEventListener('ended', () => {
        console.log('[useMediaStream] Screen sharing stopped by user')
        setIsScreenSharing(false)
        setDisplayStream(null)
      })

      setDisplayStream(displayMediaStream)
      setIsScreenSharing(true)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start screen sharing')
    }
  }

  const stopScreenShare = () => {
    if (displayStream) {
      stopDisplayStream(displayStream)
      setDisplayStream(null)
      setIsScreenSharing(false)
    }
  }

  return {
    stream,
    displayStream,
    error,
    audioEnabled,
    videoEnabled,
    isScreenSharing,
    toggleMic,
    toggleCamera,
    startScreenShare,
    stopScreenShare
  }
}