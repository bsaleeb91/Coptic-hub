import React, { useState, useCallback } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Modal } from 'react-native';
import * as H from '@/lib/haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useNavigation, useFocusEffect } from 'expo-router';
import { DrawerActions } from '@react-navigation/native';
import { colors, fonts , lazyThemed } from '@/lib/theme';
import { latestConfessionMs, daysSinceMs } from '@/lib/confession/dates';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { CrossIcon, CandleIcon, PersonIcon } from '@/components/ui/TabIcons';
import { useSession } from '@/lib/auth';
import * as db from '@/lib/db';
import { useDemoMode } from '@/lib/demo';

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
  visitRequested: boolean;
  status: StatusType;
  note: string;
  // Member's own picture, else this priest's roster photo (member_photos).
  avatarUrl?: string | null;
}

const FLOCK_DEMO: FlockMember[] = [
  { id: 'demo-mh', initials: 'MH', name: 'Michael Hanna', stage: 'Growing', daysSince: 47, canonPct: 50, flagged: false, visitRequested: false, status: 'due', note: 'New father — pastoral visit completed May 4.' },
  { id: 'demo-sg', initials: 'SG', name: 'Sara Girgis', stage: 'Mature', daysSince: 18, canonPct: 88, flagged: false, visitRequested: false, status: 'recent', note: '' },
  { id: 'demo-pb', initials: 'PB', name: 'Peter Botros', stage: 'New', daysSince: 74, canonPct: 20, flagged: true, visitRequested: false, status: 'overdue', note: 'Flagged: missed two follow-up appointments.' },
  { id: 'demo-mm', initials: 'MM', name: 'Mary Mikhail', stage: 'Growing', daysSince: 29, canonPct: 65, flagged: false, visitRequested: false, status: 'recent', note: '' },
  { id: 'demo-ag', initials: 'AG', name: 'Andrew George', stage: 'Seeking', daysSince: 92, canonPct: 0, flagged: true, visitRequested: false, status: 'overdue', note: 'New to the church — needs initial meeting.' },
  { id: 'demo-cn', initials: 'CN', name: 'Christine Naguib', stage: 'Multiplying', daysSince: 35, canonPct: 92, flagged: false, visitRequested: false, status: 'due', note: '' },
];

