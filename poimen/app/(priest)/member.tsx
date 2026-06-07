import React, { useState } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, fonts } from '@/lib/theme';
import { Card } from '@/components/ui/Card';

const MEMBER = {
  initials: 'PB',
  name: 'Peter Botros',
  stage: 'New',
  phone: '(614) 555-0182',
  joined: 'February 2026',
  daysSince: 74,
  attendancePct: 45,
  canonPct: 20,
  flagged: true,
  flagNote: 'Missed two follow-up appointments.',
};

const VITALS = [
  { label: 'Daily Prayer', pct: 20, shared: true },
  { label: 'Scripture Reading', pct: 30, shared: true },
  { label: 'Divine Liturgy', pct: 45, shared: true },
  { label: 'Small Group', pct: 0, shared: false },
  { label: 'Service', pct: 0, shared: false },
];

const CONFESSION_HISTORY = [
  { date: 'FEB 25, 2026', type: 'First Confession', note: 'Initial meeting. Set spiritual goals.' },
  { date: 'FEB 11, 2026', type: 'Introductory Meeting', note: 'Getting to know one another. Background shared.' },
];

const PRAYER_REQUESTS = [
  { date: 'MAY 28, 2026', topic: 'Job transition — feeling lost', visibility: 'foc_only' },
  { date: 'MAY 5, 2026', topic: 'Family reconciliation with brother', visibility: 'foc_only' },
];

const CANON_ASSIGNED = [
  { component: 'Morning Agpeya', frequency: 'Daily', startDate: 'Mar 1, 2026', status: 20 },
  { component: 'Gospel Reading (1 chapter)', frequency: 'Daily', startDate: 'Mar 1, 2026', status: 30 },
];

type TabType = 'overview' | 'canon' | 'prayer' | 'notes';

const TABS: { value: TabType; label: string }[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'canon', label: 'Canon' },
  { value: 'prayer', label: 'Prayer' },
  { value: 'notes', label: 'Notes' },
];

