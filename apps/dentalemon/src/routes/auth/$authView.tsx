import { createFileRoute } from '@tanstack/react-router'
import { Logo } from '@/components/logo'
import { AuthView } from '@daveyplate/better-auth-ui'

export const Route = createFileRoute('/auth/$authView')({
  component: RouteComponent,
})

function RouteComponent() {
  const { authView } = Route.useParams()

  // Define headers for known auth paths
  const authHeaders = {
    'sign-in': {
      title: 'Welcome back',
      subtitle: 'Sign in to your Monobase account'
    },
    'sign-up': {
      title: 'Create an account',
      subtitle: 'Join Monobase today'
    },
    'forgot-password': {
      title: 'Reset your password',
      subtitle: "We'll send you a reset link"
    },
    'verify-email': {
      title: 'Verify your email',
      subtitle: 'Check your inbox for the verification link'
    },
    'two-factor': {
      title: 'Two-factor authentication',
      subtitle: 'Enter your verification code'
    }
  }

  // Get header content for current auth view (undefined for unknown paths)
  const headerContent = authHeaders[authView as keyof typeof authHeaders]

  // callback URL
  const callbackURL = globalThis.location.origin;

  return (
    <main className="h-screen overflow-y-auto flex items-center justify-center bg-background py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full mx-auto">
        {headerContent && (
          <div className="text-center mb-6">
            <div className="flex justify-center mb-3">
              <Logo variant="horizontal" size="xl" />
            </div>
            <h1 className="text-2xl font-headline font-bold text-foreground">{headerContent.title}</h1>
            <p className="subtitle text-muted-foreground mt-2">{headerContent.subtitle}</p>
          </div>
        )}
        <div className="w-full overflow-hidden flex justify-center text-center [&_.flex.items-center.gap-2]:justify-center">
          <AuthView
            pathname={authView}
            callbackURL={callbackURL}
          />
        </div>
      </div>
    </main>
  )
}
