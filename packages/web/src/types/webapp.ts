export type WebAppColorScheme = "light" | "dark";

export type TelegramPlatform =
  | "ios"
  | "android"
  | "web"
  | "macos"
  | "desktop"
  | "unknown";

export type WebAppEvent =
  | "themeChanged"
  | "viewportChanged"
  | "mainButtonClicked"
  | "backButtonClicked"
  | "settingsButtonClicked"
  | "invoiceClosed";

export interface WebAppUser {
  added_to_attachment_menu?: boolean;
  allows_write_to_pm?: boolean;
  first_name: string;
  id: number;
  is_bot?: boolean;
  is_premium?: boolean;
  language_code?: string;
  last_name?: string;
  photo_url?: string;
  username?: string;
}

export interface WebAppInitData {
  auth_date?: number;
  chat_instance?: string;
  chat_type?: string;
  hash?: string;
  query_id?: string;
  receiver?: WebAppUser;
  start_param?: string;
  user?: WebAppUser;
}

export interface ThemeParams {
  accent_text_color?: string;
  bg_color?: string;
  button_color?: string;
  button_text_color?: string;
  destructive_text_color?: string;
  header_bg_color?: string;
  hint_color?: string;
  link_color?: string;
  secondary_bg_color?: string;
  section_bg_color?: string;
  section_header_text_color?: string;
  subtitle_text_color?: string;
  text_color?: string;
}

export interface PopupButton {
  id?: string;
  text: string;
  type?: "default" | "ok" | "close" | "cancel" | "destructive";
}

export interface PopupParams {
  buttons?: PopupButton[];
  message: string;
  title?: string;
}

export interface HapticFeedback {
  impactOccurred(style: "light" | "medium" | "heavy" | "rigid" | "soft"): void;
  notificationOccurred(type: "error" | "success" | "warning"): void;
  selectionChanged(): void;
}

export interface CloudStorage {
  getItem(
    key: string,
    callback?: (error: Error | null, value: string | null) => void
  ): void;
  getItems(
    keys: string[],
    callback?: (error: Error | null, values: Record<string, string>) => void
  ): void;
  removeItem(key: string, callback?: (error: Error | null, success: boolean) => void): void;
  removeItems(
    keys: string[],
    callback?: (error: Error | null, success: boolean) => void
  ): void;
  setItem(
    key: string,
    value: string,
    callback?: (error: Error | null, success: boolean) => void
  ): void;
}

export interface MainButton {
  hide(): void;
  onClick(callback: () => void): void;
  offClick(callback: () => void): void;
  setParams(params: Record<string, unknown>): void;
  show(): void;
}

export interface BackButton {
  hide(): void;
  offClick(callback: () => void): void;
  onClick(callback: () => void): void;
  show(): void;
}

export interface TelegramWebApp {
  BackButton?: BackButton;
  CloudStorage?: CloudStorage;
  HapticFeedback?: HapticFeedback;
  MainButton?: MainButton;
  close(): void;
  colorScheme: WebAppColorScheme;
  expand(): void;
  initData: string;
  initDataUnsafe: WebAppInitData;
  isExpanded: boolean;
  offEvent(event: WebAppEvent, callback: () => void): void;
  onEvent(event: WebAppEvent, callback: () => void): void;
  openLink(url: string, options?: { try_instant_view?: boolean }): void;
  openTelegramLink(url: string): void;
  platform: string;
  ready(): void;
  sendData(data: string): void;
  showAlert(message: string, callback?: () => void): void;
  showConfirm(message: string, callback?: (confirmed: boolean) => void): void;
  showPopup(params: PopupParams, callback?: (id?: string) => void): void;
  themeParams: ThemeParams;
  version: string;
  viewportHeight: number;
  viewportStableHeight: number;
}

declare global {
  interface Window {
    __teleforgeMockInstalled?: boolean;
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}
