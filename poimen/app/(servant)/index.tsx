import React, { useState, useEffect } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, fonts } from '@/lib/theme';
import { Card } from '@/components/ui/Card';
import { useSession } from '@/lib/auth';
import * as db from '@/lib/db';
import { useDemoMode } from '@/lib/demo';

interface Student {
  id: string;
  initials: string;
  name: string;
  canonCount: number;
  lastActivity: string | null;
}

const DEMO_STUDENTS: Student[] = [
  { id: 'demo-s1', initials: 'JM', name: 'John Mark', canonCount: 2, lastActivity: '2 days ago' },
  { id: 'demo-s2', initials: 'EM', name: 'Esther Mikhail', canonCount: 1, lastActivity: '5 days ago' },
];

export default function ServantFlockScreen() {
  const router = useRouter();
  const { user, profile } = useSession();
  const { demoMode } = useDemoMode();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(!demoMode);
  const [search, setSearch] = useState('');

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const greeting = profile?.full_name?.split(' ')[0] ?? 'Servant';

  useEffect(() => {
    if (demoMode) {
      setStudents(DEMO_STUDENTS);
    } else {
      loadStudents();
    }
  }, [user]);

  async function loadStudents() {
    if (!user) return;
    setLoading(true);
    const profiles = await db.getServantStudents(user.id);

    // Count active canons per student
    const canons = await db.getActiveCanonsByPriest(user.id);

    const canonCountByStudent: Record<string, number> = {};
    for (const c of canons) {
      canonCountByStudent[c.congregant_id] = (canonCountByStudent[c.congregant_id] ?? 0) + 1;
    }

    const mapped: Student[] = profiles.map(p => {
      const parts = (p.full_name ?? '?').split(' ');
      const init = ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
      return { id: p.id, initials: init, name: p.full_name ?? 'Unknown', canonCount: canonCountByStudent[p.id] ?? 0, lastActivity: null };
    });

    setStudents(mapped);
    setLoading(false);
  }

  const filtered = students.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        <View style={styles.topbar}>
          <View>
            <Text style={styles.pageTitle}>My Students</Text>
            <Text style={styles.pageSubtitle}>{today} · {greeting}</Text>
          </View>
          <TouchableOpacity style={styles.switchBtn} onPress={() => router.push('/(tabs)')}>
            <Text style={styles.switchBtnText}>MY VIEW</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryVal, { color: colors.cream }]}>{students.length}</Text>
            <Text style={styles.summaryLabel}>STUDENTS</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryVal, { color: colors.gold }]}>
              {students.reduce((n, s) => n + s.canonCount, 0)}
            </Text>
            <Text style={styles.summaryLabel}>CANONS ASSIGNED</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryVal, { color: colors.green }]}>
              {students.filter(s => s.canonCount > 0).length}
            </Text>
            <Text style={styles.summaryLabel}>ACTIVE</Text>
          </View>
        </View>

        <TextInput
          style={styles.search}
          placeholder="Search students..."
          placeholderTextColor="rgba(245,240,232,0.22)"
          value={search}
          onChangeText={setSearch}
        />

        <Card title={`Students (${filtered.length})`} titleIcon="◉">
          {loading ? (
            <ActivityIndicator color={colors.gold} style={{ paddingVertical: 20 }} />
          ) : filtered.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>{students.length === 0 ? 'No students yet' : 'No matches'}</Text>
              <Text style={styles.emptyBody}>
                {students.length === 0
                  ? 'Students who list you as their servant will appear here.'
                  : 'Try a different search.'}
              </Text>
            </View>
          ) : (
            filtered.map((student, i) => (
              <TouchableOpacity
                key={student.id}
                style={[styles.studentRow, i < filtered.length - 1 && styles.studentBorder]}
                onPress={() => router.push({ pathname: '/(servant)/student', params: { id: student.id, name: student.name } })}
                activeOpacity={0.7}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{student.initials}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.studentName}>{student.name}</Text>
                  <View style={styles.studentMeta}>
                    <Text style={styles.metaItem}>📜 {student.canonCount} canon{student.canonCount !== 1 ? 's' : ''}</Text>
                    {student.lastActivity && (
                      <>
                        <Text style={styles.metaDot}>·</Text>
                        <Text style={styles.metaItem}>Active {student.lastActivity}</Text>
                      </>
                    )}
                  </View>
                </View>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            ))
          )}
        </Card>

        <View style={styles.scopeNote}>
          <Text style={styles.scopeNoteText}>
            ✦ As a Sunday School servant, you can assign Bible reading and prayer canons to your students. Confession and counseling records are handled by your Father of Confession.
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.navy },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },

  topbar: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 },
  pageTitle: { fontFamily: fonts.cormorantMedium, fontSize: 28, color: colors.cream },
  pageSubtitle: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, marginTop: 4 },
  switchBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  switchBtnText: { fontFamily: fonts.latoBold, fontSize: 9, color: colors.muted, letterSpacing: 1.5 },

  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  summaryCard: { flex: 1, backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, alignItems: 'center' },
  summaryVal: { fontFamily: fonts.cormorantMedium, fontSize: 26, lineHeight: 30 },
  summaryLabel: { fontFamily: fonts.latoBold, fontSize: 8, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.muted, marginTop: 2, textAlign: 'center' },

  search: { backgroundColor: 'rgba(10,16,30,0.7)', borderWidth: 1, borderColor: colors.border, borderRadius: 8, color: colors.cream, fontFamily: fonts.latoLight, fontSize: 13, padding: 11, marginBottom: 16 },

  emptyState: { alignItems: 'center', paddingVertical: 24, gap: 6 },
  emptyTitle: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.muted },
  emptyBody: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, textAlign: 'center', lineHeight: 17, opacity: 0.7 },

  studentRow: { paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  studentBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1e3a5f', borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText: { fontFamily: fonts.cormorantMedium, fontSize: 14, color: colors.cream },
  studentName: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.cream, marginBottom: 3 },
  studentMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaItem: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted },
  metaDot: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted },
  chevron: { fontFamily: fonts.lato, fontSize: 20, color: colors.muted },

  scopeNote: { backgroundColor: 'rgba(201,168,76,0.05)', borderWidth: 1, borderColor: 'rgba(201,168,76,0.15)', borderRadius: 10, padding: 14, marginTop: 8 },
  scopeNoteText: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, lineHeight: 17, letterSpacing: 0.2 },
});
