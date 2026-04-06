import { createFileRoute } from '@tanstack/react-router'
import {
  ChangePasswordCard,
  // ProvidersCard,
  TwoFactorCard,
  PasskeysCard,
  // ApiKeysCard,
  SessionsCard,
  // DeleteAccountCard,
} from '@daveyplate/better-auth-ui'
import { requireAuth, requireEmailVerified, requirePerson, composeGuards } from '@/utils/guards'

export const Route = createFileRoute('/_dashboard/settings/security')({
  beforeLoad: composeGuards(requireAuth, requireEmailVerified, requirePerson),
  component: SecuritySettingsPage,
})

function SecuritySettingsPage() {
  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-headline font-bold">Security Settings</h1>
        <p className="text-muted-foreground font-body">
          Manage your account security and monitor login activity
        </p>
      </div>

      <ChangePasswordCard />
      {/* <ProvidersCard /> */}
      <TwoFactorCard />
      <PasskeysCard />
      {/* <ApiKeysCard /> */}
      <SessionsCard />
      {/* <DeleteAccountCard /> */}
    </div>
  )
}
