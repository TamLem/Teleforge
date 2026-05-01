import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

// Inlined helpers must stay in lock-step with `packages/teleforge/src/screens.ts`
// (`toHelperName` and `extractRequiredRouteParams`). Keeping them inlined here
// avoids a circular dependency: `teleforge` depends on `@teleforgex/devtools`,
// so devtools cannot import from `teleforge`.

function toHelperName(id: string): string {
  const name = id
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part, index) =>
      index === 0
        ? part.charAt(0).toLowerCase() + part.slice(1)
        : part.charAt(0).toUpperCase() + part.slice(1)
    )
    .join("");

  if (name.length === 0) {
    throw new Error(`Screen ID "${id}" normalizes to an empty helper name.`);
  }

  if (/^[0-9]/.test(name)) {
    throw new Error(
      `Screen ID "${id}" normalizes to "${name}" which starts with a digit. Helper names must start with a letter.`
    );
  }

  return name;
}

function extractRequiredRouteParams(pattern: string): string[] {
  const parts = pattern.split("/").filter(Boolean);
  return parts.filter((p) => p.startsWith(":")).map((p) => p.slice(1));
}

interface ClientFlowManifestLike {
  flows: ReadonlyArray<{
    id: string;
    miniApp?: {
      defaultRoute?: string;
      routes: Record<string, string>;
      title?: string;
    };
    screens: ReadonlyArray<{
      id: string;
      route?: string;
      actions?: readonly string[];
      title?: string;
      requiresSession?: boolean;
    }>;
  }>;
}

export interface GenerateContractsOptions {
  manifest: ClientFlowManifestLike;
  outputPath: string;
}

/**
 * Emits a browser-safe `contracts.ts` file beside the client flow manifest.
 *
 * The generated file contains type-only contracts derived from the client flow
 * manifest:
 *
 * - per-flow screen ID unions
 * - per-flow action ID unions
 * - per-flow route param maps keyed by helper name
 * - per-flow `TypedNavigationHelpers` aliases
 * - per-screen prop aliases (`<ScreenPascal>ScreenProps`)
 *
 * The file does not import server-only flow modules.
 */
export async function generateContracts(options: GenerateContractsOptions): Promise<string> {
  const overrideFilePath = path.join(
    path.dirname(path.dirname(options.outputPath)),
    "teleforge-contract-overrides.ts"
  );

  let overrideExists = false;
  try {
    await stat(overrideFilePath);
    overrideExists = true;
  } catch {
    // override file does not exist yet
  }

  if (!overrideExists) {
    await mkdir(path.dirname(overrideFilePath), { recursive: true });
    await writeFile(
      overrideFilePath,
      [
        "export interface TeleforgeActionPayloadOverrides {}",
        "export interface TeleforgeLoaderDataOverrides {}",
        ""
      ].join("\n"),
      "utf8"
    );
  }

  const fileContent = formatContracts(options.manifest, options.outputPath);
  await mkdir(path.dirname(options.outputPath), { recursive: true });
  await writeFile(options.outputPath, fileContent, "utf8");
  return options.outputPath;
}

