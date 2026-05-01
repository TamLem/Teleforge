import type { SessionHandle } from "../session/types.js";

type MaybePromise<T> = Promise<T> | T;

export interface TeleforgeSchema<T = unknown> {
  parse(input: unknown): T;
}

export interface TeleforgeSafeSchema<T = unknown> {
  safeParse(input: unknown): { success: true; data: T } | { success: false; error: unknown };
}

export type TeleforgeInputSchema<T = unknown> = TeleforgeSchema<T> | TeleforgeSafeSchema<T>;

export interface TeleforgeValidationErrorBody {
  error: {
    code: "VALIDATION_FAILED";
    message: string;
    details?: unknown;
  };
}

export function parseTeleforgeInput<T>(
  schema: TeleforgeInputSchema<T>,
  input: unknown
): { ok: true; data: T } | { ok: false; error: string } {
  try {
    if (
      "safeParse" in schema &&
      typeof (schema as TeleforgeSafeSchema<T>).safeParse === "function"
    ) {
      const result = (schema as TeleforgeSafeSchema<T>).safeParse(input);
      return result.success
        ? { ok: true, data: result.data }
        : { ok: false, error: formatSchemaError(result.error) };
    }

    return { ok: true, data: (schema as TeleforgeSchema<T>).parse(input) };
  } catch (error) {
    return { ok: false, error: formatSchemaError(error) };
  }
}

function formatSchemaError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown validation error";
  }
}

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
  /** @deprecated Ignored by the action-first runtime. Use screen-level navigate() instead. */
  navigate?: string;
  closeMiniApp?: boolean;
  showHandoff?: string | boolean;
  effects?: ActionEffect[];
  handoff?: {
    message?: string;
    closeMiniApp?: boolean;
  };
  clientEffects?: ClientEffect[];
  redirect?: {
    screenId: string;
    params?: Record<string, string>;
    data?: Record<string, unknown>;
    reason?: string;
  };
}

export type ClientEffect = { type: "toast"; message: string } | { type: "closeMiniApp" };

export type ActionEffectType = "chatMessage" | "openMiniApp" | "navigate" | "webhook" | "custom";

export interface ActionEffect {
  type: ActionEffectType;
  [key: string]: unknown;
}

export interface ChatMessageEffect extends ActionEffect {
  type: "chatMessage";
  text: string;
  chatId?: string;
  replyMarkup?: {
    inline_keyboard?: Array<
      Array<{ text: string; url?: string; web_app?: { url: string }; callback_data?: string }>
    >;
  };
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

export interface ActionHandlerContext<TContext = unknown, TInput = unknown> {
  ctx: ActionContextToken;
  input: TInput;
  services: TContext;
  session?: SessionHandle;
  sign: SignContextFn;
}

export type ActionHandler<TContext = unknown, TInput = unknown> = (
  ctx: ActionHandlerContext<TContext, TInput>
) => MaybePromise<ActionResult>;

export interface ActionHandlerDefinition<TContext = unknown, TInput = unknown> {
  handler: ActionHandler<TContext, TInput>;
  requiresSession?: boolean;
  input?: TeleforgeInputSchema<TInput>;
}

export interface SignActionContextParams {
  flowId?: string;
  screenId: string;
  subject?: Record<string, unknown>;
  allowedActions?: string[];
  ttlSeconds?: number;
}

export type SignContextFn = (params: SignActionContextParams) => Promise<string>;
