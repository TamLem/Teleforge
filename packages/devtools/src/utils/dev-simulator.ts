import http from "node:http";

import {
  createSimulatorBotBridge,
  type CapturedTelegramMessage,
  type SimulatorBotBridge
} from "./dev-simulator-bot.js";
import {
  createDevSimulatorScenarioStorage,
  type DevSimulatorScenarioStorage,
  type DevSimulatorTranscriptEntry
} from "./dev-simulator-storage.js";
import {
  createDefaultProfile,
  mergeProfile,
  type MockEventLogEntry,
  type MockProfile,
  type PartialMockProfile
} from "./mock-server/types.js";

import type { DiscoveredTeleforgeFlowSummary, TeleforgeManifest } from "./manifest.js";

export interface DevSimulatorOptions {
  autoloadApp?: boolean;
  appBasePath?: string;
  cwd: string;
  discoveredFlows?: DiscoveredTeleforgeFlowSummary[];
  env: NodeJS.ProcessEnv;
  manifest: TeleforgeManifest;
}

export interface DevSimulator {
  appBasePath: string;
  cleanup(): Promise<void>;
  getCurrentProfile(): MockProfile;
  handleRequest(
    request: http.IncomingMessage,
    response: http.ServerResponse<http.IncomingMessage>
  ): Promise<boolean>;
}

type SimulatorTranscriptEntry = DevSimulatorTranscriptEntry;
type SimulatorChatMode = "manifest" | "workspace";

interface SimulatorFixtureDefinition {
  description: string;
  id: string;
  name: string;
  patch: PartialMockProfile;
}

type SimulatorReplayAction =
  | {
      at: string;
      kind: "callback";
      label: string;
      value: string;
    }
  | {
      at: string;
      kind: "chat";
      label: string;
      value: string;
    }
  | {
      at: string;
      kind: "open_app";
      label: string;
    }
  | {
      at: string;
      kind: "web_app_data";
      label: string;
      value: string;
    };

