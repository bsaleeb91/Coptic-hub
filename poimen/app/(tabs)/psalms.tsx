// app/(tabs)/psalms.tsx
// Memorize the Psalms as prayed in the Coptic Agpeya. Ported from Nepsis and
// re-skinned to Poimen's navy/gold theme. The unit of memorization is an "item":
// a whole psalm, or a single section of Psalm 118. Spaced repetition with
// cloze-deletion and lead-up context. Local (AsyncStorage) is authoritative;
// state is mirrored to Supabase agent_progress when signed in.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
  NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts , lazyThemed } from '@/lib/theme';
import { useSession } from '@/lib/auth';
import { useDemoMode } from '@/lib/demo';
import {
  PartCard, Grade, Streak, loadCards, loadSelection, saveSelection, review,
  computeStats, newQueue, reviewQueue, ReviewUnit, cardId, loadStreak, recordReviewDay,
  loadNewPerDay, saveNewPerDay, learningItem,
  ReciteCard, ReciteGrade, loadRecite, reviewRecite, reciteState, portionsMature,
} from '@/lib/psalms/store';
import {
  HOUR_LAYOUTS, itemsForPsalm, itemUnits, itemUnitCount, itemLeadUp, itemLabel,
  itemReaderText, itemHours, itemMeta, hourName, prayerItemId,
} from '@/lib/psalms/psalter';
import { hydratePsalmsFromCloud, pushPsalmsToCloud } from '@/lib/psalms/sync';

const SP = { xs: 6, sm: 10, md: 14, lg: 20, xl: 28 };
const R = { md: 10, lg: 12, xl: 16, full: 999 };


