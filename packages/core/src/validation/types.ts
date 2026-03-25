import type { WebAppInitData } from "../launch/types.js";

export interface ValidateInitDataOptions {
  maxAge?: number;
}

export interface Ed25519ValidationOptions extends ValidateInitDataOptions {
  botId: number;
  throwOnError?: boolean;
}

export interface ValidateInitDataSuccess {
  data: WebAppInitData;
  valid: true;
}

export interface ValidateInitDataFailure {
  error: string;
  expired?: boolean;
  valid: false;
}

export type ValidateInitDataResult = ValidateInitDataFailure | ValidateInitDataSuccess;
