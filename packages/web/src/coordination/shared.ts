import { getTelegramWebApp, hasWindow } from "../utils/ssr.js";

interface FlowPayloadShape {
  payload?: Record<string, unknown>;
}

export function getLaunchFlowContext(): string | null {
  if (!hasWindow()) {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  const fromSearch = params.get("tgWebAppStartParam");

  if (fromSearch) {
    return fromSearch;
  }

  return getTelegramWebApp()?.initDataUnsafe?.start_param ?? null;
}

export function inferStateKey(flowContext: string | null): string | null {
  if (!flowContext) {
    return null;
  }

  const [, payload] = flowContext.split(".");

  if (!payload) {
    return null;
  }

  try {
    const parsed = JSON.parse(decodeBase64Url(payload)) as FlowPayloadShape;
    const stateKey = parsed.payload?.stateKey;

    return typeof stateKey === "string" ? stateKey : null;
  } catch {
    return null;
  }
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");

  if (typeof atob === "function") {
    return decodeURIComponent(
      Array.from(
        atob(padded),
        (character) => `%${character.charCodeAt(0).toString(16).padStart(2, "0")}`
      ).join("")
    );
  }

  return Buffer.from(padded, "base64").toString("utf8");
}
