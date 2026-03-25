import type { TeleforgeEvent } from "../types.js";

export interface BotEventTransport {
  processWebhook: (update: unknown) => TeleforgeEvent[];
  subscribeToMiniAppData?: (callback: (data: string) => void) => void;
}
