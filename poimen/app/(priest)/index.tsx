import React, { useState } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, fonts } from '@/lib/theme';
import { Card } from '@/components/ui/Card';

type FilterType = 'all' | 'due' | 'overdue' | 'flagged';

const FLOCK = [
  {
    initials: 'MH', name: 'Michael Hanna', stage: 'Growing',
    daysSince: 47, attendancePct: 80, canonPct: 50,
    flagged: false, status: 'due' as const,
    note: 'New father — pastoral visit completed May 4.',
  },
  {
    initials: 'SG', name: 'Sara Girgis', stage: 'Mature',
    daysSince: 18, attendancePct: 95, canonPct: 88,
    flagged: false, status: 'recent' as const,
    note: '',
  },
  {
    initials: 'PB', name: 'Peter Botros', stage: 'New',
    daysSince: 74, attendancePct: 45, canonPct: 20,
    flagged: true, status: 'overdue' as const,
    note: 'Flagged: missed two follow-up appointments.',
  },
  {
    initials: 'MM', name: 'Mary Mikhail', stage: 'Growing',
    daysSince: 29, attendancePct: 70, canonPct: 65,
    flagged: false, status: 'recent' as const,
    note: '',
  },
  {
    initials: 'AG', name: 'Andrew George', stage: 'Seeking',
    daysSince: 92, attendancePct: 30, canonPct: 0,
    flagged: true, status: 'overdue' as const,
    note: 'New to the church — needs initial meeting.',
  },
  {
    initials: 'CN', name: 'Christine Naguib', stage: 'Multiplying',
    daysSince: 35, attendancePct: 100, canonPct: 92,
    flagged: false, status: 'due' as const,
    note: '',
  },
];

const STATUS_COLOR = {
  recent: colors.green,
  due: colors.yellow,
  overdue: colors.red,
};

const STATUS_LABEL = {
  recent: '✓ Recent',
  due: '⚠ Due',
  overdue: '⚠ Overdue',
};

const FILTER_OPTS: { value: FilterType; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'due', label: 'Due' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'flagged', label: 'Flagged' },
];

