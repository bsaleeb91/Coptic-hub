import React, { useState, useEffect } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, fonts } from '@/lib/theme';
import { Card } from '@/components/ui/Card';
import { useSession } from '@/lib/auth';
import * as db from '@/lib/db';
import type { Profile, Church } from '@/lib/db';

const ROLE_META: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  priest:     { label: 'Priests',      icon: '✝', color: colors.blue,   bg: colors.blueBg },
  servant:    { label: 'Servants',     icon: '◇', color: colors.green,  bg: colors.greenBg },
  congregant: { label: 'Congregants',  icon: '◉', color: colors.gold,   bg: colors.goldDim },
  admin:      { label: 'Admins',       icon: '⊕', color: colors.red,    bg: colors.redBg },
};

const ROLE_ORDER = ['priest', 'admin', 'servant', 'congregant'];

type RoleFilter = 'all' | 'priest' | 'servant' | 'congregant' | 'admin';

const ROLE_FILTER_OPTS: { value: RoleFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'priest', label: 'Priests' },
  { value: 'servant', label: 'Servants' },
  { value: 'congregant', label: 'Congregants' },
  { value: 'admin', label: 'Admins' },
];

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const wks = Math.floor(days / 7);
  if (wks < 5) return `${wks}w ago`;
  return new Date(iso).toLocaleDateString();
}

function isActiveThisWeek(iso: string | null): boolean {
  if (!iso) return false;
  return Date.now() - new Date(iso).getTime() < 7 * 24 * 60 * 60 * 1000;
}

