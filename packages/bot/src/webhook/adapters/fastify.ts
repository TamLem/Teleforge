import { createWebhookHandler, normalizeHeaders } from "../handler.js";

import type { BotWebhookRuntime, FastifyWebhookHandler, WebhookConfig } from "../types.js";

export function fastifyAdapter(
  runtime: BotWebhookRuntime,
  config: WebhookConfig = {}
): FastifyWebhookHandler {
  const handler = createWebhookHandler(runtime, config);

  return async (request, reply) => {
    const result = await handler({
      body: request.body,
      headers: normalizeHeaders(request.headers),
      method: request.method ?? "POST"
    });

    reply.code(result.status).send(result);
  };
}
