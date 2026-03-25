import type { TelegramWebApp } from "../types/webapp.js";

export function hasWindow(): boolean {
  return typeof window !== "undefined";
}

export function getTelegramWebApp(): TelegramWebApp | null {
  if (!hasWindow()) {
    return null;
  }

  return window.Telegram?.WebApp ?? null;
}

export function isTeleforgeMockInstalled(): boolean {
  return hasWindow() && window.__teleforgeMockInstalled === true;
}
