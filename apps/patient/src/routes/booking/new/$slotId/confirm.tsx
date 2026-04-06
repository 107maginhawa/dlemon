import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { z } from 'zod'
import { formatDate } from '@monobase/ui/lib/format-date'
import { CheckCircle, Loader2, AlertCircle, Calendar, Clock, User } from 'lucide-react'
import { Button } from '@monobase/ui/components/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@monobase/ui/components/card'
import { Alert, AlertDescription } from '@monobase/ui/components/alert'
import { Separator } from '@monobase/ui/components/separator'
import { BookingFlowLayout } from '@/components/layouts/booking-flow-layout'
import { useSession } from '@monobase/sdk/react/hooks/use-auth'
import { useMyPatient } from '@monobase/sdk/react/hooks/use-patient'
import { ErrorBoundary } from '@/components/error-boundary'
import { useTimeSlot, useCreateBooking } from '@monobase/sdk/react/hooks/use-booking'
import { Skeleton } from '@monobase/ui/components/skeleton'

// Route params schema
const paramsSchema = z.object({
  slotId: z.string(),
})

export const Route = createFileRoute('/booking/new/$slotId/confirm')({
  params: paramsSchema,
  component: () => (
    <ErrorBoundary>
      <BookingConfirmPage />
    </ErrorBoundary>
  ),
})

