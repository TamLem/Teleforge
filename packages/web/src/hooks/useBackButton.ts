import { useEffect, useRef, useState } from "react";

import { useTelegram } from "./useTelegram.js";

import type { BackButton } from "../types/webapp.js";
import type { Dispatch, SetStateAction } from "react";

export interface BackButtonOptions {
  isVisible?: boolean;
}

export interface UseBackButtonReturn {
  hide: () => void;
  isVisible: boolean;
  onClick: (callback: () => void) => () => void;
  show: () => void;
}

/**
 * Synchronizes React state with Telegram's Back Button API and exposes imperative helpers for
 * visibility control and click subscriptions.
 */
export function useBackButton(options: BackButtonOptions = {}): UseBackButtonReturn {
  const { tg } = useTelegram();
  const buttonRef = useRef<BackButton | undefined>(tg?.BackButton);
  const clickHandlersRef = useRef(new Set<() => void>());
  const methodsRef = useRef<Omit<UseBackButtonReturn, "isVisible">>();
  const [isVisible, setIsVisible] = useState<boolean>(() => options.isVisible ?? false);

  buttonRef.current = tg?.BackButton;

  useEffect(() => {
    const button = tg?.BackButton;
    const nextIsVisible = options.isVisible ?? false;

    setIsVisible(nextIsVisible);

    if (!button) {
      return;
    }

    if (nextIsVisible) {
      button.show();
    } else {
      button.hide();
    }

    return () => {
      for (const callback of clickHandlersRef.current) {
        button.offClick(callback);
      }
      clickHandlersRef.current.clear();
      button.hide();
    };
  }, [options.isVisible, tg]);

  if (!methodsRef.current) {
    methodsRef.current = createMethods(
      () => buttonRef.current,
      clickHandlersRef.current,
      setIsVisible
    );
  }

  return {
    ...methodsRef.current,
    isVisible
  };
}

function createMethods(
  getButton: () => BackButton | undefined,
  clickHandlers: Set<() => void>,
  setIsVisible: Dispatch<SetStateAction<boolean>>
): Omit<UseBackButtonReturn, "isVisible"> {
  return {
    hide() {
      getButton()?.hide();
      setIsVisible(false);
    },
    onClick(callback: () => void) {
      const button = getButton();

      if (!button) {
        return () => {};
      }

      clickHandlers.add(callback);
      button.onClick(callback);

      return () => {
        clickHandlers.delete(callback);
        button.offClick(callback);
      };
    },
    show() {
      getButton()?.show();
      setIsVisible(true);
    }
  };
}
