import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { z } from 'zod'

// Route params schema
const paramsSchema = z.object({
  slotId: z.string(),
})

export const Route = createFileRoute('/booking/new/$slotId/')({
  params: paramsSchema,
  component: BookingEntryPage,
})

function BookingEntryPage() {
  const { slotId } = Route.useParams()
  const navigate = useNavigate()
  
  useEffect(() => {
    // For now, simply redirect to consent page
    // In the future, this could check booking state and redirect appropriately
    navigate({
      to: '/booking/new/$slotId/consent',
      params: { slotId },
      replace: true
    })
  }, [slotId, navigate])
  
  // This component just redirects, so no UI needed
  return null
}