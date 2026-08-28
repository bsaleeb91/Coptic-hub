// app/(priest)/assign-canon.tsx
// The canon builder. It runs in two modes off the same editor, so the controls
// a priest learns in one place are the controls everywhere:
//
//   • With a memberId — reached from a member's screen — it builds THAT
//     member's personal rule. Each category has an "Assign" toggle: turning it
//     on writes that part of the canon to the member (locked, read-only for
//     them until their next confession or until the priest changes/removes it);
//     leaving it off never touches what the member already set for it.
//
//   • With no memberId — the Canon tab in the drawer — it is the template
//     workshop: build a canon that belongs to no one and save it as a reusable
//     template. Nothing here can touch a member.
//
// Either way a free-text custom component can be added alongside, without
// disturbing the rest of the canon.

import React, { useState, useEffect, useCallback } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors, fonts, lazyThemed } from '@/lib/theme';
import { PencilIcon } from '@/components/ui/TabIcons';
import { useSession } from '@/lib/auth';
import { useDemoMode } from '@/lib/demo';
import ScrollPicker from '@/components/ui/ScrollPicker';
import {
  RuleConfig, DEFAULT_RULE, ReadMode,
  AGPEYA_HOURS, SERVICES, CONFESSION_OPTIONS, SERVICE_FREQUENCY_OPTIONS,
  FAST_UNTIL_OPTIONS, WEEKDAYS, MAX_SERVICE_COUNT, setServicesMode,
} from '@/lib/canon/rule-store';
import {
  AssignedCategory, CATEGORY_LABEL, STRUCTURED_CATEGORIES,
  AssignedCanon, applyCategoryToRule, loadAssignedForPriest,
  assignCategory, removeAssignment,
} from '@/lib/canon/assigned';
import {
  CanonTemplate, CanonTemplateBody, loadTemplates, saveTemplate, replaceTemplate,
  renameTemplate, deleteTemplate, describeTemplate,
} from '@/lib/canon/templates';
import { confirmDestructive } from '@/lib/confirm';
import { loadMemberRule } from '@/lib/canon/rule-sync';

// Scheduling choices for custom components. The member's canon shows one on
// its chosen weekdays; frequencies longer than weekly rest for their period
// after the member checks it off (same model as Heart of Service).
const CUSTOM_FREQUENCIES = ['Daily', 'Weekly', 'Every 2 weeks', 'Monthly', 'Quarterly', 'Twice a year'];

const SP = { xs: 6, sm: 10, md: 14, lg: 20 };
const R = { md: 10, lg: 12, full: 999 };

// ─── Small controls ───────────────────────────────────────────────────────────

function Stepper({ value, onChange, min = 0, max = 999, step = 1, unit }: {
  value: number; onChange: (n: number) => void; min?: number; max?: number; step?: number; unit?: string;
}) {
  // One bordered pill so −/value/+ read as a single control; the value box only
  // widens when it carries a unit ("60 min"), which keeps the buttons snug
  // around a bare number instead of stranded at the card's edges.
  return (
    <View style={s.stepperRow}>
      <View style={s.stepperBox}>
        <TouchableOpacity style={s.stepBtn} onPress={() => onChange(Math.max(min, value - step))}><Text style={s.stepBtnText}>−</Text></TouchableOpacity>
        <Text style={[s.stepValue, unit ? s.stepValueWide : null]}>{value}{unit ? ` ${unit}` : ''}</Text>
        <TouchableOpacity style={s.stepBtn} onPress={() => onChange(Math.min(max, value + step))}><Text style={s.stepBtnText}>+</Text></TouchableOpacity>
      </View>
    </View>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[s.chip, { borderColor: on ? colors.gold : colors.border, backgroundColor: on ? colors.gold : 'transparent' }]}
      onPress={onPress}
    >
      <Text style={{ color: on ? colors.navy : colors.textSecond, fontSize: 12, fontFamily: fonts.latoBold }}>{label}</Text>
    </TouchableOpacity>
  );
}

// A category card with an Assign toggle; children only editable when assigned.
function CatCard({ category, assigned, onToggle, summary, icon, children }: {
  category: AssignedCategory; assigned: boolean; onToggle: (on: boolean) => void;
  summary?: string; icon?: React.ReactNode; children?: React.ReactNode;
}) {
  return (
    <View style={[s.card, assigned && { borderColor: colors.gold }]}>
      <TouchableOpacity style={s.cardHead} onPress={() => onToggle(!assigned)} activeOpacity={0.7}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
          {icon}
          <View style={{ flex: 1 }}>
            <Text style={s.cardTitle}>{CATEGORY_LABEL[category]}</Text>
            {!assigned && summary ? <Text style={s.cardSummary}>{summary}</Text> : null}
          </View>
        </View>
        <View style={[s.toggle, assigned && s.toggleOn]}>
          <View style={[s.toggleKnob, assigned && s.toggleKnobOn]} />
        </View>
      </TouchableOpacity>
      {assigned && <View style={{ marginTop: SP.sm }}>{children}</View>}
    </View>
  );
}

