import React, { useState } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, fonts } from '@/lib/theme';
import { Card } from '@/components/ui/Card';

type EncounterType = 'confession' | 'counseling' | 'advice' | 'visit' | 'phone' | 'group';

const ENCOUNTER_TYPES: { value: EncounterType; label: string; desc: string }[] = [
  { value: 'confession', label: '✝ Holy Confession', desc: 'Sacramental confession' },
  { value: 'counseling', label: '◎ Counseling Session', desc: 'In-person pastoral guidance' },
  { value: 'advice', label: '◇ Spiritual Advice', desc: 'Brief direction or answer' },
  { value: 'visit', label: '⊕ Pastoral Visit', desc: 'Home or hospital visit' },
  { value: 'phone', label: '◈ Phone / Video Call', desc: 'Remote check-in' },
  { value: 'group', label: '◉ Group Encounter', desc: 'Retreat, group study, etc.' },
];

const MEMBERS_FAKE = [
  'Peter Botros', 'Michael Hanna', 'Sara Girgis', 'Mary Mikhail',
  'Andrew George', 'Christine Naguib',
];

const OUTCOMES: string[] = [
  'Canon assigned', 'Canon adjusted', 'Prayer offered', 'Scripture given',
  'Referral made', 'Follow-up scheduled', 'No action needed',
];

