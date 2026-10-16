import React from 'react';
import { ScrollView, View, Text, StyleSheet, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts , lazyThemed } from '@/lib/theme';
import { APP_NAME, APP_NAME_UPPER } from '@/lib/brand';

const LAST_UPDATED = 'October 16, 2026';
const CONTACT_EMAIL = 'bsaleeb@gmail.com';
const BUNDLE_ID = 'com.coptic.poimen';

export default function PrivacyScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        <Text style={styles.eyebrow}>{APP_NAME_UPPER} · {BUNDLE_ID}</Text>
        <Text style={styles.title}>Privacy Policy</Text>
        <Text style={styles.meta}>Last updated: {LAST_UPDATED}</Text>

        <Section title="Overview">
          <Body>
            {APP_NAME} is a pastoral care application for Coptic Orthodox communities. It is designed
            for use by priests, servants, and congregants within a trusted parish context. We take
            the privacy of spiritual data seriously and have built this app with data minimization
            and end-to-end encryption as core principles.
          </Body>
        </Section>

        <Section title="Information We Collect">
          <Body>We collect only what is necessary to provide the app's features:</Body>
          <Bullet>Name, email address, and role (congregant, servant, or priest) provided during registration.</Bullet>
          <Bullet>Church affiliation and Father of Confession (FOC) linkage, set by you in the app.</Bullet>
          <Bullet>Spiritual wellness data (prayer frequency, fasting, scripture reading) that you choose to share with your FOC. This sharing requires your explicit consent and can be revoked at any time.</Bullet>
          <Bullet>Prayer requests you submit. The body of each prayer request is end-to-end encrypted — only you and your designated recipients can read the content. The server stores only ciphertext.</Bullet>
          <Bullet>Pastoral and encounter notes written by your priest or servant about you. These are end-to-end encrypted on their device before being stored, and restricted so only their author can open them. We hold only ciphertext and cannot read them.</Bullet>
          <Bullet>Contact details for pastoral visitation, if you enter them: phone, contact email, and home address. These are stored as written — not encrypted — and are readable by your Father of Confession once you have linked and consented.</Bullet>
          <Bullet>Family details, if you enter them: your life stage, spouse's name, and the first names and birth years of your children. Stored as written, and visible to your Father of Confession under the same consent.</Bullet>
          <Bullet>The date of your last confession, if you choose to self-report it.</Bullet>
          <Bullet>Your last active timestamp (used to display your online status to your FOC only).</Bullet>
          <Bullet>If you turn on notifications from {APP_NAME}: a code identifying each device you enable them on, your time zone, and the hour you chose to be notified. The device code is issued by our notification provider and identifies the device, not you; the time zone is needed because notifications are scheduled in your local time and our servers cannot otherwise know when your evening is.</Bullet>
          <Bullet>If you additionally turn on the canon reminder: for each day, how many things your rule asked of you and how many you marked done. Counts only — never which ones. "3 of 5" is what decides whether a reminder would be wrong to send; which five is not something we ask for.</Bullet>
        </Section>

        <Section title="What We Don't Collect">
          <Bullet>Reminders about your canon and your psalms are written by your phone, not sent to it. Your rule, your review queue and your streak are read from the device to write them and none of that leaves it. Notifications from our servers are a separate thing you switch on yourself, and they are about events your phone cannot know — an appointment your father confirmed while the app was closed.</Bullet>
          <Bullet>Which parts of your canon you kept or missed. Only daily totals are sent, and only if you turn the canon reminder on. Your Father of Confession sees the same wellness percentages as before; the daily counts are used to schedule a reminder and are not shown to anyone.</Bullet>
          <Bullet>Your confession journal and examination of conscience stay on your device. They are encrypted before being written to local storage and are never sent to our servers, so we never receive or store their content. The key that opens them is your own keypair; we hold only a copy of it that your PIN unlocks, and your PIN never reaches us.</Bullet>
        </Section>

        <Section title="End-to-End Encryption">
          <Body>
            Prayer request bodies, and the pastoral and encounter notes a priest or servant writes,
            are encrypted on the author's device before being stored. The encryption keys are
            generated on the device and are never transmitted to our servers. Even if our database
            were compromised, the content of these fields would remain unreadable.
          </Body>
          <Body>
            Your encryption keypair is protected by a PIN you set during onboarding. A backup of
            your encrypted keypair is stored in your profile so you can recover access on a new device
            using your PIN.
          </Body>
        </Section>

        <Section title="How We Use Your Information">
          <Bullet>To provide the pastoral care features of the app (flock management, prayer, canon assignment).</Bullet>
          <Bullet>To connect you with your Father of Confession, if you choose to link accounts.</Bullet>
          <Bullet>To display your spiritual wellness data to your FOC — only with your explicit consent.</Bullet>
          <Bullet>To send the notifications you have switched on, at the hour and in the time zone you set.</Bullet>
          <Bullet>We do not use your data for advertising, analytics profiling, or sale to third parties.</Bullet>
        </Section>

        <Section title="Data Sharing">
          <Body>Your data is shared only as follows:</Body>
          <Bullet>With your designated Father of Confession, for data categories you have explicitly consented to share.</Bullet>
          <Bullet>With servants assigned to your parish, for features within their role scope.</Bullet>
          <Bullet>With Supabase (our database provider) as encrypted storage. Supabase does not have access to the content of encrypted fields.</Bullet>
          <Bullet>With Expo, our notification provider, if you switch notifications on: the device code and the text of the notification itself, which is what delivery through Apple and Google requires. A notification's text names what is due — "Your appointment is confirmed", or how many things remain in your rule — so keep that in mind when choosing which to enable. No confession, journal or prayer content is ever placed in one.</Bullet>
          <Bullet>We do not share your data with any other third parties.</Bullet>
        </Section>

        <Section title="Your Choices and Rights">
          <Bullet>You may revoke FOC consent at any time from your Profile screen. This immediately removes your FOC's access to your wellness data.</Bullet>
          <Bullet>You may turn any notification off at any time from Reminders in your Profile. Switching the last one off removes that device's code from our servers.</Bullet>
          <Bullet>You may delete your account at any time in the app, from Profile → Delete my account. Deletion is immediate and cannot be undone. Your Father of Confession keeps his own records of your encounters and his notes about you, no longer linked to any account. If you can no longer sign in, email us at the address below and we will delete it for you.</Bullet>
          <Bullet>You may request a copy of your data at any time.</Bullet>
        </Section>

        <Section title="Data Retention">
          <Body>
            We retain your data for as long as your account is active. If you request account
            deletion, we will remove your personal data within 30 days, except where retention
            is required by law.
          </Body>
          <Body>
            Notifications are kept only as long as sending them requires: a queued notification is
            discarded once it is delivered or once it is too late to be worth sending, and the
            record of it is removed within 30 days.
          </Body>
        </Section>

        <Section title="Children's Privacy">
          <Body>
            {APP_NAME} is not directed to children under the age of 13. We do not knowingly
            collect personal information from children under 13. If you believe a child has
            provided us with personal information, please contact us and we will delete it promptly.
          </Body>
        </Section>

        <Section title="Changes to This Policy">
          <Body>
            We may update this Privacy Policy from time to time. The "Last updated" date at the
            top of this page reflects the most recent revision. Continued use of the app after
            changes constitutes acceptance of the updated policy.
          </Body>
        </Section>

        <Section title="Contact">
          <Body>
            If you have questions about this Privacy Policy or how we handle your data, contact us at:
          </Body>
          <Body style={styles.contact}>{CONTACT_EMAIL}</Body>
        </Section>

        <View style={styles.footer}>
          <Text style={styles.footerText}>{APP_NAME} · Coptic Hub</Text>
          <Text style={styles.footerSub}>{BUNDLE_ID}</Text>
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

function Body({ children, style }: { children: React.ReactNode; style?: any }) {
  return <Text style={[styles.body, style]}>{children}</Text>;
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bulletDot}>·</Text>
      <Text style={styles.bulletText}>{children}</Text>
    </View>
  );
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

  bulletRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
    paddingLeft: 4,
  },
  bulletDot: {
    fontFamily: fonts.latoBold,
    fontSize: 16,
    color: colors.gold,
    lineHeight: 22,
    marginTop: -1,
  },
  bulletText: {
    fontFamily: fonts.lato,
    fontSize: 14,
    color: colors.cream,
    lineHeight: 22,
    flex: 1,
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
  footerSub: {
    fontFamily: fonts.latoLight,
    fontSize: 11,
    color: colors.faint,
    marginTop: 4,
  },
}));
