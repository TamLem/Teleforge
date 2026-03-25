import React from "react";

import { useThemeColors } from "../hooks/useThemeColors.js";

export interface TgListItem {
  description?: string;
  id: string;
  label: string;
}

export interface TgListProps {
  items: TgListItem[];
  onSelect?: (id: string) => void;
  selected?: string | null;
}

export function TgList({ items, onSelect, selected = null }: TgListProps) {
  const { bgColor, hintColor, linkColor, secondaryBgColor, textColor } = useThemeColors();

  return React.createElement(
    "div",
    {
      style: {
        border: `1px solid ${secondaryBgColor}`,
        borderRadius: "16px",
        overflow: "hidden"
      }
    },
    items.map((item, index) =>
      React.createElement(
        "button",
        {
          key: item.id,
          onClick: () => {
            onSelect?.(item.id);
          },
          style: {
            alignItems: "flex-start",
            background: selected === item.id ? secondaryBgColor : bgColor,
            border: "none",
            borderBottom: index === items.length - 1 ? "none" : `1px solid ${secondaryBgColor}`,
            color: textColor,
            cursor: "pointer",
            display: "grid",
            gap: "4px",
            padding: "14px 16px",
            textAlign: "left",
            width: "100%"
          },
          type: "button"
        },
        React.createElement(
          "span",
          {
            style: {
              color: selected === item.id ? linkColor : textColor,
              fontWeight: 600
            }
          },
          item.label
        ),
        item.description
          ? React.createElement(
              "span",
              {
                style: {
                  color: hintColor,
                  fontSize: "13px"
                }
              },
              item.description
            )
          : null
      )
    )
  );
}
