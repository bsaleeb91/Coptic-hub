import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ScrollView, View, Text, StyleSheet, TouchableOpacity,
  Animated, Modal, Dimensions, AccessibilityInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect, useNavigation } from 'expo-router';
import { DrawerActions } from '@react-navigation/native';
import { colors, fonts , lazyThemed } from '@/lib/theme';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { PrivacyNote } from '@/components/ui/PrivacyNote';
import { useSession } from '@/lib/auth';
import * as db from '@/lib/db';
import { useDemoMode } from '@/lib/demo';
import { loadSections, saveSections, SECTION_DEFS, DEFAULT_SECTIONS, type SectionId } from '@/lib/dashboard-layout';
import * as H from '@/lib/haptics';
import { loadRule, SERVICES } from '@/lib/canon/rule-store';
import { todayItems, customDueToday, RuleItem, weeklyServiceKey } from '@/lib/canon/today';
import { loadAssignedForMember, applyOverlay } from '@/lib/canon/assigned';
import { loadTodayChecks } from '@/lib/canon/checks';
import { loadPostponements, loadServiceDone } from '@/lib/canon/postpone';
import { loadServiceLog, ensurePeriods, periodCounts, loggedOn } from '@/lib/canon/service-log';
import { recordCanonDay, finalizeWeeklyServices, loadCanonHistory, computeVitals, loadVitalsEpoch, VitalStat } from '@/lib/canon/history';
import { loadAttendance } from '@/lib/canon/attendance';
import { lastConfessionDate, loadConfessionDates, hydrateConfessionDatesFromCloud, daysSinceDate, confessionFrequencyDays } from '@/lib/confession/dates';
import { VISIT_TYPE_KEYWORD } from '@/lib/scheduling/slots';
import { currentFast } from '@/lib/canon/fasting';
import { loadStreak } from '@/lib/psalms/store';
import { upcomingFeasts, feastOn } from '@/lib/feasts';
import { upcomingCommemorations, gregorianToCoptic, commemorationOn } from '@/lib/synaxarium';
import { firstGivenName, clergyDisplayName } from '@/lib/names';
import Harp from '@/components/ui/Harp';
import { CrossIcon, CandleIcon } from '@/components/ui/TabIcons';

const { width: SW } = Dimensions.get('window');
const TILE_W = (SW - 48) / 2;

