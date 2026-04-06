import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@monobase/ui/components/card"
import { ProviderForm } from '@monobase/ui/provider/components/provider-form'
import { useMyProvider, useUpdateMyProvider } from '@monobase/sdk/react/hooks/use-provider'
import { Loader2 } from 'lucide-react'

export const Route = createFileRoute('/_dashboard/settings/professional')({
  component: ProfessionalSettingsPage,
})

function ProfessionalSettingsPage() {
  const { data: provider, isLoading: isLoadingProvider } = useMyProvider()
  const updateProvider = useUpdateMyProvider()

  if (isLoadingProvider) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-6">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="mt-4 text-muted-foreground">Loading professional profile...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold">Professional Profile</h1>
        <p className="text-muted-foreground">
          Manage your provider credentials and professional information
        </p>
      </div>

      {/* Provider Information */}
      <Card>
        <CardHeader>
          <CardTitle>Professional Information</CardTitle>
          <CardDescription>Update your provider profile and professional details</CardDescription>
        </CardHeader>
        <CardContent>
          <ProviderForm
            defaultValues={provider || undefined}
            onSubmit={async (data) => {
              if (!provider?.id) return
              await updateProvider.mutateAsync({ providerId: provider.id, updates: data })
            }}
            isLoading={updateProvider.isPending}
          />
        </CardContent>
      </Card>
    </div>
  )
}
