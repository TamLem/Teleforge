import { createWebhookHandler, normalizeHeaders } from "../handler.js";

import type { BotWebhookRuntime, ExpressWebhookHandler, WebhookConfig } from "../types.js";

export function expressAdapter(
  runtime: BotWebhookRuntime,
  config: WebhookConfig = {}
): ExpressWebhookHandler {
  const handler = createWebhookHandler(runtime, config);

  return async (request, response) => {
    const result = await handler({
      body: request.body,
      headers: normalizeHeaders(request.headers),
      method: request.method ?? "POST"
    });

    response.status(result.status).json(result);
  };
}