// ── Demo data ────────────────────────────────────────────────
// Local YYYY-MM-DD of a timestamp, for same-day confession dedupe.
function localDayOf(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const DEMO_TIMELINE = lazyThemed(() => [
  { date: 'MAY 21, 2026', title: 'Holy Confession', body: 'Fr. Bishoy assigned a 40-day reading plan from the Psalms.', tag: '✝︎ Confession', tagBg: 'rgba(201,168,76,0.15)', tagColor: colors.goldLight },
  { date: 'MAY 4, 2026', title: 'Pastoral Visit — Home', body: 'Pastoral visit following the birth of your daughter.', tag: '◎ Pastoral Visit', tagBg: 'rgba(41,128,185,0.15)', tagColor: colors.blue },
  { date: 'APR 20, 2026', title: 'Holy Week Confession', body: 'Guidance on marriage and family prayer practices.', tag: '✝︎ Confession', tagBg: 'rgba(201,168,76,0.15)', tagColor: colors.goldLight },
  { date: 'MAR 12, 2026', title: 'Small Group Check-in', body: "Discussed the Book of Job with the young couples' group.", tag: '◇ Note', tagBg: colors.creamDim, tagColor: colors.muted, dim: true },
]);

// Computed live from the Coptic liturgical calendar (lib/feasts.ts,
// lib/synaxarium.ts) — movable feasts follow each year's Pascha, Coptic-dated
// entries follow Nayrouz.
const toDateRow = (e: { date: Date; title: string; desc: string }) => ({
  month: e.date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
  day: String(e.date.getDate()),
  title: e.title,
  desc: e.desc,
});
const nextFeastRows = () => upcomingFeasts(new Date(), 4).map(toDateRow);
const nextCommemRows = () => upcomingCommemorations(new Date(), 4).map(toDateRow);

function getDashboardSubtitle(): string {
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const c = gregorianToCoptic(today);
  const dateStr2 = `${dateStr} · ${c.day} ${c.monthName}`;   // Gregorian + Coptic date
  // Fast dates come from lib/canon/fasting — never hardcode them here, or the
  // header drifts out of step with the calendar and the canon.
  const fast = currentFast(today);
  return fast ? `${dateStr2} · ${fast.name} · Day ${fast.day}` : dateStr2;
}

// What the Church celebrates today, for the header: a feast of the Lord takes
// precedence over a Synaxarium commemoration. Fast openings are skipped here —
// the ongoing fast already shows in the date line above.
function getTodayCelebration(): string | null {
  const today = new Date();
  const f = feastOn(today);
  if (f && f.kind !== 'fast') return f.title;
  const c = commemorationOn(today);
  return c ? c.title : null;
}

// ── VitalRow — canon adherence over the trailing window ──────
// Read-only: values are computed from My Spiritual Canon check-off history
// (lib/canon/history.ts), not self-reported.
function VitalRow({ label, value, text, last }: { label: string; value: number | null; text?: string; last: boolean }) {
  return (
    <View style={[styles.vitalRow, !last && { marginBottom: 16 }]}>
      <Text style={styles.vitalLabel}>{label}</Text>
      <View style={styles.vitalTrack}>
        <View style={[styles.vitalFill, { width: `${value ?? 0}%` as any }]} />
      </View>
      <Text style={[styles.vitalVal, text != null && { width: undefined, minWidth: 34 }]}>
        {text ?? (value != null ? `${value}%` : '—')}
      </Text>
    </View>
  );
}

// ── Customize sheet ───────────────────────────────────────────
function CustomizeSheet({ visible, active, onSave, onClose }: {
  visible: boolean; active: SectionId[];
  onSave: (ids: SectionId[]) => void; onClose: () => void;
}) {
  const [local, setLocal] = useState(active);
  useEffect(() => { if (visible) setLocal(active); }, [visible]);

  const toggle = (id: SectionId) => {
    H.tap();
    setLocal(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={cs.backdrop}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={cs.sheet}>
          <View style={cs.handle} />
          <Text style={cs.title}>Customize Dashboard</Text>
          <Text style={cs.sub}>The confession and canon tiles are always pinned at the top.</Text>
          {(Object.entries(SECTION_DEFS) as [SectionId, typeof SECTION_DEFS[SectionId]][]).map(([id, def]) => (
            <TouchableOpacity key={id} style={cs.row} onPress={() => toggle(id)} activeOpacity={0.7}>
              <Text style={cs.rowIcon}>{def.icon}</Text>
              <Text style={cs.rowLabel}>{def.label}</Text>
              <View style={[cs.check, local.includes(id) && cs.checkOn]}>
                {local.includes(id) && <Text style={cs.checkMark}>✓</Text>}
              </View>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={cs.saveBtn} onPress={() => { H.success(); onSave(local); }}>
            <Text style={cs.saveBtnText}>SAVE LAYOUT</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const cs = lazyThemed(() => StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 24, paddingBottom: 40, paddingTop: 16 },
  handle: { width: 36, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  title: { fontFamily: fonts.cormorantMedium, fontSize: 22, color: colors.cream, marginBottom: 4 },
  sub: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, lineHeight: 18, marginBottom: 20 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowIcon: { fontSize: 16, marginRight: 12, color: colors.muted },
  rowLabel: { fontFamily: fonts.lato, fontSize: 14, color: colors.cream, flex: 1 },
  check: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  checkMark: { fontSize: 12, color: colors.navy, fontFamily: fonts.latoBold },
  saveBtn: { backgroundColor: colors.gold, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 24 },
  saveBtnText: { fontFamily: fonts.latoBold, fontSize: 12, color: colors.navy, letterSpacing: 1.5 },
}));

// ── Timeline row ──────────────────────────────────────────────
function TimelineRow({ item, last }: { item: any; last: boolean }) {
  return (
    <View style={styles.tlRow}>
      <View style={styles.tlDotCol}>
        <View style={[styles.tlDot, item.dim && styles.tlDotDim]} />
        {!last && <View style={styles.tlLine} />}
      </View>
      <View style={[styles.tlBodyCol, !last && { paddingBottom: 16 }]}>
        <Text style={[styles.tlDate, item.dim && { opacity: 0.5 }]}>{item.date}</Text>
        <Text style={styles.tlTitle}>{item.title}</Text>
        {item.body ? <Text style={styles.tlBody}>{item.body}</Text> : null}
        <View style={[styles.tlTag, { backgroundColor: item.tagBg }]}>
          <Text style={[styles.tlTagText, { color: item.tagColor }]}>{item.tag}</Text>
        </View>
      </View>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────
export default function DashboardScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { profile, user, refreshProfile } = useSession();
  const { demoMode, demoRole } = useDemoMode();
  const firstName = firstGivenName(profile?.full_name) || 'friend';
  const todayCelebration = getTodayCelebration();

  const [vitalStats, setVitalStats] = useState<VitalStat[] | null>(null);
  const [vitalsEpoch, setVitalsEpoch] = useState<string | null>(null);
  const [lastConf, setLastConf] = useState<string | null>(null);
  const [confFreqDays, setConfFreqDays] = useState(31);
  const [feasts, setFeasts] = useState(nextFeastRows);
  const [commems, setCommems] = useState(nextCommemRows);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [lastVisit, setLastVisit] = useState<string | null>(null);
  const [visitRequested, setVisitRequested] = useState(false);
  const [visitBusy, setVisitBusy] = useState(false);
  // Can a visit actually be booked — is the FOC accepting requests AND does he
  // offer a visitation type? null until we know, so the card doesn't flash the
  // wrong chip. Demo has both.
  const [visitBookable, setVisitBookable] = useState<boolean | null>(demoMode ? true : null);
  const [focProfile, setFocProfile] = useState<any>(null);
  const [sections, setSections] = useState<SectionId[]>(DEFAULT_SECTIONS);
  const [customizing, setCustomizing] = useState(false);
  const [showVitalsConsent, setShowVitalsConsent] = useState(false);
  const [settingConsent, setSettingConsent] = useState(false);

  // Auto-show vitals consent modal when congregant has an FOC but hasn't decided yet
  useEffect(() => {
    if (demoMode) return;
    if (profile?.foc_id && profile?.vitals_consent === null) {
      setShowVitalsConsent(true);
    }
  }, [profile?.foc_id, profile?.vitals_consent, demoMode]);

  async function handleVitalsConsent(consent: boolean) {
    if (!user) return;
    setSettingConsent(true);
    await db.setVitalsConsent(user.id, consent);
    await refreshProfile();
    setSettingConsent(false);
    setShowVitalsConsent(false);
  }

  // Wiggle animation for customize mode
  const wiggle = useRef(new Animated.Value(0)).current;
  const wiggleLoop = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    loadSections().then(setSections);
  }, [user]);

  // "Canon today" tile — tracks My Spiritual Canon (rule items + today's
  // check-offs). Reloaded on every focus so checking items on the Canon tab
  // reflects here immediately. The same pass keeps the adherence history
  // current and recomputes Spiritual Vitals from it; the computed vitals are
  // mirrored to the 'vitals' agent_progress slug so the Father-of-Confession
  // dashboards keep working (consent still gates visibility).
  const [canonToday, setCanonToday] = useState<{ done: number; total: number } | null>(null);
  const [psalmStreak, setPsalmStreak] = useState(0);
  useFocusEffect(useCallback(() => {
    (async () => {
      // Journey + FOC card refresh on every focus, so a confession recorded
      // moments ago on the Confession tab appears in the timeline immediately.
      if (!demoMode) loadAll();
      const [rule, checks, postponed, serviceDone, assigned, last, loadedLog, psalmStreakVal] = await Promise.all([
        loadRule(), loadTodayChecks(), loadPostponements(), loadServiceDone(),
        loadAssignedForMember(user?.id ?? '', demoMode, profile?.foc_id ?? undefined),
        lastConfessionDate(), loadServiceLog(),
        loadStreak(),
      ]);
      setPsalmStreak(psalmStreakVal.current);
      // Same EFFECTIVE canon as the Canon tab: the member's rule with the
      // FOC's locked assignments overlaid, plus scheduled custom components.
      // recordCanonDay below wholesale-replaces today's record, so building
      // it from the bare rule here made the tile and the adherence history
      // disagree with the Canon tab depending on which screen focused last.
      const overlay = applyOverlay(rule, assigned, last);
      // Count-committed services are tracked in the attendance log, not the
      // daily checks — mirror the Canon tab so the tile agrees with it.
      const nowDate = new Date();
      const svcLog = overlay.rule.servicesMode === 'counts'
        ? await ensurePeriods(overlay.rule.serviceCounts ?? {}, nowDate)
        : loadedLog;
      const weekServices = {
        counts: periodCounts(svcLog, overlay.rule.serviceCounts ?? {}, nowDate),
        loggedToday: new Set(SERVICES.filter(sv => loggedOn(svcLog, sv.key, overlay.rule.serviceCounts?.[sv.key]?.freq ?? 'Weekly', nowDate)).map(sv => sv.key)),
      };
      for (const sv of SERVICES) {
        const id = `rule_${weeklyServiceKey(sv.key)}`;
        const target = overlay.rule.serviceCounts?.[sv.key]?.n ?? 0;
        target > 0 && (weekServices.counts[sv.key] ?? 0) >= target ? checks.add(id) : checks.delete(id);
      }
      // Ad-hoc attendances count here too, or the Home tile's "canon today"
      // tally would disagree with the Canon tab's.
      const structured = todayItems(overlay.rule, nowDate, postponed, serviceDone, weekServices, await loadAttendance(nowDate));
      const customItems: RuleItem[] = overlay.customComponents
        .filter(c => customDueToday(c.frequency, c.days, new Date(), serviceDone, `assigned_${c.id}`, postponed))
        .map(c => ({ key: `assigned_${c.id}`, icon: 'quiet', label: c.text }));
      const items = [...structured, ...customItems];
      for (const it of items) if (it.adhoc) checks.add(`rule_${it.key}`);
      const done = items.filter(it => checks.has(`rule_${it.key}`)).length;
      setCanonToday({ done, total: items.length });
      setConfFreqDays(confessionFrequencyDays(overlay.rule.confession));
      setLastConf(last);
      setFeasts(nextFeastRows()); // stays current across midnights
      setCommems(nextCommemRows());


      await recordCanonDay(items, checks);
      await finalizeWeeklyServices(svcLog, nowDate);
      const epoch = await loadVitalsEpoch();
      setVitalsEpoch(epoch);
      // Confession has no canon check-off behind it — it is scored from the
      // recorded dates against the rule's cadence, so the row shows a real
      // number instead of a permanent "—".
      const stats = computeVitals(await loadCanonHistory(), epoch, {
        dates: await loadConfessionDates(),
        freqDays: confessionFrequencyDays(overlay.rule.confession),
      });
      setVitalStats(stats);
      if (user && !demoMode) {
        db.upsertAgentProgress({
          user_id: user.id,
          agent_slug: 'vitals',
          // Keep null for categories that never had anything due, so the FOC's
          // view can show "—" rather than a misleading 0%.
          payload: Object.fromEntries(stats.map(s => [s.key, s.pct])),
          updated_at: new Date().toISOString(),
        }).catch(() => {});
      }
    })();
  }, [user, demoMode, profile?.foc_id]));

  async function loadAll() {
    if (!user) return;
    // Restore this account's confession dates from the cloud if its local
    // namespace is empty (fresh device or after an account switch).
    if (!demoMode) await hydrateConfessionDatesFromCloud(user.id);
    // Fetch more than the 4 shown so same-day dedupe sees confession
    // encounters even when other encounters crowd the top of the list.
    const [enc, selfDates, foc, visit, visitReq, schedOpen, apptTypes, apptRules] = await Promise.all([
      db.getRecentEncounters(user.id, 12),
      loadConfessionDates(),
      profile?.foc_id ? db.getFocProfile(profile.foc_id) : null,
      db.getLastEncounterDate(user.id, 'visit'),
      db.getVisitRequest(user.id),
      profile?.foc_id ? db.getSchedulingOpen(profile.foc_id) : false,
      profile?.foc_id ? db.getAppointmentTypes(profile.foc_id) : [],
      profile?.foc_id ? db.getAvailabilityRules(profile.foc_id) : [],
    ]);
    setLastVisit(visit);
    // Booking a visit takes all three: the priest is open, he has a visitation
    // type, and he has opened hours FOR that type. Defining the type but never
    // publishing hours for it is the common case (visits get arranged ad hoc),
    // and it would send the member to an empty screen — so anything short of
    // all three falls back to the standing request flag, which is then the only
    // way left to reach him.
    const visitTypeIds = apptTypes
      .filter(t => t.active && t.label.toLowerCase().includes(VISIT_TYPE_KEYWORD))
      .map(t => t.id);
    setVisitBookable(schedOpen && apptRules.some(r => r.active && visitTypeIds.includes(r.type_id)));
    // Auto-clear a pending visit request once the priest has logged a visit
    // on or after it was requested (the priest can't write the member's row,
    // so the member's app resolves it).
    if (visitReq.active && visit && visitReq.requestedAt &&
        localDayOf(visit) >= localDayOf(visitReq.requestedAt)) {
      db.setVisitRequest(user.id, false).catch(() => {});
      setVisitRequested(false);
    } else {
      setVisitRequested(visitReq.active);
    }
    // The journey merges the FOC's logged encounters with the member's own
    // recorded confession dates. A self-reported date is dropped when the
    // priest logged a confession encounter that same local day, so one
    // confession never appears twice.
    const encounters = enc ?? [];
    const loggedConfessionDays = new Set(
      encounters
        .filter((e: any) => e.encounter_type === 'confession')
        .map((e: any) => localDayOf(e.encountered_at)),
    );
    const selfRows = selfDates
      .filter((d) => !loggedConfessionDays.has(d))
      .map((d) => ({ encounter_type: 'confession', encountered_at: `${d}T12:00:00`, member_note: null }));
    const merged = [...encounters, ...selfRows]
      .sort((a, b) => new Date(b.encountered_at).getTime() - new Date(a.encountered_at).getTime())
      .slice(0, 4);
    setTimeline(merged);
    if (foc) setFocProfile(foc);
  }

  async function toggleVisitRequest() {
    if (visitBusy) return;
    H.tap();
    const next = !visitRequested;
    if (demoMode || !user) { setVisitRequested(next); return; }
    setVisitBusy(true);
    const { error } = await db.setVisitRequest(user.id, next);
    if (!error) setVisitRequested(next);
    setVisitBusy(false);
  }

  // A visit is normally booked like any other appointment, so this links into
  // Appointments (which owns the not-linked / no-open-times states) filtered to
  // the priest's visitation type. When he can't be booked for one, the older
  // standing-flag request stays as the fallback and is then the only way to ask.
  // A flag already raised keeps its chip even once booking becomes possible —
  // it's the member's only way to cancel it, and the priest is still looking at
  // it on his roster.
  const showVisitLink = visitBookable === true;
  const showVisitFlag = visitRequested || visitBookable === false;
  const visitRequestChip = !showVisitLink && !showVisitFlag ? null : (
    <>
      {showVisitFlag && (
        <TouchableOpacity
          style={[styles.visitChip, visitRequested && styles.visitChipActive, visitBusy && { opacity: 0.6 }]}
          onPress={toggleVisitRequest}
          disabled={visitBusy}
          activeOpacity={0.8}
        >
          <Text style={[styles.scheduleIcon, visitRequested && { color: colors.green }]}>◎</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.scheduleText}>
              {visitRequested ? 'Pastoral Visit Requested' : 'Request Pastoral Visit'}
            </Text>
            <Text style={styles.scheduleSub}>
              {visitRequested
                ? 'Your Father of Confession has been notified · tap to cancel'
                : 'Let your Father of Confession know you’d like a visit'}
            </Text>
          </View>
          {visitRequested && <Text style={styles.visitCheck}>✓</Text>}
        </TouchableOpacity>
      )}
      {showVisitLink && (
        <TouchableOpacity
          style={styles.visitChip}
          onPress={() => { H.tap(); router.push(`/(tabs)/appointments?focus=${VISIT_TYPE_KEYWORD}`); }}
          activeOpacity={0.8}
        >
          <Text style={styles.scheduleIcon}>◎</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.scheduleText}>Schedule a Pastoral Visit</Text>
            <Text style={styles.scheduleSub}>Request a time from your Father of Confession</Text>
          </View>
          <Text style={styles.visitChevron}>›</Text>
        </TouchableOpacity>
      )}
    </>
  );

  function enterCustomize() {
    H.heavy();
    setCustomizing(true);
    wiggleLoop.current = Animated.loop(Animated.sequence([
      Animated.timing(wiggle, { toValue: 1,    duration: 80, useNativeDriver: true }),
      Animated.timing(wiggle, { toValue: -1,   duration: 80, useNativeDriver: true }),
      Animated.timing(wiggle, { toValue: 0.6,  duration: 80, useNativeDriver: true }),
      Animated.timing(wiggle, { toValue: -0.6, duration: 80, useNativeDriver: true }),
      Animated.timing(wiggle, { toValue: 0,    duration: 80, useNativeDriver: true }),
      Animated.delay(600),
    ]));
    AccessibilityInfo.isReduceMotionEnabled().then(reduced => {
      if (!reduced) wiggleLoop.current?.start();
    });
  }

  function handleSaveSections(ids: SectionId[]) {
    setSections(ids);
    saveSections(ids);
    setCustomizing(false);
  }

  const wiggleStyle = { transform: [{ rotate: wiggle.interpolate({ inputRange: [-1, 0, 1], outputRange: ['-2.5deg', '0deg', '2.5deg'] }) }] };

  const displayTimeline = demoMode ? DEMO_TIMELINE : timeline;

  const role = demoMode ? demoRole : profile?.role;
  const demoDaysSince = 47;

  // Canon tile display state, derived from My Spiritual Canon.
  const canonAllDone = canonToday != null && canonToday.total > 0 && canonToday.done === canonToday.total;
  const canonSet = canonToday != null && canonToday.total > 0;

  // Days since confession: the device-tracked record (completion flow /
  // self-report) wins; profile date and demo fallback fill in behind it.
  const daysSinceConfession = lastConf != null
    ? daysSinceDate(lastConf)
    : profile?.last_confession_at
      ? Math.floor((Date.now() - new Date(profile.last_confession_at).getTime()) / 86400000)
      : demoMode ? demoDaysSince : null;

  // Status keys off the rule's confession frequency: within it = recent,
  // past it = due, past twice it = overdue.
  const confessionStatus = daysSinceConfession === null ? null
    : daysSinceConfession <= confFreqDays ? 'recent'
    : daysSinceConfession <= confFreqDays * 2 ? 'due'
    : 'overdue';
  const statusColor = confessionStatus === 'recent' ? colors.green : confessionStatus === 'overdue' ? colors.red : colors.yellow;
  const statusLabel = confessionStatus === 'recent' ? '✓ Recent'
    : confessionStatus === 'due' ? '⚠ Due'
    : confessionStatus === 'overdue' ? '⚠ Overdue'
    : '— log it';

  const encounterTagMap: Record<string, any> = {
    confession: { tag: '✝︎ Confession', tagBg: 'rgba(201,168,76,0.15)', tagColor: colors.goldLight },
    counseling: { tag: '◎ Counseling', tagBg: 'rgba(41,128,185,0.15)', tagColor: colors.blue },
    visit: { tag: '⊕ Pastoral Visit', tagBg: 'rgba(41,128,185,0.15)', tagColor: colors.blue },
    advice: { tag: '◇ Advice', tagBg: colors.creamDim, tagColor: colors.muted },
    phone: { tag: '◈ Call', tagBg: colors.creamDim, tagColor: colors.muted },
    group: { tag: '◉ Group', tagBg: 'rgba(93,202,135,0.12)', tagColor: colors.green },
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        {/* Header */}
        <View style={styles.topbar}>
          <TouchableOpacity
            style={[styles.chipBtn, { marginRight: 12 }]}
            onPress={() => { H.tap(); navigation.dispatch(DrawerActions.openDrawer()); }}
            hitSlop={8}
          >
            <Text style={styles.chipBtnText}>☰</Text>
          </TouchableOpacity>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={styles.subtitle}>{getDashboardSubtitle()}</Text>
            <Text style={styles.greeting}>{role === 'priest' ? clergyDisplayName(profile?.full_name) : firstName}</Text>
            {todayCelebration && (
              <Text style={styles.feastLine}>✝︎ {todayCelebration}</Text>
            )}
          </View>
          <View style={styles.topbarBtns}>
            {role === 'priest' && (
              <TouchableOpacity style={styles.chipBtn} onPress={() => { H.tap(); router.push('/(priest)'); }}>
                <Text style={styles.chipBtnText}>FOC</Text>
              </TouchableOpacity>
            )}
            {role === 'servant' && (
              <TouchableOpacity style={styles.chipBtn} onPress={() => { H.tap(); router.push('/(servant)'); }}>
                <Text style={styles.chipBtnText}>CLASS</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.chipBtn} onPress={enterCustomize}>
              <Text style={styles.chipBtnText}>⊞</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { H.tap(); router.push('/profile'); }}>
              <Avatar url={profile?.avatar_url} initials={firstName.charAt(0).toUpperCase()} size={34} style={styles.avatarBtn} textStyle={styles.avatarBtnText} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Pinned tile pair — confession + canon */}
        <View style={styles.tileRow}>
          {/* Confession tile */}
          <TouchableOpacity
            style={[styles.tile, { borderColor: confessionStatus && confessionStatus !== 'recent' ? `${statusColor}50` : colors.border }]}
            onPress={() => { H.tap(); router.push('/(tabs)/confession'); }}
            onLongPress={enterCustomize}
            activeOpacity={0.8}
          >
            <CrossIcon size={20} color={colors.gold} />
            <Text style={styles.tileBigNum}>{daysSinceConfession ?? '—'}</Text>
            <Text style={styles.tileSubLabel}>days since confession</Text>
            <View style={[styles.tileStatus, { backgroundColor: confessionStatus ? `${statusColor}20` : 'transparent' }]}>
              <Text style={[styles.tileStatusText, { color: confessionStatus ? statusColor : colors.muted }]}>{statusLabel}</Text>
            </View>
          </TouchableOpacity>

          {/* Canon tile */}
          <TouchableOpacity
            style={styles.tile}
            onPress={() => { H.tap(); router.push('/(tabs)/canon'); }}
            onLongPress={enterCustomize}
            activeOpacity={0.8}
          >
            <CandleIcon size={20} color={colors.gold} />
            <Text style={styles.tileBigNum}>
              {canonSet ? `${canonToday!.done}/${canonToday!.total}` : '—'}
            </Text>
            <Text style={styles.tileSubLabel}>canon today</Text>
            <View style={[styles.tileStatus, {
              backgroundColor: canonAllDone ? `${colors.green}20` : `${colors.yellow}20`
            }]}>
              <Text style={[styles.tileStatusText, {
                color: canonAllDone ? colors.green : colors.yellow
              }]}>
                {!canonSet ? '— set up' : canonAllDone ? '✓ All done' : '↑ In progress'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Psalms memorization entry */}
        <TouchableOpacity
          style={{ flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 16, marginBottom: 20 }}
          onPress={() => { H.tap(); router.push('/psalms'); }}
          activeOpacity={0.85}
        >
          <Harp size={24} color={colors.gold} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontFamily: fonts.latoBold, fontSize: 14, color: colors.cream, marginBottom: 2, flexShrink: 1 }}>Memorize the Psalms</Text>
            <Text style={{ fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, flexShrink: 1 }}>Agpeya psalter · spaced repetition</Text>
          </View>
          {psalmStreak > 0 && (
            <View style={{ backgroundColor: colors.gold + '22', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, marginRight: 4 }}>
              <Text style={{ fontFamily: fonts.latoBold, fontSize: 12, color: colors.goldLight }}>🔥 {psalmStreak}</Text>
            </View>
          )}
          <Text style={{ fontSize: 18, color: colors.gold }}>›</Text>
        </TouchableOpacity>

        {/* Confession CTA banner — only if due or overdue */}
        {(confessionStatus === 'due' || confessionStatus === 'overdue') && (
          <TouchableOpacity
            style={styles.banner}
            onPress={() => { H.tap(); router.push('/(tabs)/confession'); }}
            activeOpacity={0.85}
          >
            <Text style={styles.bannerCross}>✝︎</Text>
            <Text style={styles.bannerLabel}>PREPARE</Text>
            <Text style={styles.bannerTitle}>Examination of Conscience</Text>
            <Text style={styles.bannerBody}>
              {demoMode
                ? `Fr. Bishoy has confession hours this Sunday. You last confessed ${demoDaysSince} days ago.`
                : `You last confessed ${daysSinceConfession} days ago. Use the Confession tab to prepare before your next meeting.`}
            </Text>
            <View style={styles.bannerArrow}><Text style={styles.bannerArrowText}>Begin →</Text></View>
          </TouchableOpacity>
        )}

        {/* Customizable sections */}
        {sections.includes('vitals') && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Spiritual Vitals</Text>
              <Text style={[styles.sectionAction, { color: colors.muted }]}>
                {vitalsEpoch
                  ? `Since ${new Date(`${vitalsEpoch}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                  : 'All time'}
              </Text>
            </View>
            {!demoMode && profile?.foc_id && profile?.vitals_consent === false && (
              <TouchableOpacity style={styles.vitalNudge} onPress={() => setShowVitalsConsent(true)} activeOpacity={0.8}>
                <Text style={styles.vitalNudgeText}>
                  ◇ Your FOC can't see your vitals yet. Sharing helps him guide you better.{' '}
                  <Text style={styles.vitalNudgeLink}>Turn on sharing →</Text>
                </Text>
              </TouchableOpacity>
            )}
            {(vitalStats ?? []).map((s, i, rows) => (
              <VitalRow
                key={s.key}
                label={s.key === 'confession' ? 'Confession (days since)' : s.label}
                value={s.pct}
                text={s.key === 'confession' ? (daysSinceConfession != null ? `${daysSinceConfession}d` : '—') : undefined}
                last={i === rows.length - 1}
              />
            ))}
            <PrivacyNote text="Computed from your canon check-offs. Visible only to you and your Father of Confession." />
          </View>
        )}

        {sections.includes('journey') && (
          <Card title="Pastoral Journey" titleIcon="◎" action={<Text style={styles.cardAction}>View all</Text>}>
            {!demoMode && (
              <View style={styles.lastVisitRow}>
                <Text style={styles.lastVisitLabel}>Last pastoral visit</Text>
                <Text style={styles.lastVisitVal}>
                  {lastVisit
                    ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(lastVisit) ? `${lastVisit}T12:00:00` : lastVisit)
                        .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    : 'None yet'}
                </Text>
              </View>
            )}
            {demoMode ? (
              DEMO_TIMELINE.map((item, i) => (
                <TimelineRow key={i} item={item} last={i === DEMO_TIMELINE.length - 1} />
              ))
            ) : displayTimeline.length === 0 ? (
              <Text style={styles.emptyInline}>Your encounters with your FOC will appear here.</Text>
            ) : (
              displayTimeline.map((enc, i) => {
                const meta = encounterTagMap[enc.encounter_type] ?? encounterTagMap.advice;
                const item = {
                  date: new Date(enc.encountered_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase(),
                  title: meta.tag.replace(/^[^\s]+\s/, ''),
                  body: enc.member_note ?? '',
                  ...meta,
                };
                return <TimelineRow key={i} item={item} last={i === displayTimeline.length - 1} />;
              })
            )}
          </Card>
        )}

        {sections.includes('feasts') && (
          <>
            <Card title="Upcoming Feasts" titleIcon="⊕">
              {feasts.map((feast, i) => (
                <View key={i} style={[styles.feastItem, i < feasts.length - 1 && styles.feastBorder]}>
                  <View style={styles.feastDate}>
                    <Text style={styles.feastMonth}>{feast.month}</Text>
                    <Text style={styles.feastDay}>{feast.day}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.feastTitle}>{feast.title}</Text>
                    <Text style={styles.feastDesc}>{feast.desc}</Text>
                  </View>
                </View>
              ))}
            </Card>

            <Card title="Upcoming Commemorations" titleIcon="✦">
              {commems.map((c, i) => (
                <View key={i} style={[styles.feastItem, i < commems.length - 1 && styles.feastBorder]}>
                  <View style={styles.feastDate}>
                    <Text style={styles.feastMonth}>{c.month}</Text>
                    <Text style={styles.feastDay}>{c.day}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.feastTitle}>{c.title}</Text>
                    <Text style={styles.feastDesc}>{c.desc}</Text>
                  </View>
                </View>
              ))}
            </Card>
          </>
        )}

        {sections.includes('foc') && (
          <Card title="My Father of Confession" titleIcon="◉">
            {demoMode ? (
              <>
                <View style={styles.focRow}>
                  <View style={styles.focAvatar}><Text style={styles.focAvatarText}>BM</Text></View>
                  <View>
                    <Text style={styles.focName}>Fr. Bishoy Marcos</Text>
                    <Text style={styles.focChurch}>St. Mary's Coptic Orthodox Church</Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.scheduleChip} onPress={() => { H.tap(); router.push('/(tabs)/appointments?focus=confession'); }} activeOpacity={0.8}>
                  <Text style={styles.scheduleIcon}>✝︎</Text>
                  <View>
                    <Text style={styles.scheduleText}>Request Confession Appointment</Text>
                    <Text style={styles.scheduleSub}>Next available: Sunday after Liturgy</Text>
                  </View>
                </TouchableOpacity>
                {visitRequestChip}
              </>
            ) : focProfile ? (
              <>
                <View style={styles.focRow}>
                  <View style={styles.focAvatar}>
                    <Text style={styles.focAvatarText}>
                      {focProfile.full_name?.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.focName}>{clergyDisplayName(focProfile.full_name)}</Text>
                    <Text style={styles.focChurch}>{focProfile.church_name ?? ''}</Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.scheduleChip} onPress={() => { H.tap(); router.push('/(tabs)/confession'); }} activeOpacity={0.8}>
                  <Text style={styles.scheduleIcon}>✝︎</Text>
                  <View>
                    <Text style={styles.scheduleText}>Begin Confession Examination</Text>
                    <Text style={styles.scheduleSub}>Prepare before your next meeting</Text>
                  </View>
                </TouchableOpacity>
                {visitRequestChip}
              </>
            ) : (
              <Text style={styles.emptyInline}>Your Father of Confession will link your account when they set up their Nepsis profile.</Text>
            )}
          </Card>
        )}

      </ScrollView>

      {/* Vitals consent modal */}
      <Modal visible={showVitalsConsent} transparent animationType="fade" onRequestClose={() => {}}>
        <View style={styles.consentModalBg}>
          <View style={styles.consentModal}>
            <Text style={styles.consentCross}>✝︎</Text>
            <Text style={styles.consentTitle}>Share Your Vitals?</Text>
            <Text style={styles.consentSub}>with {focProfile?.full_name ? clergyDisplayName(focProfile.full_name) : 'your Father of Confession'}</Text>
            <Text style={styles.consentBody}>
              Sharing your spiritual vitals lets your FOC understand how you're doing and guide you more intentionally between confessions. You can change this at any time in your profile.
            </Text>
            <TouchableOpacity
              style={[styles.consentGoldBtn, settingConsent && { opacity: 0.6 }]}
              onPress={() => handleVitalsConsent(true)}
              disabled={settingConsent}
              activeOpacity={0.85}
            >
              <Text style={styles.consentGoldBtnText}>
                {settingConsent ? 'Saving…' : 'SHARE WITH MY FOC'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleVitalsConsent(false)} disabled={settingConsent}>
              <Text style={styles.consentSkipText}>Keep private for now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Customize sheet */}
      <CustomizeSheet
        visible={customizing}
        active={sections}
        onSave={handleSaveSections}
        onClose={() => { wiggleLoop.current?.stop(); wiggle.setValue(0); setCustomizing(false); }}
      />
    </SafeAreaView>
  );
}

