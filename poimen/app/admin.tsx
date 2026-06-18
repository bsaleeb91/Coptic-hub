import React, { useState, useEffect } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, fonts } from '@/lib/theme';
import { Card } from '@/components/ui/Card';
import * as db from '@/lib/db';
import type { Profile } from '@/lib/db';

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

export default function AdminScreen() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');

  useEffect(() => {
    db.getAllProfiles().then((data) => {
      setProfiles(data);
      setLoading(false);
    });
  }, []);

  const visibleRoles = roleFilter === 'all' ? ROLE_ORDER : [roleFilter];
  const byRole = ROLE_ORDER.reduce<Record<string, Profile[]>>((acc, role) => {
    acc[role] = profiles.filter((p) => p.role === role);
    return acc;
  }, {});

  const total = roleFilter === 'all'
    ? profiles.length
    : (byRole[roleFilter]?.length ?? 0);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.eyebrow}>ADMIN</Text>
        <Text style={styles.title}>All Users</Text>
        <Text style={styles.subtitle}>{loading ? '…' : `${total} user${total !== 1 ? 's' : ''}`}</Text>

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

        {loading ? (
          <ActivityIndicator color={colors.gold} style={{ marginTop: 40 }} />
        ) : (
          visibleRoles.map((role) => {
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
                      {p.foc_id && (
                        <Text style={styles.focTag}>FOC linked</Text>
                      )}
                    </View>
                    <View style={[styles.rolePill, { backgroundColor: meta.bg, borderColor: meta.color }]}>
                      <Text style={[styles.rolePillText, { color: meta.color }]}>{role.toUpperCase()}</Text>
                    </View>
                  </View>
                ))}
              </Card>
            );
          })
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
  title: { fontFamily: fonts.cormorantMedium, fontSize: 34, color: colors.cream, marginBottom: 4 },
  subtitle: { fontFamily: fonts.latoLight, fontSize: 13, color: colors.muted },

  filterRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, marginVertical: 20 },
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
  focTag: { fontFamily: fonts.latoBold, fontSize: 9, letterSpacing: 1, color: colors.green, marginTop: 3 },

  rolePill: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  rolePillText: { fontFamily: fonts.latoBold, fontSize: 8, letterSpacing: 1 },
});
