import type { MockProfile } from "./mock-server/types.js";

function escapeInlineScript(script: string): string {
  return script.replace(/<\/script/gi, "<\\/script");
}

export interface TelegramMockInjectionOptions {
  overlay?: boolean;
  profile?: MockProfile;
}

export function injectTelegramMock(
  html: string,
  options: TelegramMockInjectionOptions = {}
): string {
  if (!html.includes("</body>") || html.includes("data-teleforge-mock")) {
    return html;
  }

  return html.replace("</body>", `${mockOverlayMarkup(options)}\n</body>`);
}

function mockOverlayMarkup(options: TelegramMockInjectionOptions): string {
  const profile = options.profile ?? null;
  const overlay = options.overlay ?? true;
  const script = `
(() => {
  if (window.__teleforgeMockInstalled) return;
  window.__teleforgeMockInstalled = true;

  const listeners = new Map();
  const initialProfile = ${JSON.stringify(profile)};
  const defaultProfile = {
    name: "Default Profile",
    user: {
      id: 42,
      first_name: "Dev",
      username: "teleforge_dev",
      language_code: "en",
      is_premium: false
    },
    launchParams: {
      auth_date: Math.floor(Date.now() / 1000),
      hash: "mock-hash",
      query_id: "teleforge-query",
      start_param: "welcome"
    },
    appContext: {
      colorScheme: "light",
      isExpanded: true,
      launchMode: "inline",
      platform: "ios",
      version: "7.2",
      viewportHeight: 720,
      viewportWidth: 390
    },
    capabilities: {
      read: true,
      write: true
    }
  };
  const state = {
    profile: normalizeProfile(initialProfile ?? defaultProfile),
    events: []
  };

  function normalizeProfile(profile) {
    return {
      ...defaultProfile,
      ...profile,
      user: {
        ...defaultProfile.user,
        ...(profile?.user ?? {})
      },
      launchParams: {
        ...defaultProfile.launchParams,
        ...(profile?.launchParams ?? {})
      },
      appContext: {
        ...defaultProfile.appContext,
        ...(profile?.appContext ?? {})
      },
      capabilities: {
        ...defaultProfile.capabilities,
        ...(profile?.capabilities ?? {})
      }
    };
  }

  const themeParamsFor = (theme) => theme === "dark"
    ? {
        bg_color: "#101722",
        text_color: "#f3f7fb",
        secondary_bg_color: "#172130",
        button_color: "#5bb1ff",
        button_text_color: "#08131f"
      }
    : {
        bg_color: "#f8fbff",
        text_color: "#0f1724",
        secondary_bg_color: "#ffffff",
        button_color: "#1769e0",
        button_text_color: "#ffffff"
      };

  const logEvent = (name, payload) => {
    state.events.unshift({ name, payload, at: new Date().toISOString() });
    state.events = state.events.slice(0, 20);
    renderEvents();
  };

  const onEvent = (name, handler) => {
    const handlers = listeners.get(name) ?? [];
    handlers.push(handler);
    listeners.set(name, handlers);
  };

  const offEvent = (name, handler) => {
    const handlers = listeners.get(name) ?? [];
    listeners.set(name, handlers.filter((entry) => entry !== handler));
  };

  const emitEvent = (name, payload) => {
    logEvent(name, payload);
    for (const handler of listeners.get(name) ?? []) {
      handler(payload);
    }
  };

  const mainButton = {
    color: "#1769e0",
    isActive: true,
    isProgressVisible: false,
    isVisible: false,
    text: "",
    textColor: "#ffffff",
    _clickHandlers: [],
    disable() {
      mainButton.isActive = false;
      emitEvent("mainButtonChanged", snapshotMainButton());
    },
    enable() {
      mainButton.isActive = true;
      emitEvent("mainButtonChanged", snapshotMainButton());
    },
    hide() {
      mainButton.isVisible = false;
      emitEvent("mainButtonChanged", snapshotMainButton());
    },
    hideProgress() {
      mainButton.isProgressVisible = false;
      emitEvent("mainButtonChanged", snapshotMainButton());
    },
    offClick(handler) {
      mainButton._clickHandlers = mainButton._clickHandlers.filter((entry) => entry !== handler);
    },
    onClick(handler) {
      mainButton._clickHandlers.push(handler);
    },
    setParams(next) {
      if (!next || typeof next !== "object") return;
      if (typeof next.text === "string") mainButton.text = next.text;
      if (typeof next.color === "string") mainButton.color = next.color;
      if (typeof next.text_color === "string") mainButton.textColor = next.text_color;
      if (typeof next.is_active === "boolean") mainButton.isActive = next.is_active;
      if (typeof next.is_progress_visible === "boolean") mainButton.isProgressVisible = next.is_progress_visible;
      if (typeof next.is_visible === "boolean") mainButton.isVisible = next.is_visible;
      emitEvent("mainButtonChanged", snapshotMainButton());
    },
    setText(text) {
      if (typeof text === "string") {
        mainButton.text = text;
        emitEvent("mainButtonChanged", snapshotMainButton());
      }
    },
    show() {
      mainButton.isVisible = true;
      emitEvent("mainButtonChanged", snapshotMainButton());
    },
    showProgress(leaveActive = false) {
      mainButton.isProgressVisible = true;
      if (!leaveActive) {
        mainButton.isActive = false;
      }
      emitEvent("mainButtonChanged", snapshotMainButton());
    }
  };

  const backButton = {
    isVisible: false,
    _clickHandlers: [],
    hide() {
      backButton.isVisible = false;
      emitEvent("backButtonChanged", snapshotBackButton());
    },
    offClick(handler) {
      backButton._clickHandlers = backButton._clickHandlers.filter((entry) => entry !== handler);
    },
    onClick(handler) {
      backButton._clickHandlers.push(handler);
    },
    show() {
      backButton.isVisible = true;
      emitEvent("backButtonChanged", snapshotBackButton());
    }
  };

  function snapshotMainButton() {
    return {
      color: mainButton.color,
      isActive: mainButton.isActive,
      isProgressVisible: mainButton.isProgressVisible,
      isVisible: mainButton.isVisible,
      text: mainButton.text,
      textColor: mainButton.textColor
    };
  }

  function snapshotBackButton() {
    return {
      isVisible: backButton.isVisible
    };
  }

  function buildInitData(profile) {
    const fields = [];
    fields.push("auth_date=" + profile.launchParams.auth_date);
    if (profile.launchParams.query_id) fields.push("query_id=" + profile.launchParams.query_id);
    if (profile.launchParams.start_param) fields.push("start_param=" + profile.launchParams.start_param);
    if (profile.launchParams.startapp) fields.push("startapp=" + profile.launchParams.startapp);
    if (profile.launchParams.hash) fields.push("hash=" + profile.launchParams.hash);
    fields.push("user=" + JSON.stringify(profile.user));
    return fields.join("&");
  }

  function buildInitDataUnsafe(profile) {
    return {
      auth_date: profile.launchParams.auth_date,
      hash: profile.launchParams.hash,
      query_id: profile.launchParams.query_id,
      start_param: profile.launchParams.start_param,
      startapp: profile.launchParams.startapp,
      user: profile.user
    };
  }

  const webApp = {
    platform: "teleforge-mock",
    version: state.profile.appContext.version,
    colorScheme: state.profile.appContext.colorScheme,
    themeParams: themeParamsFor(state.profile.appContext.colorScheme),
    initData: buildInitData(state.profile),
    initDataUnsafe: buildInitDataUnsafe(state.profile),
    isExpanded: state.profile.appContext.isExpanded,
    viewportHeight: state.profile.appContext.viewportHeight,
    viewportStableHeight: state.profile.appContext.viewportHeight,
    headerColor: themeParamsFor(state.profile.appContext.colorScheme).bg_color,
    backgroundColor: themeParamsFor(state.profile.appContext.colorScheme).bg_color,
    MainButton: mainButton,
    BackButton: backButton,
    ready() { logEvent("ready"); },
    expand() {
      webApp.isExpanded = true;
      state.profile.appContext.isExpanded = true;
      emitEvent("viewportChanged", { is_expanded: true });
    },
    close() { logEvent("close"); },
    sendData(data) { logEvent("sendData", data); },
    onEvent,
    offEvent,
    setHeaderColor(color) {
      if (typeof color === "string") {
        webApp.headerColor = color;
        emitEvent("themeChanged", { headerColor: color });
      }
    },
    setBackgroundColor(color) {
      if (typeof color === "string") {
        webApp.backgroundColor = color;
        emitEvent("themeChanged", { backgroundColor: color });
      }
    }
  };

  function applyProfile(profile, options = {}) {
    state.profile = normalizeProfile(profile);
    const nextThemeParams = themeParamsFor(state.profile.appContext.colorScheme);
    webApp.version = state.profile.appContext.version;
    webApp.platform = state.profile.appContext.platform;
    webApp.colorScheme = state.profile.appContext.colorScheme;
    webApp.themeParams = nextThemeParams;
    webApp.initData = buildInitData(state.profile);
    webApp.initDataUnsafe = buildInitDataUnsafe(state.profile);
    webApp.isExpanded = state.profile.appContext.isExpanded;
    webApp.viewportHeight = state.profile.appContext.viewportHeight;
    webApp.viewportStableHeight = state.profile.appContext.viewportHeight;
    document.documentElement.dataset.teleforgeLaunchMode = state.profile.appContext.launchMode;
    document.documentElement.dataset.teleforgeTheme = state.profile.appContext.colorScheme;
    document.documentElement.dataset.teleforgePlatform = state.profile.appContext.platform;
    document.documentElement.style.colorScheme = state.profile.appContext.colorScheme;
    document.documentElement.style.setProperty("--tg-bg-color", nextThemeParams.bg_color);
    document.documentElement.style.setProperty("--tg-text-color", nextThemeParams.text_color);
    document.documentElement.style.setProperty("--tg-secondary-bg-color", nextThemeParams.secondary_bg_color);
    document.documentElement.style.setProperty("--tg-button-color", nextThemeParams.button_color);
    document.documentElement.style.setProperty("--tg-button-text-color", nextThemeParams.button_text_color);

    if (!options.silent) {
      emitEvent("launchModeChanged", { mode: state.profile.appContext.launchMode });
      emitEvent("themeChanged", { theme: state.profile.appContext.colorScheme });
      emitEvent("viewportChanged", {
        height: state.profile.appContext.viewportHeight,
        is_expanded: state.profile.appContext.isExpanded,
        width: state.profile.appContext.viewportWidth
      });
      emitEvent("userChanged", state.profile.user);
    }

    renderOverlay();
  }

  function renderEvents() {
    const eventsNode = panel?.querySelector("[data-events]");
    if (!eventsNode) return;
    eventsNode.textContent = state.events.length === 0
      ? "Event inspector ready."
      : state.events.map((entry) => "[" + entry.at + "] " + entry.name + ": " + JSON.stringify(entry.payload ?? {})).join("\\n");
  }

  function renderOverlay() {
    if (!panel) return;
    const profile = state.profile;
    const launchNode = panel.querySelector("[data-field=\\"launchMode\\"]");
    const themeNode = panel.querySelector("[data-field=\\"theme\\"]");
    const versionNode = panel.querySelector("[data-field=\\"version\\"]");
    if (launchNode) launchNode.value = profile.appContext.launchMode;
    if (themeNode) themeNode.value = profile.appContext.colorScheme;
    if (versionNode) versionNode.value = profile.appContext.version;
  }

  function clickMainButton() {
    logEvent("mainButtonClicked");
    for (const handler of mainButton._clickHandlers) {
      handler();
    }
  }

  function clickBackButton() {
    logEvent("backButtonPressed");
    for (const handler of backButton._clickHandlers) {
      handler();
    }
  }

  let panel = null;

  if (${JSON.stringify(overlay)}) {
    const style = document.createElement("style");
    style.textContent = \`
      [data-teleforge-mock] {
        position: fixed;
        right: 1rem;
        bottom: 1rem;
        z-index: 2147483647;
        width: min(22rem, calc(100vw - 2rem));
        padding: 1rem;
        border-radius: 18px;
        background: rgba(12, 18, 28, 0.92);
        color: #eef6ff;
        font: 13px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.32);
        backdrop-filter: blur(18px);
      }
      [data-teleforge-mock] h2 { margin: 0 0 0.75rem; font-size: 0.95rem; }
      [data-teleforge-mock] .teleforge-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.75rem;
        margin-bottom: 0.75rem;
      }
      [data-teleforge-mock] label {
        display: grid;
        gap: 0.35rem;
        font-size: 0.72rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: rgba(238, 246, 255, 0.7);
      }
      [data-teleforge-mock] select,
      [data-teleforge-mock] button {
        width: 100%;
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.06);
        color: inherit;
        padding: 0.55rem 0.65rem;
        font: inherit;
      }
      [data-teleforge-mock] button { cursor: pointer; margin-top: 0.5rem; }
      [data-teleforge-mock] pre {
        margin: 0.75rem 0 0;
        padding: 0.75rem;
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.05);
        max-height: 12rem;
        overflow: auto;
        white-space: pre-wrap;
        word-break: break-word;
      }
    \`;
    document.head.appendChild(style);

    panel = document.createElement("aside");
    panel.dataset.teleforgeMock = "true";
    panel.innerHTML = \`
      <h2>Teleforge Mock</h2>
      <div class="teleforge-grid">
        <label>
          Launch
          <select data-field="launchMode">
            <option value="inline">inline</option>
            <option value="compact">compact</option>
            <option value="fullscreen">fullscreen</option>
            <option value="full">full</option>
          </select>
        </label>
        <label>
          Theme
          <select data-field="theme">
            <option value="light">light</option>
            <option value="dark">dark</option>
          </select>
        </label>
        <label>
          Version
          <select data-field="version">
            <option value="7.0">7.0</option>
            <option value="7.2">7.2</option>
            <option value="7.10">7.10</option>
          </select>
        </label>
        <label>
          Events
          <button type="button" data-action="expand">expand()</button>
        </label>
      </div>
      <div class="teleforge-grid">
        <label>
          Main Button
          <button type="button" data-action="mainButton">click()</button>
        </label>
        <label>
          Back Button
          <button type="button" data-action="backButton">click()</button>
        </label>
      </div>
      <pre data-events>Event inspector ready.</pre>
    \`;
    document.body.appendChild(panel);

    panel.querySelector("[data-field=\\"launchMode\\"]").addEventListener("change", (event) => {
      const nextProfile = normalizeProfile({
        ...state.profile,
        appContext: {
          ...state.profile.appContext,
          launchMode: event.target.value
        }
      });
      applyProfile(nextProfile);
    });
    panel.querySelector("[data-field=\\"theme\\"]").addEventListener("change", (event) => {
      const nextProfile = normalizeProfile({
        ...state.profile,
        appContext: {
          ...state.profile.appContext,
          colorScheme: event.target.value
        }
      });
      applyProfile(nextProfile);
    });
    panel.querySelector("[data-field=\\"version\\"]").addEventListener("change", (event) => {
      const nextProfile = normalizeProfile({
        ...state.profile,
        appContext: {
          ...state.profile.appContext,
          version: event.target.value
        }
      });
      applyProfile(nextProfile);
    });
    panel.querySelector("[data-action=\\"expand\\"]").addEventListener("click", () => {
      webApp.expand();
    });
    panel.querySelector("[data-action=\\"mainButton\\"]").addEventListener("click", clickMainButton);
    panel.querySelector("[data-action=\\"backButton\\"]").addEventListener("click", clickBackButton);
  }

  window.addEventListener("message", (event) => {
    const payload = event.data;
    if (!payload || payload.source !== "teleforge-simulator") {
      return;
    }

    if (payload.type === "sync-profile" && payload.profile) {
      applyProfile(payload.profile);
      return;
    }

    if (payload.type === "emit-event" && typeof payload.name === "string") {
      emitEvent(payload.name, payload.payload);
      return;
    }

    if (payload.type === "main-button-click") {
      clickMainButton();
      return;
    }

    if (payload.type === "back-button-click") {
      clickBackButton();
    }
  });

  applyProfile(state.profile, { silent: true });
  window.Telegram = window.Telegram ?? {};
  window.Telegram.WebApp = webApp;
  window.__teleforgeMock = {
    applyProfile,
    emitEvent,
    profile: () => state.profile,
    webApp
  };
  logEvent("mockReady", {
    launchMode: state.profile.appContext.launchMode,
    theme: state.profile.appContext.colorScheme,
    version: state.profile.appContext.version
  });
})();
`;

  return `<script data-teleforge-mock="true">${escapeInlineScript(script)}</script>`;
}
