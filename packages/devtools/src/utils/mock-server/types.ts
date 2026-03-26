import { createHmac } from "node:crypto";

export type MockPlatform = "ios" | "android" | "web" | "macos" | "tdesktop";
export type MockColorScheme = "light" | "dark";
export type MockLaunchMode = "inline" | "compact" | "fullscreen" | "full";

export interface MockProfile {
  version: "1.0";
  name: string;
  description?: string;
  user: {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
    is_premium?: boolean;
    photo_url?: string;
  };
  launchParams: {
    query_id?: string;
    auth_date: number;
    hash: string;
    start_param?: string;
    startapp?: string;
  };
  appContext: {
    version: string;
    platform: MockPlatform;
    colorScheme: MockColorScheme;
    launchMode: MockLaunchMode;
    viewportHeight: number;
    viewportWidth: number;
    isExpanded: boolean;
  };
  capabilities: {
    read?: boolean;
    write?: boolean;
  };
}

export interface MockEventLogEntry {
  at: string;
  id: string;
  name: string;
  payload?: unknown;
}

export interface MockExportFile {
  $schema: "https://teleforge.dev/schemas/mock-profile.json";
  exported_at: string;
  profile: MockProfile;
  version: "1.0";
}

export type PartialMockProfile = Partial<MockProfile> & {
  appContext?: Partial<MockProfile["appContext"]>;
  capabilities?: Partial<MockProfile["capabilities"]>;
  launchParams?: Partial<MockProfile["launchParams"]>;
  user?: Partial<MockProfile["user"]>;
};

export function createDefaultProfile(botToken = "mock-bot-token"): MockProfile {
  const profile: MockProfile = {
    version: "1.0",
    name: "Default Profile",
    description: "Default Teleforge mock profile",
    user: {
      id: 42,
      first_name: "Dev",
      username: "teleforge_dev",
      language_code: "en",
      is_premium: false
    },
    launchParams: {
      query_id: "teleforge-query",
      auth_date: Math.floor(Date.now() / 1000),
      hash: "",
      start_param: "welcome"
    },
    appContext: {
      version: "7.2",
      platform: "ios",
      colorScheme: "light",
      launchMode: "inline",
      viewportHeight: 720,
      viewportWidth: 390,
      isExpanded: true
    },
    capabilities: {
      read: true,
      write: true
    }
  };

  return refreshProfile(profile, botToken);
}

export function refreshProfile(
  input: PartialMockProfile | MockProfile,
  botToken = "mock-bot-token"
): MockProfile {
  const base = createBaseProfile();
  const merged: MockProfile = {
    version: "1.0",
    name: stringOrDefault(input.name, base.name),
    description:
      typeof input.description === "string" && input.description.trim().length > 0
        ? input.description.trim()
        : base.description,
    user: {
      id: numberOrDefault(input.user?.id, base.user.id),
      first_name: stringOrDefault(input.user?.first_name, base.user.first_name),
      last_name: optionalString(input.user?.last_name),
      username: optionalString(input.user?.username),
      language_code: optionalString(input.user?.language_code) ?? base.user.language_code,
      is_premium: booleanOrDefault(input.user?.is_premium, base.user.is_premium),
      photo_url: optionalString(input.user?.photo_url)
    },
    launchParams: {
      query_id: optionalString(input.launchParams?.query_id) ?? base.launchParams.query_id,
      auth_date: numberOrDefault(input.launchParams?.auth_date, base.launchParams.auth_date),
      hash: "",
      start_param: optionalString(input.launchParams?.start_param),
      startapp: optionalString(input.launchParams?.startapp)
    },
    appContext: {
      version: stringOrDefault(input.appContext?.version, base.appContext.version),
      platform: platformOrDefault(input.appContext?.platform, base.appContext.platform),
      colorScheme: colorSchemeOrDefault(input.appContext?.colorScheme, base.appContext.colorScheme),
      launchMode: launchModeOrDefault(input.appContext?.launchMode, base.appContext.launchMode),
      viewportHeight: numberOrDefault(
        input.appContext?.viewportHeight,
        base.appContext.viewportHeight
      ),
      viewportWidth: numberOrDefault(
        input.appContext?.viewportWidth,
        base.appContext.viewportWidth
      ),
      isExpanded:
        typeof input.appContext?.isExpanded === "boolean"
          ? input.appContext.isExpanded
          : base.appContext.isExpanded
    },
    capabilities: {
      read: booleanOrDefault(input.capabilities?.read, base.capabilities.read),
      write: booleanOrDefault(input.capabilities?.write, base.capabilities.write)
    }
  };

  merged.launchParams.hash = generateLaunchHash(merged, botToken);
  return merged;
}