const STATUS_COLOR: Record<StatusType, string> = lazyThemed(() => ({
  recent: colors.green,
  due: colors.yellow,
  overdue: colors.red,
}));

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
  const navigation = useNavigation();
  const { user, profile } = useSession();
  const { demoMode } = useDemoMode();
  const [filter, setFilter] = useState<FilterType>('all');
  const [search, setSearch] = useState('');
  const [members, setMembers] = useState<FlockMember[]>([]);
  const [loading, setLoading] = useState(!demoMode);
  const [contextMember, setContextMember] = useState<FlockMember | null>(null);

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const greeting = profile?.full_name ? `Fr. ${profile.full_name.split(' ').slice(-1)[0]}` : 'Father';

  // Reload on focus (not just mount) so changes made in the member detail —
  // e.g. a roster photo added there — show up when returning to the list.
  useFocusEffect(
    useCallback(() => {
      if (demoMode) {
        setMembers(FLOCK_DEMO);
      } else {
        loadFlock();
      }
    }, [user, demoMode]) // eslint-disable-line react-hooks/exhaustive-deps
  );

  async function loadFlock() {
    if (!user) return;
    setLoading(true);
    const profiles = await db.getFlock(user.id);

    // latest confession per member
    const confessions = await db.getConfessionsForPriest(user.id);

    // Which members have an open "Request Pastoral Visit" flag.
    const visitReqs = await db.getFlockVisitRequests(profiles.map(p => p.id));

    // Roster photos this priest set for members without a picture of their own.
    const myPhotos = await db.getMyMemberPhotos(user.id);

    const now = new Date();
    const latestByMember: Record<string, string> = {};
    for (const c of confessions ?? []) {
      if (!latestByMember[c.congregant_id]) latestByMember[c.congregant_id] = c.encountered_at;
    }

    const mapped: FlockMember[] = profiles.map(p => {
      // Newest of priest-logged confession encounters and the member's
      // self-reported last confession — never double-counted, just max'd.
      const lastMs = latestConfessionMs(latestByMember[p.id], p.last_confession_at);
      // Local calendar days, matching the member's own count.
      const daysSince = lastMs != null ? daysSinceMs(lastMs) : null;
      const status: StatusType =
        daysSince === null ? 'overdue' :
        daysSince < 30 ? 'recent' :
        daysSince < 60 ? 'due' : 'overdue';
      const parts = (p.full_name ?? '?').split(' ');
      const initials = (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '');
      return { id: p.id, initials: initials.toUpperCase(), name: p.full_name ?? 'Unknown', stage: '', daysSince, canonPct: null, flagged: false, visitRequested: !!visitReqs[p.id], status, note: '', avatarUrl: p.avatar_url ?? myPhotos[p.id] ?? null };
    });

    setMembers(mapped);
    setLoading(false);
  }

  const filtered = members.filter(m => {
    const matchSearch = m.name.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' ? true : filter === 'flagged' ? (m.flagged || m.visitRequested) : m.status === filter;
    return matchSearch && matchFilter;
  });

  const overdue = members.filter(m => m.status === 'overdue').length;
  const due = members.filter(m => m.status === 'due').length;
  const flagged = members.filter(m => m.flagged || m.visitRequested).length;
  const visitRequests = members.filter(m => m.visitRequested).length;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        <View style={styles.topbar}>
          <View style={styles.topbarLeft}>
            <TouchableOpacity
              style={styles.menuBtn}
              onPress={() => { H.tap(); navigation.dispatch(DrawerActions.openDrawer()); }}
              hitSlop={8}
            >
              <Text style={styles.menuBtnText}>☰</Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.pageTitle}>My Flock</Text>
              <Text style={styles.pageSubtitle}>{today} · {greeting}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.switchBtn} onPress={() => router.push('/(tabs)')}>
            <Text style={styles.switchBtnText}>MY VIEW</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.flockMeta}>
          {members.length} member{members.length !== 1 ? 's' : ''}
          {overdue > 0 ? ` · ${overdue} overdue` : ''}
          {visitRequests > 0 ? ` · ${visitRequests} visit request${visitRequests !== 1 ? 's' : ''}` : ''}
        </Text>

        <TextInput
          style={styles.search}
          placeholder="Search members..."
          placeholderTextColor={colors.faint}
          value={search}
          onChangeText={setSearch}
        />

        <View style={styles.filterRow}>
          {FILTER_OPTS.map(opt => (
            <TouchableOpacity
              key={opt.value}
              style={styles.filterTab}
              onPress={() => setFilter(opt.value)}
            >
              <Text style={[styles.filterTabText, filter === opt.value && styles.filterTabTextActive]}>
                {opt.label}
              </Text>
              {filter === opt.value && <View style={styles.filterTabUnderline} />}
            </TouchableOpacity>
          ))}
        </View>

        <Card title={`Members (${filtered.length})`} flat>
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
                onPress={() => { H.tap(); router.push({ pathname: '/(priest)/member', params: { id: member.id, name: member.name } }); }}
                onLongPress={() => { H.heavy(); setContextMember(member); }}
                activeOpacity={0.7}
              >
                <Avatar url={member.avatarUrl} initials={member.initials} size={40} style={[styles.avatar, member.flagged && styles.avatarFlagged]} textStyle={styles.avatarText} />
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
                    <CrossIcon size={12} color={colors.muted} />
                    {member.daysSince !== null
                      ? <Text style={styles.metaItem}>{member.daysSince}d ago</Text>
                      : <Text style={styles.metaItem}>No record</Text>
                    }
                    {member.stage ? (
                      <>
                        <Text style={styles.metaDot}>·</Text>
                        <Text style={styles.metaItem}>{member.stage}</Text>
                      </>
                    ) : null}
                  </View>
                  {member.note ? <Text style={styles.memberNote}>{member.note}</Text> : null}
                  {member.visitRequested && (
                    <View style={styles.visitBadge}>
                      <Text style={styles.visitBadgeText}>◎ Requested a pastoral visit</Text>
                    </View>
                  )}
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

      {/* Long-press context sheet */}
      <Modal
        visible={contextMember !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setContextMember(null)}
      >
        <TouchableOpacity style={ctx.backdrop} activeOpacity={1} onPress={() => setContextMember(null)}>
          <View style={ctx.sheet}>
            <View style={ctx.handle} />
            {contextMember && (
              <>
                <Text style={ctx.memberName}>{contextMember.name}</Text>
                <Text style={ctx.memberMeta}>
                  {contextMember.daysSince !== null ? `${contextMember.daysSince}d since confession` : 'No confession on record'}
                  {contextMember.stage ? ` · ${contextMember.stage}` : ''}
                </Text>
                <View style={ctx.divider} />
                <TouchableOpacity style={ctx.action} onPress={() => {
                  H.tap(); setContextMember(null);
                  router.push({ pathname: '/(priest)/log-encounter', params: { id: contextMember.id, name: contextMember.name } });
                }}>
                  <View style={ctx.actionIcon}><CrossIcon size={18} color={colors.gold} /></View>
                  <Text style={ctx.actionLabel}>Log Encounter</Text>
                  <Text style={ctx.actionChevron}>›</Text>
                </TouchableOpacity>
                <TouchableOpacity style={ctx.action} onPress={() => {
                  H.tap(); setContextMember(null);
                  router.push({ pathname: '/(priest)/assign-canon', params: { id: contextMember.id, name: contextMember.name } });
                }}>
                  <View style={ctx.actionIcon}><CandleIcon size={18} color={colors.gold} /></View>
                  <Text style={ctx.actionLabel}>Assign Canon</Text>
                  <Text style={ctx.actionChevron}>›</Text>
                </TouchableOpacity>
                <TouchableOpacity style={ctx.action} onPress={() => {
                  H.tap(); setContextMember(null);
                  router.push({ pathname: '/(priest)/member', params: { id: contextMember.id, name: contextMember.name } });
                }}>
                  <View style={ctx.actionIcon}><PersonIcon size={18} color={colors.gold} /></View>
                  <Text style={ctx.actionLabel}>View Profile</Text>
                  <Text style={ctx.actionChevron}>›</Text>
                </TouchableOpacity>
                <View style={ctx.divider} />
                <TouchableOpacity style={ctx.cancelBtn} onPress={() => setContextMember(null)}>
                  <Text style={ctx.cancelText}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const ctx = lazyThemed(() => StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 24, paddingBottom: 36, paddingTop: 14 },
  handle: { width: 36, height: 4, backgroundColor: colors.faint, borderRadius: 2, alignSelf: 'center', marginBottom: 18 },
  memberName: { fontFamily: fonts.cormorantMedium, fontSize: 20, color: colors.cream, marginBottom: 3 },
  memberMeta: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, marginBottom: 16 },
  divider: { height: 1, backgroundColor: colors.creamDim, marginVertical: 8 },
  action: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  actionIcon: { width: 24, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  actionLabel: { fontFamily: fonts.lato, fontSize: 15, color: colors.cream, flex: 1 },
  actionChevron: { fontFamily: fonts.lato, fontSize: 20, color: colors.muted },
  cancelBtn: { paddingVertical: 14, alignItems: 'center' },
  cancelText: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.muted, letterSpacing: 0.5 },
}));

