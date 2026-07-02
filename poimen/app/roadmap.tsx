import React, { useState, useEffect } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, fonts } from '@/lib/theme';
import { useSession } from '@/lib/auth';

const STORAGE_KEY = 'poimen:roadmap:checked';

type Item = { id: string; label: string; note?: string };
type Phase = { id: string; title: string; items: Item[] };

const PHASES: Phase[] = [
  {
    id: 'p0',
    title: 'Phase 0 — Accounts & Prerequisites',
    items: [
      { id: 'p0-1', label: 'Apple Developer account enrolled ($99/yr)' },
      { id: 'p0-2', label: 'App Store Connect — create app record (com.coptic.poimen)' },
      { id: 'p0-3', label: 'Expo account — expo login' },
      { id: 'p0-4', label: 'Privacy Policy hosted at a real URL', note: '✓ poimen-app.vercel.app/privacy' },
    ],
  },
  {
    id: 'p1',
    title: 'Phase 1 — Assets',
    items: [
      { id: 'p1-1', label: 'App icon — 1024×1024 PNG, no transparency', note: '✓ Sacred Medallion' },
      { id: 'p1-2', label: 'App icon wired into app.json', note: '✓ Done' },
      { id: 'p1-3', label: 'Android adaptive icon configured', note: '✓ Done' },
      { id: 'p1-4', label: 'Splash screen designed (1284×2778 px safe zone)', note: '✓ Done' },
      { id: 'p1-5', label: 'Splash screen wired into app.json', note: '✓ Done' },
      { id: 'p1-6', label: 'Screenshots — iPhone 6.7" (1290×2796 px, min 3)' },
      { id: 'p1-7', label: 'Screenshots — iPhone 5.5" (1242×2208 px)' },
      { id: 'p1-8', label: 'Screenshots — iPad Pro 12.9" (2048×2732 px)' },
    ],
  },
  {
    id: 'p2',
    title: 'Phase 2 — EAS Build Setup',
    items: [
      { id: 'p2-1', label: 'npm install -g eas-cli' },
      { id: 'p2-2', label: 'eas login' },
      { id: 'p2-3', label: 'eas build:configure — generates eas.json' },
      { id: 'p2-4', label: 'Audit infoPlist privacy strings in app.json' },
      { id: 'p2-5', label: 'Confirm version 1.0.0 and buildNumber 1 in app.json', note: '✓ Done' },
    ],
  },
  {
    id: 'p3',
    title: 'Phase 3 — QC Pass',
    items: [
      { id: 'p3-1', label: 'Congregant — onboarding, dashboard, prayer, confession, canon' },
      { id: 'p3-2', label: 'Priest — flock roster, member detail, log encounter, assign canon' },
      { id: 'p3-3', label: 'Servant — student roster, assign canon, prayer tab' },
    ],
  },
  {
    id: 'p4',
    title: 'Phase 4 — Build',
    items: [
      { id: 'p4-1', label: 'eas build --platform ios --profile production' },
      { id: 'p4-2', label: 'Fix any build errors' },
      { id: 'p4-3', label: 'Upload to TestFlight (eas submit or auto-submit flag)' },
    ],
  },
  {
    id: 'p5',
    title: 'Phase 5 — App Store Metadata',
    items: [
      { id: 'p5-1', label: 'App name + subtitle (30 char max)' },
      { id: 'p5-2', label: 'Description (4000 char max)' },
      { id: 'p5-3', label: 'Keywords (100 char max, comma-separated)' },
      { id: 'p5-4', label: 'Support URL + Marketing URL' },
      { id: 'p5-5', label: 'Privacy Policy URL' },
      { id: 'p5-6', label: 'Age rating questionnaire' },
      { id: 'p5-7', label: 'Privacy nutrition labels — declare all data collected' },
      { id: 'p5-8', label: 'Demo account credentials for App Review' },
      { id: 'p5-9', label: 'Upload screenshots in App Store Connect' },
    ],
  },
  {
    id: 'p6',
    title: 'Phase 6 — Submit for Review',
    items: [
      { id: 'p6-1', label: 'eas submit --platform ios' },
      { id: 'p6-2', label: 'Apple review — allow 24–48 hours' },
      { id: 'p6-3', label: 'Respond to any rejection feedback' },
    ],
  },
];

const ALL_ITEMS = PHASES.flatMap(p => p.items);
const TOTAL = ALL_ITEMS.length;

export default function RoadmapScreen() {
  const router = useRouter();
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

        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.eyebrow}>APP STORE</Text>
        <Text style={styles.title}>Launch Roadmap</Text>

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
                      {item.note ? (
                        <Text style={styles.itemNote}>{item.note}</Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        })}

        <View style={styles.footer}>
          <Text style={styles.footerText}>Poimen · App Store Launch Checklist</Text>
          <Text style={styles.footerSub}>com.coptic.poimen · iOS 1.0</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  itemNote: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.gold, marginTop: 2 },

  footer: { marginTop: 24, paddingTop: 20, borderTopWidth: 1, borderTopColor: colors.border, alignItems: 'center' },
  footerText: { fontFamily: fonts.latoBold, fontSize: 10, letterSpacing: 1.5, color: colors.muted, textTransform: 'uppercase' as any },
  footerSub: { fontFamily: fonts.latoLight, fontSize: 11, color: 'rgba(245,240,232,0.2)', marginTop: 4 },
});
