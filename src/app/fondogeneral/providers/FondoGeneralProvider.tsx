"use client";

import React, { createContext, useContext } from "react";

type FondoGeneralContextValue = Record<string, never>;

const FondoGeneralContext = createContext<FondoGeneralContextValue>({});

export function FondoGeneralProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <FondoGeneralContext.Provider value={{}}>
      {children}
    </FondoGeneralContext.Provider>
  );
}

export function useFondoGeneralContext() {
  return useContext(FondoGeneralContext);
}
