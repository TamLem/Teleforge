import { readFile } from "node:fs/promises";
import path from "node:path";

export interface TeleforgeManifest {
  $schema?: string;
  id?: string;
  name?: string;
  version?: string;
  bot?: {
    username?: string;
    tokenEnv?: string;
    webhook?: {
      path?: string;
      secretEnv?: string;
    };
    commands?: Array<{
      command?: string;
      description?: string;
      handler?: string;
    }>;
  };
  miniApp?: {
    url?: string;
    entryPoint?: string;
    launchModes?: string[];
    defaultMode?: string;
    capabilities?: string[];
  };
  permissions?: Array<{
    capability?: string;
    description?: string;
  }>;
  routes?: Array<{
    path?: string;
    component?: string;
    launchModes?: string[];
    guards?: string[];
  }>;
  runtime: {
    mode: "spa" | "bff";
    webFramework: "vite" | "nextjs";
    apiRoutes?: string;
    build?: {
      basePath?: string;
      outDir?: string;
    };
  };
}

export async function loadManifest(
  cwd: string
): Promise<{ manifest: TeleforgeManifest; manifestPath: string }> {
  const manifestPath = path.join(cwd, "teleforge.app.json");
  let rawManifest: string;

  try {
    rawManifest = await readFile(manifestPath, "utf8");
  } catch {
    throw new Error(
      "No Teleforge project found. Run `teleforge init` or ensure you're in a project directory."
    );
  }

  let manifest: unknown;

  try {
    manifest = JSON.parse(rawManifest);
  } catch (error) {
    throw new Error(formatJsonError(error, rawManifest));
  }

  const runtime = (manifest as Record<string, unknown>).runtime as Record<string, unknown> | undefined;
  const mode = runtime?.mode;
  const webFramework = runtime?.webFramework;

  if ((mode !== "spa" && mode !== "bff") || (webFramework !== "vite" && webFramework !== "nextjs")) {
    throw new Error("Invalid teleforge.app.json: runtime.mode or runtime.webFramework is not supported.");
  }

  if ((mode === "spa" && webFramework !== "vite") || (mode === "bff" && webFramework !== "nextjs")) {
    throw new Error("Invalid teleforge.app.json: runtime.mode and runtime.webFramework do not match.");
  }

  const record = manifest as Record<string, unknown>;
  const bot = record.bot as Record<string, unknown> | undefined;
  const webhook = bot?.webhook as Record<string, unknown> | undefined;
  const commands = Array.isArray(bot?.commands) ? bot.commands : [];
  const miniApp = record.miniApp as Record<string, unknown> | undefined;
  const routes = Array.isArray(record.routes) ? record.routes : [];
  const permissions = Array.isArray(record.permissions) ? record.permissions : [];
  const build = runtime?.build as Record<string, unknown> | undefined;

  return {
    manifest: {
      $schema: typeof record.$schema === "string" ? record.$schema : undefined,
      id: typeof record.id === "string" ? record.id : undefined,
      name: typeof record.name === "string" ? record.name : undefined,
      version: typeof record.version === "string" ? record.version : undefined,
      bot: bot
        ? {
            username: typeof bot.username === "string" ? bot.username : undefined,
            tokenEnv: typeof bot.tokenEnv === "string" ? bot.tokenEnv : undefined,
            webhook: webhook
              ? {
                  path: typeof webhook.path === "string" ? webhook.path : undefined,
                  secretEnv: typeof webhook.secretEnv === "string" ? webhook.secretEnv : undefined
                }
              : undefined,
            commands: commands.map((command) => {
              const entry = command as Record<string, unknown>;
              return {
                command: typeof entry.command === "string" ? entry.command : undefined,
                description:
                  typeof entry.description === "string" ? entry.description : undefined,
                handler: typeof entry.handler === "string" ? entry.handler : undefined
              };
            })
          }
        : undefined,
      miniApp: miniApp
        ? {
            url: typeof miniApp.url === "string" ? miniApp.url : undefined,
            entryPoint:
              typeof miniApp.entryPoint === "string" ? miniApp.entryPoint : undefined,
            launchModes: toStringArray(miniApp.launchModes),
            defaultMode:
              typeof miniApp.defaultMode === "string" ? miniApp.defaultMode : undefined,
            capabilities: toStringArray(miniApp.capabilities)
          }
        : undefined,
      permissions: permissions.map((permission) => {
        const entry = permission as Record<string, unknown>;
        return {
          capability: typeof entry.capability === "string" ? entry.capability : undefined,
          description: typeof entry.description === "string" ? entry.description : undefined
        };
      }),
      routes: routes.map((route) => {
        const entry = route as Record<string, unknown>;
        return {
          path: typeof entry.path === "string" ? entry.path : undefined,
          component: typeof entry.component === "string" ? entry.component : undefined,
          launchModes: toStringArray(entry.launchModes),
          guards: toStringArray(entry.guards)
        };
      }),
      runtime: {
        mode,
        webFramework,
        apiRoutes: typeof runtime?.apiRoutes === "string" ? runtime.apiRoutes : undefined,
        build: build
          ? {
              basePath: typeof build.basePath === "string" ? build.basePath : undefined,
              outDir: typeof build.outDir === "string" ? build.outDir : undefined
            }
          : undefined
      }
    },
    manifestPath
  };
}

function toStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value.filter((item): item is string => typeof item === "string");
}

function formatJsonError(error: unknown, source: string): string {
  const message = error instanceof Error ? error.message : String(error);
  const lineColumnMatch = message.match(/line\s+(\d+)\s+column\s+(\d+)/i);

  if (lineColumnMatch) {
    return `Invalid teleforge.app.json: ${message}`;
  }

  const positionMatch = message.match(/position\s+(\d+)/i);
  if (!positionMatch) {
    return `Invalid teleforge.app.json: ${message}`;
  }

  const position = Number.parseInt(positionMatch[1] ?? "0", 10);
  const preceding = source.slice(0, position);
  const lines = preceding.split(/\r?\n/);
  const line = lines.length;
  const column = (lines.at(-1)?.length ?? 0) + 1;
  return `Invalid teleforge.app.json at line ${line}, column ${column}: ${message}`;
}
