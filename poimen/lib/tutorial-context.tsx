import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { TutorialOverlay } from '@/components/ui/TutorialOverlay';
import { TUTORIAL_STEPS } from '@/lib/tutorial';
import { hasTutorialBeenSeen, markTutorialSeen, resetTutorial as resetTutorialStore } from '@/lib/tutorial-store';
import { useDemoMode } from '@/lib/demo';
import { useSession } from '@/lib/auth';

type Role = 'congregant' | 'priest' | 'servant';

type TutorialContextType = {
  startTutorial: (role: Role) => void;
  resetAndStartTutorial: (role: Role) => void;
};

const TutorialContext = createContext<TutorialContextType>({
  startTutorial: () => {},
  resetAndStartTutorial: () => {},
});

export function TutorialProvider({ children }: { children: React.ReactNode }) {
  const { demoMode, demoRole } = useDemoMode();
  const { profile } = useSession();

  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [role, setRole] = useState<Role>('congregant');
  const [checked, setChecked] = useState(false);

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
          setRole(effectiveRole);
          setStepIndex(0);
          setActive(true);
        }, 800);
      }
    });
  }, [effectiveRole]);

  const startTutorial = useCallback((r: Role) => {
    setRole(r);
    setStepIndex(0);
    setActive(true);
  }, []);

  const resetAndStartTutorial = useCallback(async (r: Role) => {
    await resetTutorialStore(r);
    setRole(r);
    setStepIndex(0);
    setActive(true);
  }, []);

  const handleNext = useCallback(() => {
    const steps = TUTORIAL_STEPS[role];
    if (stepIndex < steps.length - 1) {
      setStepIndex((i) => i + 1);
    } else {
      markTutorialSeen(role);
      setActive(false);
    }
  }, [stepIndex, role]);

  const handleSkip = useCallback(() => {
    markTutorialSeen(role);
    setActive(false);
  }, [role]);

  return (
    <TutorialContext.Provider value={{ startTutorial, resetAndStartTutorial }}>
      {children}
      <TutorialOverlay
        steps={TUTORIAL_STEPS[role]}
        currentIndex={stepIndex}
        onNext={handleNext}
        onSkip={handleSkip}
        visible={active}
      />
    </TutorialContext.Provider>
  );
}

export function useTutorial() {
  return useContext(TutorialContext);
}
