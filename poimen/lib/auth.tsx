import React, { createContext, useContext, useEffect, useState } from 'react';
import * as db from './db';
import type { AuthSession, AuthUser, Profile, SignupRole } from './db';
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
    return db.signInWithOtp(email);
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
