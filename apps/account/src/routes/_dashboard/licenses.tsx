import { createFileRoute } from '@tanstack/react-router'
import { LicenseDashboard } from '../../features/dental-license/components/license-dashboard'

export const Route = createFileRoute('/_dashboard/licenses')({
  component: LicenseDashboard,
})
