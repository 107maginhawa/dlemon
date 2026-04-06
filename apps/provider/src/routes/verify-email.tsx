import { createFileRoute } from '@tanstack/react-router'
import { requireAuth, requireNotEmailVerified, composeGuards } from '@/utils/guards'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@monobase/ui/components/card'
import { Button } from '@monobase/ui/components/button'
import { Mail } from 'lucide-react'

export const Route = createFileRoute('/verify-email')({
  beforeLoad: composeGuards(requireAuth, requireNotEmailVerified),
  component: VerifyEmailPage,
})

function VerifyEmailPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-primary/10 p-3">
              <Mail className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">Verify Your Email</CardTitle>
          <CardDescription>
            We've sent a verification link to your email address
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            Please check your email and click the verification link to continue.
          </p>
          <Button className="w-full" onClick={() => window.location.reload()}>
            I've Verified My Email
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
