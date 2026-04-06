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
import { apiPost } from '@monobase/sdk/api'
import { toast } from 'sonner'
import { formatDate } from '@monobase/ui/lib/format-date'

// Route params schema with validation
const paramsSchema = z.object({
  slotId: z.string().min(1).max(100),
})

// Consent data schema for validation
const consentSchema = z.object({
  telehealthConsent: z.boolean(),
  limitationsConsent: z.boolean(),
  privacyConsent: z.boolean(),
  slotId: z.string(),
  timestamp: z.string(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
})

export const Route = createFileRoute('/booking/new/$slotId/consent-secure')({
  params: paramsSchema,
  component: () => (
    <ErrorBoundary>
      <SecureConsentPage />
    </ErrorBoundary>
  ),
})

/**
 * Get client IP address (if available)
 * In production, this should be obtained from server headers
 */
async function getClientIpAddress(): Promise<string | undefined> {
  try {
    // In production, this would be a call to your API that returns the client IP
    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/auth/client-info`)
    const data = await response.json()
    return data.ipAddress
  } catch {
    // Fallback - IP will be captured on server side
    return undefined
  }
}

/**
 * Secure consent page with HIPAA-compliant audit trail
 */
function SecureConsentPage() {
  const navigate = useNavigate()
  const { slotId } = Route.useParams()

  // Consent states
  const [telehealthConsent, setTelehealthConsent] = useState(false)
  const [limitationsConsent, setLimitationsConsent] = useState(false)
  const [privacyConsent, setPrivacyConsent] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Load slot data using real API hook
  const { data: slot, isLoading: slotLoading, error: slotError } = useTimeSlot(slotId)

  // Load provider data using slot.owner (provider ID from slot)
  const { data: provider, isLoading: providerLoading } = useProviderWithSlots(
    slot?.owner || '',
    { enabled: !!slot?.owner }
  )

  const allConsentsGiven = telehealthConsent && limitationsConsent && privacyConsent

  /**
   * Handle consent submission with server-side audit trail
   * HIPAA Compliant: Records who, what, when, where
   */
  const handleContinue = async () => {
    if (!allConsentsGiven || isSubmitting) return

    setIsSubmitting(true)

    try {
      // Validate consent data
      const consentData = consentSchema.parse({
        telehealthConsent,
        limitationsConsent,
        privacyConsent,
        slotId,
        timestamp: formatDate(new Date(), { format: 'iso' }),
        ipAddress: await getClientIpAddress(),
        userAgent: navigator.userAgent,
      })

      // Submit consent to server for secure storage and audit trail
      const response = await apiPost('/booking/consent', {
        slotId: consentData.slotId,
        consents: {
          telehealth: consentData.telehealthConsent,
          limitations: consentData.limitationsConsent,
          privacy: consentData.privacyConsent,
        },
        metadata: {
          timestamp: consentData.timestamp,
          ipAddress: consentData.ipAddress,
          userAgent: consentData.userAgent,
          provider: providerId,
        }
      })

      if (!response.consentId) {
        throw new Error('Failed to record consent')
      }

      // Store only the consent reference ID in session storage (not the actual consent data)
      // This ID will be validated server-side when creating the appointment
      sessionStorage.setItem(`booking_consent_ref_${slotId}`, response.consentId)

      // Log audit event (without PHI)
      console.log(`Consent recorded for slot ${slotId}`)

      // Navigate to forms step
      navigate({
        to: '/booking/new/$slotId/forms',
        params: { slotId }
      })
    } catch (error) {
      // Log error without exposing sensitive details
      console.error('Failed to record consent', error)

      // Show user-friendly error message
      toast.error('Failed to save your consent. Please try again.')
      setIsSubmitting(false)
    }
  }

  const handleBack = () => {
    navigate({
      to: '/booking/new/$slotId',
      params: { slotId }
    })
  }

  // Clear session data on component unmount
  useEffect(() => {
    return () => {
      // Clean up any temporary session data
      const consentRef = sessionStorage.getItem(`booking_consent_ref_${slotId}`)
      if (consentRef && !allConsentsGiven) {
        // If user navigates away without completing, mark consent as abandoned
        apiPost('/booking/consent/abandon', {
          consentId: consentRef,
          reason: 'navigation_away'
        }).catch(() => {
          // Silent fail - this is just for analytics
        })
      }
    }
  }, [slotId, allConsentsGiven])

  // Show loading state
  if (slotLoading || providerLoading) {
    return (
      <BookingFlowLayout
        currentStep={1}
        totalSteps={3}
        stepTitle="Consent & Agreements"
        onBack={handleBack}
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
      >
        <div className="p-6">
          <div className="text-center py-12">
            <p className="text-red-600 mb-4">
              Unable to load appointment details. Please try again.
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
      totalSteps={3}
      stepTitle="Consent & Agreements"
      onBack={handleBack}
    >
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Consent & Terms Agreement
          </h1>
          <p className="text-gray-600">
            Please review and agree to the following terms before proceeding with your telehealth appointment
            {provider?.name && ` with ${provider.name}`}.
          </p>
        </div>

        <div className="space-y-6">
          {/* Telehealth Consent */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Telehealth Services Consent</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="telehealth-consent"
                  checked={telehealthConsent}
                  onCheckedChange={(checked) => setTelehealthConsent(!!checked)}
                  disabled={isSubmitting}
                  aria-label="Consent to telehealth services"
                />
                <div className="text-sm">
                  <label htmlFor="telehealth-consent" className="font-medium cursor-pointer">
                    I consent to receiving telehealth services
                  </label>
                  <p className="text-gray-600 mt-1">
                    I understand that telehealth involves the use of electronic communications to enable healthcare providers to conduct remote diagnosis, consultation, treatment, and care management. I understand that my healthcare information may be shared with other healthcare providers for treatment, payment, or healthcare operations purposes.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Limitations & Risks */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Limitations & Risks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="limitations-consent"
                  checked={limitationsConsent}
                  onCheckedChange={(checked) => setLimitationsConsent(!!checked)}
                  disabled={isSubmitting}
                  aria-label="Acknowledge telehealth limitations"
                />
                <div className="text-sm">
                  <label htmlFor="limitations-consent" className="font-medium cursor-pointer">
                    I understand the limitations of telehealth
                  </label>
                  <p className="text-gray-600 mt-1">
                    I acknowledge that telehealth may not be appropriate for all medical conditions and that the provider may recommend an in-person visit if needed. I understand that technical difficulties may occur and that backup plans are in place.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Privacy & Security */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Privacy & Security</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="privacy-consent"
                  checked={privacyConsent}
                  onCheckedChange={(checked) => setPrivacyConsent(!!checked)}
                  disabled={isSubmitting}
                  aria-label="Agree to privacy policy"
                />
                <div className="text-sm">
                  <label htmlFor="privacy-consent" className="font-medium cursor-pointer">
                    I agree to the privacy policy and security measures
                  </label>
                  <p className="text-gray-600 mt-1">
                    I understand that Monobase uses industry-standard encryption and security measures to protect my personal health information. I have read and understood the privacy policy and agree to the collection, use, and disclosure of my information as described.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Consent Withdrawal Notice */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>Right to Withdraw Consent:</strong> You have the right to withdraw this consent at any time by contacting our support team. Withdrawal of consent will not affect any treatment already provided.
            </p>
          </div>
        </div>

        <div className="flex justify-end mt-8 pt-6 border-t border-gray-200">
          <Button
            onClick={handleContinue}
            disabled={!allConsentsGiven || isSubmitting}
            className="min-w-32"
            aria-label="Continue to forms"
          >
            {isSubmitting ? 'Saving Consent...' : 'Continue to Forms'}
          </Button>
        </div>
      </div>
    </BookingFlowLayout>
  )
}