export default function FlockScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterType>('all');
  const [search, setSearch] = useState('');

  const filtered = FLOCK.filter(m => {
    const matchSearch = m.name.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === 'all' ? true :
      filter === 'flagged' ? m.flagged :
      m.status === filter;
    return matchSearch && matchFilter;
  });

  const overdue = FLOCK.filter(m => m.status === 'overdue').length;
  const due = FLOCK.filter(m => m.status === 'due').length;
  const flagged = FLOCK.filter(m => m.flagged).length;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        {/* Header */}
        <View style={styles.topbar}>
          <View>
            <Text style={styles.pageTitle}>My Flock</Text>
            <Text style={styles.pageSubtitle}>Sunday, June 7 · Apostles' Fast · Day 12</Text>
          </View>
          <TouchableOpacity style={styles.switchBtn} onPress={() => router.push('/(tabs)')}>
            <Text style={styles.switchBtnText}>MY VIEW</Text>
          </TouchableOpacity>
        </View>

        {/* Summary vitals */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { borderColor: 'rgba(192,57,43,0.4)' }]}>
            <Text style={[styles.summaryVal, { color: colors.red }]}>{overdue}</Text>
            <Text style={styles.summaryLabel}>OVERDUE</Text>
          </View>
          <View style={[styles.summaryCard, { borderColor: 'rgba(243,156,18,0.4)' }]}>
            <Text style={[styles.summaryVal, { color: colors.yellow }]}>{due}</Text>
            <Text style={styles.summaryLabel}>DUE</Text>
          </View>
          <View style={[styles.summaryCard, { borderColor: colors.border }]}>
            <Text style={[styles.summaryVal, { color: colors.cream }]}>{FLOCK.length}</Text>
            <Text style={styles.summaryLabel}>TOTAL</Text>
          </View>
          <View style={[styles.summaryCard, { borderColor: 'rgba(201,168,76,0.4)' }]}>
            <Text style={[styles.summaryVal, { color: colors.gold }]}>{flagged}</Text>
            <Text style={styles.summaryLabel}>FLAGGED</Text>
          </View>
        </View>

        {/* Search */}
        <TextInput
          style={styles.search}
          placeholder="Search members..."
          placeholderTextColor="rgba(245,240,232,0.22)"
          value={search}
          onChangeText={setSearch}
        />

        {/* Filter pills */}
        <View style={styles.filterRow}>
          {FILTER_OPTS.map(opt => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.filterPill, filter === opt.value && styles.filterPillActive]}
              onPress={() => setFilter(opt.value)}
            >
              <Text style={[styles.filterPillText, filter === opt.value && styles.filterPillTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Member list */}
        <Card title={`Members (${filtered.length})`} titleIcon="◉">
          {filtered.map((member, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.memberRow, i < filtered.length - 1 && styles.memberBorder]}
              onPress={() => router.push('/(priest)/member')}
              activeOpacity={0.7}
            >
              {/* Avatar */}
              <View style={[styles.avatar, member.flagged && styles.avatarFlagged]}>
                <Text style={styles.avatarText}>{member.initials}</Text>
              </View>

              {/* Body */}
              <View style={{ flex: 1 }}>
                <View style={styles.memberTop}>
                  <Text style={styles.memberName}>{member.name}</Text>
                  <View style={[styles.statusPill, { backgroundColor: `${STATUS_COLOR[member.status]}22` }]}>
                    <Text style={[styles.statusPillText, { color: STATUS_COLOR[member.status] }]}>
                      {STATUS_LABEL[member.status]}
                    </Text>
                  </View>
                </View>

                <View style={styles.memberMeta}>
                  <Text style={styles.metaItem}>✝ {member.daysSince}d ago</Text>
                  <Text style={styles.metaDot}>·</Text>
                  <Text style={styles.metaItem}>📖 {member.attendancePct}%</Text>
                  <Text style={styles.metaDot}>·</Text>
                  <Text style={styles.metaItem}>📜 {member.canonPct}%</Text>
                </View>

                {member.note ? (
                  <Text style={styles.memberNote}>{member.note}</Text>
                ) : null}

                {member.flagged && (
                  <View style={styles.flagBadge}>
                    <Text style={styles.flagBadgeText}>⚑ Flagged for follow-up</Text>
                  </View>
                )}
              </View>

              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          ))}
        </Card>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.navy },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },

  topbar: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 },
  pageTitle: { fontFamily: fonts.cormorantMedium, fontSize: 28, color: colors.cream },
  pageSubtitle: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, marginTop: 4 },
  switchBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  switchBtnText: { fontFamily: fonts.latoBold, fontSize: 9, color: colors.muted, letterSpacing: 1.5 },

  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  summaryCard: { flex: 1, backgroundColor: colors.cardBg, borderWidth: 1, borderRadius: 10, padding: 12, alignItems: 'center' },
  summaryVal: { fontFamily: fonts.cormorantMedium, fontSize: 26, lineHeight: 30 },
  summaryLabel: { fontFamily: fonts.latoBold, fontSize: 8, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.muted, marginTop: 2 },

  search: {
    backgroundColor: 'rgba(10,16,30,0.7)', borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, color: colors.cream, fontFamily: fonts.latoLight,
    fontSize: 13, padding: 11, marginBottom: 12,
  },

  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  filterPill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: colors.border },
  filterPillActive: { backgroundColor: colors.goldDim, borderColor: colors.gold },
  filterPillText: { fontFamily: fonts.latoBold, fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.muted },
  filterPillTextActive: { color: colors.goldLight },

  memberRow: { paddingVertical: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  memberBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#2c4a7c', borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarFlagged: { borderColor: colors.red, backgroundColor: 'rgba(192,57,43,0.2)' },
  avatarText: { fontFamily: fonts.cormorantMedium, fontSize: 14, color: colors.cream },
  memberTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 },
  memberName: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.cream, flex: 1 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20, flexShrink: 0 },
  statusPillText: { fontFamily: fonts.latoBold, fontSize: 10 },
  memberMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  metaItem: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted },
  metaDot: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted },
  memberNote: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, fontStyle: 'italic', lineHeight: 16 },
  flagBadge: { backgroundColor: 'rgba(192,57,43,0.12)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20, alignSelf: 'flex-start', marginTop: 5 },
  flagBadgeText: { fontFamily: fonts.latoBold, fontSize: 9, color: colors.red, letterSpacing: 0.5 },
  chevron: { fontFamily: fonts.lato, fontSize: 20, color: colors.muted, marginTop: 8 },
});
