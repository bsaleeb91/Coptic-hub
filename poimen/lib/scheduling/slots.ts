// lib/scheduling/slots.ts
// Pure helpers for the appointment scheduler. The priest's availability lives
// in the cloud as recurring weekly rules (weekday + start/end minute + type);
// the concrete bookable slots are generated here on the client for the next
// few weeks, then the ones that collide with an already-taken time (an
// anonymized "busy range" from the server) or that lie in the past are dropped.

export interface ApptType {
  id: string;
  label: string;
  duration_minutes: number;
  active: boolean;
  sort: number;
}

export interface AvailabilityRule {
  id: string;
  type_id: string;
  weekday: number;       // 0 = Sunday … 6 = Saturday
  start_minute: number;  // minutes past local midnight
  end_minute: number;
  active: boolean;
}

export interface BusyRange {
  starts_at: string;     // ISO
  duration_minutes: number;
}

// A one-off change to a single date. 'block' is subtracted from what the
// recurring rules produce (null minutes = the whole day); 'open' is an extra
// window added on top, which must name its appointment type. `kind` is optional
// so older callers and rows default to a closure.
export interface DateException {
  on_date: string;               // local YYYY-MM-DD
  start_minute: number | null;
  end_minute: number | null;
  kind?: 'block' | 'open';
  type_id?: string | null;
}

export const exceptionKind = (e: DateException): 'block' | 'open' => e.kind ?? 'block';

export interface OpenSlot {
  start: Date;
  typeId: string;
  typeLabel: string;
  duration: number;      // minutes
}

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// How far ahead a congregant can book. A priest's rules recur weekly and never
// expire, so this is purely how much of that recurrence we materialize — a full
// year, browsed a month at a time (see groupDaysByMonth).
export const SCHEDULE_HORIZON_DAYS = 365;

// Identifies the priest's "visitation" type among his own labels ("Home
// Visitation", "Pastoral Visit", …). Shared so the home screen's link and the
// Appointments filter can't drift apart.
export const VISIT_TYPE_KEYWORD = 'visit';

// Minutes-past-midnight → "2:00 PM".
export function formatMinute(m: number): string {
  // 1440 is the END of the day, and only ever appears as the end of a window.
  // Naming it keeps it apart from 0, which formats identically as "12:00 AM" —
  // otherwise a whole-day window reads "12:00 AM – 12:00 AM", which looks like
  // no window at all.
  if (m >= 1440) return 'midnight';
  // % 24 so anything past the last hour still reads sensibly rather than
  // wrapping into a "12:00 PM" that is indistinguishable from noon.
  const h24 = Math.floor(m / 60) % 24;
  const min = m % 60;
  const ampm = h24 < 12 ? 'AM' : 'PM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(min).padStart(2, '0')} ${ampm}`;
}

export function formatMinuteRange(start: number, end: number): string {
  return `${formatMinute(start)} – ${formatMinute(end)}`;
}

// A Date → "2:00 PM".
export function formatTime(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

// A Date → "Sun, Jul 26", or "Sun, Jan 3, 2027" once it crosses into another
// year — with a year-long booking horizon a bare "Sun, Jan 3" is ambiguous.
// Pass { year: false } where a heading already gives the year.
export function formatDayLabel(d: Date, opts: { year?: boolean } = {}): string {
  const showYear = opts.year ?? (d.getFullYear() !== new Date().getFullYear());
  return d.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    ...(showYear ? { year: 'numeric' as const } : {}),
  });
}

const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number) =>
  aStart < bEnd && bStart < aEnd;

// Local (not UTC) YYYY-MM-DD — an exception is pinned to the priest's calendar
// day, so it has to be keyed the same way the day loop below counts days.
export function dateKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// The closures that apply on `date`. A whole-day closure is returned as the
// full 0–1440 window so callers can treat every closure the same way.
export function closuresOn(exceptions: DateException[], date: Date): { start: number; end: number }[] {
  const key = dateKey(date);
  return exceptions
    .filter(e => e.on_date === key && exceptionKind(e) === 'block')
    .map(e => e.start_minute == null || e.end_minute == null
      ? { start: 0, end: 1440 }
      : { start: e.start_minute, end: e.end_minute });
}

// Extra one-off windows on `date` — hours the weekly pattern doesn't offer.
export function extraWindowsOn(exceptions: DateException[], date: Date): DateException[] {
  const key = dateKey(date);
  return exceptions.filter(e =>
    e.on_date === key && exceptionKind(e) === 'open'
    && e.type_id != null && e.start_minute != null && e.end_minute != null);
}

export const isClosedAllDay = (exceptions: DateException[], date: Date): boolean =>
  closuresOn(exceptions, date).some(c => c.start <= 0 && c.end >= 1440);

