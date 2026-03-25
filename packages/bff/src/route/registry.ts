import { BffRouteError } from "./errors.js";

import type { BffRouteDefinition, BffRouteMatch, BffRouteMethod } from "./types.js";

export class BffRouteRegistry {
  private readonly routes: BffRouteDefinition[] = [];

  getAll(): BffRouteDefinition[] {
    return [...this.routes];
  }

  match(method: string, path: string): BffRouteMatch | null {
    const normalizedMethod = method.toUpperCase();

    for (const route of this.routes) {
      if (route.config.method !== normalizedMethod) {
        continue;
      }

      const params = matchPath(route.config.path, path);

      if (params) {
        return {
          params,
          route
        };
      }
    }

    return null;
  }

  register(route: BffRouteDefinition): void {
    const exists = this.routes.some(
      (candidate) =>
        candidate.config.method === route.config.method &&
        candidate.config.path === route.config.path
    );

    if (exists) {
      throw new BffRouteError(
        "DUPLICATE_ROUTE",
        500,
        `A BFF route for ${route.config.method as BffRouteMethod} ${route.config.path} is already registered.`,
        {
          method: route.config.method,
          path: route.config.path
        }
      );
    }

    this.routes.push(route);
  }
}

function matchPath(pattern: string, path: string): Record<string, string> | null {
  const patternSegments = normalizePath(pattern);
  const pathSegments = normalizePath(path);

  if (patternSegments.length !== pathSegments.length) {
    return null;
  }

  const params: Record<string, string> = {};

  for (let index = 0; index < patternSegments.length; index += 1) {
    const patternSegment = patternSegments[index];
    const pathSegment = pathSegments[index];

    if (!patternSegment || !pathSegment) {
      return null;
    }

    if (patternSegment.startsWith(":")) {
      params[patternSegment.slice(1)] = decodeURIComponent(pathSegment);
      continue;
    }

    if (patternSegment !== pathSegment) {
      return null;
    }
  }

  return params;
}

function normalizePath(path: string): string[] {
  return path.split("/").filter((segment) => segment.length > 0);
}