export function formatContracts(manifest: ClientFlowManifestLike, outputPath?: string): string {
  const eligibleFlows = manifest.flows.filter((flow) => flow.miniApp && flow.screens.length > 0);

  // Detect per-screen prop alias name collisions across flows.
  const screenAliasUsage = new Map<string, number>();
  for (const flow of eligibleFlows) {
    for (const screen of flow.screens) {
      const alias = `${toPascalCase(screen.id)}ScreenProps`;
      screenAliasUsage.set(alias, (screenAliasUsage.get(alias) ?? 0) + 1);
    }
  }

  const sections: string[] = [];

  sections.push(
    [
      "// AUTO-GENERATED FILE. DO NOT EDIT.",
      "// Regenerate with `teleforge generate client-manifest`.",
      "//",
      "// Browser-safe type contracts derived from the client flow manifest.",
      "// These contracts make `nav.*` helpers, screen IDs, action IDs, and",
      "// per-screen props compile-time safe."
    ].join("\n")
  );

  const useOverrides = outputPath !== undefined;

  const imports: string[] = [];

  if (useOverrides) {
    const overrideFilePath = path.join(
      path.dirname(path.dirname(outputPath)),
      "teleforge-contract-overrides.ts"
    );
    const overrideImportPath = path
      .relative(path.dirname(outputPath), overrideFilePath)
      .replace(/\.ts$/, "")
      .replace(/\\/g, "/");

    imports.push(
      `import type { TeleforgeActionPayloadOverrides, TeleforgeLoaderDataOverrides } from "${overrideImportPath}";`
    );
  }

  imports.push(
    `import type {\n  TeleforgeScreenComponentProps,\n  TypedActionHelpers,\n  TypedLoaderState,\n  TypedNavigationHelpers,\n  TypedSignHelpers\n} from "teleforge/web";`
  );

  sections.push(imports.join("\n"));

  if (useOverrides) {
    sections.push(
      `type FlowActionPayloadOverrides<TFlowId extends string> =\n  TFlowId extends keyof TeleforgeActionPayloadOverrides\n    ? TeleforgeActionPayloadOverrides[TFlowId] extends object\n      ? TeleforgeActionPayloadOverrides[TFlowId]\n      : {}\n    : {};\n\ntype ApplyActionPayloadOverrides<\n  TDefaults extends Record<string, unknown>,\n  TOverrides extends object\n> = {\n  [TActionId in keyof TDefaults]: TActionId extends keyof TOverrides\n    ? TOverrides[TActionId]\n    : TDefaults[TActionId];\n};\n\ntype FlowLoaderDataOverrides<TFlowId extends string> =\n  TFlowId extends keyof TeleforgeLoaderDataOverrides\n    ? TeleforgeLoaderDataOverrides[TFlowId] extends object\n      ? TeleforgeLoaderDataOverrides[TFlowId]\n      : {}\n    : {};\n\ntype LoaderDataFor<TFlowId extends string, TScreenId extends string> =\n  TScreenId extends keyof FlowLoaderDataOverrides<TFlowId>\n    ? FlowLoaderDataOverrides<TFlowId>[TScreenId]\n    : unknown;`
    );
  }

  for (const flow of eligibleFlows) {
    sections.push(formatFlow(flow, screenAliasUsage, useOverrides));
  }

  return `${sections.join("\n\n")}\n`;
}

