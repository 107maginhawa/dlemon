import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { Button } from '@monobase/ui/components/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@monobase/ui/components/card'
import { Progress } from '@monobase/ui/components/progress'
import { ChevronLeft, ChevronRight, UserCheck, MapPin, Stethoscope, Pill } from 'lucide-react'
import { Logo } from '@/components/logo'
import { requireAuth, requireEmailVerified, requireNoPerson, requireNoPatientProfile, composeGuards } from '@/utils/guards'
import { useDetectTimezone } from '@monobase/ui/hooks/use-detect-timezone'
import { useDetectLanguage } from '@monobase/ui/hooks/use-detect-language'
import { useDetectCountry } from '@monobase/ui/hooks/use-detect-country'
import { toast } from 'sonner'
import { formatDate } from '@monobase/ui/lib/format-date'

// Import hooks
import { useCreateMyPerson } from '@monobase/sdk/react/hooks/use-person'
import { useCreatePatient } from '@monobase/sdk/react/hooks/use-patient'

// Import types
import type { PersonalInfo, OptionalAddress } from '@monobase/ui/person/schemas'
import type { PrimaryProviderData, PrimaryPharmacyData } from '@monobase/ui/patient/schemas'
import { ApiError } from '@monobase/sdk/api'

// Import form components
import { PersonalInfoForm } from '@monobase/ui/person/components/personal-info-form'
import { AddressForm } from '@monobase/ui/person/components/address-form'
import { PrimaryCareProviderForm } from '@monobase/ui/patient/components/primary-care-provider-form'
import { PrimaryPharmacyForm } from '@monobase/ui/patient/components/primary-pharmacy-form'

export const Route = createFileRoute('/onboarding')({
  beforeLoad: composeGuards(requireAuth, requireEmailVerified, requireNoPerson, requireNoPatientProfile),
  component: OnboardingPage,
})

