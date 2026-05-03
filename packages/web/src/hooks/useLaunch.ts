import {
  parseLaunchContext,
  validateLaunchAgainstManifest,
  type LaunchContext,
  type TeleforgeManifest,
  type WebAppInitData,
  type WebAppUser
} from "@teleforge/core/browser";
import { useEffect, useRef, useState } from "react";

import { hasWindow } from "../utils/ssr.js";

import { useTelegram } from "./useTelegram.js";

import type { TelegramPlatform, TelegramWebApp } from "../types/webapp.js";

export interface UseLaunchCapabilities {
  canExpand: boolean;
  supportsCloudStorage: boolean;
  supportsHapticFeedback: boolean;
  supportsPayments: boolean;
}

export interface UseLaunchReturn {
  capabilities: UseLaunchCapabilities;
  context: LaunchContext | null;
  initData: string;
  initDataUnsafe: WebAppInitData | null;
  isAuthenticated: boolean;
  isReady: boolean;
  isValidForManifest: boolean | null;
  mode: LaunchContext["launchMode"] | null;
  phoneAuthToken: string | null;
  platform: TelegramPlatform;
  startParam: string | null;
  user: WebAppUser | null;
  validationErrors: string[];
  validateAgainstManifest: (manifest: TeleforgeManifest) => boolean;
}

const defaultCapabilities: UseLaunchCapabilities = {
  canExpand: false,
  supportsCloudStorage: false,
  supportsHapticFeedback: false,
  supportsPayments: false
};

/**
 * Derives launch mode, platform, authentication state, and manifest validation helpers from the
 * active Telegram WebApp session.
 */
export function useLaunch(): UseLaunchReturn {
  const {
    isExpanded,
    isReady: telegramReady,
    platform,
    tg,
    version,
    viewportHeight,
    viewportStableHeight
  } = useTelegram();
  const [context, setContext] = useState<LaunchContext | null>(null);
  const [validation, setValidation] = useState(createDefaultValidationState);
  const contextRef = useRef<LaunchContext | null>(context);
  const methodsRef = useRef<Pick<UseLaunchReturn, "validateAgainstManifest">>();

  contextRef.current = context;

  useEffect(() => {
    if (!telegramReady || !tg || !hasWindow()) {
      setContext(null);
      setValidation(createDefaultValidationState());
      return;
    }

    setContext(parseLaunchContext(createLaunchSearchParams(window.location.search, tg)));
  }, [isExpanded, platform, tg, telegramReady, version, viewportHeight, viewportStableHeight]);

  useEffect(() => {
    setValidation((current) => {
      if (current.isValidForManifest === null && current.validationErrors.length === 0) {
        return current;
      }

      return createDefaultValidationState();
    });
  }, [context]);

  if (!methodsRef.current) {
    methodsRef.current = {
      validateAgainstManifest(manifest: TeleforgeManifest) {
        const currentContext = contextRef.current;

        if (!currentContext) {
          return false;
        }

        const result = validateLaunchAgainstManifest({
          context: currentContext,
          manifest
        });

        setValidation(
          result.valid
            ? {
                isValidForManifest: true,
                validationErrors: []
              }
            : {
                isValidForManifest: false,
                validationErrors: result.errors
              }
        );

        return result.valid;
      }
    };
  }

  return {
    capabilities: context
      ? {
          canExpand: context.canExpand,
          supportsCloudStorage: context.capabilities.supportsCloudStorage,
          supportsHapticFeedback: context.capabilities.supportsHapticFeedback,
          supportsPayments: context.capabilities.supportsPayments
        }
      : defaultCapabilities,
    context,
    initData: context?.initData ?? tg?.initData ?? "",
    initDataUnsafe: context?.initDataUnsafe ?? tg?.initDataUnsafe ?? null,
    isAuthenticated: Boolean(context?.user?.id),
    isReady: context !== null,
    isValidForManifest: validation.isValidForManifest,
    mode: context?.mode ?? null,
    phoneAuthToken: context?.phoneAuthToken ?? null,
    platform: context?.platform ?? "unknown",
    startParam: context?.startParam ?? null,
    user: context?.user ?? null,
    validationErrors: validation.validationErrors,
    validateAgainstManifest: methodsRef.current.validateAgainstManifest
  };
}

function createLaunchSearchParams(search: string, tg: TelegramWebApp): URLSearchParams {
  const params = new URLSearchParams(search);

  if (tg.initData) {
    params.set("tgWebAppData", tg.initData);
  }

  if (tg.platform) {
    params.set("tgWebAppPlatform", tg.platform);
  }

  if (tg.version) {
    params.set("tgWebAppVersion", tg.version);
  }

  if (tg.viewportHeight > 0) {
    params.set("tgWebAppViewportHeight", String(tg.viewportHeight));
  }

  if (tg.viewportStableHeight > 0) {
    params.set("tgWebAppViewportStableHeight", String(tg.viewportStableHeight));
  }

  return params;
}

function createDefaultValidationState() {
  return {
    isValidForManifest: null as boolean | null,
    validationErrors: [] as string[]
  };
}
