export interface FlowContext extends Record<string, unknown> {
  flowId: string;
  originMessageId?: number;
  payload: Record<string, unknown>;
  requestWriteAccess?: boolean;
  returnText?: string;
  stayInChat?: boolean;
  stepId?: string;
}

export type LaunchEntryPoint =
  | { type: "miniapp"; startParam?: string }
  | { command: string; type: "bot_command" }
  | { text: string; type: "bot_button" }
  | { type: "deep_link"; url: string };

export interface RouteFlowMetadata {
  entryStep: string;
  flowId: string;
  requestWriteAccess?: boolean;
}

export interface ReturnToChatMetadata {
  stayInChat?: boolean;
  text: string;
}

export interface RouteCoordinationMetadata {
  entryPoints: readonly LaunchEntryPoint[];
  flow?: RouteFlowMetadata;
  returnToChat?: ReturnToChatMetadata;
}

interface MiniAppLinkBaseOptions {
  appName?: string;
  botUsername?: string;
  requestWriteAccess?: boolean;
  stayInChat?: boolean;
  webAppUrl?: string;
}

export interface MiniAppLinkStartPayloadOptions extends MiniAppLinkBaseOptions {
  startPayload: string;
}

export interface MiniAppLinkFlowOptions extends MiniAppLinkBaseOptions {
  flowId: string;
  originMessageId?: number;
  payload?: Record<string, unknown>;
  returnText?: string;
  route?: string;
  secret: string;
  stateKey?: string;
  stepId: string;
}

export type MiniAppLinkOptions = MiniAppLinkStartPayloadOptions | MiniAppLinkFlowOptions;

export interface CoordinatedRouteLike {
  coordination?: RouteCoordinationMetadata;
  path: string;
}
