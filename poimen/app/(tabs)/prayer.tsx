import React, { useState, useEffect, useRef } from 'react';
import {
  ScrollView, View, Text, StyleSheet, TouchableOpacity,
  TextInput, Animated, PanResponder, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '@/lib/theme';
import { Card } from '@/components/ui/Card';
import { useSession } from '@/lib/auth';
import * as db from '@/lib/db';
import { useDemoMode } from '@/lib/demo';

type Visibility = 'private' | 'foc_only' | 'care_team';

const VISIBILITY_OPTS: { value: Visibility; label: string; icon: string }[] = [
  { value: 'private', label: 'Private — only me', icon: '🔒' },
  { value: 'foc_only', label: 'Father of Confession only', icon: '✝' },
  { value: 'care_team', label: 'Care team', icon: '◎' },
];

const VIS_DISPLAY: Record<Visibility, { icon: string; label: string }> = {
  private: { icon: '🔒', label: 'Private — only me' },
  foc_only: { icon: '✝', label: 'Visible to FOC only' },
  care_team: { icon: '◎', label: 'Shared with care team' },
};

const DEMO_ACTIVE = [
  { id: 'd1', topic: 'Health of my mother', created_at: '2026-06-03', body: 'My mother was diagnosed with a heart condition. Asking for Fr. Bishoy\'s prayers and guidance on how to support her spiritually.', visibility: 'foc_only' as Visibility, answered: false },
  { id: 'd2', topic: 'Strength during the fast', created_at: '2026-05-31', body: 'Struggling with consistency in the Apostles\' Fast. Asking for prayers for perseverance.', visibility: 'private' as Visibility, answered: false },
  { id: 'd3', topic: 'New job transition', created_at: '2026-05-15', body: 'Starting a new role next month. Praying for wisdom, humility, and that God would direct my path.', visibility: 'private' as Visibility, answered: false },
];

const DEMO_ANSWERED = [
  { id: 'da1', topic: 'Safe delivery of our daughter', created_at: '2026-05-02', answered_note: 'God blessed us with a healthy daughter. Giving thanks for answered prayer.', answered: true },
];

// ── Swipeable Row ────────────────────────────────────────────
function SwipeableRequest({ item, onDelete, onMarkAnswered }: {
  item: any;
  onDelete: () => void;
  onMarkAnswered: () => void;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const ACTION_WIDTH = 130;

  const panResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dy) < 20,
    onPanResponderMove: (_, g) => {
      if (g.dx < 0) translateX.setValue(Math.max(g.dx, -ACTION_WIDTH));
    },
    onPanResponderRelease: (_, g) => {
      if (g.dx < -ACTION_WIDTH / 2) {
        Animated.spring(translateX, { toValue: -ACTION_WIDTH, useNativeDriver: true }).start();
      } else {
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
      }
    },
  })).current;

  function close() {
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
  }

  return (
    <View style={styles.swipeContainer}>
      {/* Actions revealed on swipe */}
      <View style={styles.swipeActions}>
        <TouchableOpacity
          style={[styles.swipeAction, styles.swipeActionAnswer]}
          onPress={() => { close(); onMarkAnswered(); }}
        >
          <Text style={styles.swipeActionText}>✓{'\n'}Answered</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.swipeAction, styles.swipeActionDelete]}
          onPress={() => { close(); onDelete(); }}
        >
          <Text style={styles.swipeActionText}>✕{'\n'}Delete</Text>
        </TouchableOpacity>
      </View>

      {/* Row content */}
      <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        <View style={styles.reqItem}>
          <View style={styles.reqTop}>
            <Text style={styles.reqTitle}>{item.topic}</Text>
            <Text style={styles.reqDate}>
              {new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </Text>
          </View>
          {item.body ? <Text style={styles.reqBody}>{item.body}</Text> : null}
          <View style={styles.reqVis}>
            <Text style={styles.reqVisText}>{VIS_DISPLAY[item.visibility as Visibility].icon} {VIS_DISPLAY[item.visibility as Visibility].label}</Text>
          </View>
          <Text style={styles.swipeHint}>← swipe to answer or delete</Text>
        </View>
      </Animated.View>
    </View>
  );
}

