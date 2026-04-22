import { getTelegramWebApp, hasWindow } from "../utils/ssr.js";

/**
 * Resolves a resumable flow identifier from Telegram launch parameters.
 */
export function parseResumeParam(): string | null {
  const raw = readLaunchParam();

  if (!raw) {
    return null;
  }

  if (raw.startsWith("flow_")) {
    const flowId = raw.slice("flow_".length).trim();
    return flowId.length > 0 ? flowId : null;
  }

  return raw.trim() || null;
}

function readLaunchParam(): string | null {
  if (hasWindow()) {
    const params = new URLSearchParams(window.location.search);
    const fromSearch = params.get("tgWebAppStartParam") ?? params.get("startapp");

    if (fromSearch) {
      return fromSearch;
    }
  }

  return getTelegramWebApp()?.initDataUnsafe?.start_param ?? null;
}
