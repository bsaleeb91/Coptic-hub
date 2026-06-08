import React, { useState, useEffect } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, fonts } from '@/lib/theme';
import { Card } from '@/components/ui/Card';
import { useSession } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { DEMO_MODE } from '@/lib/config';

type FilterType = 'all' | 'due' | 'overdue' | 'flagged';
type StatusType = 'recent' | 'due' | 'overdue';

interface FlockMember {
  id: string;
  initials: string;
  name: string;
  stage: string;
  daysSince: number | null;
  canonPct: number | null;
  flagged: boolean;
  status: StatusType;
  note: string;
}

const FLOCK_DEMO: FlockMember[] = [
  { id: 'demo-mh', initials: 'MH', name: 'Michael Hanna', stage: 'Growing', daysSince: 47, canonPct: 50, flagged: false, status: 'due', note: 'New father — pastoral visit completed May 4.' },
  { id: 'demo-sg', initials: 'SG', name: 'Sara Girgis', stage: 'Mature', daysSince: 18, canonPct: 88, flagged: false, status: 'recent', note: '' },
  { id: 'demo-pb', initials: 'PB', name: 'Peter Botros', stage: 'New', daysSince: 74, canonPct: 20, flagged: true, status: 'overdue', note: 'Flagged: missed two follow-up appointments.' },
  { id: 'demo-mm', initials: 'MM', name: 'Mary Mikhail', stage: 'Growing', daysSince: 29, canonPct: 65, flagged: false, status: 'recent', note: '' },
  { id: 'demo-ag', initials: 'AG', name: 'Andrew George', stage: 'Seeking', daysSince: 92, canonPct: 0, flagged: true, status: 'overdue', note: 'New to the church — needs initial meeting.' },
  { id: 'demo-cn', initials: 'CN', name: 'Christine Naguib', stage: 'Multiplying', daysSince: 35, canonPct: 92, flagged: false, status: 'due', note: '' },
];

const STATUS_COLOR: Record<StatusType, string> = {
  recent: colors.green,
  due: colors.yellow,
  overdue: colors.red,
};

