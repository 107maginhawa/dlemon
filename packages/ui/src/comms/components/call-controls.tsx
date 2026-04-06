/**
 * Call Controls Component
 * Buttons for mute/camera/end call actions
 */

import { Mic, MicOff, Video, VideoOff, PhoneOff, Monitor, MonitorOff } from 'lucide-react'
import { Button } from '@monobase/ui/components/button'
import { cn } from '@monobase/ui/lib/utils'

interface CallControlsProps {
  audioEnabled: boolean
  videoEnabled: boolean
  isScreenSharing: boolean
  onToggleMic: () => void
  onToggleCamera: () => void
  onStartScreenShare: () => void
  onStopScreenShare: () => void
  onEndCall: () => void
  className?: string
}

export function CallControls({
  audioEnabled,
  videoEnabled,
  isScreenSharing,
  onToggleMic,
  onToggleCamera,
  onStartScreenShare,
  onStopScreenShare,
  onEndCall,
  className
}: CallControlsProps) {
  return (
    <div className={cn('flex items-center justify-center gap-4', className)}>
      {/* Microphone Toggle */}
      <Button
        variant={audioEnabled ? 'secondary' : 'destructive'}
        size="lg"
        className="rounded-full h-14 w-14"
        onClick={onToggleMic}
        title={audioEnabled ? 'Mute microphone' : 'Unmute microphone'}
      >
        {audioEnabled ? (
          <Mic className="h-6 w-6" />
        ) : (
          <MicOff className="h-6 w-6" />
        )}
      </Button>

      {/* Camera Toggle */}
      <Button
        variant={videoEnabled ? 'secondary' : 'destructive'}
        size="lg"
        className="rounded-full h-14 w-14"
        onClick={onToggleCamera}
        title={videoEnabled ? 'Turn off camera' : 'Turn on camera'}
      >
        {videoEnabled ? (
          <Video className="h-6 w-6" />
        ) : (
          <VideoOff className="h-6 w-6" />
        )}
      </Button>

      {/* Screen Share Toggle */}
      <Button
        variant={isScreenSharing ? 'default' : 'secondary'}
        size="lg"
        className="rounded-full h-14 w-14"
        onClick={isScreenSharing ? onStopScreenShare : onStartScreenShare}
        title={isScreenSharing ? 'Stop screen sharing' : 'Start screen sharing'}
      >
        {isScreenSharing ? (
          <Monitor className="h-6 w-6" />
        ) : (
          <MonitorOff className="h-6 w-6" />
        )}
      </Button>

      {/* End Call */}
      <Button
        variant="destructive"
        size="lg"
        className="rounded-full h-14 w-14 bg-red-600 hover:bg-red-700"
        onClick={onEndCall}
        title="End call"
      >
        <PhoneOff className="h-6 w-6" />
      </Button>
    </div>
  )
}