export default function MemberScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<TabType>('overview');
  const [note, setNote] = useState('');
  const [savedNote, setSavedNote] = useState(
    'Needs consistent follow-up. Has expressed interest in deepening faith but struggles with consistency. Suggested accountability partner from the young adult group.'
  );

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        {/* Back + header */}
        <TouchableOpacity style={styles.backRow} onPress={() => router.push('/(priest)')}>
          <Text style={styles.backArrow}>‹</Text>
          <Text style={styles.backText}>My Flock</Text>
        </TouchableOpacity>

        <View style={styles.heroCard}>
          <View style={[styles.heroAvatar, MEMBER.flagged && styles.heroAvatarFlagged]}>
            <Text style={styles.heroAvatarText}>{MEMBER.initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroName}>{MEMBER.name}</Text>
            <Text style={styles.heroMeta}>Stage: {MEMBER.stage} · Joined {MEMBER.joined}</Text>
            {MEMBER.flagged && (
              <View style={styles.flagBadge}>
                <Text style={styles.flagBadgeText}>⚑ {MEMBER.flagNote}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Quick stat strip */}
        <View style={styles.statStrip}>
          <View style={styles.statItem}>
            <Text style={[styles.statVal, { color: colors.red }]}>{MEMBER.daysSince}d</Text>
            <Text style={styles.statLabel}>SINCE CONF.</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statVal, { color: colors.yellow }]}>{MEMBER.attendancePct}%</Text>
            <Text style={styles.statLabel}>ATTENDANCE</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statVal, { color: colors.yellow }]}>{MEMBER.canonPct}%</Text>
            <Text style={styles.statLabel}>CANON</Text>
          </View>
        </View>

        {/* Action buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.btnGold} onPress={() => router.push('/(priest)/log-encounter')}>
            <Text style={styles.btnGoldText}>LOG ENCOUNTER</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnGhost} onPress={() => router.push('/(priest)/assign-canon')}>
            <Text style={styles.btnGhostText}>ASSIGN CANON</Text>
          </TouchableOpacity>
        </View>

        {/* Tab bar */}
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

        {/* Overview tab */}
        {tab === 'overview' && (
          <>
            <Card title="Spiritual Vitals (Shared)" titleIcon="✦">
              {VITALS.map((v, i) => (
                <View key={i} style={[styles.vitalRow, i < VITALS.length - 1 && { marginBottom: 10 }]}>
                  <Text style={[styles.vitalLabel, !v.shared && styles.vitalLabelDim]}>
                    {v.label} {!v.shared && '(not shared)'}
                  </Text>
                  <View style={styles.vitalTrack}>
                    {v.shared
                      ? <View style={[styles.vitalFill, { width: `${v.pct}%` as any }]} />
                      : null}
                  </View>
                  <Text style={[styles.vitalVal, !v.shared && { color: colors.muted, opacity: 0.4 }]}>
                    {v.shared ? `${v.pct}%` : '—'}
                  </Text>
                </View>
              ))}
            </Card>

            <Card title="Confession History" titleIcon="✝">
              <View style={styles.privacyNote}>
                <Text style={styles.privacyNoteText}>✦ Dates and type only. Content is never stored.</Text>
              </View>
              {CONFESSION_HISTORY.map((c, i) => (
                <View key={i} style={[styles.histRow, i < CONFESSION_HISTORY.length - 1 && styles.histBorder]}>
                  <Text style={styles.histDate}>{c.date}</Text>
                  <Text style={styles.histType}>{c.type}</Text>
                  <Text style={styles.histNote}>{c.note}</Text>
                </View>
              ))}
            </Card>
          </>
        )}

        {/* Canon tab */}
        {tab === 'canon' && (
          <Card title="Assigned Canon" titleIcon="📜">
            {CANON_ASSIGNED.length === 0 && (
              <Text style={styles.emptyText}>No canon assigned yet.</Text>
            )}
            {CANON_ASSIGNED.map((c, i) => (
              <View key={i} style={[styles.canonRow, i < CANON_ASSIGNED.length - 1 && styles.histBorder]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.canonComponent}>{c.component}</Text>
                  <Text style={styles.canonMeta}>{c.frequency} · since {c.startDate}</Text>
                </View>
                <View style={styles.canonPill}>
                  <Text style={[styles.canonPillText, { color: c.status < 40 ? colors.red : colors.yellow }]}>
                    {c.status}%
                  </Text>
                </View>
              </View>
            ))}
            <TouchableOpacity style={[styles.btnGold, { alignSelf: 'flex-start', marginTop: 12 }]} onPress={() => router.push('/(priest)/assign-canon')}>
              <Text style={styles.btnGoldText}>+ ASSIGN COMPONENT</Text>
            </TouchableOpacity>
          </Card>
        )}

        {/* Prayer tab */}
        {tab === 'prayer' && (
          <Card title="Prayer Requests (FOC Only)" titleIcon="◇">
            <View style={styles.privacyNote}>
              <Text style={styles.privacyNoteText}>✦ Requests shared with Father of Confession only.</Text>
            </View>
            {PRAYER_REQUESTS.map((p, i) => (
              <View key={i} style={[styles.histRow, i < PRAYER_REQUESTS.length - 1 && styles.histBorder]}>
                <Text style={styles.histDate}>{p.date}</Text>
                <Text style={styles.histType}>{p.topic}</Text>
              </View>
            ))}
          </Card>
        )}

        {/* Notes tab */}
        {tab === 'notes' && (
          <Card title="Pastoral Notes (Private)" titleIcon="✎">
            <View style={styles.privacyNote}>
              <Text style={styles.privacyNoteText}>✦ Your private FOC notes. Never visible to the member.</Text>
            </View>
            {savedNote ? (
              <Text style={styles.savedNoteText}>{savedNote}</Text>
            ) : null}
            <TextInput
              style={styles.noteInput}
              placeholder="Add a new note..."
              placeholderTextColor="rgba(245,240,232,0.22)"
              multiline
              numberOfLines={4}
              value={note}
              onChangeText={setNote}
            />
            <TouchableOpacity
              style={[styles.btnGold, { alignSelf: 'flex-start', marginTop: 12 }]}
              onPress={() => { setSavedNote(note ? savedNote + '\n\n' + note : savedNote); setNote(''); }}
            >
              <Text style={styles.btnGoldText}>SAVE NOTE</Text>
            </TouchableOpacity>
          </Card>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.navy },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },

  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  backArrow: { fontFamily: fonts.cormorant, fontSize: 22, color: colors.gold },
  backText: { fontFamily: fonts.latoLight, fontSize: 13, color: colors.muted },

  heroCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 16, marginBottom: 12 },
  heroAvatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#2c4a7c', borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  heroAvatarFlagged: { borderColor: colors.red, backgroundColor: 'rgba(192,57,43,0.2)' },
  heroAvatarText: { fontFamily: fonts.cormorantMedium, fontSize: 20, color: colors.cream },
  heroName: { fontFamily: fonts.cormorantMedium, fontSize: 22, color: colors.cream, marginBottom: 2 },
  heroMeta: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted },
  flagBadge: { backgroundColor: 'rgba(192,57,43,0.12)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, alignSelf: 'flex-start', marginTop: 6 },
  flagBadgeText: { fontFamily: fonts.latoBold, fontSize: 9, color: colors.red, letterSpacing: 0.5 },

  statStrip: { flexDirection: 'row', backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.border, borderRadius: 12, marginBottom: 16, overflow: 'hidden' },
  statItem: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  statVal: { fontFamily: fonts.cormorantMedium, fontSize: 22 },
  statLabel: { fontFamily: fonts.latoBold, fontSize: 8, letterSpacing: 1.5, color: colors.muted, textTransform: 'uppercase', marginTop: 2 },
  statDivider: { width: 1, backgroundColor: colors.border },

  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  btnGold: { backgroundColor: colors.gold, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9, alignSelf: 'flex-start' },
  btnGoldText: { fontFamily: fonts.latoBold, fontSize: 10, color: colors.navy, letterSpacing: 0.8 },
  btnGhost: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9 },
  btnGhostText: { fontFamily: fonts.latoBold, fontSize: 10, color: colors.muted, letterSpacing: 0.8 },

  tabBar: { flexDirection: 'row', backgroundColor: 'rgba(10,16,30,0.6)', borderRadius: 10, padding: 4, marginBottom: 16, gap: 2 },
  tabItem: { flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: 'center' },
  tabItemActive: { backgroundColor: colors.navyMid, borderWidth: 1, borderColor: colors.border },
  tabText: { fontFamily: fonts.latoBold, fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: colors.muted },
  tabTextActive: { color: colors.goldLight },

  vitalRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  vitalLabel: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, flex: 1 },
  vitalLabelDim: { opacity: 0.4 },
  vitalTrack: { width: 80, height: 4, backgroundColor: 'rgba(245,240,232,0.08)', borderRadius: 4, overflow: 'hidden' },
  vitalFill: { height: '100%', backgroundColor: colors.gold, borderRadius: 4 },
  vitalVal: { fontFamily: fonts.latoBold, fontSize: 12, color: colors.cream, width: 30, textAlign: 'right' },

  privacyNote: { backgroundColor: 'rgba(201,168,76,0.07)', borderWidth: 1, borderColor: 'rgba(201,168,76,0.15)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 12 },
  privacyNoteText: { fontFamily: fonts.latoLight, fontSize: 10, color: colors.muted, letterSpacing: 0.3 },

  histRow: { paddingVertical: 12 },
  histBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  histDate: { fontFamily: fonts.latoBold, fontSize: 9, letterSpacing: 1.5, color: colors.gold, opacity: 0.7, marginBottom: 2, textTransform: 'uppercase' },
  histType: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.cream, marginBottom: 2 },
  histNote: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, lineHeight: 16 },

  canonRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  canonComponent: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.cream, marginBottom: 2 },
  canonMeta: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted },
  canonPill: { backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  canonPillText: { fontFamily: fonts.latoBold, fontSize: 12 },

  emptyText: { fontFamily: fonts.latoLight, fontSize: 13, color: colors.muted, textAlign: 'center', paddingVertical: 16 },

  savedNoteText: { fontFamily: fonts.latoLight, fontSize: 13, color: colors.muted, lineHeight: 20, marginBottom: 12, padding: 12, backgroundColor: 'rgba(10,16,30,0.4)', borderRadius: 8 },
  noteInput: {
    backgroundColor: 'rgba(10,16,30,0.7)', borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, color: colors.cream, fontFamily: fonts.latoLight,
    fontSize: 13, padding: 12, textAlignVertical: 'top', minHeight: 100,
  },
});