const styles = lazyThemed(() => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.navy },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 48 },

  topbar: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 },
  topbarBtns: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  chipBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  chipBtnText: { fontFamily: fonts.latoBold, fontSize: 10, color: colors.muted, letterSpacing: 1 },
  avatarBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.goldDim, borderWidth: 1, borderColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
  avatarBtnText: { fontFamily: fonts.cormorantMedium, fontSize: 16, color: colors.goldLight },
  subtitle: { fontFamily: fonts.latoBold, fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: colors.gold, opacity: 0.7, marginBottom: 4 },
  greeting: { fontFamily: fonts.cormorantMedium, fontSize: 30, color: colors.cream, lineHeight: 36 },
  feastLine: { fontFamily: fonts.latoBold, fontSize: 11, color: colors.goldLight, marginTop: 3, letterSpacing: 0.3 },

  // Tile pair
  tileRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  tile: {
    width: TILE_W, height: 138, backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1, borderColor: colors.border, borderRadius: 16,
    padding: 14, justifyContent: 'space-between',
  },
  tileIcon: { fontSize: 18 },
  tileBigNum: { fontFamily: fonts.cormorantMedium, fontSize: 34, color: colors.cream, lineHeight: 38, marginTop: 4 },
  tileSubLabel: { fontFamily: fonts.latoLight, fontSize: 10, color: colors.muted, lineHeight: 14, marginTop: -2 },
  tileStatus: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, alignSelf: 'flex-start' },
  tileStatusText: { fontFamily: fonts.latoBold, fontSize: 9, letterSpacing: 0.5 },

  // Confession CTA banner
  banner: {
    backgroundColor: 'rgba(201,168,76,0.07)', borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.25)', borderRadius: 14, padding: 18,
    marginBottom: 20, overflow: 'hidden', position: 'relative',
  },
  bannerCross: { position: 'absolute', right: 12, top: 6, fontSize: 52, color: 'rgba(201,168,76,0.07)', fontFamily: fonts.cormorant },
  bannerLabel: { fontFamily: fonts.latoBold, fontSize: 9, letterSpacing: 2.5, color: colors.gold, marginBottom: 4 },
  bannerTitle: { fontFamily: fonts.cormorantMedium, fontSize: 19, color: colors.cream, marginBottom: 6 },
  bannerBody: { fontFamily: fonts.latoLight, fontSize: 13, color: colors.muted, lineHeight: 20, maxWidth: '88%' },
  bannerArrow: { marginTop: 12 },
  bannerArrowText: { fontFamily: fonts.latoBold, fontSize: 11, color: colors.gold, letterSpacing: 0.5 },

  // Sections
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 },
  sectionTitle: { fontFamily: fonts.cormorantItalic, fontSize: 18, color: colors.cream },
  sectionAction: { fontFamily: fonts.latoBold, fontSize: 11, color: colors.gold },

  // Vital drag rows
  vitalRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  vitalLabel: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, flex: 1 },
  vitalTrack: { width: 80, height: 18, justifyContent: 'center', flexShrink: 0 },
  vitalFill: { height: 4, backgroundColor: colors.gold, borderRadius: 4 },
  vitalVal: { fontFamily: fonts.latoBold, fontSize: 12, color: colors.cream, width: 34, textAlign: 'right' },

  // Vitals nudge banner
  vitalNudge: {
    backgroundColor: 'rgba(201,168,76,0.07)', borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.2)', borderRadius: 10,
    padding: 12, marginBottom: 14,
  },
  vitalNudgeText: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, lineHeight: 18 },
  vitalNudgeLink: { fontFamily: fonts.latoBold, color: colors.gold },

  // Vitals consent modal
  consentModalBg: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  consentModal: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 20, padding: 28, alignItems: 'center', width: '100%', maxWidth: 360,
  },
  consentCross: { fontSize: 32, color: colors.gold, marginBottom: 12 },
  consentTitle: { fontFamily: fonts.cormorantMedium, fontSize: 24, color: colors.cream, textAlign: 'center', marginBottom: 4 },
  consentSub: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.gold, textAlign: 'center', marginBottom: 16, opacity: 0.85 },
  consentBody: { fontFamily: fonts.latoLight, fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  consentGoldBtn: {
    backgroundColor: colors.gold, borderRadius: 10,
    paddingVertical: 14, paddingHorizontal: 24, width: '100%', alignItems: 'center', marginBottom: 16,
  },
  consentGoldBtnText: { fontFamily: fonts.latoBold, fontSize: 12, color: colors.navy, letterSpacing: 1.5 },
  consentSkipText: { fontFamily: fonts.latoLight, fontSize: 13, color: colors.muted, textDecorationLine: 'underline' },

  cardAction: { fontFamily: fonts.lato, fontSize: 11, color: colors.gold },
  emptyInline: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, lineHeight: 18, opacity: 0.7 },
  lastVisitRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  lastVisitLabel: { fontFamily: fonts.latoBold, fontSize: 9, letterSpacing: 1.2, color: colors.muted, textTransform: 'uppercase' },
  lastVisitVal: { fontFamily: fonts.lato, fontSize: 13, color: colors.cream },

  // Timeline
  tlRow: { flexDirection: 'row', gap: 14 },
  tlDotCol: { alignItems: 'center', width: 14 },
  tlDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.gold, marginTop: 4 },
  tlDotDim: { backgroundColor: colors.muted },
  tlLine: { width: 1, flex: 1, backgroundColor: colors.border, marginTop: 4 },
  tlBodyCol: { flex: 1, paddingBottom: 4 },
  tlDate: { fontFamily: fonts.latoBold, fontSize: 9, letterSpacing: 1.5, color: colors.gold, opacity: 0.7, marginBottom: 3 },
  tlTitle: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.cream, marginBottom: 2 },
  tlBody: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, lineHeight: 18 },
  tlTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20, alignSelf: 'flex-start', marginTop: 6 },
  tlTagText: { fontFamily: fonts.latoBold, fontSize: 10, letterSpacing: 0.5 },

  // Feasts
  feastItem: { flexDirection: 'row', gap: 14, paddingVertical: 12, alignItems: 'flex-start' },
  feastBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  feastDate: { backgroundColor: colors.goldDim, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 8, alignItems: 'center', minWidth: 42 },
  feastMonth: { fontFamily: fonts.latoBold, fontSize: 9, letterSpacing: 1, color: colors.gold },
  feastDay: { fontFamily: fonts.cormorantMedium, fontSize: 22, color: colors.cream, lineHeight: 26 },
  feastTitle: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.cream, marginBottom: 2 },
  feastDesc: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, lineHeight: 16 },

  // FOC
  focRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  focAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.blueBg, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  focAvatarText: { fontFamily: fonts.cormorantMedium, fontSize: 16, color: colors.blue },
  focName: { fontFamily: fonts.latoBold, fontSize: 14, color: colors.cream },
  focChurch: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted },
  scheduleChip: { flexDirection: 'row', gap: 10, backgroundColor: colors.goldDim, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, alignItems: 'center' },
  scheduleIcon: { fontSize: 18 },
  scheduleText: { fontFamily: fonts.latoBold, fontSize: 12, color: colors.cream },
  scheduleSub: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, marginTop: 1 },
  visitChip: { flexDirection: 'row', gap: 10, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 8 },
  visitChipActive: { borderColor: colors.green, backgroundColor: colors.greenBg },
  visitCheck: { fontFamily: fonts.latoBold, fontSize: 16, color: colors.green },
  visitChevron: { fontSize: 18, color: colors.gold },
}));
