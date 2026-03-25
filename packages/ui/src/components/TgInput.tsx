import React from "react";

import { useThemeColors } from "../hooks/useThemeColors.js";

export interface TgInputProps {
  error?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
}

export function TgInput({ error, onChange, placeholder, value }: TgInputProps) {
  const { bgColor, hintColor, secondaryBgColor, textColor } = useThemeColors();

  return React.createElement(
    "div",
    {
      style: {
        display: "grid",
        gap: "6px"
      }
    },
    React.createElement("input", {
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
        onChange(event.target.value);
      },
      placeholder,
      style: {
        backgroundColor: bgColor,
        border: `1px solid ${error ? "#d9534f" : secondaryBgColor}`,
        borderRadius: "12px",
        color: textColor,
        fontSize: "15px",
        outline: "none",
        padding: "12px 14px"
      },
      value
    }),
    error
      ? React.createElement(
          "span",
          {
            style: {
              color: "#d9534f",
              fontSize: "12px"
            }
          },
          error
        )
      : React.createElement(
          "span",
          {
            style: {
              color: hintColor,
              fontSize: "12px"
            }
          },
          placeholder ?? ""
        )
  );
}
