import React, { useState } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, fonts } from '@/lib/theme';
import { Card } from '@/components/ui/Card';

type FrequencyType = 'Daily' | '3x/week' | 'Weekly' | 'Custom';

const PRESET_COMPONENTS = [
  { group: 'Prayer', items: ['Morning Agpeya', 'Evening Agpeya', 'Midnight Praises (Tasbeha)', 'Vespers (Prayer of the Veil)'] },
  { group: 'Scripture', items: ['Gospel Reading (1 chapter)', 'Epistle Reading', 'Psalm Meditation', 'Patristic Commentary (15 min)'] },
  { group: 'Fasting', items: ['Wednesday & Friday Fast', 'Full fast until 3pm', 'Apostolic Fast (full duration)'] },
  { group: 'Service', items: ['Church service (1x/month)', 'Sunday School teaching', 'Deacon\'s ministry', 'Outreach visit'] },
  { group: 'Sacramental', items: ['Divine Liturgy (weekly)', 'Monthly Confession', 'Holy Communion (fast permitting)'] },
];

const FREQ_OPTS: FrequencyType[] = ['Daily', '3x/week', 'Weekly', 'Custom'];

export default function AssignCanonScreen() {
  const router = useRouter();
  const [selectedComponent, setSelectedComponent] = useState('');
  const [customComponent, setCustomComponent] = useState('');
  const [frequency, setFrequency] = useState<FrequencyType>('Daily');
  const [customFreq, setCustomFreq] = useState('');
  const [startDate, setStartDate] = useState('Jun 8, 2026');
  const [linkedEncounter, setLinkedEncounter] = useState('');
  const [reflectionPrompt, setReflectionPrompt] = useState('');
  const [expandedGroup, setExpandedGroup] = useState<string | null>('Prayer');
  const [saved, setSaved] = useState(false);

  const component = customComponent.trim() || selectedComponent;

  function handleSave() {
    if (!component) return;
    setSaved(true);
    setTimeout(() => { setSaved(false); router.push('/(priest)/member'); }, 1200);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        <TouchableOpacity style={styles.backRow} onPress={() => router.back()}>
          <Text style={styles.backArrow}>‹</Text>
          <Text style={styles.backText}>Member</Text>
        </TouchableOpacity>

        <Text style={styles.pageTitle}>Assign Spiritual Canon</Text>
        <Text style={styles.pageSub}>Peter Botros · New stage</Text>

        {/* Member + encounter context */}
        <Card title="Context" titleIcon="◈">
          <Text style={styles.contextNote}>
            Peter's current canon: Morning Agpeya (20%), Gospel Reading (30%). He is in the Apostles' Fast — this is a good time to add or deepen prayer.
          </Text>
        </Card>

        {/* Choose a preset */}
        <Card title="Choose Component" titleIcon="📜">
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
                      <Text style={[styles.presetText, selectedComponent === item && styles.presetTextActive]}>
                        {item}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          ))}

          <View style={styles.divider} />
          <Text style={styles.orLabel}>— or enter a custom component —</Text>
          <TextInput
            style={styles.textInput}
            placeholder="E.g., Read Sayings of the Desert Fathers"
            placeholderTextColor="rgba(245,240,232,0.22)"
            value={customComponent}
            onChangeText={t => { setCustomComponent(t); if (t) setSelectedComponent(''); }}
          />
        </Card>

        {/* Frequency */}
        <Card title="Frequency" titleIcon="◇">
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
              placeholderTextColor="rgba(245,240,232,0.22)"
              value={customFreq}
              onChangeText={setCustomFreq}
            />
          )}
        </Card>

        {/* Start date */}
        <Card title="Start Date" titleIcon="⊕">
          <TextInput
            style={styles.textInput}
            value={startDate}
            onChangeText={setStartDate}
            placeholder="E.g., Jun 8, 2026"
            placeholderTextColor="rgba(245,240,232,0.22)"
          />
          <Text style={styles.fieldHint}>Defaults to tomorrow. Can be a liturgical anchor (e.g., first Sunday of the Apostles' Fast).</Text>
        </Card>

        {/* Reflection prompt (optional) */}
        <Card title="Reflection Prompt (Optional)" titleIcon="✎">
          <TextInput
            style={[styles.textInput, { minHeight: 80, textAlignVertical: 'top' }]}
            placeholder="Give the member a focus for their reflection, e.g., 'Notice where your mind wanders during prayer...'"
            placeholderTextColor="rgba(245,240,232,0.22)"
            multiline
            value={reflectionPrompt}
            onChangeText={setReflectionPrompt}
          />
          <Text style={styles.fieldHint}>This prompt is shared with the member inside the Canon panel of Poimen.</Text>
        </Card>

        {/* Link to encounter */}
        <Card title="Link to Encounter (Optional)" titleIcon="✝">
          <TextInput
            style={styles.textInput}
            placeholder="E.g., Confession Jun 7 — assigned at end of meeting"
            placeholderTextColor="rgba(245,240,232,0.22)"
            value={linkedEncounter}
            onChangeText={setLinkedEncounter}
          />
        </Card>

        {/* Preview */}
        {component ? (
          <View style={styles.previewCard}>
            <Text style={styles.previewTitle}>Canon Preview</Text>
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>Component</Text>
              <Text style={styles.previewValue}>{component}</Text>
            </View>
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>Frequency</Text>
              <Text style={styles.previewValue}>{frequency === 'Custom' ? customFreq || '—' : frequency}</Text>
            </View>
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>Starts</Text>
              <Text style={styles.previewValue}>{startDate}</Text>
            </View>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.saveBtn, !component && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={!component}
        >
          <Text style={styles.saveBtnText}>{saved ? '✓ ASSIGNED' : 'ASSIGN TO PETER'}</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.navy },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 48 },

  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  backArrow: { fontFamily: fonts.cormorant, fontSize: 22, color: colors.gold },
  backText: { fontFamily: fonts.latoLight, fontSize: 13, color: colors.muted },
  pageTitle: { fontFamily: fonts.cormorantMedium, fontSize: 26, color: colors.cream, marginBottom: 4 },
  pageSub: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, marginBottom: 20 },

  contextNote: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, lineHeight: 18 },

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

  textInput: {
    backgroundColor: 'rgba(10,16,30,0.7)', borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, color: colors.cream, fontFamily: fonts.latoLight,
    fontSize: 13, padding: 12,
  },
  fieldHint: { fontFamily: fonts.latoLight, fontSize: 10, color: colors.muted, marginTop: 6, lineHeight: 15 },

  freqRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  freqPill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: colors.border },
  freqPillActive: { backgroundColor: colors.goldDim, borderColor: colors.gold },
  freqText: { fontFamily: fonts.latoBold, fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.muted },
  freqTextActive: { color: colors.goldLight },

  previewCard: { backgroundColor: 'rgba(201,168,76,0.08)', borderWidth: 1, borderColor: 'rgba(201,168,76,0.25)', borderRadius: 12, padding: 16, marginBottom: 16 },
  previewTitle: { fontFamily: fonts.latoBold, fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: colors.gold, marginBottom: 10 },
  previewRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  previewLabel: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted },
  previewValue: { fontFamily: fonts.latoBold, fontSize: 12, color: colors.cream, flex: 1, textAlign: 'right' },

  saveBtn: { backgroundColor: colors.gold, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.35 },
  saveBtnText: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.navy, letterSpacing: 1 },
});
