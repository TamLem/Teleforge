import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { resolveTeleforgeHome } from "./mock-server/storage.js";
import {
  parseProfile,
  slugifyProfileName,
  type MockEventLogEntry,
  type MockProfile
} from "./mock-server/types.js";

export interface DevSimulatorTranscriptEntry {
  at: string;
  buttons?: Array<{
    kind: "callback" | "web_app";
    text: string;
    value: string;
  }>;
  id: string;
  role: "bot" | "system" | "user";
  text: string;
}

export interface DevSimulatorScenario {
  name: string;
  events: MockEventLogEntry[];
  profile: MockProfile;
  transcript: DevSimulatorTranscriptEntry[];
}

interface DevSimulatorScenarioFile {
  $schema: "https://teleforge.dev/schemas/dev-scenario.json";
  name: string;
  saved_at: string;
  state: {
    events: MockEventLogEntry[];
    profile: MockProfile;
    transcript: DevSimulatorTranscriptEntry[];
  };
  version: "1.0";
}

export interface DevSimulatorScenarioStorage {
  describe(): { rootDir: string; scenariosDir: string };
  listScenarios(): Promise<Array<{ fileName: string; name: string }>>;
  loadScenario(name: string): Promise<DevSimulatorScenario>;
  saveScenario(
    scenario: DevSimulatorScenario,
    explicitName?: string
  ): Promise<{ fileName: string; name: string }>;
}

export async function createDevSimulatorScenarioStorage(
  rootDir = resolveTeleforgeHome()
): Promise<DevSimulatorScenarioStorage> {
  const scenariosDir = path.join(rootDir, "scenarios");
  await mkdir(scenariosDir, { recursive: true });

  return {
    describe() {
      return {
        rootDir,
        scenariosDir
      };
    },
    async listScenarios() {
      const entries = await readdir(scenariosDir);
      const names = entries.filter((entry) => entry.endsWith(".json")).sort();

      return Promise.all(
        names.map(async (entry) => {
          const raw = await readFile(path.join(scenariosDir, entry), "utf8");
          const scenario = parseScenarioFile(JSON.parse(raw));
          return {
            fileName: entry,
            name: scenario.name
          };
        })
      );
    },
    async loadScenario(name) {
      const raw = await readFile(resolveScenarioPath(scenariosDir, name), "utf8");
      return parseScenarioFile(JSON.parse(raw));
    },
    async saveScenario(scenario, explicitName) {
      const name = explicitName?.trim() || scenario.name.trim() || "simulator-session";
      const fileName = `${slugifyProfileName(name)}.json`;
      const payload = createScenarioFile({
        ...scenario,
        name
      });
      await writeFile(
        path.join(scenariosDir, fileName),
        `${JSON.stringify(payload, null, 2)}\n`,
        "utf8"
      );
      return {
        fileName,
        name
      };
    }
  };
}

function createScenarioFile(scenario: DevSimulatorScenario): DevSimulatorScenarioFile {
  return {
    $schema: "https://teleforge.dev/schemas/dev-scenario.json",
    name: scenario.name,
    saved_at: new Date().toISOString(),
    state: {
      events: normalizeEvents(scenario.events),
      profile: parseProfile(scenario.profile, process.env.BOT_TOKEN),
      transcript: normalizeTranscript(scenario.transcript)
    },
    version: "1.0"
  };
}

function parseScenarioFile(input: unknown): DevSimulatorScenario {
  if (!isRecord(input) || input.version !== "1.0" || !isRecord(input.state)) {
    throw new Error("Invalid simulator scenario file.");
  }

  return {
    events: normalizeEvents(input.state.events),
    name:
      typeof input.name === "string" && input.name.trim().length > 0
        ? input.name.trim()
        : "simulator-session",
    profile: parseProfile(input.state.profile, process.env.BOT_TOKEN),
    transcript: normalizeTranscript(input.state.transcript)
  };
}

function normalizeEvents(input: unknown): MockEventLogEntry[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.flatMap((entry) => {
    if (!isRecord(entry) || typeof entry.id !== "string" || typeof entry.name !== "string") {
      return [];
    }

    return [
      {
        at: typeof entry.at === "string" ? entry.at : new Date().toISOString(),
        id: entry.id,
        name: entry.name,
        payload: "payload" in entry ? entry.payload : undefined
      }
    ];
  });
}

function normalizeTranscript(input: unknown): DevSimulatorTranscriptEntry[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.flatMap((entry) => {
    if (!isRecord(entry) || typeof entry.id !== "string" || typeof entry.text !== "string") {
      return [];
    }

    const role =
      entry.role === "bot" || entry.role === "system" || entry.role === "user"
        ? entry.role
        : "system";
    const buttons: DevSimulatorTranscriptEntry["buttons"] = Array.isArray(entry.buttons)
      ? entry.buttons.flatMap((button) => {
          if (
            !isRecord(button) ||
            (button.kind !== "callback" && button.kind !== "web_app") ||
            typeof button.text !== "string" ||
            typeof button.value !== "string"
          ) {
            return [];
          }

          return [
            {
              kind: button.kind,
              text: button.text,
              value: button.value
            }
          ];
        })
      : undefined;

    return [
      {
        at: typeof entry.at === "string" ? entry.at : new Date().toISOString(),
        buttons: buttons && buttons.length > 0 ? buttons : undefined,
        id: entry.id,
        role,
        text: entry.text
      }
    ];
  });
}

function resolveScenarioPath(scenariosDir: string, name: string): string {
  const fileName = name.endsWith(".json") ? name : `${slugifyProfileName(name)}.json`;
  return path.join(scenariosDir, fileName);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
