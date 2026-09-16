import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { TutorialOverlay } from '@/components/ui/TutorialOverlay';
import {
  TUTORIAL_STEPS, MODULE_TUTORIALS,
  TutorialStep, TutorialRole, TutorialModule, TutorialKey,
} from '@/lib/tutorial';
import { hasTutorialBeenSeen, markTutorialSeen, resetTutorial as resetTutorialStore } from '@/lib/tutorial-store';
import { useDemoMode } from '@/lib/demo';
import { useSession } from '@/lib/auth';

type Role = TutorialRole;

type TutorialContextType = {
  startTutorial: (role: Role) => void;
  resetAndStartTutorial: (role: Role) => void;
  // Run a module's walkthrough the first time that module is opened. Does
  // nothing if it has been seen, or if another tutorial is already on screen —
  // a newcomer opening Confession midway through the role tour must not get
  // two overlays stacked on each other.
  startModuleTutorialIfNew: (module: TutorialModule) => void;
  // Replay it deliberately, from a "How this works" link inside the module.
  replayModuleTutorial: (module: TutorialModule) => void;
};

const TutorialContext = createContext<TutorialContextType>({
  startTutorial: () => {},
  resetAndStartTutorial: () => {},
  startModuleTutorialIfNew: () => {},
  replayModuleTutorial: () => {},
});

// What is currently on screen: a role tour, or one module's walkthrough.
type Running = { kind: 'role'; role: Role } | { kind: 'module'; module: TutorialModule };

const storageKey = (r: Running): TutorialKey =>
  r.kind === 'role' ? r.role : `module:${r.module}`;

const stepsFor = (r: Running): TutorialStep[] =>
  r.kind === 'role' ? TUTORIAL_STEPS[r.role] : MODULE_TUTORIALS[r.module];

export function TutorialProvider({ children }: { children: React.ReactNode }) {
  const { demoMode, demoRole } = useDemoMode();
  const { profile } = useSession();

  const [running, setRunning] = useState<Running | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [checked, setChecked] = useState(false);
  // Mirrors `running` for the module starter below, which is called from a
  // screen's focus effect and must not change identity on every render.
  const runningRef = useRef<Running | null>(null);
  runningRef.current = running;

  // Derive effective role
  const effectiveRole: Role | null =
    demoMode
      ? (demoRole as Role)
      : profile?.role === 'priest' || profile?.role === 'admin'
      ? 'priest'
      : profile?.role === 'servant'
      ? 'servant'
      : profile?.role === 'congregant'
      ? 'congregant'
      : null;

  // Auto-start on first visit per role
  useEffect(() => {
    if (!effectiveRole || checked) return;
    setChecked(true);
    hasTutorialBeenSeen(effectiveRole).then((seen) => {
      if (!seen) {
        // Small delay so the screen has time to render first
        setTimeout(() => {
          setStepIndex(0);
          setRunning({ kind: 'role', role: effectiveRole });
        }, 800);
      }
    });
  }, [effectiveRole]);

  const startTutorial = useCallback((r: Role) => {
    setStepIndex(0);
    setRunning({ kind: 'role', role: r });
  }, []);

  const resetAndStartTutorial = useCallback(async (r: Role) => {
    await resetTutorialStore(r);
    setStepIndex(0);
    setRunning({ kind: 'role', role: r });
  }, []);

  const replayModuleTutorial = useCallback((module: TutorialModule) => {
    setStepIndex(0);
    setRunning({ kind: 'module', module });
  }, []);

  const startModuleTutorialIfNew = useCallback((module: TutorialModule) => {
    if (runningRef.current) return;   // the role tour, or another module, owns the screen
    hasTutorialBeenSeen(`module:${module}`).then(seen => {
      // Re-checked after the await: the role tour's 800ms auto-start can land
      // in the gap between the check above and this callback.
      if (seen || runningRef.current) return;
      setStepIndex(0);
      setRunning({ kind: 'module', module });
    });
  }, []);

  // Skipping and finishing both mark the tutorial seen. Someone who dismisses
  // the Confession walkthrough has decided they don't need it; re-running it on
  // their next visit to the tab would be the app arguing with them.
  const finish = useCallback(() => {
    const current = runningRef.current;
    if (current) markTutorialSeen(storageKey(current));
    setRunning(null);
  }, []);

  const handleNext = useCallback(() => {
    if (!running) return;
    if (stepIndex < stepsFor(running).length - 1) setStepIndex(i => i + 1);
    else finish();
  }, [stepIndex, running, finish]);

  return (
    <TutorialContext.Provider
      value={{ startTutorial, resetAndStartTutorial, startModuleTutorialIfNew, replayModuleTutorial }}
    >
      {children}
      <TutorialOverlay
        steps={running ? stepsFor(running) : []}
        currentIndex={stepIndex}
        onNext={handleNext}
        onSkip={finish}
        visible={running !== null}
      />
    </TutorialContext.Provider>
  );
}

export function useTutorial() {
  return useContext(TutorialContext);
}
