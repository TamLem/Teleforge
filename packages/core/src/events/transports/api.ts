import type { TeleforgeEvent } from "../types.js";

export interface ApiEventTransport {
  publish: (connectionId: string, event: TeleforgeEvent) => Promise<void> | void;
  subscribe: (connectionId: string) => AsyncIterable<TeleforgeEvent>;
}
