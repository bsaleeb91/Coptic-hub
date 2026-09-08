import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ScrollView, View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import * as H from '@/lib/haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { colors, fonts , lazyThemed } from '@/lib/theme';
import { Card } from '@/components/ui/Card';
import { PrivacyNote } from '@/components/ui/PrivacyNote';
import { DrawerMenuButton } from '@/components/ui/DrawerMenuButton';
import { useSession } from '@/lib/auth';
import * as db from '@/lib/db';
import { useDemoMode } from '@/lib/demo';
import { loadRule, WEEKDAYS, SERVICES } from '@/lib/canon/rule-store';
import {
  loadServiceLog, ensurePeriods, periodCounts, loggedOn, logAttendance, unlogLatest,
} from '@/lib/canon/service-log';
import { hydrateRuleFromCloud } from '@/lib/canon/rule-sync';
import { todayItems, customDueToday, RuleItem, weeklyServiceKey, isWeeklyServiceKey, serviceKeyOf } from '@/lib/canon/today';
import { isFastDay } from '@/lib/canon/fasting';
import { loadChecks, saveChecks, backfillDates, isSameDay } from '@/lib/canon/checks';
import { loadAttendance, logAttendanceOn, unlogAttendanceOn } from '@/lib/canon/attendance';
import { periodStart, periodNoun } from '@/lib/canon/periods';
import type { ServiceCount } from '@/lib/canon/rule-store';
import {
  postponeOptionsFor, PostponeOption, loadPostponements, postponeServiceItem,
  loadServiceDone, recordServiceDone, clearServiceDone, localDateStr,
} from '@/lib/canon/postpone';
import { recordCanonDay, finalizeWeeklyServices } from '@/lib/canon/history';
import { lastConfessionDate, daysSinceDate, confessionFrequencyDays } from '@/lib/confession/dates';
import { loadAssignedForMember, applyOverlay, categoryForItemKey } from '@/lib/canon/assigned';
import { BookIcon, CandleIcon, PrayingHandsIcon, ChurchIcon, CrossIcon, HeartIcon } from '@/components/ui/TabIcons';

// Canon item icons (always gold), keyed by the semantic names lib/canon/today
// emits for each rule item.
const CANON_ICONS: Record<string, React.ComponentType<{ size?: number; color?: string }>> = {
  reading: BookIcon,
  quiet: CandleIcon,
  prayer: PrayingHandsIcon,
  church: ChurchIcon,
  fast: CrossIcon,
  serve: HeartIcon,
};

// The canon shown here is the user's OWN spiritual canon (their rule of prayer,
// set with their Father of Confession in the rule editor) — built per weekday
// by lib/canon/today.ts. The old priest-assigned components checklist was
// removed; Past Canons history below still reflects assigned canons.

const DEMO_HISTORY = [
  { id: 'h1', component: 'Great Lent Canon', start_date: '2026-03-01', end_date: '2026-04-19', pct: 84, active: false },
  { id: 'h2', component: 'New Year Canon', start_date: '2026-01-07', end_date: '2026-03-01', pct: 72, active: false },
];

