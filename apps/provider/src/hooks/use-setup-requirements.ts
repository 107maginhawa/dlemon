import { useMyPerson } from '@monobase/sdk/react/hooks/use-person'
import { useMyProvider } from '@monobase/sdk/react/hooks/use-provider'
import { useMyMerchantAccountStatus } from '@monobase/sdk/react/hooks/use-billing'

/**
 * Check if provider meets all requirements for public visibility
 *
 * Requirements:
 * - Complete account setup (person profile with required fields)
 * - Complete professional profile (provider with biography, min 10 characters)
 * - Complete merchant account setup (Stripe onboarding complete)
 *
 * @returns Setup requirements status
 */
export function useSetupRequirements() {
  const { data: person, isLoading: personLoading } = useMyPerson()
  const { data: provider, isLoading: providerLoading } = useMyProvider()
  const { isOnboardingComplete, isLoading: merchantLoading } = useMyMerchantAccountStatus()

  // Check if account is complete (required person fields)
  const accountComplete = !!(
    person?.firstName &&
    person?.lastName &&
    person?.dateOfBirth
  )

  // Check if professional profile is complete
  const professionalComplete = !!(
    provider?.biography &&
    provider.biography.length >= 10  // Match form's minimum requirement
  )

  // Merchant account complete from hook
  const merchantComplete = isOnboardingComplete || false

  // All requirements met
  const allRequirementsMet = accountComplete && professionalComplete && merchantComplete

  return {
    accountComplete,
    professionalComplete,
    merchantComplete,
    allRequirementsMet,
    isLoading: personLoading || providerLoading || merchantLoading,
  }
}