const STATUS_LABEL: Record<StatusType, string> = {
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
  const { user, profile } = useSession();
  const [filter, setFilter] = useState<FilterType>('all');
  const [search, setSearch] = useState('');
  const [members, setMembers] = useState<FlockMember[]>([]);
  const [loading, setLoading] = useState(!DEMO_MODE);

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const greeting = profile?.full_name ? `Fr. ${profile.full_name.split(' ').slice(-1)[0]}` : 'Father';

  useEffect(() => {
    if (DEMO_MODE) {
      setMembers(FLOCK_DEMO);
    } else {
      loadFlock();
    }
  }, [user]);

  async function loadFlock() {
    if (!user) return;
    setLoading(true);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('foc_id', user.id);

    if (!profiles) { setLoading(false); return; }

    // latest confession per member
    const { data: confessions } = await supabase
      .from('pastoral_encounters')
      .select('congregant_id, encountered_at')
      .eq('priest_id', user.id)
      .eq('encounter_type', 'confession')
      .order('encountered_at', { ascending: false });

    const now = new Date();
    const latestByMember: Record<string, string> = {};
    for (const c of confessions ?? []) {
      if (!latestByMember[c.congregant_id]) latestByMember[c.congregant_id] = c.encountered_at;
    }

    const mapped: FlockMember[] = profiles.map(p => {
      const last = latestByMember[p.id];
      const daysSince = last
        ? Math.floor((now.getTime() - new Date(last).getTime()) / 86400000)
        : null;
      const status: StatusType =
        daysSince === null ? 'overdue' :
        daysSince < 30 ? 'recent' :
        daysSince < 60 ? 'due' : 'overdue';
      const parts = (p.full_name ?? '?').split(' ');
      const initials = (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '');
      return { id: p.id, initials: initials.toUpperCase(), name: p.full_name ?? 'Unknown', stage: '', daysSince, canonPct: null, flagged: false, status, note: '' };
    });

    setMembers(mapped);
    setLoading(false);
  }

  const filtered = members.filter(m => {
    const matchSearch = m.name.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' ? true : filter === 'flagged' ? m.flagged : m.status === filter;
    return matchSearch && matchFilter;
  });

  const overdue = members.filter(m => m.status === 'overdue').length;
  const due = members.filter(m => m.status === 'due').length;
  const flagged = members.filter(m => m.flagged).length;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        <View style={styles.topbar}>
          <View>
            <Text style={styles.pageTitle}>My Flock</Text>
            <Text style={styles.pageSubtitle}>{today} · {greeting}</Text>
          </View>
          <TouchableOpacity style={styles.switchBtn} onPress={() => router.push('/(tabs)')}>
            <Text style={styles.switchBtnText}>MY VIEW</Text>
          </TouchableOpacity>
        </View>

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
            <Text style={[styles.summaryVal, { color: colors.cream }]}>{members.length}</Text>
            <Text style={styles.summaryLabel}>TOTAL</Text>
          </View>
          <View style={[styles.summaryCard, { borderColor: 'rgba(201,168,76,0.4)' }]}>
            <Text style={[styles.summaryVal, { color: colors.gold }]}>{flagged}</Text>
            <Text style={styles.summaryLabel}>FLAGGED</Text>
          </View>
        </View>

        <TextInput
          style={styles.search}
          placeholder="Search members..."
          placeholderTextColor="rgba(245,240,232,0.22)"
          value={search}
          onChangeText={setSearch}
        />

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

        <Card title={`Members (${filtered.length})`} titleIcon="◉">
          {loading ? (
            <ActivityIndicator color={colors.gold} style={{ paddingVertical: 20 }} />
          ) : filtered.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>{members.length === 0 ? 'No spiritual children yet' : 'No members match this filter'}</Text>
              <Text style={styles.emptyBody}>{members.length === 0 ? 'Members who list you as their Father of Confession will appear here.' : 'Try a different filter.'}</Text>
            </View>
          ) : (
            filtered.map((member, i) => (
              <TouchableOpacity
                key={member.id}
                style={[styles.memberRow, i < filtered.length - 1 && styles.memberBorder]}
                onPress={() => router.push({ pathname: '/(priest)/member', params: { id: member.id, name: member.name } })}
                activeOpacity={0.7}
              >
                <View style={[styles.avatar, member.flagged && styles.avatarFlagged]}>
                  <Text style={styles.avatarText}>{member.initials}</Text>
                </View>
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
                    {member.daysSince !== null
                      ? <Text style={styles.metaItem}>✝ {member.daysSince}d ago</Text>
                      : <Text style={styles.metaItem}>✝ No record</Text>
                    }
                    {member.canonPct !== null && (
                      <>
                        <Text style={styles.metaDot}>·</Text>
                        <Text style={styles.metaItem}>📜 {member.canonPct}%</Text>
                      </>
                    )}
                    {member.stage ? (
                      <>
                        <Text style={styles.metaDot}>·</Text>
                        <Text style={styles.metaItem}>{member.stage}</Text>
                      </>
                    ) : null}
                  </View>
                  {member.note ? <Text style={styles.memberNote}>{member.note}</Text> : null}
                  {member.flagged && (
                    <View style={styles.flagBadge}>
                      <Text style={styles.flagBadgeText}>⚑ Flagged for follow-up</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            ))
          )}
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

  search: { backgroundColor: 'rgba(10,16,30,0.7)', borderWidth: 1, borderColor: colors.border, borderRadius: 8, color: colors.cream, fontFamily: fonts.latoLight, fontSize: 13, padding: 11, marginBottom: 12 },

  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  filterPill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: colors.border },
  filterPillActive: { backgroundColor: colors.goldDim, borderColor: colors.gold },
  filterPillText: { fontFamily: fonts.latoBold, fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.muted },
  filterPillTextActive: { color: colors.goldLight },

  emptyState: { alignItems: 'center', paddingVertical: 24, gap: 6 },
  emptyTitle: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.muted },
  emptyBody: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, textAlign: 'center', lineHeight: 17, opacity: 0.7 },

  memberRow: { paddingVertical: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  memberBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#2c4a7c', borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarFlagged: { borderColor: colors.red, backgroundColor: 'rgba(192,57,43,0.2)' },
  avatarText: { fontFamily: fonts.cormorantMedium, fontSize: 14, color: colors.cream },
  memberTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 },
  memberName: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.cream, flex: 1 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20, flexShrink: 0 },
  statusPillText: { fontFamily: fonts.latoBold, fontSize: 10 },
  memberMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' },
  metaItem: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted },
  metaDot: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted },
  memberNote: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, fontStyle: 'italic', lineHeight: 16 },
  flagBadge: { backgroundColor: 'rgba(192,57,43,0.12)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20, alignSelf: 'flex-start', marginTop: 5 },
  flagBadgeText: { fontFamily: fonts.latoBold, fontSize: 9, color: colors.red, letterSpacing: 0.5 },
  chevron: { fontFamily: fonts.lato, fontSize: 20, color: colors.muted, marginTop: 8 },
});
