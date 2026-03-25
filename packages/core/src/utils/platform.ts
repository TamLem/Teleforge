export type TelegramPlatform = "ios" | "android" | "web" | "macos" | "desktop" | "unknown";

export function normalizePlatform(platform: string | null | undefined): TelegramPlatform {
  if (platform === "ios" || platform === "android" || platform === "web" || platform === "macos") {
    return platform;
  }

  if (platform === "tdesktop" || platform === "desktop") {
    return "desktop";
  }

  return "unknown";
}