export function createDevSimulator(options: DevSimulatorOptions): DevSimulator {
  const appBasePath = options.appBasePath ?? "/__teleforge/app";
  const apiBasePath = "/__teleforge/api";
  const autoloadApp = options.autoloadApp ?? false;
  const botToken = options.env.BOT_TOKEN ?? process.env.BOT_TOKEN;
  const discoveredFlows = options.discoveredFlows ?? [];
  const manifestCommands = options.manifest.bot.commands ?? [];
  const builtInFixtures = createBuiltInFixtures(options.manifest.name);
  let activeScenarioName: string | null = null;
  let appOpen = autoloadApp;
  let currentProfile = createDefaultProfile(botToken);
  let lastAction: SimulatorReplayAction | null = null;
  let bridgePromise: Promise<SimulatorBotBridge | null> | undefined;
  let scenarioStoragePromise: Promise<DevSimulatorScenarioStorage> | undefined;
  const eventLog: MockEventLogEntry[] = [];
  let transcript: SimulatorTranscriptEntry[] = [createReadyTranscriptEntry(options.manifest.name)];

  return {
    appBasePath,
    async cleanup() {
      const bridge = await resolveBotBridge();
      await bridge?.cleanup();
    },
    getCurrentProfile() {
      return currentProfile;
    },
    async handleRequest(request, response) {
      const url = new URL(request.url || "/", "http://127.0.0.1");

      if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/") {
        sendHtml(
          response,
          createSimulatorUiHtml({
            apiBasePath,
            appBasePath,
            commandHints: manifestCommands.slice(0, 6).map((command) => `/${command.command}`),
            manifestName: options.manifest.name
          })
        );
        return true;
      }

      if (!url.pathname.startsWith(apiBasePath)) {
        return false;
      }

      const pathname = url.pathname.slice(apiBasePath.length) || "/";
      const body = await readJsonBody(request);

      if (request.method === "GET" && pathname === "/state") {
        sendJson(response, 200, await createStatePayload());
        return true;
      }

      if (request.method === "POST" && pathname === "/state") {
        currentProfile = mergeProfile(currentProfile, body as PartialMockProfile, botToken);
        appendEvent({
          at: new Date().toISOString(),
          id: createId(),
          name: "profileUpdated",
          payload: {
            colorScheme: currentProfile.appContext.colorScheme,
            launchMode: currentProfile.appContext.launchMode
          }
        });
        sendJson(response, 200, await createStatePayload());
        return true;
      }

      if (request.method === "GET" && pathname === "/fixtures") {
        sendJson(response, 200, {
          fixtures: builtInFixtures.map(toFixtureSummary)
        });
        return true;
      }

      if (request.method === "POST" && pathname.startsWith("/fixtures/")) {
        const fixtureId = decodeURIComponent(pathname.replace("/fixtures/", ""));
        const fixture = builtInFixtures.find((entry) => entry.id === fixtureId);
        if (!fixture) {
          sendJson(response, 404, { error: `Unknown simulator fixture: ${fixtureId}` });
          return true;
        }

        applyFixture(fixture);
        sendJson(response, 200, await createStatePayload());
        return true;
      }

      if (request.method === "POST" && pathname === "/chat/send") {
        const text = isRecord(body) && typeof body.text === "string" ? body.text.trim() : "";
        if (text.length === 0) {
          sendJson(response, 400, { error: "Chat message text is required." });
          return true;
        }

        await handleChatInput(text);
        sendJson(response, 200, await createStatePayload());
        return true;
      }

      if (request.method === "POST" && pathname === "/chat/open-app") {
        appOpen = true;
        lastAction = {
          at: new Date().toISOString(),
          kind: "open_app",
          label: "Open App"
        };
        transcript = transcript.concat(
          createTranscriptEntry(
            "system",
            `Opened Mini App shell at ${appBasePath}/ using launch mode ${currentProfile.appContext.launchMode}.`
          )
        );
        sendJson(response, 200, await createStatePayload());
        return true;
      }

      if (request.method === "POST" && pathname === "/chat/replay") {
        if (!lastAction) {
          sendJson(response, 409, { error: "No simulator action has been recorded yet." });
          return true;
        }

        await replayLastAction();
        sendJson(response, 200, await createStatePayload());
        return true;
      }

      if (request.method === "POST" && pathname === "/chat/callback") {
        const data = isRecord(body) && typeof body.data === "string" ? body.data.trim() : "";
        if (data.length === 0) {
          sendJson(response, 400, { error: "Callback data is required." });
          return true;
        }

        await handleCallbackData(data);
        sendJson(response, 200, await createStatePayload());
        return true;
      }

      if (request.method === "POST" && pathname === "/chat/web-app-data") {
        const data = isRecord(body) && typeof body.data === "string" ? body.data.trim() : "{}";
        await handleWebAppData(data);
        sendJson(response, 200, await createStatePayload());
        return true;
      }

      if (request.method === "POST" && pathname === "/chat/reset") {
        activeScenarioName = null;
        appOpen = false;
        lastAction = null;
        transcript = [createResetTranscriptEntry(options.manifest.name)];
        sendJson(response, 200, await createStatePayload());
        return true;
      }

      if (request.method === "GET" && pathname === "/scenarios") {
        const storage = await resolveScenarioStorage();
        sendJson(response, 200, { scenarios: await storage.listScenarios() });
        return true;
      }

      if (request.method === "POST" && pathname === "/scenarios") {
        const storage = await resolveScenarioStorage();
        const name = isRecord(body) && typeof body.name === "string" ? body.name.trim() : "";
        const scenarioRef = await storage.saveScenario(
          {
            events: eventLog,
            name: name || options.manifest.name,
            profile: currentProfile,
            transcript
          },
          name || undefined
        );
        activeScenarioName = scenarioRef.name;
        sendJson(response, 201, {
          scenarioRef,
          scenarios: await storage.listScenarios()
        });
        return true;
      }

      if (request.method === "GET" && pathname.startsWith("/scenarios/")) {
        const storage = await resolveScenarioStorage();
        const scenarioName = decodeURIComponent(pathname.replace("/scenarios/", ""));
        const scenario = await storage.loadScenario(scenarioName);
        activeScenarioName = scenario.name;
        appOpen = false;
        lastAction = null;
        currentProfile = scenario.profile;
        transcript = scenario.transcript;
        eventLog.splice(0, eventLog.length, ...scenario.events.slice(0, 24));
        sendJson(response, 200, {
          scenarios: await storage.listScenarios(),
          state: await createStatePayload()
        });
        return true;
      }

      if (request.method === "POST" && pathname === "/events/trigger") {
        const name = isRecord(body) && typeof body.name === "string" ? body.name : "mockEvent";
        const entry: MockEventLogEntry = {
          at: new Date().toISOString(),
          id: createId(),
          name,
          payload: isRecord(body) ? body.payload : undefined
        };
        appendEvent(entry);
        sendJson(response, 201, { event: entry, events: eventLog });
        return true;
      }

      if (request.method === "GET" && pathname === "/events/log") {
        sendJson(response, 200, { events: eventLog });
        return true;
      }

      sendJson(response, 404, { error: "Not found" });
      return true;
    }
  };

  async function createStatePayload() {
    const bridge = await resolveBotBridge();
    const chatMode: SimulatorChatMode = bridge ? "workspace" : "manifest";
    const commandHints = bridge
      ? await bridge.getCommands()
      : manifestCommands.map((command) => command.command);
    const scenarioStorage = await resolveScenarioStorage();

    return {
      chat: {
        commandHints,
        mode: chatMode
      },
      debug: {
        activeScenarioName,
        appOpen,
        commandCount: commandHints.length,
        discoveredFlowCount: discoveredFlows.length,
        latestEvent: eventLog[0] ?? null,
        lastAction,
        miniAppUrl: `${appBasePath}/`,
        mode: chatMode,
        scenarioStoragePath: scenarioStorage.describe().scenariosDir,
        transcriptEntries: transcript.length
      },
      events: eventLog,
      fixtures: builtInFixtures.map(toFixtureSummary),
      flows: discoveredFlows,
      manifest: {
        commands: manifestCommands,
        name: options.manifest.name
      },
      profile: currentProfile,
      scenarios: await scenarioStorage.listScenarios(),
      transcript
    };
  }

  async function handleChatInput(text: string) {
    lastAction = {
      at: new Date().toISOString(),
      kind: "chat",
      label: text,
      value: text
    };
    transcript = transcript.concat(createTranscriptEntry("user", text));

    const bridge = await resolveBotBridge();
    if (bridge) {
      const result = await bridge.sendCommand(text, currentProfile);
      transcript = transcript.concat(toTranscriptEntries(result.messages));
      return;
    }

    handleManifestChatInput(text);
  }

  function appendEvent(entry: MockEventLogEntry) {
    eventLog.unshift(entry);
    eventLog.splice(24);
  }

  async function handleWebAppData(data: string) {
    lastAction = {
      at: new Date().toISOString(),
      kind: "web_app_data",
      label: `web_app_data ${data}`,
      value: data
    };
    transcript = transcript.concat(createTranscriptEntry("user", `web_app_data ${data}`));
    appendEvent({
      at: new Date().toISOString(),
      id: createId(),
      name: "web_app_data",
      payload: {
        data
      }
    });

    const bridge = await resolveBotBridge();
    if (bridge) {
      const result = await bridge.sendWebAppData(data, currentProfile);
      transcript = transcript.concat(toTranscriptEntries(result.messages));
      return;
    }

    transcript = transcript.concat(
      createTranscriptEntry(
        "bot",
        "Simulator accepted the web_app_data payload. Bind a workspace bot adapter to execute app-specific handlers locally."
      )
    );
  }

  async function handleCallbackData(data: string) {
    lastAction = {
      at: new Date().toISOString(),
      kind: "callback",
      label: `callback ${data}`,
      value: data
    };
    transcript = transcript.concat(createTranscriptEntry("user", `callback ${data}`));
    appendEvent({
      at: new Date().toISOString(),
      id: createId(),
      name: "callback_query",
      payload: {
        data
      }
    });

    const bridge = await resolveBotBridge();
    if (bridge) {
      const result = await bridge.sendCallbackData(data, currentProfile);
      transcript = transcript.concat(toTranscriptEntries(result.messages));
      return;
    }

    transcript = transcript.concat(
      createTranscriptEntry(
        "bot",
        "Simulator received callback data, but this workspace is using manifest-level chat fallback."
      )
    );
  }

  function handleManifestChatInput(text: string) {
    if (!text.startsWith("/")) {
      transcript = transcript.concat(
        createTranscriptEntry(
          "bot",
          "Chat simulation currently focuses on slash commands, Mini App opens, and web_app_data return flows."
        )
      );
      return;
    }

    const commandName = text.slice(1).split(/\s+/, 1)[0]?.toLowerCase() ?? "";
    if (commandName === "start") {
      transcript = transcript.concat(
        createTranscriptEntry("bot", `Welcome to ${options.manifest.name}!`, [
          {
            kind: "web_app",
            text: "Open App",
            value: `${appBasePath}/`
          }
        ])
      );
      return;
    }

    if (commandName === "help") {
      const lines =
        manifestCommands.length === 0
          ? ["Use /start to launch the Mini App."]
          : manifestCommands.map(
              (command) =>
                `/${command.command}${command.description ? ` - ${command.description}` : ""}`
            );
      transcript = transcript.concat(createTranscriptEntry("bot", lines.join("\n")));
      return;
    }

    const manifestCommand = manifestCommands.find(
      (command) => command.command.toLowerCase() === commandName
    );

    if (manifestCommand) {
      const lines = [`Simulator recognized /${manifestCommand.command}.`];

      if (manifestCommand.handler) {
        lines.push(`Manifest handler: ${manifestCommand.handler}`);
      }

      lines.push(
        "Local transcript mode does not execute workspace bot code yet. Use the companion bot process or real Telegram mode for command-specific runtime behavior."
      );

      transcript = transcript.concat(createTranscriptEntry("bot", lines.join("\n")));
      return;
    }

    transcript = transcript.concat(
      createTranscriptEntry("bot", "Unknown command. Use /help for available commands.")
    );
  }

  async function resolveBotBridge(): Promise<SimulatorBotBridge | null> {
    if (!bridgePromise) {
      bridgePromise = createSimulatorBotBridge({
        appUrl: `${appBasePath}/`,
        cwd: options.cwd,
        env: options.env
      }).catch((error) => {
        const message =
          error instanceof Error ? error.message : "Workspace bot bridge failed to initialize.";
        appendEvent({
          at: new Date().toISOString(),
          id: createId(),
          name: "botBridgeError",
          payload: {
            message
          }
        });
        transcript = transcript.concat(
          createTranscriptEntry(
            "system",
            `Workspace bot bridge is unavailable. Falling back to manifest-level chat simulation.\n${message}`
          )
        );
        return null;
      });
    }

    return bridgePromise;
  }

  async function resolveScenarioStorage(): Promise<DevSimulatorScenarioStorage> {
    if (!scenarioStoragePromise) {
      scenarioStoragePromise = createDevSimulatorScenarioStorage();
    }

    return scenarioStoragePromise;
  }

  function applyFixture(fixture: SimulatorFixtureDefinition) {
    activeScenarioName = `Fixture: ${fixture.name}`;
    appOpen = false;
    lastAction = null;
    currentProfile = mergeProfile(createDefaultProfile(botToken), fixture.patch, botToken);
    transcript = [
      createReadyTranscriptEntry(options.manifest.name),
      createTranscriptEntry("system", `Applied fixture ${fixture.name}. ${fixture.description}`)
    ];
    eventLog.splice(0, eventLog.length);
    appendEvent({
      at: new Date().toISOString(),
      id: createId(),
      name: "fixtureApplied",
      payload: {
        fixtureId: fixture.id,
        name: fixture.name
      }
    });
  }

  async function replayLastAction() {
    const action = lastAction;
    if (!action) {
      return;
    }

    if (action.kind === "chat") {
      await handleChatInput(action.value);
      return;
    }

    if (action.kind === "callback") {
      await handleCallbackData(action.value);
      return;
    }

    if (action.kind === "web_app_data") {
      await handleWebAppData(action.value);
      return;
    }

    appOpen = true;
    lastAction = {
      at: new Date().toISOString(),
      kind: "open_app",
      label: "Open App"
    };
    transcript = transcript.concat(
      createTranscriptEntry(
        "system",
        `Opened Mini App shell at ${appBasePath}/ using launch mode ${currentProfile.appContext.launchMode}.`
      )
    );
  }
}

