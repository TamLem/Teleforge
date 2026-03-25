import { createBodyParser } from "./parseBody.js";
import { parseBffInitData } from "./parseInitData.js";
import { createResponseState, responseFromState } from "./response.js";

import type { BffContextOptions, BffRequestContext } from "./types.js";

/**
 * Creates a fully-enriched immutable BFF request context from a Web Request.
 */
export async function createBffRequestContext(
  request: Request,
  options: BffContextOptions
): Promise<BffRequestContext> {
  const url = new URL(request.url);
  const parsedInitData = await parseBffInitData(request, options);
  const bodyParser = createBodyParser(request);
  const response = createResponseState();

  const context: BffRequestContext = Object.freeze({
    arrayBuffer: bodyParser.arrayBuffer,
    auth: Object.freeze({
      sessionId: null,
      type: parsedInitData.authType,
      user: parsedInitData.telegramUser
    }),
    get body() {
      return bodyParser.getCachedBody();
    },
    chatInstance: parsedInitData.chatInstance,
    chatType: parsedInitData.chatType,
    header(name: string) {
      return request.headers.get(name);
    },
    headers: new Headers(request.headers),
    id: createRequestId(options.generateRequestId),
    initDataRaw: parsedInitData.initDataRaw,
    json: bodyParser.json,
    launchMode: parsedInitData.launchMode,
    method: request.method.toUpperCase(),
    path: url.pathname,
    response,
    searchParams: new URLSearchParams(url.search),
    setHeader(name: string, value: string) {
      response.headers.set(name, value);
    },
    setStatus(code: number) {
      response.status = code;
    },
    startParam: parsedInitData.startParam,
    telegramUser: parsedInitData.telegramUser,
    text: bodyParser.text,
    timestamp: Date.now(),
    toResponse() {
      return responseFromState(response);
    }
  });

  return context;
}

function createRequestId(generateRequestId?: () => string) {
  if (generateRequestId) {
    return generateRequestId();
  }

  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random()
    .toString(16)
    .slice(2)}`;
}
