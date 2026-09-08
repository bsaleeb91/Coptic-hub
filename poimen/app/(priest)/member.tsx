import React, { useState, useEffect, useCallback } from 'react';
import {
  ScrollView, View, Text, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Modal, Linking, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { colors, fonts , lazyThemed } from '@/lib/theme';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { CandleIcon } from '@/components/ui/TabIcons';
import Harp from '@/components/ui/Harp';
import { useSession } from '@/lib/auth';
import { confirmDestructive } from '@/lib/confirm';
import { pickPhoto, uploadAvatarImage, removeAvatarImage, newFlockPhotoPath, pathFromAvatarUrl, cameraAvailable, PhotoSource } from '@/lib/avatar';
import { latestConfessionMs, daysSinceMs } from '@/lib/confession/dates';
import * as db from '@/lib/db';
import { useDemoMode } from '@/lib/demo';
import { decryptFromSender } from '@/lib/crypto';
import { VITAL_CATEGORIES } from '@/lib/canon/history';
import { RuleConfig, WEEKDAYS, AGPEYA_HOURS, SERVICES } from '@/lib/canon/rule-store';
import { periodNoun } from '@/lib/canon/periods';
import { loadMemberRule } from '@/lib/canon/rule-sync';
import { AssignedCategory, applyOverlay, loadAssignedForPriest } from '@/lib/canon/assigned';

// Local YYYY-MM-DD of a timestamp — the lock model compares calendar days.
function localDayOf(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const SUMMARY_CATEGORY: Record<string, AssignedCategory> = {
  'Prostrations': 'prostrations',
  'Quiet time': 'quiet',
  'Fasting': 'fasting',
  'Bible': 'bible',
  'Spiritual book': 'book',
  'Confession': 'confession',
  'Agpeya hours': 'agpeya_hours',
  'Church services': 'services',
  'Heart of Service': 'heart_of_service',
};

// Compact FOC-facing summary of a member's self-set rule. Long option names
// collapse to their short form ("First Hour (Prime)" → "Prime").
function ruleSummaryLines(r: RuleConfig): { label: string; value: string }[] {
  const dayName = (i: number) => WEEKDAYS[i].slice(0, 3);
  const shortName = (full: string) => {
    const m = full.match(/\(([^)]+)\)/);
    return m ? m[1] : full;
  };
  const hourName = (k: string) => shortName(AGPEYA_HOURS.find(h => h.key === k)?.name ?? k);
  const svcName = (k: string) => (SERVICES.find(s => s.key === k)?.name ?? k).split(' (')[0];

  const lines: { label: string; value: string }[] = [
    { label: 'Prostrations', value: r.prostrations > 0 ? `${r.prostrations} daily` : 'None' },
    { label: 'Quiet time', value: `${r.quietMinutes} min daily` },
    { label: 'Fasting', value: `Until ${r.fastUntil} on fasting days` },
    { label: 'Bible', value: `${r.bible.amount} ${r.bible.mode} daily` },
  ];
  if (r.book) lines.push({ label: 'Spiritual book', value: `${r.book.title || 'Untitled'} — ${r.book.amount} ${r.book.mode}` });
  lines.push({ label: 'Confession', value: r.confession });

  const agpeya = r.days
    .map((d, i) => (d.hours.length ? `${dayName(i)} · ${d.hours.map(hourName).join(', ')}` : null))
    .filter(Boolean) as string[];
  if (agpeya.length) lines.push({ label: 'Agpeya hours', value: agpeya.join('\n') });

  // Services are committed either by weekday or by times-per-period, never both.
  if (r.servicesMode === 'counts') {
    const counts = SERVICES
      .filter(sv => (r.serviceCounts?.[sv.key]?.n ?? 0) > 0)
      .map(sv => `${svcName(sv.key)} · ${r.serviceCounts[sv.key].n}× per ${periodNoun(r.serviceCounts[sv.key].freq)}`);
    if (counts.length) lines.push({ label: 'Church services', value: counts.join('\n') });
  } else {
    const services = r.days
      .map((d, i) => (d.services.length ? `${dayName(i)} · ${d.services.map(svcName).join(', ')}` : null))
      .filter(Boolean) as string[];
    if (services.length) lines.push({ label: 'Church services', value: services.join('\n') });
  }

  const serving = r.days
    .map((d, i) => (d.serving.length ? `${dayName(i)} · ${d.serving.map(s => `${s.text} (${s.freq})`).join(', ')}` : null))
    .filter(Boolean) as string[];
  if (serving.length) lines.push({ label: 'Heart of Service', value: serving.join('\n') });

  return lines;
}

// ── Demo data ─────────────────────────────────────────────────
const DEMO_DB: Record<string, {
  member: any; contact: any; life: any; children: any[];
  vitals: Record<string, number | null>; confessions: any[]; prayer: any[]; canons: any[]; note: string;
  psalm: { streak: number; longestStreak: number; masteredItems: number } | null;
}> = {
  'demo-mh': {
    member: { initials: 'MH', name: 'Michael Hanna', stage: 'Growing', joined: 'September 2024', daysSince: 47, flagged: false, flagNote: '' },
    contact: { phone: '(614) 555-0214', email: 'mhanna@example.com', address_line1: '1190 Oak Hill Rd', address_line2: null, city: 'Columbus', state: 'OH', zip: '43235', country: 'US' },
    life: { life_stage: 'married', spouse_name: 'Nadia Hanna' },
    children: [{ id: 'dc1', name: 'Kyrillos', birth_year: 2024 }],
    vitals: { prayer: 75, quiet: 55, scripture: 50, book: null, liturgy: 80, communion: 65, fasting: 60, service: 25, confession: null },
    confessions: [{ date: 'APR 20, 2026', type: 'Holy Confession', note: 'Discussed new-father anxieties. Encouraged daily Agpeya.' }, { date: 'FEB 5, 2026', type: 'Holy Confession', note: 'Pre-birth spiritual preparation.' }],
    prayer: [{ date: 'MAY 4, 2026', topic: 'Gratitude for new baby — prayers of thanksgiving' }, { date: 'MAR 10, 2026', topic: 'Wisdom as a new father' }],
    canons: [{ id: 'c1', component: 'Morning Agpeya', frequency: 'Daily', startDate: 'Apr 21, 2026', completions: 5, totalDays: 7 }, { id: 'c2', component: 'Psalm reading (1 chapter)', frequency: 'Daily', startDate: 'Apr 21, 2026', completions: 4, totalDays: 7 }],
    note: 'Growing well since the birth of Kyrillos. Pastoral visit May 4 was fruitful. Follow up on consistent Agpeya practice — suggested praying together as a couple after the baby sleeps.',
    psalm: { streak: 6, longestStreak: 14, masteredItems: 3 },
  },
  'demo-sg': {
    member: { initials: 'SG', name: 'Sara Girgis', stage: 'Mature', joined: 'March 2021', daysSince: 18, flagged: false, flagNote: '' },
    contact: { phone: '(614) 555-0339', email: 'sgirgis@example.com', address_line1: '408 Granville St', address_line2: null, city: 'Columbus', state: 'OH', zip: '43215', country: 'US' },
    life: { life_stage: 'single', spouse_name: '' },
    children: [],
    vitals: { prayer: 90, quiet: 85, scripture: 85, book: 70, liturgy: 100, communion: 85, fasting: 88, service: 100, confession: null },
    confessions: [{ date: 'MAY 21, 2026', type: 'Holy Confession', note: 'Discussed vocation discernment. Encouraged continued prayer and patience.' }, { date: 'MAR 3, 2026', type: 'Holy Confession', note: 'Lenten preparation.' }, { date: 'JAN 8, 2026', type: 'Holy Confession', note: 'Start-of-year spiritual plan.' }],
    prayer: [{ date: 'MAY 20, 2026', topic: 'Discernment of vocation — monastery vs. marriage' }],
    canons: [{ id: 'c1', component: 'Complete Agpeya (all 7 hours)', frequency: 'Daily', startDate: 'Jan 9, 2026', completions: 6, totalDays: 7 }, { id: 'c2', component: 'Bible reading (2 chapters)', frequency: 'Daily', startDate: 'Jan 9, 2026', completions: 6, totalDays: 7 }],
    note: 'Spiritually mature and consistent. Currently in a season of vocational discernment. Needs gentle guidance, not pressure. Recommend reading Fr. Matta El-Meskeen on the monastic call.',
    psalm: { streak: 41, longestStreak: 41, masteredItems: 11 },
  },
  'demo-pb': {
    member: { initials: 'PB', name: 'Peter Botros', stage: 'New', joined: 'February 2026', daysSince: 74, flagged: true, flagNote: 'Missed two follow-up appointments.' },
    contact: { phone: '(614) 555-0182', email: 'pbotros@example.com', address_line1: '2847 Riverside Dr', address_line2: null, city: 'Columbus', state: 'OH', zip: '43221', country: 'US' },
    life: { life_stage: 'married', spouse_name: 'Maria Botros' },
    children: [{ id: 'dc1', name: 'Anthony', birth_year: 2018 }, { id: 'dc2', name: 'Mary', birth_year: 2021 }],
    vitals: { prayer: 20, quiet: 10, scripture: 30, book: null, liturgy: 45, communion: 30, fasting: 20, service: 0, confession: null },
    confessions: [{ date: 'FEB 25, 2026', type: 'Holy Confession', note: 'Set spiritual goals.' }, { date: 'FEB 11, 2026', type: 'Introductory Meeting', note: 'Getting to know one another.' }],
    prayer: [{ date: 'MAY 28, 2026', topic: 'Job transition — feeling lost' }, { date: 'MAY 5, 2026', topic: 'Family reconciliation with brother' }],
    canons: [{ id: 'c1', component: 'Morning Agpeya', frequency: 'Daily', startDate: 'Mar 1, 2026', completions: 1, totalDays: 7 }, { id: 'c2', component: 'Gospel Reading (1 chapter)', frequency: 'Daily', startDate: 'Mar 1, 2026', completions: 2, totalDays: 7 }],
    note: 'Needs consistent follow-up. Has expressed interest in deepening faith but struggles with consistency. Suggested accountability partner from the young adult group.',
    psalm: null,
  },
  'demo-mm': {
    member: { initials: 'MM', name: 'Mary Mikhail', stage: 'Growing', joined: 'June 2023', daysSince: 29, flagged: false, flagNote: '' },
    contact: { phone: '(614) 555-0471', email: 'mmkhail@example.com', address_line1: '93 Olentangy Blvd', address_line2: 'Apt 4B', city: 'Columbus', state: 'OH', zip: '43202', country: 'US' },
    life: { life_stage: 'married', spouse_name: 'Fady Mikhail' },
    children: [{ id: 'dc1', name: 'Bishoy', birth_year: 2020 }, { id: 'dc2', name: 'Irene', birth_year: 2023 }],
    vitals: { prayer: 65, quiet: 50, scripture: 60, book: null, liturgy: 75, communion: 60, fasting: 58, service: 50, confession: null },
    confessions: [{ date: 'MAY 10, 2026', type: 'Holy Confession', note: 'Marriage enrichment focus. Prayed together with Fady.' }, { date: 'FEB 28, 2026', type: 'Holy Confession', note: 'Lenten preparation. Addressed anxiety about second child.' }],
    prayer: [{ date: 'APR 30, 2026', topic: 'Peace in marriage — communication difficulties' }, { date: 'MAR 15, 2026', topic: 'Healing for mother-in-law' }],
    canons: [{ id: 'c1', component: 'Evening Prayer (Compline)', frequency: 'Daily', startDate: 'Mar 1, 2026', completions: 5, totalDays: 7 }, { id: 'c2', component: 'Bible reading (1 chapter)', frequency: 'Daily', startDate: 'Mar 1, 2026', completions: 4, totalDays: 7 }],
    note: 'Consistent growth. Fady and Mary attend together which is encouraging. Consider inviting them to lead a young couples\' small group — they have the maturity for it.',
    psalm: { streak: 2, longestStreak: 9, masteredItems: 1 },
  },
  'demo-ag': {
    member: { initials: 'AG', name: 'Andrew George', stage: 'Seeking', joined: 'January 2026', daysSince: 92, flagged: true, flagNote: 'New to the church — needs initial meeting.' },
    contact: { phone: '(614) 555-0598', email: 'ageorge@example.com', address_line1: '5120 Kenny Rd', address_line2: null, city: 'Columbus', state: 'OH', zip: '43220', country: 'US' },
    life: { life_stage: 'single', spouse_name: '' },
    children: [],
    vitals: { prayer: null, quiet: null, scripture: null, book: null, liturgy: 25, communion: 10, fasting: null, service: null, confession: null },
    confessions: [],
    prayer: [{ date: 'MAY 1, 2026', topic: 'Searching for meaning — career feels empty' }],
    canons: [],
    note: 'Has not had a first confession yet. Moved from Chicago in January. Attends Sunday Liturgy irregularly. Needs a warm personal invitation — try a phone call this week before Sunday.',
    psalm: null,
  },
  'demo-cn': {
    member: { initials: 'CN', name: 'Christine Naguib', stage: 'Multiplying', joined: 'April 2019', daysSince: 35, flagged: false, flagNote: '' },
    contact: { phone: '(614) 555-0623', email: 'cnaguib@example.com', address_line1: '711 Worthington Ave', address_line2: null, city: 'Columbus', state: 'OH', zip: '43085', country: 'US' },
    life: { life_stage: 'married', spouse_name: 'Mina Naguib' },
    children: [{ id: 'dc1', name: 'Verena', birth_year: 2017 }, { id: 'dc2', name: 'Mark', birth_year: 2019 }, { id: 'dc3', name: 'Irini', birth_year: 2022 }],
    vitals: { prayer: 95, quiet: 90, scripture: 90, book: 85, liturgy: 100, communion: 85, fasting: 92, service: 100, confession: null },
    confessions: [{ date: 'MAY 5, 2026', type: 'Holy Confession', note: 'Strong spiritually. Discussed leading the women\'s Bible study.' }, { date: 'FEB 20, 2026', type: 'Holy Confession', note: 'Lenten reflection — themes of gratitude and service.' }, { date: 'NOV 10, 2025', type: 'Holy Confession', note: 'Pre-Advent preparation.' }],
    prayer: [{ date: 'APR 25, 2026', topic: 'Guidance for Verena\'s school transition' }],
    canons: [{ id: 'c1', component: 'Midnight Praise (Tasbeha)', frequency: 'Weekly', startDate: 'Jan 1, 2026', completions: 6, totalDays: 7 }, { id: 'c2', component: 'Bible reading (3 chapters)', frequency: 'Daily', startDate: 'Jan 1, 2026', completions: 6, totalDays: 7 }],
    note: 'One of the strongest members of the flock. Mentoring two younger women. Consider formally appointing her to lead the women\'s spiritual development group.',
    psalm: { streak: 87, longestStreak: 112, masteredItems: 22 },
  },
};

function getDemoData(id: string) {
  return DEMO_DB[id] ?? DEMO_DB['demo-pb'];
}

// Render the member's vital categories from a stored payload (the same
// map the member mirrors to agent_progress['vitals']). A key that's absent is
// "not shared"; a key present but null had nothing ever due, so it reads "—".
function vitalsFromPayload(payload: Record<string, number | null> | null | undefined) {
  const v = payload ?? {};
  return VITAL_CATEGORIES.map(c => ({
    key: c.key,
    label: c.label,
    pct: c.key in v ? v[c.key] : null,
    shared: c.key in v,
  }));
}

type TabType = 'overview' | 'canon' | 'prayer' | 'notes';
const TABS: { value: TabType; label: string }[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'canon', label: 'Canon' },
  { value: 'prayer', label: 'Prayer' },
  { value: 'notes', label: 'Notes' },
];

