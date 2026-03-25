import type { TeleforgeEvent } from "../types.js";

export interface MiniAppEventTransport {
  onEventFromBot: <TType extends string>(
    handler: (event: TeleforgeEvent<TType>) => void
  ) => () => void;
  postEventToBot: (event: TeleforgeEvent | unknown) => void;
}