function OnboardingPage() {
  const navigate = useNavigate()
  const { user } = Route.useRouteContext()
  const [currentStep, setCurrentStep] = useState(1)
  const detectedLanguage = useDetectLanguage()
  const detectedTimezone = useDetectTimezone()
  const detectedCountry = useDetectCountry()

  // Use both person and patient creation hooks
  const createPersonMutation = useCreateMyPerson({
    toastError: false,
    onError: (error) => {
      // Suppress toast for "already exists" error - we handle it gracefully
      if (error instanceof ApiError && error.message?.includes('already has a person profile')) {
        return
      }
      // For other errors, show the toast
      if (error instanceof ApiError) {
        toast.error(error.message || 'Failed to create profile')
      } else {
        toast.error('Failed to create profile. Please try again.')
      }
    }
  })
  const createPatientMutation = useCreatePatient()

  // Store form data across steps
  const [formData, setFormData] = useState<{
    personal?: PersonalInfo
    address?: OptionalAddress
    provider?: PrimaryProviderData
    pharmacy?: PrimaryPharmacyData
  }>({})

  const totalSteps = 2

  const handlePersonalInfoSubmit = (data: PersonalInfo) => {
    setFormData(prev => ({ ...prev, personal: data }))
    setCurrentStep(2)
  }

  const handleAddressSubmit = (data: OptionalAddress) => {
    setFormData(prev => ({ ...prev, address: data }))
    setCurrentStep(3)
  }

  const handleSkipAddress = () => {
    setCurrentStep(3)
  }

  const handleProviderSubmit = (data: PrimaryProviderData) => {
    setFormData(prev => ({ ...prev, provider: data }))
    setCurrentStep(4)
  }

  const handlePharmacySubmit = async (data: PrimaryPharmacyData) => {
    setFormData(prev => ({ ...prev, pharmacy: data }))

    // Submit the complete profile
    if (!formData.personal || !user.email) {
      return
    }

    try {
      // Create person profile
      await createPersonMutation.mutateAsync({
        firstName: formData.personal.firstName,
        lastName: formData.personal.lastName,
        middleName: formData.personal.middleName,
        dateOfBirth: formData.personal.dateOfBirth,
        gender: formData.personal.gender,
        avatar: formData.personal.avatar,
        languagesSpoken: [detectedLanguage],
        timezone: detectedTimezone,
      }).catch(error => {
        // If person already exists, that's okay - continue to create patient
        if (error instanceof ApiError && error.message?.includes('already has a person profile')) {
          console.log('Person profile already exists, proceeding with patient creation')
        } else {
          // If it's a different error, rethrow it
          throw error
        }
      })

      // Then create patient profile with provider and pharmacy info
      await createPatientMutation.mutateAsync({
      })

      // Navigate to dashboard on success
      navigate({ to: '/dashboard' })
    } catch (error) {
      console.error('Failed to create profile', error)
    }
  }

  const goBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const getStepIcon = (step: number) => {
    switch (step) {
      case 1: return <UserCheck className="w-5 h-5" />
      case 2: return <MapPin className="w-5 h-5" />
      default: return null
    }
  }

  const getStepTitle = (step: number) => {
    switch (step) {
      case 1: return 'Personal Information'
      case 2: return 'Address (Optional)'
      default: return ''
    }
  }

  const getStepDescription = (step: number) => {
    switch (step) {
      case 1: return 'Tell us about yourself'
      case 2: return 'Where can we reach you? You can skip this step for now.'
      default: return ''
    }
  }

  const isLoading = createPersonMutation.isPending || createPatientMutation.isPending

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <Logo variant="horizontal" size="xl" />
          </div>
          <h1 className="text-3xl font-headline font-bold text-foreground">Welcome to Monobase</h1>
          <p className="text-muted-foreground mt-2 font-body">Let's set up your patient profile</p>
        </div>

        {/* Progress Bar */}
        <Progress value={(currentStep / totalSteps) * 100} className="h-2" />

        {/* Main Form Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-3">
              {getStepIcon(currentStep)}
              <div>
                <CardTitle>
                  Step {currentStep} of {totalSteps}: {getStepTitle(currentStep)}
                </CardTitle>
                <CardDescription>
                  {getStepDescription(currentStep)}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Step 1: Personal Information */}
            {currentStep === 1 && (
              <PersonalInfoForm
                onSubmit={handlePersonalInfoSubmit}
                defaultValues={formData.personal || {
                  firstName: user?.name?.split(' ')[0] || '',
                  lastName: user?.name?.split(' ').slice(1).join(' ') || '',
                }}
                mode="create"
                showButtons={false}
                formId="step-1-form"
              />
            )}

            {/* Step 2: Address (Optional) */}
            {currentStep === 2 && (
              <AddressForm
                onSubmit={handleAddressSubmit}
                onSkip={handleSkipAddress}
                defaultValues={formData.address || { country: detectedCountry }}
                mode="create"
                showButtons={false}
              />
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between mt-6">
              {/* Back Button */}
              {currentStep > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={goBack}
                  disabled={isLoading}
                >
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              )}

              {/* Step 1: Next Button */}
              {currentStep === 1 && (
                <Button
                  type="submit"
                  form="step-1-form"
                  className="ml-auto"
                  disabled={isLoading}
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              )}

              {/* Step 2: Skip and Next Buttons */}
              {currentStep === 2 && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    className="ml-auto mr-2"
                    onClick={handleSkipAddress}
                    disabled={isLoading}
                  >
                    Skip for now
                  </Button>
                  <Button
                    type="submit"
                    disabled={isLoading}
                    onClick={handlePharmacySubmit}
                  >
                    Next
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Progress Indicators */}
        <div className="flex justify-center space-x-2">
          {Array.from({ length: totalSteps }).map((_, index) => {
            const stepNumber = index + 1
            const isCompleted = stepNumber < currentStep
            const isCurrent = stepNumber === currentStep

            return (
              <div
                key={stepNumber}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                  isCompleted ? 'bg-primary text-primary-foreground' :
                  isCurrent ? 'bg-primary text-primary-foreground' :
                  'bg-muted text-muted-foreground'
                }`}
              >
                {stepNumber}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