// ── Helpers ───────────────────────────────────────────────────
function initials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.split(' ');
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

function formatLifeStageLine(ls: any, kids: any[]): string | null {
  if (!ls?.life_stage) return null;
  const stage = ls.life_stage.charAt(0).toUpperCase() + ls.life_stage.slice(1);
  const yr = new Date().getFullYear();
  const parts: string[] = [stage];
  if (kids.length > 0) {
    const ages = kids.map((k: any) => `~${yr - k.birth_year}`).join(', ');
    parts.push(`${kids.length} ${kids.length === 1 ? 'child' : 'children'} (${ages})`);
  }
  return parts.join(' · ');
}

export default function MemberScreen() {
  const router = useRouter();
  const { id: memberId, name: memberName } = useLocalSearchParams<{ id: string; name: string }>();
  const { user } = useSession();
  const { demoMode } = useDemoMode();
  const [tab, setTab] = useState<TabType>('overview');
  const [loading, setLoading] = useState(!demoMode);

  const demo = getDemoData(memberId ?? '');

  // Display data
  const [memberInfo, setMemberInfo] = useState<any>(demo.member);
  const [contact, setContact] = useState<any>(demoMode ? demo.contact : null);
  const [lifeStageData, setLifeStageData] = useState<any>(demoMode ? demo.life : null);
  const [memberChildren, setMemberChildren] = useState<any[]>(demoMode ? demo.children : []);
  const [vitals, setVitals] = useState<any[]>(vitalsFromPayload(demo.vitals));
  const [psalmStats, setPsalmStats] = useState<{ streak: number; longestStreak: number; masteredItems: number } | null>(demoMode ? demo.psalm : null);
  const [confessions, setConfessions] = useState<any[]>(demo.confessions);
  const [prayerRequests, setPrayerRequests] = useState<any[]>(demo.prayer);
  const [canons, setCanons] = useState<any[]>(demo.canons);

  // Notes state
  const [notes, setNotes] = useState<db.PastoralNote[]>(
    demo.note ? [{ id: 'demo-note-1', author_id: 'demo-priest', member_id: memberId ?? '', body: demo.note, created_at: new Date(Date.now() - 86400000 * 10).toISOString(), updated_at: new Date(Date.now() - 86400000 * 10).toISOString() }] : []
  );
  const [newNoteText, setNewNoteText] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [addNoteError, setAddNoteError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [noteError, setNoteError] = useState('');

  // Contact sheet
  const [showContactSheet, setShowContactSheet] = useState(false);

  // The member's EFFECTIVE canon: their self-set rule with this priest's
  // still-locked assignments overlaid — what the member's Canon tab shows.
  const [memberRule, setMemberRule] = useState<RuleConfig | null>(null);
  const [assignedCats, setAssignedCats] = useState<Set<AssignedCategory>>(new Set());
  const [customCount, setCustomCount] = useState(0);
  const [lastVisit, setLastVisit] = useState<string | null>(demoMode ? '2026-05-04' : null);
  const [visitRequested, setVisitRequested] = useState(false);

  // Photos: the member's own picture (profiles.avatar_url) wins; otherwise
  // this priest's roster photo (member_photos, visible only to him).
  const [memberAvatarUrl, setMemberAvatarUrl] = useState<string | null>(null);
  const [myPhotoUrl, setMyPhotoUrl] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState('');

  async function addMemberPhoto(source: PhotoSource) {
    if (!user || !memberId || photoBusy) return;
    setPhotoError('');
    setPhotoBusy(true);   // before the picker, so a double-tap can't open two
    try {
      const base64 = await pickPhoto(source);
      if (!base64) return;
      // Fresh random path per upload (see newFlockPhotoPath); drop the old object.
      const oldPath = myPhotoUrl ? pathFromAvatarUrl(myPhotoUrl) : null;
      const { url, error } = await uploadAvatarImage(newFlockPhotoPath(user.id, memberId), base64);
      if (!url) { setPhotoError(`Couldn't upload: ${error}`); return; }
      const { error: dbErr } = await db.upsertMemberPhoto(user.id, memberId, url);
      if (dbErr) { setPhotoError(`Couldn't save: ${dbErr}`); return; }
      if (oldPath) removeAvatarImage(oldPath);
      setMyPhotoUrl(url);
    } finally {
      setPhotoBusy(false);
    }
  }

  function removeMemberPhoto() {
    if (!user || !memberId || !myPhotoUrl) return;
    confirmDestructive('Remove photo', 'Remove the photo you added for this member?', 'Remove', async () => {
      setPhotoBusy(true);
      const path = pathFromAvatarUrl(myPhotoUrl);
      const { error } = await db.deleteMemberPhoto(user.id, memberId);
      if (error) { setPhotoError(`Couldn't remove: ${error}`); setPhotoBusy(false); return; }
      if (path) removeAvatarImage(path);
      setMyPhotoUrl(null);
      setPhotoBusy(false);
    });
  }

  const loadEffectiveRule = useCallback(async (lastConfessionIso: string | null) => {
    const [base, assigned] = await Promise.all([
      loadMemberRule(memberId ?? '', demoMode),
      loadAssignedForPriest(memberId ?? '', user?.id ?? '', demoMode),
    ]);
    if (!base) { setMemberRule(null); setAssignedCats(new Set()); setCustomCount(0); return; }
    const overlay = applyOverlay(base, assigned, lastConfessionIso ? localDayOf(lastConfessionIso) : null);
    setMemberRule(overlay.rule);
    setAssignedCats(overlay.lockedCategories);
    setCustomCount(overlay.customComponents.length);
  }, [memberId, demoMode, user?.id]);

  // Total canon components the member follows = the effective rule's shown
  // components plus any free-text custom ones — not just the priest-assigned
  // rows, so the count matches the full Current Canon below.
  const canonCount = memberRule ? ruleSummaryLines(memberRule).length + customCount : canons.length;

  useFocusEffect(
    useCallback(() => {
      if (demoMode) loadEffectiveRule(null);
      if (demoMode) {
        const d = getDemoData(memberId ?? '');
        setVisitRequested(d.member.name === 'Peter Botros');
        setMemberAvatarUrl(null);
        setMyPhotoUrl(null);
        setMemberInfo(d.member);
        setContact(d.contact);
        setLifeStageData(d.life);
        setMemberChildren(d.children);
        setVitals(vitalsFromPayload(d.vitals));
        setPsalmStats(d.psalm);
        setConfessions(d.confessions);
        setPrayerRequests(d.prayer);
        setCanons(d.canons);
        setNotes(d.note ? [{ id: 'demo-note-1', author_id: 'demo-priest', member_id: memberId ?? '', body: d.note, created_at: new Date(Date.now() - 86400000 * 10).toISOString(), updated_at: new Date(Date.now() - 86400000 * 10).toISOString() }] : []);
      } else if (memberId) {
        loadMemberData();
      }
    }, [memberId, demoMode, loadEffectiveRule])
  );

  async function loadMemberData() {
    if (!user || !memberId) return;
    setLoading(true);

    const [profileData, vitalsPayload, psalmStatsPayload, confData, confDatesPayload, prayerData, canonData, notesData, contactData, lifeData, kidsData] =
      await Promise.all([
        db.getMemberProfile(memberId),
        db.getAgentProgress(memberId, 'vitals'),
        db.getAgentProgress(memberId, 'psalm-stats'),
        db.getConfessionsForCongregant(memberId),
        db.getAgentProgress(memberId, 'confession-dates'),
        db.getFocPrayerRequests(memberId),
        db.getMemberActiveCanons(memberId),
        db.getPastoralNotes(user.id, memberId),
        db.getContact(memberId),
        db.getLifeProfile(memberId),
        db.getChildren(memberId),
      ]);

    loadEffectiveRule(profileData?.last_confession_at ?? null);
    db.getLastEncounterDate(memberId, 'visit').then(setLastVisit);
    db.getVisitRequest(memberId).then(r => setVisitRequested(r.active));
    db.getMemberPhoto(user.id, memberId).then(setMyPhotoUrl);
    setMemberAvatarUrl(profileData?.avatar_url ?? null);

    if (profileData) {
      const p = profileData;
      const joined = new Date(p.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      // Latest of the priest's logged confession encounters and the member's
      // own self-reported confession (profiles.last_confession_at) — the same
      // event may exist in both, so taking the newest never double-counts.
      const lastMs = latestConfessionMs(confData?.[0]?.encountered_at, p.last_confession_at);
      // Count local calendar days (not raw elapsed 24h) so this matches the
      // member's own "days since confession".
      const daysSince = lastMs != null ? daysSinceMs(lastMs) : null;
      setMemberInfo({ initials: initials(memberName ?? p.full_name), name: memberName ?? p.full_name, stage: '', joined, daysSince, flagged: false, flagNote: '' });
    }

    if (vitalsPayload) {
      // Mirror the member's own eight vital categories exactly (same keys/labels
      // the member computes from their canon adherence).
      setVitals(vitalsFromPayload(vitalsPayload as Record<string, number | null>));
    } else if (!demoMode) {
      setVitals([]);
    }

    setPsalmStats(psalmStatsPayload ? {
      streak: psalmStatsPayload.streak ?? 0,
      longestStreak: psalmStatsPayload.longestStreak ?? 0,
      masteredItems: psalmStatsPayload.masteredItems ?? 0,
    } : null);

    {
      // Priest-logged confession encounters merged with the member's own
      // self-reported dates (a dates-only mirror — never content). A same-day
      // pair collapses to the logged encounter, which carries the note.
      const fmtDay = (ms: number) => new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
      const encRows = (confData ?? []).map((c: any) => ({
        ms: new Date(c.encountered_at).getTime(),
        day: localDayOf(c.encountered_at),
        type: 'Holy Confession',
        note: c.member_note ?? '',
      }));
      const encDays = new Set(encRows.map(r => r.day));
      const selfDates: string[] = Array.isArray((confDatesPayload as any)?.dates) ? (confDatesPayload as any).dates : [];
      const selfRows = selfDates
        .filter(d => typeof d === 'string' && !encDays.has(d))
        .map(d => ({
          ms: new Date(`${d}T12:00:00`).getTime(),
          day: d,
          type: 'Holy Confession',
          note: 'Self-reported by the member',
        }));
      setConfessions(
        [...encRows, ...selfRows]
          .sort((a, b) => b.ms - a.ms)
          .map(r => ({ date: fmtDay(r.ms), type: r.type, note: r.note })),
      );
    }

    if (prayerData) {
      const senderPubKey = await db.getPublicKey(memberId);
      const decryptedPrayers = await Promise.all(prayerData.map(async p => ({
        date: new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase(),
        topic: p.category,
        body: (p.body_foc && senderPubKey) ? await decryptFromSender(p.body_foc, senderPubKey) : null,
      })));
      setPrayerRequests(decryptedPrayers);
    }

    if (canonData) {
      // completions/totalDays over the trailing week — same measure the
      // servant's student view uses, so "how is this going" reads the same
      // way across both pastoral roles.
      const enriched = await Promise.all(canonData.map(async (c: any) => {
        const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
        const count = await db.countCanonCompletionsSince(c.id, sevenDaysAgo);
        return { id: c.id, component: c.component, frequency: c.frequency, startDate: c.start_date, completions: count, totalDays: 7 };
      }));
      setCanons(enriched);
    }

    setNotes(notesData);

    if (contactData) setContact(contactData);
    if (lifeData) setLifeStageData(lifeData);
    if (kidsData) setMemberChildren(kidsData);

    setLoading(false);
  }

  async function handleAddNote() {
    if (!newNoteText.trim()) return;
    if (demoMode) {
      const n: db.PastoralNote = { id: `demo-${Date.now()}`, author_id: 'demo-priest', member_id: memberId ?? '', body: newNoteText.trim(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      setNotes(prev => [n, ...prev]);
      setNewNoteText('');
      return;
    }
    setAddingNote(true);
    setAddNoteError('');
    const { data, error } = await db.insertPastoralNote(user!.id, memberId!, newNoteText.trim());
    setAddingNote(false);
    if (error || !data) { setAddNoteError('Failed to save — please try again.'); return; }
    setNotes(prev => [data, ...prev]);
    setNewNoteText('');
  }

  function handleStartEdit(note: db.PastoralNote) {
    setEditingId(note.id);
    setEditText(note.body);
    setEditError('');
  }

  async function handleSaveEdit() {
    if (!editingId || !editText.trim()) return;
    if (demoMode) {
      setNotes(prev => prev.map(n => n.id === editingId ? { ...n, body: editText.trim(), updated_at: new Date().toISOString() } : n));
      setEditingId(null);
      return;
    }
    setSavingEdit(true);
    setEditError('');
    const { error } = await db.updatePastoralNote(editingId, editText.trim());
    setSavingEdit(false);
    if (error) { setEditError('Failed to save — please try again.'); return; }
    setNotes(prev => prev.map(n => n.id === editingId ? { ...n, body: editText.trim(), updated_at: new Date().toISOString() } : n));
    setEditingId(null);
  }

  async function handleDeleteNote(noteId: string) {
    if (demoMode) { setNotes(prev => prev.filter(n => n.id !== noteId)); return; }
    setDeletingId(noteId);
    await db.deletePastoralNote(noteId);
    setNotes(prev => prev.filter(n => n.id !== noteId));
    setDeletingId(null);
  }

  function openMaps() {
    if (!contact?.address_line1) return;
    // Country included so an address outside the US resolves to the right place.
    const parts = [contact.address_line1, contact.address_line2, contact.city, contact.state, contact.zip, contact.country].filter(Boolean);
    const encoded = encodeURIComponent(parts.join(', '));
    const url = Platform.OS === 'ios' ? `maps:?q=${encoded}` : `geo:0,0?q=${encoded}`;
    Linking.openURL(url);
  }

  const daysSince = memberInfo?.daysSince;
  const sinceTxt = daysSince !== null && daysSince !== undefined ? `${daysSince}d` : '—';
  const sinceColor = daysSince === null || daysSince === undefined ? colors.muted : daysSince < 30 ? colors.green : daysSince < 60 ? colors.yellow : colors.red;
  const lifeStageDisplay = formatLifeStageLine(lifeStageData, memberChildren);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>

        <TouchableOpacity style={styles.backRow} onPress={() => router.push('/(priest)')}>
          <Text style={styles.backArrow}>‹</Text>
          <Text style={styles.backText}>My Flock</Text>
        </TouchableOpacity>

        {loading ? (
          <ActivityIndicator color={colors.gold} style={{ paddingTop: 40 }} />
        ) : (
          <>
            {/* ── Hero card ── */}
            <View style={styles.heroCard}>
              <Avatar
                url={memberAvatarUrl ?? myPhotoUrl}
                initials={memberInfo?.initials ?? '?'}
                size={52}
                style={[styles.heroAvatar, memberInfo?.flagged && styles.heroAvatarFlagged]}
                textStyle={styles.heroAvatarText}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.heroName}>{memberInfo?.name ?? memberName ?? 'Member'}</Text>
                <Text style={styles.heroMeta}>
                  {memberInfo?.stage ? `Stage: ${memberInfo.stage} · ` : ''}
                  {memberInfo?.joined ? `Joined ${memberInfo.joined}` : ''}
                </Text>
                {lifeStageDisplay ? (
                  <Text style={styles.heroLifeStage}>{lifeStageDisplay}</Text>
                ) : null}
                {memberInfo?.flagged && (
                  <View style={styles.flagBadge}>
                    <Text style={styles.flagBadgeText}>⚑ {memberInfo.flagNote}</Text>
                  </View>
                )}
                {visitRequested && (
                  <View style={styles.visitBadge}>
                    <Text style={styles.visitBadgeText}>◎ Requested a pastoral visit</Text>
                  </View>
                )}
              </View>
            </View>

            {/* ── Member photo (only when they haven't set their own) ── */}
            {!demoMode && !loading && !memberAvatarUrl && (
              <View style={styles.photoRow}>
                <Text style={styles.photoRowLabel}>
                  {myPhotoUrl ? 'Your photo of this member (visible only to you)' : 'No profile photo — add one (visible only to you)'}
                </Text>
                <View style={styles.photoChipRow}>
                  {cameraAvailable && (
                    <TouchableOpacity style={styles.photoChip} onPress={() => addMemberPhoto('camera')} disabled={photoBusy}>
                      <Text style={styles.photoChipText}>◉ Camera</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={styles.photoChip} onPress={() => addMemberPhoto('library')} disabled={photoBusy}>
                    <Text style={styles.photoChipText}>{myPhotoUrl ? '▤ Change' : '▤ Upload'}</Text>
                  </TouchableOpacity>
                  {!!myPhotoUrl && (
                    <TouchableOpacity style={styles.photoChip} onPress={removeMemberPhoto} disabled={photoBusy}>
                      <Text style={[styles.photoChipText, { color: colors.red }]}>✕ Remove</Text>
                    </TouchableOpacity>
                  )}
                  {photoBusy && <ActivityIndicator color={colors.gold} size="small" />}
                </View>
                {!!photoError && <Text style={styles.photoErrorText}>{photoError}</Text>}
              </View>
            )}

            {/* ── Stats strip ── */}
            <View style={styles.statStrip}>
              <View style={styles.statItem}>
                <Text style={[styles.statVal, { color: sinceColor }]}>{sinceTxt}</Text>
                <Text style={styles.statLabel}>SINCE CONF.</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={[styles.statVal, { color: colors.cream }]}>{canonCount}</Text>
                <Text style={styles.statLabel}>CANONS</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={[styles.statVal, { color: colors.cream }]}>{prayerRequests.length}</Text>
                <Text style={styles.statLabel}>REQUESTS</Text>
              </View>
            </View>

            {/* ── Last pastoral visit ── */}
            <View style={styles.lastVisitRow}>
              <Text style={styles.lastVisitLabel}>Last pastoral visit</Text>
              <Text style={styles.lastVisitVal}>
                {lastVisit
                  ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(lastVisit) ? `${lastVisit}T12:00:00` : lastVisit)
                      .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  : 'None logged'}
              </Text>
            </View>

            {/* ── Action row ── */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.btnGold, { flex: 1 }]}
                onPress={() => router.push({ pathname: '/(priest)/log-encounter', params: { memberId: memberId ?? '', memberName: memberName ?? memberInfo?.name ?? '' } })}
              >
                <Text style={styles.btnGoldText}>LOG ENCOUNTER</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btnMenu}
                onPress={() => setShowContactSheet(true)}
              >
                <Text style={styles.btnMenuText}>···</Text>
              </TouchableOpacity>
            </View>

            {/* ── Tab bar ── */}
            <View style={styles.tabBar}>
              {TABS.map(t => (
                <TouchableOpacity
                  key={t.value}
                  style={[styles.tabItem, tab === t.value && styles.tabItemActive]}
                  onPress={() => setTab(t.value)}
                >
                  <Text style={[styles.tabText, tab === t.value && styles.tabTextActive]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* ── Overview ── */}
            {tab === 'overview' && (
              <>
                <Card title="Spiritual Vitals" flat>
                  {vitals.length === 0 ? (
                    <Text style={styles.emptyText}>Member hasn't shared any vitals yet.</Text>
                  ) : vitals.map((v, i) => {
                    // Confession has no canon check-off to measure, so it never
                    // has a percentage — show days-since-confession instead of
                    // "—", the same as the member's own dashboard.
                    const isConf = v.key === 'confession';
                    const confDays = memberInfo?.daysSince;
                    const has = isConf
                      ? confDays !== null && confDays !== undefined
                      : v.shared && v.pct !== null && v.pct !== undefined;
                    const notShared = !isConf && !v.shared;
                    return (
                      <View key={i} style={[styles.vitalRow, i < vitals.length - 1 && { marginBottom: 10 }]}>
                        <Text style={[styles.vitalLabel, notShared && styles.vitalLabelDim]}>
                          {v.label}{notShared ? ' (not shared)' : ''}
                        </Text>
                        <View style={styles.vitalTrack}>
                          {has && !isConf && <View style={[styles.vitalFill, { width: `${v.pct}%` as any }]} />}
                        </View>
                        <Text style={[styles.vitalVal, !has && { color: colors.muted, opacity: 0.4 }]}>
                          {isConf ? (has ? `${confDays}d` : '—') : (has ? `${v.pct}%` : '—')}
                        </Text>
                      </View>
                    );
                  })}
                </Card>

                <Card title="Psalm Memorization" titleIconNode={<Harp size={16} color={colors.gold} />} flat>
                  {!psalmStats ? (
                    <Text style={styles.emptyText}>Member hasn't shared psalm memorization progress yet.</Text>
                  ) : (
                    <View style={styles.psalmStatsRow}>
                      <View style={styles.psalmStat}>
                        <Text style={styles.psalmStatValue}>🔥 {psalmStats.streak}</Text>
                        <Text style={styles.psalmStatLabel}>day streak</Text>
                      </View>
                      <View style={styles.psalmStat}>
                        <Text style={styles.psalmStatValue}>{psalmStats.longestStreak}</Text>
                        <Text style={styles.psalmStatLabel}>best streak</Text>
                      </View>
                      <View style={styles.psalmStat}>
                        <Text style={styles.psalmStatValue}>{psalmStats.masteredItems}</Text>
                        <Text style={styles.psalmStatLabel}>memorized</Text>
                      </View>
                    </View>
                  )}
                </Card>

                <Card title="Confession History" flat>
                  <View style={styles.privacyNote}>
                    <Text style={styles.privacyNoteText}>✦ Dates and type only. Content is never stored.</Text>
                  </View>
                  {confessions.length === 0 ? (
                    <Text style={styles.emptyText}>No confession history recorded yet.</Text>
                  ) : confessions.map((c, i) => (
                    <View key={i} style={[styles.histRow, i < confessions.length - 1 && styles.histBorder]}>
                      <Text style={styles.histDate}>{c.date}</Text>
                      <Text style={styles.histType}>{c.type}</Text>
                      {c.note ? <Text style={styles.histNote}>{c.note}</Text> : null}
                    </View>
                  ))}
                </Card>
              </>
            )}

            {/* ── Canon ── */}
            {tab === 'canon' && (
              <Card title="Current Canon" flat>
                {!memberRule ? (
                  <Text style={styles.emptyText}>No personal rule synced yet.</Text>
                ) : (
                  ruleSummaryLines(memberRule).map((l, i, arr) => (
                    <View key={l.label} style={[styles.canonRow, i < arr.length - 1 && styles.histBorder]}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.canonComponent}>
                          {l.label}
                          {SUMMARY_CATEGORY[l.label] && assignedCats.has(SUMMARY_CATEGORY[l.label])
                            ? <Text style={styles.assignedByYou}>  ·  assigned by you</Text>
                            : null}
                        </Text>
                        <Text style={styles.canonMeta}>{l.value}</Text>
                      </View>
                    </View>
                  ))
                )}
                <Text style={styles.currentCanonHint}>
                  The member's own rule. Open the editor below to adjust it — categories you assign become read-only for the member until their next confession.
                </Text>
              </Card>
            )}
            {tab === 'canon' && (
              <Card title="Assigned Canon" flat>
                {canons.length === 0 ? (
                  <Text style={styles.emptyText}>No canon assigned yet.</Text>
                ) : canons.map((c, i) => {
                  const pct = Math.round((c.completions / c.totalDays) * 100);
                  return (
                    <View key={c.id} style={[styles.canonRow, i < canons.length - 1 && styles.histBorder]}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.canonComponent}>{c.component}</Text>
                        <Text style={styles.canonMeta}>{c.frequency} · since {c.startDate}</Text>
                      </View>
                      <View style={styles.canonPill}>
                        <Text style={[styles.canonPillText, { color: pct < 40 ? colors.red : colors.yellow }]}>
                          {c.completions}/{c.totalDays} this week
                        </Text>
                      </View>
                    </View>
                  );
                })}
                <TouchableOpacity
                  style={[styles.btnGold, { alignSelf: 'flex-start', marginTop: 12 }]}
                  onPress={() => router.push({ pathname: '/(priest)/assign-canon', params: { memberId: memberId ?? '', memberName: memberName ?? memberInfo?.name ?? '' } })}
                >
                  <Text style={styles.btnGoldText}>ASSIGN CANON</Text>
                </TouchableOpacity>
              </Card>
            )}

            {/* ── Prayer ── */}
            {tab === 'prayer' && (
              <Card title="Prayer Requests" flat>
                <View style={styles.privacyNote}>
                  <Text style={styles.privacyNoteText}>✦ Requests shared with FOC only, or with both FOC and Sunday school servant.</Text>
                </View>
                {prayerRequests.length === 0 ? (
                  <Text style={styles.emptyText}>No requests shared with Father of Confession.</Text>
                ) : prayerRequests.map((p, i) => (
                  <View key={i} style={[styles.histRow, i < prayerRequests.length - 1 && styles.histBorder]}>
                    <Text style={styles.histDate}>{p.date}</Text>
                    <Text style={styles.histType}>{p.topic}</Text>
                    {p.body ? <Text style={styles.histNote}>{p.body}</Text> : null}
                  </View>
                ))}
              </Card>
            )}

            {/* ── Notes ── */}
            {tab === 'notes' && (
              <Card title="Pastoral Notes (Private)" flat>
                <View style={styles.privacyNote}>
                  <Text style={styles.privacyNoteText}>✦ Your private notes. Never visible to the member.</Text>
                </View>

                {notes.length === 0 && (
                  <Text style={styles.emptyText}>No notes yet. Add your first note below.</Text>
                )}

                {notes.map(note => (
                  <View key={note.id} style={styles.noteCard}>
                    <View style={styles.noteCardHeader}>
                      <Text style={styles.noteCardDate}>
                        {new Date(note.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        {note.updated_at !== note.created_at ? '  (edited)' : ''}
                      </Text>
                      {editingId !== note.id && (
                        <View style={styles.noteActions}>
                          <TouchableOpacity onPress={() => handleStartEdit(note)} style={styles.noteActionBtn}>
                            <Text style={styles.noteActionText}>Edit</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => handleDeleteNote(note.id)}
                            style={styles.noteActionBtn}
                            disabled={deletingId === note.id}
                          >
                            <Text style={[styles.noteActionText, { color: colors.red }]}>
                              {deletingId === note.id ? '…' : 'Delete'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>

                    {editingId === note.id ? (
                      <>
                        <TextInput
                          style={styles.noteInput}
                          value={editText}
                          onChangeText={setEditText}
                          multiline
                          autoFocus
                          placeholderTextColor={colors.faint}
                        />
                        {editError ? <Text style={styles.noteErrorText}>{editError}</Text> : null}
                        <View style={styles.editActions}>
                          <TouchableOpacity
                            style={[styles.btnGold, { opacity: (!editText.trim() || savingEdit) ? 0.4 : 1 }]}
                            onPress={handleSaveEdit}
                            disabled={!editText.trim() || savingEdit}
                          >
                            <Text style={styles.btnGoldText}>{savingEdit ? 'SAVING…' : 'SAVE'}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.btnCancel} onPress={() => setEditingId(null)}>
                            <Text style={styles.btnCancelText}>CANCEL</Text>
                          </TouchableOpacity>
                        </View>
                      </>
                    ) : (
                      <Text style={styles.noteCardBody}>{note.body}</Text>
                    )}
                  </View>
                ))}

                <View style={styles.addNoteSection}>
                  <TextInput
                    style={styles.noteInput}
                    placeholder="Add a pastoral note…"
                    placeholderTextColor={colors.faint}
                    multiline
                    numberOfLines={4}
                    value={newNoteText}
                    onChangeText={setNewNoteText}
                  />
                  {addNoteError ? <Text style={styles.noteErrorText}>{addNoteError}</Text> : null}
                  <TouchableOpacity
                    style={[styles.btnGold, { alignSelf: 'flex-start', marginTop: 10, opacity: (!newNoteText.trim() || addingNote) ? 0.4 : 1 }]}
                    onPress={handleAddNote}
                    disabled={!newNoteText.trim() || addingNote}
                  >
                    <Text style={styles.btnGoldText}>{addingNote ? 'SAVING…' : 'ADD NOTE'}</Text>
                  </TouchableOpacity>
                </View>
              </Card>
            )}
          </>
        )}

      </ScrollView>

      {/* ── Contact sheet ── */}
      <Modal
        visible={showContactSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowContactSheet(false)}
      >
        <TouchableOpacity
          style={styles.sheetOverlay}
          onPress={() => setShowContactSheet(false)}
          activeOpacity={1}
        >
          <View style={styles.sheet} onStartShouldSetResponder={() => true}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{memberInfo?.name ?? 'Contact'}</Text>

            {/* Assign canon action */}
            <TouchableOpacity
              style={styles.sheetRow}
              onPress={() => { setShowContactSheet(false); router.push({ pathname: '/(priest)/assign-canon', params: { memberId: memberId ?? '', memberName: memberName ?? memberInfo?.name ?? '' } }); }}
            >
              <View style={styles.sheetRowIcon}><CandleIcon size={18} color={colors.gold} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetRowLabel}>Assign Canon</Text>
                <Text style={styles.sheetRowValue}>Add a spiritual practice</Text>
              </View>
              <Text style={styles.sheetRowAction}>ASSIGN</Text>
            </TouchableOpacity>

            {contact?.phone ? (
              <TouchableOpacity
                style={styles.sheetRow}
                onPress={() => Linking.openURL(`tel:${contact.phone.replace(/[^0-9+]/g, '')}`)}
              >
                <Text style={styles.sheetRowIcon}>☎</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetRowLabel}>Phone</Text>
                  <Text style={styles.sheetRowValue}>{contact.phone}</Text>
                </View>
                <Text style={styles.sheetRowAction}>CALL</Text>
              </TouchableOpacity>
            ) : null}

            {contact?.email ? (
              <TouchableOpacity
                style={styles.sheetRow}
                onPress={() => Linking.openURL(`mailto:${contact.email}`)}
              >
                <Text style={styles.sheetRowIcon}>✉</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetRowLabel}>Email</Text>
                  <Text style={styles.sheetRowValue}>{contact.email}</Text>
                </View>
                <Text style={styles.sheetRowAction}>EMAIL</Text>
              </TouchableOpacity>
            ) : null}

            {contact?.address_line1 ? (
              <TouchableOpacity style={styles.sheetRow} onPress={openMaps}>
                <Text style={styles.sheetRowIcon}>⌖</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetRowLabel}>Address</Text>
                  <Text style={styles.sheetRowValue}>{contact.address_line1}</Text>
                  {contact.address_line2 ? (
                    <Text style={styles.sheetRowValue}>{contact.address_line2}</Text>
                  ) : null}
                  <Text style={styles.sheetRowValue}>
                    {[contact.city, contact.state, contact.zip].filter(Boolean).join(', ')}
                  </Text>
                  {contact.country ? (
                    <Text style={styles.sheetRowValue}>{contact.country}</Text>
                  ) : null}
                </View>
                <Text style={styles.sheetRowAction}>MAP</Text>
              </TouchableOpacity>
            ) : null}

            {!contact?.phone && !contact?.email && !contact?.address_line1 ? (
              <Text style={styles.sheetEmpty}>
                No contact info on file yet.{'\n'}Member can add this in their Profile settings.
              </Text>
            ) : null}

            <TouchableOpacity style={styles.sheetCloseBtn} onPress={() => setShowContactSheet(false)}>
              <Text style={styles.sheetCloseBtnText}>CLOSE</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

    </SafeAreaView>
  );
}

const styles = lazyThemed(() => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.navy },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },

  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  backArrow: { fontFamily: fonts.cormorant, fontSize: 22, color: colors.gold },
  backText: { fontFamily: fonts.latoLight, fontSize: 13, color: colors.muted },

  heroCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 16, marginBottom: 12 },
  photoRow: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, marginBottom: 12 },
  photoRowLabel: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, marginBottom: 8 },
  photoChipRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  photoChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel },
  photoChipText: { fontFamily: fonts.latoBold, fontSize: 11, color: colors.gold },
  photoErrorText: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.red, marginTop: 8 },
  heroAvatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.blueBg, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  heroAvatarFlagged: { borderColor: colors.red, backgroundColor: 'rgba(192,57,43,0.2)' },
  heroAvatarText: { fontFamily: fonts.cormorantMedium, fontSize: 20, color: colors.blue },
  heroName: { fontFamily: fonts.cormorantMedium, fontSize: 22, color: colors.cream, marginBottom: 2 },
  heroMeta: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted },
  heroLifeStage: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, marginTop: 3 },
  flagBadge: { backgroundColor: 'rgba(192,57,43,0.12)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, alignSelf: 'flex-start', marginTop: 6 },
  flagBadgeText: { fontFamily: fonts.latoBold, fontSize: 9, color: colors.red, letterSpacing: 0.5 },
  visitBadge: { backgroundColor: colors.blueBg, borderWidth: 1, borderColor: colors.blue, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, alignSelf: 'flex-start', marginTop: 6 },
  visitBadgeText: { fontFamily: fonts.latoBold, fontSize: 9, color: colors.blue, letterSpacing: 0.5 },

  statStrip: { flexDirection: 'row', backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.border, borderRadius: 12, marginBottom: 16, overflow: 'hidden' },
  statItem: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  statVal: { fontFamily: fonts.cormorantMedium, fontSize: 22 },
  statLabel: { fontFamily: fonts.latoBold, fontSize: 8, letterSpacing: 1.5, color: colors.muted, textTransform: 'uppercase', marginTop: 2 },
  lastVisitRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, paddingHorizontal: 4 },
  lastVisitLabel: { fontFamily: fonts.latoBold, fontSize: 9, letterSpacing: 1.2, color: colors.muted, textTransform: 'uppercase' },
  lastVisitVal: { fontFamily: fonts.lato, fontSize: 13, color: colors.cream },
  statDivider: { width: 1, backgroundColor: colors.border },

  actionRow: { flexDirection: 'row', gap: 8, marginTop: 12, marginBottom: 16 },
  btnGold: { backgroundColor: colors.gold, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, alignItems: 'center' },
  btnGoldText: { fontFamily: fonts.latoBold, fontSize: 10, color: colors.navy, letterSpacing: 0.8 },
  btnMenu: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 9, alignItems: 'center', justifyContent: 'center' },
  btnMenuText: { fontFamily: fonts.lato, fontSize: 16, color: colors.muted, letterSpacing: 2, lineHeight: 18 },

  tabBar: { flexDirection: 'row', backgroundColor: colors.panel, borderRadius: 10, padding: 4, marginBottom: 16, gap: 2 },
  tabItem: { flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: 'center' },
  tabItemActive: { backgroundColor: colors.navyMid, borderWidth: 1, borderColor: colors.border },
  tabText: { fontFamily: fonts.latoBold, fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: colors.muted },
  tabTextActive: { color: colors.goldLight },

  vitalRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  vitalLabel: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, flex: 1 },
  vitalLabelDim: { opacity: 0.4 },
  vitalTrack: { width: 80, height: 4, backgroundColor: colors.creamDim, borderRadius: 4, overflow: 'hidden' },
  vitalFill: { height: '100%', backgroundColor: colors.gold, borderRadius: 4 },
  vitalVal: { fontFamily: fonts.latoBold, fontSize: 12, color: colors.cream, width: 30, textAlign: 'right' },

  psalmStatsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  psalmStat: { alignItems: 'center' },
  psalmStatValue: { fontFamily: fonts.cormorantMedium, fontSize: 20, color: colors.goldLight },
  psalmStatLabel: { fontFamily: fonts.latoLight, fontSize: 10, color: colors.muted, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.4 },

  privacyNote: { backgroundColor: 'rgba(201,168,76,0.07)', borderWidth: 1, borderColor: 'rgba(201,168,76,0.15)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 12 },
  privacyNoteText: { fontFamily: fonts.latoLight, fontSize: 10, color: colors.muted, letterSpacing: 0.3 },

  histRow: { paddingVertical: 12 },
  histBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  histDate: { fontFamily: fonts.latoBold, fontSize: 9, letterSpacing: 1.5, color: colors.gold, opacity: 0.7, marginBottom: 2, textTransform: 'uppercase' },
  histType: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.cream, marginBottom: 2 },
  histNote: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, lineHeight: 16 },

  canonRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  canonComponent: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.cream, marginBottom: 2 },
  canonMeta: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, lineHeight: 17 },
  currentCanonHint: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, lineHeight: 16, marginTop: 12, opacity: 0.85 },
  assignedByYou: { fontFamily: fonts.latoLight, fontSize: 10, color: colors.gold },
  canonPill: { backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  canonPillText: { fontFamily: fonts.latoBold, fontSize: 12 },

  emptyText: { fontFamily: fonts.latoLight, fontSize: 13, color: colors.muted, textAlign: 'center', paddingVertical: 16 },

  savedNoteText: { fontFamily: fonts.latoLight, fontSize: 13, color: colors.muted, lineHeight: 20, marginBottom: 12, padding: 12, backgroundColor: colors.panel, borderRadius: 8 },
  noteCard: { backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, marginBottom: 10 },
  noteCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  noteCardDate: { fontFamily: fonts.latoBold, fontSize: 9, letterSpacing: 1, color: colors.gold, opacity: 0.8 },
  noteCardBody: { fontFamily: fonts.latoLight, fontSize: 13, color: colors.muted, lineHeight: 20 },
  noteActions: { flexDirection: 'row', gap: 12 },
  noteActionBtn: { paddingVertical: 2 },
  noteActionText: { fontFamily: fonts.latoBold, fontSize: 9, letterSpacing: 0.8, color: colors.gold },
  editActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  btnCancel: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  btnCancelText: { fontFamily: fonts.latoBold, fontSize: 10, color: colors.muted, letterSpacing: 0.8 },
  addNoteSection: { marginTop: 12, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 },
  noteInput: { backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, borderRadius: 8, color: colors.cream, fontFamily: fonts.latoLight, fontSize: 13, padding: 12, textAlignVertical: 'top', minHeight: 90 },
  noteErrorText: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.red, marginTop: 6 },

  // ── Contact sheet ──
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.navyMid, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    borderWidth: 1, borderColor: colors.border, paddingHorizontal: 20, paddingBottom: 34, paddingTop: 12,
  },
  sheetHandle: { width: 36, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 18 },
  sheetTitle: { fontFamily: fonts.cormorantMedium, fontSize: 22, color: colors.cream, marginBottom: 18 },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  sheetRowIcon: { width: 26, alignItems: 'center', justifyContent: 'center' },
  sheetRowLabel: { fontFamily: fonts.latoBold, fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.muted, marginBottom: 2 },
  sheetRowValue: { fontFamily: fonts.latoLight, fontSize: 13, color: colors.cream },
  sheetRowAction: { fontFamily: fonts.latoBold, fontSize: 9, letterSpacing: 1, color: colors.gold, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  sheetEmpty: { fontFamily: fonts.latoLight, fontSize: 13, color: colors.muted, textAlign: 'center', paddingVertical: 28, lineHeight: 20 },
  sheetCloseBtn: { marginTop: 18, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  sheetCloseBtnText: { fontFamily: fonts.latoBold, fontSize: 11, color: colors.muted, letterSpacing: 1 },
}));