export default function AdminScreen() {
  const router = useRouter();
  const { profile } = useSession();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [churches, setChurches] = useState<Church[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');

  useEffect(() => {
    if (!profile || profile.role !== 'admin') return;
    Promise.all([db.getAllProfiles(), db.getChurches()]).then(([p, c]) => {
      setProfiles(p);
      setChurches(c);
      setLoading(false);
    });
  }, [profile]);

  if (Platform.OS !== 'web') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
          <Text style={{ fontFamily: fonts.cormorantMedium, fontSize: 22, color: colors.cream, marginBottom: 8 }}>Web Only</Text>
          <Text style={{ fontFamily: fonts.latoLight, fontSize: 13, color: colors.muted, textAlign: 'center' }}>The admin dashboard is only accessible at poimen-app.vercel.app.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (profile && profile.role !== 'admin') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
          <Text style={{ fontFamily: fonts.cormorantMedium, fontSize: 22, color: colors.cream, marginBottom: 8 }}>Access Denied</Text>
          <Text style={{ fontFamily: fonts.latoLight, fontSize: 13, color: colors.muted, textAlign: 'center' }}>This screen is restricted to admins.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const visibleRoles = roleFilter === 'all' ? ROLE_ORDER : [roleFilter];
  const byRole = ROLE_ORDER.reduce<Record<string, Profile[]>>((acc, role) => {
    acc[role] = profiles.filter((p) => p.role === role);
    return acc;
  }, {});

  const total = roleFilter === 'all' ? profiles.length : (byRole[roleFilter]?.length ?? 0);
  const activeThisWeek = profiles.filter((p) => isActiveThisWeek(p.last_seen_at)).length;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.eyebrow}>ADMIN</Text>
        <Text style={styles.title}>Dashboard</Text>

        {loading ? (
          <ActivityIndicator color={colors.gold} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* ── Stats row ── */}
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{profiles.length}</Text>
                <Text style={styles.statLabel}>Total Users</Text>
              </View>
              <View style={[styles.statCard, styles.statCardMid]}>
                <Text style={styles.statValue}>{activeThisWeek}</Text>
                <Text style={styles.statLabel}>Active This Week</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{churches.length}</Text>
                <Text style={styles.statLabel}>Churches</Text>
              </View>
            </View>

            {/* ── Role filter tabs ── */}
            <Text style={styles.sectionLabel}>USERS</Text>
            <Text style={styles.subtitle}>{total} user{total !== 1 ? 's' : ''}</Text>

            <View style={styles.filterRow}>
              {ROLE_FILTER_OPTS.map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  style={styles.filterTab}
                  onPress={() => setRoleFilter(opt.value)}
                >
                  <Text style={[styles.filterTabText, roleFilter === opt.value && styles.filterTabActive]}>
                    {opt.label}
                  </Text>
                  {roleFilter === opt.value && <View style={styles.filterTabUnderline} />}
                </TouchableOpacity>
              ))}
            </View>

            {/* ── User list ── */}
            {visibleRoles.map((role) => {
              const group = byRole[role];
              if (!group || group.length === 0) return null;
              const meta = ROLE_META[role];
              return (
                <Card key={role} title={`${meta.icon}  ${meta.label}`} titleIcon="">
                  {group.map((p, i) => (
                    <View key={p.id} style={[styles.row, i < group.length - 1 && styles.rowBorder]}>
                      <View style={[styles.avatar, { backgroundColor: meta.bg }]}>
                        <Text style={[styles.avatarText, { color: meta.color }]}>
                          {(p.full_name ?? '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.rowBody}>
                        <Text style={styles.name}>{p.full_name ?? '—'}</Text>
                        <Text style={styles.church}>{p.church_name ?? 'No church set'}</Text>
                        <View style={styles.tagRow}>
                          {p.foc_id && <Text style={[styles.tag, { color: colors.green }]}>FOC linked</Text>}
                          {p.last_seen_at && (
                            <Text style={[styles.tag, { color: isActiveThisWeek(p.last_seen_at) ? colors.gold : colors.muted }]}>
                              {timeAgo(p.last_seen_at)}
                            </Text>
                          )}
                          {!p.last_seen_at && <Text style={[styles.tag, { color: colors.muted }]}>Never opened</Text>}
                        </View>
                      </View>
                      <View style={[styles.rolePill, { backgroundColor: meta.bg, borderColor: meta.color }]}>
                        <Text style={[styles.rolePillText, { color: meta.color }]}>{role.toUpperCase()}</Text>
                      </View>
                    </View>
                  ))}
                </Card>
              );
            })}

            {/* ── Churches section ── */}
            <Text style={[styles.sectionLabel, { marginTop: 28 }]}>CHURCHES</Text>
            {churches.length === 0 ? (
              <Text style={styles.emptyText}>No churches added yet. Add them via the Supabase dashboard.</Text>
            ) : (
              <Card title="✦  Registered Churches" titleIcon="">
                {churches.map((c, i) => {
                  const priestCount = profiles.filter((p) => p.church_id === c.id && p.role === 'priest').length;
                  const memberCount = profiles.filter((p) => p.church_id === c.id).length;
                  return (
                    <View key={c.id} style={[styles.row, i < churches.length - 1 && styles.rowBorder]}>
                      <View style={[styles.avatar, { backgroundColor: colors.goldDim }]}>
                        <Text style={[styles.avatarText, { color: colors.gold }]}>✦</Text>
                      </View>
                      <View style={styles.rowBody}>
                        <Text style={styles.name}>{c.name}</Text>
                        {c.address && <Text style={styles.church}>{c.address}</Text>}
                        <View style={styles.tagRow}>
                          <Text style={[styles.tag, { color: colors.blue }]}>{priestCount} priest{priestCount !== 1 ? 's' : ''}</Text>
                          <Text style={[styles.tag, { color: colors.muted }]}>{memberCount} member{memberCount !== 1 ? 's' : ''}</Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </Card>
            )}
          </>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.navy },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 48 },

  backBtn: { marginBottom: 20 },
  backText: { fontFamily: fonts.lato, fontSize: 13, color: colors.gold },

  eyebrow: { fontFamily: fonts.latoBold, fontSize: 9, letterSpacing: 2.5, color: colors.gold, marginBottom: 6 },
  title: { fontFamily: fonts.cormorantMedium, fontSize: 34, color: colors.cream, marginBottom: 20 },
  sectionLabel: { fontFamily: fonts.latoBold, fontSize: 9, letterSpacing: 2.5, color: colors.muted, marginBottom: 6, marginTop: 8 },
  subtitle: { fontFamily: fonts.latoLight, fontSize: 13, color: colors.muted, marginBottom: 4 },
  emptyText: { fontFamily: fonts.latoLight, fontSize: 13, color: colors.muted, marginTop: 8 },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  statCard: { flex: 1, backgroundColor: 'rgba(201,168,76,0.06)', borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, alignItems: 'center' },
  statCardMid: { borderColor: 'rgba(201,168,76,0.3)' },
  statValue: { fontFamily: fonts.cormorantMedium, fontSize: 28, color: colors.cream, lineHeight: 32 },
  statLabel: { fontFamily: fonts.latoBold, fontSize: 8, letterSpacing: 1.2, color: colors.muted, textTransform: 'uppercase', marginTop: 4, textAlign: 'center' },

  filterRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, marginVertical: 16 },
  filterTab: { paddingHorizontal: 14, paddingBottom: 10, position: 'relative' },
  filterTabText: { fontFamily: fonts.latoBold, fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.muted },
  filterTabActive: { color: colors.goldLight },
  filterTabUnderline: { position: 'absolute', bottom: 0, left: 14, right: 14, height: 2, backgroundColor: colors.gold, borderRadius: 1 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText: { fontFamily: fonts.cormorantMedium, fontSize: 15 },
  rowBody: { flex: 1 },
  name: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.cream },
  church: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, marginTop: 1 },
  tagRow: { flexDirection: 'row', gap: 10, marginTop: 3 },
  tag: { fontFamily: fonts.latoBold, fontSize: 9, letterSpacing: 0.8 },

  rolePill: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  rolePillText: { fontFamily: fonts.latoBold, fontSize: 8, letterSpacing: 1 },
});
