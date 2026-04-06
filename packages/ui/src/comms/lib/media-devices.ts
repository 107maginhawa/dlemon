/**
 * Media Devices Utility
 * Handles camera/mic access and stream management
 */

export interface MediaDeviceOptions {
  audio: boolean
  video: boolean
}

/**
 * Request access to user's camera and microphone
 */
export async function getLocalMediaStream(
  audioEnabled: boolean = true,
  videoEnabled: boolean = true
): Promise<MediaStream> {
  try {
    const constraints: MediaStreamConstraints = {
      audio: audioEnabled,
      video: videoEnabled ? {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'user'
      } : false
    }

    const stream = await navigator.mediaDevices.getUserMedia(constraints)
    console.log('[MediaDevices] Got media stream:', {
      audioTracks: stream.getAudioTracks().length,
      videoTracks: stream.getVideoTracks().length
    })

    return stream
  } catch (error) {
    console.error('[MediaDevices] Failed to get media stream:', error)
    
    if (error instanceof DOMException) {
      if (error.name === 'NotAllowedError') {
        throw new Error('Camera/microphone permission denied. Please allow access and try again.')
      } else if (error.name === 'NotFoundError') {
        throw new Error('No camera or microphone found. Please connect a device and try again.')
      }
    }
    
    throw new Error('Failed to access camera/microphone. Please check your device settings.')
  }
}

/**
 * Toggle audio track on/off
 */
export function toggleAudio(stream: MediaStream, enabled: boolean): void {
  const audioTracks = stream.getAudioTracks()
  audioTracks.forEach(track => {
    track.enabled = enabled
  })
  console.log('[MediaDevices] Audio:', enabled ? 'enabled' : 'disabled')
}

/**
 * Toggle video track on/off
 */
export function toggleVideo(stream: MediaStream, enabled: boolean): void {
  const videoTracks = stream.getVideoTracks()
  videoTracks.forEach(track => {
    track.enabled = enabled
  })
  console.log('[MediaDevices] Video:', enabled ? 'enabled' : 'disabled')
}

/**
 * Stop all tracks in a media stream
 */
export function stopMediaStream(stream: MediaStream): void {
  stream.getTracks().forEach(track => {
    track.stop()
  })
  console.log('[MediaDevices] Stopped all media tracks')
}

/**
 * Check if camera/mic permissions are granted
 */
export async function checkMediaPermissions(): Promise<{ audio: boolean; video: boolean }> {
  try {
    const audioPermission = await navigator.permissions.query({ name: 'microphone' as PermissionName })
    const videoPermission = await navigator.permissions.query({ name: 'camera' as PermissionName })

    return {
      audio: audioPermission.state === 'granted',
      video: videoPermission.state === 'granted'
    }
  } catch (error) {
    console.warn('[MediaDevices] Permission query not supported')
    return { audio: false, video: false }
  }
}

/**
 * Request access to screen/window/tab for sharing
 */
export async function getDisplayMediaStream(): Promise<MediaStream> {
  try {
    // Check if getDisplayMedia is supported
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      throw new Error('Screen sharing is not supported in this browser')
    }

    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        // @ts-expect-error - cursor and displaySurface are valid constraints but not in TypeScript types yet
        cursor: 'always', // Show cursor in shared screen
        displaySurface: 'monitor', // Prefer entire screen
      },
      audio: false, // Screen audio usually not needed for medical consultations
    })

    console.log('[MediaDevices] Got display stream:', {
      videoTracks: stream.getVideoTracks().length
    })

    return stream
  } catch (error) {
    console.error('[MediaDevices] Failed to get display stream:', error)

    // If it's our own "not supported" error, rethrow it as-is
    if (error instanceof Error && error.message.includes('not supported')) {
      throw error
    }

    if (error instanceof DOMException) {
      if (error.name === 'NotAllowedError') {
        throw new Error('Screen sharing permission denied. Please allow access and try again.')
      } else if (error.name === 'NotFoundError') {
        throw new Error('No screen available to share')
      }
    }

    throw new Error('Failed to access screen sharing. Please try again.')
  }
}

/**
 * Stop screen sharing stream
 */
export function stopDisplayStream(stream: MediaStream): void {
  stream.getTracks().forEach(track => {
    track.stop()
  })
  console.log('[MediaDevices] Stopped display stream')
}