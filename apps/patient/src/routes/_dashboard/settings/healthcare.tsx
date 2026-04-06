import { createFileRoute } from '@tanstack/react-router'
import { Loader2, UserPlus, Pill } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@monobase/ui/components/card'

// Import patient-specific form components
import { PrimaryCareProviderForm } from '@monobase/ui/patient/components/primary-care-provider-form'
import { PrimaryPharmacyForm } from '@monobase/ui/patient/components/primary-pharmacy-form'

// Import types
import type { PrimaryProviderData, PrimaryPharmacyData } from '@monobase/ui/patient/schemas'

// Import patient hooks
import {
  useMyPatient,
  useUpdatePrimaryProvider,
  useUpdatePrimaryPharmacy
} from '@monobase/sdk/react/hooks/use-patient'

export const Route = createFileRoute('/_dashboard/settings/healthcare')({
  component: HealthcareSettingsPage,
})

function HealthcareSettingsPage() {
  // Use hooks for data fetching and mutations
  const { data: patient, isLoading: isLoadingPatient } = useMyPatient()
  // Data transformation done inline below

  // Mutation hooks
  const updatePrimaryProviderMutation = useUpdatePrimaryProvider()
  const updatePrimaryPharmacyMutation = useUpdatePrimaryPharmacy()

  const handleSavePrimaryProvider = async (data: PrimaryProviderData) => {
    const providerData = data.hasProvider ? {
      name: data.name,
      specialty: data.specialty || null,
      phone: data.phone || null,
      fax: data.fax || null,
    } : null

    await updatePrimaryProviderMutation.mutateAsync(providerData)
  }

  const handleSavePrimaryPharmacy = async (data: PrimaryPharmacyData) => {
    const pharmacyData = data.hasPharmacy ? {
      name: data.name,
      address: data.address || null,
      phone: data.phone || null,
      fax: data.fax || null,
    } : null

    await updatePrimaryPharmacyMutation.mutateAsync(pharmacyData)
  }

  // Loading state
  if (isLoadingPatient) {
    return (
      <div className="flex flex-col gap-6 p-6 max-w-4xl">
        <div>
          <h1 className="text-3xl font-headline font-bold">Healthcare Settings</h1>
          <p className="text-muted-foreground font-body">
            Manage your healthcare provider and pharmacy information
          </p>
        </div>
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading healthcare information...
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-headline font-bold">Healthcare Settings</h1>
        <p className="text-muted-foreground font-body">
          Manage your healthcare provider and pharmacy information
        </p>
      </div>

      {/* Primary Care Provider */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Primary Care Provider
          </CardTitle>
          <CardDescription>
            Manage your primary care physician information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PrimaryCareProviderForm
            defaultValues={patientFormData?.provider}
            onSubmit={handleSavePrimaryProvider}
            mode="edit"
          />
        </CardContent>
      </Card>

      {/* Primary Pharmacy */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Pill className="h-5 w-5" />
            Primary Pharmacy
          </CardTitle>
          <CardDescription>
            Manage your preferred pharmacy for prescriptions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PrimaryPharmacyForm
            defaultValues={patientFormData?.pharmacy}
            onSubmit={handleSavePrimaryPharmacy}
            mode="edit"
          />
        </CardContent>
      </Card>

    </div>
  )
}
