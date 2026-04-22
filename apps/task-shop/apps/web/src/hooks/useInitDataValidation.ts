import { useEffect, useState } from "react";
import { validateInitDataEd25519 } from "teleforge/core/browser";
import { useLaunch } from "teleforge/web";

interface ValidationState {
  message: string;
  status: "idle" | "invalid" | "loading" | "valid";
}

const DEFAULT_PUBLIC_KEY = "e7bf03a2fa4602af4580703d88dda5bb59f32ed8b02a56c187fe7d34caed242d";

export function useInitDataValidation(): ValidationState {
  const { initData } = useLaunch();
  const [state, setState] = useState<ValidationState>({
    message: "Launch inside Telegram to validate initData with Ed25519.",
    status: "idle"
  });

  useEffect(() => {
    const publicKey = import.meta.env.VITE_TELEGRAM_PUBLIC_KEY || DEFAULT_PUBLIC_KEY;
    const botId = Number(import.meta.env.VITE_TELEGRAM_BOT_ID || "");

    if (!initData) {
      setState({
        message: "Waiting for Telegram initData before running the Ed25519 check.",
        status: "idle"
      });
      return;
    }

    if (!Number.isInteger(botId) || botId <= 0) {
      setState({
        message: "Set VITE_TELEGRAM_BOT_ID to enable client-side initData verification.",
        status: "idle"
      });
      return;
    }

    let active = true;

    setState({
      message: "Validating initData against Telegram's Ed25519 signature...",
      status: "loading"
    });

    void validateInitDataEd25519(initData, publicKey, {
      botId,
      maxAge: 60 * 60
    }).then((result) => {
      if (!active) {
        return;
      }

      if (result.valid) {
        setState({
          message: "Ed25519 validation passed for the current Telegram launch data.",
          status: "valid"
        });
        return;
      }

      setState({
        message: result.error,
        status: "invalid"
      });
    });

    return () => {
      active = false;
    };
  }, [initData]);

  return state;
}