function BookingConfirmPage() {
  const { slotId } = Route.useParams()
  const navigate = useNavigate()
  const { data: session } = useSession()
  const { data: patientProfile } = useMyPatient()

  // Use real API hook to fetch slot data
  const { data: slot, isLoading: isLoadingSlot, error: slotError } = useTimeSlot(slotId)

  // Use mutation hook for creating appointment
  const createAppointmentMutation = useCreateBooking()
  const isSubmitting = createAppointmentMutation.isPending

  // Retrieve consent and form data from sessionStorage
  const [consentData, setConsentData] = useState<any>(null)
  const [formResponses, setFormResponses] = useState<Record<string, any>>({})
  const [hasFormResponses, setHasFormResponses] = useState(false)

  useEffect(() => {
    // Get consent data
    const consent = sessionStorage.getItem(`booking_consent_${slotId}`)
    if (consent) {
      setConsentData(JSON.parse(consent))
    } else {
      // No consent, redirect to consent page
      navigate({
        to: '/booking/new/$slotId/consent',
        params: { slotId },
        replace: true
      })
      return
    }

    // Get form responses
    const forms = sessionStorage.getItem(`booking_forms_${slotId}`)
    if (forms) {
      setFormResponses(JSON.parse(forms))
      setHasFormResponses(true)
    }
  }, [slotId, navigate])

  // Determine if booking has forms based on slot config or sessionStorage
  const hasBookingForms = hasFormResponses || !!(slot?.bookingFormConfig && slot.bookingFormConfig.fields?.length > 0)
  const totalSteps = hasBookingForms ? 3 : 2
  const currentStep = hasBookingForms ? 3 : 2

  const handleBack = () => {
    // Go back to forms if they exist, otherwise back to consent
    if (hasBookingForms) {
      navigate({
        to: '/booking/new/$slotId/forms',
        params: { slotId }
      })
    } else {
      navigate({
        to: '/booking/new/$slotId/consent',
        params: { slotId }
      })
    }
  }

  const handleExit = () => {
    navigate({ to: '/providers' })
  }

  const handleSubmit = async () => {
    if (!session?.user?.id || !slot) return

    try {
      // Extract reason from form responses (chief_complaint field)
      const reason = formResponses.chief_complaint || undefined

      // Create appointment using mutation
      const appointment = await createAppointmentMutation.mutateAsync({
        slotId: slot.id,
        options: {
          locationType: slot.locationTypes?.[0] as 'video' | 'phone' | 'in_person' | undefined,
          reason,
          formResponses
        }
      })

      // Clean up sessionStorage
      sessionStorage.removeItem(`booking_consent_${slotId}`)
      sessionStorage.removeItem(`booking_forms_${slotId}`)

      // Always navigate to appointment details page
      // Payment will be initiated from the details page if needed
      navigate({
        to: '/booking/$appointmentId/details',
        params: { appointmentId: appointment.id },
        replace: true
      })
    } catch (error) {
      console.error('Failed to create appointment', error)
      // Error is handled by the mutation hook's toast notification
    }
  }

  const formatTime = (timeStr: string) => {
    try {
      return formatDate(new Date(timeStr), { format: 'time' })
    } catch {
      return timeStr
    }
  }

  const formatDateFull = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    return formatDate(date, { format: 'full' })
  }
  
  // If not signed in, redirect
  if (!session?.user) {
    navigate({
      to: '/auth/sign-in',
      search: { redirectTo: `/booking/new/${slotId}/confirm` },
      replace: true
    })
    return null
  }
  
  // Calculate steps early for loading/error states (default to 3 steps)
  const loadingTotalSteps = slot ? (slot.bookingFormConfig?.fields?.length ? 3 : 2) : 3
  const loadingCurrentStep = loadingTotalSteps

  if (isLoadingSlot) {
    return (
      <BookingFlowLayout
        currentStep={loadingCurrentStep}
        totalSteps={loadingTotalSteps}
        onBack={handleBack}
        onExit={handleExit}
      >
        <div className="p-6">
          <Card>
            <CardContent className="p-8">
              <div className="flex items-center justify-center space-x-2">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="text-muted-foreground">Loading appointment details...</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </BookingFlowLayout>
    )
  }
  
  if (!slot || slotError) {
    return (
      <BookingFlowLayout
        currentStep={loadingCurrentStep}
        totalSteps={loadingTotalSteps}
        onBack={handleBack}
        onExit={handleExit}
      >
        <div className="p-6">
          <Card>
            <CardContent className="p-8">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {slotError || 'Failed to load appointment details'}
                </AlertDescription>
              </Alert>
              <div className="mt-4 text-center">
                <Button onClick={() => navigate({ to: '/providers' })}>
                  Browse Providers
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </BookingFlowLayout>
    )
  }
  
  const bookingDetails = {
    providerName: slot.providerName,
    date: formatDateFull(slot.date),
    time: formatTime(slot.startTime),
    duration: '30 minutes',
    price: slot.billingOverride?.price?.toString() || '0.00'
  }
  
  // Get form field labels for display
  const getFormFieldLabel = (fieldId: string): string => {
    if (!slot.bookingFormConfig) return fieldId
    const field = slot.bookingFormConfig.fields.find(f => f.id === fieldId)
    return field?.label || fieldId
  }
  
  // Get form field display value
  const getFormFieldValue = (fieldId: string, value: any): string => {
    if (!slot.bookingFormConfig) return String(value)
    const field = slot.bookingFormConfig.fields.find(f => f.id === fieldId)
    
    if (field?.type === 'select' && field.options) {
      const option = field.options.find(o => o.value === value)
      return option?.label || value
    }
    
    if (field?.type === 'checkbox') {
      return value ? 'Yes' : 'No'
    }
    
    return String(value)
  }
  
  return (
    <BookingFlowLayout
      currentStep={currentStep}
      totalSteps={totalSteps}
      onBack={handleBack}
      onExit={handleExit}
      bookingDetails={bookingDetails}
    >
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              Confirm Your Booking
            </CardTitle>
            <CardDescription>
              Please review your booking details before confirming
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Appointment Details */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <h3 className="font-medium text-sm mb-2">Appointment Details</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Provider:</span>
                  <span className="font-medium">{slot.providerName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Date:</span>
                  <span className="font-medium">{formatDateFull(slot.date)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Time:</span>
                  <span className="font-medium">{formatTime(slot.startTime)} - {formatTime(slot.endTime)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground ml-6">Duration:</span>
                  <span className="font-medium">30 minutes</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground ml-6">Type:</span>
                  <span className="font-medium">{slot.locationTypes?.[0] === 'video' ? 'Video Consultation' : 'Phone Consultation'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground ml-6">Price:</span>
                  <span className="font-medium">${slot.billingOverride?.price || '0.00'} CAD</span>
                </div>
              </div>
            </div>
            
            {/* Patient Information */}
            {patientProfile && (
              <>
                <Separator />
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <h3 className="font-medium text-sm mb-2">Your Information</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Name:</span>
                      <p className="font-medium">
                        {patientProfile.person?.firstName} {patientProfile.person?.lastName}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Email:</span>
                      <p className="font-medium">{session.user.email}</p>
                    </div>
                  </div>
                </div>
              </>
            )}
            
            {/* Form Responses */}
            {Object.keys(formResponses).length > 0 && (
              <>
                <Separator />
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <h3 className="font-medium text-sm mb-2">Booking Information</h3>
                  <div className="space-y-2 text-sm">
                    {Object.entries(formResponses).map(([fieldId, value]) => (
                      <div key={fieldId}>
                        <span className="text-muted-foreground">{getFormFieldLabel(fieldId)}:</span>
                        <p className="font-medium mt-1">{getFormFieldValue(fieldId, value)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
            
            {/* Consent Confirmation */}
            {consentData && (
              <>
                <Separator />
                <div className="bg-green-50 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-green-900">Consent Provided</p>
                      <p className="text-xs text-green-700 mt-1">
                        You have consented to telehealth consultation terms and conditions
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}
            
            {/* Important Notice */}
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Please note:</strong> Your appointment will be pending until confirmed by the provider. 
                You will receive a notification once confirmed.
              </AlertDescription>
            </Alert>
            
            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                disabled={isSubmitting}
              >
                Back
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating Appointment...
                  </>
                ) : (
                  'Confirm Booking'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </BookingFlowLayout>
  )
}