const DAY_ABBR = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function AssignCanonScreen() {
  const router = useRouter();
  const { memberId, memberName } = useLocalSearchParams<{ memberId: string; memberName: string }>();
  const { user } = useSession();
  const { demoMode } = useDemoMode();
  const displayName = memberName ?? 'Member';
  // No member behind the screen: the drawer's Canon tab, where templates are
  // built. Nothing in this mode can reach a member's canon.
  const templateMode = !memberId;

  const [work, setWork] = useState<RuleConfig | null>(null);
  const [enabled, setEnabled] = useState<Set<AssignedCategory>>(new Set());
  const [orig, setOrig] = useState<Set<AssignedCategory>>(new Set());
  const [origPayloads, setOrigPayloads] = useState<Record<string, string>>({}); // category -> serialized loaded payload
  const [customList, setCustomList] = useState<{ id?: string; text: string; freq: string; days: number[] }[]>([]);
  const [origCustomIds, setOrigCustomIds] = useState<string[]>([]);
  const [origCustomSnap, setOrigCustomSnap] = useState<Record<string, string>>({}); // id -> serialized schedule
  const [newCustom, setNewCustom] = useState('');
  const [expandDay, setExpandDay] = useState<AssignedCategory | null>(null);
  const [expandDayIdx, setExpandDayIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  // Reusable canon templates this priest has saved. Applying one only fills in
  // the editor below — nothing reaches the member until Save.
  const [templates, setTemplates] = useState<CanonTemplate[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [showTemplateSave, setShowTemplateSave] = useState(false);
  const [templateMsg, setTemplateMsg] = useState('');
  const [templateErr, setTemplateErr] = useState('');
  // In template mode, which template is being edited (null = building a new one).
  const [editing, setEditing] = useState<CanonTemplate | null>(null);

  const load = useCallback(async () => {
    // Template mode has no member to read: start from the app defaults with
    // nothing switched on, so a template is built deliberately rather than
    // inheriting whoever was looked at last.
    if (templateMode) {
      setWork(JSON.parse(JSON.stringify(DEFAULT_RULE)));
      setEnabled(new Set()); setOrig(new Set()); setOrigPayloads({});
      setCustomList([]); setOrigCustomIds([]); setOrigCustomSnap({});
      return;
    }
    const [assigned, memberRule] = await Promise.all([
      loadAssignedForPriest(memberId ?? '', user?.id ?? '', demoMode),
      loadMemberRule(memberId ?? '', demoMode),
    ]);
    // Seed the editor from the member's CURRENT self-set rule, so unassigned
    // categories show what the member actually does and "editing" a category
    // starts from reality rather than app defaults. Categories this priest
    // has assigned overlay on top below.
    const w: RuleConfig = memberRule ?? JSON.parse(JSON.stringify(DEFAULT_RULE));
    const en = new Set<AssignedCategory>();
    const custom: { id?: string; text: string; freq: string; days: number[] }[] = [];
    for (const a of assigned) {
      if (a.category === 'custom') {
        custom.push({
          id: a.id, text: a.component, freq: a.frequency,
          days: Array.isArray(a.payload?.days) ? a.payload.days : [],
        });
        continue;
      }
      applyCategoryToRule(w, a);
      en.add(a.category);
    }
    // Snapshot each loaded category's payload (serialized the same way we write
    // it) so Save only re-assigns categories the priest actually changed.
    const op: Record<string, string> = {};
    en.forEach(cat => { op[cat] = JSON.stringify(buildPayload(cat, w)); });
    setWork(w); setEnabled(en); setOrig(new Set(en)); setOrigPayloads(op);
    setCustomList(custom); setOrigCustomIds(custom.map(c => c.id!).filter(Boolean));
    const snap: Record<string, string> = {};
    for (const c of custom) if (c.id) snap[c.id] = JSON.stringify({ f: c.freq, d: c.days });
    setOrigCustomSnap(snap);
  }, [memberId, demoMode, user?.id, templateMode]);

  useEffect(() => { load(); }, [load]);

  const refreshTemplates = useCallback(async () => {
    setTemplates(await loadTemplates(user?.id ?? '', demoMode));
  }, [user?.id, demoMode]);
  useEffect(() => { refreshTemplates(); }, [refreshTemplates]);

  // ── Templates ──
  // The body carries the same payloads assignCategory writes, so applying one
  // runs through applyCategoryToRule exactly as a real assignment would.
  function currentTemplateBody(): CanonTemplateBody {
    const w = work!;
    const parts = STRUCTURED_CATEGORIES
      .filter(cat => enabled.has(cat))
      .map(cat => ({ category: cat, component: `${CATEGORY_LABEL[cat]} — ${summarize(cat, w)}`, payload: buildPayload(cat, w) }));
    const pending = newCustom.trim() ? [{ text: newCustom.trim(), freq: 'Daily', days: [] as number[] }] : [];
    const custom = [...customList, ...pending]
      .filter(c => c.text.trim())
      .map(c => ({ text: c.text.trim(), freq: c.freq, days: c.freq === 'Daily' ? [] : c.days }));
    return { parts, custom };
  }

  // Fill the editor from a template. Categories the template doesn't mention
  // are left exactly as they are — still showing what this member actually
  // does — so a template adds to the picture rather than wiping it.
  function useTemplate(t: CanonTemplate) {
    setTemplateErr(''); setTemplateMsg('');
    setWork(w => {
      if (!w) return w;
      const next: RuleConfig = JSON.parse(JSON.stringify(w));
      for (const p of t.body.parts) {
        applyCategoryToRule(next, { category: p.category, payload: p.payload } as AssignedCanon);
      }
      return next;
    });
    setEnabled(prev => {
      const n = new Set(prev);
      t.body.parts.forEach(p => n.add(p.category));
      return n;
    });
    // Custom components are added, not swapped in: anything already assigned to
    // this member stays. Matching text isn't duplicated.
    setCustomList(prev => {
      const seen = new Set(prev.map(c => c.text.trim().toLowerCase()));
      const add = t.body.custom.filter(c => !seen.has(c.text.trim().toLowerCase()));
      return [...prev, ...add];
    });
    if (templateMode) {
      // Opening a template for editing, not filling in someone's canon.
      setEditing(t);
      setTemplateName(t.name);
      setTemplateMsg(`Editing “${t.name}”.`);
    } else {
      setTemplateMsg(`Loaded “${t.name}” — review it, then Save to assign.`);
    }
  }

  // Start a fresh template from nothing, rather than from whatever is on screen.
  function startNewTemplate() {
    setEditing(null); setTemplateName(''); setTemplateErr(''); setTemplateMsg('');
    setWork(JSON.parse(JSON.stringify(DEFAULT_RULE)));
    setEnabled(new Set());
    setCustomList([]); setNewCustom('');
  }

  // The bottom action in template mode: update the open template, or save a new one.
  async function commitTemplate(asNew: boolean) {
    setTemplateErr(''); setTemplateMsg('');
    const body = currentTemplateBody();
    if (!asNew && editing) {
      if (!body.parts.length && !body.custom.length) {
        setTemplateErr('Turn on at least one part of the canon first.'); return;
      }
      const { error } = await replaceTemplate(editing.id, demoMode, body);
      if (error) { setTemplateErr(error); return; }
      if (templateName.trim() && templateName.trim() !== editing.name) {
        await renameTemplate(editing.id, demoMode, templateName);
      }
      setTemplateMsg(`Saved “${templateName.trim() || editing.name}”.`);
      await refreshTemplates();
      return;
    }
    const { error } = await saveTemplate(user?.id ?? '', demoMode, templateName, body);
    if (error) { setTemplateErr(error); return; }
    setTemplateMsg(`Saved “${templateName.trim()}”.`);
    await refreshTemplates();
    startNewTemplate();
  }

  async function handleSaveTemplate() {
    setTemplateErr(''); setTemplateMsg('');
    const body = currentTemplateBody();
    const { error } = await saveTemplate(user?.id ?? '', demoMode, templateName, body);
    if (error) { setTemplateErr(error); return; }
    setTemplateName(''); setShowTemplateSave(false);
    setTemplateMsg('Template saved.');
    await refreshTemplates();
  }

  async function handleReplaceTemplate(t: CanonTemplate) {
    setTemplateErr(''); setTemplateMsg('');
    const { error } = await replaceTemplate(t.id, demoMode, currentTemplateBody());
    if (error) { setTemplateErr(error); return; }
    setTemplateMsg(`Updated “${t.name}”.`);
    await refreshTemplates();
  }

  function handleDeleteTemplate(t: CanonTemplate) {
    confirmDestructive('Delete template', `Remove “${t.name}”? Canons already assigned from it are not affected.`, 'Delete', async () => {
      const { error } = await deleteTemplate(t.id, demoMode);
      if (error) { setTemplateErr(error); return; }
      await refreshTemplates();
    });
  }

  const toggle = (cat: AssignedCategory, on: boolean) => {
    setEnabled(prev => { const n = new Set(prev); on ? n.add(cat) : n.delete(cat); return n; });
  };
  const patch = (p: Partial<RuleConfig>) => setWork(w => (w ? { ...w, ...p } : w));
  const setDay = (i: number, dp: Partial<{ hours: string[]; services: string[] }>) =>
    setWork(w => w ? { ...w, days: w.days.map((d, idx) => idx === i ? { ...d, ...dp } : d) } : w);
  const toggleIn = (arr: string[], k: string) => arr.includes(k) ? arr.filter(x => x !== k) : [...arr, k];

  function buildPayload(cat: AssignedCategory, w: RuleConfig): any {
    switch (cat) {
      case 'prostrations':     return { count: w.prostrations };
      case 'quiet':            return { minutes: w.quietMinutes };
      case 'fasting':          return { until: w.fastUntil };
      case 'bible':            return { mode: w.bible.mode, amount: w.bible.amount };
      case 'book':             return w.book ? { title: w.book.title, mode: w.book.mode, amount: w.book.amount } : null;
      case 'confession':       return { frequency: w.confession };
      case 'agpeya_hours':     return { days: Object.fromEntries(w.days.map((d, i) => [i, d.hours])) };
      // Either shape, never both — see RuleConfig.servicesMode.
      case 'services':         return w.servicesMode === 'counts'
                                 ? { mode: 'counts', counts: w.serviceCounts ?? {} }
                                 : { mode: 'days', days: Object.fromEntries(w.days.map((d, i) => [i, d.services])) };
      case 'heart_of_service': return { days: Object.fromEntries(w.days.map((d, i) => [i, d.serving])) };
      default:                 return null;
    }
  }

  function summarize(cat: AssignedCategory, w: RuleConfig): string {
    switch (cat) {
      case 'prostrations':     return `${w.prostrations} metanias`;
      case 'quiet':            return `${w.quietMinutes} min`;
      case 'fasting':          return `until ${w.fastUntil}`;
      case 'bible':            return `${w.bible.amount} ${w.bible.mode}`;
      case 'book':             return w.book?.title || 'a spiritual book';
      case 'confession':       return w.confession;
      case 'agpeya_hours':     return `${w.days.reduce((n, d) => n + d.hours.length, 0)} hour-days`;
      case 'services':         return w.servicesMode === 'counts'
                                 ? `${Object.values(w.serviceCounts ?? {}).reduce((n, c) => n + c, 0)}× / week`
                                 : `${w.days.reduce((n, d) => n + d.services.length, 0)} service-days`;
      case 'heart_of_service': return `${w.days.reduce((n, d) => n + d.serving.filter(x => x.text.trim()).length, 0)} commitments`;
      default:                 return '';
    }
  }

  async function handleSave() {
    if (!work || saving) return;
    setSaving(true); setSaveError('');
    try {
      for (const cat of STRUCTURED_CATEGORIES) {
        if (enabled.has(cat)) {
          // Only (re)assign if this category actually changed — re-writing an
          // untouched category would mint a new created_at and needlessly re-lock
          // it, clobbering any value the member edited after a prior fold.
          const payload = buildPayload(cat, work);
          const changed = !orig.has(cat) || JSON.stringify(payload) !== origPayloads[cat];
          if (changed) {
            await assignCategory({
              memberId: memberId ?? '', priestId: user?.id ?? '', demoMode,
              category: cat, component: `${CATEGORY_LABEL[cat]} — ${summarize(cat, work)}`, payload,
            });
          }
        } else if (orig.has(cat)) {
          await removeAssignment({ memberId: memberId ?? '', priestId: user?.id ?? '', demoMode, category: cat });
        }
      }
      // Custom components: add new (no id), replace ones whose schedule the
      // priest changed, remove any originally present but now gone. A
      // component still sitting in the input counts too — typing one and
      // hitting SAVE without tapping the add button is the natural flow, and
      // silently dropping it lost the priest's custom canon.
      const customs = newCustom.trim()
        ? [...customList, { text: newCustom.trim(), freq: 'Daily', days: [] as number[] }]
        : customList;
      for (const c of customs) {
        if (!c.text.trim()) continue;
        // Days are ignored for Daily — compare and persist the EFFECTIVE
        // schedule, so a Daily round-trip doesn't count as a change (which
        // would replace the row and re-lock it).
        const effDays = c.freq === 'Daily' ? [] : c.days;
        const payload = effDays.length ? { days: effDays } : null;
        if (!c.id) {
          await assignCategory({
            memberId: memberId ?? '', priestId: user?.id ?? '', demoMode,
            category: 'custom', component: c.text.trim(), payload, frequency: c.freq,
          });
        } else if (origCustomSnap[c.id] !== JSON.stringify({ f: c.freq, d: effDays })) {
          // Schedule changed — replace the row. The fresh created_at re-locks
          // it, which is right: the priest just re-prescribed it.
          await removeAssignment({ memberId: memberId ?? '', priestId: user?.id ?? '', demoMode, category: 'custom', id: c.id });
          await assignCategory({
            memberId: memberId ?? '', priestId: user?.id ?? '', demoMode,
            category: 'custom', component: c.text.trim(), payload, frequency: c.freq,
          });
        }
      }
      const keptIds = new Set(customList.map(c => c.id).filter(Boolean) as string[]);
      for (const id of origCustomIds) {
        if (!keptIds.has(id)) {
          await removeAssignment({ memberId: memberId ?? '', priestId: user?.id ?? '', demoMode, category: 'custom', id });
        }
      }
      setSaved(true);
      setTimeout(() => router.back(), 1100);
    } catch {
      setSaving(false);
      setSaveError('Could not save the canon — please try again.');
    }
  }

  if (!work) {
    return <SafeAreaView style={s.safe}><View style={s.center}><ActivityIndicator color={colors.gold} /></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView style={s.scroll} contentContainerStyle={s.content}>
        {!templateMode && (
          <TouchableOpacity style={s.backRow} onPress={() => router.back()}>
            <Text style={s.backArrow}>‹</Text><Text style={s.backText}>{displayName}</Text>
          </TouchableOpacity>
        )}
        <Text style={s.pageTitle}>
          {templateMode ? 'Canon Builder' : `Build ${displayName.split(' ')[0]}'s Canon`}
        </Text>
        <Text style={s.pageSub}>
          {templateMode
            ? 'Build a canon here and keep it as a template, ready to apply to anyone in your flock. Nothing on this screen belongs to a member — assigning happens from their own canon.'
            : 'Turn on a category to assign it. Assigned parts are locked for the member until their next confession, or until you change or remove them. Untouched categories stay as the member set them.'}
        </Text>

        {/* Templates — start from a canon you prescribe often, or keep this one
            for next time. Building from scratch below is unchanged. */}
        <View style={s.tplCard}>
          <View style={s.tplHead}>
            <Text style={s.tplTitle}>{templateMode ? 'My Templates' : 'Templates'}</Text>
            {templateMode ? (
              <TouchableOpacity onPress={startNewTemplate} hitSlop={8}>
                <Text style={s.tplAction}>+ New template</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={() => { setShowTemplateSave(v => !v); setTemplateErr(''); setTemplateMsg(''); }} hitSlop={8}>
                <Text style={s.tplAction}>{showTemplateSave ? 'Cancel' : '+ Save this canon'}</Text>
              </TouchableOpacity>
            )}
          </View>

          {!templateMode && showTemplateSave && (
            <View style={s.tplSaveRow}>
              <TextInput
                style={[s.input, { marginBottom: SP.xs }]}
                placeholder="Name it — e.g. New believer, Youth, Lent"
                placeholderTextColor={colors.muted}
                value={templateName}
                onChangeText={setTemplateName}
              />
              <TouchableOpacity style={s.tplSaveBtn} onPress={handleSaveTemplate}>
                <Text style={s.tplSaveBtnText}>SAVE AS TEMPLATE</Text>
              </TouchableOpacity>
              <Text style={s.tplHint}>
                Saves the categories switched on right now, with their values and any custom components.
              </Text>
            </View>
          )}

          {templates.length === 0 ? (
            <Text style={s.tplEmpty}>
              {templateMode
                ? 'No templates yet. Switch on the parts of the canon below, name it, and save — then it’s one tap on any member’s canon.'
                : 'No templates yet. Build them in the Canon tab, or “Save this canon” to reuse this one.'}
            </Text>
          ) : (
            templates.map(t => (
              <View key={t.id} style={[s.tplRow, editing?.id === t.id && s.tplRowEditing]}>
                <TouchableOpacity style={{ flex: 1 }} onPress={() => useTemplate(t)} activeOpacity={0.8}>
                  <Text style={s.tplName}>{t.name}</Text>
                  <Text style={s.tplDesc} numberOfLines={2}>{describeTemplate(t)}</Text>
                </TouchableOpacity>
                {!templateMode && (
                  <TouchableOpacity onPress={() => handleReplaceTemplate(t)} hitSlop={8}>
                    <Text style={s.tplUpdate}>Update</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => handleDeleteTemplate(t)} hitSlop={8}>
                  <Text style={s.tplDelete}>✕</Text>
                </TouchableOpacity>
              </View>
            ))
          )}

          {templateMsg ? <Text style={s.tplMsg}>{templateMsg}</Text> : null}
          {templateErr ? <Text style={s.tplErr}>{templateErr}</Text> : null}
        </View>

        {/* Every day */}
        <CatCard category="prostrations" assigned={enabled.has('prostrations')} onToggle={o => toggle('prostrations', o)} summary={summarize('prostrations', work)}>
          <Stepper value={work.prostrations} onChange={n => patch({ prostrations: n })} max={500} unit="metanias" />
        </CatCard>

        <CatCard category="quiet" assigned={enabled.has('quiet')} onToggle={o => toggle('quiet', o)} summary={summarize('quiet', work)}>
          <Stepper value={work.quietMinutes} onChange={n => patch({ quietMinutes: n })} step={5} max={180} unit="min" />
        </CatCard>

        <CatCard category="fasting" assigned={enabled.has('fasting')} onToggle={o => toggle('fasting', o)} summary={summarize('fasting', work)}>
          <Text style={[s.subLabel, { textAlign: 'right', color: colors.goldLight }]}>{work.fastUntil}</Text>
          <ScrollPicker options={FAST_UNTIL_OPTIONS} value={work.fastUntil} onChange={v => patch({ fastUntil: v })} />
        </CatCard>

        <CatCard category="bible" assigned={enabled.has('bible')} onToggle={o => toggle('bible', o)} summary={summarize('bible', work)}>
          <View style={s.chipRow}>
            <Chip label="Chapters" on={work.bible.mode === 'chapters'} onPress={() => patch({ bible: { ...work.bible, mode: 'chapters' as ReadMode } })} />
            <Chip label="Minutes" on={work.bible.mode === 'minutes'} onPress={() => patch({ bible: { ...work.bible, mode: 'minutes' as ReadMode } })} />
          </View>
          <Stepper value={work.bible.amount} onChange={n => patch({ bible: { ...work.bible, amount: n } })} step={work.bible.mode === 'minutes' ? 5 : 1} max={180}
            unit={work.bible.mode === 'minutes' ? 'min' : work.bible.amount === 1 ? 'chapter' : 'chapters'} />
        </CatCard>

        <CatCard category="book" assigned={enabled.has('book')} onToggle={o => { toggle('book', o); if (o && !work.book) patch({ book: { title: '', mode: 'chapters', amount: 1 } }); }} summary={summarize('book', work)}>
          <TextInput style={s.input} placeholder="Book title (e.g. The Spiritual Ladder)" placeholderTextColor={colors.muted}
            value={work.book?.title ?? ''} onChangeText={t => patch({ book: { title: t, mode: work.book?.mode ?? 'chapters', amount: work.book?.amount ?? 1 } })} />
          <View style={[s.chipRow, { marginTop: SP.sm }]}>
            <Chip label="Chapters" on={work.book?.mode === 'chapters'} onPress={() => patch({ book: { title: work.book?.title ?? '', mode: 'chapters', amount: work.book?.amount ?? 1 } })} />
            <Chip label="Minutes" on={work.book?.mode === 'minutes'} onPress={() => patch({ book: { title: work.book?.title ?? '', mode: 'minutes', amount: work.book?.amount ?? 1 } })} />
          </View>
          <Stepper value={work.book?.amount ?? 1} onChange={n => patch({ book: { title: work.book?.title ?? '', mode: work.book?.mode ?? 'chapters', amount: n } })} step={work.book?.mode === 'minutes' ? 5 : 1} max={180}
            unit={work.book?.mode === 'minutes' ? 'min' : (work.book?.amount ?? 1) === 1 ? 'chapter' : 'chapters'} />
        </CatCard>

        <CatCard category="confession" assigned={enabled.has('confession')} onToggle={o => toggle('confession', o)} summary={summarize('confession', work)}>
          <View style={[s.chipRow, { flexWrap: 'wrap' }]}>
            {CONFESSION_OPTIONS.map(opt => <Chip key={opt} label={opt} on={work.confession === opt} onPress={() => patch({ confession: opt })} />)}
          </View>
        </CatCard>

        {/* Day-based categories */}
        {(['agpeya_hours', 'services', 'heart_of_service'] as AssignedCategory[]).map(cat => (
          <CatCard key={cat} category={cat} assigned={enabled.has(cat)} onToggle={o => toggle(cat, o)} summary={summarize(cat, work)}>
            {/* Services can be committed either to specific weekdays OR to a
                number of times per week the member logs — never both. */}
            {cat === 'services' && (
              <>
                <View style={[s.chipRow, { flexWrap: 'wrap', marginBottom: SP.xs }]}>
                  <Chip label="Specific days" on={work.servicesMode === 'days'}
                    onPress={() => setWork(w => w ? setServicesMode(w, 'days') : w)} />
                  <Chip label="Times per week" on={work.servicesMode === 'counts'}
                    onPress={() => setWork(w => w ? setServicesMode(w, 'counts') : w)} />
                </View>
                {work.servicesMode === 'counts' && (
                  <>
                    <Text style={s.fieldNote}>How many times a week to attend each service. The member logs each one as they attend.</Text>
                    {SERVICES.map(sv => (
                      <View key={sv.key} style={s.countRow}>
                        <Text style={s.countLabel}>{sv.name}</Text>
                        <Stepper
                          value={work.serviceCounts?.[sv.key] ?? 0}
                          onChange={n => {
                            const counts = { ...(work.serviceCounts ?? {}) };
                            if (n > 0) counts[sv.key] = n; else delete counts[sv.key];
                            patch({ serviceCounts: counts });
                          }}
                          max={MAX_SERVICE_COUNT}
                          unit="× / week"
                        />
                      </View>
                    ))}
                  </>
                )}
              </>
            )}
            {cat === 'services' && work.servicesMode === 'counts' ? null : (
            <Text style={s.fieldNote}>Set what's prayed/served on each weekday. Tap a day to edit it.</Text>
            )}
            {(cat === 'services' && work.servicesMode === 'counts' ? [] : WEEKDAYS).map((name, i) => {
              const d = work.days[i];
              const open = expandDay === cat && expandDayIdx === i;
              const count = cat === 'agpeya_hours' ? d.hours.length : cat === 'services' ? d.services.length : d.serving.filter(x => x.text.trim()).length;
              return (
                <View key={i} style={s.dayRow}>
                  <TouchableOpacity style={s.dayHead} onPress={() => setExpand(cat, i)}>
                    <Text style={s.dayName}>{name}</Text>
                    <Text style={s.daySummary}>{count ? `${count} set` : 'none'}  {open ? '▲' : '▾'}</Text>
                  </TouchableOpacity>
                  {open && cat === 'agpeya_hours' && (
                    <View style={[s.chipRow, { flexWrap: 'wrap', marginTop: SP.xs }]}>
                      {AGPEYA_HOURS.map(h => <Chip key={h.key} label={h.name} on={d.hours.includes(h.key)} onPress={() => setDay(i, { hours: toggleIn(d.hours, h.key) })} />)}
                    </View>
                  )}
                  {open && cat === 'services' && (
                    <View style={[s.chipRow, { flexWrap: 'wrap', marginTop: SP.xs }]}>
                      {SERVICES.map(sv => <Chip key={sv.key} label={sv.name} on={d.services.includes(sv.key)} onPress={() => setDay(i, { services: toggleIn(d.services, sv.key) })} />)}
                    </View>
                  )}
                  {open && cat === 'heart_of_service' && (
                    <View style={{ marginTop: SP.xs }}>
                      {d.serving.map((sv, j) => (
                        <View key={j} style={s.serveEntry}>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <TextInput style={[s.input, { flex: 1 }]} placeholder="Service (e.g. visiting the sick)" placeholderTextColor={colors.muted}
                              value={sv.text} onChangeText={t => setServing(i, j, { text: t })} />
                            <TouchableOpacity onPress={() => setServingList(i, d.serving.filter((_, idx) => idx !== j))} hitSlop={8}>
                              <Text style={{ color: colors.red, fontSize: 12, marginLeft: SP.sm }}>Remove</Text>
                            </TouchableOpacity>
                          </View>
                          <View style={[s.chipRow, { flexWrap: 'wrap', marginTop: SP.xs }]}>
                            {SERVICE_FREQUENCY_OPTIONS.map(opt => <Chip key={opt} label={opt} on={sv.freq === opt} onPress={() => setServing(i, j, { freq: opt })} />)}
                          </View>
                        </View>
                      ))}
                      <TouchableOpacity onPress={() => setServingList(i, [...d.serving, { text: '', freq: 'Weekly' }])} hitSlop={8}>
                        <Text style={{ color: colors.gold, fontSize: 12, fontFamily: fonts.latoBold, marginTop: 4 }}>+ Add commitment</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}
          </CatCard>
        ))}

        {/* Custom free-text */}
        <View style={s.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: SP.sm }}>
            <PencilIcon size={16} color={colors.gold} />
            <Text style={s.cardTitle}>Custom components</Text>
          </View>
          <Text style={s.fieldNote}>Free-text additions to the member's canon. Read-only for them; you manage these.</Text>
          {customList.map((c, i) => (
            <View key={c.id ?? `new-${i}`} style={s.customBlock}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={s.customText}>{c.text}</Text>
                <TouchableOpacity onPress={() => setCustomList(list => list.filter((_, idx) => idx !== i))} hitSlop={8}>
                  <Text style={{ color: colors.red, fontSize: 12 }}>Remove</Text>
                </TouchableOpacity>
              </View>
              <View style={s.chipsRow}>
                {CUSTOM_FREQUENCIES.map(f => (
                  <TouchableOpacity
                    key={f}
                    style={[s.schedChip, c.freq === f && s.schedChipOn]}
                    onPress={() => setCustomList(list => list.map((x, idx) =>
                      // Days are kept when tapping Daily (they're just ignored),
                      // so an accidental Daily tap can be undone without losing
                      // the weekday selection.
                      idx === i ? { ...x, freq: f } : x))}
                  >
                    <Text style={[s.schedChipTxt, c.freq === f && s.schedChipTxtOn]}>{f}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {c.freq !== 'Daily' && (
                <View style={s.chipsRow}>
                  {WEEKDAYS.map((d, di) => (
                    <TouchableOpacity
                      key={d}
                      style={[s.dayChipSm, c.days.includes(di) && s.schedChipOn]}
                      onPress={() => setCustomList(list => list.map((x, idx) =>
                        idx === i
                          ? { ...x, days: x.days.includes(di) ? x.days.filter(v => v !== di) : [...x.days, di].sort((a, b) => a - b) }
                          : x))}
                    >
                      <Text style={[s.schedChipTxt, c.days.includes(di) && s.schedChipTxtOn]}>{d.slice(0, 3)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              {c.freq !== 'Daily' && c.days.length === 0 && (
                <Text style={s.fieldNote}>No day chosen — it will show every day of the week.</Text>
              )}
            </View>
          ))}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: SP.sm }}>
            <TextInput style={[s.input, { flex: 1 }]} placeholder="e.g. Read the Sayings of the Desert Fathers" placeholderTextColor={colors.muted}
              value={newCustom} onChangeText={setNewCustom} />
            <TouchableOpacity
              onPress={() => { if (newCustom.trim()) { setCustomList(list => [...list, { text: newCustom.trim(), freq: 'Daily', days: [] }]); setNewCustom(''); } }}
              hitSlop={8}
            >
              <Text style={{ color: colors.gold, fontSize: 13, fontFamily: fonts.latoBold, marginLeft: SP.sm }}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>

        {templateMode ? (
          <View style={s.tplCommit}>
            <Text style={s.formLabelSm}>{editing ? 'TEMPLATE NAME' : 'NAME THIS TEMPLATE'}</Text>
            <TextInput
              style={s.input}
              placeholder="e.g. New believer, Youth, Lent"
              placeholderTextColor={colors.muted}
              value={templateName}
              onChangeText={setTemplateName}
            />
            {templateErr ? <Text style={s.errorText}>{templateErr}</Text> : null}
            {templateMsg ? <Text style={s.tplMsg}>{templateMsg}</Text> : null}
            <TouchableOpacity style={s.saveBtn} onPress={() => commitTemplate(false)}>
              <Text style={s.saveBtnText}>{editing ? 'SAVE TEMPLATE' : 'CREATE TEMPLATE'}</Text>
            </TouchableOpacity>
            {editing && (
              <TouchableOpacity style={s.tplSecondary} onPress={() => commitTemplate(true)}>
                <Text style={s.tplSecondaryText}>Save as a new template instead</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <>
            {saveError ? <Text style={s.errorText}>{saveError}</Text> : null}
            <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.5 }]} onPress={handleSave} disabled={saving}>
              {saving
                ? <ActivityIndicator color={colors.navy} />
                : <Text style={s.saveBtnText}>{saved ? `✓ SAVED TO ${displayName.split(' ')[0].toUpperCase()}` : `SAVE ${displayName.split(' ')[0].toUpperCase()}'S CANON`}</Text>}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );

  // ── day-expander helpers (need component state) ──
  function setExpand(cat: AssignedCategory, i: number) {
    if (expandDay === cat && expandDayIdx === i) { setExpandDay(null); return; }
    setExpandDay(cat); setExpandDayIdx(i);
  }
  function setServing(i: number, j: number, p: Partial<{ text: string; freq: string }>) {
    setWork(w => w ? { ...w, days: w.days.map((d, idx) => idx === i ? { ...d, serving: d.serving.map((e, k) => k === j ? { ...e, ...p } : e) } : d) } : w);
  }
  function setServingList(i: number, list: { text: string; freq: string }[]) {
    setWork(w => w ? { ...w, days: w.days.map((d, idx) => idx === i ? { ...d, serving: list } : d) } : w);
  }
}

const s = lazyThemed(() => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.navy },
  scroll: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: SP.lg, paddingBottom: 48 },

  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  backArrow: { fontFamily: fonts.cormorant, fontSize: 22, color: colors.gold },
  backText: { fontFamily: fonts.latoLight, fontSize: 13, color: colors.muted },
  pageTitle: { fontFamily: fonts.cormorantMedium, fontSize: 26, color: colors.cream, marginBottom: 6 },
  pageSub: { fontFamily: fonts.latoLight, fontSize: 12, lineHeight: 18, color: colors.textSecond, marginBottom: SP.lg },

  card: { borderWidth: 1, borderColor: colors.border, borderRadius: R.lg, padding: SP.md, marginBottom: SP.sm, backgroundColor: colors.panel },

  // Templates
  tplCard: { borderWidth: 1, borderColor: colors.gold + '55', borderRadius: R.lg, padding: SP.md, marginBottom: SP.md, backgroundColor: colors.goldDim },
  tplHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SP.xs },
  tplTitle: { fontFamily: fonts.cormorantMedium, fontSize: 18, color: colors.cream },
  tplAction: { fontFamily: fonts.latoBold, fontSize: 12, color: colors.gold },
  tplEmpty: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, lineHeight: 18, marginTop: SP.xs },
  tplRow: { flexDirection: 'row', alignItems: 'center', gap: SP.sm, paddingVertical: SP.sm, borderTopWidth: 1, borderTopColor: colors.border },
  tplName: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.cream },
  tplDesc: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, marginTop: 1, lineHeight: 15 },
  tplUpdate: { fontFamily: fonts.latoBold, fontSize: 11, color: colors.gold },
  tplDelete: { fontFamily: fonts.latoBold, fontSize: 14, color: colors.red, paddingHorizontal: 2 },
  tplSaveRow: { marginBottom: SP.sm },
  tplSaveBtn: { backgroundColor: colors.gold, borderRadius: R.md, paddingVertical: SP.sm, alignItems: 'center' },
  tplSaveBtnText: { fontFamily: fonts.latoBold, fontSize: 11, color: colors.navy, letterSpacing: 0.8 },
  tplHint: { fontFamily: fonts.latoLight, fontSize: 10, color: colors.muted, marginTop: SP.xs, lineHeight: 14 },
  tplRowEditing: { backgroundColor: colors.goldDim },
  tplCommit: { marginTop: SP.sm },
  formLabelSm: { fontFamily: fonts.latoBold, fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.gold, opacity: 0.8, marginBottom: SP.xs },
  tplSecondary: { alignItems: 'center', paddingVertical: SP.sm },
  tplSecondaryText: { fontFamily: fonts.lato, fontSize: 12, color: colors.gold },
  tplMsg: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.green, marginTop: SP.xs },
  tplErr: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.red, marginTop: SP.xs },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontFamily: fonts.latoBold, fontSize: 14, color: colors.cream },
  cardSummary: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, marginTop: 2 },
  subLabel: { fontFamily: fonts.latoBold, fontSize: 11, color: colors.textSecond, marginBottom: 4 },
  fieldNote: { fontFamily: fonts.latoLight, fontSize: 11, lineHeight: 16, color: colors.muted, marginBottom: SP.sm },

  toggle: { width: 44, height: 26, borderRadius: 13, backgroundColor: colors.creamDim, padding: 3, justifyContent: 'center' },
  toggleOn: { backgroundColor: colors.gold },
  toggleKnob: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.muted },
  toggleKnobOn: { backgroundColor: colors.navy, alignSelf: 'flex-end' },

  countRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SP.sm, marginBottom: SP.xs },
  countLabel: { flex: 1, fontFamily: fonts.lato, fontSize: 13, color: colors.textSecond },
  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
  stepperBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: R.md, backgroundColor: colors.panel, overflow: 'hidden' },
  stepBtn: { width: 38, height: 36, alignItems: 'center', justifyContent: 'center' },
  stepBtnText: { fontSize: 20, fontFamily: fonts.latoBold, color: colors.gold },
  stepValue: { fontFamily: fonts.latoBold, fontSize: 15, minWidth: 40, textAlign: 'center', color: colors.cream },
  stepValueWide: { minWidth: 84 },

  chipRow: { flexDirection: 'row', alignItems: 'center', gap: SP.xs },
  chip: { borderWidth: 1, borderRadius: R.full, paddingHorizontal: 12, paddingVertical: 6, marginRight: 6, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: R.md, padding: SP.sm, fontSize: 14, color: colors.cream, fontFamily: fonts.lato, backgroundColor: colors.panel },

  dayRow: { borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: SP.xs },
  dayHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  dayName: { fontFamily: fonts.lato, fontSize: 13, color: colors.cream },
  daySummary: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted },
  serveEntry: { borderWidth: 1, borderColor: colors.border, borderRadius: R.md, padding: SP.sm, marginBottom: 6 },

  customRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border },
  customText: { fontFamily: fonts.lato, fontSize: 13, color: colors.cream, flex: 1, marginRight: SP.sm },
  customBlock: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border, gap: 8 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  schedChip: { borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: colors.panel },
  dayChipSm: { borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 5, backgroundColor: colors.panel },
  schedChipOn: { borderColor: colors.gold, backgroundColor: colors.goldDim },
  schedChipTxt: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted },
  schedChipTxtOn: { fontFamily: fonts.latoBold, color: colors.gold },

  errorText: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.red, marginBottom: 8 },
  saveBtn: { backgroundColor: colors.gold, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: SP.sm },
  saveBtnText: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.navy, letterSpacing: 1 },
}));
