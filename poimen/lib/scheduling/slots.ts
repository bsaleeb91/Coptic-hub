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
  const h24 = Math.floor(m / 60);
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

// Generate the open slots the given rules produce over the next `days` days,
// minus past times and anything overlapping a busy range.
export function generateOpenSlots(
  rules: AvailabilityRule[],
  types: ApptType[],
  busy: BusyRange[],
  opts: { days?: number; now?: Date } = {},
): OpenSlot[] {
  const days = opts.days ?? SCHEDULE_HORIZON_DAYS;
  const now = opts.now ?? new Date();
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

    for (const rule of rules) {
      if (!rule.active || rule.weekday !== weekday) continue;
      const type = typeById.get(rule.type_id);
      if (!type) continue;

      for (let m = rule.start_minute; m + type.duration_minutes <= rule.end_minute; m += type.duration_minutes) {
        const start = new Date(day);
        start.setHours(0, m, 0, 0);
        const startMs = start.getTime();
        const endMs = startMs + type.duration_minutes * 60000;
        if (startMs <= now.getTime()) continue;
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
