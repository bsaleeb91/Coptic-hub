// lib/scheduling/calendar-sync.ts
// Keeps Calendly (and anything else that reads the priest's calendar) in step
// with Nepsis bookings.
//
// Calendly's API cannot block time — busy times are read-only — so Nepsis
// never talks to Calendly. What Calendly DOES do, on every plan, is hide any
// slot that collides with an event on the calendar it is connected to. So the
// bridge is the priest's own calendar: confirmed Nepsis appointments are
// written into a device calendar he picks — the same Google/iCloud/Outlook
// calendar his Calendly checks for conflicts — and Calendly closes those times
// by itself. No Calendly credentials, no backend, works on the free plan.
//
// Everything here runs on the PRIEST's device (confirming is his action), and
// state is per-account device storage: the chosen calendar id only means
// something on this phone, and the appointment→event map lets a cancellation
// take its event back out. reconcile() is self-healing — run on every Schedule
// load, it adds events any earlier attempt missed, re-adds ones deleted by
// hand on the calendar, and removes events whose appointment has since been
// cancelled or declined. Only FUTURE times matter: past events are history and
// are neither written, deleted, nor tracked.

import { Platform } from 'react-native';
import { userStorage as AsyncStorage } from '@/lib/storage';
import type { Appointment } from '@/lib/db';

const KEY = 'poimen.calendarSync';

// expo-calendar has no web implementation, so it is only ever require()d
// behind this check — a top-level import could throw at bundle-eval time in a
// browser, taking the whole Schedule screen down with it.
export const calendarSyncSupported = Platform.OS !== 'web';

function native(): typeof import('expo-calendar') | null {
  if (!calendarSyncSupported) return null;
  try { return require('expo-calendar'); } catch { return null; }
}

// Every writer of the stored state runs through this chain. reconcile and
// chooseCalendar are read-modify-write over the same map and are fired from
// several places at once (screen load, confirming a request, picking a
// calendar) — unserialized, two overlapping runs would each see an
// appointment as untracked, write TWO calendar events for it, and keep only
// one id, leaving an orphan block on the calendar that nothing ever removes.
let chain: Promise<unknown> = Promise.resolve();
function serialized<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.catch(() => {});
  return run;
}

export interface TrackedEvent {
  eventId: string;
  startsAt: string;   // ISO — lets reconcile leave past history alone
}

export interface CalendarSyncState {
  calendarId: string | null;
  calendarTitle: string | null;
  // Which calendar the tracked events actually live on. Kept separately from
  // calendarId so switching calendars knows there is something to migrate —
  // and so turning sync off and back on to the SAME calendar doesn't rewrite
  // everything.
  eventsCalendarId: string | null;
  events: Record<string, TrackedEvent>;   // appointment id → device event
}

export async function loadSyncState(): Promise<CalendarSyncState> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const p = raw ? JSON.parse(raw) : {};
    return {
      calendarId: typeof p?.calendarId === 'string' ? p.calendarId : null,
      calendarTitle: typeof p?.calendarTitle === 'string' ? p.calendarTitle : null,
      eventsCalendarId: typeof p?.eventsCalendarId === 'string' ? p.eventsCalendarId : null,
      events: p?.events && typeof p.events === 'object' ? p.events : {},
    };
  } catch { return { calendarId: null, calendarTitle: null, eventsCalendarId: null, events: {} }; }
}

async function saveSyncState(state: CalendarSyncState): Promise<void> {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(state)); } catch {}
}

export interface WritableCalendar { id: string; title: string; source: string }

// The calendars an event can actually be written to.
//   'denied'  — the calendar permission was refused
//   'error'   — the device's calendars couldn't be read at all
export async function listWritableCalendars(): Promise<WritableCalendar[] | 'denied' | 'error'> {
  const Calendar = native();
  if (!Calendar) return 'error';
  try {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    if (status !== 'granted') return 'denied';
    const cals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    return cals
      .filter(c => c.allowsModifications)
      .map(c => ({ id: c.id, title: c.title, source: c.source?.name ?? '' }));
  } catch { return 'error'; }
}

// Point sync at a calendar (or null = off). Switching to a DIFFERENT calendar
// migrates: the future events written to the old one are deleted and the map
// cleared, so the next reconcile rebuilds them on the new calendar — otherwise
// the bookings would sit on a calendar Calendly no longer checks, every one of
// those times bookable twice. Turning off deletes nothing: the events are real
// commitments, and re-enabling the same calendar resumes tracking them.
export function chooseCalendar(cal: WritableCalendar | null): Promise<void> {
  return serialized(async () => {
    const state = await loadSyncState();
    if (cal && state.eventsCalendarId && state.eventsCalendarId !== cal.id) {
      const Calendar = native();
      for (const [apptId, tracked] of Object.entries(state.events)) {
        if (new Date(tracked.startsAt).getTime() <= Date.now()) continue;  // history stays put
        try { await Calendar?.deleteEventAsync(tracked.eventId); } catch {}
        delete state.events[apptId];
      }
      state.eventsCalendarId = null;
    }
    state.calendarId = cal?.id ?? null;
    state.calendarTitle = cal?.title ?? null;
    await saveSyncState(state);
  });
}

