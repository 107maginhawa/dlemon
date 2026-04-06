import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { formatDate } from '@monobase/ui/lib/format-date'
import {
  Video,
  MessageCircle,
  User,
  Clock,
  Activity,
  Send,
  Check,
  Info,
  FileText,
  Calendar,
  X,
  Monitor,
  MonitorOff,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { requireAuth, requireEmailVerified, requirePerson, composeGuards } from '@/utils/guards'
import { useSession, useToken } from '@monobase/sdk/react/hooks/use-auth'
import { useBooking } from '@monobase/sdk/react/hooks/use-booking'
import { useVideoCall } from '@monobase/ui/comms/hooks/use-video-call'
import { VideoTile } from '@monobase/ui/comms/components/video-tile'
import { Button } from '@monobase/ui/components/button'
import * as commsApi from '@monobase/sdk/services/comms'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from '@monobase/ui/components/card'
import { Badge } from '@monobase/ui/components/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@monobase/ui/components/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@monobase/ui/components/tabs'
import { Input } from '@monobase/ui/components/input'
import { Separator } from '@monobase/ui/components/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@monobase/ui/components/dialog'
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@monobase/ui/components/alert'

export const Route = createFileRoute('/_dashboard/consultations/$id')({
  beforeLoad: composeGuards(requireAuth, requireEmailVerified, requirePerson),
  component: ConsultationPage,
})

type ChatMessage = {
  id: string
  sender: 'provider' | 'patient'
  message: string
  timestamp: string
  type: 'text' | 'file' | 'image'
  fileName?: string
}

function ConsultationPage() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const { data: session } = useSession()
  const { data: token } = useToken()

  // Fetch real appointment data
  const {
    data: appointmentData,
    isLoading: isLoadingAppointment,
    error: appointmentError,
  } = useBooking(id, 'provider,provider.person')

  // Chat states
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')

  // UI states
  const [showEndDialog, setShowEndDialog] = useState(false)
  const [showInfoDialog, setShowInfoDialog] = useState(false)
  const [callEnded, setCallEnded] = useState(false)
  const [callDuration, setCallDuration] = useState(0)
  const [isJoiningCall, setIsJoiningCall] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)

  // WebRTC video call integration
  const {
    localStream,
    remoteStream,
    connectionState,
    audioEnabled,
    videoEnabled,
    isScreenSharing,
    error: videoError,
    toggleMic,
    toggleCamera,
    startScreenShare,
    stopScreenShare,
    endCall,
    sendChatMessage,
    onChatMessage
  } = useVideoCall({
    roomId: id, // Use appointment ID as room ID
    token: token || '', // Use Better-Auth session token
    isInitiator: false // Patient joins the call (provider is initiator)
  })

  // Initialize call timer
  useEffect(() => {
    if (connectionState === 'connected') {
      const timer = setInterval(() => {
        setCallDuration(prev => prev + 1)
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [connectionState])

  // Join video call when component mounts
  useEffect(() => {
    async function joinCall() {
      if (!session?.user) return

      setIsJoiningCall(true)
      setJoinError(null)

      try {
        // Join the video call via REST API
        const response = await commsApi.joinVideoCall(id, {
          displayName: session.user.name || 'Patient',
          audioEnabled: true,
          videoEnabled: true,
        })

        console.log('[Consultation] Joined video call successfully')
      } catch (error) {
        console.error('[Consultation] Failed to join video call:', error)
        setJoinError(error instanceof Error ? error.message : 'Failed to join video call')
      } finally {
        setIsJoiningCall(false)
      }
    }

    joinCall()
  }, [id, session?.user])

  // Leave video call when component unmounts
  useEffect(() => {
    return () => {
      // Leave the call when navigating away or closing the page
      commsApi.leaveVideoCall(id).catch(error => {
        console.error('[Consultation] Failed to leave video call:', error)
      })
    }
  }, [id])

  // Update participant status when toggling mic or camera
  useEffect(() => {
    async function updateStatus() {
      if (connectionState !== 'connected') return

      try {
        await commsApi.updateVideoCallParticipant(id, {
          audioEnabled,
          videoEnabled,
        })
      } catch (error) {
        console.error('[Consultation] Failed to update participant status:', error)
      }
    }

    updateStatus()
  }, [id, audioEnabled, videoEnabled, connectionState])

  // Derive appointment object from fetched data
  const appointment = appointmentData && typeof appointmentData.provider === 'object' ? {
    id: appointmentData.id,
    providerName: `${appointmentData.provider.person.firstName} ${appointmentData.provider.person.lastName}`,
    providerTitle: appointmentData.provider.providerType.charAt(0).toUpperCase() + appointmentData.provider.providerType.slice(1),
    providerAvatar: appointmentData.provider.person.avatar,
    appointmentDate: formatDate(new Date(appointmentData.scheduledAt), { format: 'full' }),
    appointmentTime: formatDate(new Date(appointmentData.scheduledAt), { format: 'time' }),
    reason: appointmentData.reason,
    durationMinutes: appointmentData.durationMinutes,
  } : null

  // Setup WebSocket chat message handler
  useEffect(() => {
    if (!session?.user) return

    onChatMessage((message) => {
      // Determine sender based on user ID
      const sender = message.from === session.user.id ? 'patient' : 'provider'

      const chatMessage: ChatMessage = {
        id: Date.now().toString(),
        sender,
        message: message.text,
        timestamp: message.timestamp,
        type: 'text'
      }

      setChatMessages(prev => [...prev, chatMessage])
    })
  }, [session?.user, onChatMessage])

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const getConnectionBadgeVariant = () => {
    switch (connectionState) {
      case 'connected': return 'default'
      case 'connecting': return 'secondary'
      case 'failed': return 'destructive'
      default: return 'outline'
    }
  }

  const getConnectionLabel = () => {
    switch (connectionState) {
      case 'connecting': return 'Connecting...'
      case 'connected': return 'Connected'
      case 'disconnected': return 'Disconnected'
      case 'failed': return 'Connection Failed'
      default: return 'Unknown'
    }
  }

  const sendMessage = () => {
    if (newMessage.trim()) {
      // Send via WebSocket - message will be added to state when we receive it back
      sendChatMessage(newMessage)
      setNewMessage('')
    }
  }

  const handleEndConsultation = () => {
    setShowEndDialog(true)
  }

  const confirmEndConsultation = async () => {
    try {
      // End video call on backend
      await commsApi.endVideoCall(id)
      console.log('[Consultation] Video call ended on backend')
    } catch (error) {
      console.error('[Consultation] Failed to end video call on backend:', error)
      // Continue with local cleanup even if backend call fails
    }

    // End local WebRTC connection
    endCall()
    setCallEnded(true)
    setShowEndDialog(false)
  }

  // Show loading state while fetching appointment
  if (isLoadingAppointment) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Loading consultation details...</p>
      </div>
    )
  }

  // Show error state if appointment fetch failed
  if (appointmentError || !appointment) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] gap-6 p-6">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Unable to Load Consultation</h2>
            <p className="text-muted-foreground mb-6">
              {appointmentError instanceof Error
                ? appointmentError.message
                : 'Failed to load appointment details. Please try again.'}
            </p>
            <Button onClick={() => navigate({ to: '/appointments' })}>
              <Calendar className="mr-2 h-4 w-4" />
              Back to Appointments
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Show join error if video call join failed
  if (joinError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] gap-6 p-6">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Failed to Join Call</h2>
            <p className="text-muted-foreground mb-6">{joinError}</p>
            <Button onClick={() => window.location.reload()}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Show post-consultation summary after call ends
  if (callEnded || connectionState === 'disconnected') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] gap-6 p-6">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <Check className="h-16 w-16 text-green-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Consultation Complete</h2>
            <p className="text-muted-foreground mb-6">
              Your consultation with {appointment.providerName} has ended.
            </p>
            <div className="space-y-2 text-sm bg-muted rounded-lg p-4 mb-6">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Duration:</span>
                <span className="font-medium">{formatDuration(callDuration)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Provider:</span>
                <span className="font-medium">{appointment.providerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Date:</span>
                <span className="font-medium">{appointment.appointmentDate}</span>
              </div>
            </div>
            <Alert className="mb-6">
              <Info className="h-4 w-4" />
              <AlertDescription>
                Your consultation notes and any prescriptions will be available in your medical records within 24 hours.
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => navigate({ to: '/medical-records' })}
            >
              <FileText className="mr-2 h-4 w-4" />
              View Medical Records
            </Button>
            <Button
              className="flex-1"
              onClick={() => navigate({ to: '/appointments' })}
            >
              <Calendar className="mr-2 h-4 w-4" />
              My Appointments
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900">
      {/* Header Bar */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Avatar className="h-10 w-10">
            <AvatarImage src={appointment.providerAvatar} />
            <AvatarFallback>
              {appointment.providerName.split(' ').map(n => n[0]).join('')}
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="font-semibold">{appointment.providerName}</h2>
            <p className="text-sm text-muted-foreground">{appointment.providerTitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4" />
            <span>{formatDuration(callDuration)}</span>
          </div>
          <Badge variant={getConnectionBadgeVariant()}>
            {getConnectionLabel()}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowInfoDialog(true)}
          >
            <Info className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Video Area (2/3 width) */}
        <div className="flex-[2] relative bg-gray-900 flex flex-col">
          {/* Error Alert */}
          {videoError && (
            <Alert variant="destructive" className="m-4">
              <AlertDescription>{videoError}</AlertDescription>
            </Alert>
          )}

          {/* Remote Video (Provider's video - large) */}
          <div className="flex-1 relative">
            <VideoTile
              stream={remoteStream}
              className="w-full h-full"
              label={appointment.providerName}
            />

            {/* Local Video Preview (Patient's own video - small, bottom-right) */}
            <div className="absolute bottom-4 right-4 w-64 h-48">
              <VideoTile
                stream={localStream}
                muted={true}
                className="w-full h-full shadow-xl border-2 border-gray-700 rounded-lg"
                label="You"
              />
            </div>

            {/* Screen Sharing Indicator */}
            {isScreenSharing && (
              <div className="absolute top-4 left-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
                <Monitor className="h-4 w-4" />
                <span className="text-sm font-medium">You are sharing your screen</span>
              </div>
            )}
          </div>

          {/* Video Controls (Bottom) */}
          <div className="bg-gray-800/90 backdrop-blur-sm py-4 px-6">
            <div className="flex items-center justify-center gap-4">
              <Button
                size="lg"
                variant={audioEnabled ? "secondary" : "destructive"}
                className="rounded-full w-14 h-14"
                onClick={toggleMic}
                title={audioEnabled ? "Mute microphone" : "Unmute microphone"}
              >
                {audioEnabled ? <Video className="h-6 w-6" /> : <X className="h-6 w-6" />}
              </Button>
              <Button
                size="lg"
                variant={videoEnabled ? "secondary" : "destructive"}
                className="rounded-full w-14 h-14"
                onClick={toggleCamera}
                title={videoEnabled ? "Turn off camera" : "Turn on camera"}
              >
                {videoEnabled ? <Video className="h-6 w-6" /> : <X className="h-6 w-6" />}
              </Button>
              <Button
                size="lg"
                variant={isScreenSharing ? "default" : "secondary"}
                className="rounded-full w-14 h-14"
                onClick={isScreenSharing ? stopScreenShare : startScreenShare}
                disabled={connectionState !== 'connected'}
                title={isScreenSharing ? "Stop sharing screen" : "Share screen"}
              >
                {isScreenSharing ? <MonitorOff className="h-6 w-6" /> : <Monitor className="h-6 w-6" />}
              </Button>
              <Button
                size="lg"
                variant="destructive"
                className="rounded-full w-14 h-14"
                onClick={handleEndConsultation}
                title="End consultation"
              >
                <X className="h-6 w-6" />
              </Button>
            </div>
          </div>
        </div>

        {/* Side Panel (1/3 width) */}
        <div className="flex-[1] bg-white border-l flex flex-col">
          <Tabs defaultValue="provider" className="flex-1 flex flex-col">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="provider">Provider Info</TabsTrigger>
              <TabsTrigger value="chat">Chat</TabsTrigger>
            </TabsList>

            <TabsContent value="provider" className="flex-1 overflow-auto p-4">
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-lg mb-2">{appointment.providerName}</h3>
                  <p className="text-sm text-muted-foreground">{appointment.providerTitle}</p>
                </div>

                <Separator />

                <div>
                  <h4 className="font-medium mb-2">Appointment Details</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Date:</span>
                      <span>{appointment.appointmentDate}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Time:</span>
                      <span>{appointment.appointmentTime}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Type:</span>
                      <span>Video Consultation</span>
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="font-medium mb-2">Reason for Visit</h4>
                  <p className="text-sm text-muted-foreground">{appointment.reason}</p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="chat" className="flex-1 flex flex-col">
              {/* Chat Messages */}
              <div className="flex-1 overflow-auto p-4 space-y-4">
                {chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.sender === 'patient' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-3 ${
                        msg.sender === 'patient'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <p className="text-sm">{msg.message}</p>
                      <p className="text-xs opacity-70 mt-1">
                        {formatDate(new Date(msg.timestamp), { format: 'time' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Chat Input */}
              <div className="border-t p-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  />
                  <Button onClick={sendMessage}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* End Consultation Confirmation Dialog */}
      <Dialog open={showEndDialog} onOpenChange={setShowEndDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>End Consultation</DialogTitle>
            <DialogDescription>
              Are you sure you want to end this video consultation with {appointment.providerName}?
              This will disconnect the call.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEndDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmEndConsultation}>
              End Consultation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Appointment Info Dialog */}
      <Dialog open={showInfoDialog} onOpenChange={setShowInfoDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Consultation Information</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Appointment Details</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Appointment ID:</span>
                  <span className="font-mono">{appointment.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Provider:</span>
                  <span>{appointment.providerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date:</span>
                  <span>{appointment.appointmentDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Time:</span>
                  <span>{appointment.appointmentTime}</span>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