// Cloze deletion: show the opening, blank the completion (keep punctuation).
function clozeText(text: string): string {
  const words = text.split(/\s+/);
  const show = Math.max(3, Math.round(words.length * 0.45));
  const head = words.slice(0, show).join(' ');
  const tail = words.slice(show).map(w => {
    const core = w.replace(/[^A-Za-z’']/g, '');
    const blank = '＿'.repeat(Math.min(Math.max(core.length, 1), 7));
    const punct = w.match(/[.,;:!?)]+$/);
    return blank + (punct ? punct[0] : '');
  }).join(' ');
  return tail ? `${head} ${tail}` : head;
}

function CategoryTag({ item }: { item: string }) {
  const meta = itemMeta(item);
  return (
    <View style={[styles.tag, { backgroundColor: meta.color + '22', borderColor: meta.color + '55' }]}>
      <Text style={[styles.tagText, { color: meta.color }]}>{meta.label}</Text>
    </View>
  );
}

const PICKER_ITEM = 56;

function NumberPicker({ value, onScrub, onCommit, min, max }: {
  value: number; onScrub: (n: number) => void; onCommit: (n: number) => void;
  min: number; max: number;
}) {
  const nums = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  const ref = useRef<ScrollView>(null);
  const [w, setW] = useState(0);
  const pad = w > 0 ? (w - PICKER_ITEM) / 2 : 0;

  useEffect(() => {
    if (w > 0) ref.current?.scrollTo({ x: (value - min) * PICKER_ITEM, animated: false });
  }, [w]); // eslint-disable-line react-hooks/exhaustive-deps

  const numberAt = (x: number) => {
    const i = Math.max(0, Math.min(nums.length - 1, Math.round(x / PICKER_ITEM)));
    return nums[i];
  };

  return (
    <View onLayout={e => setW(e.nativeEvent.layout.width)} style={styles.pickerWrap}>
      <View pointerEvents="none" style={[styles.pickerHighlight, { borderColor: colors.gold }]} />
      <ScrollView
        ref={ref}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={PICKER_ITEM}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: pad }}
        scrollEventThrottle={16}
        onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => onScrub(numberAt(e.nativeEvent.contentOffset.x))}
        onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) => onCommit(numberAt(e.nativeEvent.contentOffset.x))}
      >
        {nums.map(n => (
          <View key={n} style={styles.pickerItem}>
            <Text style={{ fontSize: n === value ? 26 : 18, fontFamily: fonts.latoBold, color: n === value ? colors.goldLight : colors.muted }}>{n}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function GradeBtn({ label, color, onPress }: { label: string; color: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.gradeBtn, { backgroundColor: color }]} onPress={onPress}>
      <Text style={styles.gradeText}>{label}</Text>
    </TouchableOpacity>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function PsalmsScreen() {
  const { user } = useSession();
  const { demoMode } = useDemoMode();
  const canSync = !!user && !demoMode;

  const [selection, setSelection] = useState<string[]>([]);
  const [cards, setCards]         = useState<Record<string, PartCard>>({});
  const [streak, setStreak]       = useState<Streak>({ current: 0, last: null });
  const [newPerDay, setNewPerDay] = useState(5);
  const [loading, setLoading]     = useState(true);

  const [recite, setRecite] = useState<Record<string, ReciteCard>>({});

  const [view, setView]     = useState<'overview' | 'manage'>('overview');
  const [reader, setReader] = useState<string | null>(null);

  const [queue, setQueue]   = useState<ReviewUnit[] | null>(null);
  const [qIndex, setQIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [busy, setBusy] = useState(false);

  const sync = useCallback(() => {
    if (canSync && user) pushPsalmsToCloud(user.id);
  }, [canSync, user]);

  useEffect(() => {
    (async () => {
      if (canSync && user) await hydratePsalmsFromCloud(user.id);
      const [sel, c, st, npd, rec] = await Promise.all([
        loadSelection(), loadCards(), loadStreak(), loadNewPerDay(), loadRecite(),
      ]);
      setSelection(sel); setCards(c); setStreak(st); setNewPerDay(npd); setRecite(rec);
      setLoading(false);
    })();
  }, [canSync, user]);

  const persistSelection = useCallback((next: string[]) => {
    setSelection(next); saveSelection(next).then(sync);
  }, [sync]);

  const toggle = useCallback((item: string) => {
    persistSelection(selection.includes(item) ? selection.filter(p => p !== item) : [...selection, item]);
  }, [selection, persistSelection]);

  const move = useCallback((i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= selection.length) return;
    const next = [...selection];
    [next[i], next[j]] = [next[j], next[i]];
    persistSelection(next);
  }, [selection, persistSelection]);

  const changeNewPerDay = useCallback((n: number) => {
    const clamped = Math.max(1, Math.min(100, n));
    setNewPerDay(clamped);
    saveNewPerDay(clamped).then(sync);
  }, [sync]);

  const stats = computeStats(selection, cards);

  const startSession = useCallback((mode: 'review' | 'new') => {
    const q: ReviewUnit[] = mode === 'review'
      ? reviewQueue(selection, cards, recite)
      : newQueue(selection, cards, newPerDay).map(u => ({ item: u.item, kind: 'portion' as const, part: u.part }));
    if (!q.length) return;
    setQueue(q); setQIndex(0); setReviewedCount(0); setRevealed(false);
  }, [selection, cards, recite, newPerDay]);

  // Advance the session, optionally re-queuing the current unit to the end
  // (used when a portion is graded "Wrong" so it comes back this same session).
  const advance = useCallback((requeue: ReviewUnit | null) => {
    if (!queue) return;
    setReviewedCount(c => c + 1);
    const next = requeue ? [...queue, requeue] : queue;
    if (qIndex + 1 < next.length) {
      setQueue(next); setQIndex(qIndex + 1); setRevealed(false);
    } else {
      setQueue(null);
    }
  }, [queue, qIndex]);

  const gradePortion = useCallback(async (g: Grade) => {
    if (!queue || busy) return;
    const unit = queue[qIndex];
    if (unit.kind !== 'portion') return;
    setBusy(true);
    try {
      const updated = await review(unit.item, unit.part, cards[cardId(unit.item, unit.part)], g);
      setCards(prev => ({ ...prev, [cardId(unit.item, unit.part)]: updated }));
      setStreak(await recordReviewDay());
    } catch (e) { /* keep the session moving */ }
    advance(g === 'again' ? unit : null);
    setBusy(false);
    sync();
  }, [queue, qIndex, cards, busy, advance, sync]);

  const gradeRecite = useCallback(async (g: ReciteGrade) => {
    if (!queue || busy) return;
    const unit = queue[qIndex];
    if (unit.kind !== 'recite') return;
    setBusy(true);
    try {
      const updated = await reviewRecite(unit.item, recite[unit.item], g);
      setRecite(prev => ({ ...prev, [unit.item]: updated }));
      setStreak(await recordReviewDay());
    } catch (e) { /* keep the session moving */ }
    // A forgotten recitation comes back later (its schedule resets), not this session.
    advance(null);
    setBusy(false);
    sync();
  }, [queue, qIndex, recite, busy, advance, sync]);

  function Header({ title, onBack, backLabel }: { title: string; onBack: () => void; backLabel: string }) {
    return (
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={8}>
          <Text style={styles.headerBack}>‹ {backLabel}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={{ width: 54 }} />
      </View>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}><ActivityIndicator color={colors.gold} /></View>
      </SafeAreaView>
    );
  }

  // ─── Reader ───────────────────────────────────────────────────────────────────
  if (reader != null) {
    const sections = itemReaderText(reader);
    const meta = itemMeta(reader);
    const selected = selection.includes(reader);
    return (
      <SafeAreaView style={styles.safe}>
        <Header title="Reading" backLabel="Back" onBack={() => setReader(null)} />
        <ScrollView contentContainerStyle={{ padding: SP.lg, paddingBottom: 40 }}>
          <View style={styles.readerHead}>
            <Text style={styles.readerTitle}>{itemLabel(reader)}</Text>
            <CategoryTag item={reader} />
          </View>
          <Text style={styles.readerHours}>{itemHours(reader).map(hourName).join(' · ')}</Text>
          <Text style={styles.readerBlurb}>{meta.blurb}</Text>
          <TouchableOpacity
            style={[styles.selBtn, { backgroundColor: selected ? colors.panel : colors.gold, borderColor: selected ? colors.border : colors.gold }]}
            onPress={() => toggle(reader)}
          >
            <Text style={[styles.selBtnText, { color: selected ? colors.textSecond : colors.navy }]}>
              {selected ? '✓ In your list — remove' : '+ Add to my list'}
            </Text>
          </TouchableOpacity>

          {sections.map((text, i) => (
            <View key={i} style={{ marginTop: SP.lg }}>
              {sections.length > 1 && <Text style={[styles.partLabel, { color: meta.color }]}>Section {i + 1} of {sections.length}</Text>}
              <Text style={styles.psalmText}>{text}</Text>
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── Session (learning portions, portion review, or whole-passage recitation) ─
  if (queue) {
    const unit = queue[qIndex];

    // Whole-passage recitation: a matured passage is reviewed in full. Nothing
    // but the passage's name is shown until the user reveals it.
    if (unit.kind === 'recite') {
      const sections = itemReaderText(unit.item);
      const meta = itemMeta(unit.item);
      return (
        <SafeAreaView style={styles.safe}>
          <View style={styles.sessionTop}>
            <Text style={styles.sessionProgress}>{qIndex + 1} / {queue.length}</Text>
            <TouchableOpacity onPress={() => setQueue(null)}><Text style={styles.linkGold}>End</Text></TouchableOpacity>
          </View>
          <View style={styles.sessionHead}>
            <Text style={styles.sessionTitle}>{itemLabel(unit.item)}</Text>
            <Text style={[styles.newTag, { color: meta.color }]}>Recite it in full from memory</Text>
          </View>

          <ScrollView contentContainerStyle={{ padding: SP.lg }}>
            {revealed ? (
              sections.map((t, i) => (
                <View key={i} style={{ marginBottom: SP.md }}>
                  {sections.length > 1 && <Text style={[styles.partLabel, { color: meta.color }]}>Section {i + 1} of {sections.length}</Text>}
                  <Text style={styles.psalmText}>{t}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.testPrompt}>
                Recite it aloud in full from memory, then reveal the text to check yourself.
              </Text>
            )}
          </ScrollView>

          <View style={styles.sessionFoot}>
            {!revealed ? (
              <TouchableOpacity style={styles.revealBtn} onPress={() => setRevealed(true)}>
                <Text style={styles.revealBtnText}>Reveal text</Text>
              </TouchableOpacity>
            ) : (
              <View style={[styles.gradeRow, busy && { opacity: 0.5 }]} pointerEvents={busy ? 'none' : 'auto'}>
                <GradeBtn label="Forgot"     color={colors.red}   onPress={() => gradeRecite('fail')} />
                <GradeBtn label="Some slips" color="#C4821A"      onPress={() => gradeRecite('partial')} />
                <GradeBtn label="✓ Recited"  color={colors.green} onPress={() => gradeRecite('pass')} />
              </View>
            )}
          </View>
        </SafeAreaView>
      );
    }

    // Portion: learn a new portion or review a due one (cloze deletion).
    const { item, part } = unit;
    const text = itemUnits(item)[part] ?? '';
    const lead = itemLeadUp(item, part);
    const multi = itemUnitCount(item) > 1;
    const isNew = !cards[cardId(item, part)];
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.sessionTop}>
          <Text style={styles.sessionProgress}>{qIndex + 1} / {queue.length}</Text>
          <TouchableOpacity onPress={() => setQueue(null)}><Text style={styles.linkGold}>End</Text></TouchableOpacity>
        </View>
        <View style={styles.sessionHead}>
          <Text style={styles.sessionTitle}>
            {itemLabel(item)}{multi ? `  ·  portion ${part + 1}/${itemUnitCount(item)}` : ''}
          </Text>
          {isNew && <Text style={[styles.newTag, { color: colors.green }]}>NEW — read & learn</Text>}
        </View>

        <ScrollView contentContainerStyle={{ padding: SP.lg }}>
          <Text style={[styles.cueLabel, { marginBottom: 12 }]}>
            {revealed ? 'How well did you recall it?' : isNew ? 'New — fill in the blanks, then learn it' : 'Continue from memory — fill in the blanks'}
          </Text>
          <Text style={styles.psalmText}>
            {lead ? <Text style={{ color: colors.muted }}>{lead} </Text> : null}
            <Text style={{ color: revealed ? colors.goldLight : colors.cream, fontFamily: fonts.cormorant }}>
              {revealed ? text : clozeText(text)}
            </Text>
          </Text>
        </ScrollView>

        <View style={styles.sessionFoot}>
          {!revealed ? (
            <TouchableOpacity style={styles.revealBtn} onPress={() => setRevealed(true)}>
              <Text style={styles.revealBtnText}>Reveal & check</Text>
            </TouchableOpacity>
          ) : (
            <View style={[styles.gradeRow, busy && { opacity: 0.5 }]} pointerEvents={busy ? 'none' : 'auto'}>
              <GradeBtn label="Wrong" color={colors.red}   onPress={() => gradePortion('again')} />
              <GradeBtn label="Hard"  color="#C4821A"      onPress={() => gradePortion('hard')} />
              <GradeBtn label="Good"  color={colors.green} onPress={() => gradePortion('good')} />
              <GradeBtn label="Easy"  color={colors.blue}  onPress={() => gradePortion('easy')} />
            </View>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // ─── Manage ───────────────────────────────────────────────────────────────────
  if (view === 'manage') {
    return (
      <SafeAreaView style={styles.safe}>
        <Header title="Choose Passages" backLabel="Done" onBack={() => setView('overview')} />
        <ScrollView contentContainerStyle={{ padding: SP.lg, paddingBottom: 40 }}>
          <Text style={styles.sectionLabel}>My passages · in order</Text>
          {selection.length === 0 && (
            <Text style={styles.muted}>None chosen yet — add from the hours below.</Text>
          )}
          {selection.map((item, i) => (
            <View key={item} style={styles.row}>
              <Text style={styles.rowNum}>{i + 1}</Text>
              <TouchableOpacity style={{ flex: 1 }} onPress={() => setReader(item)}>
                <Text style={styles.rowTitle}>{itemLabel(item)}</Text>
                <Text style={styles.rowSub}>{itemUnitCount(item)} portion{itemUnitCount(item) > 1 ? 's' : ''}</Text>
              </TouchableOpacity>
              <CategoryTag item={item} />
              <View style={styles.arrows}>
                <TouchableOpacity onPress={() => move(i, -1)} hitSlop={6}><Text style={[styles.arrow, { color: i === 0 ? colors.border : colors.gold }]}>▲</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => move(i, 1)} hitSlop={6}><Text style={[styles.arrow, { color: i === selection.length - 1 ? colors.border : colors.gold }]}>▼</Text></TouchableOpacity>
              </View>
              <TouchableOpacity onPress={() => toggle(item)} hitSlop={6}><Text style={styles.remove}>✕</Text></TouchableOpacity>
            </View>
          ))}

          {HOUR_LAYOUTS.map(hour => (
            <View key={hour.key}>
              <Text style={[styles.sectionLabel, { marginTop: SP.lg }]}>{hour.name}</Text>
              {hour.sections.map((sec, si) => {
                const items = [
                  ...(sec.psalms ?? []).flatMap(itemsForPsalm),
                  ...(sec.prayers ?? []).map(prayerItemId),
                ];
                return (
                  <View key={si}>
                    {sec.heading != null && <Text style={styles.watchLabel}>{sec.heading}</Text>}
                    {items.map(item => {
                      const on = selection.includes(item);
                      return (
                        <TouchableOpacity key={item} style={[styles.row, { borderColor: on ? colors.gold + '66' : colors.border }]} onPress={() => toggle(item)}>
                          <Text style={[styles.addPlus, { color: on ? colors.green : colors.gold }]}>{on ? '✓' : '+'}</Text>
                          <TouchableOpacity style={{ flex: 1 }} onPress={() => setReader(item)}>
                            <Text style={styles.rowTitle}>{itemLabel(item)}</Text>
                            <Text style={styles.rowSub}>{itemUnitCount(item)} portion{itemUnitCount(item) > 1 ? 's' : ''}</Text>
                          </TouchableOpacity>
                          <CategoryTag item={item} />
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                );
              })}
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── Overview ───────────────────────────────────────────────────────────────
  const masteredPct = stats.totalParts ? Math.round((stats.mastered / stats.totalParts) * 100) : 0;
  const dueCount = reviewQueue(selection, cards, recite).length;
  const newAvailable = newQueue(selection, cards, newPerDay).length;
  const lp = learningItem(selection, cards);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={{ padding: SP.lg, paddingBottom: 32 }}>
        <Text style={styles.pageTitle}>Psalms</Text>
        <Text style={styles.pageSubtitle}>Hide the Agpeya in your heart</Text>

        {reviewedCount > 0 && (
          <View style={styles.doneBanner}>
            <Text style={styles.doneBannerText}>
              ✦  Reviewed {reviewedCount} {reviewedCount === 1 ? 'passage' : 'passages'} — glory to God.
            </Text>
          </View>
        )}

        {selection.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Memorize the Agpeya</Text>
            <Text style={styles.emptyText}>
              Choose psalms and prayers from the canonical hours to hide in your heart — each hour's Gospel,
              litanies, and absolution, the fixed prayers of the First Hour, the three watches of Midnight,
              and the Prayer of the Veil. Spaced repetition brings each passage back just as you're about to
              forget it.
            </Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => setView('manage')}>
              <Text style={styles.primaryBtnText}>Choose passages</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.hero}>
              <Text style={styles.heroLabel}>MEMORIZE THE AGPEYA</Text>
              <Text style={styles.heroBig}>{stats.mastered} <Text style={styles.heroOf}>/ {stats.totalParts} portions mature</Text></Text>
              <View style={styles.heroBarTrack}><View style={[styles.heroBarFill, { width: `${masteredPct}%` }]} /></View>
              {streak.current > 0 && <Text style={styles.heroStreak}>🔥  {streak.current}-day streak</Text>}
            </View>

            <View style={styles.statRow}>
              <Stat label="New" value={stats.newCount} color={colors.textSecond} />
              <Stat label="Learning" value={stats.learning} color={colors.yellow} />
              {/* Whole psalms/passages with every portion mature — a psalm only
                  counts as memorized when ALL of it is. Portion-level progress
                  lives in the hero bar above. */}
              <Stat label="Memorized" value={stats.itemsMemorized} color={colors.green} />
            </View>

            {dueCount === 0 && newAvailable === 0 ? (
              <View style={styles.caughtUp}>
                <Text style={styles.caughtUpText}>All caught up for today ✦</Text>
              </View>
            ) : (
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: dueCount ? colors.gold : colors.panel }]}
                  onPress={() => startSession('review')}
                  disabled={dueCount === 0}
                >
                  <Text style={[styles.actionBtnText, { color: dueCount ? colors.navy : colors.muted }]}>Review {dueCount}</Text>
                  <Text style={[styles.actionBtnSub, { color: dueCount ? colors.navy : colors.muted, opacity: dueCount ? 0.75 : 1 }]}>due today</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: newAvailable ? colors.green : colors.panel }]}
                  onPress={() => startSession('new')}
                  disabled={newAvailable === 0}
                >
                  <Text style={[styles.actionBtnText, { color: newAvailable ? colors.navy : colors.muted }]}>Learn {newAvailable}</Text>
                  <Text style={[styles.actionBtnSub, { color: newAvailable ? colors.navy : colors.muted, opacity: newAvailable ? 0.75 : 1 }]}>new</Text>
                </TouchableOpacity>
              </View>
            )}

            <Text style={[styles.sectionLabel, { marginBottom: SP.xs }]}>Number of new cards per day</Text>
            <NumberPicker value={newPerDay} onScrub={setNewPerDay} onCommit={changeNewPerDay} min={1} max={100} />
            <View style={{ marginBottom: SP.lg }} />

            <View style={styles.listHead}>
              <Text style={styles.sectionLabel}>My passages</Text>
              <TouchableOpacity onPress={() => setView('manage')}><Text style={styles.linkGold}>Manage</Text></TouchableOpacity>
            </View>

            {selection.map(item => {
              const { mature, total } = portionsMature(item, cards);
              const st = reciteState(item, cards, recite);
              const hasStarted = Array.from({ length: total }).some((_, i) => cards[cardId(item, i)]);
              const sub =
                st === 'learning'
                  ? (item === lp ? `Learning now · ${mature}/${total} portions` : !hasStarted ? 'Up next — finish earlier passages first' : `${mature}/${total} portions memorized`)
                : st === 'ready'   ? 'All portions mature — recite it in Review'
                : st === 'retest'  ? 'Whole-passage recitation due in Review'
                : '✓ Memorized — recited in full';
              const subColor =
                st === 'memorized' ? colors.green
                : st === 'retest'  ? colors.yellow
                : st === 'ready'   ? colors.goldLight
                : item === lp      ? colors.goldLight
                : colors.muted;
              return (
                <View key={item} style={styles.row}>
                  <TouchableOpacity style={{ flex: 1 }} onPress={() => setReader(item)}>
                    <Text style={styles.rowTitle}>{itemLabel(item)}</Text>
                    <Text style={[styles.rowSub, { color: subColor }]}>{sub}</Text>
                  </TouchableOpacity>
                  {st === 'ready' || st === 'retest' ? (
                    <View style={styles.reciteTag}><Text style={styles.reciteTagText}>Recite</Text></View>
                  ) : st === 'memorized' ? (
                    <Text style={styles.crown}>✓</Text>
                  ) : (
                    <CategoryTag item={item} />
                  )}
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = lazyThemed(() => StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.navy },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted:  { fontFamily: fonts.latoLight, fontSize: 13, color: colors.muted, marginBottom: SP.sm },

  pageTitle: { fontFamily: fonts.cormorantMedium, fontSize: 28, color: colors.cream, marginBottom: 4 },
  pageSubtitle: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, marginBottom: 20, fontStyle: 'italic' },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SP.lg, paddingVertical: SP.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerBack: { fontFamily: fonts.lato, fontSize: 14, color: colors.gold, width: 54 },
  headerTitle: { fontFamily: fonts.cormorantMedium, fontSize: 20, color: colors.cream },

  linkGold: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.gold },

  tag:     { borderWidth: 0.5, borderRadius: R.full, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' },
  tagText: { fontFamily: fonts.latoBold, fontSize: 10 },

  hero:         { borderRadius: R.xl, padding: SP.lg, marginBottom: SP.md, backgroundColor: colors.navyMid, borderWidth: 1, borderColor: colors.border },
  heroLabel:    { fontFamily: fonts.latoBold, color: colors.gold, fontSize: 11, letterSpacing: 1, marginBottom: 8 },
  heroBig:      { fontFamily: fonts.cormorantMedium, color: colors.goldLight, fontSize: 26 },
  heroOf:       { fontSize: 13, color: colors.muted, fontFamily: fonts.latoLight },
  heroBarTrack: { height: 6, borderRadius: 3, backgroundColor: colors.creamDim, overflow: 'hidden', marginTop: 12 },
  heroBarFill:  { height: '100%', borderRadius: 3, backgroundColor: colors.gold },
  heroStreak:   { fontFamily: fonts.latoBold, color: colors.goldLight, fontSize: 13, marginTop: 10 },

  statRow:   { flexDirection: 'row', gap: SP.sm, marginBottom: SP.md },
  statCard:  { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: R.lg, paddingVertical: SP.md, alignItems: 'center', backgroundColor: colors.panel },
  statValue: { fontFamily: fonts.cormorantMedium, fontSize: 24 },
  statLabel: { fontFamily: fonts.latoLight, fontSize: 11, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.4, color: colors.muted },

  caughtUp:     { paddingVertical: 16, borderRadius: R.md, alignItems: 'center', marginBottom: SP.lg, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border },
  caughtUpText: { fontFamily: fonts.lato, fontSize: 15, color: colors.muted },
  actionRow:    { flexDirection: 'row', gap: SP.sm, marginBottom: SP.lg },
  actionBtn:    { flex: 1, paddingVertical: 14, borderRadius: R.md, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  actionBtnText:{ fontFamily: fonts.latoBold, fontSize: 16 },
  actionBtnSub: { fontFamily: fonts.latoLight, fontSize: 11, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.4 },

  pickerWrap:      { height: 56, justifyContent: 'center' },
  pickerHighlight: { position: 'absolute', left: '50%', marginLeft: -PICKER_ITEM / 2, width: PICKER_ITEM, height: 44, borderRadius: R.md, borderWidth: 1.5 },
  pickerItem:      { width: PICKER_ITEM, height: 56, alignItems: 'center', justifyContent: 'center' },

  listHead:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SP.sm },
  sectionLabel: { fontFamily: fonts.latoBold, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: colors.textSecond },
  watchLabel:   { fontFamily: fonts.latoBold, fontSize: 11, letterSpacing: 0.4, color: colors.goldLight, marginTop: SP.sm, marginBottom: 4 },

  row:      { flexDirection: 'row', alignItems: 'center', gap: SP.sm, borderWidth: 1, borderColor: colors.border, borderRadius: R.lg, padding: SP.md, marginBottom: 6, backgroundColor: colors.panel },
  rowNum:   { fontFamily: fonts.latoBold, fontSize: 12, color: colors.muted, width: 20 },
  rowTitle: { fontFamily: fonts.latoBold, fontSize: 14, color: colors.cream },
  rowSub:   { fontFamily: fonts.latoLight, fontSize: 11, marginTop: 2, color: colors.muted },
  arrows:   { alignItems: 'center', justifyContent: 'center' },
  arrow:    { fontSize: 12, paddingVertical: 1 },
  remove:   { color: colors.red, fontSize: 14, paddingHorizontal: 4 },
  addPlus:  { fontSize: 18, width: 20, textAlign: 'center' },

  empty:         { borderWidth: 1, borderColor: colors.border, borderRadius: R.lg, padding: SP.xl, alignItems: 'center', backgroundColor: colors.panel },
  emptyTitle:    { fontFamily: fonts.cormorantMedium, fontSize: 20, color: colors.cream, marginBottom: 8 },
  emptyText:     { fontFamily: fonts.latoLight, fontSize: 13, lineHeight: 20, textAlign: 'center', marginBottom: SP.lg, color: colors.textSecond },
  primaryBtn:    { backgroundColor: colors.gold, paddingVertical: 12, paddingHorizontal: 28, borderRadius: R.md },
  primaryBtnText:{ fontFamily: fonts.latoBold, color: colors.navy, fontSize: 15, letterSpacing: 0.5 },

  doneBanner:     { borderWidth: 1, borderColor: colors.green, borderRadius: R.md, padding: SP.md, marginBottom: SP.md, backgroundColor: colors.greenBg },
  doneBannerText: { fontFamily: fonts.lato, color: colors.green, fontSize: 13 },

  readerHead:  { flexDirection: 'row', alignItems: 'center', gap: SP.sm, marginBottom: 2 },
  readerTitle: { fontFamily: fonts.cormorantMedium, fontSize: 22, color: colors.cream },
  readerHours: { fontFamily: fonts.latoLight, fontSize: 12, marginBottom: 6, color: colors.muted },
  readerBlurb: { fontFamily: fonts.latoLight, fontSize: 13, lineHeight: 20, marginBottom: SP.md, color: colors.textSecond },
  selBtn:      { paddingVertical: 11, borderRadius: R.md, alignItems: 'center', borderWidth: 1 },
  selBtnText:  { fontFamily: fonts.latoBold, fontSize: 14 },
  partLabel:   { fontFamily: fonts.latoBold, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 },
  psalmText:   { fontFamily: fonts.cormorant, fontSize: 18, lineHeight: 30, color: colors.cream },

  sessionTop:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SP.lg, paddingTop: SP.md },
  sessionProgress:{ fontFamily: fonts.latoBold, fontSize: 13, color: colors.muted },
  sessionHead:    { paddingHorizontal: SP.lg, paddingTop: SP.sm },
  sessionTitle:   { fontFamily: fonts.cormorantMedium, fontSize: 18, color: colors.cream },
  newTag:         { fontFamily: fonts.latoBold, fontSize: 11, letterSpacing: 0.5, marginTop: 4 },
  testPrompt:     { fontFamily: fonts.latoLight, fontSize: 15, lineHeight: 24, textAlign: 'center', paddingVertical: 40, paddingHorizontal: SP.md, color: colors.textSecond },
  reciteTag:      { backgroundColor: colors.gold + '22', borderColor: colors.gold + '66', borderWidth: 0.5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: R.full },
  reciteTagText:  { fontFamily: fonts.latoBold, color: colors.goldLight, fontSize: 11 },
  crown:          { color: colors.green, fontSize: 18, paddingHorizontal: 6 },
  cueLabel:       { fontFamily: fonts.latoBold, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, color: colors.muted },
  sessionFoot:    { padding: SP.lg },
  revealBtn:      { backgroundColor: colors.gold, paddingVertical: 14, borderRadius: R.md, alignItems: 'center' },
  revealBtnText:  { fontFamily: fonts.latoBold, color: colors.navy, fontSize: 15, letterSpacing: 0.5 },
  gradeRow:       { flexDirection: 'row', gap: 6 },
  gradeBtn:       { flex: 1, paddingVertical: 13, borderRadius: R.md, alignItems: 'center' },
  gradeText:      { fontFamily: fonts.latoBold, color: colors.navy, fontSize: 14 },
}));
