import { useEffect, useRef, useState } from "react";

import { useTelegram } from "./useTelegram.js";

import type { MainButton, MainButtonParams } from "../types/webapp.js";

export interface MainButtonOptions {
  color?: string;
  isActive?: boolean;
  isProgressVisible?: boolean;
  isVisible?: boolean;
  text?: string;
  textColor?: string;
}

export interface UseMainButtonReturn {
  color: string;
  disable: () => void;
  enable: () => void;
  hide: () => void;
  hideProgress: () => void;
  isActive: boolean;
  isProgressVisible: boolean;
  isVisible: boolean;
  onClick: (callback: () => void) => () => void;
  params: MainButtonParams;
  setParams: (params: MainButtonParams) => void;
  setText: (text: string) => void;
  show: () => void;
  showProgress: (leaveActive?: boolean) => void;
  text: string;
  textColor: string;
}

export interface CoordinatedMainButtonOptions {
  closeAfterSend?: boolean;
  isVisible?: boolean;
}

export interface UseCoordinatedMainButtonReturn {
  closeAfterSend: boolean;
  hide: () => void;
  setProgress: (loading: boolean) => void;
  show: () => void;
}

const defaultParams: MainButtonParams = {
  color: "",
  is_active: true,
  is_progress_visible: false,
  is_visible: false,
  text: "CONTINUE",
  text_color: ""
};

/**
 * Synchronizes React state with Telegram's Main Button API and exposes imperative helpers for
 * common button flows such as visibility, loading state, and click subscriptions.
 */
export function useMainButton(options?: MainButtonOptions): UseMainButtonReturn {
  const { tg } = useTelegram();
  const buttonRef = useRef<MainButton | undefined>(tg?.MainButton);
  const clickHandlersRef = useRef(new Set<() => void>());
  const methodsRef = useRef<Omit<UseMainButtonReturn, StateKeys>>();
  const [params, setLocalParams] = useState<MainButtonParams>(() =>
    mergeParams(defaultParams, toMainButtonParams(options))
  );

  buttonRef.current = tg?.MainButton;

  useEffect(() => {
    const button = tg?.MainButton;
    const nextParams = mergeParams(
      defaultParams,
      readButtonState(button),
      toMainButtonParams(options)
    );

    setLocalParams((current) => (paramsEqual(current, nextParams) ? current : nextParams));

    if (!button) {
      return;
    }

    applyParamsToButton(button, nextParams);

    return () => {
      button.hide();
    };
  }, [
    options?.color,
    options?.isActive,
    options?.isProgressVisible,
    options?.isVisible,
    options?.text,
    options?.textColor,
    tg
  ]);

  useEffect(() => {
    return () => {
      const button = buttonRef.current;
      if (button) {
        for (const callback of clickHandlersRef.current) {
          button.offClick(callback);
        }
      }
      clickHandlersRef.current.clear();
    };
  }, []);

  if (!methodsRef.current) {
    methodsRef.current = createMethods(
      () => buttonRef.current,
      setLocalParams,
      clickHandlersRef.current
    );
  }

  return {
    ...methodsRef.current,
    color: params.color ?? "",
    isActive: params.is_active ?? false,
    isProgressVisible: params.is_progress_visible ?? false,
    isVisible: params.is_visible ?? false,
    params,
    text: params.text ?? "",
    textColor: params.text_color ?? ""
  };
}

/**
 * Registers an async Main Button flow for coordinated Mini App completion actions.
 */
export function useCoordinatedMainButton(
  text: string,
  onClick: () => Promise<void>,
  options: CoordinatedMainButtonOptions = {}
): UseCoordinatedMainButtonReturn {
  const {
    hide,
    hideProgress,
    onClick: registerClick,
    setText,
    show,
    showProgress
  } = useMainButton({
    isVisible: options.isVisible ?? true,
    text
  });
  const clickRef = useRef(onClick);

  clickRef.current = onClick;

  useEffect(() => {
    setText(text);

    if (options.isVisible ?? true) {
      show();
    } else {
      hide();
    }
  }, [hide, options.isVisible, setText, show, text]);

  useEffect(() => {
    const cleanup = registerClick(async () => {
      showProgress();

      try {
        await clickRef.current();
      } finally {
        hideProgress();
      }
    });

    return cleanup;
  }, [hideProgress, registerClick, showProgress]);

  return {
    closeAfterSend: options.closeAfterSend ?? true,
    hide,
    setProgress(loading: boolean) {
      if (loading) {
        showProgress();
        return;
      }

      hideProgress();
    },
    show
  };
}

