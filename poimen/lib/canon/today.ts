// lib/canon/today.ts
// Builds the list of personal-canon items due on a given date, from the
// RuleConfig for that weekday plus the automatic Coptic fasting rules. Shared
// by the rule editor screen and the Canon tab's "My Spiritual Canon" list.

import { RuleConfig, ReadMode, AGPEYA_HOURS, SERVICES } from './rule-store';
import { isFastDay, prostrationsAllowed } from './fasting';

export interface RuleItem { key: string; label: string; icon: string; }

// Item icons: 📖 readings (Bible & spiritual book) · 🕯 quiet time ·
// 🙏 Agpeya prayers & prostrations · ⛪ church services · ✝ fasting.
const ICON_READING = '📖';
const ICON_QUIET = '🕯';
const ICON_PRAYER = '🙏';
const ICON_CHURCH = '⛪';
const ICON_FAST = '✝';

const hourName = (k: string) => AGPEYA_HOURS.find(h => h.key === k)?.name ?? k;
const serviceName = (k: string) => SERVICES.find(s => s.key === k)?.name ?? k;
const readLabel = (mode: ReadMode, n: number) => `${n} ${mode === 'chapters' ? (n === 1 ? 'chapter' : 'chapters') : 'min'}`;

export function todayItems(rule: RuleConfig, date: Date): RuleItem[] {
  const d = rule.days[date.getDay()];
  const items: RuleItem[] = [];
  for (const h of d.hours) items.push({ key: `hour_${h}`, label: `Pray the ${hourName(h)}`, icon: ICON_PRAYER });
  for (const sv of d.services) items.push({ key: `svc_${sv}`, label: `Attend ${serviceName(sv)}`, icon: ICON_CHURCH });
  if (isFastDay(date)) items.push({ key: 'fast', label: `Fast — abstain from food until ${rule.fastUntil}`, icon: ICON_FAST });
  if (rule.prostrations > 0 && prostrationsAllowed(date)) items.push({ key: 'prostrations', label: `${rule.prostrations} prostrations (metanias)`, icon: ICON_PRAYER });
  if (rule.quietMinutes > 0) items.push({ key: 'quiet', label: `${rule.quietMinutes} min of quiet time`, icon: ICON_QUIET });
  if (rule.bible.amount > 0) items.push({ key: 'bible', label: `Bible reading — ${readLabel(rule.bible.mode, rule.bible.amount)}`, icon: ICON_READING });
  if (rule.book && rule.book.amount > 0) items.push({ key: 'book', label: `${rule.book.title || 'Spiritual book'} — ${readLabel(rule.book.mode, rule.book.amount)}`, icon: ICON_READING });
  return items;
}
