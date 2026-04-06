import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import { useState } from 'react'
import { BookingFlowLayout } from '@/components/layouts/booking-flow-layout'
import { Button } from '@monobase/ui/components/button'
import { Checkbox } from '@monobase/ui/components/checkbox'
import { Card, CardContent, CardHeader, CardTitle } from '@monobase/ui/components/card'
import { useTimeSlot, useProviderWithSlots } from '@monobase/sdk/react/hooks/use-booking'
import { Skeleton } from '@monobase/ui/components/skeleton'
import { ErrorBoundary } from '@/components/error-boundary'
import { formatDate } from '@monobase/ui/lib/format-date'

// Route params schema
const paramsSchema = z.object({
  slotId: z.string(),
})

export const Route = createFileRoute('/booking/new/$slotId/consent')({
  params: paramsSchema,
  component: () => (
    <ErrorBoundary>
      <ConsentPage />
    </ErrorBoundary>
  ),
})

function ConsentPage() {
  const navigate = useNavigate()
  const { slotId } = Route.useParams()

  // Consent states
  const [telehealthConsent, setTelehealthConsent] = useState(false)
  const [limitationsConsent, setLimitationsConsent] = useState(false)
  const [privacyConsent, setPrivacyConsent] = useState(false)

  // Load slot data using real API hook
  const { data: slot, isLoading: slotLoading, error: slotError } = useTimeSlot(slotId)

  // Load provider data using slot.context (provider ID from booking event)
  const { data: provider, isLoading: providerLoading } = useProviderWithSlots(
    slot?.context || '',
    { enabled: !!slot?.context }
  )

  const allConsentsGiven = telehealthConsent && limitationsConsent && privacyConsent

  const handleContinue = () => {
    // Check if booking has custom forms
    const hasBookingForms = !!(slot?.bookingFormConfig && slot.bookingFormConfig.fields?.length > 0)
    if (allConsentsGiven) {
      // NOTE: Using sessionStorage for MVP - sufficient for current needs
      // Future enhancement: Store consent with audit trail in database (see BACKLOGS.md #3)
      sessionStorage.setItem(`booking_consent_${slotId}`, JSON.stringify({
        telehealthConsent,
        limitationsConsent,
        privacyConsent,
        timestamp: formatDate(new Date(), { format: 'iso' })
      }))

      // Navigate to forms step if custom forms exist, otherwise skip to confirmation
      if (hasBookingForms) {
        navigate({
          to: '/booking/new/$slotId/forms',
          params: { slotId }
        })
      } else {
        navigate({
          to: '/booking/new/$slotId/confirm',
          params: { slotId }
        })
      }
    }
  }

  const handleBack = () => {
    navigate({
      to: '/booking/new/$slotId',
      params: { slotId }
    })
  }

  const handleExit = () => {
    navigate({ to: '/providers' })
  }

  // Check if booking has custom forms (after slot is loaded)
  const hasBookingForms = !!(slot?.bookingFormConfig && slot.bookingFormConfig.fields?.length > 0)
  const totalSteps = hasBookingForms ? 3 : 2

  // Show loading state
  if (slotLoading || providerLoading) {
    return (
      <BookingFlowLayout
        currentStep={1}
        totalSteps={3}
        stepTitle="Consent & Agreements"
        onBack={handleBack}
        onExit={handleExit}
      >
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-full" />
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </BookingFlowLayout>
    )
  }

  // Show error state
  if (slotError || !slot) {
    return (
      <BookingFlowLayout
        currentStep={1}
        totalSteps={3}
        stepTitle="Consent & Agreements"
        onBack={handleBack}
        onExit={handleExit}
      >
        <div className="p-6">
          <div className="text-center py-12">
            <p className="text-red-600 mb-4">
              {slotError ? 'Failed to load appointment slot details' : 'Appointment slot not found'}
            </p>
            <Button onClick={handleBack} variant="outline">
              Go Back
            </Button>
          </div>
        </div>
      </BookingFlowLayout>
    )
  }

  return (
    <BookingFlowLayout
      currentStep={1}
      totalSteps={totalSteps}
      stepTitle="Consent & Agreements"
      onBack={handleBack}
      onExit={handleExit}
    >
      <div className="p-4">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-900 mb-1">
            Consent & Terms Agreement
          </h1>
          <p className="text-sm text-gray-600 leading-snug">
            Please review and agree to the following terms before proceeding with your telehealth appointment
            {provider?.name && ` with ${provider.name}`}.
          </p>
        </div>

        <div className="space-y-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Telehealth Services Consent</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="telehealth-consent"
                  checked={telehealthConsent}
                  onCheckedChange={(checked) => setTelehealthConsent(!!checked)}
                  className="mt-0.5"
                />
                <div className="text-sm flex-1">
                  <label htmlFor="telehealth-consent" className="font-medium cursor-pointer leading-tight block mb-1">
                    I consent to receiving telehealth services
                  </label>
                  <p className="text-gray-600 text-xs leading-relaxed">
                    I understand that telehealth involves the use of electronic communications to enable healthcare providers to conduct remote diagnosis, consultation, treatment, and care management.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Limitations & Risks</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="limitations-consent"
                  checked={limitationsConsent}
                  onCheckedChange={(checked) => setLimitationsConsent(!!checked)}
                  className="mt-0.5"
                />
                <div className="text-sm flex-1">
                  <label htmlFor="limitations-consent" className="font-medium cursor-pointer leading-tight block mb-1">
                    I understand the limitations of telehealth
                  </label>
                  <p className="text-gray-600 text-xs leading-relaxed">
                    I acknowledge that telehealth may not be appropriate for all medical conditions and that the provider may recommend an in-person visit if needed.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Privacy & Security</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="privacy-consent"
                  checked={privacyConsent}
                  onCheckedChange={(checked) => setPrivacyConsent(!!checked)}
                  className="mt-0.5"
                />
                <div className="text-sm flex-1">
                  <label htmlFor="privacy-consent" className="font-medium cursor-pointer leading-tight block mb-1">
                    I agree to the privacy policy and security measures
                  </label>
                  <p className="text-gray-600 text-xs leading-relaxed">
                    I understand how my personal health information will be used and protected during telehealth services.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end mt-6 pt-4 border-t border-gray-200">
          <Button
            onClick={handleContinue}
            disabled={!allConsentsGiven}
            className="min-w-32"
          >
            {hasBookingForms ? 'Continue to Forms' : 'Continue to Confirmation'}
          </Button>
        </div>
      </div>
    </BookingFlowLayout>
  )
}