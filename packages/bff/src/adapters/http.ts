import { BffError } from "../errors/base.js";
import { BffErrorCodes } from "../errors/codes.js";

import type {
  HttpServiceAdapterConfig,
  HttpServiceOperation,
  ServiceAdapter,
  ServiceContext
} from "./types.js";

export class HttpServiceAdapter implements ServiceAdapter<HttpServiceAdapterConfig> {
  readonly config: HttpServiceAdapterConfig;
  readonly name: string;

  constructor(
    name: string,
    config: HttpServiceAdapterConfig,
    private readonly fetchImplementation: typeof fetch = globalThis.fetch.bind(globalThis)
  ) {
    this.name = name;
    this.config = config;
  }

  async invoke<TInput, TOutput>(
    operation: string,
    input: TInput,
    context: ServiceContext
  ): Promise<TOutput> {
    const resolvedOperation = resolveHttpOperation(this.config, operation);
    const method = resolvedOperation.method.toUpperCase();
    const url = new URL(resolvedOperation.path, this.config.baseUrl);
    const headers = new Headers({
      ...(this.config.headers ?? {}),
      ...(resolvedOperation.headers ?? {}),
      ...context.headers
    });
    const timeoutMs = resolvedOperation.timeoutMs ?? context.timeout ?? this.config.timeout;
    const controller = timeoutMs ? new AbortController() : undefined;
    const timeoutHandle = controller
      ? globalThis.setTimeout(() => controller.abort(), timeoutMs)
      : undefined;

    try {
      const request: RequestInit = {
        headers,
        method,
        ...(controller ? { signal: controller.signal } : {})
      };

      if (method === "GET" || method === "HEAD") {
        appendQueryInput(url, input);
      } else if (input !== undefined) {
        if (!headers.has("content-type")) {
          headers.set("content-type", "application/json");
        }

        request.body = serializeRequestBody(input, headers.get("content-type"));
      }

      const response = await this.fetchImplementation(url, request);

      if (!response.ok) {
        throw mapHttpError(this.name, operation, response.status);
      }

      return await parseResponse<TOutput>(response, this.name, operation);
    } catch (error) {
      if (isAbortError(error)) {
        throw BffError.fromCode(BffErrorCodes.SERVICE_TIMEOUT, {
          message: `Service ${this.name} timed out while executing ${operation}.`,
          meta: {
            operation,
            service: this.name,
            ...(timeoutMs !== undefined ? { timeoutMs } : {})
          }
        });
      }

      if (error instanceof BffError) {
        throw error;
      }

      throw BffError.fromCode(BffErrorCodes.SERVICE_UNAVAILABLE, {
        cause: error,
        message: `Service ${this.name} is unavailable.`,
        meta: {
          operation,
          service: this.name
        }
      });
    } finally {
      if (timeoutHandle !== undefined) {
        clearTimeout(timeoutHandle);
      }
    }
  }
}

export function createRestAdapter(name: string, config: HttpServiceAdapterConfig) {
  return new HttpServiceAdapter(name, config);
}

function appendQueryInput(url: URL, input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return;
  }

  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) {
      continue;
    }

    url.searchParams.set(key, stringifyQueryValue(value));
  }
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function mapHttpError(service: string, operation: string, status: number) {
  if (status === 408 || status === 504) {
    return BffError.fromCode(BffErrorCodes.SERVICE_TIMEOUT, {
      message: `Service ${service} timed out while executing ${operation}.`,
      meta: {
        operation,
        service,
        status
      }
    });
  }

  if (status >= 500) {
    return BffError.fromCode(BffErrorCodes.SERVICE_UNAVAILABLE, {
      message: `Service ${service} returned status ${status}.`,
      meta: {
        operation,
        service,
        status
      }
    });
  }

  return BffError.fromCode(BffErrorCodes.INTERNAL_ERROR, {
    message: `Service ${service} rejected ${operation} with status ${status}.`,
    meta: {
      operation,
      service,
      status
    },
    statusCode: 502
  });
}

async function parseResponse<TOutput>(response: Response, service: string, operation: string) {
  if (response.status === 204 || response.status === 205) {
    return undefined as TOutput;
  }

  const body = await response.text();

  if (body.length === 0) {
    return undefined as TOutput;
  }

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";

  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(body) as TOutput;
    } catch (error) {
      throw BffError.fromCode(BffErrorCodes.INTERNAL_ERROR, {
        cause: error,
        message: `Service ${service} returned invalid JSON for ${operation}.`,
        meta: {
          operation,
          service
        },
        statusCode: 502
      });
    }
  }

  return body as TOutput;
}

function resolveHttpOperation(
  config: HttpServiceAdapterConfig,
  operation: string
): Required<HttpServiceOperation> {
  const configuredOperation = config.operations?.[operation];

  if (typeof configuredOperation === "string") {
    return parseOperationString(configuredOperation);
  }

  if (configuredOperation) {
    return {
      headers: configuredOperation.headers ?? {},
      method: configuredOperation.method?.toUpperCase() ?? "GET",
      path: configuredOperation.path,
      timeoutMs: configuredOperation.timeoutMs ?? config.timeout ?? 0
    };
  }

  return parseOperationString(operation, config.timeout);
}

function parseOperationString(operation: string, timeoutMs = 0): Required<HttpServiceOperation> {
  const [maybeMethod, ...pathParts] = operation.trim().split(/\s+/);
  const hasPath = pathParts.length > 0;
  const method = hasPath ? maybeMethod.toUpperCase() : "GET";
  const path = hasPath ? pathParts.join(" ") : maybeMethod;

  return {
    headers: {},
    method,
    path,
    timeoutMs
  };
}

function serializeRequestBody(input: unknown, contentType: string | null) {
  if (contentType?.includes("application/json")) {
    return JSON.stringify(input);
  }

  return typeof input === "string" ? input : JSON.stringify(input);
}

function stringifyQueryValue(value: unknown) {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "string"
  ) {
    return String(value);
  }

  return JSON.stringify(value);
}
