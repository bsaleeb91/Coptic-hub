// app/(tabs)/confession.tsx
// Confession — Poimen's tab, rebuilt on Nepsis's *persistent* model (per the port
// decision). The examination of conscience and journal are now saved between
// confessions, encrypted on-device (lib/confession/store.ts → tweetnacl), instead
// of the previous session-only flow. Poimen's confession-date logging + history +
// scheduling are retained because the priest/servant dashboards depend on them.
//
// Sub-screens: hub → journal · examination · in-session notes → complete.

import React, { useState, useEffect, useCallback } from 'react';
import {
  ScrollView, View, Text, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator, Keyboard, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts , lazyThemed } from '@/lib/theme';
import { Card } from '@/components/ui/Card';
import { useSession } from '@/lib/auth';
import * as db from '@/lib/db';
import { useDemoMode } from '@/lib/demo';
import { SIN_CATALOGUE } from '@/lib/confession/sinCatalogue';
import { resetVitalsEpoch } from '@/lib/canon/history';
import { confirmDestructive } from '@/lib/confirm';
import { recordConfession, loadConfessionDates } from '@/lib/confession/dates';
import {
  NotepadIcon, ClipboardIcon, PrayingHandsIcon, LockIcon, CrossIcon, HeartIcon,
  SpeechIcon, ThoughtIcon, EarIcon, EyeIcon, HandIcon, PrayerRopeIcon, PencilIcon,
} from '@/components/ui/TabIcons';
import type { SinCategory, SinFrequency, JournalCategory, IncidentCategory, JournalIncident, ExamChecks } from '@/lib/confession/types';
import {
  loadIncidents, addIncident, deleteIncident, clearIncidents,
  loadExam, saveExam, clearExam,
  ExamStyle, loadExamStyle, saveExamStyle,
} from '@/lib/confession/store';
import {
  RELATIONAL_CATEGORIES, RELATIONAL_EXAMINATION, RelationalCategory,
} from '@/lib/confession/relationalExamination';


const FREQ_LABEL: Record<SinFrequency, string> = { once: 'Once', few: 'A few times', often: 'Often' };

// Dark-theme-friendly palette per examination domain (the Nepsis light-mode
// colorLight values don't read on navy, so we map to Poimen's accents).
// Each domain keeps its own accent color; the line icons (TabIcons.tsx) are
// tinted with it at render time.
type DomainMeta = {
  label: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  color: string;
  bg: string;
};
const DOMAIN_META: Record<JournalCategory, DomainMeta> = lazyThemed(() => ({
  tongue:              { label: 'The Tongue',          icon: SpeechIcon,     color: '#e07a86',       bg: 'rgba(224,112,112,0.12)' },
  thoughts:            { label: 'Thoughts',            icon: ThoughtIcon,    color: colors.blue,     bg: colors.blueBg },
  hearing:             { label: 'Hearing',             icon: EarIcon,        color: colors.goldLight, bg: colors.goldDim },
  eyes:                { label: 'The Eyes',            icon: EyeIcon,        color: colors.green,     bg: colors.greenBg },
  actions:             { label: 'Actions',             icon: HandIcon,       color: colors.purple,    bg: 'rgba(201,160,220,0.12)' },
  neglected_practices: { label: 'Neglected Practices', icon: PrayerRopeIcon, color: '#c2b199',       bg: 'rgba(194,177,153,0.12)' },
  other:               { label: 'Other',               icon: PencilIcon,     color: colors.muted,     bg: colors.creamDim },
}));

const CATEGORIES: SinCategory[] = ['tongue', 'thoughts', 'hearing', 'eyes', 'actions', 'neglected_practices'];
const DOMAINS: JournalCategory[] = [...CATEGORIES, 'other'];

// Section metadata for the relational (original Poimen) examination style.
const RELATIONAL_META: Record<RelationalCategory, DomainMeta> = lazyThemed(() => ({
  toward_god:    { label: 'Toward God',    icon: CrossIcon,     color: colors.goldLight, bg: colors.goldDim },
  toward_others: { label: 'Toward Others', icon: HeartIcon,     color: '#e07a86',        bg: 'rgba(224,112,112,0.12)' },
  toward_self:   { label: 'Toward Self',   icon: EyeIcon,       color: colors.blue,      bg: colors.blueBg },
  omissions:     { label: 'Omissions',     icon: ClipboardIcon, color: colors.green,     bg: colors.greenBg },
}));

type ExamSectionKey = JournalCategory | RelationalCategory;
const sectionMeta = (k: ExamSectionKey): DomainMeta =>
  (RELATIONAL_CATEGORIES as string[]).includes(k)
    ? RELATIONAL_META[k as RelationalCategory]
    : DOMAIN_META[k as JournalCategory];

