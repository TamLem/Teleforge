import { invokeAdapter } from "../adapters/invoke.js";
import { ServiceAdapterRegistry } from "../adapters/registry.js";
import { buildBffResponse, buildRouteResponse } from "../completion/helpers.js";
import { createBffRequestContext } from "../context/create.js";
import { BffError, serializeErrorResponse } from "../errors/base.js";
import { BffErrorCodes } from "../errors/codes.js";
import { defineBffRoute } from "../route/defineBffRoute.js";
import { BffRouteError } from "../route/errors.js";
import { executeBffRoute } from "../route/execute.js";
import { BffRouteRegistry } from "../route/registry.js";
import { createSessionRoutes } from "../routes/session.js";

import type { BffConfig } from "./types.js";
import type { AppUser } from "../identity/types.js";
import type { BffRouteConfig, BffRouteDefinition } from "../route/types.js";

export class ConfiguredBffRouter<TAppUser extends AppUser = AppUser> {
  private readonly registry = new BffRouteRegistry();
  private readonly services: ServiceAdapterRegistry;
  private builtInsMounted = false;

  constructor(private readonly config: BffConfig<TAppUser>) {
    this.services = new ServiceAdapterRegistry(Object.values(config.services));
  }

  add<TInput, TOutput>(
    route: BffRouteConfig<TInput, TOutput> | BffRouteDefinition<TInput, TOutput>
  ): BffRouteDefinition<TInput, TOutput> {
    const definition = "config" in route ? route : defineBffRoute(route);

    this.registry.register(definition as BffRouteDefinition);

    return definition;
  }

  createHandler() {
    return async (request: Request): Promise<Response> => {
      const match = this.registry.match(request.method, new URL(request.url).pathname);

      if (!match) {
        return errorResponse(
          BffError.fromCode(BffErrorCodes.ROUTE_NOT_FOUND, {
            message: `No BFF route matched ${request.method.toUpperCase()} ${new URL(request.url).pathname}.`
          })
        );
      }

      const context = await createBffRequestContext(request, {
        botToken: this.config.options.botToken,
        validateInitData: shouldValidateInitData(request, this.config)
      });

      context.response.headers.set("x-request-id", context.id);

      try {
        if (
          this.config.validation.allowedLaunchModes &&
          !this.config.validation.allowedLaunchModes.includes(context.launchMode)
        ) {
          throw new BffRouteError(
            "LAUNCH_MODE_NOT_ALLOWED",
            403,
            `Launch mode ${context.launchMode} is not allowed by BFF configuration.`
          );
        }

        const input = await parseRequestInput(request, context);
        const result = await executeBffRoute(match.route, context, input, {
          ...(this.config.adapters.cache ? { cacheStore: this.config.adapters.cache } : {}),
          invokeService: (service, serviceContext, serviceInput) =>
            invokeAdapter(
              this.services,
              service.name,
              service.operation,
              serviceInput,
              serviceContext,
              {
                timeout: match.route.config.timeoutMs
              }
            )
        });
        const responseBody = this.config.features.completion
          ? buildRouteResponse(match.route, context, result)
          : buildBffResponse(result);

        context.response.body = responseBody;

        if (this.config.features.requestLogging) {
          console.info(
            `[teleforge:bff] ${context.method} ${context.path} ${context.response.status} requestId=${context.id}`
          );
        }

        return context.toResponse();
      } catch (error) {
        context.response.body =
          error instanceof Error ? error : BffError.fromCode(BffErrorCodes.INTERNAL_ERROR);

        if (this.config.features.requestLogging) {
          console.error(
            `[teleforge:bff] ${context.method} ${context.path} error requestId=${context.id}`,
            error
          );
        }

        return context.toResponse();
      }
    };
  }

  getAll() {
    return this.registry.getAll();
  }

  mountBuiltIns() {
    if (this.builtInsMounted) {
      return;
    }

    if (this.config.features.sessions && this.config.adapters.session && this.config.jwt) {
      const routes = createSessionRoutes({
        adapter: this.config.adapters.session,
        securityEvents: this.config.events,
        identity: this.config.identity,
        secret: this.config.jwt.secret,
        accessTokenTtlSeconds: this.config.jwt.accessTokenExpiry,
        refreshTokenTtlSeconds: this.config.jwt.refreshTokenExpiry
      });

      this.add(routes.exchange);
      this.add(routes.refresh);
      this.add(routes.revoke);
    }

    this.builtInsMounted = true;
  }
}

async function parseRequestInput(
  request: Request,
  context: Awaited<ReturnType<typeof createBffRequestContext>>
) {
  if (request.method === "GET" || request.method === "HEAD") {
    return undefined;
  }

  if (request.body === null || request.headers.get("content-length") === "0") {
    return undefined;
  }

  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";

  if (contentType.includes("application/json")) {
    return await context.json();
  }

  return await context.text();
}

function shouldValidateInitData<TAppUser extends AppUser>(
  request: Request,
  config: BffConfig<TAppUser>
) {
  if (!config.validation.strictInitData) {
    return false;
  }

  const url = new URL(request.url);

  return Boolean(
    request.headers.get("x-telegram-init-data") ??
    request.headers.get("telegram-init-data") ??
    request.headers.get("x-teleforge-init-data") ??
    url.searchParams.get("tgWebAppData") ??
    url.searchParams.get("initData")
  );
}

function errorResponse(error: Error) {
  const requestId =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const serialized = serializeErrorResponse(error, requestId);

  return new Response(JSON.stringify(serialized.body), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "x-request-id": requestId
    },
    status: serialized.status
  });
}