// ── Screen ───────────────────────────────────────────────────
export default function PrayerScreen() {
  const { user } = useSession();
  const { demoMode } = useDemoMode();
  const [active, setActive] = useState<any[]>([]);
  const [answered, setAnswered] = useState<any[]>([]);
  const [loading, setLoading] = useState(!demoMode);
  const [submitting, setSubmitting] = useState(false);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('private');

  useEffect(() => {
    if (demoMode) {
      setActive(DEMO_ACTIVE);
      setAnswered(DEMO_ANSWERED);
    } else {
      load();
    }
  }, [user]);

  async function load() {
    if (!user) return;
    setLoading(true);
    const data = await db.getPrayerRequests(user.id);
    if (data) {
      setActive(data.filter(r => !r.answered));
      setAnswered(data.filter(r => r.answered));
    }
    setLoading(false);
  }

  async function handleSubmit() {
    if (!title.trim()) return;
    if (demoMode) {
      const newReq = { id: Date.now().toString(), topic: title.trim(), created_at: new Date().toISOString(), body: body.trim(), visibility, answered: false };
      setActive(prev => [newReq, ...prev]);
      setTitle(''); setBody(''); setVisibility('private');
      return;
    }
    setSubmitting(true);
    const { data, error } = await db.insertPrayerRequest({
      user_id: user!.id,
      topic: title.trim(),
      visibility,
    });
    if (!error && data) setActive(prev => [data, ...prev]);
    setTitle(''); setBody(''); setVisibility('private');
    setSubmitting(false);
  }

  async function handleDelete(id: string) {
    Alert.alert('Delete Request', 'Remove this prayer request?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          setActive(prev => prev.filter(r => r.id !== id));
          if (!demoMode) await db.deletePrayerRequest(id);
        },
      },
    ]);
  }

  async function handleMarkAnswered(id: string) {
    const req = active.find(r => r.id === id);
    if (!req) return;
    const updated = { ...req, answered: true };
    setActive(prev => prev.filter(r => r.id !== id));
    setAnswered(prev => [updated, ...prev]);
    if (!demoMode) {
      await db.markPrayerAnswered(id);
    }
  }

  async function handleDeleteAnswered(id: string) {
    Alert.alert('Delete', 'Remove this answered prayer?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          setAnswered(prev => prev.filter(r => r.id !== id));
          if (!demoMode) await db.deletePrayerRequest(id);
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        <Text style={styles.pageTitle}>Prayer Requests</Text>
        <Text style={styles.pageSubtitle}>Submit, track, and mark answered prayers</Text>

        {/* Active Requests */}
        <Card title={`Active (${active.length})`} titleIcon="◇">
          {loading ? (
            <ActivityIndicator color={colors.gold} style={{ paddingVertical: 20 }} />
          ) : active.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>◇</Text>
              <Text style={styles.emptyTitle}>No active requests</Text>
              <Text style={styles.emptyBody}>Add your first prayer request below.</Text>
            </View>
          ) : (
            active.map((req, i) => (
              <View key={req.id}>
                <SwipeableRequest
                  item={req}
                  onDelete={() => handleDelete(req.id)}
                  onMarkAnswered={() => handleMarkAnswered(req.id)}
                />
                {i < active.length - 1 && <View style={styles.divider} />}
              </View>
            ))
          )}
        </Card>

        {/* New Request */}
        <Card title="New Request" titleIcon="✦">
          <Text style={styles.formLabel}>TITLE</Text>
          <TextInput
            style={styles.input}
            placeholder="Brief description..."
            placeholderTextColor="rgba(245,240,232,0.22)"
            value={title}
            onChangeText={setTitle}
          />
          <Text style={[styles.formLabel, { marginTop: 14 }]}>DETAILS (optional)</Text>
          <TextInput
            style={styles.textarea}
            multiline
            placeholder="Share your heart..."
            placeholderTextColor="rgba(245,240,232,0.22)"
            value={body}
            onChangeText={setBody}
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
          <TouchableOpacity
            style={[styles.btnGoldFull, (!title.trim() || submitting) && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={!title.trim() || submitting}
          >
            {submitting
              ? <ActivityIndicator color={colors.navy} />
              : <Text style={styles.btnGoldText}>SUBMIT REQUEST</Text>
            }
          </TouchableOpacity>
        </Card>

        {/* Answered Prayers */}
        {answered.length > 0 && (
          <Card title={`Answered (${answered.length})`} titleIcon="◈">
            {answered.map((req, i) => (
              <View key={req.id}>
                <SwipeableRequest
                  item={{ ...req, visibility: req.visibility ?? 'private' }}
                  onDelete={() => handleDeleteAnswered(req.id)}
                  onMarkAnswered={() => {}}
                />
                {i < answered.length - 1 && <View style={styles.divider} />}
              </View>
            ))}
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

  pageTitle: { fontFamily: fonts.cormorantMedium, fontSize: 28, color: colors.cream, marginBottom: 4 },
  pageSubtitle: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, marginBottom: 20 },

  swipeContainer: { position: 'relative', overflow: 'hidden' },
  swipeActions: { position: 'absolute', right: 0, top: 0, bottom: 0, flexDirection: 'row' },
  swipeAction: { width: 65, alignItems: 'center', justifyContent: 'center' },
  swipeActionAnswer: { backgroundColor: colors.greenBg },
  swipeActionDelete: { backgroundColor: 'rgba(192,57,43,0.25)' },
  swipeActionText: { fontFamily: fonts.latoBold, fontSize: 10, color: colors.cream, textAlign: 'center', letterSpacing: 0.5 },

  reqItem: { paddingVertical: 14, backgroundColor: colors.navyMid },
  reqTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 5 },
  reqTitle: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.cream, flex: 1 },
  reqDate: { fontFamily: fonts.latoLight, fontSize: 10, color: colors.muted, flexShrink: 0 },
  reqBody: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, lineHeight: 18, marginBottom: 6 },
  reqVis: { flexDirection: 'row', alignItems: 'center' },
  reqVisText: { fontFamily: fonts.latoLight, fontSize: 10, color: colors.muted },
  swipeHint: { fontFamily: fonts.latoLight, fontSize: 9, color: 'rgba(245,240,232,0.2)', marginTop: 6, letterSpacing: 0.3 },

  divider: { height: 1, backgroundColor: colors.border },

  emptyState: { alignItems: 'center', paddingVertical: 20, gap: 6 },
  emptyIcon: { fontSize: 28, color: colors.muted, opacity: 0.4 },
  emptyTitle: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.muted },
  emptyBody: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, textAlign: 'center', lineHeight: 17, opacity: 0.7 },

  formLabel: { fontFamily: fonts.latoBold, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.gold, opacity: 0.8, marginBottom: 8 },
  input: { backgroundColor: 'rgba(10,16,30,0.7)', borderWidth: 1, borderColor: colors.border, borderRadius: 8, color: colors.cream, fontFamily: fonts.latoLight, fontSize: 13, padding: 12 },
  textarea: { backgroundColor: 'rgba(10,16,30,0.7)', borderWidth: 1, borderColor: colors.border, borderRadius: 8, color: colors.cream, fontFamily: fonts.latoLight, fontSize: 13, padding: 12, textAlignVertical: 'top', minHeight: 90, lineHeight: 20 },

  visOpt: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.border, marginBottom: 8 },
  visOptActive: { backgroundColor: colors.goldDim, borderColor: 'rgba(201,168,76,0.4)' },
  visRadio: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  visRadioActive: { borderColor: colors.gold },
  visRadioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.gold },
  visIcon: { fontSize: 14 },
  visLabel: { fontFamily: fonts.lato, fontSize: 13, color: colors.muted, flex: 1 },
  visLabelActive: { color: colors.cream, fontFamily: fonts.latoBold },

  btnGoldFull: { backgroundColor: colors.gold, borderRadius: 8, padding: 13, alignItems: 'center', marginTop: 14 },
  btnDisabled: { opacity: 0.35 },
  btnGoldText: { fontFamily: fonts.latoBold, fontSize: 11, color: colors.navy, letterSpacing: 0.8 },
});
