import { getTelegramWebApp } from "../utils/ssr.js";

export interface TransmitResult {
  method: "bff" | "sendData" | "web_app_data";
  sentAt: number;
  success: boolean;
}

export interface TransmitConfig {
  bffEndpoint?: string;
}

export interface ReturnEnvelope {
  data: Record<string, unknown>;
  flowContext: string;
  result: "cancelled" | "completed" | "error";
  returnMessage?: string;
  stateKey: string;
  type: "miniapp_return";
}

export interface TransmitOptions {
  data: Record<string, unknown>;
  flowContext: string;
  result: "cancelled" | "completed" | "error";
  returnMessage: string;
  stateKey: string;
}

export async function transmitResult(
  options: TransmitOptions,
  config: TransmitConfig = {}
): Promise<TransmitResult> {
  const payload = JSON.stringify(createReturnEnvelope(options));
  const telegram = getTelegramWebApp();
  const sentAt = Date.now();

  if (telegram) {
    telegram.sendData(payload);

    return {
      method: telegram.MainButton ? "web_app_data" : "sendData",
      sentAt,
      success: true
    };
  }

  if (config.bffEndpoint) {
    const response = await fetch(config.bffEndpoint, {
      body: payload,
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });

    if (!response.ok) {
      throw new Error(`Return-to-chat BFF request failed with status ${response.status}.`);
    }

    return {
      method: "bff",
      sentAt,
      success: true
    };
  }

  throw new Error("No Telegram bridge or BFF endpoint is available for return-to-chat.");
}

export function createReturnEnvelope(options: TransmitOptions): ReturnEnvelope {
  return {
    data: options.data ?? {},
    flowContext: options.flowContext,
    result: options.result,
    returnMessage: options.returnMessage,
    stateKey: options.stateKey,
    type: "miniapp_return"
  };
}
