import { createSignedActionContextToken } from "./action.js";

import type { CreateActionContextOptions } from "./action.js";

export interface CreateMiniAppLaunchUrlOptions extends CreateActionContextOptions {
  miniAppUrl: string;
  requestWriteAccess?: boolean;
}

export function createMiniAppLaunchUrl(
  options: CreateMiniAppLaunchUrlOptions
): string {
  const token = createSignedActionContextToken({
    allowedActions: options.allowedActions,
    appId: options.appId,
    flowId: options.flowId,
    screenId: options.screenId,
    secret: options.secret,
    subject: options.subject,
    ttlSeconds: options.ttlSeconds,
    userId: options.userId
  });

  const url = new URL(options.miniAppUrl);
  url.searchParams.set("tgWebAppStartParam", token);

  if (options.requestWriteAccess) {
    url.searchParams.set("tgWebAppWriteAccess", "1");
  }

  return url.toString();
}

export function createMiniAppLaunchButton(options: {
  text: string;
  url: string;
}) {
  return {
    text: options.text,
    web_app: { url: options.url }
  };
}