function toTranscriptEntries(messages: CapturedTelegramMessage[]): SimulatorTranscriptEntry[] {
  return messages.map((message) =>
    createTranscriptEntry("bot", message.text ?? "", flattenButtons(message.options?.reply_markup))
  );
}

function flattenButtons(
  markup:
    | {
        inline_keyboard?: Array<
          Array<{
            callback_data?: string;
            text: string;
            url?: string;
            web_app?: {
              url: string;
            };
          }>
        >;
      }
    | undefined
): SimulatorTranscriptEntry["buttons"] {
  const buttons: NonNullable<SimulatorTranscriptEntry["buttons"]> = [];

  for (const row of markup?.inline_keyboard ?? []) {
    for (const button of row) {
      if (button.web_app?.url) {
        buttons.push({
          kind: "web_app",
          text: button.text,
          value: normalizeSimulatorButtonUrl(button.web_app.url)
        });
        continue;
      }

      if (button.callback_data) {
        buttons.push({
          kind: "callback",
          text: button.text,
          value: button.callback_data
        });
      }
    }
  }

  return buttons.length > 0 ? buttons : undefined;
}

function normalizeSimulatorButtonUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.origin === "https://teleforge-simulator.local") {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

function createBuiltInFixtures(manifestName: string): SimulatorFixtureDefinition[] {
  return [
    {
      description: "Resets to the default inline iOS shell with a clean transcript.",
      id: "fresh-session",
      name: "Fresh Session",
      patch: {
        appContext: {
          colorScheme: "light",
          isExpanded: true,
          launchMode: "inline",
          platform: "ios",
          viewportHeight: 720,
          viewportWidth: 390
        },
        description: `Fresh simulator fixture for ${manifestName}`,
        launchParams: {
          query_id: "teleforge-query",
          start_param: "welcome",
          startapp: undefined
        },
        name: "Fresh Session"
      } as PartialMockProfile
    },
    {
      description: "Switches to a dark Android shell for visual QA and layout checks.",
      id: "dark-mobile",
      name: "Dark Mobile",
      patch: {
        appContext: {
          colorScheme: "dark",
          isExpanded: true,
          launchMode: "fullscreen",
          platform: "android",
          viewportHeight: 844,
          viewportWidth: 390
        },
        description: `Dark mobile simulator fixture for ${manifestName}`,
        name: "Dark Mobile"
      } as PartialMockProfile
    },
    {
      description:
        "Seeds start parameters for a resumed Mini App entry and a wider desktop viewport.",
      id: "resume-flow",
      name: "Resume Flow",
      patch: {
        appContext: {
          colorScheme: "light",
          isExpanded: true,
          launchMode: "full",
          platform: "web",
          viewportHeight: 900,
          viewportWidth: 1440
        },
        description: `Resume-flow simulator fixture for ${manifestName}`,
        launchParams: {
          query_id: "teleforge-resume-query",
          start_param: "resume-flow",
          startapp: "resume-flow"
        },
        name: "Resume Flow"
      } as PartialMockProfile
    }
  ];
}

function createReadyTranscriptEntry(manifestName: string): SimulatorTranscriptEntry {
  return createTranscriptEntry(
    "system",
    `Simulator ready for ${manifestName}. Send /start to open the Mini App or /help to inspect available commands.`
  );
}

function createResetTranscriptEntry(manifestName: string): SimulatorTranscriptEntry {
  return createTranscriptEntry(
    "system",
    `Transcript reset for ${manifestName}. Send /start to begin a new session.`
  );
}

function toFixtureSummary(fixture: SimulatorFixtureDefinition) {
  return {
    description: fixture.description,
    id: fixture.id,
    name: fixture.name
  };
}

function createSimulatorUiHtml(options: {
  apiBasePath: string;
  appBasePath: string;
  commandHints: string[];
  manifestName: string;
}): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(options.manifestName)} Simulator</title>
    <style>
      :root {
        color-scheme: light;
        font-family: "IBM Plex Sans", sans-serif;
        background:
          radial-gradient(circle at top left, rgba(17, 138, 178, 0.16), transparent 26%),
          radial-gradient(circle at bottom right, rgba(239, 108, 0, 0.14), transparent 28%),
          #eef3f8;
        color: #132033;
      }
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; }
      main { width: min(1600px, calc(100% - 2rem)); margin: 0 auto; padding: 1.5rem 0 2rem; }
      header { display: grid; gap: 0.5rem; margin-bottom: 1rem; }
      h1, h2, h3, p { margin: 0; }
      .lede { max-width: 70rem; line-height: 1.55; color: #45556e; }
      .shell {
        display: grid;
        grid-template-columns: minmax(320px, 360px) minmax(420px, 1fr) minmax(300px, 340px) minmax(280px, 320px);
        grid-template-areas: "chat app controls diagnostics";
        gap: 1rem;
        align-items: start;
      }
      .pane-chat { grid-area: chat; }
      .pane-app { grid-area: app; }
      .pane-controls { grid-area: controls; }
      .pane-diagnostics { grid-area: diagnostics; }
      .pane {
        background: rgba(255, 255, 255, 0.88);
        border-radius: 24px;
        border: 1px solid rgba(19, 32, 51, 0.08);
        box-shadow: 0 18px 60px rgba(19, 32, 51, 0.08);
        backdrop-filter: blur(14px);
        overflow: hidden;
      }
      .pane > section {
        padding: 1rem 1rem 1.25rem;
        border-bottom: 1px solid rgba(19, 32, 51, 0.08);
        display: grid;
        gap: 0.75rem;
      }
      .pane > section:last-child { border-bottom: 0; }
      .transcript {
        min-height: 28rem;
        max-height: 64vh;
        overflow: auto;
        display: grid;
        gap: 0.75rem;
        align-content: start;
      }
      .bubble {
        padding: 0.85rem 1rem;
        border-radius: 18px;
        line-height: 1.45;
        white-space: pre-wrap;
      }
      .bubble.user {
        background: #132033;
        color: #ffffff;
        justify-self: end;
        max-width: 92%;
      }
      .bubble.bot {
        background: rgba(19, 32, 51, 0.06);
        color: #132033;
        max-width: 92%;
      }
      .bubble.system {
        background: rgba(17, 138, 178, 0.1);
        color: #0d5675;
      }
      .bubble-buttons {
        margin-top: 0.75rem;
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
      }
      .bubble-buttons button,
      .composer button,
      .quick button,
      .control-actions button {
        border: 1px solid rgba(19, 32, 51, 0.14);
        border-radius: 999px;
        background: #132033;
        color: #ffffff;
        cursor: pointer;
        font: inherit;
        padding: 0.6rem 0.9rem;
      }
      .bubble-buttons button.secondary,
      .quick button.secondary,
      .control-actions button.secondary {
        background: #ffffff;
        color: #132033;
      }
      .composer {
        display: grid;
        gap: 0.75rem;
      }
      .composer textarea,
      .controls input,
      .controls select,
      .controls textarea {
        width: 100%;
        border-radius: 12px;
        border: 1px solid rgba(19, 32, 51, 0.14);
        padding: 0.75rem 0.85rem;
        font: inherit;
      }
      .composer textarea,
      .controls textarea {
        min-height: 5rem;
        resize: vertical;
      }
      .quick {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
      }
      .pane-app > section:last-child {
        display: grid;
        justify-items: center;
      }
      .app-frame {
        width: min(100%, 402px);
        height: min(78vh, 844px);
        min-height: 680px;
        border: 1px solid rgba(19, 32, 51, 0.1);
        border-radius: 30px;
        background: #ffffff;
        box-shadow:
          0 24px 54px rgba(19, 32, 51, 0.14),
          inset 0 0 0 1px rgba(255, 255, 255, 0.68);
      }
      .app-stage {
        display: grid;
        gap: 0.9rem;
        justify-items: center;
        width: 100%;
      }
      .app-empty {
        width: min(100%, 402px);
        height: min(78vh, 844px);
        min-height: 680px;
        border-radius: 30px;
        border: 1px dashed rgba(19, 32, 51, 0.18);
        background:
          linear-gradient(135deg, rgba(255, 255, 255, 0.94), rgba(238, 243, 248, 0.96));
        color: #45556e;
        padding: 2rem 1.6rem;
        display: grid;
        place-items: center;
        text-align: center;
        box-shadow:
          0 24px 54px rgba(19, 32, 51, 0.1),
          inset 0 0 0 1px rgba(255, 255, 255, 0.68);
      }
      .app-empty p {
        max-width: 19rem;
        line-height: 1.6;
      }
      .app-frame[hidden],
      .app-empty[hidden] {
        display: none;
      }
      .controls {
        display: grid;
        gap: 0.85rem;
      }
      .controls label {
        display: grid;
        gap: 0.35rem;
        font-size: 0.85rem;
        color: #45556e;
      }
      .field-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.75rem;
      }
      .control-actions,
      .event-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
      }
      .log {
        max-height: 16rem;
        overflow: auto;
        border-radius: 14px;
        background: rgba(19, 32, 51, 0.04);
        padding: 0.9rem;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        white-space: pre-wrap;
        word-break: break-word;
      }
      .hint {
        font-size: 0.85rem;
        color: #45556e;
      }
      .status {
        padding: 0.75rem 0.9rem;
        border-radius: 14px;
        background: rgba(17, 138, 178, 0.1);
        color: #0d5675;
      }
      .pane-diagnostics .log {
        max-height: 21rem;
      }
      .flow-list {
        display: grid;
        gap: 0.6rem;
      }
      .flow-card {
        border-radius: 14px;
        background: rgba(19, 32, 51, 0.04);
        padding: 0.8rem 0.9rem;
        display: grid;
        gap: 0.25rem;
      }
      .flow-card strong {
        font-size: 0.95rem;
      }
      .flow-card code {
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      }
      .flow-meta {
        font-size: 0.82rem;
        color: #45556e;
        line-height: 1.45;
      }
      @media (max-width: 1680px) {
        .shell {
          grid-template-columns: minmax(320px, 360px) minmax(400px, 1fr) minmax(300px, 360px);
          grid-template-areas:
            "chat app controls"
            "chat app diagnostics";
        }
      }
      @media (max-width: 1320px) {
        .shell {
          grid-template-columns: minmax(320px, 1fr) minmax(360px, 1fr);
          grid-template-areas:
            "chat app"
            "controls diagnostics";
        }
        .app-frame,
        .app-empty {
          height: min(72vh, 820px);
          min-height: 620px;
        }
      }
      @media (max-width: 1040px) {
        .shell {
          grid-template-columns: 1fr;
          grid-template-areas:
            "chat"
            "app"
            "controls"
            "diagnostics";
        }
        .app-frame,
        .app-empty {
          width: min(100%, 420px);
          height: min(78vh, 820px);
          min-height: 600px;
        }
      }
    </style>
  </head>
  <body>
    <main>
      <header>
        <p>Teleforge Simulator</p>
        <h1>${escapeHtml(options.manifestName)}</h1>
        <p class="lede">
          Local simulator for Telegram Mini App work. The left pane drives a lightweight chat transcript,
          the center pane embeds a phone-sized Mini App, and the right-side columns handle simulator state,
          events, and runtime diagnostics without leaving a single browser view.
        </p>
      </header>
      <div class="shell">
        <section class="pane pane-chat">
          <section>
            <h2>Chat</h2>
            <div id="transcript" class="transcript"></div>
          </section>
          <section>
            <div class="quick">
              ${options.commandHints
                .map(
                  (command) =>
                    `<button type="button" class="secondary" data-command="${escapeHtml(command)}">${escapeHtml(command)}</button>`
                )
                .join("")}
              <button type="button" class="secondary" id="open-app">Open App</button>
              <button type="button" class="secondary" id="replay-last">Replay Last</button>
              <button type="button" class="secondary" id="reset-chat">Reset</button>
            </div>
            <div class="composer">
              <textarea id="chat-input" placeholder="/start"></textarea>
              <button id="send-chat" type="button">Send Message</button>
              <label>
                Simulate web_app_data
                <textarea id="web-app-data">{ "type": "order_completed" }</textarea>
              </label>
              <button id="send-web-app-data" type="button">Send web_app_data</button>
            </div>
          </section>
        </section>
        <section class="pane pane-app">
          <section>
            <h2>Mini App</h2>
            <div class="status" id="simulator-status">Loading simulator state…</div>
          </section>
          <section>
            <div class="app-stage">
              <div id="app-empty" class="app-empty">
                <p>Mini App idle. Send <code>/start</code>, click a <code>web_app</code> button, or use <strong>Open App</strong> when you want to launch the embedded app.</p>
              </div>
              <iframe
                id="app-frame"
                class="app-frame"
                src="about:blank"
                data-app-src="${options.appBasePath}/"
                title="Teleforge Mini App"
                hidden
              ></iframe>
            </div>
          </section>
        </section>
        <aside class="pane pane-controls">
          <section>
            <h2>Scenarios</h2>
            <div class="controls">
              <p class="hint">Built-in fixtures reset the simulator into named local test states.</p>
              <div id="fixtures" class="quick"></div>
              <label>Scenario Name<input id="scenario-name" placeholder="checkout-flow" /></label>
              <div class="control-actions">
                <button id="save-scenario" type="button">Save Scenario</button>
                <button id="refresh-scenarios" class="secondary" type="button">Refresh</button>
              </div>
              <div id="scenarios" class="quick"></div>
            </div>
          </section>
          <section>
            <h2>App Context</h2>
            <div class="controls">
              <div class="field-grid">
                <label>Launch Mode<select id="launch-mode"><option value="inline">inline</option><option value="compact">compact</option><option value="fullscreen">fullscreen</option><option value="full">full</option></select></label>
                <label>Theme<select id="color-scheme"><option value="light">light</option><option value="dark">dark</option></select></label>
                <label>Platform<select id="platform"><option>ios</option><option>android</option><option>web</option><option>macos</option><option>tdesktop</option></select></label>
                <label>Version<input id="app-version" /></label>
                <label>Expanded<select id="expanded"><option value="true">true</option><option value="false">false</option></select></label>
                <label>Query ID<input id="query-id" /></label>
                <label>Start Param<input id="start-param" /></label>
                <label>Startapp<input id="startapp" /></label>
                <label>Viewport Width<input id="viewport-width" type="number" /></label>
                <label>Viewport Height<input id="viewport-height" type="number" /></label>
              </div>
              <label>User Name<input id="first-name" /></label>
              <label>Username<input id="username" /></label>
              <label>Hash<textarea id="hash" readonly></textarea></label>
              <div class="control-actions">
                <button id="apply-state" type="button">Apply State</button>
                <button id="reload-app" class="secondary" type="button">Reload App</button>
              </div>
            </div>
          </section>
        </aside>
        <aside class="pane pane-diagnostics">
          <section>
            <h2>Events</h2>
            <div class="event-actions">
              <button type="button" data-event="viewportChanged">Viewport</button>
              <button type="button" data-event="themeChanged">Theme</button>
              <button type="button" data-event="main-button-click">Main Button</button>
              <button type="button" data-event="back-button-click">Back Button</button>
            </div>
            <div id="events" class="log">Waiting for events…</div>
          </section>
          <section>
            <h2>Debug</h2>
            <div id="debug-summary" class="log">Loading debug state…</div>
            <div class="controls">
              <label>Discovered Flows<div id="debug-flows" class="flow-list"><p class="hint">Waiting for simulator state…</p></div></label>
              <label>Last Action<div id="debug-last-action" class="log">No simulator actions yet.</div></label>
              <label>Profile Snapshot<div id="debug-profile" class="log">Waiting for simulator state…</div></label>
            </div>
          </section>
        </aside>
      </div>
    </main>
    <script>
      const apiBase = ${JSON.stringify(options.apiBasePath)};
      const appBasePath = ${JSON.stringify(options.appBasePath)};
      let currentState = null;

      const ids = {
        appFrame: document.getElementById("app-frame"),
        appEmpty: document.getElementById("app-empty"),
        appVersion: document.getElementById("app-version"),
        chatInput: document.getElementById("chat-input"),
        colorScheme: document.getElementById("color-scheme"),
        debugLastAction: document.getElementById("debug-last-action"),
        debugFlows: document.getElementById("debug-flows"),
        debugProfile: document.getElementById("debug-profile"),
        debugSummary: document.getElementById("debug-summary"),
        events: document.getElementById("events"),
        expanded: document.getElementById("expanded"),
        firstName: document.getElementById("first-name"),
        fixtures: document.getElementById("fixtures"),
        hash: document.getElementById("hash"),
        launchMode: document.getElementById("launch-mode"),
        platform: document.getElementById("platform"),
        queryId: document.getElementById("query-id"),
        scenarioName: document.getElementById("scenario-name"),
        scenarios: document.getElementById("scenarios"),
        simulatorStatus: document.getElementById("simulator-status"),
        startParam: document.getElementById("start-param"),
        startapp: document.getElementById("startapp"),
        transcript: document.getElementById("transcript"),
        username: document.getElementById("username"),
        viewportHeight: document.getElementById("viewport-height"),
        viewportWidth: document.getElementById("viewport-width"),
        webAppData: document.getElementById("web-app-data")
      };

      async function request(path, init) {
        const response = await fetch(apiBase + path, {
          headers: { "content-type": "application/json" },
          ...init
        });
        if (!response.ok) {
          throw new Error(await response.text());
        }
        return response.json();
      }

      function postToApp(message) {
        ids.appFrame.contentWindow?.postMessage(
          {
            source: "teleforge-simulator",
            ...message
          },
          window.location.origin
        );
      }

      function setStatus(message) {
        ids.simulatorStatus.textContent = message;
      }

      function getDefaultAppSrc() {
        return ids.appFrame.dataset.appSrc || appBasePath + "/";
      }

      function getCurrentAppSrc() {
        const frameUrl = ids.appFrame.getAttribute("src");
        if (frameUrl && frameUrl !== "about:blank") {
          return frameUrl;
        }
        return getDefaultAppSrc();
      }

      function setAppFrameSource(nextUrl) {
        ids.appFrame.dataset.appSrc = nextUrl;
        if (ids.appFrame.getAttribute("src") !== nextUrl) {
          ids.appFrame.setAttribute("src", nextUrl);
        }
      }

      function syncAppVisibility(appIsOpen) {
        ids.appFrame.hidden = !appIsOpen;
        ids.appEmpty.hidden = appIsOpen;

        if (appIsOpen) {
          setAppFrameSource(getDefaultAppSrc());
          return;
        }

        ids.appFrame.setAttribute("src", "about:blank");
      }

      async function inspectAppFrameResponse() {
        if (!currentState?.debug?.appOpen) {
          return;
        }

        const frameUrl = ids.appFrame.getAttribute("src");
        if (!frameUrl || frameUrl === "about:blank") {
          return;
        }

        try {
          const response = await fetch(frameUrl, {
            headers: {
              "x-teleforge-simulator-probe": "1"
            }
          });
          if (response.status >= 500) {
            const body = (await response.text()).replace(/\\s+/g, " ").trim().slice(0, 220);
            setStatus(
              "Mini App responded with HTTP " +
                response.status +
                ". Check terminal logs." +
                (body ? " Preview: " + body : "")
            );
            return;
          }

          if (currentState) {
            setStatus("Simulator ready.");
          }
        } catch (error) {
          setStatus(
            "Mini App probe failed: " +
              (error instanceof Error ? error.message : String(error))
          );
        }
      }

      function renderEvents(events) {
        ids.events.textContent = events.length === 0
          ? "Waiting for events…"
          : events.map((entry) => "[" + entry.at + "] " + entry.name + ": " + JSON.stringify(entry.payload || {})).join("\\n");
      }

      function renderDebug(payload) {
        const debug = payload.debug || {};
        const latestEvent = debug.latestEvent
          ? debug.latestEvent.name + " @ " + debug.latestEvent.at
          : "No events yet";

        ids.debugSummary.textContent = [
          "Mode: " + (payload.chat?.mode || "manifest"),
          "Commands: " + String(debug.commandCount ?? payload.chat?.commandHints?.length ?? 0),
          "Discovered Flows: " + String(debug.discoveredFlowCount ?? payload.flows?.length ?? 0),
          "Mini App Open: " + String(Boolean(debug.appOpen)),
          "Mini App URL: " + (debug.miniAppUrl || appBasePath + "/"),
          "Active Scenario: " + (debug.activeScenarioName || "None"),
          "Scenario Storage: " + (debug.scenarioStoragePath || "Unavailable"),
          "Transcript Entries: " + String(debug.transcriptEntries ?? payload.transcript?.length ?? 0),
          "Latest Event: " + latestEvent
        ].join("\\n");

        ids.debugLastAction.textContent = debug.lastAction
          ? JSON.stringify(debug.lastAction, null, 2)
          : "No simulator actions yet.";
        ids.debugProfile.textContent = JSON.stringify(
          {
            appContext: payload.profile?.appContext,
            launchParams: payload.profile?.launchParams,
            user: payload.profile?.user
          },
          null,
          2
        );
      }

      function renderFlows(flows) {
        ids.debugFlows.innerHTML = "";

        if (!Array.isArray(flows) || flows.length === 0) {
          const empty = document.createElement("p");
          empty.className = "hint";
          empty.textContent = "No discovered flows. This workspace may be running manifest-only routes.";
          ids.debugFlows.appendChild(empty);
          return;
        }

        for (const flow of flows) {
          const card = document.createElement("article");
          card.className = "flow-card";

          const title = document.createElement("strong");
          title.textContent = flow.id;
          card.appendChild(title);

          const primary = document.createElement("div");
          primary.className = "flow-meta";
          primary.textContent =
            "route: " +
            (flow.route || "none") +
            "\\ncommand: " +
            (flow.command || "none") +
            "\\nsteps: " +
            String(flow.stepCount || 0) +
            "\\nstep status: wired=" +
            String(flow.wiredStepCount || 0) +
            ", warnings=" +
            String(flow.warningStepCount || 0) +
            ", passive=" +
            String(flow.passiveStepCount || 0);
          primary.style.whiteSpace = "pre-wrap";
          card.appendChild(primary);

          const secondary = document.createElement("div");
          secondary.className = "flow-meta";
          secondary.textContent =
            "initial: " +
            (flow.initialStep || "unknown") +
            "\\nfinal: " +
            (flow.finalStep || flow.initialStep || "unknown") +
            "\\nhandler wiring: " +
            (flow.hasRuntimeHandlers ? "present" : "none") +
            "\\nwiring gaps: " +
            (flow.hasWiringGaps ? "yes" : "no") +
            (flow.component ? "\\ncomponent: " + flow.component : "");
          secondary.style.whiteSpace = "pre-wrap";
          card.appendChild(secondary);

          if (Array.isArray(flow.steps) && flow.steps.length > 0) {
            const stepList = document.createElement("div");
            stepList.className = "flow-meta";
            stepList.style.whiteSpace = "pre-wrap";
            stepList.textContent = flow.steps
              .map((step) => {
                const parts = [
                  step.id + " [" + step.status + "]",
                  "type=" + step.type
                ];

                if (step.screen) {
                  parts.push(
                    "screen=" + step.screen + (step.screenResolved === false ? " (missing)" : "")
                  );
                }

                if (step.screenTitle) {
                  parts.push("title=" + step.screenTitle);
                }

                if (step.screenFilePath) {
                  parts.push("screenFile=" + step.screenFilePath);
                }

                parts.push("enter=" + String(Boolean(step.resolvedOnEnter)));
                parts.push("submit=" + String(Boolean(step.resolvedOnSubmit)));
                parts.push("serverGuard=" + String(Boolean(step.resolvedServerGuard)));
                parts.push("serverLoader=" + String(Boolean(step.resolvedServerLoader)));
                parts.push("serverSubmit=" + String(Boolean(step.resolvedServerSubmit)));
                parts.push(
                  "actions=" +
                    String(step.resolvedActionCount || 0) +
                    "/" +
                    String(step.actionCount || 0)
                );

                if (step.serverHookFile) {
                  parts.push("serverFile=" + step.serverHookFile);
                }

                if (Array.isArray(step.unresolvedActionIds) && step.unresolvedActionIds.length > 0) {
                  parts.push("missing=" + step.unresolvedActionIds.join(","));
                }

                if (
                  Array.isArray(step.extraActionHandlerIds) &&
                  step.extraActionHandlerIds.length > 0
                ) {
                  parts.push("extra=" + step.extraActionHandlerIds.join(","));
                }

                if (
                  Array.isArray(step.extraServerActionIds) &&
                  step.extraServerActionIds.length > 0
                ) {
                  parts.push("serverExtra=" + step.extraServerActionIds.join(","));
                }

                return parts.join(" | ");
              })
              .join("\\n");
            card.appendChild(stepList);
          }

          ids.debugFlows.appendChild(card);
        }
      }

      function renderFixtures(fixtures) {
        ids.fixtures.innerHTML = "";

        if (!Array.isArray(fixtures) || fixtures.length === 0) {
          const empty = document.createElement("p");
          empty.textContent = "No fixtures available.";
          ids.fixtures.appendChild(empty);
          return;
        }

        for (const fixture of fixtures) {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "secondary";
          button.textContent = fixture.name;
          button.title = fixture.description || fixture.name;
          button.addEventListener("click", async () => {
            const payload = await request("/fixtures/" + encodeURIComponent(fixture.id), {
              method: "POST",
              body: JSON.stringify({})
            });
            renderState(payload);
            setStatus("Applied fixture " + fixture.name + ".");
          });
          ids.fixtures.appendChild(button);
        }
      }

      function renderScenarios(scenarios) {
        ids.scenarios.innerHTML = "";

        if (!Array.isArray(scenarios) || scenarios.length === 0) {
          const empty = document.createElement("p");
          empty.textContent = "No saved scenarios yet.";
          ids.scenarios.appendChild(empty);
          return;
        }

        for (const scenario of scenarios) {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "secondary";
          button.textContent = scenario.name;
          button.addEventListener("click", async () => {
            const payload = await request("/scenarios/" + encodeURIComponent(scenario.fileName));
            renderState(payload.state);
            renderScenarios(payload.scenarios);
            ids.scenarioName.value = scenario.name;
            setStatus("Loaded scenario " + scenario.name + ".");
          });
          ids.scenarios.appendChild(button);
        }
      }

      function renderTranscript(entries) {
        ids.transcript.innerHTML = "";
        for (const entry of entries) {
          const bubble = document.createElement("article");
          bubble.className = "bubble " + entry.role;
          bubble.textContent = entry.text;

          if (Array.isArray(entry.buttons) && entry.buttons.length > 0) {
            const row = document.createElement("div");
            row.className = "bubble-buttons";
            for (const button of entry.buttons) {
              const action = document.createElement("button");
              action.type = "button";
              action.textContent = button.text;
              action.className = button.kind === "callback" ? "secondary" : "";
              action.addEventListener("click", async () => {
                if (button.kind === "web_app") {
                  setAppFrameSource(button.value);
                  await request("/chat/open-app", { method: "POST" }).then(renderState);
                  return;
                }
                await request("/chat/callback", {
                  method: "POST",
                  body: JSON.stringify({
                    data: button.value
                  })
                }).then(renderState);
              });
              row.appendChild(action);
            }
            bubble.appendChild(row);
          }

          ids.transcript.appendChild(bubble);
        }
        ids.transcript.scrollTop = ids.transcript.scrollHeight;
      }

      function renderProfile(profile) {
        ids.launchMode.value = profile.appContext.launchMode;
        ids.colorScheme.value = profile.appContext.colorScheme;
        ids.platform.value = profile.appContext.platform;
        ids.appVersion.value = profile.appContext.version;
        ids.expanded.value = String(Boolean(profile.appContext.isExpanded));
        ids.queryId.value = profile.launchParams.query_id || "";
        ids.startParam.value = profile.launchParams.start_param || "";
        ids.startapp.value = profile.launchParams.startapp || "";
        ids.viewportWidth.value = String(profile.appContext.viewportWidth || "");
        ids.viewportHeight.value = String(profile.appContext.viewportHeight || "");
        ids.firstName.value = profile.user.first_name || "";
        ids.username.value = profile.user.username || "";
        ids.hash.value = profile.launchParams.hash || "";
      }

      function renderState(payload) {
        currentState = payload;
        renderProfile(payload.profile);
        renderTranscript(payload.transcript);
        renderEvents(payload.events);
        renderDebug(payload);
        renderFlows(payload.flows);
        renderFixtures(payload.fixtures);
        renderScenarios(payload.scenarios);
        syncAppVisibility(Boolean(payload.debug?.appOpen));
        if (payload.debug?.appOpen) {
          setStatus("Simulator ready.");
          postToApp({
            profile: payload.profile,
            type: "sync-profile"
          });
          queueMicrotask(() => {
            void inspectAppFrameResponse();
          });
        } else {
          setStatus("Mini App idle. Use /start, a web_app button, or Open App to launch it.");
        }
        return payload;
      }

      function collectProfilePatch() {
        return {
          user: {
            first_name: ids.firstName.value,
            username: ids.username.value
          },
          launchParams: {
            query_id: ids.queryId.value,
            start_param: ids.startParam.value,
            startapp: ids.startapp.value
          },
          appContext: {
            colorScheme: ids.colorScheme.value,
            isExpanded: ids.expanded.value === "true",
            launchMode: ids.launchMode.value,
            platform: ids.platform.value,
            version: ids.appVersion.value,
            viewportHeight: Number(ids.viewportHeight.value),
            viewportWidth: Number(ids.viewportWidth.value)
          }
        };
      }

      async function loadState() {
        const payload = await request("/state");
        renderState(payload);
      }

      document.getElementById("send-chat").addEventListener("click", async () => {
        const text = ids.chatInput.value.trim();
        if (!text) return;
        ids.chatInput.value = "";
        await request("/chat/send", {
          method: "POST",
          body: JSON.stringify({ text })
        }).then(renderState);
      });

      document.querySelectorAll("[data-command]").forEach((button) => {
        button.addEventListener("click", async () => {
          const text = button.getAttribute("data-command");
          if (!text) return;
          await request("/chat/send", {
            method: "POST",
            body: JSON.stringify({ text })
          }).then(renderState);
        });
      });

      document.getElementById("open-app").addEventListener("click", async () => {
        ids.appFrame.dataset.appSrc = appBasePath + "/";
        await request("/chat/open-app", { method: "POST" }).then(renderState);
      });

      document.getElementById("replay-last").addEventListener("click", async () => {
        await request("/chat/replay", {
          method: "POST",
          body: JSON.stringify({})
        }).then(renderState);
      });

      document.getElementById("reset-chat").addEventListener("click", async () => {
        await request("/chat/reset", { method: "POST" }).then(renderState);
      });

      document.getElementById("send-web-app-data").addEventListener("click", async () => {
        await request("/chat/web-app-data", {
          method: "POST",
          body: JSON.stringify({ data: ids.webAppData.value })
        }).then(renderState);
      });

      document.getElementById("save-scenario").addEventListener("click", async () => {
        const payload = await request("/scenarios", {
          method: "POST",
          body: JSON.stringify({
            name: ids.scenarioName.value
          })
        });
        renderScenarios(payload.scenarios);
        setStatus("Saved scenario " + payload.scenarioRef.name + ".");
      });

      document.getElementById("refresh-scenarios").addEventListener("click", async () => {
        const payload = await request("/scenarios");
        renderScenarios(payload.scenarios);
      });

      document.getElementById("apply-state").addEventListener("click", async () => {
        await request("/state", {
          method: "POST",
          body: JSON.stringify(collectProfilePatch())
        }).then(renderState);
      });

      document.getElementById("reload-app").addEventListener("click", () => {
        ids.appFrame.dataset.appSrc = appBasePath + "/";
        if (currentState?.debug?.appOpen) {
          setAppFrameSource(appBasePath + "/");
          return;
        }
        void request("/chat/open-app", { method: "POST" }).then(renderState);
      });

      document.querySelectorAll("[data-event]").forEach((button) => {
        button.addEventListener("click", async () => {
          const name = button.getAttribute("data-event");
          if (!name) return;

          if (name === "main-button-click") {
            postToApp({ type: "main-button-click" });
          } else if (name === "back-button-click") {
            postToApp({ type: "back-button-click" });
          } else {
            postToApp({
              name,
              payload: {
                source: "simulator-ui"
              },
              type: "emit-event"
            });
          }

          await request("/events/trigger", {
            method: "POST",
            body: JSON.stringify({
              name,
              payload: {
                source: "simulator-ui"
              }
            })
          }).then((payload) => renderEvents(payload.events));
        });
      });

      ids.appFrame.addEventListener("load", () => {
        if (!currentState?.debug?.appOpen) {
          return;
        }
        if (currentState?.profile) {
          postToApp({
            profile: currentState.profile,
            type: "sync-profile"
          });
        }
        void inspectAppFrameResponse();
      });

      loadState().catch((error) => {
        setStatus(error.message);
      });
    </script>
  </body>
</html>`;
}

function createTranscriptEntry(
  role: SimulatorTranscriptEntry["role"],
  text: string,
  buttons?: SimulatorTranscriptEntry["buttons"]
): SimulatorTranscriptEntry {
  return {
    at: new Date().toISOString(),
    buttons,
    id: createId(),
    role,
    text
  };
}

function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function sendHtml(response: http.ServerResponse, html: string): void {
  response.writeHead(200, {
    "content-length": Buffer.byteLength(html),
    "content-type": "text/html; charset=utf-8"
  });
  if (response.req?.method === "HEAD") {
    response.end();
    return;
  }
  response.end(html);
}

function sendJson(response: http.ServerResponse, statusCode: number, payload: unknown): void {
  const body = JSON.stringify(payload, null, 2);
  response.writeHead(statusCode, {
    "content-length": Buffer.byteLength(body),
    "content-type": "application/json; charset=utf-8"
  });
  response.end(body);
}

async function readJsonBody(request: http.IncomingMessage): Promise<unknown> {
  if (request.method === "GET" || request.method === "HEAD") {
    return {};
  }

  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
