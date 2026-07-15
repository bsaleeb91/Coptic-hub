// Memorize the Psalms as prayed in the Coptic Agpeya. The unit of memorization
// is an "item": a whole psalm, or a single section of Psalm 118 (its 22 Agpeya
// sections). Spaced repetition with cloze-deletion and lead-up context.
// Ported from Nepsis; restyled for Poimen.
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
  NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '@/lib/theme';
import * as H from '@/lib/haptics';
import { useSession } from '@/lib/auth';
import { useDemoMode } from '@/lib/demo';
import {
  PartCard, Grade, Streak, loadCards, loadSelection, saveSelection, review,
  computeStats, dueQueue, newQueue, cardId, loadStreak, recordReviewDay,
  loadNewPerDay, saveNewPerDay, learningItem,
  ReciteCard, ReciteGrade, loadRecite, reviewRecite, reciteState, portionsMature,
} from '@/lib/psalms/psalmStore';
import {
  HOURS, itemsForPsalm, itemUnits, itemUnitCount, itemLeadUp, itemLabel,
  itemPsalm, itemReaderText, psalmHours, hourName,
} from '@/lib/psalms/agpeyaPsalter';
import { classify, CATEGORY_META } from '@/lib/psalms/psalmMeta';
import { publishPsalmStats } from '@/lib/psalms/stats';

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
  const meta = CATEGORY_META[classify(itemPsalm(item))];
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
      <View pointerEvents="none" style={styles.pickerHighlight} />
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
            <Text style={{
              fontFamily: n === value ? fonts.latoBold : fonts.latoLight,
              fontSize: n === value ? 24 : 16,
              color: n === value ? colors.gold : colors.muted,
            }}>{n}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function GradeBtn({ label, color, bg, onPress }: { label: string; color: string; bg: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.gradeBtn, { backgroundColor: bg, borderColor: color + '55' }]}
      onPress={() => { H.done(); onPress(); }}
    >
      <Text style={[styles.gradeText, { color }]}>{label}</Text>
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

  const [selection, setSelection] = useState<string[]>([]);
  const [cards, setCards]         = useState<Record<string, PartCard>>({});
  const [streak, setStreak]       = useState<Streak>({ current: 0, last: null });
  const [newPerDay, setNewPerDay] = useState(5);
  const [loading, setLoading]     = useState(true);

  const [recite, setRecite] = useState<Record<string, ReciteCard>>({});
  const [testItem, setTestItem] = useState<string | null>(null);
  const [testRevealed, setTestRevealed] = useState(false);

  const [view, setView]     = useState<'overview' | 'manage'>('overview');
  const [reader, setReader] = useState<string | null>(null);

  const [queue, setQueue]   = useState<{ item: string; part: number }[] | null>(null);
  const [qIndex, setQIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([loadSelection(), loadCards(), loadStreak(), loadNewPerDay(), loadRecite()]).then(([sel, c, st, npd, rec]) => {
      setSelection(sel); setCards(c); setStreak(st); setNewPerDay(npd); setRecite(rec);
    }).finally(() => setLoading(false));
  }, []);

  // Share the summary (streak, counts, memorized psalms) with the FOC/servant
  // dashboards. RLS keeps it consent-gated; skipped entirely in demo mode.
  const publish = useCallback((
    sel: string[], c: Record<string, PartCard>, st: Streak, rec: Record<string, ReciteCard>,
  ) => {
    if (!user || demoMode) return;
    publishPsalmStats(user.id, sel, c, st, rec);
  }, [user, demoMode]);

  const persistSelection = useCallback((next: string[]) => {
    setSelection(next); saveSelection(next);
    publish(next, cards, streak, recite);
  }, [cards, streak, recite, publish]);

  const toggle = useCallback((item: string) => {
    H.tap();
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
    saveNewPerDay(clamped);
  }, []);

  const openTest = useCallback((item: string) => { setTestItem(item); setTestRevealed(false); }, []);

  const finishTest = useCallback(async (g: ReciteGrade) => {
    if (testItem == null) return;
    const updated = await reviewRecite(testItem, recite[testItem], g);
    const nextRecite = { ...recite, [testItem]: updated };
    setRecite(nextRecite);
    const st = await recordReviewDay();
    setStreak(st);
    setTestItem(null);
    if (g === 'pass') H.success();
    publish(selection, cards, st, nextRecite);
  }, [testItem, recite, selection, cards, publish]);

  const stats = computeStats(selection, cards);

  const startSession = useCallback((mode: 'review' | 'new') => {
    const q = mode === 'review' ? dueQueue(selection, cards) : newQueue(selection, cards, newPerDay);
    if (!q.length) return;
    H.tap();
    setQueue(q); setQIndex(0); setReviewedCount(0); setRevealed(false);
  }, [selection, cards, newPerDay]);

  const grade = useCallback(async (g: Grade) => {
    if (!queue || busy) return;
    setBusy(true);
    const { item, part } = queue[qIndex];
    let nextCards = cards;
    let nextStreak = streak;
    try {
      const updated = await review(item, part, cards[cardId(item, part)], g);
      nextCards = { ...cards, [cardId(item, part)]: updated };
      setCards(nextCards);
      nextStreak = await recordReviewDay();
      setStreak(nextStreak);
    } catch (e) { /* keep the session moving */ }
    setReviewedCount(c => c + 1);

    const nextQueue = g === 'again' ? [...queue, { item, part }] : queue;
    const nextIndex = qIndex + 1;
    if (nextIndex < nextQueue.length) {
      setQueue(nextQueue); setQIndex(nextIndex); setRevealed(false);
    } else {
      setQueue(null);
      H.success();
      publish(selection, nextCards, nextStreak, recite);
    }
    setBusy(false);
  }, [queue, qIndex, cards, busy, streak, selection, recite, publish]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}><ActivityIndicator color={colors.gold} /></View>
      </SafeAreaView>
    );
  }

  // ─── Reader ─────────────────────────────────────────────────
  if (reader != null) {
    const sections = itemReaderText(reader);
    const meta = CATEGORY_META[classify(itemPsalm(reader))];
    const selected = selection.includes(reader);
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          <TouchableOpacity onPress={() => setReader(null)} style={{ marginBottom: 14 }}>
            <Text style={styles.backLink}>‹ Back</Text>
          </TouchableOpacity>
          <View style={styles.readerHead}>
            <Text style={styles.readerTitle}>{itemLabel(reader)}</Text>
            <CategoryTag item={reader} />
          </View>
          <Text style={styles.readerHours}>{psalmHours(itemPsalm(reader)).map(hourName).join(' · ')}</Text>
          <Text style={styles.readerBlurb}>{meta.blurb}</Text>
          <TouchableOpacity
            style={[styles.selBtn, selected ? styles.selBtnOff : styles.selBtnOn]}
            onPress={() => toggle(reader)}
          >
            <Text style={[styles.selBtnText, { color: selected ? colors.muted : colors.navy }]}>
              {selected ? '✓ IN YOUR LIST — REMOVE' : '+ ADD TO MY PSALMS'}
            </Text>
          </TouchableOpacity>

          {sections.map((text, i) => (
            <View key={i} style={{ marginTop: 22 }}>
              {sections.length > 1 && <Text style={[styles.partLabel, { color: meta.color }]}>Section {i + 1} of {sections.length}</Text>}
              <Text style={styles.psalmText}>{text}</Text>
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── Recitation test ────────────────────────────────────────
  if (testItem != null) {
    const sections = itemReaderText(testItem);
    const meta = CATEGORY_META[classify(itemPsalm(testItem))];
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.sessionTop}>
          <Text style={styles.sessionProgress}>FULL RECITATION</Text>
          <TouchableOpacity onPress={() => setTestItem(null)}><Text style={styles.backLink}>End</Text></TouchableOpacity>
        </View>
        <View style={styles.sessionHead}>
          <Text style={styles.sessionTitle}>{itemLabel(testItem)}</Text>
          <Text style={[styles.newTag, { color: meta.color }]}>RECITE IT IN FULL FROM MEMORY</Text>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {testRevealed ? (
            sections.map((t, i) => (
              <View key={i} style={{ marginBottom: 16 }}>
                {sections.length > 1 && <Text style={[styles.partLabel, { color: meta.color }]}>Section {i + 1} of {sections.length}</Text>}
                <Text style={styles.psalmText}>{t}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.testPrompt}>
              Recite {itemLabel(testItem)} aloud in full, then reveal the text to check yourself.
            </Text>
          )}
        </ScrollView>

        <View style={styles.sessionFoot}>
          {!testRevealed ? (
            <TouchableOpacity style={styles.revealBtn} onPress={() => { H.tap(); setTestRevealed(true); }}>
              <Text style={styles.revealBtnText}>REVEAL TEXT</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.gradeRow}>
              <GradeBtn label="Forgot"     color={colors.red}    bg={colors.redBg}    onPress={() => finishTest('fail')} />
              <GradeBtn label="Some slips" color={colors.yellow} bg={colors.yellowBg} onPress={() => finishTest('partial')} />
              <GradeBtn label="✓ Recited"  color={colors.green}  bg={colors.greenBg}  onPress={() => finishTest('pass')} />
            </View>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // ─── Review session ─────────────────────────────────────────
  if (queue) {
    const { item, part } = queue[qIndex];
    const text = itemUnits(item)[part] ?? '';
    const lead = itemLeadUp(item, part);
    const multi = itemUnitCount(item) > 1;
    const isNew = !cards[cardId(item, part)];
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.sessionTop}>
          <Text style={styles.sessionProgress}>{qIndex + 1} / {queue.length}</Text>
          <TouchableOpacity onPress={() => setQueue(null)}><Text style={styles.backLink}>End</Text></TouchableOpacity>
        </View>
        <View style={styles.sessionHead}>
          <Text style={styles.sessionTitle}>
            {itemLabel(item)}{multi ? `  ·  portion ${part + 1}/${itemUnitCount(item)}` : ''}
          </Text>
          {isNew && <Text style={[styles.newTag, { color: colors.green }]}>NEW — READ & LEARN</Text>}
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.cueLabel}>
            {revealed ? 'HOW WELL DID YOU RECALL IT?' : isNew ? 'NEW — FILL IN THE BLANKS, THEN LEARN IT' : 'CONTINUE FROM MEMORY — FILL IN THE BLANKS'}
          </Text>
          <Text style={styles.psalmText}>
            {lead ? <Text style={{ color: colors.muted }}>{lead} </Text> : null}
            <Text style={{ color: revealed ? colors.goldLight : colors.cream }}>
              {revealed ? text : clozeText(text)}
            </Text>
          </Text>
        </ScrollView>

        <View style={styles.sessionFoot}>
          {!revealed ? (
            <TouchableOpacity style={styles.revealBtn} onPress={() => { H.tap(); setRevealed(true); }}>
              <Text style={styles.revealBtnText}>REVEAL & CHECK</Text>
            </TouchableOpacity>
          ) : (
            <View style={[styles.gradeRow, busy && { opacity: 0.5 }]} pointerEvents={busy ? 'none' : 'auto'}>
              <GradeBtn label="Wrong" color={colors.red}    bg={colors.redBg}    onPress={() => grade('again')} />
              <GradeBtn label="Hard"  color={colors.yellow} bg={colors.yellowBg} onPress={() => grade('hard')} />
              <GradeBtn label="Good"  color={colors.green}  bg={colors.greenBg}  onPress={() => grade('good')} />
              <GradeBtn label="Easy"  color={colors.blue}   bg={colors.blueBg}   onPress={() => grade('easy')} />
            </View>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // ─── Manage ─────────────────────────────────────────────────
  if (view === 'manage') {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          <TouchableOpacity onPress={() => setView('overview')} style={{ marginBottom: 14 }}>
            <Text style={styles.backLink}>‹ Done</Text>
          </TouchableOpacity>

          <Text style={styles.sectionLabel}>MY PSALMS · IN ORDER</Text>
          {selection.length === 0 && (
            <Text style={styles.mutedText}>None chosen yet — add from the hours below.</Text>
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

          {HOURS.map(hour => (
            <View key={hour.key}>
              <Text style={[styles.sectionLabel, { marginTop: 22 }]}>{hour.name.toUpperCase()}</Text>
              {hour.psalms.flatMap(itemsForPsalm).map(item => {
                const on = selection.includes(item);
                return (
                  <TouchableOpacity key={item} style={[styles.row, on && { borderColor: colors.gold + '66' }]} onPress={() => toggle(item)}>
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
          ))}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── Overview ───────────────────────────────────────────────
  const masteredPct = stats.totalParts ? Math.round((stats.mastered / stats.totalParts) * 100) : 0;
  const dueCount = dueQueue(selection, cards).length;
  const newAvailable = newQueue(selection, cards, newPerDay).length;
  const lp = learningItem(selection, cards);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.pageTitle}>Psalms</Text>
        <Text style={styles.pageSubtitle}>Hide the Psalter in your heart</Text>

        {reviewedCount > 0 && (
          <View style={styles.doneBanner}>
            <Text style={styles.doneBannerText}>
              ✦  Reviewed {reviewedCount} {reviewedCount === 1 ? 'passage' : 'passages'} — glory to God.
            </Text>
          </View>
        )}

        {selection.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Memorize the Agpeya Psalms</Text>
            <Text style={styles.emptyText}>
              Choose psalms from the canonical hours to hide in your heart. Psalm 118 is offered as its 22
              Agpeya sections. Spaced repetition brings each passage back just as you're about to forget it.
            </Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => setView('manage')}>
              <Text style={styles.primaryBtnText}>CHOOSE PSALMS</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.hero}>
              <Text style={styles.heroLabel}>MEMORIZE THE PSALTER</Text>
              <Text style={styles.heroBig}>{stats.mastered} <Text style={styles.heroOf}>/ {stats.totalParts} passages mature</Text></Text>
              <View style={styles.heroBarTrack}><View style={[styles.heroBarFill, { width: `${masteredPct}%` }]} /></View>
              {streak.current > 0 && <Text style={styles.heroStreak}>🔥  {streak.current}-day streak</Text>}
            </View>

            <View style={styles.statRow}>
              <Stat label="NEW" value={stats.newCount} color={colors.muted} />
              <Stat label="LEARNING" value={stats.learning} color={colors.yellow} />
              <Stat label="MEMORIZED" value={stats.mastered} color={colors.green} />
            </View>

            {dueCount === 0 && newAvailable === 0 ? (
              <View style={styles.caughtUp}>
                <Text style={styles.caughtUpText}>All caught up for today ✦</Text>
              </View>
            ) : (
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: dueCount ? colors.gold : colors.creamDim }]}
                  onPress={() => startSession('review')}
                  disabled={dueCount === 0}
                >
                  <Text style={[styles.actionBtnText, { color: dueCount ? colors.navy : colors.muted }]}>Review {dueCount}</Text>
                  <Text style={[styles.actionBtnSub, { color: dueCount ? colors.navy : colors.muted }]}>DUE TODAY</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: newAvailable ? colors.green : colors.creamDim }]}
                  onPress={() => startSession('new')}
                  disabled={newAvailable === 0}
                >
                  <Text style={[styles.actionBtnText, { color: newAvailable ? colors.navy : colors.muted }]}>Learn {newAvailable}</Text>
                  <Text style={[styles.actionBtnSub, { color: newAvailable ? colors.navy : colors.muted }]}>NEW</Text>
                </TouchableOpacity>
              </View>
            )}

            <Text style={[styles.sectionLabel, { marginBottom: 6 }]}>NEW CARDS PER DAY</Text>
            <NumberPicker value={newPerDay} onScrub={setNewPerDay} onCommit={changeNewPerDay} min={1} max={100} />
            <View style={{ marginBottom: 22 }} />

            <View style={styles.listHead}>
              <Text style={styles.sectionLabel}>MY PSALMS</Text>
              <TouchableOpacity onPress={() => setView('manage')}><Text style={styles.manageLink}>Manage</Text></TouchableOpacity>
            </View>

            {selection.map(item => {
              const { mature, total } = portionsMature(item, cards);
              const st = reciteState(item, cards, recite);
              const hasStarted = Array.from({ length: total }).some((_, i) => cards[cardId(item, i)]);
              const sub =
                st === 'learning'
                  ? (item === lp ? `Learning now · ${mature}/${total} portions` : !hasStarted ? 'Up next — finish earlier psalms first' : `${mature}/${total} portions memorized`)
                : st === 'ready'   ? 'All portions memorized — ready to test'
                : st === 'retest'  ? 'Whole-psalm re-test due'
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
                    <TouchableOpacity style={styles.testBtn} onPress={() => openTest(item)}>
                      <Text style={styles.testBtnText}>TEST</Text>
                    </TouchableOpacity>
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.navy },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  pageTitle: { fontFamily: fonts.cormorantMedium, fontSize: 28, color: colors.cream, marginBottom: 4 },
  pageSubtitle: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, marginBottom: 20 },

  backLink: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.gold },
  mutedText: { fontFamily: fonts.latoLight, fontSize: 13, color: colors.muted, marginBottom: 10 },

  tag: { borderWidth: 0.5, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' },
  tagText: { fontFamily: fonts.latoBold, fontSize: 9, letterSpacing: 0.4 },

  hero: { backgroundColor: colors.goldDim, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 18, marginBottom: 14 },
  heroLabel: { fontFamily: fonts.latoBold, fontSize: 10, letterSpacing: 1.5, color: colors.gold, opacity: 0.85, marginBottom: 8 },
  heroBig: { fontFamily: fonts.cormorantMedium, fontSize: 26, color: colors.goldLight },
  heroOf: { fontFamily: fonts.latoLight, fontSize: 13, color: colors.muted },
  heroBarTrack: { height: 6, borderRadius: 3, backgroundColor: 'rgba(245,240,232,0.12)', overflow: 'hidden', marginTop: 12 },
  heroBarFill: { height: '100%', borderRadius: 3, backgroundColor: colors.gold },
  heroStreak: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.goldLight, marginTop: 10 },

  statRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  statCard: { flex: 1, backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  statValue: { fontFamily: fonts.cormorantMedium, fontSize: 24 },
  statLabel: { fontFamily: fonts.latoBold, fontSize: 9, letterSpacing: 1.2, color: colors.muted, marginTop: 2 },

  caughtUp: { backgroundColor: colors.creamDim, paddingVertical: 16, borderRadius: 10, alignItems: 'center', marginBottom: 22 },
  caughtUpText: { fontFamily: fonts.latoLight, fontSize: 14, color: colors.muted },
  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 22 },
  actionBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  actionBtnText: { fontFamily: fonts.latoBold, fontSize: 15 },
  actionBtnSub: { fontFamily: fonts.latoBold, fontSize: 9, letterSpacing: 1, marginTop: 2, opacity: 0.75 },

  pickerWrap: { height: 56, justifyContent: 'center' },
  pickerHighlight: { position: 'absolute', left: '50%', marginLeft: -PICKER_ITEM / 2, width: PICKER_ITEM, height: 44, borderRadius: 10, borderWidth: 1.5, borderColor: colors.gold },
  pickerItem: { width: PICKER_ITEM, height: 56, alignItems: 'center', justifyContent: 'center' },

  listHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionLabel: { fontFamily: fonts.latoBold, fontSize: 10, letterSpacing: 1.5, color: colors.gold, opacity: 0.8 },
  manageLink: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.gold },

  row: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, marginBottom: 6 },
  rowNum: { fontFamily: fonts.latoBold, fontSize: 12, color: colors.muted, width: 20 },
  rowTitle: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.cream },
  rowSub: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, marginTop: 2 },
  arrows: { alignItems: 'center', justifyContent: 'center' },
  arrow: { fontSize: 12, paddingVertical: 1 },
  remove: { color: colors.red, fontSize: 14, paddingHorizontal: 4 },
  addPlus: { fontSize: 18, width: 20, textAlign: 'center' },

  empty: { backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 26, alignItems: 'center' },
  emptyTitle: { fontFamily: fonts.cormorantMedium, fontSize: 19, color: colors.cream, marginBottom: 8 },
  emptyText: { fontFamily: fonts.latoLight, fontSize: 13, lineHeight: 20, color: colors.muted, textAlign: 'center', marginBottom: 18 },
  primaryBtn: { backgroundColor: colors.gold, paddingVertical: 12, paddingHorizontal: 28, borderRadius: 8 },
  primaryBtnText: { fontFamily: fonts.latoBold, fontSize: 11, color: colors.navy, letterSpacing: 0.8 },

  doneBanner: { backgroundColor: colors.greenBg, borderWidth: 1, borderColor: colors.green + '55', borderRadius: 10, padding: 14, marginBottom: 14 },
  doneBannerText: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.green },

  readerHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 2 },
  readerTitle: { fontFamily: fonts.cormorantMedium, fontSize: 24, color: colors.cream },
  readerHours: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, marginBottom: 6 },
  readerBlurb: { fontFamily: fonts.latoLight, fontSize: 13, lineHeight: 20, color: colors.muted, marginBottom: 14 },
  selBtn: { paddingVertical: 11, borderRadius: 8, alignItems: 'center' },
  selBtnOn: { backgroundColor: colors.gold },
  selBtnOff: { backgroundColor: colors.creamDim },
  selBtnText: { fontFamily: fonts.latoBold, fontSize: 11, letterSpacing: 0.8 },
  partLabel: { fontFamily: fonts.latoBold, fontSize: 10, letterSpacing: 1.2, marginBottom: 8 },
  psalmText: { fontFamily: fonts.cormorant, fontSize: 17, lineHeight: 28, color: colors.cream },

  sessionTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 14 },
  sessionProgress: { fontFamily: fonts.latoBold, fontSize: 11, letterSpacing: 1.2, color: colors.muted },
  sessionHead: { paddingHorizontal: 20, paddingTop: 10 },
  sessionTitle: { fontFamily: fonts.cormorantMedium, fontSize: 19, color: colors.cream },
  newTag: { fontFamily: fonts.latoBold, fontSize: 10, letterSpacing: 1, marginTop: 4 },
  testPrompt: { fontFamily: fonts.latoLight, fontSize: 15, lineHeight: 24, color: colors.muted, textAlign: 'center', paddingVertical: 40, paddingHorizontal: 14 },
  testBtn: { backgroundColor: colors.gold, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  testBtnText: { fontFamily: fonts.latoBold, fontSize: 11, color: colors.navy, letterSpacing: 0.8 },
  crown: { color: colors.green, fontSize: 18, paddingHorizontal: 6 },
  cueLabel: { fontFamily: fonts.latoBold, fontSize: 10, letterSpacing: 1.2, color: colors.gold, opacity: 0.8, marginBottom: 12 },
  sessionFoot: { padding: 20 },
  revealBtn: { backgroundColor: colors.gold, paddingVertical: 14, borderRadius: 8, alignItems: 'center' },
  revealBtnText: { fontFamily: fonts.latoBold, fontSize: 12, color: colors.navy, letterSpacing: 0.8 },
  gradeRow: { flexDirection: 'row', gap: 6 },
  gradeBtn: { flex: 1, paddingVertical: 13, borderRadius: 8, alignItems: 'center', borderWidth: 1 },
  gradeText: { fontFamily: fonts.latoBold, fontSize: 13 },
});
