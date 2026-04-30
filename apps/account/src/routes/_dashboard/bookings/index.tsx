import { createFileRoute } from '@tanstack/react-router'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/tabs'
import { HostDirectory } from '@/features/booking/components/host-directory'
import { BookingList } from '@/features/booking/components/booking-list'

export const Route = createFileRoute('/_dashboard/bookings/')({
  component: BookingsPage,
})

function BookingsPage() {
  const { auth } = Route.useRouteContext()
  const myPersonId = auth.person?.id

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Bookings</h1>
        <p className="text-muted-foreground">
          Find a host or manage the sessions you're part of.
        </p>
      </div>

      <Tabs defaultValue="find" className="w-full">
        <TabsList>
          <TabsTrigger value="find">Find a host</TabsTrigger>
          <TabsTrigger value="my">My bookings</TabsTrigger>
        </TabsList>
        <TabsContent value="find" className="mt-4">
          <HostDirectory />
        </TabsContent>
        <TabsContent value="my" className="mt-4">
          {myPersonId ? (
            <BookingList myPersonId={myPersonId} />
          ) : (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