function formatFlow(
  flow: ClientFlowManifestLike["flows"][number],
  screenAliasUsage: Map<string, number>,
  useOverrides: boolean
): string {
  const flowPascal = toPascalCase(flow.id);
  const screens = flow.screens;
  const routes = flow.miniApp?.routes ?? {};

  // Map of screenId -> { helperName, requiredParams }, derived from routes.
  //
  // This MUST match the runtime nav helper construction in
  // `packages/teleforge/src/miniapp-runtime.tsx` (`nav` useMemo): the first
  // route encountered for a given screen wins; subsequent routes for the
  // same screen are skipped. Helper name collisions across screens are a
  // hard error.
  type RouteEntry = { helper: string; params: string[] };
  const helperByScreen = new Map<string, RouteEntry>();
  const seenHelpers = new Map<string, string>(); // helper -> screenId

  for (const [pattern, screenId] of Object.entries(routes)) {
    if (helperByScreen.has(screenId)) {
      // First route per screen wins (runtime parity).
      continue;
    }

    const helper = toHelperName(screenId);
    const existingScreenId = seenHelpers.get(helper);
    if (existingScreenId && existingScreenId !== screenId) {
      throw new Error(
        `Generator: helper name "${helper}" collides between screen IDs "${existingScreenId}" and "${screenId}" in flow "${flow.id}".`
      );
    }
    seenHelpers.set(helper, screenId);
    helperByScreen.set(screenId, {
      helper,
      params: extractRequiredRouteParams(pattern)
    });
  }

  // Screens declared in the manifest without a matching route map entry still
  // get screen ID + action ID coverage but no nav helper.
  const screenIds = screens.map((s) => s.id);
  const actionIds = unique(screens.flatMap((s) => s.actions ?? []));

  const lines: string[] = [];

  lines.push(
    [
      "// =====================================================================",
      `// Flow: ${flow.id}`,
      "// ====================================================================="
    ].join("\n")
  );

  lines.push(`export type ${flowPascal}ScreenId =\n${formatStringUnion(screenIds)};`);

  if (actionIds.length > 0) {
    lines.push(`export type ${flowPascal}ActionId =\n${formatStringUnion(actionIds)};`);
  } else {
    lines.push(`export type ${flowPascal}ActionId = never;`);
  }

  // Action payload map. Default payloads are `unknown` (key safety
  // only). When overrides are enabled, merge explicit app-authored payload
  // types via ApplyActionPayloadOverrides so known actions are narrowed
  // and omitted actions fall back to unknown.
  //
  // Action IDs come from arbitrary user-defined `flow.actions` keys
  // (e.g. `"add-to-cart"`), so emit them as quoted property names.
  // Quoted keys still allow dot access for valid identifiers, so
  // `actions.addToCart(...)` keeps working.
  if (actionIds.length > 0) {
    if (useOverrides) {
      lines.push(
        `type ${flowPascal}DefaultActionPayloads = {\n${actionIds
          .map((id) => `  ${JSON.stringify(id)}: unknown;`)
          .join("\n")}\n};`
      );
      lines.push(
        `export type ${flowPascal}ActionPayloads = ApplyActionPayloadOverrides<\n  ${flowPascal}DefaultActionPayloads,\n  FlowActionPayloadOverrides<"${flow.id}">\n>;`
      );
    } else {
      lines.push(
        `export type ${flowPascal}ActionPayloads = {\n${actionIds
          .map((id) => `  ${JSON.stringify(id)}: unknown;`)
          .join("\n")}\n};`
      );
    }
    lines.push(
      `export type ${flowPascal}Actions = TypedActionHelpers<${flowPascal}ActionPayloads>;`
    );
  } else {
    lines.push(`export type ${flowPascal}ActionPayloads = Readonly<Record<never, never>>;`);
    lines.push(
      `export type ${flowPascal}Actions = TypedActionHelpers<${flowPascal}ActionPayloads>;`
    );
  }

  // Route params map keyed by helper name.
  const routeParamEntries: Array<{ helper: string; type: string }> = [];
  for (const screen of screens) {
    const entry = helperByScreen.get(screen.id);
    if (!entry) continue;
    routeParamEntries.push({
      helper: entry.helper,
      type:
        entry.params.length === 0
          ? "undefined"
          : `{ ${entry.params.map((name) => `${name}: string`).join("; ")} }`
    });
  }

  if (routeParamEntries.length > 0) {
    lines.push(
      `export type ${flowPascal}RouteParams = {\n${routeParamEntries
        .map(({ helper, type }) => `  ${helper}: ${type};`)
        .join("\n")}\n};`
    );
    lines.push(`export type ${flowPascal}Nav = TypedNavigationHelpers<${flowPascal}RouteParams>;`);
    lines.push(`export type ${flowPascal}Sign = TypedSignHelpers<${flowPascal}RouteParams>;`);
  } else {
    lines.push(`export type ${flowPascal}RouteParams = Record<string, never>;`);
    lines.push(`export type ${flowPascal}Nav = TypedNavigationHelpers<${flowPascal}RouteParams>;`);
    lines.push(`export type ${flowPascal}Sign = TypedSignHelpers<${flowPascal}RouteParams>;`);
  }

  // Per-screen prop aliases.
  for (const screen of screens) {
    const baseAlias = `${toPascalCase(screen.id)}ScreenProps`;
    const collision = (screenAliasUsage.get(baseAlias) ?? 0) > 1;
    const alias = collision ? `${flowPascal}${baseAlias}` : baseAlias;
    const entry = helperByScreen.get(screen.id);
    // Use `Readonly<Record<never, never>>` (a sealed empty object type)
    // for static routes so accessing an undeclared key like
    // `routeParams.id` is a real type error, not just `never`-typed.
    const routeParamsType =
      !entry || entry.params.length === 0
        ? "Readonly<Record<never, never>>"
        : `{ ${entry.params.map((name) => `${name}: string`).join("; ")} }`;

    const loaderDataType = useOverrides ? `LoaderDataFor<"${flow.id}", "${screen.id}">` : "unknown";

    lines.push(
      `export type ${alias} = Omit<
  TeleforgeScreenComponentProps,
  "screenId" | "routeParams" | "nav" | "actions" | "loader" | "loaderData"
> & {
  screenId: "${screen.id}";
  routeParams: ${routeParamsType};
  nav: ${flowPascal}Nav;
  actions: ${flowPascal}Actions;
  loader: TypedLoaderState<${loaderDataType}>;
  loaderData?: ${loaderDataType};
};`
    );
  }

  return lines.join("\n\n");
}

function formatStringUnion(values: string[]): string {
  if (values.length === 0) {
    return "  never";
  }
  return values.map((v) => `  | "${v}"`).join("\n");
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function toPascalCase(id: string): string {
  const parts = id.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  if (parts.length === 0) {
    throw new Error(`Cannot derive a Pascal case name from "${id}".`);
  }
  return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("");
}