// ── Canon row — tap the row (or its checkbox) to check off ───
// Heart of Service items also get a Postpone button: sometimes a due service
// can't happen that day (a monthly service, say), so instead of leaving it
// unchecked the user defers it to a chosen date.
function CanonRow({ comp, done, assigned, onToggle, onPostpone }: {
  comp: any; done: boolean; assigned?: boolean; onToggle: () => void; onPostpone?: () => void;
}) {
  return (
    <View style={[styles.compItem, done && styles.compItemDone, assigned && styles.compItemAssigned]}>
      <View style={styles.compHeader}>
        <TouchableOpacity style={styles.compMain} onPress={() => { done ? H.tap() : H.done(); onToggle(); }} activeOpacity={0.85}>
          <View style={[styles.compCheck, done && styles.compCheckDone]}>
            {done && <Text style={styles.compCheckMark}>✓</Text>}
          </View>
          <View style={styles.compIcon}>
            {(() => {
              const Icon = CANON_ICONS[comp.icon] ?? CandleIcon;
              return <Icon size={18} color={colors.gold} />;
            })()}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.compName, done && styles.compNameDone]}>{comp.name}</Text>
            {assigned && <Text style={styles.compAssignedTag}>🔒 Assigned by your Father of Confession</Text>}
            {done && <Text style={styles.compStatus}>{comp.doneLabel ?? '✓ Done today'}</Text>}
          </View>
        </TouchableOpacity>
        {onPostpone && !done && (
          <TouchableOpacity style={styles.postponeBtn} onPress={() => { H.tap(); onPostpone(); }} hitSlop={8}>
            <Text style={styles.postponeBtnText}>Postpone ▾</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ── Readiness indicator ──────────────────────────────────────
// Measured against the rule's own confession frequency: within it = ready,
// past it = confession overdue.
function ReadinessIndicator({ daysSince, freqDays, freqLabel }: { daysSince: number; freqDays: number; freqLabel: string }) {
  const state = daysSince <= freqDays
    ? { icon: '✓', label: 'Ready', body: `${daysSince} day${daysSince === 1 ? '' : 's'} since confession — within your rule of ${freqLabel.toLowerCase()} confession. You are in good standing for Holy Communion.`, color: colors.green }
    : { icon: '⚠', label: 'Confession overdue', body: `${daysSince} days since your last confession — your canon calls for ${freqLabel.toLowerCase()} confession. Consider scheduling before your next Communion.`, color: colors.red };

  return (
    <View style={[styles.readinessRow, { borderColor: `${state.color}33` }]}>
      <Text style={[styles.readinessIcon, { color: state.color }]}>{state.icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[styles.readinessStatus, { color: state.color }]}>{state.label}</Text>
        <Text style={styles.readinessBody}>{state.body}</Text>
      </View>
    </View>
  );
}

// ── Screen ───────────────────────────────────────────────────
export default function CanonScreen() {
  const router = useRouter();
  const { user, profile } = useSession();
  const { demoMode } = useDemoMode();
  const [history, setHistory] = useState<any[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [ruleItems, setRuleItems] = useState<RuleItem[] | null>(null); // null = loading
  const [lockedKeys, setLockedKeys] = useState<Set<string>>(new Set()); // FOC-assigned item keys
  const [postponeFor, setPostponeFor] = useState<string | null>(null); // item key with open postpone options
  const [loggingAttendance, setLoggingAttendance] = useState(false);   // service picker open
  // Count-per-week services: this week's tally + the effective targets, so a
  // tap can log/undo without a full (network-touching) reload.
  const [weekSvc, setWeekSvc] = useState<{ counts: Record<string, number>; loggedToday: Set<string> }>(
    { counts: {}, loggedToday: new Set() });
  const [ruleCounts, setRuleCounts] = useState<Record<string, ServiceCount>>({});
  const svcBusy = useRef(false);
  const dayStripRef = useRef<ScrollView>(null);
  const dayStripPinned = useRef(false);
  const [readiness, setReadiness] = useState<{ days: number; freqDays: number; freqLabel: string } | null>(null);
  // The day being logged. A canon kept but only remembered after midnight — or
  // over a few days away from the app — can be completed here rather than
  // standing as a miss in Spiritual Vitals.
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const viewingToday = isSameDay(selectedDate, new Date());
  // Count-committed services are scored per WEEK, onto that week's Saturday,
  // and a week that has closed is already scored — so attendance can only be
  // logged inside the current week.
  // Each counted service has its own cadence, so "is this day still open" is
  // per-service. The note below is shown when any of them has already closed.
  const countsEditable = Object.values(ruleCounts).every(
    c => periodStart(c.freq, selectedDate) === periodStart(c.freq, new Date()));

  useEffect(() => {
    if (demoMode) {
      setHistory(DEMO_HISTORY);
    } else {
      loadHistory();
    }
  }, [user]);

  // Reload the canon every time the tab gains focus, so edits made in the
  // rule editor reflect here immediately — and whenever the day being logged
  // changes.
  useFocusEffect(useCallback(() => {
    loadCanon();
  }, [user, demoMode, localDateStr(selectedDate)]));

  async function loadCanon() {
    if (user && !demoMode) await hydrateRuleFromCloud(user.id);
    const rule = await loadRule();
    const last = await lastConfessionDate();

    // Merge in the parts the Father of Confession has assigned (locked over the
    // member's own rule until their next confession or until the FOC changes it).
    const assigned = await loadAssignedForMember(user?.id ?? '', demoMode, profile?.foc_id);
    const overlay = applyOverlay(rule, assigned, last);

    const now = new Date();
    const day = selectedDate;
    const isToday = isSameDay(day, now);
    // Whether the day being viewed still falls in a given service's current
    // period — a past period is settled and must not be re-scored.
    const inCurrentPeriod = (svcKey: string) => {
      const cfg = overlay.rule.serviceCounts?.[svcKey];
      return !cfg || periodStart(cfg.freq, day) === periodStart(cfg.freq, now);
    };
    const [postponed, serviceDone, loadedLog, adhoc] = await Promise.all([
      loadPostponements(), loadServiceDone(), loadServiceLog(), loadAttendance(day),
    ]);
    // Services committed by count-per-week: stamp THIS week's targets (which is
    // also what makes a zero-attendance week count as a miss) — always the
    // current week, never a past one being back-filled — then read the selected
    // day's week for the "1 of 2 this week" labels.
    const svcLog = overlay.rule.servicesMode === 'counts'
      ? await ensurePeriods(overlay.rule.serviceCounts ?? {}, now)
      : loadedLog;
    const weekServices = {
      counts: periodCounts(svcLog, overlay.rule.serviceCounts ?? {}, day),
      loggedToday: new Set(SERVICES.filter(sv => loggedOn(svcLog, sv.key, overlay.rule.serviceCounts?.[sv.key]?.freq ?? 'Weekly', day)).map(sv => sv.key)),
    };
    setWeekSvc(weekServices);
    setRuleCounts(overlay.rule.servicesMode === 'counts' ? (overlay.rule.serviceCounts ?? {}) : {});
    // A closed week's services are already scored, so those rows would be
    // inert — leave them off a day outside this week entirely.
    const structured = todayItems(overlay.rule, day, postponed, serviceDone, weekServices, adhoc)
      .filter(it => {
        if (!isWeeklyServiceKey(it.key)) return true;
        const sk = serviceKeyOf(it.key);
        return !sk || inCurrentPeriod(sk);
      });
    // Score any week that has fully elapsed (see finalizeWeeklyServices).
    finalizeWeeklyServices(svcLog, now);
    // Priest-added free-text components appear as read-only canon rows — on
    // their scheduled weekdays only, resting for their period once checked
    // off (the same recurrence model as Heart of Service commitments).
    const customItems: RuleItem[] = overlay.customComponents
      .filter(c => customDueToday(c.frequency, c.days, day, serviceDone, `assigned_${c.id}`, postponed))
      .map(c => {
        const daysLabel = c.days?.length ? ` · ${c.days.map(d => WEEKDAYS[d].slice(0, 3)).join(', ')}` : '';
        return {
          key: `assigned_${c.id}`, icon: 'quiet',
          label: c.frequency ? `${c.text} · ${c.frequency}${daysLabel}` : c.text,
          // A rest-period frequency makes check-offs record a done date, so
          // e.g. a monthly component sleeps until next month once completed.
          freq: c.frequency && c.frequency !== 'Daily' && c.frequency !== 'Weekly' ? c.frequency : undefined,
        };
      });
    const items = [...structured, ...customItems];

    // Which of today's rows are FOC-assigned (locked) — badge them. Day-based
    // categories are locked only on the specific weekdays the priest set.
    const todayIdx = day.getDay();
    const locked = new Set<string>();
    for (const it of structured) {
      const cat = categoryForItemKey(it.key);
      if (!cat) continue;
      if (overlay.lockedCategories.has(cat)) locked.add(it.key);
      else if ((cat === 'agpeya_hours' || cat === 'services' || cat === 'heart_of_service') && overlay.lockedDays[cat].has(todayIdx)) locked.add(it.key);
    }
    overlay.customComponents.forEach(c => { if (c.locked) locked.add(`assigned_${c.id}`); });

    const checks = await loadChecks(day);
    // A count-committed service is "done" when the WEEK's target is met — the
    // attendance log decides that, never the daily check store.
    for (const sv of SERVICES) {
      if (!inCurrentPeriod(sv.key)) continue;
      const id = `rule_${weeklyServiceKey(sv.key)}`;
      const target = overlay.rule.serviceCounts?.[sv.key]?.n ?? 0;
      target > 0 && (weekServices.counts[sv.key] ?? 0) >= target ? checks.add(id) : checks.delete(id);
    }
    // An ad-hoc attendance is complete by definition — the row exists because
    // the member logged that it happened — so it is always checked.
    for (const it of items) if (it.adhoc) checks.add(`rule_${it.key}`);
    setRuleItems(items);
    setLockedKeys(locked);
    setChecked(checks);
    // Only today's record is written on load. A past day is recorded when the
    // member actually marks something on it — merely looking back at a day they
    // were away must not create a record, which would turn a day that simply
    // didn't count into a day of misses.
    if (isToday) recordCanonDay(items, checks, day);

    // Communion readiness measured against the effective confession frequency
    // (a priest-assigned frequency takes precedence while it's locked).
    const days = last != null ? daysSinceDate(last)
      : profile?.last_confession_at ? Math.floor((Date.now() - new Date(profile.last_confession_at).getTime()) / 86400000)
      : demoMode ? 47 : null;
    setReadiness(days == null ? null : { days, freqDays: confessionFrequencyDays(overlay.rule.confession), freqLabel: overlay.rule.confession });
  }

  // Log a service or communion the rule didn't ask for on this day. This is
  // what makes every Spiritual Vital trackable regardless of what the member
  // (or their FOC) happened to commit to — see lib/canon/attendance.ts.
  async function logAdhoc(serviceKey: string) {
    H.tap();
    setLoggingAttendance(false);
    await logAttendanceOn(serviceKey, selectedDate);
    await loadCanon();
  }

  // Defer a Heart of Service item: it leaves today's list and returns on the
  // computed date (same weekday), shown then regardless of its frequency.
  async function applyPostpone(itemKey: string, opt: PostponeOption) {
    H.tap();
    await postponeServiceItem(itemKey, opt);
    setPostponeFor(null);
    await loadCanon();
  }

  async function loadHistory() {
    if (!user) return;
    const past = await db.getInactiveCanons(user.id);
    if (past) {
      const withPct = await Promise.all(past.map(async (c) => {
        const count = await db.countCanonCompletions(c.id);
        const start = new Date(c.start_date).getTime();
        const end = c.end_date ? new Date(c.end_date).getTime() : Date.now();
        const durationDays = Math.max(Math.round((end - start) / 86400000), 1);
        return { ...c, pct: Math.min(Math.round((count / durationDays) * 100), 100) };
      }));
      setHistory(withPct);
    }
  }

  // Check-offs persist on-device for the current day (auto-reset at local
  // midnight) so the Home "canon today" tile can track them too. Checking a
  // Heart of Service item also records its lasting completion anchor, which
  // is what rests a non-weekly service until its next due date.
  function toggleCheck(item: RuleItem) {
    const id = `rule_${item.key}`;
    const isServe = item.key.startsWith('serve_') || (item.key.startsWith('assigned_') && !!item.freq);

    // Ad-hoc attendance: untapping removes the log entirely. Leaving an
    // unchecked row behind would record it as due-and-missed, penalising the
    // member for having logged something they were never asked to do.
    if (item.adhoc) {
      const sv = serviceKeyOf(item.key);
      if (!sv) return;
      H.tap();
      setRuleItems(prev => (prev ?? []).filter(it => it.key !== item.key));
      setChecked(prev => { const next = new Set(prev); next.delete(id); return next; });
      unlogAttendanceOn(sv, selectedDate).then(loadCanon);
      return;
    }

    // A count-committed service isn't a daily check-off — it's an attendance
    // logged against this week's target. Tapping logs today, un-logs today if
    // already logged, or (once the target is met) undoes the most recent
    // attendance so a mistake made earlier in the week can still be corrected.
    if (isWeeklyServiceKey(item.key)) {
      if (svcBusy.current) return;                     // ignore double-taps mid-write
      svcBusy.current = true;
      const serviceKey = item.key.slice('svcw_'.length);
      const logged = weekSvc.counts[serviceKey] ?? 0;
      const cfg = ruleCounts[serviceKey];
      const target = cfg?.n ?? 0;
      const doneToday = weekSvc.loggedToday.has(serviceKey);
      const adding = !doneToday && logged < target;
      const next = Math.max(0, logged + (adding ? 1 : -1));
      H.tap();
      // Update label, tally and checkbox immediately — the write is local and
      // a full reload would re-hit the network for the cloud rule hydrate.
      setWeekSvc(prev => {
        const loggedToday = new Set(prev.loggedToday);
        adding ? loggedToday.add(serviceKey) : loggedToday.delete(serviceKey);
        return { counts: { ...prev.counts, [serviceKey]: next }, loggedToday };
      });
      const svcName = SERVICES.find(s => s.key === serviceKey)?.name ?? serviceKey;
      setRuleItems(prev => (prev ?? []).map(it => it.key === item.key
        ? { ...it, label: `${SERVICES.find(s => s.key === serviceKey)?.verb ?? 'Attend'} ${svcName} — ${next} of ${target} this ${periodNoun(cfg?.freq ?? 'Weekly')}`, doneLabel: `✓ Complete for this ${periodNoun(cfg?.freq ?? 'Weekly')}` }
        : it));
      setChecked(prev => {
        const set = new Set(prev);
        next >= target ? set.add(id) : set.delete(id);
        return set;
      });
      const freq = cfg?.freq ?? 'Weekly';
      (adding ? logAttendance(serviceKey, freq, selectedDate) : unlogLatest(serviceKey, freq, selectedDate))
        .finally(() => { svcBusy.current = false; });
      return;
    }

    setChecked(prev => {
      const next = new Set(prev);
      const nowChecked = !next.has(id);
      nowChecked ? next.add(id) : next.delete(id);
      saveChecks(next, selectedDate);
      if (isServe) (nowChecked ? recordServiceDone(item.key, selectedDate) : clearServiceDone(item.key, selectedDate));
      recordCanonDay(ruleItems ?? [], next, selectedDate);
      // Assigned components also mirror to canon_completions — the only
      // signal the assigning priest/servant's weekly counts can read.
      if (item.key.startsWith('assigned_') && user && !demoMode) {
        const canonId = item.key.slice('assigned_'.length);
        const today = localDateStr(selectedDate);
        (nowChecked
          ? db.upsertCanonCompletion(canonId, user.id, today)
          : db.deleteCanonCompletion(canonId, user.id, today)
        ).catch(() => {});
      }
      return next;
    });
  }

  const items = ruleItems ?? [];
  const completedCount = items.filter(it => checked.has(`rule_${it.key}`)).length;
  const fastingToday = isFastDay(selectedDate);
  const days = backfillDates();

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        <View style={styles.titleRow}>
          <DrawerMenuButton />
          <Text style={styles.pageTitle}>Spiritual Canon</Text>
        </View>
        <Text style={styles.pageSubtitle}>A remedy for the soul, not a task list</Text>

        {/* My Spiritual Canon — the user's own rule of prayer for today */}
        <Card
          title="My Spiritual Canon"
          flat
          action={
            <View style={styles.headerActions}>
              {fastingToday && (
                <View style={styles.fastBadge}><Text style={styles.fastBadgeText}>Fasting day</Text></View>
              )}
              {items.length > 0 && (
                <Text style={styles.headerCount}>{completedCount}/{items.length}</Text>
              )}
              <TouchableOpacity onPress={() => { H.tap(); router.push('/canon/rule'); }} hitSlop={8}>
                <Text style={styles.editLink}>Edit ›</Text>
              </TouchableOpacity>
            </View>
          }
        >
          {/* Which day is being logged. The canon is often kept faithfully but
              remembered only after midnight, or across a few days away from the
              app — those days can be completed here instead of standing as
              misses. */}
          <ScrollView
            ref={dayStripRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dayStrip}
            // Today is the right-hand end of the strip and the day you land on,
            // so open there — scrolling back is the deliberate move.
            onContentSizeChange={() => {
              if (dayStripPinned.current) return;
              dayStripPinned.current = true;
              dayStripRef.current?.scrollToEnd({ animated: false });
            }}
          >
            {days.map(d => {
              const sel = isSameDay(d, selectedDate);
              return (
                <TouchableOpacity
                  key={localDateStr(d)}
                  style={[styles.dayChip, sel && styles.dayChipActive]}
                  onPress={() => { H.tap(); setPostponeFor(null); setSelectedDate(d); }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.dayChipLabel, sel && styles.dayChipTextActive]}>
                    {isSameDay(d, new Date()) ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'short' })}
                  </Text>
                  <Text style={[styles.dayChipDate, sel && styles.dayChipTextActive]}>{d.getDate()}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {!viewingToday && (
            <Text style={styles.backfillNote}>
              Completing {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              {countsEditable ? '' : ' · counted services are already settled for that period'}
            </Text>
          )}

          {ruleItems == null ? (
            <ActivityIndicator color={colors.gold} style={{ paddingVertical: 20 }} />
          ) : items.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={{ opacity: 0.5 }}><CandleIcon size={30} color={colors.gold} /></View>
              <Text style={styles.emptyTitle}>No canon set yet</Text>
              <Text style={styles.emptyBody}>
                Set your spiritual canon with your Father of Confession — Agpeya hours, church services,
                fasting, prostrations, quiet time, and reading, per day of the week.
              </Text>
              <TouchableOpacity style={styles.setBtn} onPress={() => { H.tap(); router.push('/canon/rule'); }} activeOpacity={0.85}>
                <Text style={styles.setBtnText}>Set my canon</Text>
              </TouchableOpacity>
              <Text style={styles.emptyOr}>or</Text>
              {/* Without a rule there are no rows at all, so this is the only
                  way liturgy and communion can reach Spiritual Vitals. */}
              <TouchableOpacity style={styles.logBtn} onPress={() => { H.tap(); setLoggingAttendance(true); }} activeOpacity={0.8}>
                <Text style={styles.logBtnText}>＋  Log a service or communion</Text>
              </TouchableOpacity>
              {loggingAttendance && (
                <View style={styles.logChips}>
                  {SERVICES.map(sv => (
                    <TouchableOpacity key={sv.key} style={styles.logChip} onPress={() => logAdhoc(sv.key)} activeOpacity={0.8}>
                      <Text style={styles.logChipText}>{sv.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          ) : (
            <>
              {items.map(item => {
                const rk = `rule_${item.key}`;
                // Postpone is offered only where the frequency allows it —
                // weekly services (and non-service items) get plain checkboxes.
                const options = item.freq ? postponeOptionsFor(item.freq) : [];
                return (
                  <View key={item.key} style={{ marginBottom: 10 }}>
                    <CanonRow
                      comp={{ id: rk, icon: item.icon, name: item.label, doneLabel: item.doneLabel }}
                      done={checked.has(rk)}
                      assigned={lockedKeys.has(item.key)}
                      onToggle={() => { setPostponeFor(null); toggleCheck(item); }}
                      // Postponing defers an item to a future date, so it only
                      // makes sense from today — not while completing a past day.
                      onPostpone={options.length > 0 && viewingToday ? () => setPostponeFor(prev => (prev === item.key ? null : item.key)) : undefined}
                    />
                    {postponeFor === item.key && !checked.has(rk) && (
                      <View style={styles.postponeRow}>
                        <Text style={styles.postponeLabel}>Postpone until</Text>
                        {options.map(o => (
                          <TouchableOpacity key={o.label} style={styles.postponeChip} onPress={() => applyPostpone(item.key, o)} activeOpacity={0.8}>
                            <Text style={styles.postponeChipText}>{o.label}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })}
              {/* Anything in Spiritual Vitals has to be loggable here, even on a
                  day the rule is silent about — an unscheduled liturgy, or
                  communion received when no rule mentioned it. */}
              {(() => {
                const offer = SERVICES.filter(sv =>
                  !items.some(it => serviceKeyOf(it.key) === sv.key));
                if (!offer.length) return null;
                return loggingAttendance ? (
                  <View style={styles.logWrap}>
                    <Text style={styles.logLabel}>
                      {viewingToday ? 'What did you attend today?' : 'What did you attend that day?'}
                    </Text>
                    <View style={styles.logChips}>
                      {offer.map(sv => (
                        <TouchableOpacity key={sv.key} style={styles.logChip} onPress={() => logAdhoc(sv.key)} activeOpacity={0.8}>
                          <Text style={styles.logChipText}>{sv.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <TouchableOpacity onPress={() => { H.tap(); setLoggingAttendance(false); }} activeOpacity={0.7}>
                      <Text style={styles.logCancel}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.logBtn} onPress={() => { H.tap(); setLoggingAttendance(true); }} activeOpacity={0.8}>
                    <Text style={styles.logBtnText}>＋  Log a service or communion</Text>
                  </TouchableOpacity>
                );
              })()}
              <PrivacyNote text="Your spiritual canon stays private to you — it is never shared with anyone." />
            </>
          )}
        </Card>

        {/* Communion Readiness */}
        <Card title="Communion Readiness" titleIcon="✝︎">
          {readiness ? (
            <ReadinessIndicator daysSince={readiness.days} freqDays={readiness.freqDays} freqLabel={readiness.freqLabel} />
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyBody}>Complete a confession (or log one on the Confession tab) and readiness guidance will appear here.</Text>
            </View>
          )}
          <PrivacyNote text="Based on your confession date. Your Father of Confession may adjust this guidance." />
        </Card>

        {/* Canon History */}
        {history.length > 0 && (
          <Card title={`Past Canons (${history.length})`} flat>
            {history.map((item, i) => {
              const pct = item.pct ?? 0;
              const startFmt = item.start_date ? new Date(item.start_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '';
              const endFmt = item.end_date ? new Date(item.end_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'Ongoing';
              return (
                <View key={item.id} style={[styles.histItem, i < history.length - 1 && styles.divider]}>
                  <View style={styles.histTop}>
                    <Text style={styles.histTitle}>{item.component ?? item.title}</Text>
                    <Text style={[styles.histPct, { color: pct >= 80 ? colors.green : colors.muted }]}>{pct}%</Text>
                  </View>
                  <Text style={styles.histDates}>{startFmt} – {endFmt}</Text>
                </View>
              );
            })}
          </Card>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = lazyThemed(() => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.navy },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },

  titleRow: { flexDirection: 'row', alignItems: 'center' },
  pageTitle: { fontFamily: fonts.cormorantMedium, fontSize: 28, color: colors.cream, marginBottom: 4 },
  pageSubtitle: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, marginBottom: 20, fontStyle: 'italic' },

  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerCount: { fontFamily: fonts.latoBold, fontSize: 12, color: colors.muted },
  editLink: { fontFamily: fonts.latoBold, fontSize: 12, color: colors.gold },
  fastBadge: { backgroundColor: 'rgba(201,168,76,0.15)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  fastBadgeText: { fontFamily: fonts.latoBold, fontSize: 10, color: colors.goldLight },

  dayStrip: { flexDirection: 'row', gap: 8, paddingBottom: 14, paddingRight: 4 },
  dayChip: { minWidth: 52, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, alignItems: 'center' },
  dayChipActive: { borderColor: colors.gold, backgroundColor: colors.goldDim },
  dayChipLabel: { fontFamily: fonts.latoBold, fontSize: 10, color: colors.muted, letterSpacing: 0.3 },
  dayChipDate: { fontFamily: fonts.cormorantMedium, fontSize: 17, color: colors.cream, marginTop: 1 },
  dayChipTextActive: { color: colors.goldLight },
  logBtn: { alignSelf: 'flex-start' as any, paddingVertical: 9, paddingHorizontal: 14, borderRadius: 9, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed' as any, marginTop: 4, marginBottom: 14 },
  logBtnText: { fontFamily: fonts.latoBold, fontSize: 12, letterSpacing: 0.3, color: colors.gold },
  logWrap: { marginTop: 4, marginBottom: 14, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.goldDim },
  logLabel: { fontFamily: fonts.latoBold, fontSize: 11, letterSpacing: 0.6, color: colors.cream, marginBottom: 10, textTransform: 'uppercase' as any },
  logChips: { flexDirection: 'row', flexWrap: 'wrap' as any, gap: 8, marginBottom: 10 },
  logChip: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.gold, backgroundColor: 'transparent' },
  logChipText: { fontFamily: fonts.lato, fontSize: 12, color: colors.gold },
  logCancel: { fontFamily: fonts.lato, fontSize: 12, color: colors.muted },
  emptyOr: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, marginTop: 14, marginBottom: 10 },
  backfillNote: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, lineHeight: 16, marginBottom: 12, fontStyle: 'italic' },

  compItem: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, overflow: 'hidden' },
  compItemDone: { opacity: 0.65 },
  compItemAssigned: { borderColor: colors.gold + '66' },
  compAssignedTag: { fontFamily: fonts.latoBold, fontSize: 9, color: colors.goldLight, marginTop: 2, letterSpacing: 0.2 },
  compHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13 },
  compMain: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  compCheck: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  compCheckDone: { backgroundColor: colors.gold, borderColor: colors.gold },
  compCheckMark: { fontSize: 12, color: colors.navy, fontWeight: '700' },
  compIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: colors.goldDim, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  compIconEmoji: { fontSize: 16 },
  compName: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.cream, marginBottom: 2, flexShrink: 1 },
  compNameDone: { textDecorationLine: 'line-through' },
  compStatus: { fontFamily: fonts.latoLight, fontSize: 10, color: colors.muted },

  postponeBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, flexShrink: 0 },
  postponeBtnText: { fontFamily: fonts.lato, fontSize: 10, color: colors.muted },
  postponeRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, paddingHorizontal: 6, paddingTop: 8 },
  postponeLabel: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, marginRight: 2 },
  postponeChip: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  postponeChipText: { fontFamily: fonts.latoBold, fontSize: 11, color: colors.goldLight },

  setBtn: { marginTop: 12, backgroundColor: colors.gold, paddingVertical: 11, paddingHorizontal: 24, borderRadius: 10 },
  setBtnText: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.navy, letterSpacing: 0.4 },

  readinessRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderWidth: 1, borderRadius: 10, padding: 14, marginBottom: 4 },
  readinessIcon: { fontSize: 18, marginTop: 1 },
  readinessStatus: { fontFamily: fonts.latoBold, fontSize: 13, marginBottom: 4 },
  readinessBody: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, lineHeight: 18 },

  divider: { borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: 0 },
  histItem: { paddingVertical: 13 },
  histTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 3 },
  histTitle: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.cream, flex: 1 },
  histDates: { fontFamily: fonts.latoLight, fontSize: 10, color: colors.muted },
  histPct: { fontFamily: fonts.latoBold, fontSize: 12 },

  emptyState: { alignItems: 'center', paddingVertical: 20, gap: 6 },
  emptyIcon: { fontSize: 28, color: colors.muted, opacity: 0.4 },
  emptyTitle: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.muted },
  emptyBody: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, textAlign: 'center', lineHeight: 17, opacity: 0.7 },
}));
