// Support page — the App Store Support URL points here (Guideline 1.5).
// Public like /privacy: it must render without a session.
import React from 'react';
import { ScrollView, View, Text, StyleSheet, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, fonts , lazyThemed } from '@/lib/theme';
import { APP_NAME, APP_NAME_UPPER } from '@/lib/brand';

const CONTACT_EMAIL = 'bsaleeb@gmail.com';

export default function SupportScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        <Text style={styles.eyebrow}>{APP_NAME_UPPER} · SUPPORT</Text>
        <Text style={styles.title}>Help & Support</Text>
        <Text style={styles.meta}>Questions, problems, or feedback about {APP_NAME}.</Text>

        <Section title="Contact Us">
          <Body>
            Email us and we will reply, usually within two days. Please include the email address
            you sign in with and, if something went wrong, what you were doing when it happened.
          </Body>
          <Text
            style={[styles.body, styles.contact]}
            onPress={() => Linking.openURL(`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`${APP_NAME} support`)}`)}
          >
            {CONTACT_EMAIL}
          </Text>
        </Section>

        <Section title="I forgot my password">
          <Body>
            On the sign-in screen, tap "Forgot password?" and enter your email. We will send you a
            link to set a new password.
          </Body>
        </Section>

        <Section title="I forgot my PIN">
          <Body>
            Your PIN never leaves your phone, so no one — not your church, and not us — can recover or
            reset it. If it is lost, choose "I forgot my PIN — start fresh" when asked for it. You
            will get a new PIN and keep your account, but anything encrypted under the old one
            (prayer requests, pastoral notes, your journal) can no longer be opened.
          </Body>
        </Section>

        <Section title="Linking to my Father of Confession">
          <Body>
            Ask your priest or servant for their 6-character invite code, then enter it in the app
            when asked to link. You choose what they can see, and you can revoke that from your
            Profile at any time.
          </Body>
        </Section>

        <Section title="Deleting my account">
          <Body>
            In the app, open your Profile, tap "Delete my account", and type DELETE to confirm. The
            deletion is immediate and cannot be undone. The screen lists exactly what is removed,
            and what your priest keeps (his own records of pastoral encounters, no longer linked to
            any account).
          </Body>
          <Body>
            If you can no longer sign in, email us from the address on your account and we will
            delete it for you.
          </Body>
        </Section>

        <Section title="Privacy">
          <Body>
            How we collect, protect, and share your data is described in our{' '}
            <Text style={styles.link} onPress={() => router.push('/privacy')}>Privacy Policy</Text>.
          </Body>
        </Section>

        <View style={styles.footer}>
          <Text style={styles.footerText}>{APP_NAME} · Coptic Hub</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Body({ children }: { children: React.ReactNode }) {
  return <Text style={styles.body}>{children}</Text>;
}

const styles = lazyThemed(() => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.navy },
  scroll: { flex: 1 },
  content: {
    padding: 24,
    paddingBottom: 80,
    maxWidth: 680 as any,
    width: '100%' as any,
    alignSelf: 'center' as any,
  },

  eyebrow: {
    fontFamily: fonts.latoBold,
    fontSize: 9,
    letterSpacing: 2.5,
    color: colors.gold,
    marginBottom: 8,
    textTransform: 'uppercase' as any,
  },
  title: {
    fontFamily: fonts.cormorantMedium,
    fontSize: 38,
    color: colors.cream,
    marginBottom: 4,
  },
  meta: {
    fontFamily: fonts.latoLight,
    fontSize: 12,
    color: colors.muted,
    marginBottom: 36,
  },

  section: {
    marginBottom: 28,
    paddingBottom: 28,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionTitle: {
    fontFamily: fonts.latoBold,
    fontSize: 11,
    letterSpacing: 1.5,
    color: colors.gold,
    textTransform: 'uppercase' as any,
    marginBottom: 12,
  },
  body: {
    fontFamily: fonts.lato,
    fontSize: 14,
    color: colors.cream,
    lineHeight: 22,
    marginBottom: 10,
  },
  contact: {
    fontFamily: fonts.latoBold,
    color: colors.gold,
  },
  link: {
    color: colors.gold,
    textDecorationLine: 'underline',
  },

  footer: {
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: 'center' as any,
  },
  footerText: {
    fontFamily: fonts.latoBold,
    fontSize: 10,
    letterSpacing: 1.5,
    color: colors.muted,
    textTransform: 'uppercase' as any,
  },
}));
