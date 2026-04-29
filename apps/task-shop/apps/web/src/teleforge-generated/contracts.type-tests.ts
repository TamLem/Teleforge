/**
 * Compile-time tests for generated nav contracts.
 *
 * Uses `@ts-expect-error` to assert that invalid `nav.*` calls fail
 * typechecking. If a regression makes a bad call compile, the directive
 * becomes "unused" and `tsc --noEmit` fails.
 *
 * The tests run twice: once against the stand-alone `GadgetshopNav` type
 * and once against the per-screen prop aliases that screens actually
 * consume. Both must hold so authors get safety regardless of how they
 * import the contract.
 */

import { defineScreen } from "teleforge/web";

import type {
  CatalogScreenProps,
  GadgetshopNav,
  ProductDetailScreenProps
} from "./contracts";

declare const nav: GadgetshopNav;
declare const productProps: ProductDetailScreenProps;
declare const catalogProps: CatalogScreenProps;

function runDefineScreenConstraintTypeTests(): void {
  // Valid: a screen built against a generated narrowed prop alias is
  // accepted by `defineScreen`.
  defineScreen<CatalogScreenProps>({
    id: "catalog",
    component: () => null
  });

  // Invalid: a component that asks for fields the runtime never
  // provides must be rejected by `defineScreen`'s constraint.
  defineScreen({
    id: "bad",
    // @ts-expect-error component prop shape is incompatible with the runtime contract.
    component: (_props: { foo: string }) => null
  });
}

function runStandaloneNavTypeTests(): void {
  // Valid: static routes take no params.
  nav.catalog();
  nav.cart();
  nav.confirmation();
  nav.tracking();

  // Valid: dynamic route requires { id }.
  nav.productDetail({ id: "iphone-15" });

  // Valid: optional NavigateOptions.
  nav.catalog(undefined, { data: { ref: "header" } });
  nav.productDetail({ id: "iphone-15" }, { data: { source: "catalog" } });

  // Invalid: missing required route param.
  // @ts-expect-error productDetail requires { id: string }.
  nav.productDetail();

  // Invalid: wrong route param key.
  // @ts-expect-error productDetail expects "id", not "productId".
  nav.productDetail({ productId: "iphone-15" });

  // Invalid: extra/unknown route param.
  // @ts-expect-error productDetail does not accept "slug".
  nav.productDetail({ id: "iphone-15", slug: "x" });

  // Invalid: passing params to a static route.
  // @ts-expect-error catalog takes no params.
  nav.catalog({ id: "x" });

  // Invalid: unknown screen helper.
  // @ts-expect-error notAScreen does not exist on GadgetshopNav.
  nav.notAScreen();

  // Invalid: param value of wrong type.
  // @ts-expect-error id must be a string.
  nav.productDetail({ id: 123 });
}

function runScreenPropsActionsTypeTests(): void {
  // -------------------------------------------------------------------
  // Phase 3 (action key safety): generated screen props must narrow
  // `actions` so unknown action helpers fail at compile time. Payload
  // typing is `unknown` in this phase, so any payload value is allowed
  // for known actions until explicit payload maps are layered in.
  // -------------------------------------------------------------------

  // Valid: known action with permissive payload.
  void catalogProps.actions.addToCart({ productId: "iphone-15", qty: 1 });
  void catalogProps.actions.addToCart(undefined);
  void catalogProps.actions.removeFromCart({ productId: "x" });
  void catalogProps.actions.placeOrder({});

  // Invalid: unknown action helper must fail through screen props.
  // @ts-expect-error notAnAction does not exist on screen-props actions.
  void catalogProps.actions.notAnAction();

  // @ts-expect-error addtocart casing mismatch.
  void catalogProps.actions.addtocart({ productId: "x", qty: 1 });

  // -------------------------------------------------------------------
  // Same checks must hold through ProductDetailScreenProps.
  // -------------------------------------------------------------------
  void productProps.actions.addToCart({ productId: "x", qty: 1 });

  // @ts-expect-error unknown action through ProductDetailScreenProps.
  void productProps.actions.notAnAction();
}

function runScreenPropsTypeTests(): void {
  // -------------------------------------------------------------------
  // ProductDetailScreenProps must narrow nav, routeParams, and screenId.
  // -------------------------------------------------------------------

  // Valid: dynamic route helper with required params.
  productProps.nav.productDetail({ id: "iphone-15" });
  productProps.nav.cart();

  // Invalid: unknown helper must fail through screen props too.
  // @ts-expect-error notAScreen does not exist on screen props nav.
  productProps.nav.notAScreen();

  // Invalid: required route param must still be required through screen
  // props.
  // @ts-expect-error productDetail requires { id: string }.
  productProps.nav.productDetail();

  // Invalid: wrong helper-shape param.
  // @ts-expect-error productDetail expects "id", not "productId".
  productProps.nav.productDetail({ productId: "x" });

  // routeParams must expose only the declared keys.
  const id: string = productProps.routeParams.id;
  void id;

  // @ts-expect-error routeParams should not expose arbitrary keys.
  void productProps.routeParams.productId;

  // screenId must be the literal string for this screen.
  const screenId: "product-detail" = productProps.screenId;
  void screenId;

  // @ts-expect-error screenId is narrowed to "product-detail" only.
  const wrongScreenId: "catalog" = productProps.screenId;
  void wrongScreenId;

  // -------------------------------------------------------------------
  // CatalogScreenProps must reject route params for a static route.
  // -------------------------------------------------------------------

  // routeParams must be empty.
  // @ts-expect-error catalog routeParams declares no keys.
  void catalogProps.routeParams.id;

  // @ts-expect-error nav must reject unknown helpers via screen props too.
  catalogProps.nav.notAScreen();
}

// Reference all runners so they are not pruned as unused, but never
// invoke them.
export const __contractsTypeTestsReference: ReadonlyArray<() => void> = [
  runStandaloneNavTypeTests,
  runScreenPropsTypeTests,
  runScreenPropsActionsTypeTests,
  runDefineScreenConstraintTypeTests
];
