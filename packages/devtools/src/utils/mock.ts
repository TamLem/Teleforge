function escapeInlineScript(script: string): string {
  return script.replace(/<\/script/gi, "<\\/script");
}

export function injectTelegramMock(html: string): string {
  if (!html.includes("</body>") || html.includes("data-teleforge-mock")) {
    return html;
  }

  return html.replace("</body>", `${mockOverlayMarkup()}\n</body>`);
}

function mockOverlayMarkup(): string {
  const script = `
(() => {
  if (window.__teleforgeMockInstalled) return;
  window.__teleforgeMockInstalled = true;

  const state = {
    launchMode: 'inline',
    theme: 'light',
    version: '7.0',
    user: { id: 42, first_name: 'Dev', username: 'teleforge_dev' },
    events: []
  };

  const listeners = new Map();

  const logEvent = (name, payload) => {
    state.events.unshift({ name, payload, at: new Date().toISOString() });
    state.events = state.events.slice(0, 12);
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

  const themeParamsFor = (theme) => theme === 'dark'
    ? { bg_color: '#101722', text_color: '#f3f7fb', secondary_bg_color: '#172130', button_color: '#5bb1ff', button_text_color: '#08131f' }
    : { bg_color: '#f8fbff', text_color: '#0f1724', secondary_bg_color: '#ffffff', button_color: '#1769e0', button_text_color: '#ffffff' };

  const webApp = {
    platform: 'teleforge-mock',
    version: state.version,
    colorScheme: state.theme,
    themeParams: themeParamsFor(state.theme),
    initData: 'query_id=teleforge-dev',
    initDataUnsafe: { user: state.user },
    ready() { logEvent('ready'); },
    expand() { emitEvent('viewportChanged', { is_expanded: true }); },
    close() { logEvent('close'); },
    sendData(data) { logEvent('sendData', data); },
    onEvent,
    offEvent,
    setLaunchMode(mode) {
      state.launchMode = mode;
      document.documentElement.dataset.teleforgeLaunchMode = mode;
      emitEvent('launchModeChanged', { mode });
    },
    setTheme(theme) {
      state.theme = theme;
      webApp.colorScheme = theme;
      webApp.themeParams = themeParamsFor(theme);
      document.documentElement.dataset.teleforgeTheme = theme;
      emitEvent('themeChanged', { theme });
    },
    setVersion(version) {
      state.version = version;
      webApp.version = version;
      emitEvent('versionChanged', { version });
    },
    setUser(user) {
      state.user = user;
      webApp.initDataUnsafe = { ...webApp.initDataUnsafe, user };
      emitEvent('userChanged', user);
    },
    logEvent
  };

  window.Telegram = window.Telegram ?? {};
  window.Telegram.WebApp = webApp;
  window.__teleforgeMock = webApp;

  const style = document.createElement('style');
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
    [data-teleforge-mock] h2 {
      margin: 0 0 0.75rem;
      font-size: 0.95rem;
    }
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
    [data-teleforge-mock] button {
      cursor: pointer;
      margin-top: 0.5rem;
    }
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

  const panel = document.createElement('aside');
  panel.dataset.teleforgeMock = 'true';
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
    <pre data-events>Event inspector ready.</pre>
  \`;
  document.body.appendChild(panel);

  const renderEvents = () => {
    const eventsNode = panel.querySelector('[data-events]');
    if (!eventsNode) return;
    eventsNode.textContent = state.events.length === 0
      ? 'Event inspector ready.'
      : state.events.map((entry) => \`[\${entry.at}] \${entry.name}: \${JSON.stringify(entry.payload ?? {})}\`).join('\\n');
  };

  panel.querySelector('[data-field="launchMode"]').addEventListener('change', (event) => {
    webApp.setLaunchMode(event.target.value);
  });
  panel.querySelector('[data-field="theme"]').addEventListener('change', (event) => {
    webApp.setTheme(event.target.value);
  });
  panel.querySelector('[data-field="version"]').addEventListener('change', (event) => {
    webApp.setVersion(event.target.value);
  });
  panel.querySelector('[data-action="expand"]').addEventListener('click', () => {
    webApp.expand();
  });

  webApp.setLaunchMode(state.launchMode);
  webApp.setTheme(state.theme);
  webApp.setVersion(state.version);
  logEvent('mockReady', { launchMode: state.launchMode, theme: state.theme, version: state.version });
})();
`;

  return `<script data-teleforge-mock="true">${escapeInlineScript(script)}</script>`;
}
