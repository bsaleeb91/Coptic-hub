// lib/db/feedback.ts
// In-app feedback. Members send it; only admins read it (see the RLS in
// 20260907_app_feedback.sql — priests and servants deliberately cannot, so a
// member can report a problem without it landing in a pastoral relationship).

import { supabase } from '@/lib/supabase';

export type FeedbackCategory = 'bug' | 'idea' | 'other';
export type FeedbackStatus = 'new' | 'read' | 'resolved';

export interface Feedback {
  id: string;
  user_id: string | null;
  category: FeedbackCategory;
  message: string;
  app_version: string | null;
  platform: string | null;
  role: string | null;
  status: FeedbackStatus;
  created_at: string;
}

// What is attached alongside the message. Gathered by the screen so it can be
// shown to the member before they send — see app/feedback.tsx.
export interface FeedbackContext {
  app_version: string | null;
  platform: string | null;
  role: string | null;
}

export async function submitFeedback(
  userId: string,
  category: FeedbackCategory,
  message: string,
  context: FeedbackContext,
): Promise<{ error: string | null }> {
  const body = message.trim();
  if (!body) return { error: 'Please write something first.' };
  const { error } = await supabase.from('app_feedback').insert({
    user_id: userId,
    category,
    message: body,
    ...context,
  });
  // The message is the member's own words — surface that the send failed, not
  // the raw Postgres text, which would mean nothing to them.
  return { error: error ? 'Could not send just now — please try again.' : null };
}

// The member's own reports, newest first. RLS scopes this to the caller.
export async function getMyFeedback(userId: string): Promise<Feedback[]> {
  const { data } = await supabase
    .from('app_feedback')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return (data as Feedback[]) ?? [];
}

// Admin inbox. RLS returns nothing to a non-admin rather than erroring, so a
// non-admin caller simply sees an empty list.
export async function getAllFeedback(limit = 100): Promise<Feedback[]> {
  const { data } = await supabase
    .from('app_feedback')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data as Feedback[]) ?? [];
}

export async function setFeedbackStatus(id: string, status: FeedbackStatus): Promise<boolean> {
  const { error } = await supabase.from('app_feedback').update({ status }).eq('id', id);
  return !error;
}
