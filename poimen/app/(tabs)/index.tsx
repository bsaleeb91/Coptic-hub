import React from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, fonts } from '@/lib/theme';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { PrivacyNote } from '@/components/ui/PrivacyNote';

const VITALS_BARS = [
  { label: 'Daily Prayer (Agpeya)', pct: 65 },
  { label: 'Scripture Reading', pct: 80 },
  { label: 'Divine Liturgy', pct: 80 },
  { label: 'Small Group', pct: 90 },
  { label: 'Service / Diakonia', pct: 50 },
];

const TIMELINE = [
  { date: 'MAY 21, 2026', title: 'Holy Confession', body: 'Fr. Bishoy assigned a 40-day reading plan from the Psalms.', tag: '✝ Confession', tagBg: 'rgba(201,168,76,0.15)', tagColor: colors.goldLight },
  { date: 'MAY 4, 2026', title: 'Pastoral Visit — Home', body: 'Fr. Bishoy visited following the birth of your daughter. Prayers and blessings offered.', tag: '◎ Pastoral Visit', tagBg: 'rgba(41,128,185,0.15)', tagColor: colors.blue },
  { date: 'APR 20, 2026', title: 'Holy Week Confession', body: 'Guidance on marriage and family prayer practices.', tag: '✝ Confession', tagBg: 'rgba(201,168,76,0.15)', tagColor: colors.goldLight },
  { date: 'MAR 12, 2026', title: 'Small Group Check-in', body: 'Discussed the Book of Job with the young couples\' group.', tag: '◇ Note', tagBg: 'rgba(245,240,232,0.07)', tagColor: colors.muted, dim: true },
];

const FEASTS = [
  { month: 'JUN', day: '12', title: 'Feast of the Apostles', desc: 'End of Apostles\' Fast. Breaking of fast after Divine Liturgy.' },
  { month: 'JUN', day: '29', title: 'Sts. Peter & Paul', desc: 'Feast of the chief apostles. Divine Liturgy at 7:00 AM.' },
  { month: 'JUL', day: '19', title: 'Feast of Archangel Michael', desc: 'Monthly feast. Tasbeha at 11:00 PM the prior evening.' },
];

