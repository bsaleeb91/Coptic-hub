// lib/survey/schedule.test.ts
// The prompt cadence decides whether a member is nagged or never asked, and it
// is the one part of the survey with no UI to reveal a mistake.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  shouldPromptSurvey, daysUntilNextPrompt, daysBetween, dayStr,
  SURVEY_INTERVAL_DAYS, SURVEY_FIRST_PROMPT_AFTER_DAYS,
} from './schedule.ts';

const at = (s: string) => new Date(`${s}T09:00:00`);

test('the interval is 5 days', () => {
  assert.equal(SURVEY_INTERVAL_DAYS, 5);
  assert.equal(SURVEY_FIRST_PROMPT_AFTER_DAYS, 5);
});

test('a brand-new member is not asked', () => {
  const state = { firstSeen: '2026-09-07', lastPrompted: null };
  assert.equal(shouldPromptSurvey(state, at('2026-09-07')), false);
  assert.equal(shouldPromptSurvey(state, at('2026-09-10')), false);  // day 3
  assert.equal(shouldPromptSurvey(state, at('2026-09-11')), false);  // day 4
});

test('the first prompt lands on day 5, not before', () => {
  const state = { firstSeen: '2026-09-07', lastPrompted: null };
  assert.equal(daysBetween('2026-09-07', '2026-09-12'), 5);
  assert.equal(shouldPromptSurvey(state, at('2026-09-12')), true);
});

test('an unknown first-seen date stays silent rather than guessing', () => {
  assert.equal(shouldPromptSurvey({ firstSeen: null, lastPrompted: null }), false);
  assert.equal(daysUntilNextPrompt({ firstSeen: null, lastPrompted: null }), null);
});

test('after being asked, it waits a full 5 days', () => {
  const state = { firstSeen: '2026-08-01', lastPrompted: '2026-09-07' };
  for (const d of ['2026-09-07', '2026-09-08', '2026-09-10', '2026-09-11']) {
    assert.equal(shouldPromptSurvey(state, at(d)), false, d);
  }
  assert.equal(shouldPromptSurvey(state, at('2026-09-12')), true);
});

test('dismissing buys the same quiet as answering', () => {
  // lastPrompted is written on SHOW, not on submit — otherwise a member who
  // dismisses is asked again tomorrow and dismissing becomes the punished
  // choice. Both paths land on the same state, so both wait 5 days.
  const answered = { firstSeen: '2026-08-01', lastPrompted: '2026-09-07' };
  const dismissed = { firstSeen: '2026-08-01', lastPrompted: '2026-09-07' };
  assert.equal(shouldPromptSurvey(answered, at('2026-09-11')), shouldPromptSurvey(dismissed, at('2026-09-11')));
  assert.equal(shouldPromptSurvey(answered, at('2026-09-12')), shouldPromptSurvey(dismissed, at('2026-09-12')));
});

test('never asked twice in one day, however often the app is opened', () => {
  const state = { firstSeen: '2026-08-01', lastPrompted: dayStr(new Date()) };
  assert.equal(shouldPromptSurvey(state, new Date()), false);
});

test('a long absence does not queue up a backlog of prompts', () => {
  // Away for a year: still exactly one prompt due, not 73.
  const state = { firstSeen: '2025-09-07', lastPrompted: '2025-09-12' };
  assert.equal(shouldPromptSurvey(state, at('2026-09-07')), true);
  assert.equal(daysUntilNextPrompt(state, at('2026-09-07')), 0);
});

test('countdown reports the days remaining, and 0 when due', () => {
  const fresh = { firstSeen: '2026-09-07', lastPrompted: null };
  assert.equal(daysUntilNextPrompt(fresh, at('2026-09-07')), 5);
  assert.equal(daysUntilNextPrompt(fresh, at('2026-09-10')), 2);
  assert.equal(daysUntilNextPrompt(fresh, at('2026-09-12')), 0);

  const asked = { firstSeen: '2026-08-01', lastPrompted: '2026-09-07' };
  assert.equal(daysUntilNextPrompt(asked, at('2026-09-09')), 3);
});

test('a clock that goes backwards does not trigger a prompt', () => {
  // Device date set to before the last prompt: daysBetween goes negative,
  // which must read as "not yet", never as "overdue".
  const state = { firstSeen: '2026-08-01', lastPrompted: '2026-09-07' };
  assert.equal(shouldPromptSurvey(state, at('2026-09-01')), false);
});
