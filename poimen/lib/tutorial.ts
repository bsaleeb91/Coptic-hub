import { PRIVACY_COPY } from '@/lib/privacy-copy';

export type TutorialStep = {
  id: string;
  title: string;
  body: string;
  position: 'top' | 'bottom' | 'center';
};

export type TutorialRole = 'congregant' | 'priest' | 'servant';

// Tutorials attached to one part of the app rather than to a role. They run the
// first time that part is opened, long after the role tour has been taken and
// forgotten, and can be replayed from inside it.
export type TutorialModule = 'confession';

// What the store keys a "seen" flag by. Roles keep their bare names for
// backwards compatibility; modules are prefixed.
export type TutorialKey = TutorialRole | `module:${TutorialModule}`;

export const TUTORIAL_STEPS: Record<TutorialRole, TutorialStep[]> = {
  congregant: [
    {
      id: 'cong-welcome',
      title: 'Welcome to Nepsis',
      body: 'Nepsis is your private spiritual care companion. Your Father of Confession can see your journey here, but only what you choose to share.',
      position: 'center',
    },
    {
      id: 'cong-dashboard',
      title: 'Your Dashboard',
      body: 'This is your spiritual overview. Your pastoral timeline, upcoming feasts, and spiritual vitals all live here.',
      position: 'top',
    },
    {
      id: 'cong-confession',
      title: 'Confession Preparation',
      body: 'Use the Confession tab to work through an examination of conscience before meeting your Father of Confession. What you write is encrypted on this device and never sent to our servers.',
      position: 'bottom',
    },
    {
      id: 'cong-journal',
      title: 'Journal',
      body: 'Track your daily spiritual practices and write personal reflections. Share them with your priest or keep them private.',
      position: 'bottom',
    },
    {
      id: 'cong-prayer',
      title: 'Prayer Requests',
      body: 'Submit prayer requests to your Father of Confession. You control exactly who can see each request.',
      position: 'bottom',
    },
    {
      id: 'cong-canon',
      title: 'Your Canon',
      body: 'Your assigned spiritual practices appear here. Mark them complete each day and track your progress over time.',
      position: 'bottom',
    },
    {
      id: 'cong-privacy',
      title: PRIVACY_COPY.onboardingTitle,
      body: PRIVACY_COPY.onboarding,
      position: 'center',
    },
  ],

  priest: [
    {
      id: 'priest-welcome',
      title: 'Welcome, Father',
      body: 'This is your pastoral care portal. You can see the spiritual health of each member in your flock and keep private pastoral notes.',
      position: 'center',
    },
    {
      id: 'priest-flock',
      title: 'My Flock',
      body: 'Your members are sorted by days since their last confession. Members flagged in red are overdue for a visit.',
      position: 'top',
    },
    {
      id: 'priest-member',
      title: 'Member Detail',
      body: 'Tap any member to see their full profile: spiritual vitals, canon progress, prayer requests, and your private pastoral notes.',
      position: 'bottom',
    },
    {
      id: 'priest-encounter',
      title: 'Log Encounters',
      body: "After a confession, visit, or call — log it here. Members can see a summary; your private note stays visible only to you.",
      position: 'bottom',
    },
    {
      id: 'priest-canon',
      title: 'Assign Canon',
      body: 'Assign spiritual practices to members from a curated set, or write a custom one. Members see and complete these in their Canon tab.',
      position: 'bottom',
    },
  ],

  servant: [
    {
      id: 'servant-welcome',
      title: 'Welcome',
      body: "This is your Sunday school servant portal. You can track your students' spiritual canon and keep private notes on their growth.",
      position: 'center',
    },
    {
      id: 'servant-students',
      title: 'My Students',
      body: 'Your students are listed here with their canon completion counts. A low completion rate is a signal to follow up.',
      position: 'top',
    },
    {
      id: 'servant-student',
      title: 'Student Detail',
      body: "Tap any student to see their assigned canons, completion rate, and prayer requests they've shared with you.",
      position: 'bottom',
    },
    {
      id: 'servant-assign',
      title: 'Assign Canon',
      body: 'You can assign Prayer and Scripture canons to students. Fasting, Service, and Sacramental canons are reserved for the Father of Confession.',
      position: 'bottom',
    },
  ],
};

// ─── Module tutorials ────────────────────────────────────────────────────────

// The Confession tab is the one part of the app a newcomer can open and not
// know what to do with. It has four entry points across two sections, and the
// order they are meant to be used in — journal as life happens, examination
// before you go, notes while you are there — is not visible from the cards
// themselves. Six steps, one per thing worth knowing, in the order someone
// actually meets them.
//
// Two rules govern this copy. It never describes the tab as a substitute for
// the sacrament: Confession is administered by a priest, and what is here only
// prepares someone to receive it. And it never overstates the privacy — the
// one thing that does leave the phone (the date) is named in the same breath
// as the things that do not.
export const MODULE_TUTORIALS: Record<TutorialModule, TutorialStep[]> = {
  confession: [
    {
      id: 'conf-what',
      title: 'Coming prepared',
      body:
        'Confession is a sacrament, and it happens with your Father of Confession — not here. ' +
        'What this tab does is carry what you want to say, so that you arrive with it gathered ' +
        'rather than trying to remember it while you kneel.',
      position: 'center',
    },
    {
      id: 'conf-journal',
      title: 'Start with the journal',
      body:
        'Most of what you will want to confess happens on an ordinary Tuesday and is forgotten ' +
        'by Saturday. Write it down when it happens — a line is enough. Everything you log waits ' +
        'for you in your confession notes.',
      position: 'bottom',
    },
    {
      id: 'conf-examination',
      title: 'Then the examination, before you go',
      body:
        'The examination of conscience walks you through each area of life with questions to ' +
        'consider. Anything you mark there joins your notes alongside the journal entries. ' +
        'You can return to it as often as you like — it is saved between confessions.',
      position: 'bottom',
    },
    {
      id: 'conf-guidance',
      title: 'Nothing particular in mind?',
      body:
        'That happens, and it is not a reason to stay away. At the foot of the journal there is ' +
        'a place for questions — a struggle you cannot name yet, or a topic you want your father ' +
        'to speak to. They wait in your notes with everything else.',
      position: 'bottom',
    },
    {
      id: 'conf-session',
      title: 'In the confessional',
      body:
        'Open My confession notes and everything you have gathered is in one list. Tap each item ' +
        'as you speak it, so you can see what is left without losing your place.',
      position: 'bottom',
    },
    {
      id: 'conf-history',
      title: 'Looking back',
      body:
        'Each time you record a confession, your notes are kept — on this phone only — so you ' +
        'can see later what keeps returning and what has fallen away. It is there to be read in ' +
        'a year, not to keep score this week.',
      position: 'bottom',
    },
    {
      id: 'conf-privacy',
      title: 'What your father can see',
      body:
        'Only the date. Your journal, your examination and your notes are encrypted with a key ' +
        'that stays on this phone — they are not sent anywhere, and no one else can read them, ' +
        'including us. The date is shared so your priest knows when you last came.',
      position: 'center',
    },
  ],
};
