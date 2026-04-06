import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_dashboard/appointments/')({
  beforeLoad: () => {
    throw redirect({ to: '/appointments/confirmed' })
  },
})
