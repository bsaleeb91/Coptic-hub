import React, { useState } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '@/lib/theme';
import { Card } from '@/components/ui/Card';

type Visibility = 'private' | 'foc_only' | 'care_team';

const VISIBILITY_OPTS: { value: Visibility; label: string; icon: string }[] = [
  { value: 'private', label: 'Private — only me', icon: '🔒' },
  { value: 'foc_only', label: 'Father of Confession only', icon: '✝' },
  { value: 'care_team', label: 'Care team', icon: '◎' },
];

const ACTIVE_REQUESTS = [
  {
    title: 'Health of my mother',
    date: 'June 3, 2026',
    body: 'My mother was diagnosed with a heart condition. Asking for Fr. Bishoy\'s prayers and guidance on how to support her spiritually.',
    visibility: 'foc_only' as Visibility,
  },
  {
    title: 'Strength during the fast',
    date: 'May 31, 2026',
    body: 'Struggling with consistency in the Apostles\' Fast. Asking for prayers for perseverance.',
    visibility: 'private' as Visibility,
  },
  {
    title: 'New job transition',
    date: 'May 15, 2026',
    body: 'Starting a new role next month. Praying for wisdom, humility, and that God would direct my path.',
    visibility: 'private' as Visibility,
  },
];

const VIS_DISPLAY: Record<Visibility, { icon: string; label: string }> = {
  private: { icon: '🔒', label: 'Private — only me' },
  foc_only: { icon: '✝', label: 'Visible to Fr. Bishoy only' },
  care_team: { icon: '◎', label: 'Shared with care team' },
};

export default function PrayerScreen() {
  const [visibility, setVisibility] = useState<Visibility>('private');

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        <Text style={styles.pageTitle}>Prayer Requests</Text>
        <Text style={styles.pageSubtitle}>Submit, track, and mark answered prayers</Text>

        {/* Active Requests */}
        <Card title="Active Requests" titleIcon="◇">
          {ACTIVE_REQUESTS.map((req, i) => (
            <View key={i} style={[styles.reqItem, i < ACTIVE_REQUESTS.length - 1 && styles.reqBorder]}>
              <View style={styles.reqTop}>
                <Text style={styles.reqTitle}>{req.title}</Text>
                <Text style={styles.reqDate}>{req.date}</Text>
              </View>
              <Text style={styles.reqBody}>{req.body}</Text>
              <View style={styles.reqVis}>
                <Text style={styles.reqVisIcon}>{VIS_DISPLAY[req.visibility].icon}</Text>
                <Text style={styles.reqVisLabel}>{VIS_DISPLAY[req.visibility].label}</Text>
              </View>
            </View>
          ))}
        </Card>

        {/* New Request */}
        <Card title="New Request" titleIcon="✦">
          <Text style={styles.formLabel}>TITLE</Text>
          <TextInput
            style={styles.input}
            placeholder="Brief description..."
            placeholderTextColor="rgba(245,240,232,0.22)"
          />
          <Text style={[styles.formLabel, { marginTop: 14 }]}>DETAILS</Text>
          <TextInput
            style={[styles.textarea, { minHeight: 100 }]}
            multiline
            placeholder="Share your heart..."
            placeholderTextColor="rgba(245,240,232,0.22)"
          />
          <Text style={[styles.formLabel, { marginTop: 14 }]}>VISIBILITY</Text>
          {VISIBILITY_OPTS.map(opt => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.visOpt, visibility === opt.value && styles.visOptActive]}
              onPress={() => setVisibility(opt.value)}
            >
              <View style={[styles.visRadio, visibility === opt.value && styles.visRadioActive]}>
                {visibility === opt.value && <View style={styles.visRadioDot} />}
              </View>
              <Text style={styles.visIcon}>{opt.icon}</Text>
              <Text style={[styles.visLabel, visibility === opt.value && styles.visLabelActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.btnGoldFull}>
            <Text style={styles.btnGoldText}>SUBMIT REQUEST</Text>
          </TouchableOpacity>
        </Card>

        {/* Answered Prayers */}
        <Card title="Answered Prayers" titleIcon="◈">
          <View style={styles.answeredItem}>
            <View style={styles.answeredTop}>
              <Text style={styles.answeredTitle}>Safe delivery of our daughter</Text>
              <View style={styles.answeredBadge}>
                <Text style={styles.answeredBadgeText}>✓ Answered</Text>
              </View>
            </View>
            <Text style={styles.answeredDate}>Answered May 2, 2026</Text>
            <Text style={styles.answeredBody}>God blessed us with a healthy daughter. Giving thanks for answered prayer.</Text>
          </View>
        </Card>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.navy },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },

  pageTitle: { fontFamily: fonts.cormorantMedium, fontSize: 28, color: colors.cream, marginBottom: 4 },
  pageSubtitle: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, marginBottom: 20 },

  reqItem: { paddingVertical: 14 },
  reqBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  reqTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 5 },
  reqTitle: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.cream, flex: 1 },
  reqDate: { fontFamily: fonts.latoLight, fontSize: 10, color: colors.muted, flexShrink: 0 },
  reqBody: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, lineHeight: 18 },
  reqVis: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  reqVisIcon: { fontSize: 11, color: colors.muted },
  reqVisLabel: { fontFamily: fonts.latoLight, fontSize: 10, color: colors.muted },

  formLabel: { fontFamily: fonts.latoBold, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.gold, opacity: 0.8, marginBottom: 8 },
  input: {
    backgroundColor: 'rgba(10,16,30,0.7)', borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, color: colors.cream, fontFamily: fonts.latoLight, fontSize: 13, padding: 12,
  },
  textarea: {
    backgroundColor: 'rgba(10,16,30,0.7)', borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, color: colors.cream, fontFamily: fonts.latoLight,
    fontSize: 13, padding: 12, textAlignVertical: 'top', lineHeight: 20,
  },

  visOpt: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.border,
    marginBottom: 8, backgroundColor: 'transparent',
  },
  visOptActive: { backgroundColor: colors.goldDim, borderColor: 'rgba(201,168,76,0.4)' },
  visRadio: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  visRadioActive: { borderColor: colors.gold },
  visRadioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.gold },
  visIcon: { fontSize: 14 },
  visLabel: { fontFamily: fonts.lato, fontSize: 13, color: colors.muted, flex: 1 },
  visLabelActive: { color: colors.cream, fontFamily: fonts.latoBold },

  btnGoldFull: { backgroundColor: colors.gold, borderRadius: 8, padding: 12, alignItems: 'center', marginTop: 14 },
  btnGoldText: { fontFamily: fonts.latoBold, fontSize: 11, color: colors.navy, letterSpacing: 0.8 },

  answeredItem: { paddingVertical: 4 },
  answeredTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 4 },
  answeredTitle: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.cream, flex: 1 },
  answeredBadge: { backgroundColor: colors.greenBg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  answeredBadgeText: { fontFamily: fonts.latoBold, fontSize: 10, color: colors.green },
  answeredDate: { fontFamily: fonts.latoLight, fontSize: 10, color: colors.muted, marginBottom: 4 },
  answeredBody: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, lineHeight: 18 },
});
