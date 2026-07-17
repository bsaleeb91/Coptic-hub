import React, { useState } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors, fonts , lazyThemed } from '@/lib/theme';
import { Card } from '@/components/ui/Card';
import { ClipboardIcon, CalendarIcon, PencilIcon } from '@/components/ui/TabIcons';
import { useSession } from '@/lib/auth';
import * as db from '@/lib/db';
import { useDemoMode } from '@/lib/demo';

type FrequencyType = 'Daily' | '3x/week' | 'Weekly' | 'Custom';

// Servants assign Prayer + Scripture only
const PRESET_COMPONENTS = [
  {
    group: 'Prayer',
    items: [
      'Morning Agpeya',
      'Evening Agpeya',
      'Short morning prayer (Our Father + Glory Be)',
      'Intercessory prayer for family',
      'Gratitude prayer before bed',
    ],
  },
  {
    group: 'Scripture',
    items: [
      'Gospel Reading (1 chapter)',
      'Psalm Reading (1 psalm)',
      'Proverbs Reading (1 chapter)',
      'Read a passage and write one reflection',
      'Memorize one Bible verse per week',
    ],
  },
];

const FREQ_OPTS: FrequencyType[] = ['Daily', '3x/week', 'Weekly', 'Custom'];

export default function ServantAssignCanonScreen() {
  const router = useRouter();
  const { studentId, studentName } = useLocalSearchParams<{ studentId: string; studentName: string }>();
  const { user } = useSession();
  const { demoMode } = useDemoMode();

  const [selectedComponent, setSelectedComponent] = useState('');
  const [customComponent, setCustomComponent] = useState('');
  const [frequency, setFrequency] = useState<FrequencyType>('Daily');
  const [customFreq, setCustomFreq] = useState('');
  const [startDate, setStartDate] = useState(tomorrow());
  const [reflectionPrompt, setReflectionPrompt] = useState('');
  const [expandedGroup, setExpandedGroup] = useState<string | null>('Prayer');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showScopeInfo, setShowScopeInfo] = useState(false);

  const component = customComponent.trim() || selectedComponent;
  const displayName = studentName ?? 'Student';
  const firstName = displayName.split(' ')[0];

  async function handleSave() {
    if (!component || saving) return;
    if (demoMode) {
      setSaved(true);
      setTimeout(() => router.back(), 1300);
      return;
    }
    setSaving(true);
    await db.insertCanon({
      congregant_id: studentId,
      priest_id: user!.id,
      component,
      frequency: frequency === 'Custom' ? customFreq || frequency : frequency,
      start_date: startDate,
      reflection_prompt: reflectionPrompt.trim() || null,
      active: true,
    });
    setSaved(true);
    setSaving(false);
    setTimeout(() => router.back(), 1300);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        <TouchableOpacity style={styles.backRow} onPress={() => router.back()}>
          <Text style={styles.backArrow}>‹</Text>
          <Text style={styles.backText}>{displayName}</Text>
        </TouchableOpacity>

        <Text style={styles.pageTitle}>Assign Canon</Text>
        <View style={styles.pageSubRow}>
          <Text style={styles.pageSub}>{displayName} · Sunday School Student</Text>
          <TouchableOpacity onPress={() => setShowScopeInfo(true)} style={styles.infoBtn}>
            <Text style={styles.infoBtnText}>Prayer & Scripture only  ⓘ</Text>
          </TouchableOpacity>
        </View>

        <Modal visible={showScopeInfo} transparent animationType="fade" onRequestClose={() => setShowScopeInfo(false)}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowScopeInfo(false)}>
            <View style={styles.tooltipBox}>
              <Text style={styles.tooltipTitle}>Why only Prayer & Scripture?</Text>
              <Text style={styles.tooltipBody}>
                As a Sunday School servant, you can assign Prayer and Bible Reading canons to your students.{'\n\n'}Fasting, Confession, and advanced spiritual practices are assigned by the Father of Confession.
              </Text>
              <TouchableOpacity onPress={() => setShowScopeInfo(false)}>
                <Text style={styles.tooltipDismiss}>Got it</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        <Card title="Choose Practice" titleIconNode={<ClipboardIcon size={16} color={colors.gold} />}>
          {PRESET_COMPONENTS.map(group => (
            <View key={group.group}>
              <TouchableOpacity
                style={styles.groupHeader}
                onPress={() => setExpandedGroup(expandedGroup === group.group ? null : group.group)}
              >
                <Text style={styles.groupTitle}>{group.group}</Text>
                <Text style={styles.groupChevron}>{expandedGroup === group.group ? '▾' : '›'}</Text>
              </TouchableOpacity>
              {expandedGroup === group.group && (
                <View style={styles.groupItems}>
                  {group.items.map(item => (
                    <TouchableOpacity
                      key={item}
                      style={[styles.presetItem, selectedComponent === item && styles.presetItemActive]}
                      onPress={() => { setSelectedComponent(item); setCustomComponent(''); }}
                    >
                      <View style={[styles.presetDot, selectedComponent === item && styles.presetDotActive]} />
                      <Text style={[styles.presetText, selectedComponent === item && styles.presetTextActive]}>{item}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          ))}
          <View style={styles.divider} />
          <Text style={styles.orLabel}>— or enter a custom practice —</Text>
          <TextInput
            style={styles.textInput}
            placeholder="E.g., Read one Bible story each evening with a parent"
            placeholderTextColor={colors.faint}
            value={customComponent}
            onChangeText={t => { setCustomComponent(t); if (t) setSelectedComponent(''); }}
          />
        </Card>

        <Card title="Frequency" titleIconNode={<CalendarIcon size={16} color={colors.gold} />}>
          <View style={styles.freqRow}>
            {FREQ_OPTS.map(opt => (
              <TouchableOpacity
                key={opt}
                style={[styles.freqPill, frequency === opt && styles.freqPillActive]}
                onPress={() => setFrequency(opt)}
              >
                <Text style={[styles.freqText, frequency === opt && styles.freqTextActive]}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {frequency === 'Custom' && (
            <TextInput
              style={[styles.textInput, { marginTop: 10 }]}
              placeholder="Describe the frequency..."
              placeholderTextColor={colors.faint}
              value={customFreq}
              onChangeText={setCustomFreq}
            />
          )}
        </Card>

        <Card title="Start Date" titleIconNode={<CalendarIcon size={16} color={colors.gold} />}>
          <TextInput
            style={styles.textInput}
            value={startDate}
            onChangeText={setStartDate}
            placeholder="E.g., Jun 8, 2026"
            placeholderTextColor={colors.faint}
          />
        </Card>

        <Card title="Encouragement Note (Optional)" titleIconNode={<PencilIcon size={16} color={colors.gold} />}>
          <TextInput
            style={[styles.textInput, { minHeight: 70, textAlignVertical: 'top' }]}
            placeholder={`Leave an encouraging note for ${firstName}...`}
            placeholderTextColor={colors.faint}
            multiline
            value={reflectionPrompt}
            onChangeText={setReflectionPrompt}
          />
          <Text style={styles.fieldHint}>Visible to the student in their Canon panel.</Text>
        </Card>

        <TouchableOpacity
          style={[styles.saveBtn, (!component || saving) && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={!component || saving}
        >
          {saving
            ? <ActivityIndicator color={colors.navy} />
            : <Text style={styles.saveBtnText}>{saved ? `✓ ASSIGNED TO ${firstName.toUpperCase()}` : `ASSIGN TO ${firstName.toUpperCase()}`}</Text>
          }
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

function tomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const styles = lazyThemed(() => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.navy },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 48 },

  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  backArrow: { fontFamily: fonts.cormorant, fontSize: 22, color: colors.gold },
  backText: { fontFamily: fonts.latoLight, fontSize: 13, color: colors.muted },
  pageTitle: { fontFamily: fonts.cormorantMedium, fontSize: 26, color: colors.cream, marginBottom: 4 },
  pageSubRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  pageSub: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted },
  infoBtn: {},
  infoBtnText: { fontFamily: fonts.latoBold, fontSize: 9, letterSpacing: 1, color: colors.muted, opacity: 0.6 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  tooltipBox: { backgroundColor: '#0e1929', borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 24, width: '100%' },
  tooltipTitle: { fontFamily: fonts.cormorantMedium, fontSize: 18, color: colors.cream, marginBottom: 12 },
  tooltipBody: { fontFamily: fonts.latoLight, fontSize: 13, color: colors.muted, lineHeight: 20, marginBottom: 20 },
  tooltipDismiss: { fontFamily: fonts.latoBold, fontSize: 11, letterSpacing: 1.5, color: colors.gold, textAlign: 'center' },

  groupHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  groupTitle: { fontFamily: fonts.latoBold, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.muted },
  groupChevron: { fontFamily: fonts.lato, fontSize: 14, color: colors.muted },
  groupItems: { paddingTop: 8, paddingBottom: 4 },
  presetItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, paddingHorizontal: 4 },
  presetItemActive: { backgroundColor: colors.goldDim, borderRadius: 8, paddingHorizontal: 8 },
  presetDot: { width: 7, height: 7, borderRadius: 4, borderWidth: 1, borderColor: colors.border },
  presetDotActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  presetText: { fontFamily: fonts.latoLight, fontSize: 13, color: colors.muted },
  presetTextActive: { color: colors.cream, fontFamily: fonts.lato },

  divider: { height: 1, backgroundColor: colors.border, marginVertical: 14 },
  orLabel: { fontFamily: fonts.latoBold, fontSize: 9, letterSpacing: 1.5, color: colors.muted, textAlign: 'center', textTransform: 'uppercase', marginBottom: 10 },

  textInput: { backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, borderRadius: 8, color: colors.cream, fontFamily: fonts.latoLight, fontSize: 13, padding: 12 },
  fieldHint: { fontFamily: fonts.latoLight, fontSize: 10, color: colors.muted, marginTop: 6, lineHeight: 15 },

  freqRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  freqPill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: colors.border },
  freqPillActive: { backgroundColor: colors.goldDim, borderColor: colors.gold },
  freqText: { fontFamily: fonts.latoBold, fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.muted },
  freqTextActive: { color: colors.goldLight },

  saveBtn: { backgroundColor: colors.gold, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.35 },
  saveBtnText: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.navy, letterSpacing: 1 },
}));
