import { createFileRoute, redirect } from '@tanstack/react-router'
import type { RouterContext } from '@/router'

/**
 * Root route — the product has no in-app marketing landing.
 * Marketing lives in the standalone apps/website site; the app root just
 * routes by auth state: signed-in → dashboard, signed-out → sign-in.
 */
export const Route = createFileRoute('/')({
  beforeLoad: ({ context }: { context: RouterContext }) => {
    if (context.auth.user) {
      throw redirect({ to: '/dashboard' })
    }
    throw redirect({ to: '/auth/$authView', params: { authView: 'sign-in' } })
  },
  component: () => null,
})
