import React from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, fonts } from '@/lib/theme';
import { useSession } from '@/lib/auth';

const PORTALS = [
  {
    icon: '◉',
    title: 'Congregant',
    subtitle: 'Your personal view',
    desc: 'Dashboard · Confession prep · Spiritual canon · Journal · Prayer requests',
    route: '/(tabs)',
    accentColor: colors.gold,
    accentBg: colors.goldDim,
  },
  {
    icon: '✝︎',
    title: 'Priest',
    subtitle: 'Father of Confession portal',
    desc: 'Member roster · Pastoral encounter log · Canon assignment · Pastoral notes',
    route: '/(priest)',
    accentColor: colors.blue,
    accentBg: colors.blueBg,
  },
  {
    icon: '◇',
    title: 'Servant',
    subtitle: 'Sunday school servant portal',
    desc: 'Student roster · Student detail · Assign prayer & scripture canons',
    route: '/(servant)',
    accentColor: colors.green,
    accentBg: colors.greenBg,
  },
] as const;

export default function PortalsScreen() {
  const router = useRouter();
  const { profile } = useSession();

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.eyebrow}>POIMEN</Text>
        <Text style={styles.title}>Portals</Text>
        <Text style={styles.subtitle}>All three views of the pastoral care system.</Text>

        <View style={styles.divider} />

        {PORTALS.map((portal) => {
          const isYours =
            (portal.title === 'Congregant' && (!profile?.role || profile.role === 'congregant')) ||
            (portal.title === 'Priest' && (profile?.role === 'priest' || profile?.role === 'admin')) ||
            (portal.title === 'Servant' && profile?.role === 'servant');

          return (
            <TouchableOpacity
              key={portal.title}
              style={styles.card}
              onPress={() => router.push(portal.route as any)}
              activeOpacity={0.75}
            >
              <View style={[styles.iconBadge, { backgroundColor: portal.accentBg }]}>
                <Text style={[styles.iconText, { color: portal.accentColor }]}>{portal.icon}</Text>
              </View>
              <View style={styles.cardBody}>
                <View style={styles.cardTitleRow}>
                  <Text style={styles.cardTitle}>{portal.title}</Text>
                  {isYours && (
                    <View style={[styles.yoursBadge, { backgroundColor: portal.accentBg, borderColor: portal.accentColor }]}>
                      <Text style={[styles.yoursText, { color: portal.accentColor }]}>YOUR ROLE</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.cardSub}>{portal.subtitle}</Text>
                <Text style={styles.cardDesc}>{portal.desc}</Text>
              </View>
              <Text style={[styles.chevron, { color: portal.accentColor }]}>›</Text>
            </TouchableOpacity>
          );
        })}

        {(profile?.role === 'priest' || profile?.role === 'admin') && (
          <>
            <View style={styles.divider} />
            <TouchableOpacity
              style={[styles.card, styles.adminCard]}
              onPress={() => router.push('/admin' as any)}
              activeOpacity={0.75}
            >
              <View style={[styles.iconBadge, { backgroundColor: 'rgba(192,57,43,0.12)' }]}>
                <Text style={[styles.iconText, { color: colors.red }]}>⊕</Text>
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>Admin Overview</Text>
                <Text style={styles.cardSub}>All users by role</Text>
                <Text style={styles.cardDesc}>View all congregants, priests, and servants registered in the system.</Text>
              </View>
              <Text style={[styles.chevron, { color: colors.red }]}>›</Text>
            </TouchableOpacity>
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
  title: { fontFamily: fonts.cormorantMedium, fontSize: 34, color: colors.cream, marginBottom: 6 },
  subtitle: { fontFamily: fonts.latoLight, fontSize: 13, color: colors.muted, lineHeight: 19, marginBottom: 4 },

  divider: { height: 1, backgroundColor: colors.border, marginVertical: 20 },

  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    gap: 14,
  },
  adminCard: { borderColor: 'rgba(192,57,43,0.25)' },
  iconBadge: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  iconText: { fontSize: 20 },
  cardBody: { flex: 1 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  cardTitle: { fontFamily: fonts.cormorantMedium, fontSize: 20, color: colors.cream },
  cardSub: { fontFamily: fonts.latoBold, fontSize: 10, letterSpacing: 1, color: colors.muted, textTransform: 'uppercase', marginBottom: 6 },
  cardDesc: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, lineHeight: 17 },
  chevron: { fontFamily: fonts.cormorant, fontSize: 28, marginTop: 4, flexShrink: 0 },

  yoursBadge: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  yoursText: { fontFamily: fonts.latoBold, fontSize: 8, letterSpacing: 1 },
});
