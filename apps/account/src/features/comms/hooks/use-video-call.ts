/**
 * Main video call orchestration hook
 * Coordinates peer connection with local media streams for UI components
 */

import { useEffect, useState, useCallback } from 'react'
import { useMediaStream } from './use-media-stream'

// Type definitions for VideoPeerConnection interface
// These match the SDK implementation but are defined here for type safety
type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'failed'

interface ChatMessage {
  id: string
  text: string
  senderId: string
  timestamp: number
  type: 'chat'
}

interface VideoPeerConnection {
  onRemoteStream: (handler: (stream: MediaStream) => void) => void
  onConnectionStateChange: (handler: (state: string) => void) => void
  onChatMessage: (handler: (message: ChatMessage) => void) => void
  replaceVideoTrack: (track: MediaStreamTrack) => Promise<void>
  restoreVideoTrack: (track: MediaStreamTrack) => Promise<void>
  sendChatMessage: (text: string) => void
  close: () => void
}

interface UseVideoCallReturn {
  localStream: MediaStream | null
  remoteStream: MediaStream | null
  connectionState: ConnectionState
  audioEnabled: boolean
  videoEnabled: boolean
  isScreenSharing: boolean
  error: string | null
  toggleMic: () => void
  toggleCamera: () => void
  startScreenShare: () => Promise<void>
  stopScreenShare: () => void
  endCall: () => void
  sendChatMessage: (text: string) => void
  onChatMessage: (handler: (message: ChatMessage) => void) => void
}

interface UseVideoCallProps {
  peerConnection: VideoPeerConnection | null // From SDK, passed as prop
  roomId: string
  isInitiator: boolean
}

export function useVideoCall({
  peerConnection,
  roomId,
  isInitiator
}: UseVideoCallProps): UseVideoCallReturn {
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting')
  const [chatHandlers, setChatHandlers] = useState<Array<(message: ChatMessage) => void>>([])

  // Get local media stream and screen sharing
  const {
    stream: localStream,
    displayStream,
    error: mediaError,
    audioEnabled,
    videoEnabled,
    isScreenSharing,
    toggleMic,
    toggleCamera,
    startScreenShare: startShare,
    stopScreenShare: stopShare
  } = useMediaStream({ initialAudio: true, initialVideo: true })

  // Setup peer connection handlers
  useEffect(() => {
    if (!peerConnection) {
      setConnectionState('disconnected')
      setRemoteStream(null)
      return
    }

    // Handle remote stream
    peerConnection.onRemoteStream((stream) => {
      console.log('[useVideoCall] Received remote stream')
      setRemoteStream(stream)
    })

    // Handle connection state changes
    peerConnection.onConnectionStateChange((state) => {
      console.log('[useVideoCall] Connection state:', state)

      switch (state) {
        case 'connected':
          setConnectionState('connected')
          break
        case 'disconnected':
        case 'closed':
          setConnectionState('disconnected')
          break
        case 'failed':
          setConnectionState('failed')
          break
        default:
          setConnectionState('connecting')
      }
    })

    // Handle chat messages
    peerConnection.onChatMessage((message: ChatMessage) => {
      chatHandlers.forEach(handler => handler(message))
    })

    // Initial connection state
    setConnectionState('connecting')

    // Cleanup on unmount or peerConnection change
    return () => {
      setRemoteStream(null)
      setConnectionState('disconnected')
    }
  }, [peerConnection, chatHandlers])

  // When screen sharing starts, replace video track
  useEffect(() => {
    if (peerConnection && displayStream && isScreenSharing && connectionState === 'connected') {
      const screenTrack = displayStream.getVideoTracks()[0]
      if (screenTrack) {
        peerConnection.replaceVideoTrack(screenTrack).catch(err => {
          console.error('[useVideoCall] Failed to replace video track:', err)
        })
      }
    }
  }, [peerConnection, displayStream, isScreenSharing, connectionState])

  // When screen sharing stops, restore camera track
  useEffect(() => {
    if (peerConnection && !isScreenSharing && localStream && connectionState === 'connected') {
      const cameraTrack = localStream.getVideoTracks()[0]
      if (cameraTrack) {
        peerConnection.restoreVideoTrack(cameraTrack).catch(err => {
          console.error('[useVideoCall] Failed to restore camera track:', err)
        })
      }
    }
  }, [peerConnection, isScreenSharing, localStream, connectionState])

  const startScreenShare = useCallback(async () => {
    if (connectionState !== 'connected') {
      console.warn('[useVideoCall] Cannot share screen - not connected')
      return
    }
    try {
      await startShare()
    } catch (error) {
      console.error('[useVideoCall] Screen share failed:', error)
      throw error
    }
  }, [connectionState, startShare])

  const stopScreenShare = useCallback(() => {
    stopShare()
  }, [stopShare])

  const endCall = useCallback(() => {
    if (peerConnection) {
      peerConnection.close()
    }
    setRemoteStream(null)
    setConnectionState('disconnected')
  }, [peerConnection])

  const sendChatMessage = useCallback((text: string) => {
    if (peerConnection) {
      peerConnection.sendChatMessage(text)
    } else {
      console.warn('[useVideoCall] Cannot send chat message - peer connection not initialized')
    }
  }, [peerConnection])

  const onChatMessage = useCallback((handler: (message: ChatMessage) => void) => {
    setChatHandlers(prev => [...prev, handler])

    // Return cleanup function to remove handler
    return () => {
      setChatHandlers(prev => prev.filter(h => h !== handler))
    }
  }, [])

  return {
    localStream,
    remoteStream,
    connectionState,
    audioEnabled,
    videoEnabled,
    isScreenSharing,
    error: mediaError,
    toggleMic,
    toggleCamera,
    startScreenShare,
    stopScreenShare,
    endCall,
    sendChatMessage,
    onChatMessage
  }
}