import type { LaunchMode, WebAppUser } from "@teleforge/core";

export interface BffRequestContext {
  headers: Headers;
  initDataRaw?: string;
  launchMode: LaunchMode;
  method: string;
  path: string;
  searchParams: URLSearchParams;
  setHeader: (name: string, value: string) => void;
  setStatus: (code: number) => void;
  telegramUser?: WebAppUser;
}

export interface CreateBffRequestContextOptions {
  headers?: Headers;
  initDataRaw?: string;
  launchMode?: LaunchMode;
  method?: string;
  path?: string;
  searchParams?: URLSearchParams;
  status?: number;
  telegramUser?: WebAppUser;
}

export interface BffResponseState {
  headers: Headers;
  status: number;
}

export interface BffRequestContextWithState {
  context: BffRequestContext;
  response: BffResponseState;
}

export function createBffRequestContext(
  options: CreateBffRequestContextOptions = {}
): BffRequestContextWithState {
  const response: BffResponseState = {
    headers: new Headers(),
    status: options.status ?? 200
  };

  return {
    context: {
      headers: options.headers ?? new Headers(),
      ...(options.initDataRaw ? { initDataRaw: options.initDataRaw } : {}),
      launchMode: options.launchMode ?? "unknown",
      method: options.method ?? "GET",
      path: options.path ?? "/",
      searchParams: options.searchParams ?? new URLSearchParams(),
      setHeader(name: string, value: string) {
        response.headers.set(name, value);
      },
      setStatus(code: number) {
        response.status = code;
      },
      ...(options.telegramUser ? { telegramUser: options.telegramUser } : {})
    },
    response
  };
}
