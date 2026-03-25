import { createSignedFlowContext } from "./codec.js";

import type { MiniAppLinkFlowOptions, MiniAppLinkOptions } from "./types.js";

export function generateMiniAppLink(options: MiniAppLinkOptions): string {
  const url = new URL(resolveMiniAppBaseUrl(options));
  const startPayload =
    "startPayload" in options ? options.startPayload : createLaunchPayload(options);

  url.searchParams.set("tgWebAppStartParam", startPayload);

  if (options.requestWriteAccess) {
    url.searchParams.set("tfRequestWriteAccess", "1");
  }

  if (typeof options.stayInChat === "boolean") {
    url.searchParams.set("tfStayInChat", options.stayInChat ? "1" : "0");
  }

  return url.toString();
}

function createLaunchPayload(options: MiniAppLinkFlowOptions): string {
  const payload = {
    ...(options.payload ?? {})
  };

  if (options.route && typeof payload.route !== "string") {
    payload.route = options.route;
  }

  if (options.stateKey && typeof payload.stateKey !== "string") {
    payload.stateKey = options.stateKey;
  }

  return createSignedFlowContext(
    {
      flowId: options.flowId,
      ...(typeof options.originMessageId === "number"
        ? { originMessageId: options.originMessageId }
        : {}),
      payload,
      ...(typeof options.requestWriteAccess === "boolean"
        ? { requestWriteAccess: options.requestWriteAccess }
        : {}),
      ...(typeof options.returnText === "string" ? { returnText: options.returnText } : {}),
      ...(typeof options.stayInChat === "boolean" ? { stayInChat: options.stayInChat } : {}),
      stepId: options.stepId
    },
    options.secret
  );
}

function resolveMiniAppBaseUrl(options: MiniAppLinkOptions): string {
  if (options.webAppUrl) {
    return options.webAppUrl;
  }

  if (!options.botUsername) {
    throw new Error("Mini App links require either `webAppUrl` or `botUsername`.");
  }

  const username = options.botUsername.replace(/^@/, "");

  if (options.appName) {
    return `https://t.me/${username}/${encodeURIComponent(options.appName)}`;
  }

  return `https://t.me/${username}`;
}