type StateKeys =
  | "color"
  | "isActive"
  | "isProgressVisible"
  | "isVisible"
  | "params"
  | "text"
  | "textColor";

function createMethods(
  getButton: () => MainButton | undefined,
  setLocalParams: React.Dispatch<React.SetStateAction<MainButtonParams>>,
  clickHandlers: Set<() => void>
): Omit<UseMainButtonReturn, StateKeys> {
  const applyAndStore = (partial: MainButtonParams) => {
    const button = getButton();
    setLocalParams((current) => {
      const next = mergeParams(current, partial);
      applyParamsToButton(button, partial);
      return paramsEqual(current, next) ? current : next;
    });
  };

  return {
    disable() {
      const button = getButton();
      button?.disable();
      applyAndStore({ is_active: false });
    },
    enable() {
      const button = getButton();
      button?.enable();
      applyAndStore({ is_active: true });
    },
    hide() {
      const button = getButton();
      button?.hide();
      applyAndStore({ is_visible: false });
    },
    hideProgress() {
      const button = getButton();
      button?.hideProgress();
      applyAndStore({ is_progress_visible: false });
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
    setParams(nextParams: MainButtonParams) {
      applyAndStore(nextParams);
    },
    setText(text: string) {
      const button = getButton();
      button?.setText(text);
      applyAndStore({ text });
    },
    show() {
      const button = getButton();
      button?.show();
      applyAndStore({ is_visible: true });
    },
    showProgress(leaveActive = false) {
      const button = getButton();
      button?.showProgress(leaveActive);
      applyAndStore({
        is_active: leaveActive ? true : false,
        is_progress_visible: true
      });
    }
  };
}

function toMainButtonParams(options?: MainButtonOptions): MainButtonParams {
  if (!options) {
    return {};
  }

  return {
    color: options.color,
    is_active: options.isActive,
    is_progress_visible: options.isProgressVisible,
    is_visible: options.isVisible,
    text: options.text,
    text_color: options.textColor
  };
}

function readButtonState(button: MainButton | undefined): MainButtonParams {
  if (!button) {
    return {};
  }

  return {
    color: button.color,
    is_active: button.isActive,
    is_progress_visible: button.isProgressVisible,
    is_visible: button.isVisible,
    text: button.text,
    text_color: button.textColor
  };
}

function applyParamsToButton(button: MainButton | undefined, params: MainButtonParams): void {
  if (!button) {
    return;
  }

  if (params.text !== undefined) {
    button.setText(params.text);
  }

  button.setParams(params);

  if (params.is_visible === true) {
    button.show();
  } else if (params.is_visible === false) {
    button.hide();
  }

  if (params.is_active === true) {
    button.enable();
  } else if (params.is_active === false) {
    button.disable();
  }

  if (params.is_progress_visible === true) {
    button.showProgress(params.is_active ?? false);
  } else if (params.is_progress_visible === false) {
    button.hideProgress();
  }
}

function mergeParams(...partials: Array<MainButtonParams | undefined>): MainButtonParams {
  return partials.reduce<MainButtonParams>((accumulator, partial) => {
    if (!partial) {
      return accumulator;
    }

    return {
      ...accumulator,
      ...Object.fromEntries(Object.entries(partial).filter(([, value]) => value !== undefined))
    };
  }, {});
}

function paramsEqual(left: MainButtonParams, right: MainButtonParams): boolean {
  return (
    left.color === right.color &&
    left.is_active === right.is_active &&
    left.is_progress_visible === right.is_progress_visible &&
    left.is_visible === right.is_visible &&
    left.text === right.text &&
    left.text_color === right.text_color
  );
}
