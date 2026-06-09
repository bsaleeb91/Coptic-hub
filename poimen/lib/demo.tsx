import React, { createContext, useContext, useState } from 'react';

type DemoRole = 'congregant' | 'priest' | 'servant';

interface DemoContextType {
  demoMode: boolean;
  setDemoMode: (v: boolean) => void;
  demoRole: DemoRole;
  setDemoRole: (r: DemoRole) => void;
}

const DemoContext = createContext<DemoContextType>({
  demoMode: false,
  setDemoMode: () => {},
  demoRole: 'congregant',
  setDemoRole: () => {},
});

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [demoMode, setDemoMode] = useState(false);
  const [demoRole, setDemoRole] = useState<DemoRole>('congregant');
  return (
    <DemoContext.Provider value={{ demoMode, setDemoMode, demoRole, setDemoRole }}>
      {children}
    </DemoContext.Provider>
  );
}

export function useDemoMode() {
  return useContext(DemoContext);
}
