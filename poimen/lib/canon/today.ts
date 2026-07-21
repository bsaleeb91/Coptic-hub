// lib/canon/today.ts
// Builds the list of personal-canon items due on a given date, from the
// RuleConfig for that weekday plus the automatic Coptic fasting rules. Shared
// by the rule editor screen and the Canon tab's "My Spiritual Canon" list.

import { RuleConfig, ReadMode, AGPEYA_HOURS, SERVICES } from './rule-store';
import { isFastDay, prostrationsAllowed } from './fasting';
import { localDateStr } from './postpone';

// `freq` is set only on Heart of Service items — it drives which postpone
// options (if any) the Canon tab offers.
export interface RuleItem { key: string; label: string; icon: string; freq?: string; }

// Item icons are semantic keys; the Canon tab maps them to the gold line
// icons in components/ui/TabIcons.tsx (book, candle, praying hands, church,
// cross, heart).
const ICON_READING = 'reading';
const ICON_QUIET = 'quiet';
const ICON_PRAYER = 'prayer';
const ICON_CHURCH = 'church';
const ICON_FAST = 'fast';
const ICON_SERVE = 'serve';

// When a Heart of Service commitment is next due after being completed. The
// cadence anchors to the last completion, so a service keeps showing on its
// weekday until it's checked off, then rests for its frequency period.
function nextDueAfter(freq: string, lastDone: Date): Date {
  const next = new Date(lastDone);
  if (freq === 'Every 2 weeks') next.setDate(next.getDate() + 14);
  else if (freq === 'Monthly') next.setMonth(next.getMonth() + 1);
  else if (freq === 'Every 2 months') next.setMonth(next.getMonth() + 2);
  else if (freq === 'Quarterly') next.setMonth(next.getMonth() + 3);
  else if (freq === 'Twice a year') next.setMonth(next.getMonth() + 6); // legacy saves
  return next; // Weekly: due again immediately (every occurrence of its weekday)
}

const hourName = (k: string) => AGPEYA_HOURS.find(h => h.key === k)?.name ?? k;
const serviceName = (k: string) => SERVICES.find(s => s.key === k)?.name ?? k;
const readLabel = (mode: ReadMode, n: number) => `${n} ${mode === 'chapters' ? (n === 1 ? 'chapter' : 'chapters') : 'min'}`;

// `postponed` (from loadPostponements) maps a serving item's key to the local
// date it returns — it is hidden until then. `serviceDone` (loadServiceDone)
// maps the key to its last completion date; a non-weekly service done within
// its period is hidden (except on the completion day itself, so the checked
// row stays visible).

// Whether a priest-assigned custom component is due on `date`. Daily (or no
// weekday selection) means every day; otherwise only its chosen weekdays.
// Frequencies longer than weekly rest for their period after being checked
// off, exactly like Heart of Service commitments.
export function customDueToday(
  frequency: string,
  days: number[] | null | undefined,
  date: Date,
  serviceDone?: Record<string, string>,
  key?: string,
  postponed?: Record<string, string>,
): boolean {
  const dayList = days ?? [];
  if (frequency !== 'Daily' && dayList.length > 0 && !dayList.includes(date.getDay())) return false;
  const todayStr = localDateStr(date);
  if (key) {
    const until = postponed?.[key];
    if (until && todayStr < until) return false;
    if (serviceDone && frequency !== 'Daily' && frequency !== 'Weekly') {
      const last = serviceDone[key];
      if (last && last !== todayStr) {
        const next = nextDueAfter(frequency, new Date(`${last}T12:00:00`));
        if (todayStr < localDateStr(next)) return false;
      }
    }
  }
  return true;
}

export function todayItems(
  rule: RuleConfig,
  date: Date,
  postponed?: Record<string, string>,
  serviceDone?: Record<string, string>,
): RuleItem[] {
  const d = rule.days[date.getDay()];
  const items: RuleItem[] = [];
  for (const h of d.hours) items.push({ key: `hour_${h}`, label: `Pray the ${hourName(h)}`, icon: ICON_PRAYER });
  for (const sv of d.services) items.push({ key: `svc_${sv}`, label: `Attend ${serviceName(sv)}`, icon: ICON_CHURCH });
  d.serving.forEach((sv, i) => {
    if (!sv.text.trim()) return;
    // Weekday-scoped key so postponements can't collide across days.
    const key = `serve_${date.getDay()}_${i}`;
    const todayStr = localDateStr(date);
    const until = postponed?.[key];
    if (until && todayStr < until) return;
    const last = serviceDone?.[key];
    if (last && last !== todayStr && sv.freq !== 'Weekly') {
      const next = nextDueAfter(sv.freq, new Date(`${last}T12:00:00`));
      if (todayStr < localDateStr(next)) return; // rested — done within its period
    }
    items.push({ key, label: sv.text.trim(), icon: ICON_SERVE, freq: sv.freq });
  });
  if (isFastDay(date)) items.push({ key: 'fast', label: `Fast — abstain from food until ${rule.fastUntil}`, icon: ICON_FAST });
  if (rule.prostrations > 0 && prostrationsAllowed(date)) items.push({ key: 'prostrations', label: `${rule.prostrations} prostrations (metanias)`, icon: ICON_PRAYER });
  if (rule.quietMinutes > 0) items.push({ key: 'quiet', label: `${rule.quietMinutes} min of quiet time`, icon: ICON_QUIET });
  if (rule.bible.amount > 0) items.push({ key: 'bible', label: `Bible reading — ${readLabel(rule.bible.mode, rule.bible.amount)}`, icon: ICON_READING });
  if (rule.book && rule.book.amount > 0) items.push({ key: 'book', label: `${rule.book.title || 'Spiritual book'} — ${readLabel(rule.book.mode, rule.book.amount)}`, icon: ICON_READING });
  return items;
}
