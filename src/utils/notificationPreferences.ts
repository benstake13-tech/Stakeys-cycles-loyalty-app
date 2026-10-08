/**
 * Staff-managed notification preferences.
 *
 * Every meaningful thing that happens in the workshop is one "event". For each
 * event the workshop decides which channels fire: an in-app visual notification
 * (the bell), an email, and/or a OneSignal push. The matrix is stored on the
 * `app_settings` row so the choice is shared across every staff terminal.
 *
 * The catalogue is the single source of truth for the settings UI, the
 * dispatcher and the defaults, so adding an event is a one-line change here.
 */

export type NotificationEventId =
  | 'new_booking'
  | 'sos_request'
  | 'sos_confirmed'
  | 'new_member'
  | 'stamp_milestone'
  | 'reward_ready'
  | 'bike_added'
  | 'voucher_earned'
  | 'prize_won';

/** Which channels an event uses. Visual = the in-app bell. */
export interface NotificationChannels {
  visual: boolean;
  email: boolean;
  push: boolean;
}

export type NotificationPreferences = Record<NotificationEventId, NotificationChannels>;

/** Who a notification is primarily about — used to label the settings UI. */
export type NotificationAudience = 'staff' | 'customer' | 'both';

export interface NotificationEventMeta {
  id: NotificationEventId;
  label: string;
  description: string;
  audience: NotificationAudience;
}

/** The events the workshop can configure, in display order. */
export const NOTIFICATION_EVENTS: NotificationEventMeta[] = [
  {
    id: 'new_booking',
    label: 'New repair booking',
    description: 'A booking lands from the website, customer app or the counter.',
    audience: 'staff',
  },
  {
    id: 'sos_request',
    label: 'SOS call-out requested',
    description: 'An emergency roadside repair is raised and needs a response.',
    audience: 'staff',
  },
  {
    id: 'sos_confirmed',
    label: 'SOS price confirmed',
    description: 'The rider accepts an SOS quote — set off now.',
    audience: 'staff',
  },
  {
    id: 'new_member',
    label: 'New member signs up',
    description: 'A customer creates a loyalty account.',
    audience: 'both',
  },
  {
    id: 'stamp_milestone',
    label: 'Stamp card completed',
    description: 'A member fills a 10-stamp card and earns a reward.',
    audience: 'both',
  },
  {
    id: 'reward_ready',
    label: 'Reward ready to redeem',
    description: 'A member has a reward waiting to be claimed.',
    audience: 'customer',
  },
  {
    id: 'bike_added',
    label: 'Bike added to a garage',
    description: 'A bike is registered to a member (from any surface).',
    audience: 'both',
  },
  {
    id: 'voucher_earned',
    label: 'Service voucher issued',
    description: 'A member earns or is issued a service voucher.',
    audience: 'both',
  },
  {
    id: 'prize_won',
    label: 'Prize draw won',
    description: 'A member is drawn as a winner in a prize draw.',
    audience: 'both',
  },
];

export const NOTIFICATION_EVENT_IDS: NotificationEventId[] = NOTIFICATION_EVENTS.map((e) => e.id);

export function notificationEventMeta(id: NotificationEventId): NotificationEventMeta | undefined {
  return NOTIFICATION_EVENTS.find((e) => e.id === id);
}

/**
 * Defaults. High-urgency staff events get every channel; noisier or
 * customer-facing events default to the in-app bell only so the workshop can
 * opt in to email/push without being spammed on day one.
 */
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  new_booking: { visual: true, email: true, push: true },
  sos_request: { visual: true, email: true, push: true },
  sos_confirmed: { visual: true, email: true, push: true },
  new_member: { visual: true, email: false, push: false },
  stamp_milestone: { visual: true, email: false, push: false },
  reward_ready: { visual: true, email: false, push: false },
  bike_added: { visual: true, email: false, push: false },
  voucher_earned: { visual: true, email: false, push: false },
  prize_won: { visual: true, email: false, push: false },
};

export function defaultChannels(id: NotificationEventId): NotificationChannels {
  return { ...(DEFAULT_NOTIFICATION_PREFERENCES[id] || { visual: true, email: false, push: false }) };
}

const isChannelObject = (v: any): v is Partial<NotificationChannels> =>
  v && typeof v === 'object' && ('visual' in v || 'email' in v || 'push' in v);

/**
 * Merge a stored (possibly partial, possibly stale) preferences blob over the
 * defaults. Unknown event ids are dropped and missing channels fall back to the
 * default, so a row written by an older build still resolves to a full matrix.
 */
export function resolveNotificationPreferences(raw: unknown): NotificationPreferences {
  const out = {} as NotificationPreferences;
  const source = isChannelObject(raw) || typeof raw !== 'object' || raw === null ? {} : (raw as Record<string, any>);
  for (const id of NOTIFICATION_EVENT_IDS) {
    const base = defaultChannels(id);
    const stored = source[id];
    if (isChannelObject(stored)) {
      out[id] = {
        visual: typeof stored.visual === 'boolean' ? stored.visual : base.visual,
        email: typeof stored.email === 'boolean' ? stored.email : base.email,
        push: typeof stored.push === 'boolean' ? stored.push : base.push,
      };
    } else {
      out[id] = base;
    }
  }
  return out;
}

export function channelsFor(prefs: NotificationPreferences, id: NotificationEventId): NotificationChannels {
  return prefs[id] || defaultChannels(id);
}

/** True when the event would send nothing at all (fully muted). */
export function isEventMuted(prefs: NotificationPreferences, id: NotificationEventId): boolean {
  const c = channelsFor(prefs, id);
  return !c.visual && !c.email && !c.push;
}

/** Human summary for a row of the settings matrix, e.g. "Visual + Push". */
export function describeChannels(c: NotificationChannels): string {
  const parts: string[] = [];
  if (c.visual) parts.push('Visual');
  if (c.email) parts.push('Email');
  if (c.push) parts.push('Push');
  return parts.length ? parts.join(' + ') : 'Muted';
}

/** Immutably flip one channel of one event, returning a fresh matrix. */
export function setChannel(
  prefs: NotificationPreferences,
  id: NotificationEventId,
  channel: keyof NotificationChannels,
  value: boolean
): NotificationPreferences {
  return {
    ...prefs,
    [id]: { ...channelsFor(prefs, id), [channel]: value },
  };
}

/** Turn every channel of one event on or off at once. */
export function setEventEnabled(
  prefs: NotificationPreferences,
  id: NotificationEventId,
  enabled: boolean
): NotificationPreferences {
  return {
    ...prefs,
    [id]: { visual: enabled, email: enabled, push: enabled },
  };
}

/** Only the events that actually fire at least one channel. */
export function enabledEvents(prefs: NotificationPreferences): NotificationEventId[] {
  return NOTIFICATION_EVENT_IDS.filter((id) => !isEventMuted(prefs, id));
}
