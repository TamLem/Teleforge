import { useTheme } from "@teleforge/web";

export interface ThemeColors {
  bgColor: string;
  buttonColor: string;
  buttonTextColor: string;
  hintColor: string;
  linkColor: string;
  secondaryBgColor: string;
  textColor: string;
}

export function useThemeColors(): ThemeColors {
  const {
    bgColor,
    buttonColor,
    buttonTextColor,
    hintColor,
    linkColor,
    secondaryBgColor,
    textColor
  } = useTheme();

  return {
    bgColor,
    buttonColor,
    buttonTextColor,
    hintColor,
    linkColor,
    secondaryBgColor,
    textColor
  };
}
