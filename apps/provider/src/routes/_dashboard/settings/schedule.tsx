import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import {
  Calendar,
  Plus,
  Trash2,
  Users,
  AlertCircle,
  Check,
  X,
  Loader2,
  Clock,
  Info,
} from 'lucide-react'
import { useCreateBookingEvent, useUpdateBookingEvent, useMyBookingEvent } from '@monobase/sdk/react/hooks/use-booking'
import { useSetupRequirements } from '@/hooks/use-setup-requirements'
import {
  getDayDisplayName,
  getDefaultWeeklySchedule,
  type DayName,
} from '@/utils/booking-helpers'
import { detectTimezone } from '@monobase/ui/lib/detect-timezone'
import { Button } from "@monobase/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@monobase/ui/components/card"
import { Badge } from "@monobase/ui/components/badge"
import { Label } from "@monobase/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@monobase/ui/components/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@monobase/ui/components/dialog"
import { Switch } from "@monobase/ui/components/switch"
import { Alert, AlertDescription, AlertTitle } from "@monobase/ui/components/alert"
import { Input } from "@monobase/ui/components/input"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@monobase/ui/components/tooltip"
import { MINOR_AILMENTS } from '@monobase/ui/constants/minor-ailments'
import { formatDate } from '@monobase/ui/lib/format-date'

export const Route = createFileRoute('/_dashboard/settings/schedule')({
  component: SchedulePage,
  beforeLoad: async ({ context }) => {
    return {
      person: context.auth.person,
      profile: context.auth.provider 
    }
  },
})

type TimeBlock = {
  startTime: string
  endTime: string
  slotDuration: number
  bufferTime: number
}

type DailyConfig = {
  enabled: boolean
  timeBlocks: TimeBlock[]
}

