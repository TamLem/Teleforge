// AUTO-GENERATED FILE. DO NOT EDIT.
// Regenerate with `teleforge generate client-manifest`.
//
// Browser-safe type contracts derived from the client flow manifest.
// These contracts make `nav.*` helpers, screen IDs, action IDs, and
// per-screen props compile-time safe.

import type { TeleforgeActionPayloadOverrides } from "../teleforge-contract-overrides";
import type {
  TeleforgeScreenComponentProps,
  TypedActionHelpers,
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
  "screenId" | "routeParams" | "nav" | "actions"
> & {
  screenId: "catalog";
  routeParams: Readonly<Record<never, never>>;
  nav: GadgetshopNav;
  actions: GadgetshopActions;
};

export type ProductDetailScreenProps = Omit<
  TeleforgeScreenComponentProps,
  "screenId" | "routeParams" | "nav" | "actions"
> & {
  screenId: "product-detail";
  routeParams: { id: string };
  nav: GadgetshopNav;
  actions: GadgetshopActions;
};

export type CartScreenProps = Omit<
  TeleforgeScreenComponentProps,
  "screenId" | "routeParams" | "nav" | "actions"
> & {
  screenId: "cart";
  routeParams: Readonly<Record<never, never>>;
  nav: GadgetshopNav;
  actions: GadgetshopActions;
};

export type ConfirmationScreenProps = Omit<
  TeleforgeScreenComponentProps,
  "screenId" | "routeParams" | "nav" | "actions"
> & {
  screenId: "confirmation";
  routeParams: Readonly<Record<never, never>>;
  nav: GadgetshopNav;
  actions: GadgetshopActions;
};

export type TrackingScreenProps = Omit<
  TeleforgeScreenComponentProps,
  "screenId" | "routeParams" | "nav" | "actions"
> & {
  screenId: "tracking";
  routeParams: Readonly<Record<never, never>>;
  nav: GadgetshopNav;
  actions: GadgetshopActions;
};
