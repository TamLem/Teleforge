import { normalizePlatform } from "../utils/platform.js";

import { detectCapabilities, detectLaunchMode } from "./detector.js";
import { parseInitData, parseInitDataUnsafe } from "./initData.js";

import type { LaunchContext, LaunchMode } from "./types.js";

export function parseLaunchContext(searchParams: URLSearchParams | string): LaunchContext {
  const params =
    typeof searchParams === "string" ? new URLSearchParams(searchParams) : searchParams;
  const initData = params.get("tgWebAppData") ?? "";
  const strictInitData = parseInitData(initData);
  const initDataUnsafe = strictInitData.success
    ? strictInitData.data
    : parseInitDataUnsafe(initData);
  const platform = normalizePlatform(params.get("tgWebAppPlatform"));
  const version = params.get("tgWebAppVersion") ?? "";
  const viewportHeight = readViewportHint(params);
  const hintedLaunchMode = detectLaunchModeFromParams(params);
  const launchMode =
    hintedLaunchMode !== "unknown"
      ? hintedLaunchMode
      : viewportHeight !== null
        ? detectLaunchMode(viewportHeight, platform)
        : fallbackLaunchMode(platform);
  const startParamRaw =
    params.get("startapp") ??
    params.get("tgWebAppStartParam") ??
    initDataUnsafe.start_param ??
    null;
  const startParam = initDataUnsafe.start_param ?? startParamRaw;
  const capabilities = detectCapabilities({
    initDataUnsafe,
    launchMode,
    platform,
    version
  });

  return {
    authDate:
      typeof initDataUnsafe.auth_date === "number"
        ? new Date(initDataUnsafe.auth_date * 1000)
        : null,
    canExpand: launchMode !== "fullscreen",
    capabilities,
    hash: initDataUnsafe.hash ?? "",
    initData,
    initDataUnsafe,
    isCompact: launchMode === "compact",
    isFullscreen: launchMode === "fullscreen",
    isInline: launchMode === "inline",
    launchMode,
    mode: launchMode,
    platform,
    startParam,
    startParamRaw,
    user: initDataUnsafe.user ?? null,
    userUnsafe: initDataUnsafe.user ?? null,
    version
  };
}

function detectLaunchModeFromParams(params: URLSearchParams): LaunchMode {
  const explicitMode = normalizeLaunchMode(
    params.get("launchMode") ?? params.get("tgWebAppLaunchMode")
  );

  if (explicitMode !== "unknown") {
    return explicitMode;
  }

  if (isTruthyParam(params.get("tgWebAppBotInline")) || isTruthyParam(params.get("botInline"))) {
    return "inline";
  }

  if (isTruthyParam(params.get("tgWebAppFullscreen")) || isTruthyParam(params.get("fullscreen"))) {
    return "fullscreen";
  }

  if (isTruthyParam(params.get("tgWebAppCompact")) || isTruthyParam(params.get("compact"))) {
    return "compact";
  }

  if (isTruthyParam(params.get("tgWebAppExpanded"))) {
    const platform = normalizePlatform(params.get("tgWebAppPlatform"));
    return platform === "ios" || platform === "android" ? "compact" : "fullscreen";
  }

  return "unknown";
}

function fallbackLaunchMode(platform: LaunchContext["platform"]): LaunchMode {
  if (platform === "desktop" || platform === "web" || platform === "macos") {
    return "fullscreen";
  }

  if (platform === "ios" || platform === "android") {
    return "compact";
  }

  return "unknown";
}

function normalizeLaunchMode(value: string | null): LaunchMode {
  if (value === "inline" || value === "compact" || value === "fullscreen") {
    return value;
  }

  if (value === "full") {
    return "fullscreen";
  }

  return "unknown";
}

function readViewportHint(params: URLSearchParams): number | null {
  const stableHeight = parsePositiveNumber(params.get("tgWebAppViewportStableHeight"));
  if (stableHeight !== null) {
    return stableHeight;
  }

  return parsePositiveNumber(params.get("tgWebAppViewportHeight"));
}

function parsePositiveNumber(value: string | null): number | null {
  if (value === null || value.trim().length === 0) {
    return null;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function isTruthyParam(value: string | null): boolean {
  return value === "1" || value === "true" || value === "yes";
}