function relTime(ms: number): string {
  const d = new Date(ms);
  const now = new Date();
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return `Today · ${time}`;
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday · ${time}`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ` · ${time}`;
}

type SubScreen = 'hub' | 'journal' | 'examination' | 'session' | 'complete';

function SubHeader({ title, onBack, right }: { title: string; onBack: () => void; right?: React.ReactNode }) {
  return (
    <View style={styles.subHeader}>
      <TouchableOpacity onPress={onBack} hitSlop={10}><Text style={styles.linkGold}>‹ Back</Text></TouchableOpacity>
      <Text style={styles.subHeaderTitle}>{title}</Text>
      <View style={{ minWidth: 54, alignItems: 'flex-end' }}>{right}</View>
    </View>
  );
}

// ─── Hub ───────────────────────────────────────────────────────────────────────

function Hub({ onNav }: { onNav: (s: SubScreen) => void }) {
  const { user, profile, refreshProfile } = useSession();
  const { demoMode } = useDemoMode();

  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(!demoMode);
  const [selfReportDate, setSelfReportDate] = useState(
    new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  );
  const [selfReporting, setSelfReporting] = useState(false);
  const [selfReportSaved, setSelfReportSaved] = useState(false);
  const [selfReportError, setSelfReportError] = useState('');

  useEffect(() => { loadHistory(); }, [user]);

  // History = confessions recorded on this device (completion flow /
  // self-report) merged with FOC-logged encounters (or demo data), one entry
  // per calendar day — the FOC/demo entry wins because it carries a note.
  async function loadHistory() {
    setLoadingHistory(true);
    const fmt = (k: string) => new Date(`${k}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const entries = new Map<string, { id: string; dateKey: string; date: string; note: string }>();
    for (const k of await loadConfessionDates()) {
      entries.set(k, { id: `local_${k}`, dateKey: k, date: fmt(k), note: '' });
    }
    if (demoMode) {
      for (const e of [
        { key: '2026-05-21', note: 'Fr. assigned: 40-day Psalm reading plan' },
        { key: '2026-04-20', note: 'Fr. assigned: Marriage prayer practice' },
      ]) entries.set(e.key, { id: `demo_${e.key}`, dateKey: e.key, date: fmt(e.key), note: e.note });
    } else if (user) {
      const data = await db.getConfessionsForCongregant(user.id);
      for (const enc of data ?? []) {
        const d = new Date(enc.encountered_at);
        const p = (n: number) => String(n).padStart(2, '0');
        const k = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
        entries.set(k, { id: enc.id, dateKey: k, date: fmt(k), note: enc.member_note ?? '' });
      }
    }
    setHistory([...entries.values()].sort((a, b) => (a.dateKey < b.dateKey ? 1 : -1)));
    setLoadingHistory(false);
  }

  async function handleSelfReport() {
    if (!user) return;
    const parsedDate = new Date(selfReportDate);
    if (isNaN(parsedDate.getTime())) {
      setSelfReportError('Invalid date — use a format like "Jun 15, 2026"');
      return;
    }
    setSelfReportError('');
    setSelfReporting(true);
    await recordConfession(parsedDate);
    await db.setLastConfession(user.id, parsedDate.toISOString());
    await refreshProfile();
    await loadHistory();
    setSelfReporting(false);
    setSelfReportSaved(true);
    setTimeout(() => setSelfReportSaved(false), 2000);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.pageTitle}>Confession</Text>
        <Text style={styles.pageSubtitle}>Private — encrypted and kept on this device</Text>

        {/* Privacy banner */}
        <View style={styles.privacyBanner}>
          <View style={{ flexShrink: 0, marginTop: 1 }}><LockIcon size={18} color={colors.gold} /></View>
          <Text style={styles.privacyText}>
            <Text style={styles.strong}>Encrypted on your device. </Text>
            Your journal and examination are saved between confessions, encrypted with a key that never
            leaves this phone. Only the date of your confession is ever shared with your Father of Confession.
          </Text>
        </View>

        {/* Prepare */}
        <Text style={styles.sectionLabel}>PREPARE</Text>
        <ModuleCard icon={<NotepadIcon size={22} color={colors.gold} />} title="Confession journal"
          sub="Log incidents as they happen — waiting for you in your notes"
          onPress={() => onNav('journal')} />
        <ModuleCard icon={<ClipboardIcon size={22} color={colors.gold} />} title="Examination of conscience"
          sub="Review each day and before confession — carries into your notes"
          onPress={() => onNav('examination')} />

        {/* During confession */}
        <Text style={styles.sectionLabel}>DURING CONFESSION</Text>
        <ModuleCard icon={<PrayingHandsIcon size={22} color={colors.gold} />} title="My confession notes"
          sub={"Tap each item as you speak it —\nnothing is sent anywhere"}
          onPress={() => onNav('session')} accent />

        {/* Self-report — hidden in demo mode */}
        {!demoMode && (
          <Card title="Log My Last Confession" titleIcon="✝︎">
            {profile?.last_confession_at && (
              <Text style={styles.lastConfDate}>
                Last recorded: {new Date(profile.last_confession_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </Text>
            )}
            <TextInput
              style={styles.dateInput}
              value={selfReportDate}
              onChangeText={t => { setSelfReportDate(t); setSelfReportError(''); }}
              placeholder="E.g., Jun 15, 2026"
              placeholderTextColor={colors.faint}
            />
            {selfReportError ? <Text style={styles.selfReportError}>{selfReportError}</Text> : null}
            <TouchableOpacity
              style={[styles.logBtn, selfReporting && styles.logBtnDisabled]}
              onPress={handleSelfReport}
              disabled={selfReporting}
              activeOpacity={0.85}
            >
              <Text style={styles.logBtnText}>
                {selfReporting ? 'Saving…' : selfReportSaved ? '✓ LOGGED' : 'LOG CONFESSION'}
              </Text>
            </TouchableOpacity>
            <Text style={styles.selfReportHint}>Only the date is saved. No content is recorded.</Text>
          </Card>
        )}

        {/* Schedule */}
        <Card title="Schedule Confession" titleIcon="◈">
          <View style={styles.comingSoonCard}>
            <Text style={styles.comingSoonIcon}>✝︎</Text>
            <Text style={styles.comingSoonTitle}>Contact Your Father of Confession</Text>
            <Text style={styles.comingSoonBody}>
              Reach out to your Father of Confession directly to arrange your next confession.
              In-app scheduling is coming in a future update.
            </Text>
          </View>
        </Card>

        {/* History */}
        <Card title="Confession History" flat>
          {loadingHistory ? (
            <ActivityIndicator color={colors.gold} style={{ paddingVertical: 20 }} />
          ) : history.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>✝︎</Text>
              <Text style={styles.emptyTitle}>No history yet</Text>
              <Text style={styles.emptyBody}>
                Confession dates appear here after your Father of Confession logs your meeting, or when
                you record one. Content is never stored on the server.
              </Text>
            </View>
          ) : (
            <>
              {history.map((item, i) => (
                <View key={item.id} style={[styles.histItem, i < history.length - 1 && styles.histBorder]}>
                  <Text style={styles.histDate}>{item.date}</Text>
                  <Text style={styles.histTitle}>Holy Confession</Text>
                  {item.note ? <Text style={styles.histNote}>{item.note}</Text> : null}
                  <View style={styles.histTag}><Text style={styles.histTagText}>✝︎ Received</Text></View>
                </View>
              ))}
              <Text style={styles.histFooter}>Dates only. Content protected by the holy seal.</Text>
            </>
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function ModuleCard({ icon, title, sub, onPress, accent }: {
  icon: React.ReactNode; title: string; sub: string; onPress: () => void; accent?: boolean;
}) {
  return (
    <TouchableOpacity style={[styles.moduleCard, accent && { borderColor: colors.gold + '55' }]} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.moduleIcon}>{icon}</View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.moduleTitle}>{title}</Text>
        {/* Each line as its own Text: works around an iOS paint bug where the
            second line of a multi-line Text was measured but never drawn. */}
        {sub.split('\n').map((line, i) => (
          <Text key={i} style={styles.moduleSub}>{line}</Text>
        ))}
      </View>
      <Text style={styles.moduleChevron}>›</Text>
    </TouchableOpacity>
  );
}

// ─── Journal ─────────────────────────────────────────────────────────────────────

function JournalView({ onBack }: { onBack: () => void }) {
  const [incidents, setIncidents] = useState<JournalIncident[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => { loadIncidents().then(list => { setIncidents(list); setLoaded(true); }); }, []);

  const remove = (id: string) => {
    confirmDestructive('Remove entry', 'Delete this journal entry?', 'Delete',
      async () => setIncidents(await deleteIncident(id)));
  };

  if (adding) {
    return (
      <IncidentComposer
        onCancel={() => setAdding(false)}
        onSave={async (input) => { setIncidents(await addIncident(input)); setAdding(false); }}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <SubHeader title="Journal" onBack={onBack}
        right={<TouchableOpacity onPress={() => setAdding(true)} hitSlop={12}><Text style={styles.addPlus}>＋</Text></TouchableOpacity>} />
      <ScrollView contentContainerStyle={styles.content}>
        {loaded && incidents.length === 0 && (
          <View style={styles.emptyCard}>
            <View style={{ marginBottom: 10, opacity: 0.6 }}><NotepadIcon size={32} color={colors.gold} /></View>
            <Text style={styles.emptyCardTitle}>Nothing logged yet</Text>
            <Text style={styles.emptyCardBody}>
              As things happen through the day, tap ＋ to note them under an examination
              domain. Whatever you record here will be waiting in your confession notes.
            </Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => setAdding(true)}>
              <Text style={styles.emptyBtnText}>＋  Log an incident</Text>
            </TouchableOpacity>
          </View>
        )}

        {incidents.length > 0 && <Text style={styles.sectionLabel}>SINCE YOUR LAST CONFESSION</Text>}
        {incidents.map(inc => {
          const m = sectionMeta(inc.category);
          const sin = inc.sinId ? SIN_CATALOGUE.find(s => s.id === inc.sinId) : undefined;
          const relQ = !sin && inc.sinId ? RELATIONAL_EXAMINATION.find(q => q.id === inc.sinId) : undefined;
          return (
            <View key={inc.id} style={styles.journalCard}>
              <View style={styles.journalCardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.journalCardTitle}>{inc.title}</Text>
                  <Text style={styles.journalCardDate}>{relTime(inc.createdAt)}</Text>
                </View>
                <TouchableOpacity onPress={() => remove(inc.id)} hitSlop={10}><Text style={{ fontSize: 16, color: colors.muted }}>✕</Text></TouchableOpacity>
              </View>
              {!!sin && (
                <Text style={styles.journalCardExplain}>
                  {sin.description}  <Text style={{ color: m.color }}>{sin.scripture}</Text>
                </Text>
              )}
              {!!relQ?.note && <Text style={styles.journalCardExplain}>{relQ.note}</Text>}
              {!!inc.note && <Text style={styles.journalCardBody}>{inc.note}</Text>}
              <View style={[styles.domainTag, { backgroundColor: m.bg, borderColor: m.color + '44' }]}>
                <m.icon size={13} color={m.color} />
                <Text style={[styles.domainTagText, { color: m.color }]}>{m.label}</Text>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Incident composer ───────────────────────────────────────────────────────────

function IncidentComposer({ onCancel, onSave }: {
  onCancel: () => void;
  onSave: (input: { category: IncidentCategory; sinId?: string; title: string; note: string }) => void;
}) {
  const [category, setCategory] = useState<IncidentCategory | null>(null);
  const [sinId, setSinId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [noteFocused, setNoteFocused] = useState(false);
  // Same style choice as the examination (shared preference): file the
  // incident under a senses domain or a relational category.
  const [entryStyle, setEntryStyle] = useState<ExamStyle>('senses');
  useEffect(() => { loadExamStyle().then(setEntryStyle); }, []);

  const senseMode = entryStyle === 'senses';
  const switchStyle = (s: ExamStyle) => {
    if (s === entryStyle) return;
    setEntryStyle(s);
    setCategory(null);
    setSinId(null);
    saveExamStyle(s);
  };

  const domainList: IncidentCategory[] = senseMode ? DOMAINS : [...RELATIONAL_CATEGORIES, 'other'];
  const catItems = !category || category === 'other' ? []
    : senseMode
      ? SIN_CATALOGUE.filter(s => s.category === category).map(s => ({ id: s.id, name: s.name, description: s.description as string | undefined, scripture: s.scripture as string | undefined }))
      : RELATIONAL_EXAMINATION.filter(q => q.category === category).map(q => ({ id: q.id, name: q.text, description: q.note, scripture: undefined }));
  const selectedName = sinId
    ? (SIN_CATALOGUE.find(s => s.id === sinId)?.name ?? RELATIONAL_EXAMINATION.find(q => q.id === sinId)?.text)
    : undefined;
  const canSave = !!category && (!!sinId || note.trim().length > 0);

  const save = () => {
    if (!category) return;
    const title = selectedName || note.trim().split('\n')[0].slice(0, 60) || sectionMeta(category).label;
    onSave({ category, sinId: sinId ?? undefined, title, note });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.subHeader}>
        <TouchableOpacity onPress={onCancel} hitSlop={10}><Text style={styles.linkGold}>Cancel</Text></TouchableOpacity>
        <Text style={styles.subHeaderTitle}>New entry</Text>
        <TouchableOpacity onPress={save} disabled={!canSave} hitSlop={10}>
          <Text style={[styles.linkGold, { color: canSave ? colors.gold : colors.muted }]}>Save</Text>
        </TouchableOpacity>
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <View style={[styles.styleToggleRow, { paddingHorizontal: 0, paddingTop: 0, marginBottom: 14 }]}>
            {([
              { value: 'senses' as ExamStyle, label: 'By the Senses' },
              { value: 'relational' as ExamStyle, label: 'Toward God & Others' },
            ]).map(opt => {
              const active = entryStyle === opt.value;
              return (
                <TouchableOpacity key={opt.value} onPress={() => switchStyle(opt.value)}
                  style={[styles.styleToggleBtn, { borderColor: active ? colors.gold : colors.border, backgroundColor: active ? colors.goldDim : 'transparent' }]}>
                  <Text style={[styles.styleToggleText, { color: active ? colors.goldLight : colors.muted }]}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.sectionLabel}>WHICH DOMAIN?</Text>
          <View style={styles.domainGrid}>
            {domainList.map(cat => {
              const m = sectionMeta(cat);
              const active = category === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  style={[styles.domainChip, { borderColor: active ? m.color : colors.border, backgroundColor: active ? m.bg : 'transparent' }]}
                  onPress={() => { setCategory(cat); setSinId(null); }}
                >
                  <m.icon size={17} color={m.color} />
                  <Text style={[styles.domainChipText, { color: active ? m.color : colors.cream }]}>{m.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {!!category && catItems.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { marginTop: 20 }]}>
                WHAT WAS IT?  <Text style={styles.labelHint}>(optional — tap to select)</Text>
              </Text>
              {catItems.map(s => {
                const active = sinId === s.id;
                const m = sectionMeta(category!);
                return (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.pickCard, { borderColor: active ? m.color : colors.border, backgroundColor: active ? m.bg : 'transparent' }]}
                    onPress={() => setSinId(active ? null : s.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.pickCardHead}>
                      <Text style={styles.pickCardName}>{s.name}</Text>
                      <View style={[styles.pickRadio, { borderColor: active ? m.color : colors.border, backgroundColor: active ? m.color : 'transparent' }]}>
                        {active && <Text style={styles.pickRadioTick}>✓</Text>}
                      </View>
                    </View>
                    {!!s.description && <Text style={styles.pickCardDesc}>{s.description}</Text>}
                    {!!s.scripture && <Text style={[styles.pickCardRef, { color: m.color }]}>{s.scripture}</Text>}
                  </TouchableOpacity>
                );
              })}
            </>
          )}

          <View style={styles.noteLabelRow}>
            <Text style={[styles.sectionLabel, { marginBottom: 0 }]}>
              WHAT HAPPENED?{catItems.length > 0 && <Text style={styles.labelHint}>  (optional)</Text>}
            </Text>
            {noteFocused && (
              <TouchableOpacity onPress={() => Keyboard.dismiss()} hitSlop={10}><Text style={styles.linkGold}>Done</Text></TouchableOpacity>
            )}
          </View>
          <TextInput
            style={styles.noteInput}
            placeholder={category === 'other' ? 'Describe what you want to confess…' : 'Describe the moment in your own words…'}
            placeholderTextColor={colors.faint}
            multiline
            value={note}
            onChangeText={setNote}
            onFocus={() => setNoteFocused(true)}
            onBlur={() => setNoteFocused(false)}
            textAlignVertical="top"
          />
          <Text style={styles.composerHint}>
            🔒  Encrypted on your device and shown in your confession notes. It clears when you delete
            your notes after confession.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Examination of conscience ───────────────────────────────────────────────────

function ExaminationView({ onBack }: { onBack: () => void }) {
  const [checked, setChecked] = useState<Map<string, SinFrequency>>(new Map());
  const [catIndex, setCatIndex] = useState(0);
  // Two examination styles: the Nepsis senses-based catalogue, or Poimen's
  // original relational questions. The choice persists; checks from both
  // styles share the store and merge in the confession notes.
  const [examStyle, setExamStyle] = useState<ExamStyle>('senses');

  useEffect(() => {
    loadExamStyle().then(setExamStyle);
    loadExam().then(obj => setChecked(new Map(Object.entries(obj) as [string, SinFrequency][])));
  }, []);

  const senseMode = examStyle === 'senses';
  const switchStyle = (s: ExamStyle) => {
    if (s === examStyle) return;
    setExamStyle(s);
    setCatIndex(0);
    saveExamStyle(s);
  };

  const cats: ExamSectionKey[] = senseMode ? CATEGORIES : RELATIONAL_CATEGORIES;
  const currentCat = cats[catIndex];
  const meta = sectionMeta(currentCat);
  const itemsFor = (cat: ExamSectionKey) => senseMode
    ? SIN_CATALOGUE.filter(s => s.category === cat).map(s => ({ id: s.id, name: s.name, description: s.description as string | undefined, scripture: s.scripture as string | undefined }))
    : RELATIONAL_EXAMINATION.filter(q => q.category === cat).map(q => ({ id: q.id, name: q.text, description: q.note, scripture: undefined }));
  const catItems = itemsFor(currentCat);
  const styleIds = new Set((senseMode ? SIN_CATALOGUE.map(s => s.id) : RELATIONAL_EXAMINATION.map(q => q.id)));
  const notedCount = [...checked.keys()].filter(id => styleIds.has(id)).length;

  const FREQ_OPTIONS: { label: string; value: SinFrequency; color: string }[] = [
    { label: 'Once', value: 'once', color: colors.muted },
    { label: 'Few times', value: 'few', color: colors.yellow },
    { label: 'Often', value: 'often', color: colors.red },
  ];

  const toggleFreq = (id: string, freq: SinFrequency) => {
    setChecked(prev => {
      const next = new Map(prev);
      if (next.get(id) === freq) next.delete(id); else next.set(id, freq);
      saveExam(Object.fromEntries(next) as ExamChecks);
      return next;
    });
  };

  const isFirst = catIndex === 0;
  const isLast = catIndex === cats.length - 1;

  return (
    <SafeAreaView style={styles.safe}>
      <SubHeader title="Examination" onBack={onBack}
        right={<Text style={styles.headerCount}>{notedCount} noted</Text>} />

      {/* Style toggle — senses (Nepsis) vs relational (original Poimen) */}
      <View style={styles.styleToggleRow}>
        {([
          { value: 'senses' as ExamStyle, label: 'By the Senses' },
          { value: 'relational' as ExamStyle, label: 'Toward God & Others' },
        ]).map(opt => {
          const active = examStyle === opt.value;
          return (
            <TouchableOpacity key={opt.value} onPress={() => switchStyle(opt.value)}
              style={[styles.styleToggleBtn, { borderColor: active ? colors.gold : colors.border, backgroundColor: active ? colors.goldDim : 'transparent' }]}>
              <Text style={[styles.styleToggleText, { color: active ? colors.goldLight : colors.muted }]}>{opt.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Category pills */}
      <View style={styles.catPills}>
        {cats.map((cat, i) => {
          const m = sectionMeta(cat);
          const cnt = itemsFor(cat).filter(it => checked.has(it.id)).length;
          const active = i === catIndex;
          return (
            <TouchableOpacity key={cat} onPress={() => setCatIndex(i)}
              style={[styles.catPill, { borderColor: active ? m.color : 'transparent', backgroundColor: active ? m.bg : 'transparent' }]}>
              <m.icon size={15} color={m.color} />
              {cnt > 0 && <View style={[styles.catPillBadge, { backgroundColor: m.color }]}><Text style={styles.catPillBadgeText}>{cnt}</Text></View>}
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.catHeaderCard, { backgroundColor: meta.bg, borderColor: meta.color + '44' }]}>
          <meta.icon size={28} color={meta.color} />
          <View>
            <Text style={[styles.catHeaderTitle, { color: meta.color }]}>{meta.label}</Text>
            <Text style={[styles.catHeaderCount, { color: meta.color }]}>{catItems.length} items to consider</Text>
          </View>
        </View>

        {catItems.map(sin => {
          const currentFreq = checked.get(sin.id);
          return (
            <View key={sin.id} style={[styles.sinCard, { borderColor: currentFreq ? meta.color + '55' : colors.border, backgroundColor: currentFreq ? meta.bg : colors.panel }]}>
              <Text style={styles.sinName}>{sin.name}</Text>
              {!!sin.description && <Text style={styles.sinDesc}>{sin.description}</Text>}
              {!!sin.scripture && <Text style={[styles.sinScripture, { color: meta.color }]}>{sin.scripture}</Text>}
              <View style={styles.freqBtns}>
                {FREQ_OPTIONS.map(f => {
                  const active = currentFreq === f.value;
                  return (
                    <TouchableOpacity key={f.value}
                      style={[styles.freqBtn, { backgroundColor: active ? f.color : 'transparent', borderColor: active ? f.color : colors.border }]}
                      onPress={() => toggleFreq(sin.id, f.value)}>
                      <Text style={[styles.freqBtnText, { color: active ? colors.navy : colors.textSecond }]}>{f.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          );
        })}

        <View style={styles.navRow}>
          <TouchableOpacity style={[styles.navBtn, { opacity: isFirst ? 0.3 : 1 }]} onPress={() => !isFirst && setCatIndex(i => i - 1)} disabled={isFirst}>
            <Text style={styles.navBtnText}>← Prev</Text>
          </TouchableOpacity>
          {!isLast ? (
            <TouchableOpacity style={[styles.navBtn, { backgroundColor: colors.gold, borderColor: colors.gold }]} onPress={() => setCatIndex(i => i + 1)}>
              <Text style={[styles.navBtnText, { color: colors.navy }]}>Next →</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.navBtn, { backgroundColor: colors.green, borderColor: colors.green }]} onPress={onBack}>
              <Text style={[styles.navBtnText, { color: colors.navy }]}>✓ Done</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.catProgress}>Category {catIndex + 1} of {cats.length}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── In-session notes ────────────────────────────────────────────────────────────

function SessionView({ onBack, onComplete }: { onBack: () => void; onComplete: () => void }) {
  const [incidents, setIncidents] = useState<JournalIncident[]>([]);
  const [exam, setExam] = useState<ExamChecks>({});
  const [loaded, setLoaded] = useState(false);
  const [spoken, setSpoken] = useState<Set<string>>(new Set());

  useEffect(() => {
    Promise.all([loadIncidents(), loadExam()]).then(([list, checks]) => {
      setIncidents(list); setExam(checks); setLoaded(true);
    });
  }, []);

  const toggle = (id: string) => setSpoken(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });

  type NoteItem = { id: string; category: ExamSectionKey; title: string; detail?: string };
  const examItems: NoteItem[] = Object.entries(exam)
    .map(([id, freq]): NoteItem | null => {
      const sin = SIN_CATALOGUE.find(s => s.id === id);
      if (sin) return { id: `exam:${id}`, category: sin.category, title: sin.name, detail: `${FREQ_LABEL[freq]} · ${sin.scripture}` };
      const q = RELATIONAL_EXAMINATION.find(r => r.id === id);
      if (q) return { id: `exam:${id}`, category: q.category, title: q.text, detail: FREQ_LABEL[freq] };
      return null;
    })
    .filter((x): x is NoteItem => x !== null);
  const journalItems: NoteItem[] = incidents.map(inc => ({ id: inc.id, category: inc.category, title: inc.title, detail: inc.note || undefined }));
  const allItems = [...examItems, ...journalItems];
  const remaining = allItems.length - spoken.size;
  const sections: ExamSectionKey[] = [...DOMAINS, ...RELATIONAL_CATEGORIES];
  const grouped = sections.map(cat => ({ cat, items: allItems.filter(i => i.category === cat) })).filter(g => g.items.length > 0);

  return (
    <SafeAreaView style={styles.safe}>
      <SubHeader title="In confession" onBack={onBack}
        right={<Text style={styles.headerCount}>{allItems.length > 0 ? `${remaining} left` : ''}</Text>} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sessionIntro}>
          Everything from your examination and journal, grouped by domain. Tap each as you speak it aloud.
          Everything stays on this device only.
        </Text>

        {loaded && allItems.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={{ fontSize: 32, marginBottom: 10 }}>🕊</Text>
            <Text style={styles.emptyCardTitle}>Nothing noted this period</Text>
            <Text style={styles.emptyCardBody}>
              Whatever you mark in your examination or log in your journal appears here, ready to speak.
              You can still confess freely from the heart.
            </Text>
          </View>
        )}

        {grouped.map(({ cat, items }) => {
          const m = sectionMeta(cat);
          return (
            <View key={cat} style={styles.catCard}>
              <View style={styles.sessionCatHead}>
                <m.icon size={15} color={m.color} />
                <Text style={[styles.catLabel, { color: m.color }]}>{m.label}</Text>
              </View>
              {items.map(item => {
                const done = spoken.has(item.id);
                return (
                  <TouchableOpacity key={item.id} style={[styles.sessionRow, done && styles.sessionRowDone]} onPress={() => toggle(item.id)} activeOpacity={0.7}>
                    <View style={[styles.sessionDot, { backgroundColor: done ? colors.green : m.color }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.sessionItemName, done && styles.strikethrough]}>{item.title}</Text>
                      {!!item.detail && <Text style={[styles.sessionItemSub, done && styles.strikethrough]}>{item.detail}</Text>}
                    </View>
                    <Text style={{ fontSize: 18, color: done ? colors.green : colors.border, marginTop: 1 }}>{done ? '✓' : '○'}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        })}

        <View style={styles.sessionNote}>
          <Text style={styles.sessionNoteText}>This is a guide, not a script. If something comes to mind that isn't listed, speak it freely.</Text>
        </View>

        <TouchableOpacity style={[styles.bigBtn, { backgroundColor: colors.green }]} onPress={onComplete}>
          <Text style={[styles.bigBtnText, { color: colors.navy }]}>✓  Confession complete</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Complete ────────────────────────────────────────────────────────────────────

function CompleteView({ onBack }: { onBack: () => void }) {
  const { user, refreshProfile } = useSession();
  const { demoMode } = useDemoMode();
  const [recorded, setRecorded] = useState(false);
  const [vitalsReset, setVitalsReset] = useState(false);
  const [notesDeleted, setNotesDeleted] = useState(false);

  // Reaching this screen IS the confession — record today automatically
  // (on-device always; mirrored to the profile when signed in). Same-day
  // duplicates collapse in the store, so re-visits are harmless.
  useEffect(() => {
    (async () => {
      await recordConfession();
      if (!demoMode && user) {
        await db.setLastConfession(user.id, new Date().toISOString());
        await refreshProfile();
      }
      setRecorded(true);
    })();
  }, []);

  // Start a fresh Spiritual Vitals window from today — adherence on the Home
  // card then reads "since this confession".
  async function resetVitals() {
    await resetVitalsEpoch();
    setVitalsReset(true);
  }

  function handleDelete() {
    confirmDestructive(
      'Delete confession notes',
      'Your examination and journal entries for this period will be permanently deleted from this device. This cannot be undone.',
      'Delete permanently',
      async () => {
        await Promise.all([clearIncidents(), clearExam()]);
        setNotesDeleted(true);
      },
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: '#0A2A22' }]}>
      <ScrollView contentContainerStyle={{ padding: 28, alignItems: 'center' }}>
        <Text style={styles.completeCross}>✝︎</Text>
        <Text style={styles.completeTitle}>Glory to God</Text>
        <Text style={styles.completeVerse}>
          "If we confess our sins, He is faithful and just to forgive us our sins and to cleanse us from all unrighteousness."
        </Text>
        <Text style={styles.completeRef}>1 John 1:9</Text>

        <View style={styles.afterCard}>
          <Text style={[styles.catLabel, { color: colors.goldLight, marginBottom: 12 }]}>AFTER CONFESSION</Text>
          {[
            'Receive Holy Communion if you have fasted and are permitted',
            'Fulfill your epitimia as instructed by your Father of Confession',
            'Update your Rule with any changes he gave you, if applicable',
          ].map((s, i) => (
            <View key={i} style={styles.afterStep}>
              <View style={styles.stepNum}><Text style={styles.stepNumText}>{i + 1}</Text></View>
              <Text style={styles.afterStepText}>{s}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.bigBtn, { backgroundColor: 'rgba(93,202,135,0.12)', borderWidth: 1, borderColor: colors.green }]}>
          <Text style={[styles.bigBtnText, { color: colors.green }]}>
            {recorded
              ? `✓ ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} recorded as your confession`
              : 'Recording your confession date…'}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.bigBtn, { backgroundColor: 'rgba(201,168,76,0.15)', borderWidth: 1, borderColor: colors.gold }]}
          onPress={resetVitals}
          disabled={vitalsReset}
        >
          <Text style={[styles.bigBtnText, { color: colors.goldLight }]}>
            {vitalsReset ? '✓ Vitals now track from today' : '↻  Reset my Spiritual Vitals'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.bigBtn, { backgroundColor: colors.red, opacity: notesDeleted ? 0.55 : 1 }]} onPress={handleDelete} disabled={notesDeleted}>
          <Text style={[styles.bigBtnText, { color: colors.cream }]}>
            {notesDeleted ? '✓ Notes permanently deleted' : '🗑  Delete my confession notes'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.bigBtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border }]} onPress={onBack}>
          <Text style={[styles.bigBtnText, { color: colors.textSecond }]}>Return to confession</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Root ────────────────────────────────────────────────────────────────────────

export default function ConfessionScreen() {
  const [screen, setScreen] = useState<SubScreen>('hub');
  if (screen === 'journal')     return <JournalView    onBack={() => setScreen('hub')} />;
  if (screen === 'examination') return <ExaminationView onBack={() => setScreen('hub')} />;
  if (screen === 'session')     return <SessionView    onBack={() => setScreen('hub')} onComplete={() => setScreen('complete')} />;
  if (screen === 'complete')    return <CompleteView   onBack={() => setScreen('hub')} />;
  return <Hub onNav={setScreen} />;
}

const styles = lazyThemed(() => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.navy },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },

  pageTitle: { fontFamily: fonts.cormorantMedium, fontSize: 28, color: colors.cream, marginBottom: 4 },
  pageSubtitle: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, marginBottom: 20 },

  subHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  subHeaderTitle: { fontFamily: fonts.cormorantMedium, fontSize: 20, color: colors.cream },
  linkGold: { fontFamily: fonts.latoBold, fontSize: 14, color: colors.gold, minWidth: 54 },
  headerCount: { fontFamily: fonts.latoBold, fontSize: 12, color: colors.gold },
  addPlus: { fontSize: 26, color: colors.gold, marginTop: -2 },

  privacyBanner: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', backgroundColor: 'rgba(201,168,76,0.05)', borderWidth: 1, borderColor: 'rgba(201,168,76,0.2)', borderRadius: 12, padding: 16, marginBottom: 16 },
  privacyLock: { fontSize: 18, flexShrink: 0 },

  styleToggleRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingTop: 12 },
  styleToggleBtn: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 999, borderWidth: 1 },
  styleToggleText: { fontFamily: fonts.latoBold, fontSize: 12 },
  privacyText: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, lineHeight: 18, flex: 1 },
  strong: { fontFamily: fonts.latoBold, color: colors.cream },

  sectionLabel: { fontFamily: fonts.latoBold, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.textSecond, marginBottom: 8, marginTop: 6 },
  labelHint: { fontFamily: fonts.latoLight, letterSpacing: 0, textTransform: 'none', color: colors.muted },

  moduleCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderWidth: 1, borderColor: colors.border, borderRadius: 12, marginBottom: 8, backgroundColor: colors.panel },
  moduleIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: colors.goldDim, alignItems: 'center', justifyContent: 'center' },
  moduleTitle: { fontFamily: fonts.latoBold, fontSize: 14, color: colors.cream, flexShrink: 1 },
  moduleSub: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, marginTop: 2, lineHeight: 17, flexShrink: 1 },
  moduleChevron: { fontSize: 20, color: colors.gold },

  // Self-report
  lastConfDate: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.gold, marginBottom: 10, opacity: 0.85 },
  dateInput: { backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, borderRadius: 8, color: colors.cream, fontFamily: fonts.latoLight, fontSize: 13, padding: 12, marginBottom: 10 },
  selfReportError: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.red, marginBottom: 8 },
  logBtn: { backgroundColor: colors.gold, borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginBottom: 10 },
  logBtnDisabled: { opacity: 0.5 },
  logBtnText: { fontFamily: fonts.latoBold, fontSize: 12, color: colors.navy, letterSpacing: 1 },
  selfReportHint: { fontFamily: fonts.latoLight, fontSize: 10, color: colors.muted, textAlign: 'center', opacity: 0.7 },

  comingSoonCard: { alignItems: 'center', paddingVertical: 20, gap: 8 },
  comingSoonIcon: { fontSize: 28, color: colors.muted, opacity: 0.5 },
  comingSoonTitle: { fontFamily: fonts.cormorantMedium, fontSize: 18, color: colors.cream },
  comingSoonBody: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, textAlign: 'center', lineHeight: 18 },

  histItem: { paddingVertical: 12 },
  histBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  histDate: { fontFamily: fonts.latoBold, fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.gold, opacity: 0.7, marginBottom: 3 },
  histTitle: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.cream, marginBottom: 2 },
  histNote: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, lineHeight: 18 },
  histTag: { backgroundColor: 'rgba(201,168,76,0.15)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20, alignSelf: 'flex-start', marginTop: 6 },
  histTagText: { fontFamily: fonts.latoBold, fontSize: 10, color: colors.goldLight, letterSpacing: 0.5 },
  histFooter: { fontFamily: fonts.latoLight, fontSize: 10, color: colors.muted, fontStyle: 'italic', marginTop: 10, textAlign: 'center', opacity: 0.6 },

  emptyState: { alignItems: 'center', paddingVertical: 20, gap: 6 },
  emptyIcon: { fontSize: 28, color: colors.muted, opacity: 0.4 },
  emptyTitle: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.muted },
  emptyBody: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, textAlign: 'center', lineHeight: 17, opacity: 0.7 },

  emptyCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 28, alignItems: 'center', marginTop: 8, backgroundColor: colors.panel },
  emptyCardTitle: { fontFamily: fonts.latoBold, fontSize: 15, color: colors.cream, marginBottom: 6 },
  emptyCardBody: { fontFamily: fonts.latoLight, fontSize: 13, color: colors.textSecond, lineHeight: 20, textAlign: 'center' },
  emptyBtn: { marginTop: 16, backgroundColor: colors.gold, paddingVertical: 11, paddingHorizontal: 22, borderRadius: 10 },
  emptyBtnText: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.navy },

  // Journal cards
  journalCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, marginBottom: 8, backgroundColor: colors.panel },
  journalCardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
  journalCardTitle: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.cream },
  journalCardDate: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, marginTop: 2 },
  journalCardExplain: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, lineHeight: 18, fontStyle: 'italic', marginBottom: 6 },
  journalCardBody: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.cream, lineHeight: 18, marginBottom: 8 },
  domainTag: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3, alignSelf: 'flex-start' },
  domainTagText: { fontFamily: fonts.latoBold, fontSize: 11 },

  // Composer
  domainGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  domainChip: { flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, minWidth: '47%', flexGrow: 1 },
  domainChipText: { fontFamily: fonts.latoBold, fontSize: 13 },
  pickCard: { borderWidth: 1, borderRadius: 12, padding: 14, marginTop: 10 },
  pickCardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  pickCardName: { flex: 1, fontFamily: fonts.latoBold, fontSize: 13, color: colors.cream },
  pickRadio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  pickRadioTick: { color: colors.navy, fontSize: 12, fontFamily: fonts.latoBold },
  pickCardDesc: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, lineHeight: 18, marginTop: 4, marginBottom: 4 },
  pickCardRef: { fontFamily: fonts.latoBold, fontSize: 11 },
  noteLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, marginBottom: 8 },
  noteInput: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, minHeight: 110, fontFamily: fonts.latoLight, fontSize: 14, lineHeight: 20, color: colors.cream, backgroundColor: colors.panel },
  composerHint: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, lineHeight: 18, marginTop: 12 },

  // Examination
  catPills: { flexDirection: 'row', gap: 6, paddingHorizontal: 20, paddingBottom: 10, paddingTop: 12 },
  catPill: { width: 38, height: 38, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  catPillBadge: { position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  catPillBadgeText: { color: colors.navy, fontSize: 9, fontFamily: fonts.latoBold },
  catHeaderCard: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 14 },
  catHeaderTitle: { fontFamily: fonts.cormorantMedium, fontSize: 18 },
  catHeaderCount: { fontFamily: fonts.latoLight, fontSize: 12, marginTop: 2, opacity: 0.85 },
  sinCard: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 10 },
  sinName: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.cream, marginBottom: 4 },
  sinDesc: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, lineHeight: 18, marginBottom: 4 },
  sinScripture: { fontFamily: fonts.latoBold, fontSize: 11, marginBottom: 10 },
  freqBtns: { flexDirection: 'row', gap: 6 },
  freqBtn: { flex: 1, paddingVertical: 7, borderRadius: 8, borderWidth: 1, alignItems: 'center' },
  freqBtnText: { fontFamily: fonts.latoBold, fontSize: 11 },
  navRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
  navBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  navBtnText: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.cream },
  catProgress: { fontFamily: fonts.latoLight, textAlign: 'center', fontSize: 11, color: colors.muted, marginTop: 10 },

  // Session
  sessionIntro: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, marginBottom: 14, lineHeight: 18 },
  catCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, marginBottom: 10, backgroundColor: colors.panel },
  sessionCatHead: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 8 },
  catLabel: { fontFamily: fonts.latoBold, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  sessionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.creamDim },
  sessionRowDone: { opacity: 0.4 },
  sessionDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  sessionItemName: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.cream },
  sessionItemSub: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, marginTop: 2 },
  strikethrough: { textDecorationLine: 'line-through' },
  sessionNote: { backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, marginTop: 4 },
  sessionNoteText: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, lineHeight: 18 },
  bigBtn: { width: '100%', paddingVertical: 14, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  bigBtnText: { fontFamily: fonts.latoBold, fontSize: 14, letterSpacing: 0.3 },

  // Complete
  completeCross: { fontSize: 44, color: colors.goldLight, marginTop: 32, marginBottom: 12 },
  completeTitle: { fontFamily: fonts.cormorantMedium, fontSize: 26, color: colors.goldLight, marginBottom: 12 },
  completeVerse: { fontFamily: fonts.cormorantItalic, fontSize: 15, color: colors.cream, textAlign: 'center', lineHeight: 22, marginBottom: 6 },
  completeRef: { fontFamily: fonts.latoBold, fontSize: 12, color: colors.green, marginBottom: 24 },
  afterCard: { borderWidth: 1, borderColor: 'rgba(93,202,135,0.35)', borderRadius: 12, padding: 16, width: '100%', backgroundColor: 'rgba(93,202,135,0.06)' },
  afterStep: { flexDirection: 'row', gap: 10, marginBottom: 10, alignItems: 'flex-start' },
  stepNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.navyMid, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { color: colors.goldLight, fontSize: 11, fontFamily: fonts.latoBold },
  afterStepText: { color: colors.cream, fontFamily: fonts.latoLight, fontSize: 13, lineHeight: 19, flex: 1 },
}));