export interface ReconcileResult {
  added: number;
  removed: number;
  // Writes that failed (calendar gone, account signed out…). Surfaced so the
  // card can warn — a silently failing sync that still says it is on would
  // hand Calendly exactly the double-bookings this feature exists to prevent.
  failed: number;
  permissionLost: boolean;
}

// Bring the chosen calendar in line with the appointment list:
//   • confirmed FUTURE appointment, no event (or its event was deleted by
//     hand on the calendar) → write one
//   • tracked event whose appointment is no longer confirmed → remove it
//   • tracked event whose appointment is gone entirely → remove it only if
//     still in the future (a hard-deleted booking); past events stay
//   • tracked entries whose time has passed → dropped from the map (the
//     events themselves stay), so the map never grows without bound.
// Returns what happened, or null when sync is off/unavailable.
export function reconcileCalendar(
  appts: Appointment[],
  memberName: (id: string) => string,
): Promise<ReconcileResult | null> {
  return serialized(() => doReconcile(appts, memberName));
}

async function doReconcile(
  appts: Appointment[],
  memberName: (id: string) => string,
): Promise<ReconcileResult | null> {
  const Calendar = native();
  if (!Calendar) return null;
  const state = await loadSyncState();
  if (!state.calendarId) return null;

  const res: ReconcileResult = { added: 0, removed: 0, failed: 0, permissionLost: false };

  // Permission can be revoked in Settings at any time; report it rather than
  // silently doing nothing under a card that says sync is on.
  try {
    const { status } = await Calendar.getCalendarPermissionsAsync();
    if (status !== 'granted') { res.permissionLost = true; return res; }
  } catch { res.permissionLost = true; return res; }

  const now = Date.now();
  const byId = new Map(appts.map(a => [a.id, a]));
  let changed = false;

  // "Absent from the list" only means hard-deleted when there IS a list. A
  // failed query comes through as [] — treating that as "everything was
  // deleted" would strip every future booking off the calendar and reopen
  // those times on Calendly until the next successful load.
  const listTrustworthy = appts.length > 0;

  // Remove first: a cancelled slot should reopen on Calendly even if adding
  // something else fails halfway.
  for (const [apptId, tracked] of Object.entries(state.events)) {
    const past = new Date(tracked.startsAt).getTime() <= now;
    if (past) { delete state.events[apptId]; changed = true; continue; }  // untrack history
    const a = byId.get(apptId);
    const keepEvent = a ? a.status === 'confirmed' : !listTrustworthy;
    if (keepEvent) continue;
    try { await Calendar.deleteEventAsync(tracked.eventId); } catch {}
    delete state.events[apptId];
    res.removed++; changed = true;
  }

  for (const a of appts) {
    if (a.status !== 'confirmed') continue;
    const start = new Date(a.starts_at);
    // Future times only — a past booking can't affect Calendly, and turning
    // sync on after a year of Nepsis use must not dump that whole year of
    // history onto the priest's calendar.
    if (isNaN(start.getTime()) || start.getTime() <= now) continue;
    const tracked = state.events[a.id];
    if (tracked) {
      // Trust the map only as far as the calendar agrees: an event deleted by
      // hand on the calendar leaves the time open on Calendly, so it is
      // re-created rather than assumed present.
      try {
        const ev = await Calendar.getEventAsync(tracked.eventId);
        if (ev) continue;
      } catch {}
      delete state.events[a.id];
      changed = true;
    }
    try {
      const eventId = await Calendar.createEventAsync(state.calendarId, {
        title: `${a.type_label} — ${memberName(a.congregant_id)}`,
        startDate: start,
        endDate: new Date(start.getTime() + a.duration_minutes * 60_000),
        notes: 'Booked through Poimen. This event blocks the time on Calendly and anywhere else that reads this calendar.',
      });
      state.events[a.id] = { eventId, startsAt: a.starts_at };
      state.eventsCalendarId = state.calendarId;
      res.added++; changed = true;
    } catch {
      // Calendar rejected the write (deleted calendar, account signed out…) —
      // counted so the card can warn; the next reconcile retries.
      res.failed++;
    }
  }

  if (changed) await saveSyncState(state);
  return res;
}
