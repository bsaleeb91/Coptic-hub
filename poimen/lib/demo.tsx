import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEMO_MODE as DEMO_MODE_DEFAULT } from '@/lib/config';

type DemoRole = 'congregant' | 'priest' | 'servant';

interface DemoContextType {
  demoMode: boolean;
  setDemoMode: (v: boolean) => void;
  demoRole: DemoRole;
  setDemoRole: (r: DemoRole) => void;
}

const STORAGE_KEY = 'poimen_demo_mode';
const ROLE_KEY = 'poimen_demo_role';

const DemoContext = createContext<DemoContextType>({
  demoMode: DEMO_MODE_DEFAULT,
  setDemoMode: () => {},
  demoRole: 'congregant',
  setDemoRole: () => {},
});

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [demoMode, setDemoModeState] = useState(DEMO_MODE_DEFAULT);
  const [demoRole, setDemoRoleState] = useState<DemoRole>('congregant');

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(STORAGE_KEY),
      AsyncStorage.getItem(ROLE_KEY),
    ]).then(([stored, storedRole]) => {
      if (stored !== null) setDemoModeState(stored === 'true');
      if (storedRole) setDemoRoleState(storedRole as DemoRole);
    });
  }, []);

  function setDemoMode(v: boolean) {
    setDemoModeState(v);
    AsyncStorage.setItem(STORAGE_KEY, String(v));
  }

  function setDemoRole(r: DemoRole) {
    setDemoRoleState(r);
    AsyncStorage.setItem(ROLE_KEY, r);
  }

  return (
    <DemoContext.Provider value={{ demoMode, setDemoMode, demoRole, setDemoRole }}>
      {children}
    </DemoContext.Provider>
  );
}

export function useDemoMode() {
  return useContext(DemoContext);
}
