import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { requireAuth } from '@/lib/guards'
import { OnboardingWizard } from '@/features/onboarding/components/onboarding-wizard'

/**
 * Clinic setup wizard — /dental-onboarding.
 *
 * Top-level (NOT under _dashboard) and guarded by requireAuth ONLY: a brand-new
 * owner has no PIN yet (the wizard is what mints their first member + PIN), so
 * gating this behind the _dashboard in-memory pinSession made the only screen a
 * no-clinic owner needs unreachable. requireAuth (the cloud Better-Auth session)
 * is the correct gate here.
 *
 * Reached when an authenticated owner has no clinic: /_dashboard bounces them to
 * /auth/pin-select, which (finding no branch) forwards here.
 */
export const Route = createFileRoute('/dental-onboarding')({
  beforeLoad: requireAuth,
  component: DentalOnboardingPage,
})

function DentalOnboardingPage() {
  const navigate = useNavigate()
  return <OnboardingWizard onComplete={() => navigate({ to: '/dashboard' } as any)} />
}
