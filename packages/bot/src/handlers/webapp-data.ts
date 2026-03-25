import type { WebAppDataContext, WebAppDataHandler } from "../router/types.js";

/**
 * Creates the fallback `web_app_data` handler used when a bot has not registered its own
 * dedicated data callback.
 */
export function createDefaultWebAppDataHandler(): WebAppDataHandler {
  return async (context: WebAppDataContext) => {
    await context.answer("Data received");
  };
}

/**
 * Parses JSON payloads sent from a Mini App and returns `null` for malformed input instead of
 * throwing.
 */
export function parseWebAppPayload(data: string): unknown | null {
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}
