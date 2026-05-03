import { getTelegramWebApp, hasWindow } from "../utils/ssr.js";

import type { FlowContext } from "@teleforge/core/browser";

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

export function parseFlowContext(flowContext: string | null): FlowContext | null {
  if (!flowContext) {
    return null;
  }

  const [prefix, payload] = flowContext.split(".");

  if (prefix !== "tfp1" || !payload) {
    return null;
  }

  try {
    const parsed = JSON.parse(decodeBase64Url(payload)) as Record<string, unknown>;

    if (
      typeof parsed.flowId !== "string" ||
      typeof parsed.payload !== "object" ||
      parsed.payload === null ||
      Array.isArray(parsed.payload)
    ) {
      return null;
    }

    return parsed as FlowContext;
  } catch {
    return null;
  }
}

export function inferStateKey(flowContext: string | null): string | null {
  const parsed = parseFlowContext(flowContext);
  const stateKey = parsed?.payload.stateKey;

  return typeof stateKey === "string" ? stateKey : null;
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
