import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/card"
import { PersonalInfoForm } from '@/features/person/components/personal-info-form'
import { AddressForm } from '@/features/person/components/address-form'
import { ContactInfoForm } from '@/features/person/components/contact-info-form'
import { PreferencesForm } from '@/features/person/components/preferences-form'
import {
  useMyPerson,
  useUpdateMyPersonalInfo,
  useUpdateMyContactInfo,
  useUpdateMyAddress,
  useUpdateMyPreferences
} from '@monobase/sdk/react/hooks/use-person'
import { useFileUpload } from '@monobase/sdk/react/hooks/use-storage'

export const Route = createFileRoute('/_dashboard/settings/account')({
  component: AccountSettingsPage,
  beforeLoad: async ({ context }) => {
    return { user: context.auth.user }
  },
})

function AccountSettingsPage() {
  const { user } = Route.useRouteContext()
  const { upload } = useFileUpload()

  const { data: person, isLoading: isLoadingPerson } = useMyPerson()

  const updatePersonalInfo = useUpdateMyPersonalInfo()
  const updateContactInfo = useUpdateMyContactInfo()
  const updateAddress = useUpdateMyAddress()
  const updatePreferences = useUpdateMyPreferences()

  const handleAvatarUpload = async (file: File): Promise<{ file?: string, url: string }> => {
    // Upload file to storage and get download URL
    const uploadedFile = await upload(file)

    // Return file ID and download URL
    return {
      file: uploadedFile.id,
      url: uploadedFile.downloadUrl
    }
  }

  if (isLoadingPerson) {
    return <div className="p-6">Loading...</div>
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold">Account Settings</h1>
        <p className="text-muted-foreground">
          Manage your personal information and preferences
        </p>
      </div>

      {/* Person-specific forms */}
      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
          <CardDescription>Update your personal details</CardDescription>
        </CardHeader>
        <CardContent>
          <PersonalInfoForm
            defaultValues={person as never}
            onSubmit={async (data) => {
              if (!person) return
              await updatePersonalInfo.mutateAsync({ personId: person.id, data: data as never })
            }}
            mode="edit"
            memberSince={person?.createdAt}
            onAvatarUpload={handleAvatarUpload}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contact Information</CardTitle>
          <CardDescription>Manage your contact details</CardDescription>
        </CardHeader>
        <CardContent>
          <ContactInfoForm
            defaultValues={person?.contactInfo as never}
            onSubmit={async (data) => {
              if (!person) return
              await updateContactInfo.mutateAsync({ personId: person.id, data })
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Address</CardTitle>
          <CardDescription>Update your address information</CardDescription>
        </CardHeader>
        <CardContent>
          <AddressForm
            defaultValues={person?.primaryAddress as never}
            onSubmit={async (data) => {
              if (!person) return
              await updateAddress.mutateAsync({ personId: person.id, data })
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
          <CardDescription>Manage your account preferences</CardDescription>
        </CardHeader>
        <CardContent>
          <PreferencesForm
            defaultValues={person as never}
            onSubmit={async (data) => {
              if (!person) return
              await updatePreferences.mutateAsync({ personId: person.id, data })
            }}
          />
        </CardContent>
      </Card>
    </div>
  )
}
