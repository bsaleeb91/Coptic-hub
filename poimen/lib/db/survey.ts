// lib/db/survey.ts
// The five-question feedback survey. Anonymous by design — see the migration
// (20260907020000_feedback_survey.sql) for why: question 5 asks whether a
// member withholds things from the app, and nobody signs their name to that.
//
// Because there is no identity on a row, "have you already answered" is a
// device-local fact, not a server one. lib/survey/prompt.ts owns that.

import { supabase } from '@/lib/supabase';

export type SurveyFrequency = 'daily' | 'weekly_several' | 'weekly' | 'rarely';
export type SurveyConsistency = 'yes_clearly' | 'a_little' | 'no_change' | 'no_canon';
export type SurveyMostMissed =
  'canon' | 'confession' | 'psalms' | 'prayer' | 'journal' | 'appointments';

export interface SurveyAnswers {
  frequency: SurveyFrequency | null;
  consistency: SurveyConsistency | null;
  most_missed: SurveyMostMissed | null;
  one_change: string | null;
  withholding: boolean | null;
  withholding_detail: string | null;
}

export interface SurveyRow extends SurveyAnswers {
  id: string;
  app_version: string | null;
  platform: string | null;
  role: string | null;
  created_at: string;
}

// Coarse context only. No church and no user id: in a small parish, church
// plus role would identify a person, undoing the anonymity.
export interface SurveyContext {
  app_version: string | null;
  platform: string | null;
  role: string | null;
}

export async function submitSurvey(
  answers: SurveyAnswers,
  context: SurveyContext,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('feedback_survey').insert({
    ...answers,
    one_change: answers.one_change?.trim() || null,
    withholding_detail: answers.withholding_detail?.trim() || null,
    ...context,
  });
  return { error: error ? 'Could not send just now — please try again.' : null };
}

// Admin only; RLS returns nothing to anyone else rather than erroring.
export async function getSurveyResults(limit = 500): Promise<SurveyRow[]> {
  const { data } = await supabase
    .from('feedback_survey')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data as SurveyRow[]) ?? [];
}