export function mergeProfile(
  current: MockProfile,
  patch: PartialMockProfile,
  botToken = "mock-bot-token"
): MockProfile {
  return refreshProfile(
    {
      ...current,
      ...patch,
      user: {
        ...current.user,
        ...patch.user
      },
      launchParams: {
        ...current.launchParams,
        ...patch.launchParams
      },
      appContext: {
        ...current.appContext,
        ...patch.appContext
      },
      capabilities: {
        ...current.capabilities,
        ...patch.capabilities
      }
    },
    botToken
  );
}

export function createExportFile(profile: MockProfile): MockExportFile {
  return {
    $schema: "https://teleforge.dev/schemas/mock-profile.json",
    version: "1.0",
    exported_at: new Date().toISOString(),
    profile
  };
}

export function parseProfile(input: unknown, botToken = "mock-bot-token"): MockProfile {
  if (!isRecord(input)) {
    throw new Error("Mock profile must be an object.");
  }

  return refreshProfile(input as PartialMockProfile, botToken);
}

export function parseExportFile(input: unknown, botToken = "mock-bot-token"): MockExportFile {
  if (!isRecord(input)) {
    throw new Error("Mock export file must be an object.");
  }

  if (input.version !== "1.0") {
    throw new Error("Unsupported mock export version.");
  }

  return {
    $schema: "https://teleforge.dev/schemas/mock-profile.json",
    exported_at:
      typeof input.exported_at === "string" ? input.exported_at : new Date().toISOString(),
    profile: parseProfile(input.profile, botToken),
    version: "1.0"
  };
}

export function slugifyProfileName(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "profile"
  );
}

export function generateLaunchHash(profile: MockProfile, botToken = "mock-bot-token"): string {
  const fields: string[] = [];
  fields.push(`auth_date=${profile.launchParams.auth_date}`);

  if (profile.launchParams.query_id) {
    fields.push(`query_id=${profile.launchParams.query_id}`);
  }

  if (profile.launchParams.start_param) {
    fields.push(`start_param=${profile.launchParams.start_param}`);
  }

  if (profile.launchParams.startapp) {
    fields.push(`startapp=${profile.launchParams.startapp}`);
  }

  fields.push(`user=${JSON.stringify(profile.user)}`);

  return createHmac("sha256", botToken).update(fields.sort().join("\n")).digest("hex");
}

function createBaseProfile(): MockProfile {
  return {
    version: "1.0",
    name: "Default Profile",
    description: "Default Teleforge mock profile",
    user: {
      id: 42,
      first_name: "Dev",
      username: "teleforge_dev",
      language_code: "en",
      is_premium: false
    },
    launchParams: {
      query_id: "teleforge-query",
      auth_date: Math.floor(Date.now() / 1000),
      hash: "",
      start_param: "welcome"
    },
    appContext: {
      version: "7.2",
      platform: "ios",
      colorScheme: "light",
      launchMode: "inline",
      viewportHeight: 720,
      viewportWidth: 390,
      isExpanded: true
    },
    capabilities: {
      read: true,
      write: true
    }
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringOrDefault(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function numberOrDefault(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function booleanOrDefault(value: unknown, fallback: boolean | undefined): boolean | undefined {
  return typeof value === "boolean" ? value : fallback;
}

function platformOrDefault(value: unknown, fallback: MockPlatform): MockPlatform {
  return value === "ios" ||
    value === "android" ||
    value === "web" ||
    value === "macos" ||
    value === "tdesktop"
    ? value
    : fallback;
}

function colorSchemeOrDefault(value: unknown, fallback: MockColorScheme): MockColorScheme {
  return value === "light" || value === "dark" ? value : fallback;
}

function launchModeOrDefault(value: unknown, fallback: MockLaunchMode): MockLaunchMode {
  return value === "inline" || value === "compact" || value === "fullscreen" || value === "full"
    ? value
    : fallback;
}
