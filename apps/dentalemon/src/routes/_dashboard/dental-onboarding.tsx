import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { OnboardingWizard } from '../../features/onboarding/components/onboarding-wizard'

export const Route = createFileRoute('/_dashboard/dental-onboarding')({
  component: DentalOnboardingPage,
})

function DentalOnboardingPage() {
  const navigate = useNavigate();
  return <OnboardingWizard onComplete={() => navigate({ to: '/dashboard' } as any)} />;
}
