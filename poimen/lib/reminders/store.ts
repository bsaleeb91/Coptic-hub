// lib/reminders/store.ts
// Reminder preferences — which reminders are on, and at what time of day.
//
// Local only, on purpose. A reminder is a fact about someone's phone, not about
// their spiritual life: it says nothing a Father of Confession, a servant or an
// admin has any business reading, and storing it server-side would make a new
// row of behavioural data out of a convenience setting. Storing it on the
// device also means the setting survives being offline, which is the state the
// scheduler most often runs in.
//
// Scoped per user (lib/storage.ts) rather than per device, alongside the canon
// and psalm data a reminder is built from: on a shared phone, a father's
// evening canon reminder is not his daughter's.
//
// Both reminders default to OFF. Notifications are the one part of the app that
// speaks without being opened, so they are opted into deliberately — the same
// posture the leaderboard and vitals sharing take.

import { userStorage as AsyncStorage } from '@/lib/storage';

export type ReminderKind = 'canon' | 'psalms';

export interface ReminderSetting {
  enabled: boolean;
  hour: number;    // 0–23, local time
  minute: number;  // 0 or 30 in practice; any value is respected
}

export type ReminderSettings = Record<ReminderKind, ReminderSetting>;

// Evening for the canon: the rule is reviewed against a day that has mostly
// happened, and Compline is prayed at its end. Late afternoon for psalms, which
// is when a child is home from school and before the evening gets busy.
export const DEFAULT_SETTINGS: ReminderSettings = {
  canon:  { enabled: false, hour: 20, minute: 0 },
  psalms: { enabled: false, hour: 17, minute: 0 },
};

const KEY = 'poimen.reminders.settings';

export async function loadReminderSettings(): Promise<ReminderSettings> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<ReminderSettings>;
    // Merged field by field rather than spread wholesale: a settings blob
    // written by an older build may be missing a kind added since, and a
    // half-formed object here would schedule a notification at NaN o'clock.
    return {
      canon:  coerce(parsed.canon,  DEFAULT_SETTINGS.canon),
      psalms: coerce(parsed.psalms, DEFAULT_SETTINGS.psalms),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveReminderSettings(settings: ReminderSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // A failed write means the reminder reverts to its previous time on next
    // launch. Not worth surfacing an error for, and never worth throwing into
    // the settings screen's save path.
  }
}

function coerce(value: Partial<ReminderSetting> | undefined, fallback: ReminderSetting): ReminderSetting {
  if (!value) return fallback;
  const hour = Number(value.hour);
  const minute = Number(value.minute);
  return {
    enabled: value.enabled === true,
    hour:   Number.isInteger(hour)   && hour   >= 0 && hour   <= 23 ? hour   : fallback.hour,
    minute: Number.isInteger(minute) && minute >= 0 && minute <= 59 ? minute : fallback.minute,
  };
}
