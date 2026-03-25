import type { CoordinatedRouteLike, LaunchEntryPoint, RouteCoordinationMetadata } from "./types.js";

export function attachRouteCoordination<TRoute extends object>(
  route: TRoute,
  coordination: RouteCoordinationMetadata
): Readonly<TRoute & { coordination: RouteCoordinationMetadata }> {
  return Object.freeze({
    ...route,
    coordination: normalizeRouteCoordination(coordination)
  });
}

export function defineCoordinatedRoute<TRoute extends CoordinatedRouteLike>(
  route: TRoute & { coordination: RouteCoordinationMetadata }
): Readonly<TRoute> {
  return attachRouteCoordination(route, route.coordination) as Readonly<TRoute>;
}

export function getRouteCoordination(
  route: Partial<CoordinatedRouteLike>
): RouteCoordinationMetadata | undefined {
  return route.coordination ? normalizeRouteCoordination(route.coordination) : undefined;
}

export function normalizeRouteCoordination(
  coordination: RouteCoordinationMetadata
): RouteCoordinationMetadata {
  if (coordination.entryPoints.length === 0) {
    throw new Error("Route coordination metadata requires at least one entry point.");
  }

  return Object.freeze({
    ...coordination,
    entryPoints: Object.freeze(coordination.entryPoints.map(cloneEntryPoint))
  });
}

function cloneEntryPoint(entryPoint: LaunchEntryPoint): LaunchEntryPoint {
  return {
    ...entryPoint
  };
}
