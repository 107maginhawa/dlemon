/**
 * NotificationBell — in-app notification surface (notifications FIX-001, GAP-1).
 *
 * Bell control + unread badge in the dashboard shell header, with a toggle-open
 * inbox panel listing the viewer's unread in-app notifications. Each row can be
 * marked read; a header action marks all read. The badge count and the rows come
 * from the SAME unread query (see use-notifications.ts) so they cannot diverge.
 *
 * The panel is a plain state-toggled positioned div (no Radix portal) to keep it
 * test-deterministic in happy-dom and the dashboard-shell edit minimal/additive.
 * Recipient-scoped server-side: a member only ever sees their own notifications.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { APP_LOCALE } from '@/constants/brand';
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from './hooks/use-notifications';

function fmt(ts: string | Date): string {
  const d = typeof ts === 'string' ? new Date(ts) : ts;
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(APP_LOCALE, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);

  const { notifications, unreadCount, isLoading, error } = useNotifications();
  const { markRead } = useMarkNotificationRead();
  const { markAllRead } = useMarkAllNotificationsRead();

  // Close the panel on an outside click or Escape so it behaves like a popover/dialog.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  // Focus management: move focus into the dialog when it opens; return it to the
  // trigger when it closes (only on a real open→close transition, not initial mount).
  useEffect(() => {
    if (open) {
      panelRef.current?.focus();
    } else if (wasOpen.current) {
      bellRef.current?.focus();
    }
    wasOpen.current = open;
  }, [open]);

  const badgeLabel = unreadCount > 9 ? '9+' : String(unreadCount);
  const hasMore = unreadCount > notifications.length;

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={bellRef}
        type="button"
        data-testid="notification-bell"
        // Authoritative, exact unread count for assistive tech — the visual badge below
        // is capped to "9+" for space and marked aria-hidden, so there is exactly one
        // (precise) count exposed to screen readers and no SR-vs-visual contradiction.
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span
            data-testid="notification-unread-badge"
            aria-hidden="true"
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground"
          >
            {badgeLabel}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          tabIndex={-1}
          data-testid="notification-inbox"
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 z-50 mt-2 w-80 max-w-[90vw] rounded-xl border border-border bg-background shadow-lg outline-none"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-sm font-semibold">Notifications</span>
            {unreadCount > 0 && (
              <button
                type="button"
                data-testid="notification-mark-all"
                onClick={() => markAllRead()}
                className="text-xs font-medium text-primary hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {isLoading ? (
              <div data-testid="notification-loading" className="m-3 h-16 animate-pulse rounded-lg bg-muted" />
            ) : error ? (
              <div
                data-testid="notification-error"
                className="m-3 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
              >
                Couldn&apos;t load notifications. Please try again.
              </div>
            ) : notifications.length === 0 ? (
              <p data-testid="notification-empty" className="px-4 py-8 text-center text-sm text-muted-foreground">
                You&apos;re all caught up.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {notifications.map((n) => (
                  <li key={n.id} data-testid="notification-row" className="flex flex-col gap-1 px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium">{n.title}</span>
                      <button
                        type="button"
                        data-testid="notification-mark-read"
                        // No notification content in the accessible name (PHI hygiene):
                        // the title is already the adjacent visible text in this row,
                        // so the button text "Mark read" is a sufficient accessible name.
                        onClick={() => markRead(n.id)}
                        className="shrink-0 text-xs font-medium text-primary hover:underline"
                      >
                        Mark read
                      </button>
                    </div>
                    <span className="text-sm text-muted-foreground">{n.message}</span>
                    <span className="text-[11px] text-muted-foreground">{fmt(n.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Honest truncation indicator: the badge counts the true unread total, but
              the panel only lists the first page — say so instead of silently capping. */}
          {!isLoading && !error && hasMore && (
            <div
              data-testid="notification-more"
              className="border-t border-border px-4 py-2 text-center text-xs text-muted-foreground"
            >
              Showing {notifications.length} of {unreadCount} unread
            </div>
          )}
        </div>
      )}
    </div>
  );
}