// Generate the open slots the given rules produce over the next `days` days,
// minus past times and anything overlapping a busy range.
export function generateOpenSlots(
  rules: AvailabilityRule[],
  types: ApptType[],
  busy: BusyRange[],
  opts: { days?: number; now?: Date; exceptions?: DateException[] } = {},
): OpenSlot[] {
  const days = opts.days ?? SCHEDULE_HORIZON_DAYS;
  const now = opts.now ?? new Date();
  const exceptions = opts.exceptions ?? [];
  const typeById = new Map(types.filter(t => t.active).map(t => [t.id, t]));
  const busyRanges = busy.map(b => {
    const s = new Date(b.starts_at).getTime();
    return [s, s + b.duration_minutes * 60000] as const;
  });

  const out: OpenSlot[] = [];
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // local midnight today

  for (let offset = 0; offset < days; offset++) {
    const day = new Date(base);
    day.setDate(base.getDate() + offset);
    const weekday = day.getDay();

    // One-off closures for this date — travelling, a funeral, anything that
    // isn't a change to the weekly pattern.
    const closed = closuresOn(exceptions, day);
    if (closed.some(c => c.start <= 0 && c.end >= 1440)) continue;

    // What this date offers: the weekly pattern, plus any extra hours opened on
    // this date alone. Both are then filtered identically — a closure, a past
    // time or a taken slot removes an extra hour just as it would a regular one.
    const windows: { type_id: string; start_minute: number; end_minute: number }[] = [
      ...rules
        .filter(r => r.active && r.weekday === weekday)
        .map(r => ({ type_id: r.type_id, start_minute: r.start_minute, end_minute: r.end_minute })),
      ...extraWindowsOn(exceptions, day)
        .map(e => ({ type_id: e.type_id as string, start_minute: e.start_minute as number, end_minute: e.end_minute as number })),
    ];

    for (const rule of windows) {
      const type = typeById.get(rule.type_id);
      if (!type) continue;

      for (let m = rule.start_minute; m + type.duration_minutes <= rule.end_minute; m += type.duration_minutes) {
        const start = new Date(day);
        start.setHours(0, m, 0, 0);
        const startMs = start.getTime();
        const endMs = startMs + type.duration_minutes * 60000;
        if (startMs <= now.getTime()) continue;
        // A partial closure removes any slot it touches, even partly — half an
        // appointment inside the priest's absence is no good to either party.
        // Measured from the slot's real wall-clock time, not the rule's nominal
        // `m`: on the spring-forward day setHours normalizes a minute inside the
        // skipped hour onto the next one, so an `m` outside the closure can
        // still land inside it.
        const slotMin = start.getHours() * 60 + start.getMinutes();
        if (closed.some(c => overlaps(slotMin, slotMin + type.duration_minutes, c.start, c.end))) continue;
        if (busyRanges.some(([bs, be]) => overlaps(startMs, endMs, bs, be))) continue;
        out.push({ start, typeId: type.id, typeLabel: type.label, duration: type.duration_minutes });
      }
    }
  }

  out.sort((a, b) => a.start.getTime() - b.start.getTime());

  // setHours above works in local wall-clock, and on the spring-forward day the
  // skipped hour has no local representation — every minute inside it
  // normalizes onto the next hour, so two different `m` values land on the same
  // instant and the day would show a duplicate tile that can't be booked twice.
  // (Once a year per timezone, now that the horizon is a full year.) Keying on
  // the type too keeps genuinely different types offered at the same time.
  const seen = new Set<string>();
  return out.filter(s => {
    const key = `${s.typeId}@${s.start.getTime()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export interface DayGroup { key: string; label: string; date: Date; slots: OpenSlot[]; }
export interface MonthGroup { key: string; label: string; date: Date; days: DayGroup[]; }

// Group open slots by calendar day for sectioned rendering.
export function groupSlotsByDay(slots: OpenSlot[]): DayGroup[] {
  const groups = new Map<string, DayGroup>();
  for (const s of slots) {
    const key = `${s.start.getFullYear()}-${s.start.getMonth()}-${s.start.getDate()}`;
    let g = groups.get(key);
    if (!g) {
      const dayStart = new Date(s.start.getFullYear(), s.start.getMonth(), s.start.getDate());
      g = { key, label: formatDayLabel(s.start, { year: false }), date: dayStart, slots: [] };
      groups.set(key, g);
    }
    g.slots.push(s);
  }
  return [...groups.values()].sort((a, b) => a.date.getTime() - b.date.getTime());
}

// A month laid out as calendar cells: leading nulls pad the first row so the
// 1st lands under its weekday. Used by the priest's year-ahead availability
// calendar.
export function monthCells(year: number, month: number): (Date | null)[] {
  const pad = new Date(year, month, 1).getDay();
  const count = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = Array.from({ length: pad }, () => null);
  for (let d = 1; d <= count; d++) cells.push(new Date(year, month, d));
  return cells;
}

// Roll the day groups up into months. A year of availability is far too much to
// put on screen at once, so the screen shows the first month's days and offers
// the rest as headers you can open.
export function groupDaysByMonth(days: DayGroup[]): MonthGroup[] {
  const groups = new Map<string, MonthGroup>();
  for (const d of days) {
    const key = `${d.date.getFullYear()}-${d.date.getMonth()}`;
    let g = groups.get(key);
    if (!g) {
      g = {
        key,
        label: d.date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        date: new Date(d.date.getFullYear(), d.date.getMonth(), 1),
        days: [],
      };
      groups.set(key, g);
    }
    g.days.push(d);
  }
  return [...groups.values()].sort((a, b) => a.date.getTime() - b.date.getTime());
}
