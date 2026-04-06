/**
 * Video Call UI Component
 * Main video call interface layout
 * 
 * This is a pure presentational component that receives all state as props.
 * No SDK imports, no hooks for call state - parent component manages all logic.
 */

import { VideoTile } from './video-tile'
import { CallControls } from './call-controls'
import { ConnectionStatus } from './connection-status'
import { Alert, AlertDescription } from '@monobase/ui/components/alert'
import { AlertCircle } from 'lucide-react'

export type ConnectionState = 
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'failed'

interface VideoCallUIProps {
  localStream: MediaStream | null
  remoteStream: MediaStream | null
  connectionState: ConnectionState
  audioEnabled: boolean
  videoEnabled: boolean
  isScreenSharing: boolean
  error: string | null
  onToggleMic: () => void
  onToggleCamera: () => void
  onStartScreenShare: () => void
  onStopScreenShare: () => void
  onEndCall: () => void
  localLabel?: string  // Configurable label for local video (e.g., "You", "Client")
  remoteLabel?: string // Configurable label for remote video (e.g., "Provider", "Participant")
}

export function VideoCallUI({
  localStream,
  remoteStream,
  connectionState,
  audioEnabled,
  videoEnabled,
  isScreenSharing,
  error,
  onToggleMic,
  onToggleCamera,
  onStartScreenShare,
  onStopScreenShare,
  onEndCall,
  localLabel = 'You',
  remoteLabel = 'Participant'
}: VideoCallUIProps) {
  return (
    <div className="fixed inset-0 bg-gray-950 flex flex-col">
      {/* Connection Status Overlay */}
      <div className="absolute top-4 left-4 z-10">
        <ConnectionStatus state={connectionState} />
      </div>

      {/* Error Alert */}
      {error && (
        <div className="absolute top-4 right-4 z-10 w-96">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* Remote Video (Main/Large) */}
      <div className="flex-1 relative">
        <VideoTile
          stream={remoteStream}
          className="w-full h-full"
          label={remoteLabel}
        />

        {/* Local Video Preview (Small/Corner) */}
        <div className="absolute bottom-20 right-4 w-64 h-48 z-10">
          <VideoTile
            stream={localStream}
            muted={true}
            className="w-full h-full shadow-xl border-2 border-gray-700"
            label={localLabel}
          />
        </div>
      </div>

      {/* Call Controls (Bottom) */}
      <div className="bg-gray-900/80 backdrop-blur-sm py-6">
        <CallControls
          audioEnabled={audioEnabled}
          videoEnabled={videoEnabled}
          isScreenSharing={isScreenSharing}
          onToggleMic={onToggleMic}
          onToggleCamera={onToggleCamera}
          onStartScreenShare={onStartScreenShare}
          onStopScreenShare={onStopScreenShare}
          onEndCall={onEndCall}
        />
      </div>
    </div>
  )
}
