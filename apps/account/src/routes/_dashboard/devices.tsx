import { createFileRoute } from '@tanstack/react-router'
import { DeviceManager } from '../../features/dental-license/components/device-manager'

export const Route = createFileRoute('/_dashboard/devices')({
  component: DeviceManager,
})
