/**
 * Public self-service booking route (P1-25).
 *
 * Path: /book/:branchId  — unauthenticated, no beforeLoad guard. A prospective
 * or existing patient picks a service/provider, sees live availability, holds a
 * slot, and books a real appointment that lands on the staff calendar.
 *
 * Deliberately a top-level route (sibling to index) so it renders outside the
 * authenticated dashboard/workspace shells. The SDK client base URL is
 * configured by ApiProvider, so the public /dental/public/* calls work without
 * a session.
 */

import { createFileRoute } from '@tanstack/react-router'
import { BookingWizard } from '@/features/booking/BookingWizard'

export const Route = createFileRoute('/book/$branchId')({
  component: PublicBookingPage,
})

function PublicBookingPage() {
  const { branchId } = Route.useParams()
  return <BookingWizard branchId={branchId} />
}
