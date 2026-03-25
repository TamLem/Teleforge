import { useMemo } from "react";

import { useTelegram } from "./useTelegram.js";

import type { ThemeParams, WebAppColorScheme } from "../types/webapp.js";

const defaultThemeParams: Required<ThemeParams> = {
  accent_text_color: "#2481cc",
  bg_color: "#ffffff",
  button_color: "#2481cc",
  button_text_color: "#ffffff",
  destructive_text_color: "#ff3b30",
  header_bg_color: "#ffffff",
  hint_color: "#999999",
  link_color: "#2481cc",
  secondary_bg_color: "#f5f5f5",
  section_bg_color: "#ffffff",
  section_header_text_color: "#2481cc",
  subtitle_text_color: "#6d6d71",
  text_color: "#000000"
};

const cssVariableEntries: Array<[keyof ThemeParams, string]> = [
  ["accent_text_color", "--tg-theme-accent-text-color"],
  ["bg_color", "--tg-theme-bg-color"],
  ["button_color", "--tg-theme-button-color"],
  ["button_text_color", "--tg-theme-button-text-color"],
  ["destructive_text_color", "--tg-theme-destructive-text-color"],
  ["header_bg_color", "--tg-theme-header-bg-color"],
  ["hint_color", "--tg-theme-hint-color"],
  ["link_color", "--tg-theme-link-color"],
  ["secondary_bg_color", "--tg-theme-secondary-bg-color"],
  ["section_bg_color", "--tg-theme-section-bg-color"],
  ["section_header_text_color", "--tg-theme-section-header-text-color"],
  ["subtitle_text_color", "--tg-theme-subtitle-text-color"],
  ["text_color", "--tg-theme-text-color"]
];

export interface UseThemeReturn {
  accentTextColor: string;
  bgColor: string;
  buttonColor: string;
  buttonTextColor: string;
  colorScheme: WebAppColorScheme;
  cssVariables: Record<string, string>;
  destructiveTextColor: string;
  headerBgColor: string;
  hintColor: string;
  isDark: boolean;
  isLight: boolean;
  linkColor: string;
  secondaryBgColor: string;
  sectionBgColor: string;
  sectionHeaderTextColor: string;
  subtitleTextColor: string;
  textColor: string;
  themeParams: Required<ThemeParams>;
}

/**
 * Normalizes Telegram theme parameters into a stable object with convenience booleans and CSS
 * custom properties ready to spread onto a container element.
 */
export function useTheme(): UseThemeReturn {
  const { colorScheme, themeParams } = useTelegram();

  return useMemo(() => {
    const resolvedTheme = {
      ...defaultThemeParams,
      ...themeParams
    };

    const cssVariables = cssVariableEntries.reduce<Record<string, string>>(
      (accumulator, [key, variableName]) => {
        accumulator[variableName] = resolvedTheme[key] ?? "";
        return accumulator;
      },
      {}
    );

    return {
      accentTextColor: resolvedTheme.accent_text_color,
      bgColor: resolvedTheme.bg_color,
      buttonColor: resolvedTheme.button_color,
      buttonTextColor: resolvedTheme.button_text_color,
      colorScheme,
      cssVariables,
      destructiveTextColor: resolvedTheme.destructive_text_color,
      headerBgColor: resolvedTheme.header_bg_color,
      hintColor: resolvedTheme.hint_color,
      isDark: colorScheme === "dark",
      isLight: colorScheme === "light",
      linkColor: resolvedTheme.link_color,
      secondaryBgColor: resolvedTheme.secondary_bg_color,
      sectionBgColor: resolvedTheme.section_bg_color,
      sectionHeaderTextColor: resolvedTheme.section_header_text_color,
      subtitleTextColor: resolvedTheme.subtitle_text_color,
      textColor: resolvedTheme.text_color,
      themeParams: resolvedTheme
    };
  }, [colorScheme, themeParams]);
}
