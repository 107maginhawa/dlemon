import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@monobase/ui/components/card"
import { MerchantAccountSetup } from '@monobase/ui/billing/components/merchant-account-setup'
import { formatDate } from '@monobase/ui/lib/format-date'
import {
  useMyMerchantAccountStatus,
  useGetMyDashboardLink,
  useCreateMyMerchantAccount,
  useGetMyOnboardingUrl
} from '@monobase/sdk/react/hooks/use-billing'
import { Button } from "@monobase/ui/components/button"
import { Badge } from "@monobase/ui/components/badge"
import {
  ExternalLink,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Building,
  Banknote,
  FileText,
  Shield
} from 'lucide-react'
import { Separator } from "@monobase/ui/components/separator"

export const Route = createFileRoute('/_dashboard/settings/billing')({
  component: BillingSettingsPage,
})

function BillingSettingsPage() {
  const { account, status, canAccessDashboard, isOnboardingComplete, isLoading } = useMyMerchantAccountStatus()
  const getDashboardLink = useGetMyDashboardLink()
  const createMutation = useCreateMyMerchantAccount()
  const onboardingMutation = useGetMyOnboardingUrl()

  const handleSetupAccount = async () => {
    try {
      // Generate redirect URLs based on current location
      const baseUrl = window.location.origin
      const refreshUrl = `${baseUrl}/settings/billing`
      const returnUrl = `${baseUrl}/settings/billing`

      if (status === 'none') {
        // Create new account - hook automatically redirects to Stripe onboarding
        await createMutation.mutateAsync({ refreshUrl, returnUrl })
      } else if (status === 'incomplete' && account) {
        // Continue incomplete onboarding
        onboardingMutation.mutate({ merchantAccountId: account.id, refreshUrl, returnUrl })
      }
    } catch (error) {
      // Error already handled by hook's onError, but prevents unhandled rejection
      console.error('Setup account error:', error)
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-6">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="mt-4 text-muted-foreground">Loading billing settings...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold">Billing & Payments</h1>
        <p className="text-muted-foreground">
          Manage your merchant account and payment settings
        </p>
      </div>

      {/* Merchant Account Status */}
      <Card>
        <CardHeader>
          <CardTitle>Merchant Account Status</CardTitle>
          <CardDescription>Your Stripe Connect account connection status</CardDescription>
        </CardHeader>
        <CardContent>
          {status === 'complete' ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                  <CheckCircle2 className="h-6 w-6 text-green-600" aria-hidden="true" />
                </div>
                <div>
                  <p className="font-semibold">Connected & Active</p>
                  <p className="text-sm text-muted-foreground">
                    Your merchant account is fully set up and ready to receive payments
                  </p>
                </div>
              </div>
              <Badge variant="secondary" className="bg-green-100 text-green-700">
                Active
              </Badge>
            </div>
          ) : status === 'incomplete' ? (
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
                <AlertCircle className="h-6 w-6 text-amber-600" aria-hidden="true" />
              </div>
              <div>
                <p className="font-semibold">Setup Incomplete</p>
                <p className="text-sm text-muted-foreground">
                  Your merchant account needs additional setup to start accepting payments
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                <CreditCard className="h-6 w-6 text-gray-600" aria-hidden="true" />
              </div>
              <div>
                <p className="font-semibold">Not Connected</p>
                <p className="text-sm text-muted-foreground">
                  Set up a Stripe account to start receiving payments
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Account Setup/Management */}
      <Card>
        <CardHeader>
          <CardTitle>Account Setup</CardTitle>
          <CardDescription>
            {status === 'complete'
              ? 'Manage your merchant account settings'
              : 'Connect your Stripe account to receive payments'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MerchantAccountSetup
            account={account}
            status={status}
            isLoading={isLoading || createMutation.isPending || onboardingMutation.isPending}
            onSetupAccount={handleSetupAccount}
            onSubmit={() => {}}
            onSkip={() => {}}
            showButtons={false}
          />
        </CardContent>
      </Card>

      {/* Quick Actions */}
      {status === 'complete' && canAccessDashboard && (
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Manage your account and view financial details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => getDashboardLink.mutate(account!.id)}
              disabled={getDashboardLink.isPending}
            >
              {getDashboardLink.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="mr-2 h-4 w-4" />
              )}
              Open Stripe Dashboard
            </Button>

            <Button variant="outline" className="w-full justify-start" disabled>
              <FileText className="mr-2 h-4 w-4" />
              View Tax Documents
              <Badge variant="outline" className="ml-auto">Coming Soon</Badge>
            </Button>

            <Button variant="outline" className="w-full justify-start" disabled>
              <Building className="mr-2 h-4 w-4" />
              Update Business Information
              <Badge variant="outline" className="ml-auto">Coming Soon</Badge>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Account Details */}
      {status === 'complete' && account && (
        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
            <CardDescription>Details about your merchant account</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Account ID</p>
                  <p className="text-sm font-mono">{account.id.slice(0, 16)}...</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Status</p>
                  <p className="text-sm">Active</p>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Charges Enabled</p>
                  <div className="flex items-center gap-2 mt-1">
                    {account.metadata?.chargesEnabled ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-green-600" aria-hidden="true" />
                        <span className="text-sm">Yes</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-4 w-4 text-amber-600" aria-hidden="true" />
                        <span className="text-sm">No</span>
                      </>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Payouts Enabled</p>
                  <div className="flex items-center gap-2 mt-1">
                    {account.metadata?.payoutsEnabled ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-green-600" aria-hidden="true" />
                        <span className="text-sm">Yes</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-4 w-4 text-amber-600" aria-hidden="true" />
                        <span className="text-sm">No</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {(account.metadata?.country || account.metadata?.currency) && (
                <>
                  <Separator />
                  <div className="grid grid-cols-2 gap-4">
                    {account.metadata?.country && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Country</p>
                        <p className="text-sm">{account.metadata.country}</p>
                      </div>
                    )}
                    {account.metadata?.currency && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Currency</p>
                        <p className="text-sm uppercase">{account.metadata.currency}</p>
                      </div>
                    )}
                  </div>
                </>
              )}

              {account.metadata?.onboardingCompletedAt && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Onboarding Completed</p>
                    <p className="text-sm">
                      {formatDate(new Date(account.metadata.onboardingCompletedAt), { format: 'long' })}
                    </p>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payout Information */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <Banknote className="h-5 w-5 text-blue-600 mt-0.5" aria-hidden="true" />
            <div className="flex-1">
              <p className="font-semibold text-blue-900">Payout Schedules & Banking</p>
              <p className="text-sm text-blue-700 mt-1">
                Configure your payout schedule, add bank accounts, and view transaction history
                in your Stripe merchant dashboard.
              </p>
              {status === 'complete' && canAccessDashboard && account && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => getDashboardLink.mutate(account.id)}
                  disabled={getDashboardLink.isPending}
                >
                  {getDashboardLink.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ExternalLink className="mr-2 h-4 w-4" />
                  )}
                  Open Stripe Dashboard
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security Notice */}
      <Card className="border-gray-200 bg-gray-50">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-gray-600 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-semibold text-gray-900">Secure Payment Processing</p>
              <p className="text-sm text-gray-700 mt-1">
                All payment processing is handled securely by Stripe. Your financial information
                is encrypted and never stored on our servers. Monobase is PCI DSS compliant.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
