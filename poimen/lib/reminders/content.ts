// lib/reminders/content.ts
// What a reminder says on a given day.
//
// A reminder that reads "Don't forget your canon!" every evening is noise, and
// noise gets notifications switched off — or, worse, ignored while staying on,
// which is the same thing with extra guilt attached. So each day's reminder is
// built from that day's actual rule and that day's actual review queue, names
// one or two real items, and is NOT SCHEDULED AT ALL on a day with nothing due.
// Silence on an empty day is a feature: it is what makes the reminder mean
// something on a full one.
//
// Everything here reads from the same local stores the Canon and Psalms tabs
// read, so it is accurate offline and costs nothing to compute.

import { loadRule } from '@/lib/canon/rule-store';
import { todayItems, customDueToday, RuleItem } from '@/lib/canon/today';
import { loadPostponements, loadServiceDone, localDateStr } from '@/lib/canon/postpone';
import { loadChecks } from '@/lib/canon/checks';
import { loadAssignedForMember, applyOverlay } from '@/lib/canon/assigned';
import { lastConfessionDate } from '@/lib/confession/dates';
import { loadSelection, loadCards, loadStreak, isFullyMature, cardId, PartCard } from '@/lib/psalms/store';
import { itemUnitCount, itemLabel } from '@/lib/psalms/psalter';
import { cleanLabel, describeItems } from './phrasing';

export interface ReminderContent {
  title: string;
  body: string;
}

// ─── Canon ───────────────────────────────────────────────────────────────────

// The Canon tab's own load path (app/(tabs)/canon.tsx) does more than this:
// weekly service targets, ad-hoc attendance, locked-category badges, communion
// readiness. None of that changes how MANY items stand on a given day, which is
// all a reminder needs, so this deliberately stays the cheap subset rather than
// a second copy of a 100-line function that would drift from the original.
async function canonItemsOn(date: Date, userId: string | null, demoMode: boolean, focId: string | null): Promise<RuleItem[]> {
  const rule = await loadRule();

  // A Father of Confession's assignments overlay the member's own rule. This
  // may reach the network; offline, the member's own rule is still the right
  // answer, so a failure falls through to it rather than skipping the reminder.
  let overlayRule = rule;
  let custom: { id: string; text: string; frequency: string; days: number[] | null }[] = [];
  try {
    const [assigned, last] = await Promise.all([
      loadAssignedForMember(userId ?? '', demoMode, focId),
      lastConfessionDate(),
    ]);
    const overlay = applyOverlay(rule, assigned, last);
    overlayRule = overlay.rule;
    custom = overlay.customComponents.map(c => ({ id: c.id, text: c.text, frequency: c.frequency, days: c.days }));
  } catch {
    // Keep `overlayRule` as the member's own rule.
  }

  const [postponed, serviceDone] = await Promise.all([loadPostponements(), loadServiceDone()]);
  const structured = todayItems(overlayRule, date, postponed, serviceDone);
  const customItems: RuleItem[] = custom
    .filter(c => customDueToday(c.frequency, c.days, date, serviceDone, `assigned_${c.id}`, postponed))
    .map(c => ({ key: `assigned_${c.id}`, label: c.text, icon: 'quiet' }));

  return [...structured, ...customItems];
}

export async function canonReminder(
  date: Date,
  opts: { userId: string | null; demoMode: boolean; focId: string | null },
): Promise<ReminderContent | null> {
  const items = await canonItemsOn(date, opts.userId, opts.demoMode, opts.focId);
  if (items.length === 0) return null;   // a day the rule asks nothing of

  // Already-checked items are dropped, so a reminder never asks for something
  // that is done. This only bites on the day being scheduled from — a future
  // day has no checks yet — which is exactly the case that matters, because it
  // is what stops a reminder firing three hours after the canon was finished.
  const checks = await loadChecks(date);
  const remaining = items.filter(it => !checks.has(`rule_${it.key}`));
  if (remaining.length === 0) return null;

  return {
    title: remaining.length === items.length ? 'Your canon today' : 'The rest of your canon',
    body: describeItems(remaining.map(it => cleanLabel(it.label))),
  };
}

// ─── Psalms ──────────────────────────────────────────────────────────────────

// A card is due on `date` when its scheduled day has arrived by then. Matches
// isDue() in lib/psalms/store.ts, but against an arbitrary day so the rolling
// window can be built a week ahead rather than only for today.
function dueOn(card: PartCard, dateStr: string): boolean {
  return card.due <= dateStr;
}

export async function psalmsReminder(date: Date): Promise<ReminderContent | null> {
  const [selection, cards, streak] = await Promise.all([loadSelection(), loadCards(), loadStreak()]);
  if (selection.length === 0) return null;   // nothing chosen to memorize yet

  const dateStr = localDateStr(date);
  let due = 0;
  let unlearned = 0;
  const dueItems: string[] = [];

  for (const item of selection) {
    if (isFullyMature(item, cards)) continue;
    let itemDue = 0;
    for (let part = 0; part < itemUnitCount(item); part++) {
      const card = cards[cardId(item, part)];
      if (!card) { unlearned++; continue; }
      if (dueOn(card, dateStr)) itemDue++;
    }
    if (itemDue > 0) { due += itemDue; dueItems.push(itemLabel(item)); }
  }

  if (due === 0 && unlearned === 0) return null;   // caught up and nothing new

  // The streak is the reason to come back today rather than tomorrow, so it
  // leads whenever there is one to lose. `last` is the day a review was last
  // recorded — a streak already extended today needs no rescuing.
  const streakLive = streak.current > 0 && streak.last !== localDateStr(new Date());
  const title = streakLive ? `Keep your ${streak.current}-day streak` : 'Time for your psalms';

  let body: string;
  if (due > 0 && dueItems.length === 1) {
    body = `${due} ${plural(due, 'portion')} of ${dueItems[0]} ready to review.`;
  } else if (due > 0) {
    body = `${due} ${plural(due, 'portion')} ready to review across ${dueItems.length} passages.`;
  } else {
    // Deliberately not a count. `unlearned` totals every portion not yet seen
    // across the whole selection, while newQueue only ever serves them from
    // the one passage being learned — so a number here would overstate what
    // opening the tab actually offers.
    body = 'Nothing to review — a good day to learn a new portion.';
  }

  return { title, body };
}

const plural = (n: number, word: string) => (n === 1 ? word : `${word}s`);