export default function LogEncounterScreen() {
  const router = useRouter();

  const [encounterType, setEncounterType] = useState<EncounterType>('confession');
  const [encounterDate, setEncounterDate] = useState('Jun 7, 2026');
  const [member, setMember] = useState('Peter Botros');
  const [memberSearch, setMemberSearch] = useState('Peter Botros');
  const [showMemberList, setShowMemberList] = useState(false);
  const [memberNote, setMemberNote] = useState('');
  const [privateNote, setPrivateNote] = useState('');
  const [selectedOutcomes, setSelectedOutcomes] = useState<string[]>([]);
  const [followUpDate, setFollowUpDate] = useState('');
  const [saved, setSaved] = useState(false);

  const filteredMembers = MEMBERS_FAKE.filter(m =>
    m.toLowerCase().includes(memberSearch.toLowerCase())
  );

  function toggleOutcome(o: string) {
    setSelectedOutcomes(prev =>
      prev.includes(o) ? prev.filter(x => x !== o) : [...prev, o]
    );
  }

  function handleSave() {
    setSaved(true);
    setTimeout(() => { setSaved(false); router.push('/(priest)'); }, 1300);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        <TouchableOpacity style={styles.backRow} onPress={() => router.back()}>
          <Text style={styles.backArrow}>‹</Text>
          <Text style={styles.backText}>My Flock</Text>
        </TouchableOpacity>

        <Text style={styles.pageTitle}>Log Pastoral Encounter</Text>
        <Text style={styles.pageSub}>Sunday, June 7, 2026 · Apostles' Fast</Text>

        {/* Member */}
        <Card title="Member" titleIcon="◉">
          <TextInput
            style={styles.textInput}
            value={memberSearch}
            onChangeText={t => { setMemberSearch(t); setShowMemberList(true); }}
            onFocus={() => setShowMemberList(true)}
            placeholder="Search member..."
            placeholderTextColor="rgba(245,240,232,0.22)"
          />
          {showMemberList && filteredMembers.length > 0 && (
            <View style={styles.memberDropdown}>
              {filteredMembers.map(m => (
                <TouchableOpacity
                  key={m}
                  style={styles.memberOption}
                  onPress={() => { setMember(m); setMemberSearch(m); setShowMemberList(false); }}
                >
                  <Text style={[styles.memberOptionText, member === m && styles.memberOptionTextActive]}>
                    {m}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </Card>

        {/* Encounter type */}
        <Card title="Encounter Type" titleIcon="◇">
          {ENCOUNTER_TYPES.map(opt => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.typeRow, encounterType === opt.value && styles.typeRowActive]}
              onPress={() => setEncounterType(opt.value)}
            >
              <View style={[styles.typeRadio, encounterType === opt.value && styles.typeRadioActive]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.typeLabel, encounterType === opt.value && styles.typeLabelActive]}>
                  {opt.label}
                </Text>
                <Text style={styles.typeDesc}>{opt.desc}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </Card>

        {/* Date */}
        <Card title="Date" titleIcon="⊕">
          <TextInput
            style={styles.textInput}
            value={encounterDate}
            onChangeText={setEncounterDate}
            placeholder="E.g., Jun 7, 2026"
            placeholderTextColor="rgba(245,240,232,0.22)"
          />
        </Card>

        {/* Member-visible note */}
        <Card title="Note to Member (Visible to them)" titleIcon="◈">
          <TextInput
            style={[styles.textInput, { minHeight: 90, textAlignVertical: 'top' }]}
            placeholder="E.g., We discussed the importance of the Agpeya as a rhythm of prayer. Encouraged to be consistent and patient..."
            placeholderTextColor="rgba(245,240,232,0.22)"
            multiline
            value={memberNote}
            onChangeText={setMemberNote}
          />
          <Text style={styles.fieldHint}>This note appears in the member's Pastoral Journey timeline.</Text>
        </Card>

        {/* Private FOC note */}
        <Card title="Private Pastoral Notes (FOC Only)" titleIcon="✎">
          <View style={styles.privacyNote}>
            <Text style={styles.privacyNoteText}>✦ Never visible to the member.</Text>
          </View>
          <TextInput
            style={[styles.textInput, { minHeight: 90, textAlignVertical: 'top' }]}
            placeholder="E.g., Peter is struggling with anger toward his father. Underlying resentment — suggested reading the parable of the prodigal son..."
            placeholderTextColor="rgba(245,240,232,0.22)"
            multiline
            value={privateNote}
            onChangeText={setPrivateNote}
          />
        </Card>

        {/* Outcomes */}
        <Card title="Outcomes" titleIcon="✦">
          <View style={styles.outcomesGrid}>
            {OUTCOMES.map(o => (
              <TouchableOpacity
                key={o}
                style={[styles.outcomePill, selectedOutcomes.includes(o) && styles.outcomePillActive]}
                onPress={() => toggleOutcome(o)}
              >
                <Text style={[styles.outcomePillText, selectedOutcomes.includes(o) && styles.outcomePillTextActive]}>
                  {o}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* Follow-up */}
        <Card title="Schedule Follow-Up (Optional)" titleIcon="⊕">
          <TextInput
            style={styles.textInput}
            placeholder="E.g., Jun 29 after Feast of Peter & Paul Liturgy"
            placeholderTextColor="rgba(245,240,232,0.22)"
            value={followUpDate}
            onChangeText={setFollowUpDate}
          />
          <Text style={styles.fieldHint}>Will appear as a reminder in your Flock view.</Text>
        </Card>

        {/* Confession-specific notice */}
        {encounterType === 'confession' && (
          <View style={styles.confessionNotice}>
            <Text style={styles.confessionNoticeTitle}>✝ Sacramental Privacy</Text>
            <Text style={styles.confessionNoticeBody}>
              Confession content is protected by holy seal. Only the date and encounter type are recorded here. No content from the member's examination is stored or transmitted.
            </Text>
          </View>
        )}

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveBtnText}>{saved ? '✓ ENCOUNTER LOGGED' : 'LOG ENCOUNTER'}</Text>
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

  textInput: {
    backgroundColor: 'rgba(10,16,30,0.7)', borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, color: colors.cream, fontFamily: fonts.latoLight,
    fontSize: 13, padding: 12,
  },
  fieldHint: { fontFamily: fonts.latoLight, fontSize: 10, color: colors.muted, marginTop: 6, lineHeight: 15 },

  memberDropdown: {
    backgroundColor: colors.navyDark, borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, marginTop: 4, overflow: 'hidden',
  },
  memberOption: { padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  memberOptionText: { fontFamily: fonts.latoLight, fontSize: 13, color: colors.muted },
  memberOptionTextActive: { color: colors.goldLight, fontFamily: fonts.latoBold },

  typeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 10, paddingHorizontal: 4, borderRadius: 8 },
  typeRowActive: { backgroundColor: colors.goldDim },
  typeRadio: { width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: colors.border, marginTop: 2 },
  typeRadioActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  typeLabel: { fontFamily: fonts.latoBold, fontSize: 12, color: colors.muted, marginBottom: 1 },
  typeLabelActive: { color: colors.cream },
  typeDesc: { fontFamily: fonts.latoLight, fontSize: 10, color: colors.muted },

  privacyNote: { backgroundColor: 'rgba(201,168,76,0.07)', borderWidth: 1, borderColor: 'rgba(201,168,76,0.15)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 10 },
  privacyNoteText: { fontFamily: fonts.latoLight, fontSize: 10, color: colors.muted, letterSpacing: 0.3 },

  outcomesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  outcomePill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: colors.border },
  outcomePillActive: { backgroundColor: colors.goldDim, borderColor: colors.gold },
  outcomePillText: { fontFamily: fonts.latoBold, fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: colors.muted },
  outcomePillTextActive: { color: colors.goldLight },

  confessionNotice: {
    backgroundColor: 'rgba(201,168,76,0.08)', borderWidth: 1, borderColor: 'rgba(201,168,76,0.3)',
    borderRadius: 12, padding: 16, marginBottom: 16,
  },
  confessionNoticeTitle: { fontFamily: fonts.latoBold, fontSize: 12, color: colors.gold, marginBottom: 6 },
  confessionNoticeBody: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, lineHeight: 18 },

  saveBtn: { backgroundColor: colors.gold, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  saveBtnText: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.navy, letterSpacing: 1 },
});
