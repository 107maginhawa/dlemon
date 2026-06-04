/**
 * resolve-reminder-channels.ts (P1-24)
 *
 * The load-bearing consent gate for outbound appointment/recall reminders.
 *
 * Rules (see docs/reviews/plans/05-reminders-recall.md §3.3 + §7):
 *   - A channel is eligible iff it is in the branch policy AND the patient has
 *     consented to it.
 *   - FAILS CLOSED for outbound transmission: `sms`/`push`/`email` with consent
 *     `undefined` ("not yet captured") are SUPPRESSED. Only an explicit `true`
 *     opens an outbound channel.
 *   - `in-app` is ALWAYS allowed — the patient owns the in-app inbox; nothing is
 *     transmitted off-platform.
 *   - Reminders are TRANSACTIONAL, not marketing: `marketing` consent is NOT
 *     required. BUT a global opt-out still suppresses all outbound channels
 *     (in-app remains).
 *   - `preferredChannel` is honored as the *primary*: when the preferred channel
 *     is eligible, only it (+ in-app) is returned; other consented channels are
 *     fallbacks used only when the preferred channel is unavailable.
 *
 * Pure function — no DB access — so it is trivially unit-testable.
 */

// Local structural mirror of person consent (kept here to respect module
// boundaries — dental-scheduling must not import handlers/person/repos/*). The
// shape matches PersonConsent.channels in handlers/person/repos/person.schema.ts.
export interface CommunicationChannelConsent {
  sms?: boolean;
  email?: boolean;
  phone?: boolean;
  marketing?: boolean;
}

export interface PersonConsent {
  registrationConsent: boolean;
  capturedAt: string;
  channels?: CommunicationChannelConsent;
  channelsUpdatedAt?: string;
}

/** Outbound + in-app channels a reminder can target. */
export type ReminderChannel = 'sms' | 'email' | 'push' | 'in-app';

/** Channels that transmit off-platform and therefore require explicit consent. */
const OUTBOUND_CHANNELS: ReminderChannel[] = ['sms', 'email', 'push'];

export type PatientPreferredChannel = 'sms' | 'email' | 'phone' | 'none' | undefined | null;

export interface ResolveChannelsInput {
  /** Persisted person consent (registration + per-channel). May be null/undefined. */
  consent: PersonConsent | null | undefined;
  /** Channels enabled by the branch reminder policy. */
  policyChannels: ReminderChannel[];
  /** Patient's preferred channel (patient.preferredChannel). */
  preferredChannel?: PatientPreferredChannel;
}

export interface ResolveChannelsResult {
  /** Channels cleared to send on. `in-app` is always present if in policy. */
  channels: ReminderChannel[];
  /** Channels in policy that were suppressed, with a no-PII reason (audit trail). */
  suppressed: { channel: ReminderChannel; reason: string }[];
}

/**
 * Map a per-channel consent record to whether an outbound channel is consented.
 * `push` is gated by the SMS-equivalent "device/app" opt-in: we reuse the closest
 * captured signal. There is no dedicated `push` consent flag, so a push channel
 * is treated as consented only when `marketing`-independent device messaging is
 * explicitly allowed via the `sms`-or-`email` opt-in is NOT correct; instead push
 * has no separate flag and therefore FAILS CLOSED unless the branch ships a push
 * opt-in. To keep the gate honest we require an explicit `push === true`.
 */
function channelConsented(
  channel: ReminderChannel,
  channels: CommunicationChannelConsent | undefined,
): boolean {
  if (channel === 'in-app') return true; // never transmitted off-platform
  if (!channels) return false; // not captured → fail closed
  // No dedicated `push` flag exists on CommunicationChannelConsent; treat push as
  // an outbound channel that must be explicitly opted in. We map it to the same
  // record key so a future migration can add it; today it is undefined → false.
  const value = (channels as Record<string, boolean | undefined>)[channel];
  return value === true;
}

/** Has the patient globally opted out of all outbound communication? */
function isGlobalOptOut(consent: PersonConsent | null | undefined): boolean {
  const channels = consent?.channels;
  if (!channels) return false;
  // A global opt-out = every outbound channel the record knows about is explicitly false.
  const known = OUTBOUND_CHANNELS.filter(
    (ch) => (channels as Record<string, boolean | undefined>)[ch] !== undefined,
  );
  if (known.length === 0) return false;
  return known.every((ch) => (channels as Record<string, boolean | undefined>)[ch] === false);
}

/**
 * Resolve the channels a transactional reminder may use, applying the consent gate.
 */
export function resolveConsentedChannels(input: ResolveChannelsInput): ResolveChannelsResult {
  const { consent, policyChannels, preferredChannel } = input;
  const channels = consent?.channels;

  const suppressed: ResolveChannelsResult['suppressed'] = [];
  const eligible: ReminderChannel[] = [];

  const optedOut = isGlobalOptOut(consent);

  for (const channel of policyChannels) {
    if (channel === 'in-app') {
      eligible.push('in-app');
      continue;
    }
    if (optedOut) {
      suppressed.push({ channel, reason: 'global-opt-out' });
      continue;
    }
    if (channelConsented(channel, channels)) {
      eligible.push(channel);
    } else {
      suppressed.push({ channel, reason: 'channel-consent-missing' });
    }
  }

  // Honor preferredChannel as the primary outbound: if the preferred channel is
  // eligible, drop the other *outbound* channels (keep in-app). 'phone'/'none'
  // have no notification channel, so they impose no preference.
  const preferredAsChannel: ReminderChannel | null =
    preferredChannel === 'sms' ? 'sms' : preferredChannel === 'email' ? 'email' : null;

  if (preferredAsChannel && eligible.includes(preferredAsChannel)) {
    const filtered = eligible.filter((ch) => ch === 'in-app' || ch === preferredAsChannel);
    return { channels: dedupe(filtered), suppressed };
  }

  return { channels: dedupe(eligible), suppressed };
}

function dedupe(list: ReminderChannel[]): ReminderChannel[] {
  return Array.from(new Set(list));
}
