// AUTO-GENERATED FILE. DO NOT EDIT.
// Regenerate with `teleforge generate client-manifest`.
//
// Browser-safe type contracts derived from the client flow manifest.
// These contracts make `nav.*` helpers, screen IDs, action IDs, and
// per-screen props compile-time safe.

import type { TeleforgeActionPayloadOverrides, TeleforgeLoaderDataOverrides } from "../teleforge-contract-overrides";
import type {
  TeleforgeScreenComponentProps,
  TypedActionHelpers,
  TypedLoaderState,
  TypedNavigationHelpers
} from "teleforge/web";

type FlowActionPayloadOverrides<TFlowId extends string> =
  TFlowId extends keyof TeleforgeActionPayloadOverrides
    ? TeleforgeActionPayloadOverrides[TFlowId] extends object
      ? TeleforgeActionPayloadOverrides[TFlowId]
      : {}
    : {};

type ApplyActionPayloadOverrides<
  TDefaults extends Record<string, unknown>,
  TOverrides extends object
> = {
  [TActionId in keyof TDefaults]: TActionId extends keyof TOverrides
    ? TOverrides[TActionId]
    : TDefaults[TActionId];
};

type FlowLoaderDataOverrides<TFlowId extends string> =
  TFlowId extends keyof TeleforgeLoaderDataOverrides
    ? TeleforgeLoaderDataOverrides[TFlowId] extends object
      ? TeleforgeLoaderDataOverrides[TFlowId]
      : {}
    : {};

type LoaderDataFor<TFlowId extends string, TScreenId extends string> =
  TScreenId extends keyof FlowLoaderDataOverrides<TFlowId>
    ? FlowLoaderDataOverrides<TFlowId>[TScreenId]
    : unknown;

// =====================================================================
// Flow: gadgetshop
// =====================================================================

export type GadgetshopScreenId =
  | "catalog"
  | "product-detail"
  | "cart"
  | "confirmation"
  | "tracking";

export type GadgetshopActionId =
  | "addToCart"
  | "removeFromCart"
  | "placeOrder";

type GadgetshopDefaultActionPayloads = {
  "addToCart": unknown;
  "removeFromCart": unknown;
  "placeOrder": unknown;
};

export type GadgetshopActionPayloads = ApplyActionPayloadOverrides<
  GadgetshopDefaultActionPayloads,
  FlowActionPayloadOverrides<"gadgetshop">
>;

export type GadgetshopActions = TypedActionHelpers<GadgetshopActionPayloads>;

export type GadgetshopRouteParams = {
  catalog: undefined;
  productDetail: { id: string };
  cart: undefined;
  confirmation: undefined;
  tracking: undefined;
};

export type GadgetshopNav = TypedNavigationHelpers<GadgetshopRouteParams>;

export type CatalogScreenProps = Omit<
  TeleforgeScreenComponentProps,
  "screenId" | "routeParams" | "nav" | "actions" | "loader" | "loaderData"
> & {
  screenId: "catalog";
  routeParams: Readonly<Record<never, never>>;
  nav: GadgetshopNav;
  actions: GadgetshopActions;
  loader: TypedLoaderState<LoaderDataFor<"gadgetshop", "catalog">>;
  loaderData?: LoaderDataFor<"gadgetshop", "catalog">;
};

export type ProductDetailScreenProps = Omit<
  TeleforgeScreenComponentProps,
  "screenId" | "routeParams" | "nav" | "actions" | "loader" | "loaderData"
> & {
  screenId: "product-detail";
  routeParams: { id: string };
  nav: GadgetshopNav;
  actions: GadgetshopActions;
  loader: TypedLoaderState<LoaderDataFor<"gadgetshop", "product-detail">>;
  loaderData?: LoaderDataFor<"gadgetshop", "product-detail">;
};

export type CartScreenProps = Omit<
  TeleforgeScreenComponentProps,
  "screenId" | "routeParams" | "nav" | "actions" | "loader" | "loaderData"
> & {
  screenId: "cart";
  routeParams: Readonly<Record<never, never>>;
  nav: GadgetshopNav;
  actions: GadgetshopActions;
  loader: TypedLoaderState<LoaderDataFor<"gadgetshop", "cart">>;
  loaderData?: LoaderDataFor<"gadgetshop", "cart">;
};

export type ConfirmationScreenProps = Omit<
  TeleforgeScreenComponentProps,
  "screenId" | "routeParams" | "nav" | "actions" | "loader" | "loaderData"
> & {
  screenId: "confirmation";
  routeParams: Readonly<Record<never, never>>;
  nav: GadgetshopNav;
  actions: GadgetshopActions;
  loader: TypedLoaderState<LoaderDataFor<"gadgetshop", "confirmation">>;
  loaderData?: LoaderDataFor<"gadgetshop", "confirmation">;
};

export type TrackingScreenProps = Omit<
  TeleforgeScreenComponentProps,
  "screenId" | "routeParams" | "nav" | "actions" | "loader" | "loaderData"
> & {
  screenId: "tracking";
  routeParams: Readonly<Record<never, never>>;
  nav: GadgetshopNav;
  actions: GadgetshopActions;
  loader: TypedLoaderState<LoaderDataFor<"gadgetshop", "tracking">>;
  loaderData?: LoaderDataFor<"gadgetshop", "tracking">;
};
