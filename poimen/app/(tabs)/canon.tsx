import React, { useState, useCallback, useRef } from 'react';
import {
  ScrollView, View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import * as H from '@/lib/haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { colors, fonts , lazyThemed } from '@/lib/theme';
import { Card } from '@/components/ui/Card';
import { PrivacyNote } from '@/components/ui/PrivacyNote';
import { useSession } from '@/lib/auth';
import { useDemoMode } from '@/lib/demo';
import { loadRule, WEEKDAYS, SERVICES } from '@/lib/canon/rule-store';
import {
  loadServiceLog, ensureWeek, weekCounts, loggedOn, logAttendance, unlogLatest,
} from '@/lib/canon/service-log';
import { hydrateRuleFromCloud } from '@/lib/canon/rule-sync';
import { todayItems, customDueToday, RuleItem, weeklyServiceKey, isWeeklyServiceKey } from '@/lib/canon/today';
import { isFastDay } from '@/lib/canon/fasting';
import { loadTodayChecks, saveTodayChecks } from '@/lib/canon/checks';
import {
  postponeOptionsFor, PostponeOption, loadPostponements, postponeServiceItem,
  loadServiceDone, recordServiceDone, clearServiceDone,
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
// by lib/canon/today.ts. The old priest-assigned components checklist and the
// "Past Canons" history card were both removed: this tab is today's rule.

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
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [ruleItems, setRuleItems] = useState<RuleItem[] | null>(null); // null = loading
  const [lockedKeys, setLockedKeys] = useState<Set<string>>(new Set()); // FOC-assigned item keys
  const [postponeFor, setPostponeFor] = useState<string | null>(null); // item key with open postpone options
  // Count-per-week services: this week's tally + the effective targets, so a
  // tap can log/undo without a full (network-touching) reload.
  const [weekSvc, setWeekSvc] = useState<{ counts: Record<string, number>; loggedToday: Set<string> }>(
    { counts: {}, loggedToday: new Set() });
  const [ruleCounts, setRuleCounts] = useState<Record<string, number>>({});
  const svcBusy = useRef(false);
  const [readiness, setReadiness] = useState<{ days: number; freqDays: number; freqLabel: string } | null>(null);

  // Reload the canon every time the tab gains focus, so edits made in the
  // rule editor reflect here immediately.
  useFocusEffect(useCallback(() => {
    loadCanon();
  }, [user, demoMode]));

  async function loadCanon() {
    if (user && !demoMode) await hydrateRuleFromCloud(user.id);
    const rule = await loadRule();
    const last = await lastConfessionDate();

    // Merge in the parts the Father of Confession has assigned (locked over the
    // member's own rule until their next confession or until the FOC changes it).
    const assigned = await loadAssignedForMember(user?.id ?? '', demoMode, profile?.foc_id);
    const overlay = applyOverlay(rule, assigned, last);

    const now = new Date();
    const [postponed, serviceDone, loadedLog] = await Promise.all([
      loadPostponements(), loadServiceDone(), loadServiceLog(),
    ]);
    // Services committed by count-per-week: stamp this week's targets (which is
    // also what makes a zero-attendance week count as a miss), then read the
    // week's tally for the "1 of 2 this week" labels.
    const svcLog = overlay.rule.servicesMode === 'counts'
      ? await ensureWeek(overlay.rule.serviceCounts ?? {}, now)
      : loadedLog;
    const weekServices = {
      counts: weekCounts(svcLog, now),
      loggedToday: new Set(SERVICES.filter(sv => loggedOn(svcLog, sv.key, now)).map(sv => sv.key)),
    };
    setWeekSvc(weekServices);
    setRuleCounts(overlay.rule.servicesMode === 'counts' ? (overlay.rule.serviceCounts ?? {}) : {});
    const structured = todayItems(overlay.rule, now, postponed, serviceDone, weekServices);
    // Score any week that has fully elapsed (see finalizeWeeklyServices).
    finalizeWeeklyServices(svcLog, now);
    // Priest-added free-text components appear as read-only canon rows — on
    // their scheduled weekdays only, resting for their period once checked
    // off (the same recurrence model as Heart of Service commitments).
    const customItems: RuleItem[] = overlay.customComponents
      .filter(c => customDueToday(c.frequency, c.days, new Date(), serviceDone, `assigned_${c.id}`, postponed))
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
    const todayIdx = new Date().getDay();
    const locked = new Set<string>();
    for (const it of structured) {
      const cat = categoryForItemKey(it.key);
      if (!cat) continue;
      if (overlay.lockedCategories.has(cat)) locked.add(it.key);
      else if ((cat === 'agpeya_hours' || cat === 'services' || cat === 'heart_of_service') && overlay.lockedDays[cat].has(todayIdx)) locked.add(it.key);
    }
    overlay.customComponents.forEach(c => { if (c.locked) locked.add(`assigned_${c.id}`); });

    const checks = await loadTodayChecks();
    // A count-committed service is "done" when the WEEK's target is met — the
    // attendance log decides that, never the daily check store.
    for (const sv of SERVICES) {
      const id = `rule_${weeklyServiceKey(sv.key)}`;
      const target = overlay.rule.serviceCounts?.[sv.key] ?? 0;
      target > 0 && (weekServices.counts[sv.key] ?? 0) >= target ? checks.add(id) : checks.delete(id);
    }
    setRuleItems(items);
    setLockedKeys(locked);
    setChecked(checks);
    recordCanonDay(items, checks); // keep the adherence history current

    // Communion readiness measured against the effective confession frequency
    // (a priest-assigned frequency takes precedence while it's locked).
    const days = last != null ? daysSinceDate(last)
      : profile?.last_confession_at ? Math.floor((Date.now() - new Date(profile.last_confession_at).getTime()) / 86400000)
      : demoMode ? 47 : null;
    setReadiness(days == null ? null : { days, freqDays: confessionFrequencyDays(overlay.rule.confession), freqLabel: overlay.rule.confession });
  }

  // Defer a Heart of Service item: it leaves today's list and returns on the
  // computed date (same weekday), shown then regardless of its frequency.
  async function applyPostpone(itemKey: string, opt: PostponeOption) {
    H.tap();
    await postponeServiceItem(itemKey, opt);
    setPostponeFor(null);
    await loadCanon();
  }

  // Check-offs persist on-device for the current day (auto-reset at local
  // midnight) so the Home "canon today" tile can track them too. Checking a
  // Heart of Service item also records its lasting completion anchor, which
  // is what rests a non-weekly service until its next due date.
  function toggleCheck(item: RuleItem) {
    const id = `rule_${item.key}`;
    const isServe = item.key.startsWith('serve_') || (item.key.startsWith('assigned_') && !!item.freq);

    // A count-committed service isn't a daily check-off — it's an attendance
    // logged against this week's target. Tapping logs today, un-logs today if
    // already logged, or (once the target is met) undoes the most recent
    // attendance so a mistake made earlier in the week can still be corrected.
    if (isWeeklyServiceKey(item.key)) {
      if (svcBusy.current) return;                     // ignore double-taps mid-write
      svcBusy.current = true;
      const serviceKey = item.key.slice('svcw_'.length);
      const logged = weekSvc.counts[serviceKey] ?? 0;
      const target = ruleCounts[serviceKey] ?? 0;
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
        ? { ...it, label: `Attend ${svcName} — ${next} of ${target} this week`, doneLabel: '✓ Complete for this week' }
        : it));
      setChecked(prev => {
        const set = new Set(prev);
        next >= target ? set.add(id) : set.delete(id);
        return set;
      });
      (adding ? logAttendance(serviceKey) : unlogLatest(serviceKey))
        .finally(() => { svcBusy.current = false; });
      return;
    }

    setChecked(prev => {
      const next = new Set(prev);
      const nowChecked = !next.has(id);
      nowChecked ? next.add(id) : next.delete(id);
      saveTodayChecks(next);
      if (isServe) (nowChecked ? recordServiceDone(item.key) : clearServiceDone(item.key));
      recordCanonDay(ruleItems ?? [], next);
      return next;
    });
  }

  const items = ruleItems ?? [];
  const completedCount = items.filter(it => checked.has(`rule_${it.key}`)).length;
  const fastingToday = isFastDay(new Date());

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        <Text style={styles.pageTitle}>Spiritual Canon</Text>
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
                      onPostpone={options.length > 0 ? () => setPostponeFor(prev => (prev === item.key ? null : item.key)) : undefined}
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

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = lazyThemed(() => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.navy },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },

  pageTitle: { fontFamily: fonts.cormorantMedium, fontSize: 28, color: colors.cream, marginBottom: 4 },
  pageSubtitle: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, marginBottom: 20, fontStyle: 'italic' },

  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerCount: { fontFamily: fonts.latoBold, fontSize: 12, color: colors.muted },
  editLink: { fontFamily: fonts.latoBold, fontSize: 12, color: colors.gold },
  fastBadge: { backgroundColor: 'rgba(201,168,76,0.15)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  fastBadgeText: { fontFamily: fonts.latoBold, fontSize: 10, color: colors.goldLight },

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


  emptyState: { alignItems: 'center', paddingVertical: 20, gap: 6 },
  emptyIcon: { fontSize: 28, color: colors.muted, opacity: 0.4 },
  emptyTitle: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.muted },
  emptyBody: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, textAlign: 'center', lineHeight: 17, opacity: 0.7 },
}));
