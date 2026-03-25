import type { BffRouteDefinition } from "../route/types.js";

export type InferBffRouteInput<TRoute extends BffRouteDefinition<unknown, unknown>> =
  TRoute extends BffRouteDefinition<infer TInput, unknown> ? TInput : never;

export type InferBffRouteOutput<TRoute extends BffRouteDefinition<unknown, unknown>> =
  TRoute extends BffRouteDefinition<unknown, infer TOutput> ? TOutput : never;

export type BffClientShape<TRoutes extends Record<string, BffRouteDefinition<unknown, unknown>>> = {
  [K in keyof TRoutes]: (
    input: InferBffRouteInput<TRoutes[K]>
  ) => Promise<InferBffRouteOutput<TRoutes[K]>>;
};