export default function DashboardScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        {/* Greeting */}
        <View style={styles.topbar}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={styles.greeting}>Peace be with you, Michael</Text>
            <Text style={styles.subtitle}>Sunday, June 7 · Apostles' Fast · Day 12</Text>
          </View>
          <TouchableOpacity style={styles.btnGold} onPress={() => router.push('/(tabs)/confession')}>
            <Text style={styles.btnGoldText}>PREPARE</Text>
          </TouchableOpacity>
        </View>

        {/* Vital Cards */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.vitalsScroll}
          contentContainerStyle={styles.vitalsContent}
        >
          <View style={styles.vitalCard}>
            <View style={styles.vitalGoldLine} />
            <Text style={styles.vitalLabel}>Last Confession</Text>
            <Text style={styles.vitalValue}>47</Text>
            <Text style={styles.vitalMeta}>days ago · May 21st</Text>
            <Badge variant="yellow" label="⚠ Due for visit" />
          </View>
          <View style={styles.vitalCard}>
            <View style={styles.vitalGoldLine} />
            <Text style={styles.vitalLabel}>Church Attendance</Text>
            <Text style={styles.vitalValue}>8 / 10</Text>
            <Text style={styles.vitalMeta}>Sundays this quarter</Text>
            <Badge variant="green" label="✓ Consistent" />
          </View>
          <View style={styles.vitalCard}>
            <View style={styles.vitalGoldLine} />
            <Text style={styles.vitalLabel}>Discipleship Stage</Text>
            <Text style={[styles.vitalValue, { fontSize: 20, paddingTop: 4 }]}>Growing</Text>
            <Text style={styles.vitalMeta}>Assigned: Fr. Bishoy Marcos</Text>
            <Badge variant="green" label="✓ Active" />
          </View>
        </ScrollView>

        {/* Confession CTA Banner */}
        <View style={styles.banner}>
          <Text style={styles.bannerCross}>✝</Text>
          <Text style={styles.bannerLabel}>UPCOMING</Text>
          <Text style={styles.bannerTitle}>Confession Appointment Available</Text>
          <Text style={styles.bannerBody}>
            Fr. Bishoy has confession hours this Sunday after the Divine Liturgy. You last confessed 47 days ago. The Apostles' Fast is a blessed time to receive the sacrament.
          </Text>
          <View style={styles.bannerActions}>
            <TouchableOpacity style={styles.btnGold} onPress={() => router.push('/(tabs)/confession')}>
              <Text style={styles.btnGoldText}>BEGIN EXAMINATION</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnGhost}>
              <Text style={styles.btnGhostText}>Schedule</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Pastoral Journey Timeline */}
        <Card
          title="Pastoral Journey"
          titleIcon="◎"
          action={<Text style={styles.cardAction}>View all</Text>}
        >
          {TIMELINE.map((item, i) => (
            <View key={i} style={styles.tlRow}>
              <View style={styles.tlDotCol}>
                <View style={[styles.tlDot, item.dim && styles.tlDotDim]} />
                {i < TIMELINE.length - 1 && <View style={styles.tlLine} />}
              </View>
              <View style={[styles.tlBodyCol, i < TIMELINE.length - 1 && { paddingBottom: 16 }]}>
                <Text style={[styles.tlDate, item.dim && { opacity: 0.5 }]}>{item.date}</Text>
                <Text style={styles.tlTitle}>{item.title}</Text>
                <Text style={styles.tlBody}>{item.body}</Text>
                <View style={[styles.tlTag, { backgroundColor: item.tagBg }]}>
                  <Text style={[styles.tlTagText, { color: item.tagColor }]}>{item.tag}</Text>
                </View>
              </View>
            </View>
          ))}
        </Card>

        {/* Spiritual Vitals Bars */}
        <Card
          title="Spiritual Vitals"
          titleIcon="✦"
          action={<Text style={styles.cardAction}>Edit</Text>}
        >
          {VITALS_BARS.map((v, i) => (
            <View key={i} style={[styles.vitalRow, i < VITALS_BARS.length - 1 && { marginBottom: 12 }]}>
              <Text style={styles.vitalRowLabel}>{v.label}</Text>
              <View style={styles.vitalBarTrack}>
                <View style={[styles.vitalBarFill, { width: `${v.pct}%` as any }]} />
              </View>
              <Text style={styles.vitalRowVal}>{v.pct}%</Text>
            </View>
          ))}
          <PrivacyNote text="Self-reported. Only you and Fr. Bishoy can see this." />
        </Card>

        {/* Upcoming Feasts */}
        <Card
          title="Upcoming Feasts"
          titleIcon="⊕"
          action={<Text style={styles.cardAction}>Full calendar</Text>}
        >
          {FEASTS.map((feast, i) => (
            <View key={i} style={[styles.feastItem, i < FEASTS.length - 1 && styles.feastBorder]}>
              <View style={styles.feastDateBlock}>
                <Text style={styles.feastMonth}>{feast.month}</Text>
                <Text style={styles.feastDay}>{feast.day}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.feastTitle}>{feast.title}</Text>
                <Text style={styles.feastDesc}>{feast.desc}</Text>
              </View>
            </View>
          ))}
        </Card>

        {/* Father of Confession */}
        <Card title="My Father of Confession" titleIcon="◉">
          <View style={styles.focRow}>
            <View style={styles.focAvatar}>
              <Text style={styles.focAvatarText}>BM</Text>
            </View>
            <View>
              <Text style={styles.focName}>Fr. Bishoy Marcos</Text>
              <Text style={styles.focChurch}>St. Mary's Coptic Orthodox Church</Text>
            </View>
          </View>
          <Pressable style={styles.scheduleChip} onPress={() => router.push('/(tabs)/confession')}>
            <Text style={styles.scheduleIcon}>✝</Text>
            <View>
              <Text style={styles.scheduleText}>Request Confession Appointment</Text>
              <Text style={styles.scheduleSub}>Next available: Sunday after Liturgy</Text>
            </View>
          </Pressable>
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
  greeting: { fontFamily: fonts.cormorantMedium, fontSize: 26, color: colors.cream, lineHeight: 32 },
  subtitle: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, marginTop: 4 },

  btnGold: { backgroundColor: colors.gold, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9, alignSelf: 'flex-start' },
  btnGoldText: { fontFamily: fonts.latoBold, fontSize: 10, color: colors.navy, letterSpacing: 0.8 },
  btnGhost: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9 },
  btnGhostText: { fontFamily: fonts.lato, fontSize: 11, color: colors.muted },

  vitalsScroll: { marginHorizontal: -20, marginBottom: 20 },
  vitalsContent: { paddingHorizontal: 20, gap: 12 },
  vitalCard: {
    width: 160,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  vitalGoldLine: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 2,
    backgroundColor: colors.gold, opacity: 0.6,
  },
  vitalLabel: { fontFamily: fonts.latoBold, fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: colors.muted, marginBottom: 10 },
  vitalValue: { fontFamily: fonts.cormorantMedium, fontSize: 28, color: colors.cream, lineHeight: 32 },
  vitalMeta: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, marginTop: 6 },

  banner: {
    backgroundColor: 'rgba(201,168,76,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.3)',
    borderRadius: 14,
    padding: 20,
    marginBottom: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  bannerCross: { position: 'absolute', right: 16, top: 10, fontSize: 56, color: 'rgba(201,168,76,0.07)', fontFamily: fonts.cormorant },
  bannerLabel: { fontFamily: fonts.latoBold, fontSize: 9, letterSpacing: 2.5, textTransform: 'uppercase', color: colors.gold, marginBottom: 4 },
  bannerTitle: { fontFamily: fonts.cormorantMedium, fontSize: 20, color: colors.cream, marginBottom: 6 },
  bannerBody: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, lineHeight: 18, maxWidth: '85%' },
  bannerActions: { flexDirection: 'row', gap: 10, marginTop: 14, flexWrap: 'wrap' },

  tlRow: { flexDirection: 'row', gap: 14 },
  tlDotCol: { alignItems: 'center', width: 14 },
  tlDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.gold, marginTop: 4, flexShrink: 0 },
  tlDotDim: { backgroundColor: colors.muted },
  tlLine: { width: 1, flex: 1, backgroundColor: colors.border, marginTop: 4 },
  tlBodyCol: { flex: 1, paddingBottom: 4 },
  tlDate: { fontFamily: fonts.latoBold, fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.gold, opacity: 0.7, marginBottom: 3 },
  tlTitle: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.cream, marginBottom: 2 },
  tlBody: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, lineHeight: 18 },
  tlTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20, alignSelf: 'flex-start', marginTop: 6 },
  tlTagText: { fontFamily: fonts.latoBold, fontSize: 10, letterSpacing: 0.5 },

  vitalRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  vitalRowLabel: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, flex: 1 },
  vitalBarTrack: { width: 80, height: 4, backgroundColor: 'rgba(245,240,232,0.08)', borderRadius: 4, overflow: 'hidden', flexShrink: 0 },
  vitalBarFill: { height: '100%', backgroundColor: colors.gold, borderRadius: 4 },
  vitalRowVal: { fontFamily: fonts.latoBold, fontSize: 12, color: colors.cream, width: 34, textAlign: 'right' },

  feastItem: { flexDirection: 'row', gap: 14, paddingVertical: 12, alignItems: 'flex-start' },
  feastBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  feastDateBlock: { backgroundColor: colors.goldDim, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 8, alignItems: 'center', minWidth: 42 },
  feastMonth: { fontFamily: fonts.latoBold, fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: colors.gold },
  feastDay: { fontFamily: fonts.cormorantMedium, fontSize: 22, color: colors.cream, lineHeight: 26 },
  feastTitle: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.cream, marginBottom: 2 },
  feastDesc: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, lineHeight: 16 },

  cardAction: { fontFamily: fonts.lato, fontSize: 11, color: colors.gold },

  focRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  focAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#2c4a7c', borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  focAvatarText: { fontFamily: fonts.cormorantMedium, fontSize: 16, color: colors.cream },
  focName: { fontFamily: fonts.latoBold, fontSize: 14, color: colors.cream },
  focChurch: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted },
  scheduleChip: {
    flexDirection: 'row', gap: 10,
    backgroundColor: colors.goldDim, borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, padding: 12, alignItems: 'center',
  },
  scheduleIcon: { fontSize: 18 },
  scheduleText: { fontFamily: fonts.latoBold, fontSize: 12, color: colors.cream },
  scheduleSub: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, marginTop: 1 },
});