function SchedulePage() {
  const { person, profile } = Route.useRouteContext()
  const [showCreateScheduleDialog, setShowCreateScheduleDialog] = useState(false)
  const [showVisibilityDialog, setShowVisibilityDialog] = useState(false)
  const [pendingVisibilityAction, setPendingVisibilityAction] = useState<'enable' | 'disable' | null>(null)
  const [editedConfigs, setEditedConfigs] = useState<Record<DayName, DailyConfig> | null>(null)

  // Fetch my booking event
  const {
    data: activeEvent,
    isLoading: eventsLoading,
    error: eventsError,
  } = useMyBookingEvent()

  // Check setup requirements for public visibility
  const {
    accountComplete,
    professionalComplete,
    merchantComplete,
    allRequirementsMet,
    isLoading: requirementsLoading,
  } = useSetupRequirements()

  const createEvent = useCreateBookingEvent()
  const updateEvent = useUpdateBookingEvent()

  // Use edited configs if available, otherwise use active event configs
  const currentConfigs = editedConfigs || activeEvent?.dailyConfigs

  const handleCreateSchedule = async () => {
    await createEvent.mutateAsync({
      title: `${person.firstName} ${person.lastName} Virtual Consultation`,
      context: profile.id,
      timezone: detectTimezone(),
      locationTypes: ['video'],
      maxBookingDays: 7,
      minBookingMinutes: 15,
      status: 'draft',
      effectiveFrom: formatDate(new Date(), { format: 'iso' }),
      dailyConfigs: getDefaultWeeklySchedule(15, 5),
      billingConfig: {
        cancellationThresholdMinutes: 60,
        currency: 'CAD',
        price: 20,
      },
      formConfig: {
        fields: [
          { 
            name: 'minorAilment',
            label: 'Select Minor Ailments',
            type: 'select',
            required: true,
            options: MINOR_AILMENTS.map(item => ({ label: item.name, value: item.code }))
          },
          {
            name: 'hpi',
            label: 'History of Present Illness',
            type: 'textarea',
            placeholder: 'Please share any symptoms or relevant information...'
          }
        ]
      },
      keywords: [
        `${person.firstName} ${person.lastName}`,
      ],
      tags: [
        ...(profile.minorAilmentsPracticeLocations?.map(code => `loc::${code}`) || []),
        ...(profile.minorAilmentsSpecialties?.map(code => `loc::${code}`) || []),
      ]
    })

    setShowCreateScheduleDialog(false)
  }

  const togglePublicVisibility = (checked: boolean) => {
    if (!activeEvent || !allRequirementsMet) return

    const action = (activeEvent as any).status === 'active' ? 'disable' : 'enable'
    setPendingVisibilityAction(action)
    setShowVisibilityDialog(true)
  }

  const confirmVisibilityChange = async () => {
    if (!activeEvent || !pendingVisibilityAction) return

    const newStatus = pendingVisibilityAction === 'enable' ? 'active' : 'paused'

    await updateEvent.mutateAsync({
      eventId: activeEvent.id,
      data: {
        status: newStatus,
      },
    })

    setShowVisibilityDialog(false)
    setPendingVisibilityAction(null)
  }

  const toggleDayEnabled = (dayName: DayName) => {
    if (!currentConfigs) return

    const dayConfig = currentConfigs[dayName]
    const newEnabled = !dayConfig.enabled

    const newConfigs = {
      ...currentConfigs,
      [dayName]: {
        enabled: newEnabled,
        timeBlocks: newEnabled && dayConfig.timeBlocks.length === 0
          ? [{ startTime: '09:00', endTime: '17:00', slotDuration: 15, bufferTime: 5 }]
          : dayConfig.timeBlocks,
      },
    } as Record<DayName, DailyConfig>

    setEditedConfigs(newConfigs)
  }

  const updateDayTime = (
    dayName: DayName,
    field: 'startTime' | 'endTime' | 'slotDuration' | 'bufferTime',
    value: string | number
  ) => {
    if (!currentConfigs) return

    const dayConfig = currentConfigs[dayName]
    const block = dayConfig.timeBlocks[0]
    if (!block) return

    const updatedBlock = {
      ...block,
      [field]: value,
    }

    const newConfigs = {
      ...currentConfigs,
      [dayName]: {
        ...dayConfig,
        timeBlocks: [updatedBlock],
      },
    } as Record<DayName, DailyConfig>

    setEditedConfigs(newConfigs)
  }

  const applyTemplate = (templateName: 'standard' | 'extended' | 'parttime') => {
    const standardTemplate = getDefaultWeeklySchedule(15, 5) as Record<DayName, DailyConfig>
    const extendedTemplate: Record<DayName, DailyConfig> = {
      sun: { enabled: false, timeBlocks: [] },
      mon: { enabled: true, timeBlocks: [{ startTime: '08:00', endTime: '20:00', slotDuration: 15, bufferTime: 5 }] },
      tue: { enabled: true, timeBlocks: [{ startTime: '08:00', endTime: '20:00', slotDuration: 15, bufferTime: 5 }] },
      wed: { enabled: true, timeBlocks: [{ startTime: '08:00', endTime: '20:00', slotDuration: 15, bufferTime: 5 }] },
      thu: { enabled: true, timeBlocks: [{ startTime: '08:00', endTime: '20:00', slotDuration: 15, bufferTime: 5 }] },
      fri: { enabled: true, timeBlocks: [{ startTime: '08:00', endTime: '20:00', slotDuration: 15, bufferTime: 5 }] },
      sat: { enabled: true, timeBlocks: [{ startTime: '08:00', endTime: '20:00', slotDuration: 15, bufferTime: 5 }] },
    }
    const parttimeTemplate: Record<DayName, DailyConfig> = {
      sun: { enabled: false, timeBlocks: [] },
      mon: { enabled: false, timeBlocks: [] },
      tue: { enabled: true, timeBlocks: [{ startTime: '09:00', endTime: '13:00', slotDuration: 15, bufferTime: 5 }] },
      wed: { enabled: false, timeBlocks: [] },
      thu: { enabled: true, timeBlocks: [{ startTime: '09:00', endTime: '13:00', slotDuration: 15, bufferTime: 5 }] },
      fri: { enabled: false, timeBlocks: [] },
      sat: { enabled: true, timeBlocks: [{ startTime: '09:00', endTime: '13:00', slotDuration: 15, bufferTime: 5 }] },
    }

    const templates = {
      standard: standardTemplate,
      extended: extendedTemplate,
      parttime: parttimeTemplate,
    }

    setEditedConfigs(templates[templateName])
  }

  const saveChanges = async () => {
    if (!activeEvent || !editedConfigs) return

    await updateEvent.mutateAsync({
      eventId: activeEvent.id,
      data: {
        dailyConfigs: editedConfigs,
      },
    })

    setEditedConfigs(null)
  }

  const discardChanges = () => {
    setEditedConfigs(null)
  }

  const hasChanges = editedConfigs !== null

  // Loading state
  if (eventsLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-6">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="mt-4 text-muted-foreground">Loading your schedule...</p>
      </div>
    )
  }

  // Error state
  if (eventsError) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-red-800">
              <AlertCircle className="h-5 w-5" />
              <p className="font-semibold">Failed to load schedule</p>
            </div>
            <p className="mt-2 text-sm text-red-700">
              {eventsError instanceof Error ? eventsError.message : 'Unknown error occurred'}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // No active event state
  if (!activeEvent) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-3xl font-headline font-bold">Schedule & Visibility</h1>
            <p className="text-muted-foreground font-body">
              Set your availability and manage directory visibility
            </p>
          </div>
        </div>
        <Card>
          <CardContent className="p-12 text-center">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No Active Schedule</h3>
            <p className="text-muted-foreground mb-4">
              You haven't set up your availability schedule yet.
            </p>
            <Button onClick={() => setShowCreateScheduleDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Schedule
            </Button>
          </CardContent>
        </Card>

        {/* Create Schedule Dialog */}
        <Dialog open={showCreateScheduleDialog} onOpenChange={setShowCreateScheduleDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Availability Schedule</DialogTitle>
              <DialogDescription>
                This will create a default schedule with:
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Monday-Friday, 9:00 AM - 5:00 PM</li>
                  <li>15-minute appointment slots</li>
                  <li>5-minute buffer between appointments</li>
                  <li>Video consultations only</li>
                  <li>7-day advance booking window</li>
                </ul>
                You can customize it after creation.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowCreateScheduleDialog(false)}
                disabled={createEvent.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateSchedule}
                disabled={createEvent.isPending}
              >
                {createEvent.isPending ? 'Creating...' : 'Create Schedule'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  const dayNames: DayName[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-headline font-bold">Schedule & Visibility</h1>
        <p className="text-muted-foreground font-body">
          Set your availability and manage directory visibility
        </p>
      </div>

      {/* Directory Visibility Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Directory Visibility
              </CardTitle>
              <CardDescription>
                Control whether you appear in the patient app's provider directory
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {activeEvent?.status === 'active' ? (
                <Badge variant="default" className="bg-green-600">
                  <Check className="mr-1 h-3 w-3" />
                  Publicly Visible
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <X className="mr-1 h-3 w-3" />
                  Hidden
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Requirements Checklist */}
          <div className="space-y-3">
            <p className="text-sm font-medium">Requirements for public visibility:</p>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {accountComplete ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <X className="h-4 w-4 text-red-600" />
                )}
                <span className={accountComplete ? "text-sm" : "text-sm text-muted-foreground"}>
                  Complete account setup
                </span>
                {!accountComplete && (
                  <Link to="/settings/account" className="text-xs text-primary hover:underline ml-auto">
                    Complete →
                  </Link>
                )}
              </div>
              <div className="flex items-center gap-2">
                {professionalComplete ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <X className="h-4 w-4 text-red-600" />
                )}
                <span className={professionalComplete ? "text-sm" : "text-sm text-muted-foreground"}>
                  Complete professional profile
                </span>
                {!professionalComplete && (
                  <Link to="/settings/professional" className="text-xs text-primary hover:underline ml-auto">
                    Complete →
                  </Link>
                )}
              </div>
              <div className="flex items-center gap-2">
                {merchantComplete ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <X className="h-4 w-4 text-red-600" />
                )}
                <span className={merchantComplete ? "text-sm" : "text-sm text-muted-foreground"}>
                  Complete merchant account setup
                </span>
                {!merchantComplete && (
                  <Link to="/settings/billing" className="text-xs text-primary hover:underline ml-auto">
                    Complete →
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* Visibility Toggle */}
          <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
            <div className="space-y-1">
              <p className="text-sm font-medium">Public Visibility</p>
              <p className="text-xs text-muted-foreground">
                {allRequirementsMet
                  ? 'Toggle to appear in the provider directory'
                  : 'Complete all requirements above to enable'}
              </p>
            </div>
            <Switch
              checked={activeEvent?.status === 'active'}
              onCheckedChange={togglePublicVisibility}
              disabled={!allRequirementsMet || updateEvent.isPending || requirementsLoading}
            />
          </div>

          {/* Info Alert */}
          {!allRequirementsMet && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Complete Setup Required</AlertTitle>
              <AlertDescription>
                You must complete all setup requirements before you can appear in the public directory.
                Patients will not be able to find or book appointments with you until visibility is enabled.
              </AlertDescription>
            </Alert>
          )}

          {allRequirementsMet && activeEvent?.status === 'paused' && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Currently Hidden</AlertTitle>
              <AlertDescription>
                Your profile is hidden from the provider directory. Enable visibility to allow patients
                to find you and book appointments.
              </AlertDescription>
            </Alert>
          )}

          {activeEvent?.status === 'active' && (
            <Alert className="border-green-200 bg-green-50">
              <Check className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-900">Publicly Visible</AlertTitle>
              <AlertDescription className="text-green-800">
                Your profile is visible in the provider directory. Patients can find you and book
                appointments based on your availability schedule below.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Weekly Availability Editor */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Weekly Availability
              </CardTitle>
              <CardDescription>
                Set your working hours for each day of the week
              </CardDescription>
            </div>
            {hasChanges && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={discardChanges}>
                  Discard
                </Button>
                <Button size="sm" onClick={saveChanges} disabled={updateEvent.isPending}>
                  {updateEvent.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <TooltipProvider>
            <div className="divide-y">
              {dayNames.map((dayName) => {
                const dayConfig = currentConfigs?.[dayName]
                if (!dayConfig) return null

                return (
                  <div key={dayName} className="py-3 grid grid-cols-[auto_1fr_auto_auto] gap-3 items-center">
                    {/* Toggle & Day Name */}
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={dayConfig.enabled}
                        onCheckedChange={() => toggleDayEnabled(dayName)}
                      />
                      <Label className="font-medium w-24">
                        {getDayDisplayName(dayName)}
                      </Label>
                    </div>

                    {/* Time Range or Closed */}
                    {dayConfig.enabled && dayConfig.timeBlocks[0] ? (
                      <>
                        <div className="flex items-center gap-2">
                          <Input
                            type="time"
                            value={dayConfig.timeBlocks[0].startTime}
                            onChange={(e) => updateDayTime(dayName, 'startTime', e.target.value)}
                            className="w-32"
                          />
                          <span className="text-muted-foreground">-</span>
                          <Input
                            type="time"
                            value={dayConfig.timeBlocks[0].endTime}
                            onChange={(e) => updateDayTime(dayName, 'endTime', e.target.value)}
                            className="w-32"
                          />
                        </div>

                        {/* Slot Duration with Tooltip */}
                        <div className="flex items-center gap-1.5">
                          <Label className="text-sm text-muted-foreground whitespace-nowrap">Slot:</Label>
                          <Select
                            value={(dayConfig.timeBlocks[0].slotDuration ?? 15).toString()}
                            onValueChange={(value) => updateDayTime(dayName, 'slotDuration', parseInt(value))}
                          >
                            <SelectTrigger className="w-24">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="15">15 min</SelectItem>
                              <SelectItem value="30">30 min</SelectItem>
                              <SelectItem value="45">45 min</SelectItem>
                              <SelectItem value="60">60 min</SelectItem>
                            </SelectContent>
                          </Select>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Length of each appointment booking slot</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>

                        {/* Buffer Time with Tooltip */}
                        <div className="flex items-center gap-1.5">
                          <Label className="text-sm text-muted-foreground whitespace-nowrap">Buffer:</Label>
                          <Select
                            value={(dayConfig.timeBlocks[0].bufferTime ?? 5).toString()}
                            onValueChange={(value) => updateDayTime(dayName, 'bufferTime', parseInt(value))}
                          >
                            <SelectTrigger className="w-24">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0">0 min</SelectItem>
                              <SelectItem value="5">5 min</SelectItem>
                              <SelectItem value="10">10 min</SelectItem>
                              <SelectItem value="15">15 min</SelectItem>
                            </SelectContent>
                          </Select>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Break time between consecutive appointments</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </>
                    ) : (
                      <div className="col-span-3 text-sm text-muted-foreground">Closed</div>
                    )}
                  </div>
                )
              })}
            </div>
          </TooltipProvider>
        </CardContent>
      </Card>

      {/* Quick Templates */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Templates</CardTitle>
          <CardDescription>Apply a predefined schedule pattern</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-dashed cursor-pointer hover:border-primary transition-colors">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <h4 className="font-semibold">Standard Weekdays</h4>
                </div>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>Mon-Fri: 9:00 AM - 5:00 PM</p>
                  <p>15-min slots, 5-min buffer</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => applyTemplate('standard')}
                >
                  Apply Template
                </Button>
              </CardContent>
            </Card>

            <Card className="border-dashed cursor-pointer hover:border-primary transition-colors">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <h4 className="font-semibold">Extended Hours</h4>
                </div>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>Mon-Sat: 8:00 AM - 8:00 PM</p>
                  <p>15-min slots, 5-min buffer</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => applyTemplate('extended')}
                >
                  Apply Template
                </Button>
              </CardContent>
            </Card>

            <Card className="border-dashed cursor-pointer hover:border-primary transition-colors">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <h4 className="font-semibold">Part-time</h4>
                </div>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>Tue/Thu/Sat: 9:00 AM - 1:00 PM</p>
                  <p>15-min slots, 5-min buffer</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => applyTemplate('parttime')}
                >
                  Apply Template
                </Button>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Visibility Confirmation Dialog */}
      <Dialog open={showVisibilityDialog} onOpenChange={setShowVisibilityDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingVisibilityAction === 'enable'
                ? 'Enable Public Visibility?'
                : 'Disable Public Visibility?'}
            </DialogTitle>
            <DialogDescription>
              {pendingVisibilityAction === 'enable' ? (
                <>
                  <p className="mb-2">
                    Your profile will appear in the provider directory.
                  </p>
                  <p className="mb-2">
                    Patients will be able to:
                  </p>
                  <ul className="list-disc list-inside space-y-1 mb-2">
                    <li>Find you in search results</li>
                    <li>View your profile and credentials</li>
                    <li>See your availability</li>
                    <li>Book appointments during your available hours</li>
                  </ul>
                  <p className="text-sm text-muted-foreground">
                    You can disable visibility at any time.
                  </p>
                </>
              ) : (
                <>
                  <p className="mb-2">
                    Your profile will be hidden from the provider directory.
                  </p>
                  <p className="mb-2">
                    This means:
                  </p>
                  <ul className="list-disc list-inside space-y-1 mb-2">
                    <li>Patients will not be able to find you in search</li>
                    <li>New appointments cannot be booked</li>
                    <li>Your profile will not appear publicly</li>
                  </ul>
                  <p className="text-sm font-medium text-amber-600">
                    ⚠️ Existing bookings will not be affected.
                  </p>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowVisibilityDialog(false)
                setPendingVisibilityAction(null)
              }}
              disabled={updateEvent.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmVisibilityChange}
              disabled={updateEvent.isPending}
              className={pendingVisibilityAction === 'enable' ? 'bg-green-600 hover:bg-green-700' : ''}
            >
              {updateEvent.isPending
                ? 'Updating...'
                : pendingVisibilityAction === 'enable'
                  ? 'Enable Visibility'
                  : 'Disable Visibility'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
