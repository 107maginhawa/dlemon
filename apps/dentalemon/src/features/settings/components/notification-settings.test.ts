import { describe, test, expect } from 'bun:test';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
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

/* ------------------------------------------------------------------ */
/*  Pure helpers (same logic the component will export)                 */
/* ------------------------------------------------------------------ */

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

function togglePreference(prefs: NotificationPreferences, key: keyof NotificationPreferences): NotificationPreferences {
  return { ...prefs, [key]: !prefs[key] };
}

const NOTIFICATION_LABELS: Record<keyof NotificationPreferences, { label: string; description: string }> = {
  appointmentReminders: { label: 'Appointment Reminders', description: 'Send reminders before scheduled appointments' },
  treatmentFollowUp: { label: 'Treatment Follow-Up', description: 'Post-treatment care reminders' },
  paymentReceipts: { label: 'Payment Receipts', description: 'Email receipts after payments' },
  marketingSms: { label: 'Marketing SMS', description: 'Promotional messages to patients' },
  emailNotifications: { label: 'Email Channel', description: 'Enable email as a notification channel' },
  smsNotifications: { label: 'SMS Channel', description: 'Enable SMS as a notification channel' },
  pushNotifications: { label: 'Push Notifications', description: 'Enable push notifications to patient devices' },
};

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('Notification Settings — defaults', () => {
  test('returns all 7 preference keys', () => {
    const prefs = defaultNotificationPreferences();
    expect(Object.keys(prefs)).toHaveLength(7);
  });

  test('appointment reminders enabled by default', () => {
    expect(defaultNotificationPreferences().appointmentReminders).toBe(true);
  });

  test('marketing SMS disabled by default', () => {
    expect(defaultNotificationPreferences().marketingSms).toBe(false);
  });
});

describe('Notification Settings — parseNotificationPreferences', () => {
  test('null → defaults', () => {
    expect(parseNotificationPreferences(null)).toEqual(defaultNotificationPreferences());
  });

  test('empty object → defaults', () => {
    expect(parseNotificationPreferences({})).toEqual(defaultNotificationPreferences());
  });

  test('partial object merges with defaults', () => {
    const prefs = parseNotificationPreferences({ appointmentReminders: false });
    expect(prefs.appointmentReminders).toBe(false);
    expect(prefs.treatmentFollowUp).toBe(true); // default
  });

  test('non-boolean values → defaults', () => {
    const prefs = parseNotificationPreferences({ appointmentReminders: 'yes' });
    expect(prefs.appointmentReminders).toBe(true); // default
  });
});

describe('Notification Settings — togglePreference', () => {
  test('toggles true→false', () => {
    const prefs = defaultNotificationPreferences();
    const updated = togglePreference(prefs, 'appointmentReminders');
    expect(updated.appointmentReminders).toBe(false);
  });

  test('toggles false→true', () => {
    const prefs = defaultNotificationPreferences();
    const updated = togglePreference(prefs, 'marketingSms');
    expect(updated.marketingSms).toBe(true);
  });

  test('does not mutate original', () => {
    const prefs = defaultNotificationPreferences();
    togglePreference(prefs, 'appointmentReminders');
    expect(prefs.appointmentReminders).toBe(true);
  });

  test('other fields unchanged', () => {
    const prefs = defaultNotificationPreferences();
    const updated = togglePreference(prefs, 'appointmentReminders');
    expect(updated.treatmentFollowUp).toBe(prefs.treatmentFollowUp);
    expect(updated.paymentReceipts).toBe(prefs.paymentReceipts);
  });
});

describe('Notification Settings — NOTIFICATION_LABELS', () => {
  test('every preference key has a label', () => {
    const keys = Object.keys(defaultNotificationPreferences()) as (keyof NotificationPreferences)[];
    for (const key of keys) {
      expect(NOTIFICATION_LABELS[key]).not.toBeUndefined();
      expect(NOTIFICATION_LABELS[key].label.length).toBeGreaterThan(0);
      expect(NOTIFICATION_LABELS[key].description.length).toBeGreaterThan(0);
    }
  });
});

describe('Notification Settings — push notifications (FR8.6)', () => {
  test('push notifications enabled by default', () => {
    expect(defaultNotificationPreferences().pushNotifications).toBe(true);
  });

  test('parse: push notifications respects explicit false', () => {
    const prefs = parseNotificationPreferences({ pushNotifications: false });
    expect(prefs.pushNotifications).toBe(false);
  });

  test('parse: push notifications non-boolean → default true', () => {
    const prefs = parseNotificationPreferences({ pushNotifications: 'yes' });
    expect(prefs.pushNotifications).toBe(true);
  });

  test('toggle push notifications true→false', () => {
    const prefs = defaultNotificationPreferences();
    const updated = togglePreference(prefs, 'pushNotifications');
    expect(updated.pushNotifications).toBe(false);
  });

  test('toggle push notifications does not mutate original', () => {
    const prefs = defaultNotificationPreferences();
    togglePreference(prefs, 'pushNotifications');
    expect(prefs.pushNotifications).toBe(true);
  });

  test('NOTIFICATION_LABELS has push notifications entry', () => {
    expect(NOTIFICATION_LABELS.pushNotifications).not.toBeUndefined();
    expect(NOTIFICATION_LABELS.pushNotifications.label).toBe('Push Notifications');
  });
});
