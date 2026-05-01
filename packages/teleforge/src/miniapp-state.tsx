import { createContext, useContext, useState, type ReactNode } from "react";

export interface MiniAppState<T = Record<string, unknown>> {
  value: T;
  set(next: T): void;
  patch(partial: Partial<T>): void;
  clear(): void;
}

const AppStateContext = createContext<MiniAppState | null>(null);

export function MiniAppStateProvider(props: { children: ReactNode }) {
  const [value, setValue] = useState<Record<string, unknown>>({});

  const state: MiniAppState = {
    value,
    set: (next) => setValue({ ...next }),
    patch: (partial) => setValue((prev) => ({ ...prev, ...partial })),
    clear: () => setValue({})
  };

  return <AppStateContext.Provider value={state}>{props.children}</AppStateContext.Provider>;
}

export function useAppState<T = Record<string, unknown>>(): MiniAppState<T> {
  const ctx = useContext(AppStateContext);
  if (!ctx) {
    throw new Error("useAppState must be used within a TeleforgeMiniApp component.");
  }
  return ctx as MiniAppState<T>;
}
