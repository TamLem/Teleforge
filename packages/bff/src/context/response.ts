import { serializeErrorResponse } from "../errors/base.js";

import type { BffResponseState, CookieOptions } from "./types.js";

export function createResponseState(): BffResponseState {
  return {
    body: null,
    cookies: new Map<string, CookieOptions>(),
    headers: new Headers(),
    status: 200
  };
}

export function responseFromState(response: BffResponseState, requestId = "unknown"): Response {
  const headers = new Headers(response.headers);

  for (const [name, cookie] of response.cookies.entries()) {
    headers.append("set-cookie", serializeCookie(name, cookie));
  }

  if (response.body === null || response.body === undefined) {
    return new Response(null, {
      headers,
      status: response.status
    });
  }

  if (response.body instanceof Error) {
    const serialized = serializeErrorResponse(response.body, requestId);

    if (!headers.has("content-type")) {
      headers.set("content-type", "application/json; charset=utf-8");
    }

    return new Response(JSON.stringify(serialized.body), {
      headers,
      status: serialized.status
    });
  }

  if (
    typeof response.body === "string" ||
    response.body instanceof ArrayBuffer ||
    response.body instanceof Blob ||
    response.body instanceof FormData ||
    response.body instanceof URLSearchParams ||
    response.body instanceof ReadableStream ||
    ArrayBuffer.isView(response.body)
  ) {
    return new Response(response.body, {
      headers,
      status: response.status
    });
  }

  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json; charset=utf-8");
  }

  return new Response(JSON.stringify(response.body), {
    headers,
    status: response.status
  });
}

function serializeCookie(name: string, options: CookieOptions): string {
  const parts = [`${name}=${encodeURIComponent(options.value)}`];

  if (options.path) {
    parts.push(`Path=${options.path}`);
  }

  if (options.domain) {
    parts.push(`Domain=${options.domain}`);
  }

  if (typeof options.maxAge === "number") {
    parts.push(`Max-Age=${Math.max(0, Math.trunc(options.maxAge))}`);
  }

  if (options.expires) {
    parts.push(`Expires=${options.expires.toUTCString()}`);
  }

  if (options.sameSite) {
    parts.push(`SameSite=${capitalize(options.sameSite)}`);
  }

  if (options.secure) {
    parts.push("Secure");
  }

  if (options.httpOnly) {
    parts.push("HttpOnly");
  }

  return parts.join("; ");
}

function capitalize(value: string) {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}
