import React, { createContext, useContext, useEffect, useState } from 'react';
import * as db from './db';
import type { AuthSession, AuthUser, Profile } from './db';

type AuthContextType = {
  session: AuthSession | null;
  user: AuthUser | null;
  profile: Profile | null;
  loading: boolean;
  isPriest: boolean;
  refreshProfile: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpWithEmail: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>;
  signInWithMagicLink: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    db.getSession().then((session) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else setLoading(false);
    }).catch(() => setLoading(false));

    const subscription = db.onAuthChange((session) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else { setProfile(null); setLoading(false); }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId: string) {
    const data = await db.getProfile(userId);
    setProfile(data ?? null);
    setLoading(false);
  }

  async function signInWithEmail(email: string, password: string) {
    return db.signInWithPassword(email, password);
  }

  async function signUpWithEmail(email: string, password: string, fullName: string) {
    return db.signUp(email, password, fullName);
  }

  async function signInWithMagicLink(email: string) {
    return db.signInWithOtp(email);
  }

  async function refreshProfile() {
    const userId = session?.user?.id;
    if (userId) await fetchProfile(userId);
  }

  async function signOut() {
    await db.signOut();
  }

  return (
    <AuthContext.Provider value={{
      session,
      user: session?.user ?? null,
      profile,
      loading,
      isPriest: profile?.role === 'priest' || profile?.role === 'admin',
      refreshProfile,
      signInWithEmail,
      signUpWithEmail,
      signInWithMagicLink,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useSession must be used inside AuthProvider');
  return ctx;
}