const styles = lazyThemed(() => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.navy },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },

  topbar: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 },
  topbarLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, marginRight: 12 },
  menuBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 11, paddingVertical: 6 },
  menuBtnText: { fontFamily: fonts.lato, fontSize: 16, color: colors.gold },
  pageTitle: { fontFamily: fonts.cormorantMedium, fontSize: 28, color: colors.cream },
  pageSubtitle: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, marginTop: 4 },
  switchBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  switchBtnText: { fontFamily: fonts.latoBold, fontSize: 9, color: colors.muted, letterSpacing: 1.5 },

  flockMeta: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, marginBottom: 18, marginTop: -12 },

  search: { backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, borderRadius: 8, color: colors.cream, fontFamily: fonts.latoLight, fontSize: 13, padding: 11, marginBottom: 12 },

  filterRow: { flexDirection: 'row', gap: 0, marginBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  filterTab: { paddingHorizontal: 16, paddingBottom: 10, position: 'relative' },
  filterTabText: { fontFamily: fonts.latoBold, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.muted },
  filterTabTextActive: { color: colors.goldLight },
  filterTabUnderline: { position: 'absolute', bottom: 0, left: 16, right: 16, height: 2, backgroundColor: colors.gold, borderRadius: 1 },

  emptyState: { alignItems: 'center', paddingVertical: 24, gap: 6 },
  emptyTitle: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.muted },
  emptyBody: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, textAlign: 'center', lineHeight: 17, opacity: 0.7 },

  memberRow: { paddingVertical: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  memberBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.blueBg, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarFlagged: { borderColor: colors.red, backgroundColor: 'rgba(192,57,43,0.2)' },
  avatarText: { fontFamily: fonts.cormorantMedium, fontSize: 14, color: colors.blue },
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
  visitBadge: { backgroundColor: colors.blueBg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20, alignSelf: 'flex-start', marginTop: 5, borderWidth: 1, borderColor: colors.blue },
  visitBadgeText: { fontFamily: fonts.latoBold, fontSize: 9, color: colors.blue, letterSpacing: 0.5 },
  chevron: { fontFamily: fonts.lato, fontSize: 20, color: colors.muted, marginTop: 8 },
}));
