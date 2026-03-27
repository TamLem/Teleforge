import { useTheme } from "@teleforgex/web";

export interface ThemeColors {
  bgColor: string;
  buttonColor: string;
  buttonTextColor: string;
  destructiveTextColor: string;
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
    destructiveTextColor,
    hintColor,
    linkColor,
    secondaryBgColor,
    textColor
  } = useTheme();

  return {
    bgColor,
    buttonColor,
    buttonTextColor,
    destructiveTextColor,
    hintColor,
    linkColor,
    secondaryBgColor,
    textColor
  };
}
