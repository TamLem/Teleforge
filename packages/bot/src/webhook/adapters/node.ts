import { createWebhookHandler, getDefaultMaxBodySize, normalizeHeaders } from "../handler.js";

import type { BotWebhookRuntime, WebhookConfig } from "../types.js";

export function nodeHttpAdapter(
  runtime: BotWebhookRuntime,
  config: WebhookConfig = {}
): (
  request: import("node:http").IncomingMessage,
  response: import("node:http").ServerResponse
) => Promise<void> {
  const handler = createWebhookHandler(runtime, config);
  const maxBodySize = getDefaultMaxBodySize(config.maxBodySize);

  return async (request, response) => {
    const body = await readRequestBody(request, maxBodySize);

    if (body === null) {
      sendJson(response, {
        description: "Request body exceeds maxBodySize.",
        ok: false,
        status: 400
      });
      return;
    }

    const result = await handler({
      body,
      headers: normalizeHeaders(request.headers),
      method: request.method ?? "POST"
    });

    sendJson(response, result);
  };
}

async function readRequestBody(
  request: import("node:http").IncomingMessage,
  maxBodySize: number
): Promise<string | null> {
  if (request.method?.toUpperCase() === "GET") {
    return "";
  }

  let body = "";

  for await (const chunk of request) {
    body += chunk instanceof Buffer ? chunk.toString("utf8") : String(chunk);

    if (Buffer.byteLength(body, "utf8") > maxBodySize) {
      return null;
    }
  }

  return body;
}

function sendJson(
  response: import("node:http").ServerResponse,
  body: {
    description?: string;
    ok: boolean;
    status: number;
    updateId?: number;
  }
) {
  response.statusCode = body.status;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body));
}
