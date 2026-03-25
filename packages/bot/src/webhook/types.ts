import type { TelegramUpdate } from "../router/types.js";
import type { BotRuntime } from "../runtime.js";

export interface WebhookConfig {
  allowedUpdates?: readonly string[];
  maxBodySize?: number;
  secretToken?: string;
}

export interface WebhookRequest {
  body: unknown;
  headers: Record<string, string>;
  method: string;
}

export interface WebhookResult {
  description?: string;
  ok: boolean;
  status: 200 | 400 | 401 | 405 | 500;
  updateId?: number;
}

export type BotWebhookRuntime = Pick<BotRuntime, "handle">;
export type WebhookHandler = (request: WebhookRequest) => Promise<WebhookResult>;
export type WebhookUpdate = TelegramUpdate;

export interface ExpressLikeRequest {
  body?: unknown;
  headers?: Record<string, string | string[] | undefined>;
  method?: string;
}

export interface ExpressLikeResponse {
  json: (body: unknown) => unknown;
  status: (statusCode: number) => ExpressLikeResponse;
}

export type ExpressWebhookHandler = (
  request: ExpressLikeRequest,
  response: ExpressLikeResponse
) => Promise<void>;

export interface FastifyLikeRequest {
  body?: unknown;
  headers?: Record<string, string | string[] | undefined>;
  method?: string;
}

export interface FastifyLikeReply {
  code: (statusCode: number) => FastifyLikeReply;
  send: (body: unknown) => unknown;
}

export type FastifyWebhookHandler = (
  request: FastifyLikeRequest,
  reply: FastifyLikeReply
) => Promise<void>;
