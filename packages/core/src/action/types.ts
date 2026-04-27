import type { SessionHandle } from "../session/types.js";

type MaybePromise<T> = Promise<T> | T;

export interface ActionContextToken extends Record<string, unknown> {
  appId: string;
  flowId: string;
  screenId?: string;
  userId: string;
  subject?: Record<string, unknown>;
  allowedActions?: string[];
  issuedAt: number;
  expiresAt: number;
  nonce?: string;
}

export interface ActionResult {
  data?: Record<string, unknown>;
  navigate?: string;
  closeMiniApp?: boolean;
  showHandoff?: string | boolean;
  effects?: ActionEffect[];
}

export type ActionEffectType =
  | "chatMessage"
  | "openMiniApp"
  | "navigate"
  | "webhook"
  | "custom";

export interface ActionEffect {
  type: ActionEffectType;
  [key: string]: unknown;
}

export interface ChatMessageEffect extends ActionEffect {
  type: "chatMessage";
  text: string;
  chatId?: string;
}

export interface OpenMiniAppEffect extends ActionEffect {
  type: "openMiniApp";
  launchUrl: string;
}

export interface NavigateEffect extends ActionEffect {
  type: "navigate";
  screenId: string;
  params?: Record<string, unknown>;
}

export interface WebhookEffect extends ActionEffect {
  type: "webhook";
  url: string;
  payload: unknown;
}

export interface CustomEffect extends ActionEffect {
  type: "custom";
  kind: string;
  payload: unknown;
}

export interface ActionHandlerContext<TContext = unknown> {
  ctx: ActionContextToken;
  data: unknown;
  services: TContext;
  session?: SessionHandle;
}

export type ActionHandler<TContext = unknown> = (
  ctx: ActionHandlerContext<TContext>
) => MaybePromise<ActionResult>;

export interface ActionHandlerDefinition<TContext = unknown> {
  handler: ActionHandler<TContext>;
  requiresSession?: boolean;
}

export interface SignActionContextParams {
  flowId: string;
  screenId: string;
  subject?: Record<string, unknown>;
  allowedActions?: string[];
  ttlSeconds?: number;
}

export type SignContextFn = (params: SignActionContextParams) => Promise<string>;
