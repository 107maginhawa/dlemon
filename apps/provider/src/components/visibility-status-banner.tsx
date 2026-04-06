import { Alert, AlertDescription, AlertTitle } from "@monobase/ui/components/alert"
import { Button } from "@monobase/ui/components/button"
import { Link } from '@tanstack/react-router'
import { AlertCircle, Eye, Check, X, ArrowRight } from 'lucide-react'
import { useSetupRequirements } from '@/hooks/use-setup-requirements'
import { useMyBookingEvent } from '@monobase/sdk/react/hooks/use-booking'

/**
 * Visibility Status Banner
 * 
 * Shows provider profile visibility status and setup requirements.
 * Guides providers through profile completion and going live in the directory.
 */
export function VisibilityStatusBanner() {
  const { data: bookingEvent, isLoading: eventLoading } = useMyBookingEvent()
  const {
    accountComplete,
    professionalComplete,
    merchantComplete,
    allRequirementsMet,
    isLoading: requirementsLoading,
  } = useSetupRequirements()

  // Don't show banner while loading
  if (eventLoading || requirementsLoading) {
    return null
  }

  // Check if publicly visible
  const isPublic = bookingEvent?.status === 'active'

  // If public, show success badge
  if (isPublic) {
    return (
      <Alert className="border-green-200 bg-green-50">
        <Eye className="h-4 w-4 text-green-600" />
        <AlertTitle className="text-green-900">Live in Directory</AlertTitle>
        <AlertDescription className="text-green-800">
          Your profile is publicly visible in the provider directory
        </AlertDescription>
      </Alert>
    )
  }

  // Not public - show warning based on setup completion
  if (!allRequirementsMet) {
    return (
      <Alert variant="destructive" className="border-yellow-200 bg-yellow-50">
        <AlertCircle className="h-4 w-4 text-yellow-600" />
        <AlertTitle className="text-yellow-900">
          Your profile is not visible in the provider directory
        </AlertTitle>
        <AlertDescription className="text-yellow-800">
          <p className="mb-3">Complete your profile to start accepting bookings:</p>
          <div className="space-y-1 mb-3">
            <div className="flex items-center gap-2">
              {accountComplete ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <X className="h-4 w-4 text-yellow-600" />
              )}
              {accountComplete ? (
                <span>Complete account setup</span>
              ) : (
                <Link to="/settings/account" className="text-yellow-900 hover:underline">
                  Complete account setup
                </Link>
              )}
            </div>
            <div className="flex items-center gap-2">
              {professionalComplete ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <X className="h-4 w-4 text-yellow-600" />
              )}
              {professionalComplete ? (
                <span>Complete professional profile</span>
              ) : (
                <Link to="/settings/professional" className="text-yellow-900 hover:underline">
                  Complete professional profile
                </Link>
              )}
            </div>
            <div className="flex items-center gap-2">
              {merchantComplete ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <X className="h-4 w-4 text-yellow-600" />
              )}
              {merchantComplete ? (
                <span>Setup merchant account</span>
              ) : (
                <Link to="/settings/billing" className="text-yellow-900 hover:underline">
                  Setup merchant account
                </Link>
              )}
            </div>
          </div>
          <Button asChild size="sm" className="bg-yellow-600 hover:bg-yellow-700">
            <Link to={
              !accountComplete ? "/settings/account" : 
              !professionalComplete ? "/settings/professional" : 
              !merchantComplete ? "/settings/billing" : 
              "/settings/schedule"
            }>
              Complete Setup <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  // Requirements met but not public
  return (
    <Alert className="border-blue-200 bg-blue-50">
      <AlertCircle className="h-4 w-4 text-blue-600" />
      <AlertTitle className="text-blue-900">
        Your profile is ready!
      </AlertTitle>
      <AlertDescription className="text-blue-800">
        <p className="mb-3">Enable visibility to appear in the provider directory and start accepting bookings</p>
        <Button asChild size="sm" className="bg-blue-600 hover:bg-blue-700">
          <Link to="/settings/schedule">
            Enable Visibility <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </AlertDescription>
    </Alert>
  )
}
