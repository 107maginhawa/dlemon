import React, { useState, useEffect } from 'react';
import { useBranchSettings, useUpdateBranchSettings } from '../hooks/use-branch-settings';
import { useOrgContextStore } from '@/stores/org-context.store';

/* ------------------------------------------------------------------ */
/*  Types & helpers (tested in notification-settings.test.ts)          */
/* ------------------------------------------------------------------ */

interface NotificationPreferences {
  appointmentReminders: boolean;
  treatmentFollowUp: boolean;
  paymentReceipts: boolean;
  marketingSms: boolean;
  emailNotifications: boolean;
  smsNotifications: boolean;
  pushNotifications: boolean;
}

function defaultNotificationPreferences(): NotificationPreferences {
  return {
    appointmentReminders: true,
    treatmentFollowUp: true,
    paymentReceipts: true,
    marketingSms: false,
    emailNotifications: true,
    smsNotifications: true,
    pushNotifications: true,
  };
}

function parseNotificationPreferences(raw: unknown): NotificationPreferences {
  const defaults = defaultNotificationPreferences();
  if (!raw || typeof raw !== 'object') return defaults;
  const obj = raw as Record<string, unknown>;
  return {
    appointmentReminders: typeof obj.appointmentReminders === 'boolean' ? obj.appointmentReminders : defaults.appointmentReminders,
    treatmentFollowUp: typeof obj.treatmentFollowUp === 'boolean' ? obj.treatmentFollowUp : defaults.treatmentFollowUp,
    paymentReceipts: typeof obj.paymentReceipts === 'boolean' ? obj.paymentReceipts : defaults.paymentReceipts,
    marketingSms: typeof obj.marketingSms === 'boolean' ? obj.marketingSms : defaults.marketingSms,
    emailNotifications: typeof obj.emailNotifications === 'boolean' ? obj.emailNotifications : defaults.emailNotifications,
    smsNotifications: typeof obj.smsNotifications === 'boolean' ? obj.smsNotifications : defaults.smsNotifications,
    pushNotifications: typeof obj.pushNotifications === 'boolean' ? obj.pushNotifications : defaults.pushNotifications,
  };
}

const NOTIFICATION_ITEMS: { key: keyof NotificationPreferences; label: string; description: string; group: 'triggers' | 'channels' }[] = [
  { key: 'appointmentReminders', label: 'Appointment Reminders', description: 'Send reminders before scheduled appointments', group: 'triggers' },
  { key: 'treatmentFollowUp', label: 'Treatment Follow-Up', description: 'Post-treatment care reminders', group: 'triggers' },
  { key: 'paymentReceipts', label: 'Payment Receipts', description: 'Email receipts after payments', group: 'triggers' },
  { key: 'marketingSms', label: 'Marketing SMS', description: 'Promotional messages to patients', group: 'triggers' },
  { key: 'emailNotifications', label: 'Email Channel', description: 'Enable email as a notification channel', group: 'channels' },
  { key: 'smsNotifications', label: 'SMS Channel', description: 'Enable SMS as a notification channel', group: 'channels' },
  { key: 'pushNotifications', label: 'Push Notifications', description: 'Enable push notifications to patient devices', group: 'channels' },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function NotificationSettings() {
  const branchId = useOrgContextStore((s) => s.branchId);
  const { settings, isLoading, isError } = useBranchSettings(branchId);
  const { update, isPending, isSuccess, error: saveError, reset } = useUpdateBranchSettings(branchId);

  const [prefs, setPrefs] = useState<NotificationPreferences>(defaultNotificationPreferences);

  useEffect(() => {
    if (!settings) return;
    setPrefs(parseNotificationPreferences(settings.notificationPreferences));
  }, [settings]);

  function handleToggle(key: keyof NotificationPreferences) {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleSave() {
    reset();
    try {
      await update({ notificationPreferences: prefs as unknown as Record<string, unknown> });
    } catch {
      // error exposed via saveError
    }
  }

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading...</div>;
  if (isError) return <div className="text-sm text-destructive">Failed to load notification settings. Please try again.</div>;

  const triggers = NOTIFICATION_ITEMS.filter((i) => i.group === 'triggers');
  const channels = NOTIFICATION_ITEMS.filter((i) => i.group === 'channels');

  return (
    <div className="flex flex-col gap-6 max-w-xl">
      <p className="text-sm text-muted-foreground">Configure which notifications your clinic sends and through which channels.</p>

      {saveError && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
          Failed to save: {saveError.message}
        </div>
      )}
      {isSuccess && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">
          Notification settings saved
        </div>
      )}

      {/* Notification Types */}
      <section>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Notification Types</h3>
        <div className="rounded-xl border border-border overflow-hidden">
          {triggers.map((item, i) => (
            <div key={item.key} className={`flex items-center justify-between px-4 py-3 ${i > 0 ? 'border-t border-border' : ''}`}>
              <div>
                <div className="text-sm font-medium">{item.label}</div>
                <div className="text-xs text-muted-foreground">{item.description}</div>
              </div>
              <button
                type="button"
                onClick={() => handleToggle(item.key)}
                className={`w-10 h-6 rounded-full transition-colors relative flex-shrink-0 ${prefs[item.key] ? 'bg-[#FFE97D]' : 'bg-secondary'}`}
                aria-label={`Toggle ${item.label}`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${prefs[item.key] ? 'translate-x-4' : 'translate-x-0.5'}`}
                />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Channels */}
      <section>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Channels</h3>
        <div className="rounded-xl border border-border overflow-hidden">
          {channels.map((item, i) => (
            <div key={item.key} className={`flex items-center justify-between px-4 py-3 ${i > 0 ? 'border-t border-border' : ''}`}>
              <div>
                <div className="text-sm font-medium">{item.label}</div>
                <div className="text-xs text-muted-foreground">{item.description}</div>
              </div>
              <button
                type="button"
                onClick={() => handleToggle(item.key)}
                className={`w-10 h-6 rounded-full transition-colors relative flex-shrink-0 ${prefs[item.key] ? 'bg-[#FFE97D]' : 'bg-secondary'}`}
                aria-label={`Toggle ${item.label}`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${prefs[item.key] ? 'translate-x-4' : 'translate-x-0.5'}`}
                />
              </button>
            </div>
          ))}
        </div>
      </section>

      <button
        type="button"
        onClick={handleSave}
        disabled={isPending}
        className="h-11 rounded-xl bg-[#FFE97D] text-[#4A4018] text-sm font-semibold hover:bg-[#F5DC60] transition-colors disabled:opacity-60 w-fit px-8"
      >
        {isPending ? 'Saving...' : 'Save Notification Settings'}
      </button>
    </div>
  );
}
