import type { BffRequestContext } from "../context/types.js";

export interface CompletionEnvelope {
  action: CompletionAction;
  meta?: Record<string, unknown>;
  version: "1.0";
}

export type CompletionAction =
  | { chatId: number; parseMode?: "HTML" | "Markdown"; text: string; type: "sendMessage" }
  | { chatId: number; messageId: number; text: string; type: "editMessage" }
  | { caption?: string; chatId: number; photo: string; type: "sendPhoto" }
  | { slug: string; type: "openInvoice" }
  | { returnToChat?: boolean; type: "close" }
  | { tryInstantView?: boolean; type: "openLink"; url: string };

export interface BffResponse<T> {
  completion?: CompletionEnvelope;
  data: T;
}

export type CompletionResolver<TResult> =
  | CompletionAction
  | ((context: BffRequestContext, result: TResult) => CompletionAction | undefined);
