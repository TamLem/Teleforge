import type {
  TelegramKeyboardButton,
  TelegramKeyboardMarkup,
  TelegramMessage,
  TelegramUpdate
} from "../router/types.js";

export interface LocationRequestButtonOptions {
  text?: string;
}

export interface LocationRequestMarkupOptions {
  oneTimeKeyboard?: boolean;
  resizeKeyboard?: boolean;
  text?: string;
}

export interface SharedLocation {
  horizontalAccuracy?: number;
  latitude: number;
  longitude: number;
}

export type LocationSource = TelegramMessage | TelegramUpdate;

export function createLocationRequestButton(
  options: LocationRequestButtonOptions = {}
): TelegramKeyboardButton {
  return {
    request_location: true,
    text: options.text ?? "Share location"
  };
}

export function createLocationRequestMarkup(
  options: LocationRequestMarkupOptions = {}
): TelegramKeyboardMarkup {
  return {
    keyboard: [[createLocationRequestButton({ text: options.text })]],
    one_time_keyboard: options.oneTimeKeyboard ?? true,
    resize_keyboard: options.resizeKeyboard ?? true
  };
}

export function extractSharedLocation(source: LocationSource): SharedLocation | null {
  const message = isTelegramUpdate(source)
    ? (source.message ?? source.edited_message ?? null)
    : source;
  const location = message?.location;
  const sender = message?.from;

  if (!location || !sender) {
    return null;
  }

  return {
    horizontalAccuracy: location.horizontal_accuracy,
    latitude: location.latitude,
    longitude: location.longitude
  };
}

function isTelegramUpdate(source: LocationSource): source is TelegramUpdate {
  return "update_id" in source || "message" in source || "edited_message" in source;
}
