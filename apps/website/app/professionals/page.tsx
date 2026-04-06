'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  AlertCircle,
  Video
} from 'lucide-react'
import { Button } from "@monobase/ui/components/button"
import { ProviderCard } from "@monobase/ui/provider/components/provider-card"
import { ProviderListSkeleton } from "@monobase/ui/provider/components/provider-card-skeleton"
import { Alert, AlertDescription } from "@monobase/ui/components/alert"
import { SiteHeader } from '@/components/layout/site-header'
import { useListBookingEvents } from '@monobase/sdk/react/hooks/use-booking'
import { useSession, useSignOut } from '@monobase/sdk/react/hooks/use-auth'

export default function PharmacistsPage(): React.JSX.Element {
  const { data: session, isLoading: authLoading } = useSession()
  const signOut = useSignOut()

  const handleSignOut = async () => {
    await signOut.mutateAsync()
  }

  // Fetch all active booking events
  const { data: eventsResponse, isLoading, error: queryError } = useListBookingEvents({
    status: 'active',
  })

  const events = eventsResponse?.data || []
  const error = queryError?.message || null

  return (
    <>
      <SiteHeader
        session={session}
        isLoading={authLoading}
        onSignOut={handleSignOut}
      />
      
      <div className="min-h-screen bg-gray-50">
        {/* Hero Section */}
        <div className="bg-gradient-to-br from-primary/5 to-primary/10 py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center"
            >
              <h1 className="text-4xl font-bold text-gray-900 mb-4">
                Video Consultations with Licensed Professionals
              </h1>
              <p className="text-xl text-gray-600">
                Get professional medication advice from the comfort of your home
              </p>
            </motion.div>
          </div>
        </div>

        {/* Professionals Grid */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Error State */}
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {error}
                <Button 
                  variant="link" 
                  size="sm" 
                  className="ml-2 p-0 h-auto"
                  onClick={() => window.location.reload()}
                >
                  Try Again
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Loading State */}
          {isLoading ? (
            <ProviderListSkeleton count={6} />
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {events.map((event, index) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <ProviderCard
                    provider={{
                      id: event.owner,
                      name: event.title,
                      title: "Healthcare Professional",
                      avatar: undefined,
                      bio: event.description || 'Virtual consultation with your professional',
                      specialties: event.tags || [],
                      practiceLocations: [],
                      languages: []
                    }}
                  >
                    <Link href={`/professionals/${event.id}`} className="block">
                      <Button className="w-full bg-red-600 hover:bg-red-700">
                        <Video className="w-4 h-4 mr-2" />
                        Book Appointment
                      </Button>
                    </Link>
                  </ProviderCard>
                </motion.div>
              ))}
            </div>
          )}
          
          {!isLoading && events.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">
                No professionals available at this time.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
