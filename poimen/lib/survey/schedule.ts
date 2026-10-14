// lib/survey/schedule.ts
// When to offer the feedback survey.
//
// Deliberately free of storage and React so the rules can be tested directly
// (see schedule.test.ts) — the dates below decide whether a member is asked
// again, and getting them wrong means either nagging or silence.
//
// The rules, in order:
//   1. Never before the member has actually used the app. Opinions collected
//      on day one are about an app nobody has lived with yet.
//   2. Then every 5 days, counted from the last time they were ASKED — not
//      from the last time they answered. Dismissing has to buy the same quiet
//      as answering, or dismissing becomes the punished choice.
//   3. Never twice in one day, whatever the clock does.

export const SURVEY_INTERVAL_DAYS = 5;

// How long a new member is left alone before the first prompt. One interval:
// long enough to have formed a view, short enough to catch them while the
// first impression is still true.
export const SURVEY_FIRST_PROMPT_AFTER_DAYS = SURVEY_INTERVAL_DAYS;

export interface SurveyState {
  /** Local YYYY-MM-DD the account was created, or first seen on this device. */
  firstSeen: string | null;
  /** Local YYYY-MM-DD the survey was last shown — answered or dismissed. */
  lastPrompted: string | null;
}

const pad = (n: number) => String(n).padStart(2, '0');
export const dayStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Whole days between two local dates. Parsed at midday so a daylight-saving
// shift cannot round a boundary the wrong way.
export function daysBetween(from: string, to: string): number {
  const a = new Date(`${from}T12:00:00`).getTime();
  const b = new Date(`${to}T12:00:00`).getTime();
  return Math.floor((b - a) / 86400000);
}

export function shouldPromptSurvey(state: SurveyState, now = new Date()): boolean {
  const today = dayStr(now);

  // Rule 1 — nothing until the app has been used for an interval. A missing
  // firstSeen means we have not established that yet, so stay quiet.
  if (!state.firstSeen) return false;
  if (daysBetween(state.firstSeen, today) < SURVEY_FIRST_PROMPT_AFTER_DAYS) return false;

  // Rule 2/3 — every 5 days since the last ask, and never twice in a day.
  if (!state.lastPrompted) return true;
  return daysBetween(state.lastPrompted, today) >= SURVEY_INTERVAL_DAYS;
}

// Days until the next prompt: 0 when it is due now, null when the member is
// still inside their initial quiet period and no date can be given yet.
export function daysUntilNextPrompt(state: SurveyState, now = new Date()): number | null {
  const today = dayStr(now);
  if (!state.firstSeen) return null;
  const since = state.lastPrompted
    ? daysBetween(state.lastPrompted, today)
    : daysBetween(state.firstSeen, today);
  const target = state.lastPrompted ? SURVEY_INTERVAL_DAYS : SURVEY_FIRST_PROMPT_AFTER_DAYS;
  return Math.max(0, target - since);
}
