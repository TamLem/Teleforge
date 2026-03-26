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
import type { TeleforgeManifest } from "./manifest.js";

export interface DevSimulatorOptions {
  appBasePath?: string;
  cwd: string;
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

export function createDevSimulator(options: DevSimulatorOptions): DevSimulator {
  const appBasePath = options.appBasePath ?? "/__teleforge/app";
  const apiBasePath = "/__teleforge/api";
  const manifestCommands = options.manifest.bot.commands ?? [];
  let currentProfile = createDefaultProfile(process.env.BOT_TOKEN);
  let bridgePromise: Promise<SimulatorBotBridge | null> | undefined;
  let scenarioStoragePromise: Promise<DevSimulatorScenarioStorage> | undefined;
  const eventLog: MockEventLogEntry[] = [];
  let transcript: SimulatorTranscriptEntry[] = [
    createTranscriptEntry(
      "system",
      `Simulator ready for ${options.manifest.name}. Send /start to open the Mini App or /help to inspect available commands.`
    )
  ];

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
        currentProfile = mergeProfile(
          currentProfile,
          body as PartialMockProfile,
          process.env.BOT_TOKEN
        );
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
        transcript = transcript.concat(
          createTranscriptEntry(
            "system",
            `Opened Mini App shell at ${appBasePath}/ using launch mode ${currentProfile.appContext.launchMode}.`
          )
        );
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
        transcript = [
          createTranscriptEntry(
            "system",
            `Transcript reset for ${options.manifest.name}. Send /start to begin a new session.`
          )
        ];
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
    return {
      chat: {
        commandHints: bridge ? await bridge.getCommands() : manifestCommands.map((command) => command.command),
        mode: bridge ? "workspace" : "manifest"
      },
      events: eventLog,
      manifest: {
        commands: manifestCommands,
        name: options.manifest.name
      },
      profile: currentProfile,
      scenarios: await (await resolveScenarioStorage()).listScenarios(),
      transcript
    };
  }

  async function handleChatInput(text: string) {
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
          value: button.web_app.url
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
        grid-template-columns: 360px minmax(420px, 1fr) 320px;
        gap: 1rem;
        align-items: start;
      }
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
      .app-frame {
        width: 100%;
        min-height: 72vh;
        border: 0;
        background: #ffffff;
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
      .status {
        padding: 0.75rem 0.9rem;
        border-radius: 14px;
        background: rgba(17, 138, 178, 0.1);
        color: #0d5675;
      }
      @media (max-width: 1320px) {
        .shell {
          grid-template-columns: 1fr;
        }
        .app-frame {
          min-height: 60vh;
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
          the center pane embeds the real app, and the right pane controls Telegram-like user, launch,
          theme, viewport, and event state.
        </p>
      </header>
      <div class="shell">
        <section class="pane">
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
        <section class="pane">
          <section>
            <h2>Mini App</h2>
            <div class="status" id="simulator-status">Loading simulator state…</div>
          </section>
          <section>
            <iframe id="app-frame" class="app-frame" src="${options.appBasePath}/" title="Teleforge Mini App"></iframe>
          </section>
        </section>
        <aside class="pane">
          <section>
            <h2>Scenarios</h2>
            <div class="controls">
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
        </aside>
      </div>
    </main>
    <script>
      const apiBase = ${JSON.stringify(options.apiBasePath)};
      const appBasePath = ${JSON.stringify(options.appBasePath)};
      let currentState = null;

      const ids = {
        appFrame: document.getElementById("app-frame"),
        appVersion: document.getElementById("app-version"),
        chatInput: document.getElementById("chat-input"),
        colorScheme: document.getElementById("color-scheme"),
        events: document.getElementById("events"),
        expanded: document.getElementById("expanded"),
        firstName: document.getElementById("first-name"),
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

      function renderEvents(events) {
        ids.events.textContent = events.length === 0
          ? "Waiting for events…"
          : events.map((entry) => "[" + entry.at + "] " + entry.name + ": " + JSON.stringify(entry.payload || {})).join("\\n");
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
                  ids.appFrame.src = button.value;
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
        renderScenarios(payload.scenarios);
        setStatus("Simulator ready.");
        postToApp({
          profile: payload.profile,
          type: "sync-profile"
        });
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
        ids.appFrame.src = appBasePath + "/";
        await request("/chat/open-app", { method: "POST" }).then(renderState);
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
        ids.appFrame.src = appBasePath + "/";
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
        if (currentState?.profile) {
          postToApp({
            profile: currentState.profile,
            type: "sync-profile"
          });
        }
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
