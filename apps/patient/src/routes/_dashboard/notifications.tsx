import { createFileRoute } from '@tanstack/react-router'
import {
  Bell,
  BellRing,
  Check,
  Calendar,
  CreditCard,
  AlertCircle,
  MoreVertical,
  Loader2,
  type LucideIcon,
} from 'lucide-react'
import { requireAuth, requireEmailVerified, requirePerson, composeGuards } from '@/utils/guards'
import { formatRelativeDate } from '@monobase/ui/lib/format-date'
import { useNotifications, useMarkNotificationAsRead, useMarkAllNotificationsAsRead } from '@monobase/sdk/react/hooks/use-notifications'
import type { Notification, NotificationType } from '@/api/notifications'
import { Button } from '@monobase/ui/components/button'
import {
  Card,
  CardContent,
} from '@monobase/ui/components/card'
import { Badge } from '@monobase/ui/components/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@monobase/ui/components/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@monobase/ui/components/dropdown-menu'

export const Route = createFileRoute('/_dashboard/notifications')({
  beforeLoad: composeGuards(requireAuth, requireEmailVerified, requirePerson),
  component: NotificationsPage,
})

// Helper functions
function getNotificationIcon(type: NotificationType): LucideIcon {
  switch (type) {
    case 'appointment-reminder':
      return Calendar
    case 'billing':
      return CreditCard
    case 'security':
      return AlertCircle
    case 'system':
      return Bell
    default:
      return Bell
  }
}

function getNotificationColor(type: NotificationType): string {
  switch (type) {
    case 'appointment-reminder':
      return 'text-blue-500'
    case 'billing':
      return 'text-purple-500'
    case 'security':
      return 'text-red-500'
    case 'system':
      return 'text-gray-500'
    default:
      return 'text-gray-500'
  }
}

function getActionUrl(notification: Notification): string | undefined {
  // Map notification types and related entities to action URLs
  switch (notification.type) {
    case 'appointment-reminder':
      return '/appointments'
    case 'billing':
      return '/billing'
    case 'security':
      return '/settings/security'
    case 'system':
      return undefined
    default:
      return undefined
  }
}

function NotificationsPage() {
  // Fetch notifications from API
  const { data: notificationsData, isLoading, error } = useNotifications()
  const markAsReadMutation = useMarkNotificationAsRead()
  const markAllAsReadMutation = useMarkAllNotificationsAsRead()

  const notifications = notificationsData?.data || []
  const unreadCount = notifications.filter((n) => !n.readAt).length


  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-headline font-bold flex items-center gap-3">
            <Bell className="h-8 w-8" />
            Notifications
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-2">
                {unreadCount} new
              </Badge>
            )}
          </h1>
          <p className="text-muted-foreground font-body">
            Stay updated with your healthcare notifications
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => markAllAsReadMutation.mutate()}
            disabled={unreadCount === 0 || markAllAsReadMutation.isPending}
          >
            {markAllAsReadMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Check className="mr-2 h-4 w-4" />
            )}
            Mark All Read
          </Button>
        </div>
      </div>


      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Error State */}
      {error && (
        <Card>
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="text-destructive mb-4">Failed to load notifications</p>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Notifications Tabs */}
      {!isLoading && !error && (
        <Tabs defaultValue="all" className="w-full">
          <TabsList>
            <TabsTrigger value="all">
              All
              <Badge variant="secondary" className="ml-2">
                {notifications.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="unread">
              Unread
              <Badge variant="destructive" className="ml-2">
                {unreadCount}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-4 mt-6">
            {notifications.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No notifications found</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {notifications.map((notification) => {
                  const Icon = getNotificationIcon(notification.type)
                  const color = getNotificationColor(notification.type)
                  const isUnread = !notification.readAt
                  const timeAgo = notification.sentAt
                    ? formatRelativeDate(notification.sentAt)
                    : formatRelativeDate(notification.createdAt)

                  return (
                    <Card key={notification.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <div className="flex-shrink-0">
                            <Icon className={`h-5 w-5 ${color}`} />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <h3
                                  className={`font-semibold ${isUnread ? 'text-foreground' : 'text-muted-foreground'}`}
                                >
                                  {notification.title}
                                  {isUnread && (
                                    <span className="ml-2 w-2 h-2 bg-blue-500 rounded-full inline-block"></span>
                                  )}
                                </h3>
                                <p className="text-muted-foreground mb-2">{notification.message}</p>
                                <p className="text-sm text-muted-foreground">{timeAgo}</p>
                              </div>

                              <div className="flex items-center gap-2">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button size="sm" variant="ghost">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    {!isUnread ? (
                                      <DropdownMenuItem disabled>
                                        <BellRing className="mr-2 h-4 w-4" />
                                        Already Read
                                      </DropdownMenuItem>
                                    ) : (
                                      <DropdownMenuItem
                                        onClick={() => markAsReadMutation.mutate(notification.id)}
                                      >
                                        <Check className="mr-2 h-4 w-4" />
                                        Mark as Read
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="unread" className="space-y-4 mt-6">
            {notifications.filter((n) => !n.readAt).length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No unread notifications</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {notifications
                  .filter((n) => !n.readAt)
                  .map((notification) => {
                    const Icon = getNotificationIcon(notification.type)
                    const color = getNotificationColor(notification.type)
                    const timeAgo = notification.sentAt
                      ? formatRelativeDate(notification.sentAt)
                      : formatRelativeDate(notification.createdAt)

                    return (
                      <Card key={notification.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start gap-4">
                            <div className="flex-shrink-0">
                              <Icon className={`h-5 w-5 ${color}`} />
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                  <h3 className="font-semibold">
                                    {notification.title}
                                    <span className="ml-2 w-2 h-2 bg-blue-500 rounded-full inline-block"></span>
                                  </h3>
                                  <p className="text-muted-foreground mb-2">{notification.message}</p>
                                  <p className="text-sm text-muted-foreground">{timeAgo}</p>
                                </div>

                                <div className="flex items-center gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => markAsReadMutation.mutate(notification.id)}
                                    disabled={markAsReadMutation.isPending}
                                  >
                                    {markAsReadMutation.isPending ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Check className="h-4 w-4" />
                                    )}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}