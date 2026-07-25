import React, { createContext, useContext, useEffect, useState } from 'react';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import * as db from './db';
import type { AuthSession, AuthUser, Profile, SignupRole } from './db';

// Supabase appends tokens as a URL fragment (#access_token=...&type=...) on
// the emailRedirectTo link — not query params — so this can't use the
// URL/URLSearchParams globals (unreliable across Hermes versions).
function parseAuthCallbackParams(url: string): Record<string, string> {
  const idx = url.indexOf('#') !== -1 ? url.indexOf('#') : url.indexOf('?');
  if (idx === -1) return {};
  const params: Record<string, string> = {};
  for (const pair of url.slice(idx + 1).split('&')) {
    if (!pair) continue;
    const [key, value] = pair.split('=');
    if (key) params[decodeURIComponent(key)] = decodeURIComponent(value ?? '');
  }
  return params;
}
import {
  hasLocalKeypair, getPublicKeyBase64, getOrCreateBoxKeypair,
  saveBoxKeypair, encryptKeypairWithPIN, decryptKeypairWithPIN,
  createAndSaveFreshKeypair,
} from './crypto';
import { encodeBase64 } from 'tweetnacl-util';

type PINAction = 'setup' | 'recover' | null;

type AuthContextType = {
  session: AuthSession | null;
  user: AuthUser | null;
  profile: Profile | null;
  loading: boolean;
  isPriest: boolean;
  pinAction: PINAction;
  refreshProfile: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpWithEmail: (email: string, password: string, fullName: string, requestedRole?: SignupRole) => Promise<{ error: string | null }>;
  signInWithMagicLink: (email: string) => Promise<{ error: string | null }>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  completePINSetup: (pin: string) => Promise<void>;
  completePINRecovery: (pin: string) => Promise<boolean>;
  startFreshKeypair: () => Promise<void>;
  skipPINSetup: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [pinAction, setPinAction] = useState<PINAction>(null);
  const [pendingBackup, setPendingBackup] = useState<string | null>(null);
  const router = useRouter();

  // Magic-link and password-reset emails open the app via a poimen://
  // auth-callback link carrying the new session as a URL fragment. Neither
  // flow completes without this: the link alone doesn't create a session.
  useEffect(() => {
    async function handleAuthCallback(url: string) {
      const params = parseAuthCallbackParams(url);
      if (!params.access_token || !params.refresh_token) return;
      const { error } = await db.setSessionFromTokens(params.access_token, params.refresh_token);
      if (error) return;
      // Always navigate somewhere real: the deep link's own path
      // (auth-callback) is just a token carrier, not a destination.
      router.replace(params.type === 'recovery' ? '/reset-password' : '/(tabs)');
    }
    Linking.getInitialURL().then((url) => { if (url) handleAuthCallback(url); });
    const sub = Linking.addEventListener('url', ({ url }) => handleAuthCallback(url));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    db.getSession().then((session) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else setLoading(false);
    }).catch(() => setLoading(false));

    const subscription = db.onAuthChange((session) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else { setProfile(null); setLoading(false); setPinAction(null); }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId: string) {
    const data = await db.getProfile(userId);
    setProfile(data ?? null);
    setLoading(false);
    checkKeyState(userId);
  }

  async function checkKeyState(userId: string) {
    const hasKP = await hasLocalKeypair();
    if (hasKP) {
      const existingPubKey = await db.getPublicKey(userId);
      if (!existingPubKey) {
        const pk = await getPublicKeyBase64();
        await db.upsertPublicKey(userId, pk);
      }
      const backup = await db.getKeyBackup(userId);
      if (!backup) setPinAction('setup');
    } else {
      const backup = await db.getKeyBackup(userId);
      if (backup) {
        setPendingBackup(backup);
        setPinAction('recover');
      } else {
        // No keypair and no backup — create keypair, then prompt for PIN setup.
        const kp = await getOrCreateBoxKeypair();
        await db.upsertPublicKey(userId, encodeBase64(kp.publicKey));
        setPinAction('setup');
      }
    }
  }

  async function completePINSetup(pin: string) {
    const userId = session?.user?.id;
    if (!userId) return;
    const kp = await getOrCreateBoxKeypair();
    const backup = encryptKeypairWithPIN(pin, kp);
    await db.saveKeyBackup(userId, backup);
    await db.upsertPublicKey(userId, encodeBase64(kp.publicKey));
    setPinAction(null);
  }

  async function completePINRecovery(pin: string): Promise<boolean> {
    if (!pendingBackup) return false;
    const kp = decryptKeypairWithPIN(pin, pendingBackup);
    if (!kp) return false;
    await saveBoxKeypair(kp);
    const userId = session?.user?.id;
    if (userId) await db.upsertPublicKey(userId, encodeBase64(kp.publicKey));
    setPinAction(null);
    setPendingBackup(null);
    return true;
  }

  async function startFreshKeypair() {
    const kp = await createAndSaveFreshKeypair();
    const userId = session?.user?.id;
    if (userId) await db.upsertPublicKey(userId, encodeBase64(kp.publicKey));
    setPendingBackup(null);
    setPinAction('setup');
  }

  function skipPINSetup() {
    setPinAction(null);
  }

  async function fetchProfileRefresh() {
    const userId = session?.user?.id;
    if (userId) await fetchProfile(userId);
  }

  async function signInWithEmail(email: string, password: string) {
    return db.signInWithPassword(email, password);
  }

  async function signUpWithEmail(email: string, password: string, fullName: string, requestedRole: SignupRole = 'congregant') {
    return db.signUp(email, password, fullName, requestedRole);
  }

  async function signInWithMagicLink(email: string) {
    return db.signInWithOtp(email, Linking.createURL('auth-callback'));
  }

  async function resetPassword(email: string) {
    return db.resetPasswordForEmail(email, Linking.createURL('auth-callback'));
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
      pinAction,
      refreshProfile: fetchProfileRefresh,
      signInWithEmail,
      signUpWithEmail,
      signInWithMagicLink,
      resetPassword,
      signOut,
      completePINSetup,
      completePINRecovery,
      startFreshKeypair,
      skipPINSetup,
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
