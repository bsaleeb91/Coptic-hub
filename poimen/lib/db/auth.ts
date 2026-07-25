// Auth adapter — the ONLY place auth talks to the backend.
// Screens and the auth provider depend on these functions and the
// backend-agnostic AuthUser / AuthSession types, never on Supabase directly.
// To swap backends, reimplement this file (and the sibling db modules).
import { supabase } from '../supabase';

export interface AuthUser {
  id: string;
  email: string | null;
}

export interface AuthSession {
  user: AuthUser;
}

export interface AuthSubscription {
  unsubscribe: () => void;
}

function mapSession(session: { user: { id: string; email?: string | null } } | null): AuthSession | null {
  if (!session) return null;
  return { user: { id: session.user.id, email: session.user.email ?? null } };
}

export async function getSession(): Promise<AuthSession | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return mapSession(session);
}

export function onAuthChange(callback: (session: AuthSession | null) => void): AuthSubscription {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(mapSession(session));
  });
  return { unsubscribe: () => subscription.unsubscribe() };
}

export async function signInWithPassword(email: string, password: string): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return { error: error?.message ?? null };
}

export type SignupRole = 'congregant' | 'servant' | 'priest';

export async function signUp(email: string, password: string, fullName: string, requestedRole: SignupRole = 'congregant'): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signUp({
    email,
    password,
    // The handle_new_user trigger applies requested_role server-side:
    // congregant/servant are granted directly, priest stays congregant
    // until an admin approves the request.
    options: { data: { full_name: fullName, requested_role: requestedRole } },
  });
  return { error: error?.message ?? null };
}

export async function signInWithOtp(email: string, redirectTo: string): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
  return { error: error?.message ?? null };
}

export async function resetPasswordForEmail(email: string, redirectTo: string): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  return { error: error?.message ?? null };
}

export async function setSessionFromTokens(accessToken: string, refreshToken: string): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
  return { error: error?.message ?? null };
}

export async function updatePassword(password: string): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.updateUser({ password });
  return { error: error?.message ?? null };
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}
