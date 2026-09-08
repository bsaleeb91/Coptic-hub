import React, { useState, useEffect } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { goBack } from '@/lib/nav';
import { colors, fonts , lazyThemed } from '@/lib/theme';
import { useSession } from '@/lib/auth';
import { PHASES } from '@/lib/roadmap-data';

// The list itself lives in ROADMAP.md at the repo root and is compiled into
// lib/roadmap-data.ts by scripts/gen-roadmap.mjs — edit the markdown, not this
// screen. (ROADMAP.md also carries the Coptic Hub commit plan below the
// "Next Up" block; that is a separate product's roadmap and is not shown here.)
const STORAGE_KEY = 'poimen:roadmap:checked:v2';

const ALL_ITEMS = PHASES.flatMap(p => p.items);
const TOTAL = ALL_ITEMS.length;

export default function RoadmapScreen() {
  const { profile } = useSession();
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setChecked(JSON.parse(raw));
    } catch {}
  }, []);

  function toggle(id: string) {
    const next = { ...checked, [id]: !checked[id] };
    setChecked(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
  }

  if (Platform.OS !== 'web') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.gateTitle}>Web Only</Text>
          <Text style={styles.gateSub}>The roadmap is only available at poimen-app.vercel.app.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (profile && profile.role !== 'admin') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.gateTitle}>Access Denied</Text>
          <Text style={styles.gateSub}>This page is restricted to admins.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const doneCount = ALL_ITEMS.filter(i => checked[i.id]).length;
  const pct = Math.round((doneCount / TOTAL) * 100);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        <TouchableOpacity style={styles.backBtn} onPress={() => goBack('/(tabs)')}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.eyebrow}>POST-LAUNCH</Text>
        <Text style={styles.title}>Product Roadmap</Text>

        <View style={styles.progressWrap}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${pct}%` as any }]} />
          </View>
          <Text style={styles.progressText}>{doneCount} of {TOTAL} complete · {pct}%</Text>
        </View>

        {PHASES.map(phase => {
          const phaseDone = phase.items.filter(i => checked[i.id]).length;
          const phaseComplete = phaseDone === phase.items.length;

          return (
            <View key={phase.id} style={styles.phase}>
              <View style={styles.phaseHeader}>
                <Text style={[styles.phaseTitle, phaseComplete && styles.phaseTitleDone]}>
                  {phase.title}
                </Text>
                <Text style={[styles.phasePct, phaseComplete && { color: colors.gold }]}>
                  {phaseDone}/{phase.items.length}
                </Text>
              </View>

              {phase.items.map(item => {
                const isChecked = !!checked[item.id];
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.item, isChecked && styles.itemChecked]}
                    onPress={() => toggle(item.id)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
                      {isChecked && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <View style={styles.itemBody}>
                      <Text style={[styles.itemLabel, isChecked && styles.itemLabelDone]}>
                        {item.label}
                      </Text>
                      {item.note && !isChecked ? (
                        <Text style={styles.itemNote}>{item.note}</Text>
                      ) : null}
                      {item.detail?.length && !isChecked ? (
                        <View style={styles.detailWrap}>
                          {item.detail.map((d, i) => (
                            <Text key={i} style={styles.detailText}>{'·  '}{d}</Text>
                          ))}
                        </View>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        })}

        <View style={styles.footer}>
          <Text style={styles.footerText}>Poimen · Post-Launch Roadmap</Text>
          <Text style={styles.footerSub}>Source of truth: ROADMAP.md · “Next Up”</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = lazyThemed(() => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.navy },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 60, maxWidth: 680 as any, width: '100%' as any, alignSelf: 'center' as any },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },

  backBtn: { marginBottom: 20 },
  backText: { fontFamily: fonts.lato, fontSize: 13, color: colors.gold },
  eyebrow: { fontFamily: fonts.latoBold, fontSize: 9, letterSpacing: 2.5, color: colors.gold, marginBottom: 6 },
  title: { fontFamily: fonts.cormorantMedium, fontSize: 34, color: colors.cream, marginBottom: 24 },

  gateTitle: { fontFamily: fonts.cormorantMedium, fontSize: 22, color: colors.cream, marginBottom: 8 },
  gateSub: { fontFamily: fonts.latoLight, fontSize: 13, color: colors.muted, textAlign: 'center' },

  progressWrap: { marginBottom: 32 },
  progressTrack: { height: 4, backgroundColor: 'rgba(201,168,76,0.15)', borderRadius: 2, overflow: 'hidden', marginBottom: 8 },
  progressFill: { height: '100%' as any, backgroundColor: colors.gold, borderRadius: 2 },
  progressText: { fontFamily: fonts.latoBold, fontSize: 10, letterSpacing: 1, color: colors.muted, textTransform: 'uppercase' as any },

  phase: { marginBottom: 28 },
  phaseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  phaseTitle: { fontFamily: fonts.latoBold, fontSize: 11, letterSpacing: 1.2, color: colors.cream, textTransform: 'uppercase' as any, flex: 1, flexWrap: 'wrap' as any },
  phaseTitleDone: { color: colors.gold },
  phasePct: { fontFamily: fonts.latoBold, fontSize: 10, color: colors.muted, marginLeft: 8 },

  item: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, marginBottom: 3 },
  itemChecked: { backgroundColor: 'rgba(201,168,76,0.07)' },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: 'rgba(201,168,76,0.35)', alignItems: 'center', justifyContent: 'center', marginTop: 1, flexShrink: 0 },
  checkboxChecked: { backgroundColor: colors.gold, borderColor: colors.gold },
  checkmark: { fontSize: 11, color: colors.navy, fontFamily: fonts.latoBold, lineHeight: 14 },
  itemBody: { flex: 1 },
  itemLabel: { fontFamily: fonts.lato, fontSize: 14, color: colors.cream, lineHeight: 20 },
  itemLabelDone: { color: colors.muted, textDecorationLine: 'line-through' as any },
  itemNote: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, lineHeight: 18, marginTop: 4 },
  detailWrap: { marginTop: 6, gap: 3 },
  detailText: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, lineHeight: 17 },

  footer: { marginTop: 24, paddingTop: 20, borderTopWidth: 1, borderTopColor: colors.border, alignItems: 'center' },
  footerText: { fontFamily: fonts.latoBold, fontSize: 10, letterSpacing: 1.5, color: colors.muted, textTransform: 'uppercase' as any },
  footerSub: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.faint, marginTop: 4 },
}));
