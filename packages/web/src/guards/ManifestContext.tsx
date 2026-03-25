import React, { createContext, useContext } from "react";

import type { TeleforgeManifest } from "@teleforge/core/browser";

const ManifestContext = createContext<TeleforgeManifest | null>(null);

export interface ManifestProviderProps {
  children: React.ReactNode;
  manifest: TeleforgeManifest;
}

export function ManifestProvider({ children, manifest }: ManifestProviderProps) {
  return React.createElement(
    ManifestContext.Provider,
    {
      value: manifest
    },
    children
  );
}

export function useManifest(optional = false): TeleforgeManifest | null {
  const manifest = useContext(ManifestContext);

  if (!optional && !manifest) {
    throw new Error(
      "useManifest must be used within ManifestProvider or receive an override manifest."
    );
  }

  return manifest;
}
