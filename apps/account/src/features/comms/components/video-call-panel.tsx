import { useEffect, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  getIceServersOptions,
  joinVideoCallMutation,
  leaveVideoCallMutation,
} from '@monobase/sdk-ts/generated/react-query'
import { VideoPeerConnection } from '@monobase/sdk-ts/utils/webrtc/peer-connection'
import { getSdkBaseUrl } from '@monobase/sdk-ts/client'
import type { IceServer } from '@monobase/sdk-ts/generated/types.gen'
import { useVideoCall } from '@/features/comms/hooks/use-video-call'
import { VideoCallUI } from '@/features/comms/components/video-call-ui'
import { Button } from '@/components/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/card'
import { Video, VideoOff } from 'lucide-react'

interface VideoCallPanelProps {
  /** Chat-room ID — used as the WebRTC room identifier. */
  roomId: string
  /** True if this user initiated the booking's host (defines who creates the offer). */
  isInitiator: boolean
  /** Display name shown to the other participant. */
  displayName: string
  /** True only when the booking is confirmed and within ±15min of scheduledAt. */
  enabled: boolean
}

function toRTCIceServer(s: IceServer): RTCIceServer {
  return {
    urls: s.urls,
    username: s.username,
    credential: s.credential,
  }
}

export function VideoCallPanel({
  roomId,
  isInitiator,
  displayName,
  enabled,
}: VideoCallPanelProps) {
  const [active, setActive] = useState(false)
  const [peer, setPeer] = useState<VideoPeerConnection | null>(null)

  // ICE servers fetched lazily — only when the user actually starts a call.
  const iceServersQuery = useQuery({
    ...getIceServersOptions(),
    enabled: active,
    staleTime: 5 * 60_000,
  })

  const join = useMutation({
    ...joinVideoCallMutation(),
    meta: { toast: { error: 'Could not join the call' } },
  })

  const leave = useMutation({ ...leaveVideoCallMutation() })

  // Construct the peer connection once we have ICE servers and have joined.
  useEffect(() => {
    if (!active || !iceServersQuery.data) return
    if (peer) return // already constructed

    const iceServers = iceServersQuery.data.iceServers.map(toRTCIceServer)
    const pc = new VideoPeerConnection(
      roomId,
      'session', // signaling auth handled via cookies; token kept for future use
      isInitiator,
      iceServers,
      getSdkBaseUrl(),
    )
    setPeer(pc)
    join.mutate({
      path: { room: roomId },
      body: { displayName, audioEnabled: true, videoEnabled: true },
    })
  }, [active, iceServersQuery.data, peer, roomId, isInitiator, displayName, join])

  // Cleanup when the component unmounts or the call ends.
  useEffect(() => {
    return () => {
      if (peer) {
        peer.close()
      }
    }
  }, [peer])

  const videoCall = useVideoCall({
    peerConnection: peer,
    roomId,
    isInitiator,
  })

  const handleStart = () => setActive(true)

  const handleEnd = () => {
    videoCall.endCall()
    if (peer) peer.close()
    leave.mutate({ path: { room: roomId } })
    setPeer(null)
    setActive(false)
  }

  if (!enabled) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <VideoOff className="h-4 w-4 text-muted-foreground" />
            Video call
          </CardTitle>
          <CardDescription>
            Video opens 15 minutes before the scheduled start.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (!active) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Video className="h-4 w-4" />
            Video call
          </CardTitle>
          <CardDescription>Ready when you are.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleStart}>{isInitiator ? 'Start call' : 'Join call'}</Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <VideoCallUI
      localStream={videoCall.localStream}
      remoteStream={videoCall.remoteStream}
      connectionState={videoCall.connectionState}
      audioEnabled={videoCall.audioEnabled}
      videoEnabled={videoCall.videoEnabled}
      isScreenSharing={videoCall.isScreenSharing}
      error={videoCall.error}
      onToggleMic={videoCall.toggleMic}
      onToggleCamera={videoCall.toggleCamera}
      onStartScreenShare={videoCall.startScreenShare}
      onStopScreenShare={videoCall.stopScreenShare}
      onEndCall={handleEnd}
      localLabel="You"
      remoteLabel={isInitiator ? 'Client' : 'Host'}
    />
  )
}
