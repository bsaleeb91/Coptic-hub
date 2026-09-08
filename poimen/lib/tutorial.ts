export type TutorialStep = {
  id: string;
  title: string;
  body: string;
  position: 'top' | 'bottom' | 'center';
};

export const TUTORIAL_STEPS: Record<'congregant' | 'priest' | 'servant', TutorialStep[]> = {
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
      body: 'Use the Confession tab to work through an examination of conscience before meeting your Father of Confession. Nothing you write here is ever saved or sent.',
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
