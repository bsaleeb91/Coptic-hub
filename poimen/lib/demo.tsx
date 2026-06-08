import React, { createContext, useContext, useState } from 'react';

interface DemoContextType {
  demoMode: boolean;
  setDemoMode: (v: boolean) => void;
}

const DemoContext = createContext<DemoContextType>({
  demoMode: false,
  setDemoMode: () => {},
});

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [demoMode, setDemoMode] = useState(false);
  return (
    <DemoContext.Provider value={{ demoMode, setDemoMode }}>
      {children}
    </DemoContext.Provider>
  );
}

export function useDemoMode() {
  return useContext(DemoContext);
}
